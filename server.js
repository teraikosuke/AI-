const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Pool } = require("pg");

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://postgres:devpass@localhost:5432/ats",
});

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

async function fetchCandidateRelations(client, candidateId) {
  const [meetingResult, resumeResult, selectionResult] = await Promise.all([
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
        SELECT company_name,
               application_route,
               recommendation_date,
               interview_schedule_date,
               interview_date,
               offer_date,
               closing_plan_date,
               offer_accept_date,
               joining_date,
               pre_join_quit_date,
               introduction_fee,
               status,
               note
        FROM selection_progress
        WHERE candidate_id = $1
        ORDER BY id ASC
      `,
      [candidateId]
    ),
  ]);

  return {
    meetingPlans: mapMeetingPlans(meetingResult.rows),
    resumeDocuments: mapResumeDocuments(resumeResult.rows),
    selectionProgress: mapSelectionProgress(selectionResult.rows),
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
    actionInfo: payload.actionInfo || {},
    csChecklist: payload.csChecklist || {},
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
    advisor_name: payload.advisorName ?? null,
    caller_name: payload.callerName ?? null,
    partner_name: payload.partnerName ?? null,
    introduction_chance: payload.introductionChance ?? null,
    phase: payload.phase ?? null,
    registered_date: normalizeDate(payload.registeredDate),
    registered_at: normalizeDateTime(payload.registeredAt),
    candidate_updated_at: normalizeDateTime(payload.candidateUpdatedAt),
    media_registered_at: normalizeDate(payload.mediaRegisteredAt),
    source: payload.source ?? null,
    phone: payload.phone ?? null,
    email: payload.email ?? null,
    birthday: normalizeDate(payload.birthday),
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

async function replaceSelectionProgress(client, candidateId, rows = []) {
  await client.query("DELETE FROM selection_progress WHERE candidate_id = $1", [
    candidateId,
  ]);
  for (const row of rows) {
    await client.query(
      `
        INSERT INTO selection_progress (
          candidate_id,
          company_name,
          application_route,
          recommendation_date,
          interview_schedule_date,
          interview_date,
          offer_date,
          closing_plan_date,
          offer_accept_date,
          joining_date,
          pre_join_quit_date,
          introduction_fee,
          status,
          note
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
        )
      `,
      [
        candidateId,
        row.companyName || null,
        row.route || row.applicationRoute || null,
        normalizeDate(row.recommendationDate),
        normalizeDate(row.interviewSetupDate),
        normalizeDate(row.interviewDate),
        normalizeDate(row.offerDate),
        normalizeDate(row.closingDate),
        normalizeDate(row.acceptanceDate),
        normalizeDate(row.onboardingDate),
        normalizeDate(row.preJoinDeclineDate),
        row.fee || null,
        row.status || null,
        row.notes || row.note || null,
      ]
    );
  }
}

async function persistCandidateRelations(client, candidateId, payload) {
  await Promise.all([
    replaceMeetingPlans(client, candidateId, payload.meetingPlans || []),
    replaceResumeDocuments(client, candidateId, payload.resumeDocuments || []),
    replaceSelectionProgress(
      client,
      candidateId,
      payload.selectionProgress || []
    ),
  ]);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

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
  return {
    id: row.id,
    kintoneId: row.kintone_record_id,
    candidateCode: row.candidate_code,
    candidateName: row.candidate_name,
    candidateKana: row.candidate_kana,
    companyName: row.company_name,
    jobName: row.job_name,
    workLocation: row.work_location ?? detail.workLocation,
    advisorName: row.advisor_name,
    callerName: row.caller_name,
    partnerName: row.partner_name ?? detail.partnerName,
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
    education: row.education ?? detail.education,
    postalCode: row.postal_code ?? detail.postalCode,
    address: row.address ?? detail.address,
    city: row.city ?? detail.city,
    contactTime: row.contact_time ?? detail.contactTime,
    remarks: row.remarks ?? detail.remarks,
    memo: row.memo,
    memoDetail: row.memo_detail ?? detail.memoDetail,
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
      whereClauses.push(`LOWER(advisor_name) LIKE $${values.length}`);
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
    const { rows } = await client.query(
      "SELECT * FROM candidates WHERE id = $1",
      [id]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: "候補者が見つかりません。" });
      return;
    }
    const relations = await fetchCandidateRelations(client, rows[0].id);
    res.json(mapCandidate(rows[0], relations));
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
      `UPDATE candidates SET ${assignments.join(", ")} WHERE id = $${
        values.length
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

app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
