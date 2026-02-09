import pg from "pg";

// CORS設定: 環境変数から許可オリジンを取得
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
    max: 2,
    idleTimeoutMillis: 30000,
});


// ヘルパー関数
const toIntOrNull = (v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
};

const resolveUserId = (...candidates) => {
    for (const v of candidates) {
        const n = toIntOrNull(v);
        if (n !== null) return n;
    }
    return null;
};

const normalizeRole = (v) => String(v || "").trim().toLowerCase();

function httpError(statusCode, message) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

async function assertUserRole(client, userId, expectedRole, label) {
    if (userId === null || userId === undefined) return;
    const res = await client.query("SELECT id, name, role FROM users WHERE id = $1", [userId]);
    if (!res.rows || res.rows.length === 0) {
        throw httpError(400, `${label}のユーザーが存在しません (user_id=${userId})`);
    }
    const actualRole = normalizeRole(res.rows[0].role);
    if (actualRole !== normalizeRole(expectedRole)) {
        throw httpError(
            400,
            `${label}には role=${expectedRole} のユーザーのみ指定できます (user_id=${userId}, role=${actualRole || "-"})`
        );
    }
}

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
        client.query("SELECT id, name, role FROM users ORDER BY name ASC"),
    ]);
    return { clients: clientsRes.rows || [], users: usersRes.rows || [] };
}

// 候補者の「未完了の直近タスク」をcandidatesテーブルに同期する関数
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
            'proposalDate', ca.proposal_date,
            'recommendationDate', ca.recommended_at,
            'firstInterviewDate', ca.first_interview_at,
            'secondInterviewDate', ca.second_interview_at,
            'finalInterviewDate', ca.final_interview_at,
            'offerDate', ca.offer_date,
            'acceptanceDate', ca.offer_accepted_at,
            'onboardingDate', ca.joined_at,
            'preJoinDeclineDate', ca.pre_join_decline_at,
            'preJoinDeclineReason', ca.pre_join_withdraw_reason,
            'postJoinQuitDate', ca.post_join_quit_at,
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

    // 3. タスク履歴(candidate_tasks)の取得
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

    // 4. テレアポログの取得
    const teleapoSql = `
    SELECT
      t.id,
      t.call_no,
      t.called_at,
      t.result,
      t.route,
      t.memo,
      t.caller_user_id,
      u.name AS caller_name
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

    // 5. 売上・返金情報の取得
    const moneySql = `
    SELECT
      ca.id AS application_id,
      ca.client_id,
      cl.name AS company_name,
      COALESCE(ca.joined_at, ca.join_date) AS join_date,
      ca.pre_join_withdraw_date,
      ca.post_join_quit_date,
      p.fee_amount,
      p.order_date,
      p.refund_amount,
      p.withdraw_date,
      p.order_reported,
      p.refund_reported
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

    // 整形
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

        // タスク履歴リスト
        tasks: tasks,

        companyName: b.latest_company_name ?? b.company_name ?? b.apply_company_name ?? "",
        jobName: b.latest_job_name ?? b.job_name ?? b.apply_job_name ?? "",
        validApplication: Boolean(b.is_effective_application),
        advisorUserId: b.advisor_user_id ?? null,
        partnerUserId: b.partner_user_id ?? null,
        // UI側がcsUserIdを期待するケースがあるため明示（DB上は partner_user_id をCSとして利用）
        csUserId: b.partner_user_id ?? null,
        advisorName: b.user_advisor_name ?? b.partner_name ?? b.advisor_name ?? "",
        partnerName: b.user_partner_name ?? b.partner_name ?? "",
        csName: b.cs_name ?? "",
        callerName: b.caller_name ?? "",
        phase,
        phases,
        registeredAt: b.registered_at ?? b.registered_date ?? b.created_at,
        registeredDate: b.registered_date ?? null,

        // その他詳細
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

