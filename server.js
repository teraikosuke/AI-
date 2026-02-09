const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const puppeteer = require("puppeteer");

dotenv.config();

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://postgres:devpass@localhost:5432/ats",
});
const PORT = process.env.PORT || 8080;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.get("/api/clients", async (_req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT id, name FROM clients ORDER BY name ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch clients", error);
    res.status(500).json({ error: "企業一覧の取得に失敗しました。" });
  } finally {
    client.release();
  }
});

function normalizeOptionalText(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeOptionalUserId(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const text = String(value).trim();
  if (!text) return null;
  const asNumber = Number(text);
  if (Number.isFinite(asNumber) && String(asNumber) === text) {
    return asNumber;
  }
  return text;
}

function normalizeOptionalList(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
    return cleaned;
  }
  const text = String(value).trim();
  if (!text) return [];
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractSalaryRange(payload = {}) {
  if (!Object.prototype.hasOwnProperty.call(payload, "salaryRange")) {
    return { salaryMin: undefined, salaryMax: undefined };
  }
  if (payload.salaryRange === null) {
    return { salaryMin: null, salaryMax: null };
  }
  const range = Array.isArray(payload.salaryRange) ? payload.salaryRange : [];
  const min = range.length > 0 ? Number(range[0]) : null;
  const max = range.length > 1 ? Number(range[1]) : null;
  return {
    salaryMin: Number.isFinite(min) ? min : null,
    salaryMax: Number.isFinite(max) ? max : null,
  };
}

async function handleClientsKpi(req, res) {
  const fromCandidate = req.query.from ? new Date(req.query.from) : null;
  const toCandidate = req.query.to ? new Date(req.query.to) : null;
  const from =
    fromCandidate && !Number.isNaN(fromCandidate.getTime())
      ? fromCandidate
      : null;
  const to =
    toCandidate && !Number.isNaN(toCandidate.getTime()) ? toCandidate : null;
  const job = req.query.job ? String(req.query.job).trim() : null;
  const client = await pool.connect();

  try {
    const { rows } = await client.query(
      `
        WITH stats AS (
          SELECT
            client_id,
            COUNT(*) FILTER (WHERE recommendation_at IS NOT NULL) AS proposal,
            COUNT(*) FILTER (
              WHERE first_interview_set_at IS NOT NULL OR first_interview_at IS NOT NULL
            ) AS doc_screen,
            COUNT(*) FILTER (WHERE first_interview_at IS NOT NULL) AS interview1,
            COUNT(*) FILTER (WHERE second_interview_at IS NOT NULL) AS interview2,
            COUNT(*) FILTER (WHERE offer_at IS NOT NULL) AS offer,
            COUNT(*) FILTER (WHERE joined_at IS NOT NULL) AS joined,
            COUNT(*) FILTER (WHERE pre_join_decline_at IS NOT NULL) AS prejoin_declines,
            COUNT(*) FILTER (WHERE post_join_quit_at IS NOT NULL) AS dropout_count,
            AVG(
              EXTRACT(EPOCH FROM (joined_at - recommendation_at)) / 86400.0
            ) FILTER (WHERE joined_at IS NOT NULL AND recommendation_at IS NOT NULL) AS lead_time_days
          FROM candidate_applications
          WHERE ($1::timestamptz IS NULL OR recommendation_at >= $1::timestamptz)
            AND ($2::timestamptz IS NULL OR recommendation_at <= $2::timestamptz)
          GROUP BY client_id
        )
        SELECT
          c.*,
          COALESCE(s.proposal, 0) AS proposal,
          COALESCE(s.doc_screen, 0) AS doc_screen,
          COALESCE(s.interview1, 0) AS interview1,
          COALESCE(s.interview2, 0) AS interview2,
          COALESCE(s.offer, 0) AS offer,
          COALESCE(s.joined, 0) AS joined,
          COALESCE(s.prejoin_declines, 0) AS prejoin_declines,
          COALESCE(s.dropout_count, 0) AS dropout_count,
          COALESCE(s.lead_time_days, 0) AS lead_time_days
        FROM clients c
        LEFT JOIN stats s ON s.client_id = c.id
        WHERE ($3::text IS NULL OR c.job_categories ILIKE '%' || $3 || '%')
        ORDER BY c.name ASC
      `,
      [from, to, job]
    );

    const items = rows.map((row) => {
      const salaryRange =
        row.salary_min !== null || row.salary_max !== null
          ? [row.salary_min || 0, row.salary_max || 0]
          : null;
      return {
        id: row.id,
        name: row.name,
        companyName: row.name,
        industry: row.industry,
        location: row.location,
        jobCategories: row.job_categories,
        plannedHiresCount: row.planned_hires_count,
        feeAmount: row.fee_amount,
        selectionNote: row.selection_note,
        contactName: row.contact_name,
        contactEmail: row.contact_email,
        warrantyPeriod: row.warranty_period,
        feeDetails: row.fee_details,
        contractNote: row.contract_note,
        desiredTalent: {
          salaryRange,
          locations: row.desired_locations || [],
          mustQualifications: row.must_qualifications || [],
          niceQualifications: row.nice_qualifications || [],
          personality: row.personality_traits || [],
          experiences: row.required_experience || [],
        },
        proposal: row.proposal,
        docScreen: row.doc_screen,
        interview1: row.interview1,
        interview2: row.interview2,
        offer: row.offer,
        joined: row.joined,
        prejoinDeclines: row.prejoin_declines,
        dropoutCount: row.dropout_count,
        leadTime: Math.round(Number(row.lead_time_days) || 0),
        refundAmount: 0,
      };
    });

    res.json({ items });
  } catch (error) {
    console.error("Failed to fetch clients KPI", error);
    res.status(500).json({ error: "紹介先企業の取得に失敗しました。" });
  } finally {
    client.release();
  }
}

app.get("/api/clients/kpi", handleClientsKpi);
app.get("/api/kpi/clients", handleClientsKpi);

app.post("/api/clients", async (req, res) => {
  const payload = req.body || {};
  const name = normalizeOptionalText(payload.name || payload.companyName);
  if (!name) {
    res.status(400).json({ error: "企業名が必要です。" });
    return;
  }

  const { salaryMin, salaryMax } = extractSalaryRange(payload);

  const values = [
    name,
    normalizeOptionalText(payload.industry),
    normalizeOptionalText(payload.location),
    normalizeOptionalText(payload.jobCategories || payload.jobTitle),
    payload.plannedHiresCount ?? null,
    payload.feeAmount ?? null,
    salaryMin,
    salaryMax,
    normalizeOptionalList(payload.mustQualifications),
    normalizeOptionalList(payload.niceQualifications),
    normalizeOptionalList(payload.desiredLocations),
    normalizeOptionalList(payload.personalityTraits),
    normalizeOptionalList(payload.requiredExperience),
    normalizeOptionalText(payload.selectionNote),
    normalizeOptionalText(payload.contactName),
    normalizeOptionalText(payload.contactEmail),
    normalizeOptionalText(payload.warrantyPeriod),
    normalizeOptionalText(payload.feeDetails),
    normalizeOptionalText(payload.contractNote),
  ];

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `
        INSERT INTO clients (
          name,
          industry,
          location,
          job_categories,
          planned_hires_count,
          fee_amount,
          salary_min,
          salary_max,
          must_qualifications,
          nice_qualifications,
          desired_locations,
          personality_traits,
          required_experience,
          selection_note,
          contact_name,
          contact_email,
          warranty_period,
          fee_details,
          contract_note,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19,
          NOW(), NOW()
        )
        RETURNING *
      `,
      values
    );
    res.status(201).json({ item: rows[0] });
  } catch (error) {
    console.error("Failed to create client", error);
    res.status(500).json({ error: "企業の登録に失敗しました。" });
  } finally {
    client.release();
  }
});

