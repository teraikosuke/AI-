const { Pool } = require("pg");
require("dotenv").config();
const mockCandidates = require("./mockCandidates");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://postgres:devpass@localhost:5432/ats",
});

const toIntId = (value) => {
  if (!value) return null;
  const matched = value.match(/\d+/);
  return matched ? parseInt(matched[0], 10) : null;
};

const normalizeDate = (value) => {
  if (!value || value === "-") return null;
  return value;
};

const toDateTimeValue = (value) => {
  if (!value) return null;
  if (value.includes("T")) return value;
  return `${value}T00:00:00.000Z`;
};

const reportStatusLookup = {
  "LINE報告済み": "line_reported",
  "個人シート反映済み": "personal_sheet_reflected",
  "請求書送付済み": "invoice_sent",
};

function buildReportStatusFlags(statuses = []) {
  const flags = {
    line_reported: false,
    personal_sheet_reflected: false,
    invoice_sent: false,
  };
  statuses.forEach((label) => {
    const key = reportStatusLookup[label];
    if (key) {
      flags[key] = true;
    }
  });
  return flags;
}

function buildCsChecklistFlags(checklist = {}) {
  return {
    cs_valid_confirmed: Boolean(checklist.validConfirmed),
    cs_connect_confirmed: Boolean(checklist.connectConfirmed),
    cs_call_attempt1: Boolean(checklist.dial1),
    cs_call_attempt2: Boolean(checklist.dial2),
    cs_call_attempt3: Boolean(checklist.dial3),
    cs_call_attempt4: Boolean(checklist.dial4),
    cs_call_attempt5: Boolean(checklist.dial5),
    cs_call_attempt6: Boolean(checklist.dial6),
    cs_call_attempt7: Boolean(checklist.dial7),
    cs_call_attempt8: Boolean(checklist.dial8),
    cs_call_attempt9: Boolean(checklist.dial9),
    cs_call_attempt10: Boolean(checklist.dial10),
  };
}

function buildHearingMemo(hearing = {}) {
  if (!hearing) return null;
  if (hearing.memo) return hearing.memo;
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
  const memoLines = legacyFields
    .map(({ key, label }) => (hearing[key] ? `${label}: ${hearing[key]}` : ""))
    .filter(Boolean);
  return memoLines.length > 0 ? memoLines.join("\n") : null;
}

function buildDetail(candidate) {
  return {
    workLocation: candidate.workLocation,
    mediaRegisteredAt: candidate.mediaRegisteredAt,
    gender: candidate.gender,
    education: candidate.education,
    postalCode: candidate.postalCode,
    address: candidate.address,
    city: candidate.city,
    contactTime: candidate.contactTime,
    remarks: candidate.remarks,
    smsConfirmed: candidate.smsConfirmed,
    recommendationDate: candidate.recommendationDate,
    meetingVideoLink: candidate.meetingVideoLink,
    resumeForSend: candidate.resumeForSend,
    workHistoryForSend: candidate.workHistoryForSend,
    partnerName: candidate.partnerName,
    introductionChance: candidate.introductionChance,
    newActionDate: candidate.newActionDate,
    actionInfo: candidate.actionInfo,
    meetingPlans: candidate.meetingPlans,
    resumeDocuments: candidate.resumeDocuments,
    hearing: candidate.hearing,
    selectionProgress: candidate.selectionProgress,
    afterAcceptance: candidate.afterAcceptance,
    refundInfo: candidate.refundInfo,
    csChecklist: candidate.csChecklist,
    memoDetail: candidate.memoDetail,
  };
}

