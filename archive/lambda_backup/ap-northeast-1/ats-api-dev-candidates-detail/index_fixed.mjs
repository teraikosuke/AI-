import pg from "pg";

// ---------------------------------------------------------
// 1. 設定・定数
// ---------------------------------------------------------
const ALLOWED_ORIGINS = new Set([
    "http://localhost:8000",
    "http://localhost:8001",
    "http://localhost:8081",
    "https://agent-key.pages.dev",
    "https://develop.agent-key.pages.dev",
]);

const baseHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
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
    max: 2, // 同時接続数を制限
    idleTimeoutMillis: 5000,
});

// ---------------------------------------------------------
// 2. ヘルパー関数
// ---------------------------------------------------------
const toIntOrNull = (v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
};

const emptyToNull = (v) => {
    if (v === undefined || v === null) return null;
    if (typeof v === "string" && v.trim() === "") return null;
    return v;
};

const toBooleanOrNull = (v) => {
    if (v === true || v === "true" || v === 1 || v === "1") return true;
    if (v === false || v === "false" || v === 0 || v === "0") return false;
    return null;
};

const resolveUserId = (...candidates) => {
    for (const v of candidates) {
        const n = toIntOrNull(v);
        if (n !== null) return n;
    }
    return null;
};

const normalizeRole = (v) => String(v || "").trim().toLowerCase();

async function assertUserRole(client, userId, expectedRole, label) {
    if (userId === null || userId === undefined) return;
    const res = await client.query("SELECT id, name, role FROM users WHERE id = $1", [userId]);
    if (!res.rows || res.rows.length === 0) {
        throw new Error(`${label}のユーザーが存在しません (user_id=${userId})`);
    }
    const actualRole = normalizeRole(res.rows[0].role);
    if (actualRole !== normalizeRole(expectedRole)) {
        throw new Error(`${label}には role=${expectedRole} のユーザーのみ指定できます`);
    }
}

const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const date = new Date(birthDate);
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) age -= 1;
    return age;
};

async function fetchMasters(client) {
    const [clientsRes, usersRes] = await Promise.all([
        client.query("SELECT id, name FROM clients ORDER BY name ASC"),
        client.query("SELECT id, name, role FROM users ORDER BY name ASC"),
    ]);
    return { clients: clientsRes.rows || [], users: usersRes.rows || [] };
}

// 直近の未完了タスクを候補者テーブルにキャッシュする
async function syncNextActionDate(client, candidateId) {
    await client.query(`
    UPDATE candidates
    SET 
      next_action_date = (
        SELECT action_date FROM candidate_tasks 
        WHERE candidate_id = $1 AND is_completed = false 
        ORDER BY action_date ASC LIMIT 1
      ),
      next_action_note = (
        SELECT action_note FROM candidate_tasks 
        WHERE candidate_id = $1 AND is_completed = false 
        ORDER BY action_date ASC LIMIT 1
      )
    WHERE id = $1
  `, [candidateId]);
}