const deleteClientHandler = async (req, res) => {
  const id = req.params?.id || req.query?.id || req.body?.id;
  if (!id) {
    res.status(400).json({ error: "IDが必要です。" });
    return;
  }

  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(
      "DELETE FROM clients WHERE id = $1",
      [id]
    );

    if (rowCount === 0) {
      res.status(404).json({ error: "指定された企業が見つかりません。" });
    } else {
      res.json({ success: true, message: "企業を削除しました。" });
    }
  } catch (error) {
    console.error("Failed to delete client", error);
    res.status(500).json({ error: "企業の削除に失敗しました。" });
  } finally {
    client.release();
  }
};

app.delete("/api/clients/:id", deleteClientHandler);
app.delete("/api/clients", deleteClientHandler);
app.delete("/clients/:id", deleteClientHandler);
app.delete("/clients", deleteClientHandler);

app.put("/api/clients", async (req, res) => {
  const payload = req.body || {};
  const id = payload.id;
  if (!id) {
    res.status(400).json({ error: "企業IDが必要です。" });
    return;
  }

  const updates = [];
  const values = [];
  let index = 1;

  const setField = (column, value) => {
    updates.push(`${column} = $${index}`);
    values.push(value);
    index += 1;
  };

  if (Object.prototype.hasOwnProperty.call(payload, "industry")) {
    setField("industry", normalizeOptionalText(payload.industry));
  }
  if (Object.prototype.hasOwnProperty.call(payload, "location")) {
    setField("location", normalizeOptionalText(payload.location));
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, "jobCategories") ||
    Object.prototype.hasOwnProperty.call(payload, "jobTitle")
  ) {
    setField(
      "job_categories",
      normalizeOptionalText(payload.jobCategories || payload.jobTitle)
    );
  }
  if (Object.prototype.hasOwnProperty.call(payload, "plannedHiresCount")) {
    setField("planned_hires_count", payload.plannedHiresCount ?? null);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "feeAmount")) {
    setField("fee_amount", payload.feeAmount ?? null);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "salaryRange")) {
    const { salaryMin, salaryMax } = extractSalaryRange(payload);
    setField("salary_min", salaryMin);
    setField("salary_max", salaryMax);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "mustQualifications")) {
    setField(
      "must_qualifications",
      normalizeOptionalList(payload.mustQualifications)
    );
  }
  if (Object.prototype.hasOwnProperty.call(payload, "niceQualifications")) {
    setField(
      "nice_qualifications",
      normalizeOptionalList(payload.niceQualifications)
    );
  }
  if (Object.prototype.hasOwnProperty.call(payload, "desiredLocations")) {
    setField(
      "desired_locations",
      normalizeOptionalList(payload.desiredLocations)
    );
  }
  if (Object.prototype.hasOwnProperty.call(payload, "personalityTraits")) {
    setField(
      "personality_traits",
      normalizeOptionalList(payload.personalityTraits)
    );
  }
  if (Object.prototype.hasOwnProperty.call(payload, "requiredExperience")) {
    setField(
      "required_experience",
      normalizeOptionalList(payload.requiredExperience)
    );
  }
  if (Object.prototype.hasOwnProperty.call(payload, "selectionNote")) {
    setField("selection_note", normalizeOptionalText(payload.selectionNote));
  }
  if (Object.prototype.hasOwnProperty.call(payload, "contactName")) {
    setField("contact_name", normalizeOptionalText(payload.contactName));
  }
  if (Object.prototype.hasOwnProperty.call(payload, "contactEmail")) {
    setField("contact_email", normalizeOptionalText(payload.contactEmail));
  }
  if (Object.prototype.hasOwnProperty.call(payload, "warrantyPeriod")) {
    setField("warranty_period", normalizeOptionalText(payload.warrantyPeriod));
  }
  if (Object.prototype.hasOwnProperty.call(payload, "feeDetails")) {
    setField("fee_details", normalizeOptionalText(payload.feeDetails));
  }
  if (Object.prototype.hasOwnProperty.call(payload, "contractNote")) {
    setField("contract_note", normalizeOptionalText(payload.contractNote));
  }

  if (updates.length === 0) {
    res.status(400).json({ error: "更新内容がありません。" });
    return;
  }

  setField("updated_at", new Date());
  const idParamIndex = index;
  values.push(id);

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `
        UPDATE clients
        SET ${updates.join(", ")}
        WHERE id = $${idParamIndex}
        RETURNING *
      `,
      values
    );
    if (rows.length === 0) {
      res.status(404).json({ error: "企業が見つかりません。" });
      return;
    }
    res.json({ item: rows[0] });
  } catch (error) {
    console.error("Failed to update client", error);
    res.status(500).json({ error: "企業情報の更新に失敗しました。" });
  } finally {
    client.release();
  }
});

