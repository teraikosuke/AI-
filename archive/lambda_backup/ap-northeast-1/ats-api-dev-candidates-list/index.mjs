import pg from "pg";

// CORS configuration.
// Prefer environment variables if present; otherwise fall back to the baked-in list.
function parseOriginList(value) {
  return String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:8000",
  "http://localhost:8001",
  "http://localhost:8081",
  "https://agent-key.pages.dev",
  "https://develop.agent-key.pages.dev",
];

const allowedFromEnv = parseOriginList(process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS);
const ALLOWED_ORIGINS = new Set([...DEFAULT_ALLOWED_ORIGINS, ...allowedFromEnv]);

const baseHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization",
};

function buildHeaders(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || "";
  if (ALLOWED_ORIGINS.has(origin)) {
    return { ...baseHeaders, "Access-Control-Allow-Origin": origin };
  }
  return baseHeaders;
}

const { Pool } = pg;

const pool = new Pool({
  host: (process.env.DB_HOST || "").trim(),
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 2,
  idleTimeoutMillis: 30000,
});

const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(Math.max(x, min), max);
}

function toBoolOrNull(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return null;
}

function uniqSorted(values) {
  const set = new Set();
  (values || []).forEach((v) => {
    const t = String(v ?? "").trim();
    if (!t) return;
    set.add(t);
  });
  return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "ja"));
}

function normalizeView(value) {
  return String(value || "").trim().toLowerCase();
}

// ===== Valid-application judgment (shared backend logic for list/detail consistency) =====
const PLACEHOLDERS = new Set(["-", "ー", "未設定", "未入力", "未登録", "未指定"]);

function parseRuleNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseListValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (value === null || value === undefined) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeScreeningRulesRow(row) {
  const minAge = parseRuleNumber(row?.min_age ?? row?.minAge);
  const maxAge = parseRuleNumber(row?.max_age ?? row?.maxAge);
  const allowedJlptLevels = parseListValue(row?.allowed_jlpt_levels ?? row?.allowedJlptLevels);
  const targetNationalitiesList = parseListValue(row?.target_nationalities ?? row?.targetNationalities);
  return { minAge, maxAge, allowedJlptLevels, targetNationalitiesList };
}

function isUnlimitedMinAge(value) {
  return value === null || value === undefined || value === "" || Number(value) <= 0;
}

function isUnlimitedMaxAge(value) {
  return value === null || value === undefined || value === "" || Number(value) >= 100;
}

function hasScreeningConstraints(rules) {
  if (!rules) return false;
  if (!isUnlimitedMinAge(rules.minAge)) return true;
  if (!isUnlimitedMaxAge(rules.maxAge)) return true;
  if (Array.isArray(rules.targetNationalitiesList) && rules.targetNationalitiesList.length > 0) return true;
  if (Array.isArray(rules.allowedJlptLevels) && rules.allowedJlptLevels.length > 0) return true;
  return false;
}

function toHalfWidthDigits(text) {
  return String(text || "").replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

function parseAgeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 0 && value <= 130 ? value : null;
  }
  const normalized = toHalfWidthDigits(String(value).trim());
  if (!normalized) return null;
  const direct = Number(normalized);
  if (Number.isFinite(direct) && direct >= 0 && direct <= 130) return direct;
  const match = normalized.match(/(\d{1,3})\s*(?:歳|才)?/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 130 ? parsed : null;
}

function calculateAgeFromBirthDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

function normalizeNationality(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (PLACEHOLDERS.has(text)) return "";
  const lower = text.toLowerCase();
  if (["japan", "jpn", "jp", "japanese"].includes(lower)) return "日本";
  if (["日本国", "日本国籍", "日本人", "日本国民"].includes(text)) return "日本";
  return text;
}

function isJapaneseNationality(value) {
  return normalizeNationality(value) === "日本";
}

function normalizeJlpt(value) {
  const text = String(value || "").trim();
  if (!text || PLACEHOLDERS.has(text)) return "";
  return text;
}