export const handler = async (event) => {
    const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
    const headers = buildHeaders(event);
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
                    const resolvedAdvisorUserId = resolveUserId(payload.advisorUserId, payload.advisor_user_id);
                    // DB上は partner_user_id をCSとして利用（legacy naming）。
                    const resolvedCsUserId = resolveUserId(
                        payload.partnerUserId,
                        payload.partner_user_id,
                        payload.csUserId,
                        payload.cs_user_id
                    );

                    // Enforce role constraints:
                    // - 担当CS: users.role = caller
                    // - 担当アドバイザー: users.role = advisor
                    await assertUserRole(client, resolvedCsUserId, "caller", "担当CS");
                    await assertUserRole(client, resolvedAdvisorUserId, "advisor", "担当アドバイザー");

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
                    // ★修正: フロントエンドはsnake_caseで送ってくるのでcamelCaseとsnake_caseの両方をサポート
                    const p = [
                        candidateId,
                        typeof payload.validApplication === 'boolean' ? payload.validApplication : (typeof payload.valid_application === 'boolean' ? payload.valid_application : null),
                        resolvedAdvisorUserId,
                        resolvedCsUserId,
                        emptyToNull(payload.scheduleConfirmedAt ?? payload.schedule_confirmed_at),
                        emptyToNull(payload.firstContactPlannedAt ?? payload.first_contact_planned_at),
                        emptyToNull(payload.firstInterviewDate ?? payload.first_interview_date ?? payload.first_contact_at),
                        toBooleanOrNull(payload.attendanceConfirmed ?? payload.attendance_confirmed),
                        emptyToNull(payload.candidateName ?? payload.candidate_name ?? payload.name),
                        emptyToNull(payload.candidateKana ?? payload.candidate_kana ?? payload.name_kana),
                        emptyToNull(payload.gender),
                        emptyToNull(payload.birthDate ?? payload.birth_date ?? payload.birthday),
                        emptyToNull(payload.phone),
                        emptyToNull(payload.email),
                        emptyToNull(payload.postalCode ?? payload.postal_code),
                        emptyToNull(payload.addressPref ?? payload.address_pref),
                        emptyToNull(payload.addressCity ?? payload.address_city),
                        emptyToNull(payload.addressDetail ?? payload.address_detail),
                        emptyToNull(payload.education ?? payload.final_education),
                        emptyToNull(payload.nationality),
                        emptyToNull(payload.japaneseLevel ?? payload.japanese_level),  // ★修正: snake_caseもサポート
                        emptyToNull(payload.mandatoryInterviewItems ?? payload.mandatory_interview_items),
                        emptyToNull(payload.desiredLocation ?? payload.desired_location),
                        emptyToNull(payload.desiredJobType ?? payload.desired_job_type),
                        emptyToNull(payload.currentIncome ?? payload.current_income),
                        emptyToNull(payload.desiredIncome ?? payload.desired_income),
                        emptyToNull(payload.employmentStatus ?? payload.employment_status),
                        emptyToNull(payload.careerReason ?? payload.career_reason),
                        emptyToNull(payload.careerMotivation ?? payload.career_motivation),
                        emptyToNull(payload.transferTiming ?? payload.transfer_timing),
                        emptyToNull(payload.skills),
                        emptyToNull(payload.personality),
                        emptyToNull(payload.workExperience ?? payload.work_experience),
                        emptyToNull(payload.otherSelectionStatus ?? payload.other_selection_status),
                        emptyToNull(payload.firstInterviewNote ?? payload.first_interview_note),
                        emptyToNull(payload.interviewPreferredDate ?? payload.interview_preferred_date)
                    ];
                    await client.query(updateSql, p);

                    // 2. タスク（次回アクション）の登録・完了・削除処理

                    // (A) 新しいタスクの追加
                    const newActionDate = emptyToNull(payload.nextActionDate ?? payload.next_action_date);
                    const newActionNote = emptyToNull(payload.nextActionNote ?? payload.next_action_note);
                    if (newActionDate && newActionNote) {
                        await client.query(`
                INSERT INTO candidate_tasks (candidate_id, action_date, action_note, is_completed, created_at, updated_at)
                VALUES ($1, $2, $3, false, NOW(), NOW())
             `, [candidateId, newActionDate, newActionNote]);
                    }

                    // (B) タスクの完了処理
                    const completeTaskId = toIntOrNull(payload.completeTaskId ?? payload.complete_task_id);
                    if (completeTaskId) {
                        await client.query(`
                UPDATE candidate_tasks 
                SET is_completed = true, completed_at = NOW(), updated_at = NOW()
                WHERE id = $1 AND candidate_id = $2
             `, [completeTaskId, candidateId]);
                    }

                    // (C) タスクの削除処理
                    const deleteTaskId = toIntOrNull(payload.deleteTaskId ?? payload.delete_task_id);
                    if (deleteTaskId) {
                        await client.query(`
                            DELETE FROM candidate_tasks
                            WHERE id = $1 AND candidate_id = $2
                        `, [deleteTaskId, candidateId]);
                    }

                    // (D) candidatesテーブルの同期 (未完了の直近タスクを本体に反映)
                    await syncNextActionDate(client, candidateId);

                    // 3. その他の付随処理 (着座ログ)
                    if (toBooleanOrNull(payload.attendanceConfirmed ?? payload.attendance_confirmed) === true) {
                        const teleRes = await client.query(`SELECT id FROM teleapo WHERE candidate_id=$1 AND result LIKE '%設定%' ORDER BY called_at DESC LIMIT 1`, [candidateId]);
                        if (teleRes.rows.length > 0) await client.query("UPDATE teleapo SET result='着座' WHERE id=$1", [teleRes.rows[0].id]);
                    }

                    // 4. ★修正: 選考進捗の処理（削除ロジック追加）
                    const selectionPayload = Array.isArray(payload.selectionProgress) ? payload.selectionProgress : (Array.isArray(payload.selection_progress) ? payload.selection_progress : null);

                    // ★追加: 選考進捗の削除処理
                    // 明示的に配列が送られてきた場合、送られてきたIDに含まれていないレコードを削除
                    if (selectionPayload !== null) {
                        const keepIds = selectionPayload
                            .map(entry => toIntOrNull(entry.id))
                            .filter(id => id !== null);

                        if (keepIds.length === 0) {
                            // 空の配列が送られてきた場合は全て削除
                            await client.query(
                                `DELETE FROM candidate_applications WHERE candidate_id = $1`,
                                [candidateId]
                            );
                            console.log(`[candidates-detail] Deleted all applications for candidate ${candidateId}`);
                        } else {
                            // 送られてきたID以外を削除
                            const deleteRes = await client.query(
                                `DELETE FROM candidate_applications WHERE candidate_id = $1 AND id != ALL($2::int[])`,
                                [candidateId, keepIds]
                            );
                            if (deleteRes.rowCount > 0) {
                                console.log(`[candidates-detail] Deleted ${deleteRes.rowCount} applications not in [${keepIds.join(",")}] for candidate ${candidateId}`);
                            }
                        }
                    }

                    // 既存のUPDATE/INSERT処理
                    if (selectionPayload) {
                        for (const entry of selectionPayload) {
                            if (!entry.clientId && !entry.client_id && !entry.id) continue;
                            const s_id = toIntOrNull(entry.id);
                            const s_clientId = toIntOrNull(entry.clientId ?? entry.client_id);
                            const s_stage = entry.stageCurrent || entry.stage_current || entry.status || "";
                            const s_jobTitle = entry.jobTitle || entry.job_title || "";
                            const s_route = entry.route || entry.applyRoute || entry.apply_route || "";

                            const s_proposalDate = emptyToNull(entry.proposalDate ?? entry.proposal_date);
                            const s_recommendedAt = emptyToNull(entry.recommendedAt ?? entry.recommended_at ?? entry.recommendationDate);
                            const s_firstInterviewSetAt = emptyToNull(entry.firstInterviewSetAt ?? entry.first_interview_set_at ?? entry.firstInterviewAdjustDate ?? entry.interviewSetupDate);
                            const s_firstInterviewAt = emptyToNull(entry.firstInterviewAt ?? entry.first_interview_at ?? entry.firstInterviewDate ?? entry.interviewDate);
                            const s_secondInterviewSetAt = emptyToNull(entry.secondInterviewSetAt ?? entry.second_interview_set_at ?? entry.secondInterviewAdjustDate ?? entry.secondInterviewSetupDate);
                            const s_secondInterviewAt = emptyToNull(entry.secondInterviewAt ?? entry.second_interview_at ?? entry.secondInterviewDate);
                            const s_finalInterviewSetAt = emptyToNull(entry.finalInterviewSetAt ?? entry.final_interview_set_at ?? entry.finalInterviewAdjustDate);
                            const s_finalInterviewAt = emptyToNull(entry.finalInterviewAt ?? entry.final_interview_at ?? entry.finalInterviewDate);
                            const s_offerDate = emptyToNull(entry.offerDate ?? entry.offer_date ?? entry.offerAt ?? entry.offer_at);
                            const s_offerAcceptDate = emptyToNull(entry.offerAcceptDate ?? entry.offer_accept_date ?? entry.offerAcceptedDate ?? entry.offer_accepted_at ?? entry.acceptanceDate);
                            const s_joinDate = emptyToNull(entry.joinDate ?? entry.join_date ?? entry.joinedAt ?? entry.joined_at ?? entry.onboardingDate);
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
                                await client.query(`
                                    UPDATE candidate_applications SET 
                                        client_id = $2,
                                        stage_current = $3,
                                        job_title = $4,
                                        apply_route = $5,
                                        proposal_date = COALESCE($6, proposal_date),
                                        recommended_at = COALESCE($7, recommended_at),
                                        first_interview_set_at = COALESCE($8, first_interview_set_at),
                                        first_interview_at = COALESCE($9, first_interview_at),
                                        second_interview_set_at = COALESCE($10, second_interview_set_at),
                                        second_interview_at = COALESCE($11, second_interview_at),
                                        final_interview_set_at = COALESCE($12, final_interview_set_at),
                                        final_interview_at = COALESCE($13, final_interview_at),
                                        offer_date = COALESCE($14, offer_date),
                                        offer_at = COALESCE($15, offer_at),
                                        offer_accepted_at = COALESCE($16, offer_accepted_at),
                                        joined_at = COALESCE($18, joined_at),
                                        pre_join_decline_at = COALESCE($20, pre_join_decline_at),
                                        pre_join_withdraw_reason = COALESCE($21, pre_join_withdraw_reason),
                                        post_join_quit_at = COALESCE($22, post_join_quit_at),
                                        post_join_quit_reason = COALESCE($23, post_join_quit_reason),
                                        declined_after_offer_at = COALESCE($24, declined_after_offer_at),
                                        declined_after_offer_reason = COALESCE($25, declined_after_offer_reason),
                                        early_turnover_at = COALESCE($26, early_turnover_at),
                                        early_turnover_reason = COALESCE($27, early_turnover_reason),
                                        close_expected_at = COALESCE($28, close_expected_at),
                                        closing_forecast_at = COALESCE($29, closing_forecast_at),
                                        selection_note = COALESCE($30, selection_note),
                                        fee = COALESCE($31, fee),
                                        updated_at = NOW() 
                                    WHERE id = $1 AND candidate_id = $32
                                `, [
                                    s_id, s_clientId, s_stage, s_jobTitle, s_route,
                                    s_proposalDate, s_recommendedAt, s_firstInterviewSetAt, s_firstInterviewAt,
                                    s_secondInterviewSetAt, s_secondInterviewAt,
                                    s_finalInterviewSetAt, s_finalInterviewAt,
                                    s_offerDate, s_offerDate,
                                    s_offerAcceptDate, s_offerAcceptDate,
                                    s_joinDate, s_joinDate,
                                    s_preJoinWithdrawDate, s_preJoinWithdrawReason,
                                    s_postJoinQuitDate, s_postJoinQuitReason,
                                    s_declinedAfterOfferAt, s_declinedAfterOfferReason,
                                    s_earlyTurnoverAt, s_earlyTurnoverReason,
                                    s_closeExpectedAt, s_closeExpectedAt,
                                    s_selectionNote, s_fee,
                                    candidateId
                                ]);
                            } else if (s_clientId) {
                                await client.query(`
                                    INSERT INTO candidate_applications (
                                        candidate_id, client_id, stage_current, job_title, apply_route,
                                        proposal_date, recommended_at, first_interview_set_at, first_interview_at,
                                        second_interview_set_at, second_interview_at,
                                        final_interview_set_at, final_interview_at,
                                        offer_date, offer_at, offer_accepted_at, joined_at,
                                        pre_join_decline_at, pre_join_withdraw_reason,
                                        post_join_quit_at, post_join_quit_reason,
                                        declined_after_offer_at, declined_after_offer_reason,
                                        early_turnover_at, early_turnover_reason,
                                        close_expected_at, closing_forecast_at, selection_note, fee,
                                        created_at, updated_at
                                    ) VALUES (
                                        $1, $2, $3, $4, $5,
                                        $6, $7, $8, $9, $10,
                                        $11, $12, $13,
                                        $14, $15, $16, $18,
                                        $20, $21, $22, $23,
                                        $24, $25, $26, $27,
                                        $28, $29, $30, $31,
                                        NOW(), NOW()
                                    )
                                `, [
                                    candidateId, s_clientId, s_stage, s_jobTitle, s_route,
                                    s_proposalDate, s_recommendedAt, s_firstInterviewSetAt, s_firstInterviewAt,
                                    s_secondInterviewSetAt, s_secondInterviewAt,
                                    s_finalInterviewSetAt, s_finalInterviewAt,
                                    s_offerDate, s_offerDate,
                                    s_offerAcceptDate, s_offerAcceptDate,
                                    s_joinDate, s_joinDate,
                                    s_preJoinWithdrawDate, s_preJoinWithdrawReason,
                                    s_postJoinQuitDate, s_postJoinQuitReason,
                                    s_declinedAfterOfferAt, s_declinedAfterOfferReason,
                                    s_earlyTurnoverAt, s_earlyTurnoverReason,
                                    s_closeExpectedAt, s_closeExpectedAt,
                                    s_selectionNote, s_fee
                                ]);
                            }
                        }
                    }

                    // 5. 売上・返金情報の更新
                    const moneyPayload = Array.isArray(payload.moneyInfo)
                        ? payload.moneyInfo
                        : (Array.isArray(payload.money_info) ? payload.money_info : null);
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
                            const hasPlacementValues = (
                                feeAmount !== null ||
                                refundAmount !== null ||
                                orderDate !== null ||
                                withdrawDate !== null ||
                                orderReported !== null ||
                                refundReported !== null
                            );

                            const placementRes = await client.query(
                                "SELECT id FROM placements WHERE candidate_application_id = $1 LIMIT 1",
                                [applicationId]
                            );
                            if (placementRes.rows.length > 0) {
                                await client.query(`
                                    UPDATE placements SET
                                        fee_amount = COALESCE($2, fee_amount),
                                        refund_amount = COALESCE($3, refund_amount),
                                        order_date = COALESCE($4, order_date),
                                        withdraw_date = COALESCE($5, withdraw_date),
                                        order_reported = COALESCE($6, order_reported),
                                        refund_reported = COALESCE($7, refund_reported),
                                        updated_at = NOW()
                                    WHERE candidate_application_id = $1
                                `, [applicationId, feeAmount, refundAmount, orderDate, withdrawDate, orderReported, refundReported]);
                            } else if (hasPlacementValues) {
                                await client.query(`
                                    INSERT INTO placements (
                                        candidate_application_id, fee_amount, refund_amount, order_date, withdraw_date, order_reported, refund_reported, created_at, updated_at
                                    ) VALUES ($1, $2, $3, $4, $5, COALESCE($6, false), COALESCE($7, false), NOW(), NOW())
                                `, [applicationId, feeAmount, refundAmount, orderDate, withdrawDate, orderReported, refundReported]);
                            }

                            const hasPreJoin = Object.prototype.hasOwnProperty.call(entry, "preJoinWithdrawDate")
                                || Object.prototype.hasOwnProperty.call(entry, "pre_join_withdraw_date");
                            const hasPostJoin = Object.prototype.hasOwnProperty.call(entry, "postJoinQuitDate")
                                || Object.prototype.hasOwnProperty.call(entry, "post_join_quit_date");
                            const refundTypeRaw = entry.refundType ?? entry.refund_type;
                            const hasRefundType = refundTypeRaw !== undefined && refundTypeRaw !== null && `${refundTypeRaw}` !== "";

                            let preJoinWithdrawDate = hasPreJoin
                                ? emptyToNull(entry.preJoinWithdrawDate ?? entry.pre_join_withdraw_date)
                                : undefined;
                            let postJoinQuitDate = hasPostJoin
                                ? emptyToNull(entry.postJoinQuitDate ?? entry.post_join_quit_date)
                                : undefined;

                            if (hasRefundType) {
                                const refundType = String(refundTypeRaw);
                                const retirementDate = emptyToNull(
                                    entry.retirementDate ?? entry.retirement_date ?? entry.retireDate ?? entry.retire_date
                                );
                                if (refundType.includes("内定")) {
                                    preJoinWithdrawDate = retirementDate;
                                    postJoinQuitDate = null;
                                } else if (refundType.includes("入社")) {
                                    postJoinQuitDate = retirementDate;
                                    preJoinWithdrawDate = null;
                                }
                            }

                            if (preJoinWithdrawDate !== undefined || postJoinQuitDate !== undefined) {
                                const updateFields = [];
                                const updateValues = [];
                                let idx = 1;
                                if (preJoinWithdrawDate !== undefined) {
                                    updateFields.push(`pre_join_withdraw_date = $${idx++}`);
                                    updateValues.push(preJoinWithdrawDate);
                                }
                                if (postJoinQuitDate !== undefined) {
                                    updateFields.push(`post_join_quit_date = $${idx++}`);
                                    updateValues.push(postJoinQuitDate);
                                }
                                updateFields.push("updated_at = NOW()");
                                updateValues.push(applicationId, candidateId);

                                await client.query(`
                                    UPDATE candidate_applications
                                    SET ${updateFields.join(", ")}
                                    WHERE id = $${idx++} AND candidate_id = $${idx}
                                `, updateValues);
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
        const statusCode = Number.isFinite(err?.statusCode) ? err.statusCode : 500;
        return { statusCode, headers, body: JSON.stringify({ error: err?.message || String(err) }) };
    } finally {
        if (client) client.release();
    }
};