async function insertMeetingPlans(client, candidateId, plans = []) {
  if (!Array.isArray(plans) || plans.length === 0) return;
  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index];
    await client.query(
      `
        INSERT INTO meeting_plans (
          candidate_id,
          sequence,
          planned_date,
          attendance
        ) VALUES ($1, $2, $3, $4)
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

async function insertResumeDocuments(client, candidateId, documents = []) {
  if (!Array.isArray(documents) || documents.length === 0) return;
  for (const doc of documents) {
    await client.query(
      `
        INSERT INTO resume_documents (
          candidate_id,
          label,
          document_value
        ) VALUES ($1, $2, $3)
      `,
      [candidateId, doc.label || null, doc.value || ""]
    );
  }
}

async function insertSelectionProgress(client, candidateId, rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return;
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
        row.route || null,
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
        row.notes || null,
      ]
    );
  }
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE TABLE candidates RESTART IDENTITY CASCADE");

    for (const candidate of mockCandidates) {
      const detail = buildDetail(candidate);
      const hearingMemo = buildHearingMemo(candidate.hearing);
      const reportStatusFlags = buildReportStatusFlags(
        candidate.afterAcceptance?.reportStatuses
      );
      const csFlags = buildCsChecklistFlags(candidate.csChecklist || {});
      const employmentStatus =
        candidate.employmentStatus ||
        candidate.hearing?.employmentStatus ||
        null;
      const values = [
        toIntId(candidate.id),
        candidate.candidateCode,
        candidate.candidateName,
        candidate.candidateKana,
        candidate.companyName,
        candidate.jobName,
        candidate.workLocation,
        candidate.advisorName,
        candidate.callerName,
        candidate.partnerName,
        candidate.introductionChance,
        candidate.phase,
        normalizeDate(candidate.registeredDate),
        toDateTimeValue(candidate.registeredDate),
        candidate.updatedAt
          ? new Date(candidate.updatedAt).toISOString()
          : null,
        normalizeDate(candidate.mediaRegisteredAt),
        candidate.source,
        candidate.phone,
        candidate.email,
        normalizeDate(candidate.birthday),
        candidate.age ?? null,
        candidate.gender,
        candidate.education,
        candidate.postalCode,
        candidate.address,
        candidate.city,
        candidate.contactTime,
        candidate.remarks,
        candidate.memo,
        candidate.memoDetail,
        hearingMemo,
        candidate.resumeStatus,
        candidate.meetingVideoLink,
        candidate.resumeForSend,
        candidate.workHistoryForSend,
        employmentStatus,
        normalizeDate(candidate.firstContactPlannedAt),
        normalizeDate(candidate.firstContactAt),
        normalizeDate(candidate.callDate),
        normalizeDate(candidate.scheduleConfirmedAt),
        normalizeDate(candidate.recommendationDate),
        Boolean(candidate.validApplication),
        Boolean(candidate.phoneConnected),
        Boolean(candidate.smsSent),
        Boolean(candidate.smsConfirmed),
        Boolean(candidate.attendanceConfirmed),
        normalizeDate(
          candidate.actionInfo?.nextActionDate || candidate.newActionDate
        ),
        candidate.actionInfo?.finalResult || "----",
        candidate.afterAcceptance?.amount || "",
        candidate.afterAcceptance?.jobCategory || "",
        reportStatusFlags.line_reported,
        reportStatusFlags.personal_sheet_reflected,
        reportStatusFlags.invoice_sent,
        csFlags.cs_valid_confirmed,
        csFlags.cs_connect_confirmed,
        csFlags.cs_call_attempt1,
        csFlags.cs_call_attempt2,
        csFlags.cs_call_attempt3,
        csFlags.cs_call_attempt4,
        csFlags.cs_call_attempt5,
        csFlags.cs_call_attempt6,
        csFlags.cs_call_attempt7,
        csFlags.cs_call_attempt8,
        csFlags.cs_call_attempt9,
        csFlags.cs_call_attempt10,
        normalizeDate(candidate.refundInfo?.resignationDate),
        candidate.refundInfo?.refundAmount || "",
        candidate.refundInfo?.reportStatus || "",
        JSON.stringify(detail),
        candidate.updatedAt ? new Date(candidate.updatedAt).toISOString() : null,
      ];

      const insertResult = await client.query(
        `
          INSERT INTO candidates (
            kintone_record_id,
            candidate_code,
            candidate_name,
            candidate_kana,
            company_name,
            job_name,
            work_location,
            advisor_name,
            caller_name,
            partner_name,
            introduction_chance,
            phase,
            registered_date,
            registered_at,
            candidate_updated_at,
            media_registered_at,
            source,
            phone,
            email,
            birthday,
            age,
            gender,
            education,
            postal_code,
            address,
            city,
            contact_time,
            remarks,
            memo,
            memo_detail,
            hearing_memo,
            resume_status,
            meeting_video_url,
            resume_for_send,
            work_history_for_send,
            employment_status,
            first_contact_planned_at,
            first_contact_at,
            call_date,
            schedule_confirmed_at,
            recommendation_date,
            valid_application,
            phone_connected,
            sms_sent,
            sms_confirmed,
            attendance_confirmed,
            next_action_date,
            final_result,
            order_amount,
            after_acceptance_job_type,
            line_reported,
            personal_sheet_reflected,
            invoice_sent,
            cs_valid_confirmed,
            cs_connect_confirmed,
            cs_call_attempt1,
            cs_call_attempt2,
            cs_call_attempt3,
            cs_call_attempt4,
            cs_call_attempt5,
            cs_call_attempt6,
            cs_call_attempt7,
            cs_call_attempt8,
            cs_call_attempt9,
            cs_call_attempt10,
            refund_retirement_date,
            refund_amount,
            refund_report,
            detail,
            kintone_updated_time
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
            $41, $42, $43, $44, $45, $46, $47, $48, $49, $50,
            $51, $52, $53, $54, $55, $56, $57, $58, $59, $60,
            $61, $62, $63, $64, $65, $66, $67, $68, $69, $70
          )
          RETURNING id
        `,
        values
      );
      const candidateId = insertResult.rows[0].id;
      await insertMeetingPlans(client, candidateId, candidate.meetingPlans);
      await insertResumeDocuments(client, candidateId, candidate.resumeDocuments);
      await insertSelectionProgress(
        client,
        candidateId,
        candidate.selectionProgress
      );
    }

    await client.query(
      `
        INSERT INTO sync_state (source, last_synced_at)
        VALUES ($1, NOW())
        ON CONFLICT (source) DO UPDATE SET last_synced_at = EXCLUDED.last_synced_at
      `,
      ["kintone"]
    );

    await client.query("COMMIT");
    console.log("Seed data inserted successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to seed data:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