// ---------------------------------------------------------
// 3. データ取得ロジック (GET)
// ---------------------------------------------------------
async function fetchCandidateDetail(client, candidateId, includeMaster = false) {
    const baseSql = `
    SELECT
      c.*,
      u_ad.name AS user_advisor_name,
      u_pt.name AS user_partner_name,
      ca_latest.apply_route AS latest_apply_route,
      ca_stage.stage_list,
      ca_latest.client_name AS latest_company_name,
      ca_latest.job_title AS latest_job_name,
      ca_latest.stage_current AS latest_stage_current,
      u_call.name AS caller_name
    FROM candidates c
    LEFT JOIN users u_ad ON u_ad.id = c.advisor_user_id
    LEFT JOIN users u_pt ON u_pt.id = c.partner_user_id
    LEFT JOIN LATERAL (
      SELECT ca.client_id, cl.name AS client_name, ca.job_title, ca.apply_route, ca.stage_current, ca.updated_at, ca.created_at
      FROM candidate_applications ca
      LEFT JOIN clients cl ON cl.id = ca.client_id
      WHERE ca.candidate_id = c.id
      ORDER BY COALESCE(ca.updated_at, ca.created_at) DESC NULLS LAST LIMIT 1
    ) ca_latest ON TRUE
    LEFT JOIN LATERAL (
      SELECT caller_user_id, called_at, result, call_no FROM teleapo t
      WHERE t.candidate_id = c.id ORDER BY (t.result='通電') DESC, t.called_at DESC LIMIT 1
    ) t_last ON TRUE
    LEFT JOIN users u_call ON u_call.id = t_last.caller_user_id
    LEFT JOIN LATERAL (
        SELECT MAX(call_no) as max_call_no, BOOL_OR(result = '通電') as has_connected, BOOL_OR(result = 'SMS送信') as has_sms, MAX(CASE WHEN result = '通電' THEN called_at END) as last_connected_at
        FROM teleapo WHERE candidate_id = c.id
    ) t_stat ON TRUE
    LEFT JOIN LATERAL (
      SELECT array_agg(DISTINCT ca.stage_current) AS stage_list FROM candidate_applications ca WHERE ca.candidate_id = c.id
    ) ca_stage ON TRUE
    WHERE c.id = $1 LIMIT 1;
  `;

    const baseRes = await client.query(baseSql, [candidateId]);
    if (!baseRes.rows?.length) return null;
    const b = baseRes.rows[0];

    // 選考進捗
    const selectionSql = `
    SELECT COALESCE(json_agg(json_build_object(
            'id', ca.id,
            'clientId', ca.client_id,
            'companyName', cl.name,
            'stageCurrent', ca.stage_current,
            'jobTitle', ca.job_title,
            'route', ca.apply_route,
            'applyRoute', ca.apply_route,
            'proposalDate', ca.proposal_date,
            'recommendationDate', ca.recommended_at,
            'firstInterviewDate', ca.first_interview_at,
            'secondInterviewDate', ca.second_interview_at,
            'finalInterviewDate', ca.final_interview_at,
            'offerDate', ca.offer_date,
            'acceptanceDate', ca.offer_accept_date,
            'onboardingDate', ca.join_date,
            'preJoinDeclineDate', ca.pre_join_withdraw_date,
            'preJoinDeclineReason', ca.pre_join_withdraw_reason,
            'postJoinQuitDate', ca.post_join_quit_date,
            'postJoinQuitReason', ca.post_join_quit_reason,
            'closeExpectedDate', ca.close_expected_at,
            'selectionNote', ca.selection_note,
            'feeAmount', ca.fee,
            'created_at', ca.created_at
          ) ORDER BY COALESCE(ca.updated_at, ca.created_at) DESC), '[]'::json) AS selection_progress
    FROM candidate_applications ca
    LEFT JOIN clients cl ON cl.id = ca.client_id
    WHERE ca.candidate_id = $1
  `;
    const selectionRes = await client.query(selectionSql, [candidateId]);
    const selectionProgress = selectionRes.rows[0]?.selection_progress || [];

    // タスク履歴
    const tasksSql = `
    SELECT id, action_date, action_note, is_completed, completed_at, created_at
    FROM candidate_tasks
    WHERE candidate_id = $1
    ORDER BY action_date DESC, created_at DESC
  `;
    const tasksRes = await client.query(tasksSql, [candidateId]);
    const tasks = tasksRes.rows.map(row => ({
        id: row.id,
        actionDate: row.action_date,
        actionNote: row.action_note,
        isCompleted: row.is_completed,
        completedAt: row.completed_at,
        createdAt: row.created_at
    }));

    // テレアポログ
    const teleapoSql = `
    SELECT t.id, t.call_no, t.called_at, t.result, t.route, t.memo, t.caller_user_id, u.name AS caller_name
    FROM teleapo t
    LEFT JOIN users u ON u.id = t.caller_user_id
    WHERE t.candidate_id = $1
    ORDER BY t.called_at DESC, t.call_no DESC
  `;
    const teleapoRes = await client.query(teleapoSql, [candidateId]);
    const teleapoLogs = teleapoRes.rows.map(row => ({
        id: row.id,
        callNo: row.call_no,
        calledAt: row.called_at,
        result: row.result,
        route: row.route,
        memo: row.memo,
        callerUserId: row.caller_user_id,
        callerName: row.caller_name
    }));

    // 売上・返金情報
    const moneySql = `
    SELECT
      ca.id AS application_id, ca.client_id, cl.name AS company_name,
      COALESCE(ca.joined_at, ca.join_date) AS join_date,
      ca.pre_join_withdraw_date, ca.post_join_quit_date,
      p.fee_amount, p.order_date, p.refund_amount, p.withdraw_date, p.order_reported, p.refund_reported
    FROM candidate_applications ca
    LEFT JOIN clients cl ON cl.id = ca.client_id
    LEFT JOIN placements p ON p.candidate_application_id = ca.id
    WHERE ca.candidate_id = $1
    ORDER BY COALESCE(ca.updated_at, ca.created_at) DESC
  `;
    const moneyRes = await client.query(moneySql, [candidateId]);
    const moneyInfo = moneyRes.rows.map(row => ({
        applicationId: row.application_id,
        clientId: row.client_id,
        companyName: row.company_name ?? "",
        joinDate: row.join_date,
        preJoinWithdrawDate: row.pre_join_withdraw_date,
        postJoinQuitDate: row.post_join_quit_date,
        feeAmount: row.fee_amount,
        orderDate: row.order_date,
        refundAmount: row.refund_amount,
        withdrawDate: row.withdraw_date,
        orderReported: row.order_reported,
        refundReported: row.refund_reported
    }));

    const address = [b.address_pref, b.address_city, b.address_detail].filter(Boolean).join("");
    let phase = "未接触";
    const phases = b.stage_list || [];
    if (phases.length > 0) phase = phases.join(" / ");
    else if (b.latest_stage_current) phase = b.latest_stage_current;
    else {
        if (b.has_connected) phase = "通電";
        else if (b.has_sms) phase = "SMS送信";
        else if ((b.max_call_no || 0) > 0) phase = "架電中";
    }

    const detail = {
        id: String(b.id),
        candidateName: b.name ?? "",
        candidateKana: b.name_kana ?? "",
        phone: b.phone ?? "",
        email: b.email ?? "",
        birthday: b.birth_date ?? null,
        age: calculateAge(b.birth_date) ?? b.age ?? null,
        gender: b.gender ?? "",
        postalCode: b.postal_code ?? "",
        addressPref: b.address_pref ?? "",
        addressCity: b.address_city ?? "",
        addressDetail: b.address_detail ?? "",
        address,
        education: b.final_education ?? "",
        nationality: b.nationality ?? "",
        japaneseLevel: b.japanese_level ?? "",
        nextActionDate: b.next_action_date ?? null,
        nextActionNote: b.next_action_note ?? "",
        tasks: tasks,
        companyName: b.latest_company_name ?? b.company_name ?? b.apply_company_name ?? "",
        jobName: b.latest_job_name ?? b.job_name ?? b.apply_job_name ?? "",
        validApplication: Boolean(b.is_effective_application),
        advisorUserId: b.advisor_user_id ?? null,
        partnerUserId: b.partner_user_id ?? null,
        csUserId: b.partner_user_id ?? null,
        advisorName: b.user_advisor_name ?? b.partner_name ?? b.advisor_name ?? "",
        partnerName: b.user_partner_name ?? b.partner_name ?? "",
        csName: b.cs_name ?? "",
        callerName: b.caller_name ?? "",
        phase,
        phases,
        registeredAt: b.registered_at ?? b.registered_date ?? b.created_at,
        registeredDate: b.registered_date ?? null,
        source: b.latest_apply_route ?? b.apply_route_text ?? b.source ?? "",
        contactPreferredTime: b.contact_preferred_time ?? "",
        applyCompanyName: b.apply_company_name ?? b.company_name ?? b.latest_company_name ?? "",
        applyJobName: b.apply_job_name ?? b.job_name ?? b.latest_job_name ?? "",
        applyRouteText: b.apply_route_text ?? b.source ?? b.latest_apply_route ?? "",
        applicationNote: b.application_note ?? "",
        currentIncome: b.current_income ?? null,
        desiredIncome: b.desired_income ?? null,
        employmentStatus: b.employment_status ?? "",
        mandatoryInterviewItems: b.mandatory_interview_items ?? "",
        desiredJobType: b.desired_job_type ?? "",
        careerMotivation: b.career_motivation ?? "",
        recommendationText: b.recommendation_text ?? "",
        careerReason: b.career_reason ?? "",
        transferTiming: b.transfer_timing ?? "",
        firstInterviewNote: b.first_interview_note ?? "",
        otherSelectionStatus: b.other_selection_status ?? "",
        interviewPreferredDate: b.interview_preferred_date ?? "",
        desiredLocation: b.desired_location ?? "",
        firstInterviewDate: b.first_contact_at ?? null,
        skills: b.skills ?? "",
        personality: b.personality ?? "",
        workExperience: b.work_experience ?? "",
        memo: b.memo ?? "",
        firstContactPlannedAt: b.first_contact_planned_at ?? null,
        attendanceConfirmed: Boolean(b.first_interview_attended),
        scheduleConfirmedAt: b.first_schedule_fixed_at ?? null,
        selectionProgress,
        teleapoLogs,
        moneyInfo,
        csSummary: {
            hasConnected: Boolean(b.has_connected),
            hasSms: Boolean(b.has_sms),
            callCount: b.max_call_no ?? 0,
            lastConnectedAt: b.last_connected_at ?? null,
        },
    };

    if (includeMaster) detail.masters = await fetchMasters(client);
    return detail;
}

