import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  host: (process.env.DB_HOST || "").trim(),
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization",
};

const PLACEHOLDERS = new Set(["-", "ー", "未設定", "未入力", "未登録", "未指定"]);

const parseRuleNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const parseListValue = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (value === null || value === undefined) return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
};

const normalizeScreeningRulesRow = (row) => {
  const minAge = parseRuleNumber(row?.min_age ?? row?.minAge);
  const maxAge = parseRuleNumber(row?.max_age ?? row?.maxAge);
  const allowedJlptLevels = parseListValue(row?.allowed_jlpt_levels ?? row?.allowedJlptLevels);
  const targetNationalitiesList = parseListValue(row?.target_nationalities ?? row?.targetNationalities);
  return { minAge, maxAge, allowedJlptLevels, targetNationalitiesList };
};

const isUnlimitedMinAge = (value) => value === null || value === undefined || value === "" || Number(value) <= 0;
const isUnlimitedMaxAge = (value) => value === null || value === undefined || value === "" || Number(value) >= 100;

const hasScreeningConstraints = (rules) => {
  if (!rules) return false;
  if (!isUnlimitedMinAge(rules.minAge)) return true;
  if (!isUnlimitedMaxAge(rules.maxAge)) return true;
  if (Array.isArray(rules.targetNationalitiesList) && rules.targetNationalitiesList.length > 0) return true;
  if (Array.isArray(rules.allowedJlptLevels) && rules.allowedJlptLevels.length > 0) return true;
  return false;
};

const toHalfWidthDigits = (text) =>
  String(text || "").replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));

const parseAgeNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value >= 0 && value <= 130 ? value : null;
  const normalized = toHalfWidthDigits(String(value).trim());
  if (!normalized) return null;
  const direct = Number(normalized);
  if (Number.isFinite(direct) && direct >= 0 && direct <= 130) return direct;
  const match = normalized.match(/(\d{1,3})\s*(?:歳|才)?/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 130 ? parsed : null;
};

const calculateAgeFromBirthDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
};

const normalizeNationality = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (PLACEHOLDERS.has(text)) return "";
  const lower = text.toLowerCase();
  if (["japan", "jpn", "jp", "japanese"].includes(lower)) return "日本";
  if (["日本国", "日本国籍", "日本人", "日本国民"].includes(text)) return "日本";
  return text;
};

const isJapaneseNationality = (value) => normalizeNationality(value) === "日本";

const normalizeJlpt = (value) => {
  const text = String(value || "").trim();
  if (!text || PLACEHOLDERS.has(text)) return "";
  return text;
};

const computeValidApplication = (candidate, rules) => {
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

  const candidateNationality = normalizeNationality(candidate.nationality) || "日本";
  const allowedNationalities = parseListValue(rules.targetNationalitiesList)
    .map((value) => normalizeNationality(value))
    .filter(Boolean);

  if (allowedNationalities.length > 0 && !allowedNationalities.includes(candidateNationality)) {
    return false;
  }

  if (isJapaneseNationality(candidateNationality)) return true;

  const allowedJlptLevels = parseListValue(rules.allowedJlptLevels);
  if (!allowedJlptLevels.length) return true;

  const jlpt = normalizeJlpt(candidate.japanese_level ?? candidate.japaneseLevel);
  if (!jlpt) return false;
  return allowedJlptLevels.includes(jlpt);
};

const toBooleanOrNull = (v) => {
  if (v === true || v === "true" || v === 1 || v === "1") return true;
  if (v === false || v === "false" || v === 0 || v === "0") return false;
  return null;
};

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

async function recomputeAllCandidateValidity(client, rules) {
  const res = await client.query(
    "SELECT id, birth_date, age, nationality, japanese_level, is_effective_application FROM candidates"
  );
  const rows = res.rows || [];
  const updates = [];
  for (const row of rows) {
    const computed = computeValidApplication(row, rules);
    if (computed === true || computed === false) {
      if (row.is_effective_application !== computed) {
        updates.push([row.id, computed]);
      }
    } else {
      const persisted = toBooleanOrNull(row.is_effective_application);
      if (persisted === null) continue;
    }
  }
  const updated = await bulkSyncCandidateValidity(client, updates);
  return { scanned: rows.length, updated };
}

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";

  if (method === "OPTIONS") return { statusCode: 204, headers, body: "" };

  let client;
  try {
    client = await pool.connect();

    if (method === "GET") {
      const res = await client.query("SELECT * FROM screening_rules WHERE id = 1");
      let data = res.rows[0];
      if (!data) {
        const initSql = `
          INSERT INTO screening_rules (id, min_age, max_age, allowed_jlpt_levels, target_nationalities)
          VALUES (1, 18, 60, '{N1, N2}', '日本')
          RETURNING *
        `;
        const initRes = await client.query(initSql);
        data = initRes.rows[0];
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          minAge: data.min_age,
          maxAge: data.max_age,
          allowedJlptLevels: Array.isArray(data.allowed_jlpt_levels) ? data.allowed_jlpt_levels : [],
          targetNationalities: data.target_nationalities || "",
          updatedAt: data.updated_at,
        }),
      };
    }

    if (method === "PUT") {
      const body = JSON.parse(event.body || "{}");

      const minAge = Number(body.minAge) || 0;
      const maxAge = Number(body.maxAge) || 100;
      const targetNationalities = body.targetNationalities || "";
      const allowedLevels = Array.isArray(body.allowedJlptLevels) ? body.allowedJlptLevels : [];

      await client.query("BEGIN");
      try {
        const sql = `
          INSERT INTO screening_rules (id, min_age, max_age, allowed_jlpt_levels, target_nationalities, updated_at)
          VALUES (1, $1, $2, $3, $4, NOW())
          ON CONFLICT (id)
          DO UPDATE SET
            min_age = EXCLUDED.min_age,
            max_age = EXCLUDED.max_age,
            allowed_jlpt_levels = EXCLUDED.allowed_jlpt_levels,
            target_nationalities = EXCLUDED.target_nationalities,
            updated_at = NOW()
          RETURNING *
        `;

        const res = await client.query(sql, [minAge, maxAge, allowedLevels, targetNationalities]);
        const updatedRule = res.rows[0];
        const normalizedRules = normalizeScreeningRulesRow(updatedRule);
        const recalcSummary = await recomputeAllCandidateValidity(client, normalizedRules);

        await client.query("COMMIT");

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            minAge: updatedRule.min_age,
            maxAge: updatedRule.max_age,
            allowedJlptLevels: updatedRule.allowed_jlpt_levels,
            targetNationalities: updatedRule.target_nationalities,
            recalculated: recalcSummary,
          }),
        };
      } catch (innerErr) {
        await client.query("ROLLBACK");
        throw innerErr;
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  } catch (err) {
    console.error("SETTINGS API ERROR:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  } finally {
    if (client) client.release();
  }
};