// Ensure DB migration on startup
(async () => {
  try {
    const client = await pool.connect();
    await client.query("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS next_action_content TEXT;");
    await client.query("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cs_name TEXT;");
    await client.query("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS advisor_user_id BIGINT;");
    await client.query("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS partner_user_id BIGINT;");
    await client.query("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cs_user_id BIGINT;");

    // Add new columns to candidate_app_profile (if table still exists)
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'candidate_app_profile'
        ) THEN
          ALTER TABLE candidate_app_profile
            ADD COLUMN IF NOT EXISTS job_change_axis TEXT,
            ADD COLUMN IF NOT EXISTS job_change_timing TEXT,
            ADD COLUMN IF NOT EXISTS recommendation_text TEXT,
            ADD COLUMN IF NOT EXISTS other_selection_status TEXT,
            ADD COLUMN IF NOT EXISTS desired_interview_dates TEXT,
            ADD COLUMN IF NOT EXISTS future_vision TEXT,
            ADD COLUMN IF NOT EXISTS mandatory_interview_items TEXT,
            ADD COLUMN IF NOT EXISTS shared_interview_date TEXT;
        END IF;
      END $$;

    ALTER TABLE candidate_applications
      ADD COLUMN IF NOT EXISTS closing_plan_date DATE,
      ADD COLUMN IF NOT EXISTS fee_amount TEXT,
      ADD COLUMN IF NOT EXISTS declined_reason TEXT,
      ADD COLUMN IF NOT EXISTS early_turnover_reason TEXT;

    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS job_categories TEXT,
      ADD COLUMN IF NOT EXISTS planned_hires_count INTEGER,
      ADD COLUMN IF NOT EXISTS fee_amount INTEGER,
      ADD COLUMN IF NOT EXISTS salary_min INTEGER,
      ADD COLUMN IF NOT EXISTS salary_max INTEGER,
      ADD COLUMN IF NOT EXISTS must_qualifications TEXT[],
      ADD COLUMN IF NOT EXISTS nice_qualifications TEXT[],
      ADD COLUMN IF NOT EXISTS desired_locations TEXT[],
      ADD COLUMN IF NOT EXISTS personality_traits TEXT[],
      ADD COLUMN IF NOT EXISTS required_experience TEXT[],
      ADD COLUMN IF NOT EXISTS selection_note TEXT,
      ADD COLUMN IF NOT EXISTS contact_name TEXT,
      ADD COLUMN IF NOT EXISTS contact_email TEXT,
      ADD COLUMN IF NOT EXISTS warranty_period TEXT,
      ADD COLUMN IF NOT EXISTS fee_details TEXT,
      ADD COLUMN IF NOT EXISTS contract_note TEXT;

    -- 学歴テーブル
    CREATE TABLE IF NOT EXISTS candidate_educations (
      id BIGSERIAL PRIMARY KEY,
      candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
      school_name TEXT,
      department TEXT,
      admission_date DATE,
      graduation_date DATE,
      graduation_status TEXT,
      sequence INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 職歴テーブル
    CREATE TABLE IF NOT EXISTS candidate_work_histories (
      id BIGSERIAL PRIMARY KEY,
      candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
      company_name TEXT,
      department TEXT,
      position TEXT,
      join_date DATE,
      leave_date DATE,
      is_current BOOLEAN DEFAULT FALSE,
      job_description TEXT,
      sequence INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    `);

    client.release();
    console.log("Migration check complete: next_action_content & profile columns");
  } catch (e) {
    console.error("Migration failed", e);
  }
})();

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const REPORT_STATUS_FLAGS = [
  { label: "LINE報告済み", column: "line_reported" },
  { label: "個人シート反映済み", column: "personal_sheet_reflected" },
  { label: "請求書送付済み", column: "invoice_sent" },
];

const CS_CHECKLIST_MAP = [
  { key: "validConfirmed", column: "cs_valid_confirmed" },
  { key: "connectConfirmed", column: "cs_connect_confirmed" },
  { key: "dial1", column: "cs_call_attempt1" },
  { key: "dial2", column: "cs_call_attempt2" },
  { key: "dial3", column: "cs_call_attempt3" },
  { key: "dial4", column: "cs_call_attempt4" },
  { key: "dial5", column: "cs_call_attempt5" },
  { key: "dial6", column: "cs_call_attempt6" },
  { key: "dial7", column: "cs_call_attempt7" },
  { key: "dial8", column: "cs_call_attempt8" },
  { key: "dial9", column: "cs_call_attempt9" },
  { key: "dial10", column: "cs_call_attempt10" },
];

function getNestedValue(source, path) {
  if (!source || !path) return undefined;
  return path.split(".").reduce((value, segment) => {
    if (value && Object.prototype.hasOwnProperty.call(value, segment)) {
      return value[segment];
    }
    return undefined;
  }, source);
}

function buildLegacyHearingMemo(hearing = {}) {
  const legacyFields = [
    { key: "relocation", label: "転居" },
    { key: "desiredArea", label: "希望エリア" },
    { key: "timing", label: "転職時期" },
    { key: "desiredJob", label: "希望職種" },
    { key: "firstInterviewMemo", label: "初回面談メモ" },
    { key: "currentIncome", label: "現年収" },
    { key: "desiredIncome", label: "希望年収" },
    { key: "reason", label: "転職理由・転職軸" },
    { key: "interviewPreference", label: "面接希望日" },
    { key: "recommendationText", label: "推薦文" },
    { key: "otherSelections", label: "他社選考状況" },
  ];
  return legacyFields
    .map(({ key, label }) => (hearing[key] ? `${label}: ${hearing[key]}` : ""))
    .filter(Boolean)
    .join("\n");
}

function buildReportStatuses(row, detail) {
  const statusFromColumns = REPORT_STATUS_FLAGS.filter(
    ({ column }) => row[column]
  ).map(({ label }) => label);
  if (statusFromColumns.length > 0) {
    return statusFromColumns;
  }
  const legacy = getNestedValue(detail, "afterAcceptance.reportStatuses");
  return Array.isArray(legacy) ? legacy : [];
}

function buildAfterAcceptance(row, detail) {
  const legacy = getNestedValue(detail, "afterAcceptance") || {};
  return {
    amount: row.order_amount ?? legacy.amount ?? "",
    jobCategory: row.after_acceptance_job_type ?? legacy.jobCategory ?? "",
    reportStatuses: buildReportStatuses(row, detail),
  };
}

function buildRefundInfo(row, detail) {
  const legacy = getNestedValue(detail, "refundInfo") || {};
  return {
    resignationDate:
      row.refund_retirement_date ??
      legacy.resignationDate ??
      legacy.retirementDate ??
      null,
    refundAmount: row.refund_amount ?? legacy.refundAmount ?? "",
    reportStatus: row.refund_report ?? legacy.reportStatus ?? "",
  };
}

function buildActionInfo(row, detail) {
  const legacy = getNestedValue(detail, "actionInfo") || {};
  return {
    nextActionDate:
      row.next_action_date ??
      legacy.nextActionDate ??
      getNestedValue(detail, "newActionDate") ??
      null,
    finalResult: row.final_result ?? legacy.finalResult ?? "",
    nextActionNote: legacy.nextActionNote ?? null, // Add nextActionNote
  };
}

function buildCsChecklist(row, detail) {
  const legacy = getNestedValue(detail, "csChecklist") || {};
  return CS_CHECKLIST_MAP.reduce((acc, { key, column }) => {
    if (row[column] === null || row[column] === undefined) {
      acc[key] = typeof legacy[key] === "boolean" ? legacy[key] : false;
    } else {
      acc[key] = row[column];
    }
    return acc;
  }, {});
}

function buildHearing(row, detail) {
  const legacy = detail.hearing || {};
  const memo =
    row.hearing_memo || legacy.memo || buildLegacyHearingMemo(legacy) || null;
  return { ...legacy, memo };
}

function mapMeetingPlans(rows = []) {
  return rows.map((row, index) => ({
    sequence: row.sequence ?? index + 2,
    plannedDate: row.planned_date,
    attendance: row.attendance,
  }));
}

function mapResumeDocuments(rows = []) {
  return rows.map((row) => ({
    label: row.label,
    value: row.document_value,
  }));
}

function mapSelectionProgress(rows = []) {
  return rows.map((row) => ({
    companyName: row.company_name,
    route: row.application_route,
    recommendationDate: row.recommendation_date,
    interviewSetupDate: row.interview_schedule_date,
    interviewDate: row.interview_date,
    offerDate: row.offer_date,
    closingDate: row.closing_plan_date,
    acceptanceDate: row.offer_accept_date,
    onboardingDate: row.joining_date,
    preJoinDeclineDate: row.pre_join_quit_date,
    fee: row.introduction_fee,
    status: row.status,
    notes: row.note,
  }));
}

function mapCandidateApplications(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    applicationId: row.id,
    candidateId: row.candidate_id,
    clientId: row.client_id,
    companyName: row.company_name, // Joined column
    route: row.application_route,
    jobTitle: row.job_title,
    workMode: row.work_mode,
    feeRate: row.fee_rate,
    status: row.selection_status,
    recommendationDate: row.recommendation_at,
    interviewSetupDate: row.first_interview_set_at,
    interviewDate: row.first_interview_at,
    secondInterviewSetupDate: row.second_interview_set_at,
    secondInterviewDate: row.second_interview_at,
    finalInterviewSetupDate: row.final_interview_set_at,
    finalInterviewDate: row.final_interview_at,
    offerDate: row.offer_at,
    acceptanceDate: row.offer_accepted_at,
    onboardingDate: row.joined_at,
    preJoinDeclineDate: row.pre_join_decline_at,
    postJoinQuitDate: row.post_join_quit_at,
    selectionNote: row.selection_note,
  }));
}

let cachedCandidateAppProfileTable = null;

async function resolveCandidateAppProfileTable(client) {
  if (cachedCandidateAppProfileTable !== null) {
    return cachedCandidateAppProfileTable;
  }
  try {
    const { rows } = await client.query(
      `
        SELECT
          to_regclass('public.candidate_app_profile') AS primary_table,
          to_regclass('public.candidate_app_profile_deprecated') AS fallback_table
      `
    );
    const row = rows[0] || {};
    cachedCandidateAppProfileTable = row.primary_table || row.fallback_table || null;
  } catch (error) {
    console.error("Failed to resolve candidate_app_profile table", error);
    cachedCandidateAppProfileTable = null;
  }
  return cachedCandidateAppProfileTable;
}

async function fetchCandidateAppProfileRow(client, candidateId) {
  const table = await resolveCandidateAppProfileTable(client);
  if (!table) return {};
  const { rows } = await client.query(
    `SELECT * FROM ${table} WHERE candidate_id = $1`,
    [candidateId]
  );
  return rows[0] || {};
}

async function fetchCandidateRelations(client, candidateId) {
  const [meetingResult, resumeResult, selectionResult, appProfile] = await Promise.all([
    client.query(
      `
        SELECT sequence, planned_date, attendance
        FROM meeting_plans
        WHERE candidate_id = $1
        ORDER BY sequence ASC, id ASC
      `,
      [candidateId]
    ),
    client.query(
      `
        SELECT label, document_value
        FROM resume_documents
        WHERE candidate_id = $1
        ORDER BY id ASC
      `,
      [candidateId]
    ),
    client.query(
      `
        SELECT ca.*, c.name as company_name
        FROM candidate_applications ca
        LEFT JOIN clients c ON ca.client_id = c.id
        WHERE ca.candidate_id = $1
        ORDER BY ca.id ASC
      `,
      [candidateId]
    ),
    fetchCandidateAppProfileRow(client, candidateId),
  ]);

  return {
    meetingPlans: mapMeetingPlans(meetingResult.rows),
    resumeDocuments: mapResumeDocuments(resumeResult.rows),
    selectionProgress: mapCandidateApplications(selectionResult.rows),
    appProfile: appProfile || {},
  };
}

function normalizeDate(value) {
  if (!value) return null;
  if (typeof value === "string" && value.includes("T")) {
    return value.split("T")[0];
  }
  return value;
}

function normalizeDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function mapReportStatusFlags(statuses = []) {
  const flags = {
    line_reported: false,
    personal_sheet_reflected: false,
    invoice_sent: false,
  };
  statuses.forEach((label) => {
    const match = REPORT_STATUS_FLAGS.find((item) => item.label === label);
    if (match) {
      flags[match.column] = true;
    }
  });
  return flags;
}

function mapCsChecklistToColumns(checklist = {}) {
  return CS_CHECKLIST_MAP.reduce((acc, { key, column }) => {
    acc[column] =
      checklist[key] === undefined ? null : Boolean(checklist[key]);
    return acc;
  }, {});
}

function buildDetailSnapshot(payload = {}) {
  return {
    meetingPlans: payload.meetingPlans || [],
    resumeDocuments: payload.resumeDocuments || [],
    selectionProgress: payload.selectionProgress || [],
    hearing: payload.hearing || {},
    afterAcceptance: payload.afterAcceptance || {},
    refundInfo: payload.refundInfo || {},
    actionInfo: {
      ...(payload.actionInfo || {}),
      nextActionNote: payload.nextActionNote || null, // Persist nextActionNote in actionInfo
    },
    csChecklist: payload.csChecklist || {},
    callLogs: payload.callLogs || [],
  };
}

function mapCandidateUpdateColumns(payload = {}) {
  const afterAcceptance = payload.afterAcceptance || {};
  const refundInfo = payload.refundInfo || {};
  const actionInfo = payload.actionInfo || {};
  const csChecklist = payload.csChecklist || {};
  const reportFlags = mapReportStatusFlags(afterAcceptance.reportStatuses || []);
  const csFlags = mapCsChecklistToColumns(csChecklist);

  return {
    candidate_code: payload.candidateCode ?? null,
    candidate_name: payload.candidateName ?? null,
    candidate_kana: payload.candidateKana ?? null,
    company_name: payload.companyName ?? null,
    job_name: payload.jobName ?? null,
    work_location: payload.workLocation ?? null,
    advisor_user_id: normalizeOptionalUserId(
      payload.advisorUserId ?? payload.advisor_user_id
    ),
    partner_user_id: normalizeOptionalUserId(
      payload.partnerUserId ??
      payload.partner_user_id ??
      payload.csUserId ??
      payload.cs_user_id
    ),
    cs_user_id: normalizeOptionalUserId(
      payload.csUserId ??
      payload.cs_user_id ??
      payload.partnerUserId ??
      payload.partner_user_id
    ),
    partner_name: payload.advisorName ?? payload.partnerName ?? null, // 担当アドバイザー表示名
    cs_name: payload.csName ?? null, // 担当CS表示名
    caller_name: payload.callerName ?? null,
    introduction_chance: payload.introductionChance ?? null,
    phase: payload.phase ?? null,
    registered_date: normalizeDate(payload.registeredDate),
    registered_at: normalizeDateTime(payload.registeredAt),
    candidate_updated_at: normalizeDateTime(payload.candidateUpdatedAt),
    media_registered_at: normalizeDate(payload.mediaRegisteredAt),
    source: payload.source ?? null,
    phone: payload.phone ?? null,
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    email: payload.email ?? null,
    birthday: normalizeDate(payload.birthday || payload.birthDate), // 修正: birthDateも受け付ける
    age:
      payload.age === undefined || payload.age === null
        ? null
        : Number(payload.age),
    gender: payload.gender ?? null,
    education: payload.education ?? null,
    postal_code: payload.postalCode ?? null,
    address: payload.address ?? null,
    city: payload.city ?? null,
    contact_time: payload.contactTime ?? null,
    remarks: payload.remarks ?? null,
    memo: payload.memo ?? null,
    memo_detail: payload.memoDetail ?? null,
    hearing_memo: payload.hearing?.memo ?? payload.hearingMemo ?? null,
    resume_status: payload.resumeStatus ?? null,
    meeting_video_url: payload.meetingVideoLink ?? null,
    resume_for_send: payload.resumeForSend ?? null,
    work_history_for_send: payload.workHistoryForSend ?? null,
    employment_status: payload.employmentStatus ?? null,
    first_contact_planned_at: normalizeDate(payload.firstContactPlannedAt),
    first_contact_at: normalizeDate(payload.firstContactAt),
    call_date: normalizeDate(payload.callDate),
    schedule_confirmed_at: normalizeDate(payload.scheduleConfirmedAt),
    recommendation_date: normalizeDate(payload.recommendationDate),
    valid_application: payload.validApplication ?? false,
    phone_connected: payload.phoneConnected ?? false,
    sms_sent: payload.smsSent ?? false,
    sms_confirmed: payload.smsConfirmed ?? false,
    attendance_confirmed: payload.attendanceConfirmed ?? false,
    next_action_date:
      normalizeDate(actionInfo.nextActionDate) ??
      normalizeDate(payload.nextActionDate),
    next_action_content:
      actionInfo.nextActionContent ?? payload.nextActionContent ?? null,
    final_result: actionInfo.finalResult ?? payload.finalResult ?? null,
    order_amount: afterAcceptance.amount ?? null,
    after_acceptance_job_type: afterAcceptance.jobCategory ?? null,
    line_reported: reportFlags.line_reported,
    personal_sheet_reflected: reportFlags.personal_sheet_reflected,
    invoice_sent: reportFlags.invoice_sent,
    refund_retirement_date: normalizeDate(refundInfo.resignationDate),
    refund_amount: refundInfo.refundAmount ?? null,
    refund_report: refundInfo.reportStatus ?? null,
    detail: JSON.stringify(buildDetailSnapshot(payload)),
    ...csFlags,
  };
}

async function replaceMeetingPlans(client, candidateId, plans = []) {
  await client.query("DELETE FROM meeting_plans WHERE candidate_id = $1", [
    candidateId,
  ]);
  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index] || {};
    await client.query(
      `
        INSERT INTO meeting_plans (candidate_id, sequence, planned_date, attendance)
        VALUES ($1, $2, $3, $4)
      `,
      [
        candidateId,
        plan.sequence ?? index + 2,
        normalizeDate(plan.plannedDate),
        Boolean(plan.attendance),
      ]
    );
  }
}

async function replaceResumeDocuments(client, candidateId, documents = []) {
  await client.query("DELETE FROM resume_documents WHERE candidate_id = $1", [
    candidateId,
  ]);
  for (const doc of documents) {
    await client.query(
      `
        INSERT INTO resume_documents (candidate_id, label, document_value)
        VALUES ($1, $2, $3)
      `,
      [candidateId, doc.label || null, doc.value || null]
    );
  }
}

async function findOrCreateClient(client, name) {
  if (!name) return null;
  const normalized = name.trim();
  if (!normalized) return null;

  // Check existence
  const { rows } = await client.query("SELECT id FROM clients WHERE name = $1", [
    normalized,
  ]);
  if (rows.length > 0) {
    return rows[0].id;
  }

  // Create
  const { rows: newRows } = await client.query(
    "INSERT INTO clients (name, created_at, updated_at) VALUES ($1, NOW(), NOW()) RETURNING id",
    [normalized]
  );
  return newRows[0].id;
}

async function replaceCandidateApplications(client, candidateId, rows = []) {
  // Clear old entries (Strategy: Delete all and recreate for simplicity, same as before)
  // Note: This loses placement references if they cascade delete.
  // schema says ON DELETE CASCADE so placements will be deleted if we delete application.
  // Ideally we should upsert or diff, but for now we follow the existing pattern.
  // Assuming ID is not sent securely back or we accept ID churn.
  await client.query("DELETE FROM candidate_applications WHERE candidate_id = $1", [
    candidateId,
  ]);

  for (const row of rows) {
    const companyName = row.companyName || row.company_name;
    const clientId = row.clientId || (await findOrCreateClient(client, companyName));

    if (!clientId) continue; // Skip if no client info

    await client.query(
      `
        INSERT INTO candidate_applications (
          candidate_id,
          client_id,
          application_route,
          job_title,
          work_mode,
          fee_rate,
          selection_status,
          recommendation_at,
          first_interview_set_at,
          first_interview_at,
          second_interview_set_at,
          second_interview_at,
          final_interview_set_at,
          final_interview_at,
          offer_at,
          offer_accepted_at,
          joined_at,
          pre_join_decline_at,
          post_join_quit_at,
          selection_note,
          closing_plan_date,
          fee_amount,
          declined_reason,
          early_turnover_reason
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
        )
      `,
      [
        candidateId,
        clientId,
        row.route || row.applicationRoute || null,
        row.jobTitle || null,
        row.workMode || null,
        row.feeRate || null,
        row.status || null, // selection_status
        normalizeDateTime(row.recommendationDate),
        normalizeDateTime(row.firstInterviewSetAt || row.firstInterviewAdjustDate || row.interviewSetupDate),
        normalizeDateTime(row.firstInterviewAt || row.firstInterviewDate || row.interviewDate),
        normalizeDateTime(row.secondInterviewSetAt || row.secondInterviewAdjustDate || row.secondInterviewSetupDate),
        normalizeDateTime(row.secondInterviewAt || row.secondInterviewDate),
        normalizeDateTime(row.finalInterviewSetAt || row.finalInterviewAdjustDate || row.finalInterviewSetupDate),
        normalizeDateTime(row.finalInterviewAt || row.finalInterviewDate),
        normalizeDateTime(row.offerAt || row.offerDate),
        normalizeDateTime(row.offerAcceptedAt || row.offerAcceptedDate || row.acceptanceDate),
        normalizeDateTime(row.joinedAt || row.joinedDate || row.onboardingDate),
        normalizeDateTime(row.preJoinDeclineDate || row.declinedDate),
        normalizeDateTime(row.postJoinQuitDate || row.earlyTurnoverDate),
        row.selectionNote || row.note || null,
        normalizeDateTime(row.closingPlanDate || row.closingForecastDate),
        row.feeAmount || row.fee || null,
        row.declinedReason || null,
        row.earlyTurnoverReason || null,
      ]
    );
  }
}

async function replaceCandidateAppProfile(client, candidateId, payload = {}) {
  const table = await resolveCandidateAppProfileTable(client);
  if (!table) return;

  // education is mapped to final_education in this table
  const fields = {
    nationality: payload.nationality || null,
    japanese_level: payload.japaneseLevel || null,
    address_pref: payload.addressPref || null,
    address_city: payload.addressCity || null,
    address_detail: payload.addressDetail || null,
    final_education: payload.education || null,
    work_experience: payload.workExperience || null,
    current_income: payload.currentIncome || null,
    desired_income: payload.desiredIncome || null,
    desired_job_type: payload.desiredJobType || null,
    desired_work_location: payload.desiredLocation || null, // payload.desiredLocation -> desired_work_location
    reason_for_change: payload.careerReason || null, // payload.careerReason -> reason_for_change
    strengths: payload.skills || null, // payload.skills -> strengths (仮マッピング)
    personality: payload.personality || null,
    job_change_axis: payload.jobChangeAxis || null,
    job_change_timing: payload.jobChangeTiming || null,
    recommendation_text: payload.recommendationText || null,
    other_selection_status: payload.otherSelectionStatus || null,
    desired_interview_dates: payload.desiredInterviewDates || null,
    future_vision: payload.futureVision || null,
    mandatory_interview_items: payload.mandatoryInterviewItems || null,
    shared_interview_date: payload.sharedInterviewDate || null,
  };

  const columns = Object.keys(fields);
  const values = Object.values(fields);
  const assignments = columns.map(
    (col, i) => `${col} = EXCLUDED.${col}`
  );

  const sql = `
    INSERT INTO ${table} (
      candidate_id, ${columns.join(", ")}, created_at, updated_at
    ) VALUES (
      $1, ${columns.map((_, i) => `$${i + 2}`).join(", ")}, NOW(), NOW()
    )
    ON CONFLICT (candidate_id) DO UPDATE SET
      ${assignments.join(", ")},
      updated_at = NOW()
  `;

  await client.query(sql, [candidateId, ...values]);
}

async function persistCandidateRelations(client, candidateId, payload) {
  await Promise.all([
    replaceMeetingPlans(client, candidateId, payload.meetingPlans || []),
    replaceResumeDocuments(client, candidateId, payload.resumeDocuments || []),
    replaceCandidateApplications( // Switch to new table
      client,
      candidateId,
      payload.selectionProgress || []
    ),
    replaceCandidateAppProfile(client, candidateId, payload),
  ]);
}

function mapCandidate(row, extras = {}) {
  if (!row) return null;
  const detail = row.detail || {};
  const meetingPlans =
    extras.meetingPlans ||
    getNestedValue(detail, "meetingPlans") ||
    detail.meetingPlans ||
    [];
  const resumeDocuments =
    extras.resumeDocuments ||
    getNestedValue(detail, "resumeDocuments") ||
    detail.resumeDocuments ||
    [];
  const selectionProgress =
    extras.selectionProgress ||
    getNestedValue(detail, "selectionProgress") ||
    detail.selectionProgress ||
    [];
  const appProfile = extras.appProfile || {};

  return {
    id: row.id,
    kintoneId: row.kintone_record_id,
    candidateCode: row.candidate_code,
    candidateName: row.candidate_name,
    candidateKana: row.candidate_kana,
    companyName: row.company_name,
    jobName: row.job_name,
    workLocation: row.work_location ?? detail.workLocation,
    advisorUserId: row.advisor_user_id ?? null,
    csUserId: row.cs_user_id ?? row.partner_user_id ?? null,
    partnerUserId: row.partner_user_id ?? row.cs_user_id ?? null,
    advisorName: row.partner_name, // 担当アドバイザーは partner_name に保存されている
    csName: row.cs_name, // 担当CSは cs_name に保存されている
    callerName: row.caller_name,
    partnerName: row.partner_name ?? detail.partnerName, // 後方互換性のため維持
    introductionChance:
      row.introduction_chance ?? detail.introductionChance ?? "",
    phase: row.phase,
    registeredDate: row.registered_date,
    registeredAt: row.registered_at,
    mediaRegisteredAt: row.media_registered_at ?? detail.mediaRegisteredAt,
    source: row.source,
    phone: row.phone,
    email: row.email,
    birthday: row.birthday,
    age: row.age,
    gender: row.gender ?? detail.gender,
    education: appProfile.final_education ?? row.education ?? detail.education,
    postalCode: row.postal_code ?? detail.postalCode,
    address: row.address ?? detail.address,
    city: appProfile.address_city ?? row.city ?? detail.city,
    addressPref: appProfile.address_pref ?? row.address_pref,
    addressCity: appProfile.address_city ?? row.address_city,
    addressDetail: appProfile.address_detail ?? row.address_detail,
    nationality: appProfile.nationality ?? row.nationality,
    japaneseLevel: appProfile.japanese_level ?? row.japanese_level,
    contactTime: row.contact_time ?? detail.contactTime,
    remarks: row.remarks ?? detail.remarks,
    memo: row.memo,
    memoDetail: row.memo_detail ?? detail.memoDetail,
    // Add additional profile fields to detail or as top-level if needed (frontend seems to map keys directly)
    // Need to ensure mapCandidate sends these if they exist in appProfile
    workExperience: appProfile.work_experience,
    currentIncome: appProfile.current_income,
    desiredIncome: appProfile.desired_income,
    desiredJobType: appProfile.desired_job_type,
    desiredLocation: appProfile.desired_work_location,
    careerReason: appProfile.reason_for_change,
    skills: appProfile.strengths,
    personality: appProfile.personality,
    jobChangeAxis: appProfile.job_change_axis,
    jobChangeTiming: appProfile.job_change_timing,
    recommendationText: appProfile.recommendation_text,
    otherSelectionStatus: appProfile.other_selection_status,
    desiredInterviewDates: appProfile.desired_interview_dates,
    futureVision: appProfile.future_vision,
    mandatoryInterviewItems: appProfile.mandatory_interview_items,
    sharedInterviewDate: appProfile.shared_interview_date,
    hearing: buildHearing(row, detail),
    hearingMemo: row.hearing_memo,
    resumeStatus: row.resume_status,
    meetingVideoLink: row.meeting_video_url ?? detail.meetingVideoLink,
    resumeForSend: row.resume_for_send ?? detail.resumeForSend,
    workHistoryForSend:
      row.work_history_for_send ?? detail.workHistoryForSend,
    employmentStatus:
      row.employment_status ??
      getNestedValue(detail, "hearing.employmentStatus"),
    firstContactPlannedAt: row.first_contact_planned_at,
    firstContactAt: row.first_contact_at,
    nextActionDate: row.next_action_date,
    nextActionContent: row.next_action_content,
    callDate: row.call_date,
    scheduleConfirmedAt: row.schedule_confirmed_at,
    recommendationDate: row.recommendation_date,
    validApplication: row.valid_application,
    phoneConnected: row.phone_connected,
    smsSent: row.sms_sent,
    smsConfirmed: row.sms_confirmed ?? detail.smsConfirmed,
    attendanceConfirmed: row.attendance_confirmed,
    meetingPlans,
    resumeDocuments,
    selectionProgress,
    afterAcceptance: buildAfterAcceptance(row, detail),
    refundInfo: buildRefundInfo(row, detail),
    actionInfo: buildActionInfo(row, detail),
    csChecklist: buildCsChecklist(row, detail),
    nextActionDate:
      row.next_action_date || getNestedValue(detail, "newActionDate") || null,
    finalResult: row.final_result,
    orderAmount: row.order_amount,
    afterAcceptanceJobType: row.after_acceptance_job_type,
    lineReported: row.line_reported,
    personalSheetReflected: row.personal_sheet_reflected,
    invoiceSent: row.invoice_sent,
    nextActionDateLegacy: getNestedValue(detail, "actionInfo.nextActionDate"),
    refundReport: row.refund_report,
    kintoneUpdatedTime: row.kintone_updated_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    detail,
  };
}

async function getLastSyncedAt(client) {
  const { rows } = await client.query(
    "SELECT last_synced_at FROM sync_state WHERE source = $1",
    ["kintone"]
  );
  if (rows.length === 0) {
    return null;
  }
  return rows[0].last_synced_at;
}

async function getKintoneSettings(client) {
  const { rows } = await client.query(
    "SELECT * FROM ats_settings WHERE id = 1"
  );
  if (rows.length === 0) {
    return null;
  }
  return rows[0];
}

async function getCandidateMasters(client) {
  const [clientsResult, usersResult] = await Promise.all([
    client.query("SELECT id, name FROM clients ORDER BY name ASC"),
    client.query("SELECT id, name FROM users ORDER BY name ASC"),
  ]);

  return {
    clients: clientsResult.rows.map((row) => ({
      id: row.id,
      name: row.name ?? "",
    })),
    users: usersResult.rows.map((row) => ({
      id: row.id,
      name: row.name ?? "",
    })),
  };
}

app.get("/api/candidates", async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      from,
      to,
      year,
      month,
      day,
      source,
      phase,
      advisor,
      name,
      company,
      valid,
      sort = "desc",
      limit = DEFAULT_LIMIT,
      offset = 0,
    } = req.query;

    const whereClauses = [];
    const values = [];

    if (from) {
      values.push(from);
      whereClauses.push(`registered_date >= $${values.length}`);
    }

    if (to) {
      values.push(to);
      whereClauses.push(`registered_date <= $${values.length}`);
    }

    if (year) {
      values.push(parseInt(year, 10));
      whereClauses.push(
        `EXTRACT(YEAR FROM registered_date) = $${values.length}`
      );
    }

    if (month) {
      values.push(month);
      whereClauses.push(`TO_CHAR(registered_date, 'MM') = $${values.length}`);
    }

    if (day) {
      values.push(day);
      whereClauses.push(`TO_CHAR(registered_date, 'DD') = $${values.length}`);
    }

    if (source) {
      values.push(source);
      whereClauses.push(`source = $${values.length}`);
    }

    if (phase) {
      values.push(phase);
      whereClauses.push(`phase = $${values.length}`);
    }

    if (advisor) {
      values.push(`%${advisor.toLowerCase()}%`);
      whereClauses.push(`LOWER(partner_name) LIKE $${values.length}`);
    }

    if (name) {
      values.push(`%${name.toLowerCase()}%`);
      whereClauses.push(`LOWER(candidate_name) LIKE $${values.length}`);
    }

    if (company) {
      values.push(`%${company.toLowerCase()}%`);
      whereClauses.push(`LOWER(company_name) LIKE $${values.length}`);
    }

    if (valid === "true" || valid === "false") {
      values.push(valid === "true");
      whereClauses.push(`valid_application = $${values.length}`);
    }

    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    const orderDirection = sort === "asc" ? "ASC" : "DESC";
    const limitValue = Math.min(
      Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const offsetValue = Math.max(parseInt(offset, 10) || 0, 0);

    const listValues = values.slice();
    listValues.push(limitValue, offsetValue);

    const selectSql = `
      SELECT *
      FROM candidates
      ${whereSql}
      ORDER BY
        COALESCE(
          registered_at,
          registered_date::timestamptz,
          created_at,
          updated_at
        ) ${orderDirection},
        registered_date ${orderDirection},
        id ${orderDirection}
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM candidates
      ${whereSql}
    `;

    const [itemsResult, totalResult, lastSyncedAt] = await Promise.all([
      client.query(selectSql, listValues),
      client.query(countSql, values),
      getLastSyncedAt(client),
    ]);

    res.json({
      items: itemsResult.rows.map(mapCandidate),
      total: Number(totalResult.rows[0].total),
      lastSyncedAt,
    });
  } catch (error) {
    console.error("Failed to fetch candidates", error);
    res.status(500).json({ error: "候補者一覧の取得に失敗しました。" });
  } finally {
    client.release();
  }
});

app.get("/api/candidates/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const includeMaster = String(req.query?.includeMaster || "").toLowerCase() === "true";
    const { rows } = await client.query(
      "SELECT * FROM candidates WHERE id = $1",
      [id]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: "候補者が見つかりません。" });
      return;
    }
    const relations = await fetchCandidateRelations(client, rows[0].id);
    const candidate = mapCandidate(rows[0], relations);
    if (!includeMaster) {
      res.json(candidate);
      return;
    }
    const masters = await getCandidateMasters(client);
    res.json({
      ...candidate,
      masters,
    });
  } catch (error) {
    console.error("Failed to fetch candidate detail", error);
    res.status(500).json({ error: "候補者詳細の取得に失敗しました。" });
  } finally {
    client.release();
  }
});

app.get("/api/health", async (_req, res) => {
  const client = await pool.connect();
  try {
    const lastSyncedAt = await getLastSyncedAt(client);
    res.json({ status: "ok", lastSyncedAt });
  } catch (error) {
    console.error("Health check failed", error);
    res.status(500).json({ status: "error" });
  } finally {
    client.release();
  }
});

app.get("/api/settings/kintone", async (_req, res) => {
  const client = await pool.connect();
  try {
    const row = await getKintoneSettings(client);
    if (!row) {
      res.json({ exists: false });
      return;
    }
    res.json({
      exists: true,
      kintoneSubdomain: row.kintone_subdomain,
      kintoneAppId: row.kintone_app_id,
      hasToken: Boolean(row.kintone_api_token),
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error("Failed to load kintone settings", error);
    res.status(500).json({ error: "kintone設定の取得に失敗しました。" });
  } finally {
    client.release();
  }
});

app.put("/api/candidates/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const candidateId = Number(req.params.id);
    if (Number.isNaN(candidateId)) {
      res.status(400).json({ error: "候補者IDが不正です。" });
      return;
    }
    const payload = req.body || {};
    const { rows: existingRows } = await client.query(
      "SELECT id FROM candidates WHERE id = $1",
      [candidateId]
    );
    if (existingRows.length === 0) {
      res.status(404).json({ error: "候補者が見つかりません。" });
      return;
    }

    await client.query("BEGIN");
    const columns = mapCandidateUpdateColumns(payload);
    const keys = Object.keys(columns);
    const assignments = keys.map((key, index) => `${key} = $${index + 1}`);
    const values = keys.map((key) => columns[key]);
    assignments.push(`updated_at = NOW()`);
    values.push(candidateId);

    await client.query(
      `UPDATE candidates SET ${assignments.join(", ")} WHERE id = $${values.length
      }`,
      values
    );

    await persistCandidateRelations(client, candidateId, payload);

    await client.query("COMMIT");
    const { rows } = await client.query(
      "SELECT * FROM candidates WHERE id = $1",
      [candidateId]
    );
    const relations = await fetchCandidateRelations(client, candidateId);
    res.json(mapCandidate(rows[0], relations));
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to update candidate", error);
    res.status(500).json({ error: "候補者の更新に失敗しました。" });
  } finally {
    client.release();
  }
});

app.post("/api/settings/kintone/test", async (req, res) => {
  const { kintoneSubdomain, kintoneAppId, kintoneApiToken } = req.body || {};
  if (!kintoneSubdomain || !kintoneAppId || !kintoneApiToken) {
    res.status(400).json({ error: "サブドメイン、アプリID、APIトークンを入力してください。" });
    return;
  }

  try {
    const params = new URLSearchParams({
      app: kintoneAppId,
      limit: "1",
    });
    const endpoint = `https://${kintoneSubdomain}.cybozu.com/k/v1/records.json?${params.toString()}`;
    const response = await fetch(endpoint, {
      headers: {
        "X-Cybozu-API-Token": kintoneApiToken,
      },
    });
    if (!response.ok) {
      const text = await response.text();
      res.status(400).json({
        error: `接続に失敗しました（${response.status}）`,
        details: text.slice(0, 500),
      });
      return;
    }
    const body = await response.json();
    res.json({
      success: true,
      message: `接続に成功しました。（取得件数 ${body.records?.length ?? 0} 件）`,
    });
  } catch (error) {
    console.error("Failed to test kintone connection", error);
    res.status(500).json({ error: "接続テスト中にエラーが発生しました。" });
  }
});

app.put("/api/settings/kintone", async (req, res) => {
  const { kintoneSubdomain, kintoneAppId, kintoneApiToken } = req.body || {};
  if (!kintoneSubdomain || !kintoneAppId) {
    res.status(400).json({ error: "サブドメインとアプリIDは必須です。" });
    return;
  }

  const client = await pool.connect();
  try {
    const existing = await getKintoneSettings(client);
    const tokenToUse =
      kintoneApiToken?.trim() || existing?.kintone_api_token || "";
    if (!tokenToUse) {
      res.status(400).json({ error: "APIトークンを入力してください。" });
      return;
    }

    await client.query(
      `
        INSERT INTO ats_settings (id, kintone_subdomain, kintone_app_id, kintone_api_token)
        VALUES (1, $1, $2, $3)
        ON CONFLICT (id) DO UPDATE
        SET kintone_subdomain = EXCLUDED.kintone_subdomain,
            kintone_app_id = EXCLUDED.kintone_app_id,
            kintone_api_token = EXCLUDED.kintone_api_token,
            updated_at = NOW()
      `,
      [kintoneSubdomain.trim(), kintoneAppId.trim(), tokenToUse]
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to save kintone settings", error);
    res.status(500).json({ error: "kintone設定の保存に失敗しました。" });
  } finally {
    client.release();
  }
});

// ========== 学歴 API ==========
app.get("/api/candidates/:id/educations", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM candidate_educations WHERE candidate_id = $1 ORDER BY sequence, admission_date`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch educations", error);
    res.status(500).json({ error: "学歴の取得に失敗しました" });
  }
});

app.put("/api/candidates/:id/educations", async (req, res) => {
  const { id } = req.params;
  const rows = req.body || [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM candidate_educations WHERE candidate_id = $1", [id]);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      await client.query(
        `INSERT INTO candidate_educations
         (candidate_id, school_name, department, admission_date, graduation_date, graduation_status, sequence)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, r.schoolName || null, r.department || null, r.admissionDate || null, r.graduationDate || null, r.graduationStatus || null, i]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to save educations", error);
    res.status(500).json({ error: "学歴の保存に失敗しました" });
  } finally {
    client.release();
  }
});

