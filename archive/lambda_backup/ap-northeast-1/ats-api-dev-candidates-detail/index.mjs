import pg from "pg";
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

const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": (process.env.CORS_ORIGIN || "*").trim(),
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,authorization",
};

// ヘルパー関数
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
        client.query("SELECT id, name FROM users ORDER BY name ASC"),
    ]);
    return { clients: clientsRes.rows || [], users: usersRes.rows || [] };
}

// 候補者の「未完了の直近タスク」をcandidatesテーブルに同期する関数
// (一覧画面でのソートなどを高速化するため)
async function syncNextActionDate(client, candidateId) {
    await client.query(`
    UPDATE candidates
    SET 
      next_action_date = (
        SELECT action_date 
        FROM candidate_tasks 
        WHERE candidate_id = $1 AND is_completed = false 
        ORDER BY action_date ASC LIMIT 1
      ),
      next_action_note = (
        SELECT action_note 
        FROM candidate_tasks 
        WHERE candidate_id = $1 AND is_completed = false 
        ORDER BY action_date ASC LIMIT 1
      )
    WHERE id = $1
  `, [candidateId]);
}

async function fetchCandidateDetail(client, candidateId, includeMaster = false) {
    // 1. 基本情報取得
    const baseSql = `
    SELECT
      c.*,
      u_ad.name AS advisor_name,
      u_pt.name AS partner_name,
      ca_latest.apply_route AS source,
      ca_stage.stage_list,
      ca_latest.client_name AS company_name,
      ca_latest.job_title AS job_name,
      ca_latest.stage_current AS stage_current,
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

    // 2. 選考進捗リスト取得
    const selectionSql = `
    SELECT COALESCE(json_agg(json_build_object(
            'id', ca.id, 
            'clientId', ca.client_id, 
            'companyName', cl.name, 
            'stageCurrent', ca.stage_current, 
            'jobTitle', ca.job_title, 
            'route', ca.apply_route, 
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

          ) ORDER BY COALESCE(ca.updated_at, ca.created_at) DESC), '[]'::json) AS selection_progress
    FROM candidate_applications ca
    LEFT JOIN clients cl ON cl.id = ca.client_id
    WHERE ca.candidate_id = $1
  `;
    const selectionRes = await client.query(selectionSql, [candidateId]);
    const selectionProgress = selectionRes.rows[0]?.selection_progress || [];

    // 3. ★追加: タスク履歴(candidate_tasks)の取得
    const tasksSql = `
    SELECT 
      id, action_date, action_note, is_completed, completed_at, created_at
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

    // 整形
    const address = [b.address_pref, b.address_city, b.address_detail].filter(Boolean).join("");
    let phase = "未接触";
    const phases = b.stage_list || [];
    if (phases.length > 0) phase = phases.join(" / ");
    else {
        if (b.has_connected) phase = "通電";
        else if (b.has_sms) phase = "SMS送信";
        else if ((b.max_call_no || 0) > 0) phase = "架電中";
    }

    const computedAge = calculateAge(b.birth_date);
    const detail = {
        id: String(b.id),
        candidateName: b.name ?? "",
        candidateKana: b.name_kana ?? "",
        phone: b.phone ?? "",
        email: b.email ?? "",
        birthday: b.birth_date ?? null,
        age: computedAge ?? b.age ?? null,
        gender: b.gender ?? "",
        postalCode: b.postal_code ?? "",
        addressPref: b.address_pref ?? "",
        addressCity: b.address_city ?? "",
        addressDetail: b.address_detail ?? "",
        address,
        education: b.final_education ?? "",
        nationality: b.nationality ?? "",
        japaneseLevel: b.japanese_level ?? "",

        // DB上のキャッシュ値（直近の未完了タスク）
        nextActionDate: b.next_action_date ?? null,
        nextActionNote: b.next_action_note ?? "",

        // ★追加: タスク履歴リスト
        tasks: tasks,

        companyName: b.company_name ?? "",
        jobName: b.job_name ?? "",
        validApplication: Boolean(b.is_effective_application),
        advisorUserId: b.advisor_user_id ?? null,
        partnerUserId: b.partner_user_id ?? null,
        advisorName: b.advisor_name ?? "",
        partnerName: b.partner_name ?? "",
        callerName: b.caller_name ?? "",
        phase,
        phases,
        registeredAt: b.created_at,

        // その他詳細（省略せずそのまま返す）
        source: b.apply_route_text ?? "",
        contactPreferredTime: b.contact_preferred_time ?? "",
        applyCompanyName: b.apply_company_name ?? "",
        applyJobName: b.apply_job_name ?? "",
        applyRouteText: b.apply_route_text ?? "",
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

export const handler = async (event) => {
    const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
    if (method === "OPTIONS") return { statusCode: 204, headers, body: "" };

    const pathId = event?.pathParameters?.id || event?.pathParameters?.candidateId;
    const candidateId = toIntOrNull(pathId);

    if (!candidateId || candidateId <= 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid ID" }) };
    }

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
            const rawBody = event?.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : (event.body || "");
            const payload = JSON.parse(rawBody || "{}");
            const detailMode = Boolean(payload.detailMode ?? payload.detail_mode);

            await client.query("BEGIN");

            try {
                if (detailMode) {
                    // 1. 候補者本体の更新 (既存ロジック)
                    const updateSql = `
            UPDATE candidates SET
              updated_at = NOW(),
              is_effective_application = COALESCE($2, is_effective_application),
              advisor_user_id = COALESCE($3, advisor_user_id),
              partner_user_id = COALESCE($4, partner_user_id),
              first_schedule_fixed_at = COALESCE($5, first_schedule_fixed_at),
              first_contact_planned_at = COALESCE($6, first_contact_planned_at),
              first_contact_at = COALESCE($7, first_contact_at),
              first_interview_attended = COALESCE($8, first_interview_attended),
              name = COALESCE($9, name),
              name_kana = COALESCE($10, name_kana),
              gender = COALESCE($11, gender),
              birth_date = COALESCE($12, birth_date),
              phone = COALESCE($13, phone),
              email = COALESCE($14, email),
              postal_code = COALESCE($15, postal_code),
              address_pref = COALESCE($16, address_pref),
              address_city = COALESCE($17, address_city),
              address_detail = COALESCE($18, address_detail),
              final_education = COALESCE($19, final_education),
              nationality = COALESCE($20, nationality),
              japanese_level = COALESCE($21, japanese_level),
              mandatory_interview_items = COALESCE($22, mandatory_interview_items),
              desired_location = COALESCE($23, desired_location),
              desired_job_type = COALESCE($24, desired_job_type),
              current_income = COALESCE($25, current_income),
              desired_income = COALESCE($26, desired_income),
              employment_status = COALESCE($27, employment_status),
              career_reason = COALESCE($28, career_reason),
              career_motivation = COALESCE($29, career_motivation),
              transfer_timing = COALESCE($30, transfer_timing),
              skills = COALESCE($31, skills),
              personality = COALESCE($32, personality),
              work_experience = COALESCE($33, work_experience),
              other_selection_status = COALESCE($34, other_selection_status),
              first_interview_note = COALESCE($35, first_interview_note),
              interview_preferred_date = COALESCE($36, interview_preferred_date)
            WHERE id = $1
          `;
                    const p = [
                        candidateId,
                        typeof payload.validApplication === 'boolean' ? payload.validApplication : null,
                        toIntOrNull(payload.advisorUserId), toIntOrNull(payload.partnerUserId),
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

                    // 2. ★追加: タスク（次回アクション）の登録・完了処理

                    // (A) 新しいタスクの追加 (日付と内容が送られてきた場合)
                    const newActionDate = emptyToNull(payload.nextActionDate);
                    const newActionNote = emptyToNull(payload.nextActionNote);
                    if (newActionDate && newActionNote) {
                        await client.query(`
                INSERT INTO candidate_tasks (candidate_id, action_date, action_note, is_completed, created_at, updated_at)
                VALUES ($1, $2, $3, false, NOW(), NOW())
             `, [candidateId, newActionDate, newActionNote]);
                    }

                    // (B) タスクの完了処理 (完了するタスクIDが送られてきた場合)
                    const completeTaskId = toIntOrNull(payload.completeTaskId);
                    if (completeTaskId) {
                        await client.query(`
                UPDATE candidate_tasks 
                SET is_completed = true, completed_at = NOW(), updated_at = NOW()
                WHERE id = $1 AND candidate_id = $2
             `, [completeTaskId, candidateId]);
                    }

                    // (B-2) タスクの削除処理 (削除するタスクIDが送られてきた場合) ★追加
                    const deleteTaskId = toIntOrNull(payload.deleteTaskId);
                    if (deleteTaskId) {
                        await client.query(`
                DELETE FROM candidate_tasks 
                WHERE id = $1 AND candidate_id = $2
             `, [deleteTaskId, candidateId]);
                    }

                    // (C) candidatesテーブルの同期 (未完了の直近タスクを本体に反映)
                    await syncNextActionDate(client, candidateId);

                    // 3. その他の付随処理 (着座ログ、選考進捗など)
                    if (toBooleanOrNull(payload.attendanceConfirmed) === true) {
                        const teleRes = await client.query(`SELECT id FROM teleapo WHERE candidate_id=$1 AND result LIKE '%設定%' ORDER BY called_at DESC LIMIT 1`, [candidateId]);
                        if (teleRes.rows.length > 0) await client.query("UPDATE teleapo SET result='着座' WHERE id=$1", [teleRes.rows[0].id]);
                    }

                    const selectionPayload = Array.isArray(payload.selectionProgress) ? payload.selectionProgress : (Array.isArray(payload.selection_progress) ? payload.selection_progress : null);
                    if (selectionPayload) {
                        for (const entry of selectionPayload) {
                            if (!entry.clientId && !entry.client_id && !entry.id) continue;
                            const s_id = toIntOrNull(entry.id);
                            const s_clientId = toIntOrNull(entry.clientId ?? entry.client_id);
                            const s_stage = entry.stageCurrent || entry.stage_current || entry.status || "";
                            const s_jobTitle = entry.jobTitle || entry.job_title || "";
                            const s_route = entry.route || entry.applyRoute || entry.apply_route || "";

                            // すべての日付フィールドを取得
                            const s_recommendedAt = emptyToNull(entry.recommendedAt ?? entry.recommended_at ?? entry.recommendationDate);
                            const s_firstInterviewSetAt = emptyToNull(entry.firstInterviewSetAt ?? entry.first_interview_set_at ?? entry.firstInterviewAdjustDate ?? entry.interviewSetupDate);
                            const s_firstInterviewAt = emptyToNull(entry.firstInterviewAt ?? entry.first_interview_at ?? entry.firstInterviewDate ?? entry.interviewDate);
                            const s_secondInterviewSetAt = emptyToNull(entry.secondInterviewSetAt ?? entry.second_interview_set_at ?? entry.secondInterviewAdjustDate ?? entry.secondInterviewSetupDate);
                            const s_secondInterviewAt = emptyToNull(entry.secondInterviewAt ?? entry.second_interview_at ?? entry.secondInterviewDate);
                            const s_finalInterviewSetAt = emptyToNull(entry.finalInterviewSetAt ?? entry.final_interview_set_at ?? entry.finalInterviewAdjustDate);
                            const s_finalInterviewAt = emptyToNull(entry.finalInterviewAt ?? entry.final_interview_at ?? entry.finalInterviewDate);
                            const s_offerAt = emptyToNull(entry.offerAt ?? entry.offer_at ?? entry.offerDate ?? entry.offer_date);
                            const s_offerAcceptedAt = emptyToNull(entry.offerAcceptedAt ?? entry.offer_accepted_at ?? entry.offerAcceptDate ?? entry.offer_accept_date ?? entry.acceptanceDate);
                            const s_joinedAt = emptyToNull(entry.joinedAt ?? entry.joined_at ?? entry.joinDate ?? entry.join_date ?? entry.onboardingDate);
                            const s_preJoinWithdrawDate = emptyToNull(entry.preJoinWithdrawDate ?? entry.pre_join_withdraw_date ?? entry.preJoinDeclineDate);
                            const s_preJoinWithdrawReason = emptyToNull(entry.preJoinWithdrawReason ?? entry.pre_join_withdraw_reason ?? entry.preJoinDeclineReason);
                            const s_postJoinQuitDate = emptyToNull(entry.postJoinQuitDate ?? entry.post_join_quit_date);
                            const s_postJoinQuitReason = emptyToNull(entry.postJoinQuitReason ?? entry.post_join_quit_reason);
                            const s_declinedAfterOfferAt = emptyToNull(entry.declinedAfterOfferAt ?? entry.declined_after_offer_at);
                            const s_declinedAfterOfferReason = emptyToNull(entry.declinedAfterOfferReason ?? entry.declined_after_offer_reason);
                            const s_earlyTurnoverAt = emptyToNull(entry.earlyTurnoverAt ?? entry.early_turnover_at);
                            const s_earlyTurnoverReason = emptyToNull(entry.earlyTurnoverReason ?? entry.early_turnover_reason);
                            const s_closeExpectedAt = emptyToNull(entry.closeExpectedAt ?? entry.close_expected_at ?? entry.closeExpectedDate ?? entry.closingForecastAt ?? entry.closing_forecast_at);
                            const s_selectionNote = emptyToNull(entry.selectionNote ?? entry.selection_note);
                            const s_fee = toIntOrNull(entry.fee ?? entry.feeAmount ?? entry.fee_amount);

                            if (s_id) {
                                // UPDATE: 既存レコードの更新
                                await client.query(`
                                    UPDATE candidate_applications SET 
                                        client_id = $2,
                                        stage_current = $3,
                                        job_title = $4,
                                        apply_route = $5,
                                        recommended_at = COALESCE($6, recommended_at),
                                        first_interview_set_at = COALESCE($7, first_interview_set_at),
                                        first_interview_at = COALESCE($8, first_interview_at),
                                        second_interview_set_at = COALESCE($9, second_interview_set_at),
                                        second_interview_at = COALESCE($10, second_interview_at),
                                        final_interview_set_at = COALESCE($11, final_interview_set_at),
                                        final_interview_at = COALESCE($12, final_interview_at),
                                        offer_at = COALESCE($13, offer_at),
                                        offer_accepted_at = COALESCE($14, offer_accepted_at),
                                        joined_at = COALESCE($15, joined_at),
                                        pre_join_withdraw_date = COALESCE($16, pre_join_withdraw_date),
                                        pre_join_withdraw_reason = COALESCE($17, pre_join_withdraw_reason),
                                        post_join_quit_date = COALESCE($18, post_join_quit_date),
                                        post_join_quit_reason = COALESCE($19, post_join_quit_reason),
                                        declined_after_offer_at = COALESCE($20, declined_after_offer_at),
                                        declined_after_offer_reason = COALESCE($21, declined_after_offer_reason),
                                        early_turnover_at = COALESCE($22, early_turnover_at),
                                        early_turnover_reason = COALESCE($23, early_turnover_reason),
                                        closing_forecast_at = COALESCE($24, closing_forecast_at),
                                        selection_note = COALESCE($25, selection_note),
                                        fee = COALESCE($26, fee),
                                        updated_at = NOW() 
                                    WHERE id = $1 AND candidate_id = $27
                                `, [
                                    s_id, s_clientId, s_stage, s_jobTitle, s_route,
                                    s_recommendedAt, s_firstInterviewSetAt, s_firstInterviewAt,
                                    s_secondInterviewSetAt, s_secondInterviewAt,
                                    s_finalInterviewSetAt, s_finalInterviewAt,
                                    s_offerAt, s_offerAcceptedAt, s_joinedAt,
                                    s_preJoinWithdrawDate, s_preJoinWithdrawReason,
                                    s_postJoinQuitDate, s_postJoinQuitReason,
                                    s_declinedAfterOfferAt, s_declinedAfterOfferReason,
                                    s_earlyTurnoverAt, s_earlyTurnoverReason,
                                    s_closeExpectedAt, s_selectionNote, s_fee,
                                    candidateId
                                ]);
                            } else if (s_clientId) {
                                // INSERT: 新規レコードの作成
                                await client.query(`
                                    INSERT INTO candidate_applications (
                                        candidate_id, client_id, stage_current, job_title, apply_route,
                                        recommended_at, first_interview_set_at, first_interview_at,
                                        second_interview_set_at, second_interview_at,
                                        final_interview_set_at, final_interview_at,
                                        offer_at, offer_accepted_at, joined_at,
                                        pre_join_withdraw_date, pre_join_withdraw_reason,
                                        post_join_quit_date, post_join_quit_reason,
                                        declined_after_offer_at, declined_after_offer_reason,
                                        early_turnover_at, early_turnover_reason,
                                        closing_forecast_at, selection_note, fee,
                                        created_at, updated_at
                                    ) VALUES (
                                        $1, $2, $3, $4, $5,
                                        $6, $7, $8, $9, $10,
                                        $11, $12, $13, $14, $15,
                                        $16, $17, $18, $19, $20,
                                        $21, $22, $23, $24, $25, $26,
                                        NOW(), NOW()
                                    )
                                `, [
                                    candidateId, s_clientId, s_stage, s_jobTitle, s_route,
                                    s_recommendedAt, s_firstInterviewSetAt, s_firstInterviewAt,
                                    s_secondInterviewSetAt, s_secondInterviewAt,
                                    s_finalInterviewSetAt, s_finalInterviewAt,
                                    s_offerAt, s_offerAcceptedAt, s_joinedAt,
                                    s_preJoinWithdrawDate, s_preJoinWithdrawReason,
                                    s_postJoinQuitDate, s_postJoinQuitReason,
                                    s_declinedAfterOfferAt, s_declinedAfterOfferReason,
                                    s_earlyTurnoverAt, s_earlyTurnoverReason,
                                    s_closeExpectedAt, s_selectionNote, s_fee
                                ]);
                            }
                        }
                    }

                } else if (typeof payload.validApplication === "boolean") {
                    await client.query("UPDATE candidates SET is_effective_application = $2 WHERE id = $1", [candidateId, payload.validApplication]);
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