function computeValidApplication(candidate, rules) {
  if (!candidate || !rules) return null;
  if (!hasScreeningConstraints(rules)) return null;

  const age = calculateAgeFromBirthDate(candidate.birth_date ?? candidate.birthDate) ?? parseAgeNumber(candidate.age);
  const requiresMinAge = !isUnlimitedMinAge(rules.minAge);
  const requiresMaxAge = !isUnlimitedMaxAge(rules.maxAge);
  if (requiresMinAge || requiresMaxAge) {
    if (age === null) return false;
    if (requiresMinAge && age < rules.minAge) return false;
    if (requiresMaxAge && age > rules.maxAge) return false;
  }

  // Requirement: empty nationality is treated as Japanese.
  const candidateNationality = normalizeNationality(candidate.nationality) || "日本";

  const allowedNationalities = parseListValue(rules.targetNationalitiesList)
    .map((value) => normalizeNationality(value))
    .filter(Boolean);

  if (allowedNationalities.length > 0 && !allowedNationalities.includes(candidateNationality)) {
    return false;
  }

  // Japanese candidates are valid when age/nationality pass.
  if (isJapaneseNationality(candidateNationality)) return true;

  const allowedJlptLevels = parseListValue(rules.allowedJlptLevels);
  if (!allowedJlptLevels.length) return true;

  const jlpt = normalizeJlpt(candidate.japanese_level ?? candidate.japaneseLevel);
  if (!jlpt) return false;
  return allowedJlptLevels.includes(jlpt);
}

async function loadScreeningRules(client) {
  const res = await client.query(
    "SELECT min_age, max_age, allowed_jlpt_levels, target_nationalities FROM screening_rules WHERE id = 1"
  );
  if (res.rows?.length) return normalizeScreeningRulesRow(res.rows[0]);
  return normalizeScreeningRulesRow({
    min_age: 18,
    max_age: 60,
    allowed_jlpt_levels: ["N1", "N2"],
    target_nationalities: "日本",
  });
}

async function bulkSyncCandidateValidity(client, updates) {
  if (!Array.isArray(updates) || updates.length === 0) return 0;
  const params = [];
  const valuesSql = updates
    .map(([id, value], idx) => {
      const i = idx * 2;
      params.push(id, value);
      return `($${i + 1}::int, $${i + 2}::boolean)`;
    })
    .join(", ");

  await client.query(
    `
      UPDATE candidates c
      SET is_effective_application = v.is_effective_application,
          updated_at = NOW()
      FROM (VALUES ${valuesSql}) AS v(id, is_effective_application)
      WHERE c.id = v.id
        AND c.is_effective_application IS DISTINCT FROM v.is_effective_application
    `,
    params
  );

  return updates.length;
}

function buildListItem(row, resolvedValid = null) {
  const mediaValue = row.apply_route || row.apply_route_text || row.db_source || "-";
  const companyValue = row.client_name || row.apply_company_name || row.db_company_name || "-";
  const jobValue = row.apply_job_name || row.db_job_name || "-";

  const validValue =
    resolvedValid === true || resolvedValid === false ? resolvedValid : toBoolOrNull(row.is_effective_application);

  return {
    id: row.id,
    name: row.name,
    nameKana: row.name_kana ?? null,
    email: row.email ?? "",
    phone: row.phone ?? "",
    birthDate: row.birth_date ?? null,
    birth_date: row.birth_date ?? null,
    age: row.age ?? null,
    gender: row.gender ?? null,

    registeredAt: row.registered_at || row.created_at || null,
    registeredDate: row.registered_date || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,

    // Keep both keys to match existing UI normalizer.
    is_effective_application: validValue,
    validApplication: validValue,

    nationality: row.nationality || "-",
    japaneseLevel: row.japanese_level || "-",

    // Assignees:
    // - advisor: candidates.advisor_user_id -> users(role=advisor)
    // - CS: candidates.partner_user_id -> users(role=caller)  (legacy naming)
    advisorUserId: row.advisor_user_id ?? null,
    advisorName: row.db_advisor_name || row.db_advisor_name_text || "",

    // Backward compatible keys still referenced in some UI paths.
    partnerUserId: row.partner_user_id ?? null,
    partnerName: row.db_partner_name || row.db_partner_name_text || "",

    csUserId: row.partner_user_id ?? null,
    csName: row.db_partner_name || row.db_cs_name || "",

    phase: row.stage_current || "未接触",

    media: mediaValue,
    route: mediaValue,
    source: mediaValue,
    applyRoute: mediaValue,

    applyCompany: companyValue,
    companyName: companyValue,
    jobName: jobValue,

    next_action_date: row.next_action_date || null,
    next_action_note: row.next_action_note || "",

    candidateApplications: row.apps || [],
  };
}