// ========== 職歴 API ==========
app.get("/api/candidates/:id/work-histories", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM candidate_work_histories WHERE candidate_id = $1 ORDER BY sequence, join_date`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch work histories", error);
    res.status(500).json({ error: "職歴の取得に失敗しました" });
  }
});

app.put("/api/candidates/:id/work-histories", async (req, res) => {
  const { id } = req.params;
  const rows = req.body || [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM candidate_work_histories WHERE candidate_id = $1", [id]);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      await client.query(
        `INSERT INTO candidate_work_histories
         (candidate_id, company_name, department, position, join_date, leave_date, is_current, job_description, sequence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, r.companyName || null, r.department || null, r.position || null, r.joinDate || null, r.leaveDate || null, r.isCurrent || false, r.jobDescription || null, i]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to save work histories", error);
    res.status(500).json({ error: "職歴の保存に失敗しました" });
  } finally {
    client.release();
  }
});

// ========== PDF生成 API ==========
async function generatePdf(templateName, data) {
  const templatePath = path.join(__dirname, "server", "templates", `${templateName}.html`);
  let html = fs.readFileSync(templatePath, "utf-8");

  // 単純なテンプレート置換
  Object.entries(data).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, "g");
    html = html.replace(regex, value ?? "");
  });

  // 配列データ用のセクション処理
  const processArraySection = (sectionName, items) => {
    const sectionRegex = new RegExp(`{{#${sectionName}}}([\\s\\S]*?){{/${sectionName}}}`, "g");
    const emptyRegex = new RegExp(`{{\\^${sectionName}}}([\\s\\S]*?){{/${sectionName}}}`, "g");

    if (items && items.length > 0) {
      html = html.replace(sectionRegex, (_, template) => {
        return items.map(item => {
          let row = template;
          Object.entries(item).forEach(([k, v]) => {
            row = row.replace(new RegExp(`{{${k}}}`, "g"), v ?? "");
          });
          // isCurrent フラグ処理
          row = row.replace(/{{#isCurrent}}([\s\S]*?){{\/isCurrent}}/g, item.isCurrent ? "$1" : "");
          row = row.replace(/\{{\^isCurrent}}([\s\S]*?){{\/isCurrent}}/g, item.isCurrent ? "" : "$1");
          return row;
        }).join("");
      });
      html = html.replace(emptyRegex, "");
    } else {
      html = html.replace(sectionRegex, "");
      html = html.replace(emptyRegex, "$1");
    }
  };

  processArraySection("educations", data.educationsArray);
  processArraySection("workHistories", data.workHistoriesArray);

  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
  });
  await browser.close();
  return pdfBuffer;
}