// ---------------------------------------------------------
// 4. メインハンドラー
// ---------------------------------------------------------
export const handler = async (event) => {
    const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
    const headers = buildHeaders(event);
    if (method === "OPTIONS") return { statusCode: 204, headers, body: "" };

    const candidateId = toIntOrNull(event?.pathParameters?.id || event?.pathParameters?.candidateId);
    if (!candidateId) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid ID" }) };

    let client;
    try {
        client = await pool.connect();

        if (method === "GET") {
            const includeMaster = event?.queryStringParameters?.includeMaster === "true";
            const data = await fetchCandidateDetail(client, candidateId, includeMaster);
            if (!data) return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };
            return { statusCode: 200, headers, body: JSON.stringify(data) };
        }

        if (method === "PUT") {
            const payload = JSON.parse(event.body || "{}");
            const detailMode = Boolean(payload.detailMode ?? payload.detail_mode);
            await client.query("BEGIN");

            try {
                if (detailMode) {
                    const resolvedAdvisorUserId = resolveUserId(payload.advisorUserId, payload.advisor_user_id);
                    const resolvedCsUserId = resolveUserId(payload.partnerUserId, payload.partner_user_id, payload.csUserId, payload.cs_user_id);

                    await assertUserRole(client, resolvedCsUserId, "caller", "担当CS");
                    await assertUserRole(client, resolvedAdvisorUserId, "advisor", "担当アドバイザー");

                    // 1. 基本情報更新 (名前がある場合のみ実行、型キャスト追加)
                    if (payload.candidateName !== undefined) {
                        const updateSql = `
                UPDATE candidates SET
                  updated_at = NOW(),
                  is_effective_application = $2::boolean, advisor_user_id = $3::int, partner_user_id = $4::int,
                  first_schedule_fixed_at = $5::timestamptz, first_contact_planned_at = $6::timestamptz, first_contact_at = $7::timestamptz, first_interview_attended = $8::boolean,
                  name = $9::text, name_kana = $10::text, gender = $11::text, birth_date = $12::date, phone = $13::text, email = $14::text,
                  postal_code = $15::text, address_pref = $16::text, address_city = $17::text, address_detail = $18::text,
                  final_education = $19::text, nationality = $20::text, japanese_level = $21::text, mandatory_interview_items = $22::text,
                  desired_location = $23::text, desired_job_type = $24::text, current_income = $25::int, desired_income = $26::int,
                  employment_status = $27::text, career_reason = $28::text, career_motivation = $29::text, transfer_timing = $30::text,
                  skills = $31::text, personality = $32::text, work_experience = $33::text, other_selection_status = $34::text,
                  first_interview_note = $35::text, interview_preferred_date = $36::text
                WHERE id = $1::int
              `;
                        const p = [
                            candidateId,
                            toBooleanOrNull(payload.validApplication),
                            resolvedAdvisorUserId,
                            resolvedCsUserId,
                            emptyToNull(payload.scheduleConfirmedAt), emptyToNull(payload.firstContactPlannedAt), emptyToNull(payload.firstInterviewDate),
                            toBooleanOrNull(payload.attendanceConfirmed),
                            emptyToNull(payload.candidateName), emptyToNull(payload.candidateKana), emptyToNull(payload.gender), emptyToNull(payload.birthDate),
                            emptyToNull(payload.phone), emptyToNull(payload.email), emptyToNull(payload.postalCode), emptyToNull(payload.addressPref),
                            emptyToNull(payload.addressCity), emptyToNull(payload.addressDetail), emptyToNull(payload.education),
                            emptyToNull(payload.nationality), emptyToNull(payload.japaneseLevel), emptyToNull(payload.mandatoryInterviewItems),
                            emptyToNull(payload.desiredLocation), emptyToNull(payload.desiredJobType), emptyToNull(payload.currentIncome), emptyToNull(payload.desiredIncome),
                            emptyToNull(payload.employmentStatus), emptyToNull(payload.careerReason), emptyToNull(payload.careerMotivation), emptyToNull(payload.transferTiming),
                            emptyToNull(payload.skills), emptyToNull(payload.personality), emptyToNull(payload.workExperience), emptyToNull(payload.otherSelectionStatus),
                            emptyToNull(payload.firstInterviewNote), emptyToNull(payload.interviewPreferredDate)
                        ];
                        await client.query(updateSql, p);
                    } else {
                        await client.query("UPDATE candidates SET updated_at = NOW() WHERE id = $1", [candidateId]);
                    }

                    // 2. タスク処理
                    const newActionDate = emptyToNull(payload.nextActionDate);
                    const newActionNote = emptyToNull(payload.nextActionNote);
                    if (newActionDate && newActionNote) {
                        await client.query(`INSERT INTO candidate_tasks (candidate_id, action_date, action_note, is_completed, created_at, updated_at) VALUES ($1::int, $2::date, $3::text, false, NOW(), NOW())`, [candidateId, newActionDate, newActionNote]);
                    }
                    if (toIntOrNull(payload.completeTaskId)) {
                        await client.query(`UPDATE candidate_tasks SET is_completed = true, completed_at = NOW(), updated_at = NOW() WHERE id = $1::int AND candidate_id = $2::int`, [toIntOrNull(payload.completeTaskId), candidateId]);
                    }
                    if (toIntOrNull(payload.deleteTaskId)) {
                        await client.query(`DELETE FROM candidate_tasks WHERE id = $1::int AND candidate_id = $2::int`, [toIntOrNull(payload.deleteTaskId), candidateId]);
                    }
                    await syncNextActionDate(client, candidateId);

                    // 3. 着座ログ
                    if (toBooleanOrNull(payload.attendanceConfirmed) === true) {
                        const teleRes = await client.query(`SELECT id FROM teleapo WHERE candidate_id=$1::int AND result LIKE '%設定%' ORDER BY called_at DESC LIMIT 1`, [candidateId]);
                        if (teleRes.rows.length > 0) await client.query("UPDATE teleapo SET result='着座' WHERE id=$1::int", [teleRes.rows[0].id]);
                    }

                    // 4. 選考進捗 (型キャスト強化)
                    const selectionPayload = Array.isArray(payload.selectionProgress) ? payload.selectionProgress : (Array.isArray(payload.selection_progress) ? payload.selection_progress : null);
                    if (selectionPayload !== null) {
                        const keepIds = selectionPayload.map(entry => toIntOrNull(entry.id)).filter(id => id !== null);
                        if (keepIds.length === 0) {
                            await client.query(`DELETE FROM candidate_applications WHERE candidate_id = $1::int`, [candidateId]);
                        } else {
                            await client.query(`DELETE FROM candidate_applications WHERE candidate_id = $1::int AND id != ALL($2::int[])`, [candidateId, keepIds]);
                        }

                        for (const entry of selectionPayload) {
                            if (!entry.clientId && !entry.client_id && !entry.id) continue;
                            const s_id = toIntOrNull(entry.id);
                            const s_clientId = toIntOrNull(entry.clientId ?? entry.client_id);

                            // 値の準備（全て型キャスト付きで実行）
                            const s_stage = emptyToNull(entry.stageCurrent || entry.stage_current || entry.status);
                            const s_jobTitle = emptyToNull(entry.jobTitle || entry.job_title);
                            const s_route = emptyToNull(entry.route || entry.applyRoute || entry.apply_route);
                            const s_proposal = emptyToNull(entry.proposalDate || entry.proposal_date);
                            const s_rec = emptyToNull(entry.recommendedAt || entry.recommended_at || entry.recommendationDate);
                            const s_f_set = emptyToNull(entry.firstInterviewSetAt || entry.first_interview_set_at);
                            const s_f_at = emptyToNull(entry.firstInterviewAt || entry.first_interview_at || entry.firstInterviewDate);
                            const s_s_set = emptyToNull(entry.secondInterviewSetAt || entry.second_interview_set_at);
                            const s_s_at = emptyToNull(entry.secondInterviewAt || entry.second_interview_at || entry.secondInterviewDate);
                            const s_l_set = emptyToNull(entry.finalInterviewSetAt || entry.final_interview_set_at);
                            const s_l_at = emptyToNull(entry.finalInterviewAt || entry.final_interview_at || entry.finalInterviewDate);
                            const s_offer_d = emptyToNull(entry.offerDate || entry.offer_date);
                            const s_offer_at = emptyToNull(entry.offerAt || entry.offer_at);
                            const s_accept_d = emptyToNull(entry.offerAcceptDate || entry.offer_accept_date);
                            const s_accept_at = emptyToNull(entry.offerAcceptedAt || entry.offer_accepted_at);
                            const s_join_d = emptyToNull(entry.joinDate || entry.join_date);
                            const s_joined_at = emptyToNull(entry.joinedAt || entry.joined_at);
                            const s_pre_w_d = emptyToNull(entry.preJoinWithdrawDate || entry.pre_join_withdraw_date);
                            const s_pre_w_r = emptyToNull(entry.preJoinWithdrawReason || entry.pre_join_withdraw_reason);
                            const s_post_q_d = emptyToNull(entry.postJoinQuitDate || entry.post_join_quit_date);
                            const s_post_q_r = emptyToNull(entry.postJoinQuitReason || entry.post_join_quit_reason);
                            const s_dec_d = emptyToNull(entry.declinedAfterOfferAt || entry.declined_after_offer_at);
                            const s_dec_r = emptyToNull(entry.declinedAfterOfferReason || entry.declined_after_offer_reason);
                            const s_early_d = emptyToNull(entry.earlyTurnoverAt || entry.early_turnover_at);
                            const s_early_r = emptyToNull(entry.earlyTurnoverReason || entry.early_turnover_reason);
                            const s_close_exp = emptyToNull(entry.closeExpectedAt || entry.close_expected_at);
                            const s_close_fc = emptyToNull(entry.closingForecastAt || entry.closing_forecast_at);
                            const s_note = emptyToNull(entry.selectionNote || entry.selection_note);
                            const s_fee = toIntOrNull(entry.fee ?? entry.feeAmount ?? entry.fee_amount);

                            if (s_id) {
                                await client.query(`
                                    UPDATE candidate_applications SET 
                                        client_id = $2::int, stage_current = $3::text, job_title = $4::text, apply_route = $5::text,
                                        proposal_date = $6::date, recommended_at = $7::timestamptz,
                                        first_interview_set_at = $8::timestamptz, first_interview_at = $9::timestamptz,
                                        second_interview_set_at = $10::timestamptz, second_interview_at = $11::timestamptz,
                                        final_interview_set_at = $12::timestamptz, final_interview_at = $13::timestamptz,
                                        offer_date = $14::date, offer_at = $15::timestamptz,
                                        offer_accept_date = $16::date, offer_accepted_at = $17::timestamptz,
                                        join_date = $18::date, joined_at = $19::timestamptz,
                                        pre_join_withdraw_date = $20::date, pre_join_withdraw_reason = $21::text,
                                        post_join_quit_date = $22::date, post_join_quit_reason = $23::text,
                                        declined_after_offer_at = $24::timestamptz, declined_after_offer_reason = $25::text,
                                        early_turnover_at = $26::timestamptz, early_turnover_reason = $27::text,
                                        close_expected_at = $28::timestamptz, closing_forecast_at = $29::timestamptz,
                                        selection_note = $30::text, fee = $31::int, updated_at = NOW() 
                                    WHERE id = $1::int AND candidate_id = $32::int
                                `, [
                                    s_id, s_clientId, s_stage, s_jobTitle, s_route,
                                    s_proposal, s_rec, s_f_set, s_f_at, s_s_set, s_s_at, s_l_set, s_l_at,
                                    s_offer_d, s_offer_at, s_accept_d, s_accept_at, s_join_d, s_joined_at,
                                    s_pre_w_d, s_pre_w_r, s_post_q_d, s_post_q_r, s_dec_d, s_dec_r, s_early_d, s_early_r,
                                    s_close_exp, s_close_fc, s_note, s_fee, candidateId
                                ]);
                            } else if (s_clientId) {
                                await client.query(`
                                    INSERT INTO candidate_applications (
                                        candidate_id, client_id, stage_current, job_title, apply_route,
                                        proposal_date, recommended_at, first_interview_set_at, first_interview_at,
                                        second_interview_set_at, second_interview_at, final_interview_set_at, final_interview_at,
                                        offer_date, offer_at, offer_accept_date, offer_accepted_at,
                                        join_date, joined_at, pre_join_withdraw_date, pre_join_withdraw_reason,
                                        post_join_quit_date, post_join_quit_reason, declined_after_offer_at, declined_after_offer_reason,
                                        early_turnover_at, early_turnover_reason, close_expected_at, closing_forecast_at,
                                        selection_note, fee, created_at, updated_at
                                    ) VALUES ($1::int, $2::int, $3::text, $4::text, $5::text, $6::date, $7::timestamptz, $8::timestamptz, $9::timestamptz, $10::timestamptz, $11::timestamptz, $12::timestamptz, $13::timestamptz, $14::date, $15::timestamptz, $16::date, $17::timestamptz, $18::date, $19::timestamptz, $20::date, $21::text, $22::date, $23::text, $24::timestamptz, $25::text, $26::timestamptz, $27::text, $28::timestamptz, $29::timestamptz, $30::text, $31::int, NOW(), NOW())
                                `, [
                                    candidateId, s_clientId, s_stage, s_jobTitle, s_route,
                                    s_proposal, s_rec, s_f_set, s_f_at, s_s_set, s_s_at, s_l_set, s_l_at,
                                    s_offer_d, s_offer_at, s_accept_d, s_accept_at, s_join_d, s_joined_at,
                                    s_pre_w_d, s_pre_w_r, s_post_q_d, s_post_q_r, s_dec_d, s_dec_r, s_early_d, s_early_r,
                                    s_close_exp, s_close_fc, s_note, s_fee
                                ]);
                            }
                        }
                    }

                    // 5. 売上・返金情報
                    const moneyPayload = Array.isArray(payload.moneyInfo) ? payload.moneyInfo : (Array.isArray(payload.money_info) ? payload.money_info : null);
                    if (moneyPayload) {
                        for (const entry of moneyPayload) {
                            const applicationId = toIntOrNull(entry.applicationId ?? entry.application_id);
                            if (!applicationId) continue;

                            const feeAmount = toIntOrNull(entry.feeAmount ?? entry.fee_amount);
                            const refundAmount = toIntOrNull(entry.refundAmount ?? entry.refund_amount);
                            const orderDate = emptyToNull(entry.orderDate ?? entry.order_date);
                            const withdrawDate = emptyToNull(entry.withdrawDate ?? entry.withdraw_date);
                            const orderReported = toBooleanOrNull(entry.orderReported ?? entry.order_reported);
                            const refundReported = toBooleanOrNull(entry.refundReported ?? entry.refund_reported);
                            const hasPlacementValues = (feeAmount !== null || refundAmount !== null || orderDate !== null || withdrawDate !== null || orderReported !== null || refundReported !== null);

                            const placementRes = await client.query("SELECT id FROM placements WHERE candidate_application_id = $1::int LIMIT 1", [applicationId]);
                            if (placementRes.rows.length > 0) {
                                await client.query(`
                                    UPDATE placements SET
                                        fee_amount = $2::int, refund_amount = $3::int, order_date = $4::date, withdraw_date = $5::date,
                                        order_reported = $6::boolean, refund_reported = $7::boolean, updated_at = NOW()
                                    WHERE candidate_application_id = $1::int
                                `, [applicationId, feeAmount, refundAmount, orderDate, withdrawDate, orderReported, refundReported]);
                            } else if (hasPlacementValues) {
                                await client.query(`
                                    INSERT INTO placements (candidate_application_id, fee_amount, refund_amount, order_date, withdraw_date, order_reported, refund_reported, created_at, updated_at)
                                    // $1::int, $2::int ... のように型を明示します
VALUES ($1::int, $2::int, $3::int, $4::date, $5::date, COALESCE($6::boolean, false), COALESCE($7::boolean, false), NOW(), NOW())
                                `, [applicationId, feeAmount, refundAmount, orderDate, withdrawDate, orderReported, refundReported]);
                            }

                            const refundType = String(entry.refundType ?? entry.refund_type ?? "");
                            const retireDate = emptyToNull(entry.retirementDate ?? entry.retirement_date ?? entry.retireDate ?? entry.retire_date);
                            const preJoinDate = emptyToNull(entry.preJoinWithdrawDate ?? entry.pre_join_withdraw_date);
                            const postJoinDate = emptyToNull(entry.postJoinQuitDate ?? entry.post_join_quit_date);

                            let finalPreJoin = preJoinDate;
                            let finalPostJoin = postJoinDate;

                            if (refundType.includes("内定")) {
                                finalPreJoin = retireDate;
                                finalPostJoin = null;
                            } else if (refundType.includes("入社")) {
                                finalPostJoin = retireDate;
                                finalPreJoin = null;
                            }

                            if (finalPreJoin !== undefined || finalPostJoin !== undefined) {
                                await client.query(`
                                    UPDATE candidate_applications SET
                                        pre_join_withdraw_date = $1::date,
                                        post_join_quit_date = $2::date,
                                        updated_at = NOW()
                                    WHERE id = $3::int AND candidate_id = $4::int
                                `, [finalPreJoin, finalPostJoin, applicationId, candidateId]);
                            }
                        }
                    }

                } else if (typeof payload.validApplication === "boolean") {
                    await client.query("UPDATE candidates SET is_effective_application = $2::boolean WHERE id = $1::int", [candidateId, payload.validApplication]);
                }

                await client.query("COMMIT");
            } catch (err) {
                await client.query("ROLLBACK");
                throw err;
            }

            const updated = await fetchCandidateDetail(client, candidateId);
            return { statusCode: 200, headers, body: JSON.stringify(updated) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
    } catch (err) {
        console.error("LAMBDA ERROR:", err);
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    } finally {
        if (client) client.release();
    }
};