export const handler = async (event) => {
  const headers = buildHeaders(event);
  const json = (statusCode, bodyObj) => ({
    statusCode,
    headers,
    body: bodyObj === undefined ? "" : JSON.stringify(bodyObj),
  });

  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
  if (method === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (method !== "GET") return json(405, { error: "Method Not Allowed" });

  const qs = event.queryStringParameters ?? {};
  const view = normalizeView(qs.view);

  // Paging
  const requestedLimit = toInt(qs.limit, view === "calendar" ? 2000 : 50);
  const limit = clamp(requestedLimit, 1, view === "calendar" ? 5000 : 50);
  const offset = clamp(toInt(qs.offset, 0), 0, 10_000_000);

  // Filters (list)
  const keyword = String(qs.keyword || "").trim();
  const name = String(qs.name || "").trim();
  const source = String(qs.source || "").trim();
  const company = String(qs.company || "").trim();
  const advisor = String(qs.advisor || "").trim();
  const valid = toBoolOrNull(qs.valid);
  const phase = String(qs.phase || "").trim();
  const from = String(qs.from || "").trim();
  const to = String(qs.to || "").trim();

  // Calendar filter
  const nextActionFrom = String(qs.nextActionFrom || "").trim();
  const nextActionTo = String(qs.nextActionTo || "").trim();

  // Backward compatible filters
  const advisorId = toInt(qs.advisorUserId, 0);
  const partnerId = toInt(qs.partnerUserId, 0);

  let client;
  try {
    client = await pool.connect();

    if (view === "masters") {
      const [sourcesC, sourcesA, companiesC, companiesCl, advisorsRes, phasesRes] = await Promise.all([
        client.query(
          `SELECT DISTINCT COALESCE(apply_route_text, source, '') AS v
           FROM candidates
           WHERE COALESCE(apply_route_text, source, '') <> ''
           ORDER BY v ASC`
        ),
        client.query(
          `SELECT DISTINCT COALESCE(apply_route, '') AS v
           FROM candidate_applications
           WHERE COALESCE(apply_route, '') <> ''
           ORDER BY v ASC`
        ),
        client.query(
          `SELECT DISTINCT COALESCE(apply_company_name, company_name, '') AS v
           FROM candidates
           WHERE COALESCE(apply_company_name, company_name, '') <> ''
           ORDER BY v ASC`
        ),
        client.query(
          `SELECT DISTINCT COALESCE(name, '') AS v
           FROM clients
           WHERE COALESCE(name, '') <> ''
           ORDER BY v ASC`
        ),
        client.query(
          `SELECT DISTINCT COALESCE(u_ad.name, c.partner_name, c.advisor_name, '') AS v
           FROM candidates c
           LEFT JOIN users u_ad ON c.advisor_user_id = u_ad.id
           WHERE COALESCE(u_ad.name, c.partner_name, c.advisor_name, '') <> ''
           ORDER BY v ASC`
        ),
        client.query(
          `SELECT DISTINCT COALESCE(stage_current, '') AS v
           FROM candidate_applications
           WHERE COALESCE(stage_current, '') <> ''
           ORDER BY v ASC`
        ),
      ]);

      const phases = ["未接触"].concat(
        uniqSorted((phasesRes.rows || []).map((r) => r.v).filter((v) => v && v !== "未接触"))
      );

      return json(200, {
        sources: uniqSorted(
          (sourcesC.rows || []).map((r) => r.v).concat((sourcesA.rows || []).map((r) => r.v))
        ),
        companies: uniqSorted(
          (companiesC.rows || []).map((r) => r.v).concat((companiesCl.rows || []).map((r) => r.v))
        ),
        advisors: uniqSorted((advisorsRes.rows || []).map((r) => r.v)),
        phases,
      });
    }

    // Load rules once per request so list view uses same judgment basis as detail view.
    const screeningRules = await loadScreeningRules(client);

    // Search conditions
    const conditions = ["1=1"];
    const params = [];

    if (name) {
      params.push(`%${name}%`);
      conditions.push(`(c.name ILIKE $${params.length})`);
    } else if (keyword) {
      // Backward-compatible search
      params.push(`%${keyword}%`);
      conditions.push(
        `(c.name ILIKE $${params.length} OR c.name_kana ILIKE $${params.length} OR c.email ILIKE $${params.length})`
      );
    }

    if (from) {
      params.push(from);
      conditions.push(`COALESCE(c.registered_at, c.registered_date::timestamptz, c.created_at)::date >= $${params.length}::date`);
    }

    if (to) {
      params.push(to);
      conditions.push(`COALESCE(c.registered_at, c.registered_date::timestamptz, c.created_at)::date <= $${params.length}::date`);
    }

    // Backward compatible ID filters
    if (advisorId > 0) {
      params.push(advisorId);
      conditions.push(`c.advisor_user_id = $${params.length}`);
    }

    // partnerUserId is treated as CS user id (candidates.partner_user_id).
    if (partnerId > 0) {
      params.push(partnerId);
      conditions.push(`c.partner_user_id = $${params.length}`);
    }

    if (advisor) {
      params.push(advisor);
      conditions.push(`LOWER(COALESCE(u_ad.name, c.partner_name, c.advisor_name, '')) = LOWER($${params.length})`);
    }

    if (source) {
      params.push(source);
      conditions.push(`LOWER(COALESCE(ca_latest.apply_route, c.apply_route_text, c.source, '')) = LOWER($${params.length})`);
    }

    if (company) {
      params.push(company);
      conditions.push(`LOWER(COALESCE(ca_latest.client_name, c.apply_company_name, c.company_name, '')) = LOWER($${params.length})`);
    }

    // Keep query compatibility; resolved values are recalculated below and synchronized back to DB.
    if (valid === true || valid === false) {
      params.push(valid);
      conditions.push(`c.is_effective_application = $${params.length}`);
    }

    if (phase) {
      if (phase === "未接触") {
        // No applications.
        conditions.push(`ca_latest.stage_current IS NULL`);
      } else {
        params.push(phase);
        conditions.push(`EXISTS (
          SELECT 1 FROM candidate_applications ca
          WHERE ca.candidate_id = c.id
          AND ca.stage_current = $${params.length}
        )`);
      }
    }

    if (view === "calendar") {
      conditions.push(`c.next_action_date IS NOT NULL`);
      if (nextActionFrom) {
        params.push(nextActionFrom);
        conditions.push(`c.next_action_date >= $${params.length}::date`);
      }
      if (nextActionTo) {
        params.push(nextActionTo);
        conditions.push(`c.next_action_date <= $${params.length}::date`);
      }
    }

    const whereClause = conditions.join(" AND ");

    // Latest application (used for display + some filters).
    const joinLatest = `
      LEFT JOIN LATERAL (
        SELECT
          ca.stage_current,
          ca.apply_route,
          cl.name as client_name
        FROM candidate_applications ca
        LEFT JOIN clients cl ON ca.client_id = cl.id
        WHERE ca.candidate_id = c.id
        ORDER BY COALESCE(ca.updated_at, ca.created_at) DESC
        LIMIT 1
      ) ca_latest ON TRUE
    `;

    if (view === "calendar") {
      const selectSql = `
        SELECT
          c.id,
          c.name,
          c.name_kana,
          c.email,
          c.phone,
          c.birth_date,
          c.age,
          c.gender,
          c.created_at,
          c.registered_at,
          c.registered_date,
          c.updated_at,
          c.is_effective_application,
          c.nationality,
          c.japanese_level,
          c.apply_route_text,
          c.apply_company_name,
          c.apply_job_name,
          c.source AS db_source,
          c.company_name AS db_company_name,
          c.job_name AS db_job_name,
          c.advisor_name AS db_advisor_name_text,
          c.partner_name AS db_partner_name_text,
          c.cs_name AS db_cs_name,
          c.next_action_date,
          c.next_action_note,
          c.advisor_user_id,
          u_ad.name AS db_advisor_name,
          c.partner_user_id,
          u_pt.name AS db_partner_name,
          ca_latest.stage_current,
          ca_latest.apply_route,
          ca_latest.client_name
        FROM candidates c
        LEFT JOIN users u_ad ON c.advisor_user_id = u_ad.id
        LEFT JOIN users u_pt ON c.partner_user_id = u_pt.id
        ${joinLatest}
        WHERE ${whereClause}
        ORDER BY c.next_action_date ASC NULLS LAST, c.created_at DESC, c.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const countSql = `
        SELECT COUNT(*) AS total
        FROM candidates c
        LEFT JOIN users u_ad ON c.advisor_user_id = u_ad.id
        LEFT JOIN users u_pt ON c.partner_user_id = u_pt.id
        ${joinLatest}
        WHERE ${whereClause}
      `;

      const [resItems, resCount] = await Promise.all([
        client.query(selectSql, [...params, limit, offset]),
        client.query(countSql, params),
      ]);

      const validityUpdates = [];
      const items = (resItems.rows || []).map((row) => {
        const computed = computeValidApplication(row, screeningRules);
        const resolvedValid = computed === true || computed === false ? computed : toBoolOrNull(row.is_effective_application);
        if ((computed === true || computed === false) && row.is_effective_application !== computed) {
          validityUpdates.push([row.id, computed]);
        }
        return buildListItem(row, resolvedValid);
      });

      if (validityUpdates.length > 0) {
        await bulkSyncCandidateValidity(client, validityUpdates);
      }

      const total = parseInt(resCount.rows?.[0]?.total || 0, 10);
      return json(200, { items, total, limit, offset });
    }

    // Default list view (paged)
    const selectSql = `
      SELECT
        c.id,
        c.name,
        c.name_kana,
        c.email,
        c.phone,
        c.birth_date,
        c.age,
        c.gender,
        c.created_at,
        c.registered_at,
        c.registered_date,
        c.updated_at,
        c.is_effective_application,
        c.nationality,
        c.japanese_level,
        c.apply_route_text,
        c.apply_company_name,
        c.apply_job_name,
        c.source AS db_source,
        c.company_name AS db_company_name,
        c.job_name AS db_job_name,
        c.advisor_name AS db_advisor_name_text,
        c.partner_name AS db_partner_name_text,
        c.cs_name AS db_cs_name,
        c.next_action_date,
        c.next_action_note,
        c.advisor_user_id,
        u_ad.name AS db_advisor_name,
        c.partner_user_id,
        u_pt.name AS db_partner_name,
        ca_latest.stage_current,
        ca_latest.apply_route,
        ca_latest.client_name,
        ca_all.apps
      FROM candidates c
      LEFT JOIN users u_ad ON c.advisor_user_id = u_ad.id
      LEFT JOIN users u_pt ON c.partner_user_id = u_pt.id
      ${joinLatest}
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'id', ca.id,
          'clientId', ca.client_id,
          'clientName', cl.name,
          'stageCurrent', ca.stage_current,
          'jobTitle', ca.job_title,
          'applyRoute', ca.apply_route,
          'updatedAt', ca.updated_at,
          'createdAt', ca.created_at,
          'selectionNote', ca.selection_note,
          'proposalDate', ca.proposal_date,
          'recommendationDate', ca.recommended_at,
          'firstInterviewSetAt', ca.first_interview_set_at,
          'firstInterviewDate', ca.first_interview_at,
          'secondInterviewSetAt', ca.second_interview_set_at,
          'secondInterviewDate', ca.second_interview_at,
          'finalInterviewSetAt', ca.final_interview_set_at,
          'finalInterviewDate', ca.final_interview_at,
          'offerDate', COALESCE(ca.offer_at, ca.offer_date),
          'acceptanceDate', COALESCE(ca.offer_accepted_at, ca.offer_accept_date),
          'onboardingDate', COALESCE(ca.joined_at, ca.join_date),
          'closeExpectedDate', COALESCE(ca.close_expected_at, ca.closing_forecast_at),
          'preJoinWithdrawDate', ca.pre_join_withdraw_date,
          'postJoinQuitDate', ca.post_join_quit_date
        ) ORDER BY COALESCE(ca.updated_at, ca.created_at) DESC) as apps
        FROM candidate_applications ca
        LEFT JOIN clients cl ON ca.client_id = cl.id
        WHERE ca.candidate_id = c.id
      ) ca_all ON TRUE
      WHERE ${whereClause}
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM candidates c
      LEFT JOIN users u_ad ON c.advisor_user_id = u_ad.id
      LEFT JOIN users u_pt ON c.partner_user_id = u_pt.id
      ${joinLatest}
      WHERE ${whereClause}
    `;

    const [resItems, resCount] = await Promise.all([
      client.query(selectSql, [...params, limit, offset]),
      client.query(countSql, params),
    ]);

    const validityUpdates = [];
    const items = (resItems.rows || []).map((row) => {
      const computed = computeValidApplication(row, screeningRules);
      const resolvedValid = computed === true || computed === false ? computed : toBoolOrNull(row.is_effective_application);
      if ((computed === true || computed === false) && row.is_effective_application !== computed) {
        validityUpdates.push([row.id, computed]);
      }
      return buildListItem(row, resolvedValid);
    });

    if (validityUpdates.length > 0) {
      await bulkSyncCandidateValidity(client, validityUpdates);
    }

    const total = parseInt(resCount.rows?.[0]?.total || 0, 10);
    return json(200, { items, total, limit, offset });
  } catch (err) {
    console.error("LIST API ERROR:", err);
    return json(500, { error: err?.message || String(err) });
  } finally {
    if (client) client.release();
  }
};