function formatDateJPForPdf(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

app.get("/api/candidates/:id/resume.pdf", async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const { rows: candidates } = await client.query("SELECT * FROM candidates WHERE id = $1", [id]);
    if (!candidates.length) {
      res.status(404).json({ error: "候補者が見つかりません" });
      return;
    }
    const c = candidates[0];

    const p = await fetchCandidateAppProfileRow(client, id);

    const { rows: educations } = await client.query("SELECT * FROM candidate_educations WHERE candidate_id = $1 ORDER BY sequence", [id]);
    const { rows: workHistories } = await client.query("SELECT * FROM candidate_work_histories WHERE candidate_id = $1 ORDER BY sequence", [id]);

    const data = {
      candidateName: c.candidate_name || "",
      candidateKana: c.candidate_kana || "",
      birthday: c.birthday ? formatDateJPForPdf(c.birthday) : "",
      age: c.age || "",
      postalCode: c.postal_code || p.address_pref || "",
      address: [p.address_pref, p.address_city, p.address_detail].filter(Boolean).join(" ") || c.address || "",
      phone: c.phone || "",
      email: c.email || "",
      reasonForChange: p.reason_for_change || "",
      currentDate: formatDateJPForPdf(new Date()),
      educationsArray: educations.map(e => ({
        schoolName: e.school_name || "",
        department: e.department || "",
        admissionDate: formatDateJPForPdf(e.admission_date),
        graduationDate: formatDateJPForPdf(e.graduation_date),
        graduationStatus: e.graduation_status || "卒業",
      })),
      workHistoriesArray: workHistories.map(w => ({
        companyName: w.company_name || "",
        department: w.department || "",
        position: w.position || "",
        joinDate: formatDateJPForPdf(w.join_date),
        leaveDate: formatDateJPForPdf(w.leave_date),
        isCurrent: w.is_current,
      })),
    };

    const pdfBuffer = await generatePdf("resume", data);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="resume_${c.candidate_name || id}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Failed to generate resume PDF", error);
    res.status(500).json({ error: "履歴書PDFの生成に失敗しました" });
  } finally {
    client.release();
  }
});

app.get("/api/candidates/:id/cv.pdf", async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const { rows: candidates } = await client.query("SELECT * FROM candidates WHERE id = $1", [id]);
    if (!candidates.length) {
      res.status(404).json({ error: "候補者が見つかりません" });
      return;
    }
    const c = candidates[0];

    const p = await fetchCandidateAppProfileRow(client, id);

    const { rows: workHistories } = await client.query("SELECT * FROM candidate_work_histories WHERE candidate_id = $1 ORDER BY sequence", [id]);

    const data = {
      candidateName: c.candidate_name || "",
      workExperience: p.work_experience || "",
      strengths: p.strengths || "",
      personality: p.personality || "",
      reasonForChange: p.reason_for_change || "",
      futureVision: p.future_vision || "",
      currentDate: formatDateJPForPdf(new Date()),
      workHistoriesArray: workHistories.map(w => ({
        companyName: w.company_name || "",
        department: w.department || "",
        position: w.position || "",
        joinDate: formatDateJPForPdf(w.join_date),
        leaveDate: formatDateJPForPdf(w.leave_date),
        jobDescription: w.job_description || "",
        isCurrent: w.is_current,
      })),
    };

    const pdfBuffer = await generatePdf("cv", data);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cv_${c.candidate_name || id}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Failed to generate CV PDF", error);
    res.status(500).json({ error: "職務経歴書PDFの生成に失敗しました" });
  } finally {
    client.release();
  }
});

// ========== 設定 API ==========
app.get("/api/settings/screening-rules", (req, res) => {
  // TODO: DBから取得するように実装
  res.json([]);
});

app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
});
