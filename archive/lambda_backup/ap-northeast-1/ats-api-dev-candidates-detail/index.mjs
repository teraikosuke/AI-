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

    const age = calculateAge(candidate.birth_date ?? candidate.birthDate ?? candidate.birthday) ?? parseAgeNumber(candidate.age);
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

async function syncCandidateValidApplication(client, candidateId, screeningRules) {
    const res = await client.query(
        `SELECT id, birth_date, age, nationality, japanese_level, is_effective_application
           FROM candidates
          WHERE id = $1`,
        [candidateId]
    );
    if (!res.rows?.length) return null;
    const row = res.rows[0];
    const computed = computeValidApplication(row, screeningRules);
    if (computed === true || computed === false) {
        if (row.is_effective_application !== computed) {
            await client.query("UPDATE candidates SET is_effective_application = $2, updated_at = NOW() WHERE id = $1", [
                candidateId,
                computed,
            ]);
        }
        return computed;
    }
    return toBooleanOrNull(row.is_effective_application);
}

async function fetchMasters(client) {
    const [clientsRes, usersRes, csUsersRes, advisorUsersRes] = await Promise.all([
        client.query("SELECT id, name FROM clients ORDER BY name ASC"),
        client.query("SELECT id, name FROM users ORDER BY name ASC"),
        client.query("SELECT id, name, role FROM users WHERE role = 'caller' ORDER BY name ASC"),
        client.query("SELECT id, name, role FROM users WHERE role = 'advisor' ORDER BY name ASC"),
    ]);
    return {
        clients: clientsRes.rows || [],
        users: usersRes.rows || [],
        csUsers: csUsersRes.rows || [],
        advisorUsers: advisorUsersRes.rows || []
    };
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

async function fetchCandidateDetail(client, candidateId, includeMaster = false, validApplicationOverride = undefined) {
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
      u_call.name AS caller_name,
      t_last.result AS teleapo_result
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
      WHERE t.candidate_id = c.id ORDER BY t.called_at DESC LIMIT 1
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
            'offerAcceptedDate', COALESCE(ca.offer_accepted_at, ca.offer_accept_date),
            'joinedDate', COALESCE(ca.joined_at, ca.join_date),
            'closingForecastDate', COALESCE(ca.closing_forecast_at, ca.close_expected_at),

            'declinedDate', ca.pre_join_withdraw_date,
            'declinedReason', ca.pre_join_withdraw_reason,
            'earlyTurnoverDate', ca.post_join_quit_date,
            'earlyTurnoverReason', ca.post_join_quit_reason,
            'note', ca.selection_note,
            'fee', ca.fee,
            'feeAmount', ca.fee_amount,
            'refundAmount', ca.refund_amount,
            'orderReported', ca.order_reported,
            'refundReported', ca.refund_reported

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

    // 4. ★追加: テレアポログ(teleapo)の取得
    const teleapoSql = `
    SELECT 
      t.id, t.call_no, t.caller_user_id, t.result, t.memo, t.called_at, t.created_at,
      u.name as caller_name
    FROM teleapo t
    LEFT JOIN users u ON u.id = t.caller_user_id
    WHERE t.candidate_id = $1
    ORDER BY t.called_at DESC
  `;
    const teleapoRes = await client.query(teleapoSql, [candidateId]);
    const teleapoLogs = teleapoRes.rows.map(row => ({
        id: String(row.id),
        callNo: row.call_no,
        callerUserId: row.caller_user_id,
        callerName: row.caller_name || "",
        result: row.result,
        memo: row.memo,
        calledAt: row.called_at,
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
    const resolvedValidApplication =
        validApplicationOverride === true || validApplicationOverride === false
            ? validApplicationOverride
            : toBooleanOrNull(b.is_effective_application);

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
        // ★追加: テレアポログリスト
        teleapoLogs: teleapoLogs,

        companyName: b.company_name ?? "",
        jobName: b.job_name ?? "",
        validApplication: resolvedValidApplication,
        is_effective_application: resolvedValidApplication,
        isEffective: resolvedValidApplication,
        advisorUserId: b.advisor_user_id ?? null,
        partnerUserId: b.partner_user_id ?? null,
        advisorName: b.advisor_name ?? "",
        partnerName: b.partner_name ?? "",
        callerName: b.caller_name ?? "",
        phase,
        phases,
        registeredAt: b.created_at,

        // その他詳細（省略せずそのまま返す）
        source: b.source ?? "",
        contactPreferredTime: b.contact_preferred_time ?? "",
        applyCompanyName: b.company_name ?? "",  // 最新の応募情報から取得
        applyJobName: b.apply_job_name ?? "",  // candidatesテーブルから取得
        applyRouteText: b.source ?? "",  // apply_routeとして取得済み
        applicationNote: b.remarks ?? "",  // remarksカラムを使用
        jobChangeAxis: b.career_motivation ?? "",  // 転職軸
        careerMotivation: b.career_motivation ?? "",  // 後方互換性
        futureVision: b.future_vision ?? "",  // 将来のビジョン
        currentIncome: b.current_income ?? null,
        desiredIncome: b.desired_income ?? null,
        employmentStatus: b.employment_status ?? "",
        mandatoryInterviewItems: b.mandatory_interview_items ?? "",
        desiredJobType: b.desired_job_type ?? "",
        careerMotivation: b.career_motivation ?? "",
        recommendationText: b.recommendation_text ?? "",
        careerReason: b.career_reason ?? "",
        transferTiming: b.transfer_timing ?? "",
        jobChangeTiming: b.transfer_timing ?? "",  // 後方互換性
        firstInterviewNote: b.first_interview_note ?? "",
        otherSelectionStatus: b.other_selection_status ?? "",
        interviewPreferredDate: b.interview_preferred_date ?? "",
        desiredInterviewDates: b.interview_preferred_date ?? "",  // 後方互換性
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
        teleapoResult: b.teleapo_result ?? "",
    };

    if (includeMaster) {
        detail.masters = await fetchMasters(client);
    }
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
            const screeningRules = await loadScreeningRules(client);
            const resolvedValidApplication = await syncCandidateValidApplication(client, candidateId, screeningRules);
            const data = await fetchCandidateDetail(client, candidateId, includeMaster, resolvedValidApplication);
            if (!data) return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };
            return { statusCode: 200, headers, body: JSON.stringify(data) };
        }

        if (method === "PUT") {
            const rawBody = event?.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : (event.body || "");
            const payload = JSON.parse(rawBody || "{}");
            const detailMode = Boolean(payload.detailMode ?? payload.detail_mode);
            let resolvedValidApplication = null;

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
              interview_preferred_date = COALESCE($36, interview_preferred_date),
              contact_preferred_time = COALESCE($37, contact_preferred_time),
              remarks = COALESCE($38, remarks),
              apply_job_name = COALESCE($39, apply_job_name),
              future_vision = COALESCE($40, future_vision)
            WHERE id = $1
          `;
                    const p = [
                        candidateId,
                        null,
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
                        emptyToNull(payload.firstInterviewNote ?? payload.recommendationText),
                        emptyToNull(payload.interviewPreferredDate ?? payload.desiredInterviewDates),
                        emptyToNull(payload.contactPreferredTime),
                        emptyToNull(payload.remarks || payload.applicationNote),
                        emptyToNull(payload.applyJobName),
                        emptyToNull(payload.futureVision ?? payload.jobChangeMotivation)
                    ];
                    await client.query(updateSql, p);

                    // 2. ★追加: タスク（次回アクション）の登録・完了処理

                    // (A) 新しいタスクの追加 (日付と内容が送られてきた場合)
                    // (A) 新しいタスクの追加・更新 (日付が送られてきた場合)
                    // ★修正: 単純INSERTではなく、直近の未完了タスクがあれば更新、なければINSERT
                    const newActionDate = emptyToNull(payload.nextActionDate);
                    const newActionNote = emptyToNull(payload.nextActionNote);

                    if (newActionDate) {
                        // 直近の未完了タスクを探す
                        const latestTaskRes = await client.query(`
                            SELECT id FROM candidate_tasks 
                            WHERE candidate_id = $1 AND is_completed = false 
                            ORDER BY action_date ASC, created_at ASC 
                            LIMIT 1
                        `, [candidateId]);

                        if (latestTaskRes.rows.length > 0) {
                            // 既存タスクがあれば更新 (日付と内容を更新)
                            const targetId = latestTaskRes.rows[0].id;
                            await client.query(`
                                UPDATE candidate_tasks
                                SET action_date = $1, action_note = $2, updated_at = NOW()
                                WHERE id = $3
                             `, [newActionDate, newActionNote, targetId]);
                        } else if (newActionNote) {
                            // 既存がなく、Noteもある場合は新規作成
                            await client.query(`
                                INSERT INTO candidate_tasks(candidate_id, action_date, action_note, is_completed, created_at, updated_at)
                            VALUES($1, $2, $3, false, NOW(), NOW())
                                `, [candidateId, newActionDate, newActionNote]);
                        }
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
                        // ★追加: 削除対象のタスクの日付を取得し、同一日付の「空のタスク」も掃除する (ゴースト対策)
                        const targetTaskRes = await client.query('SELECT action_date FROM candidate_tasks WHERE id = $1', [deleteTaskId]);
                        await client.query(`
                            DELETE FROM candidate_tasks 
                            WHERE id = $1 AND candidate_id = $2
                                `, [deleteTaskId, candidateId]);

                        // ゴースト駆除: 同じ日付で、かつメモが空の未完了タスクがあれば削除
                        if (targetTaskRes.rows.length > 0) {
                            const date = targetTaskRes.rows[0].action_date;
                            await client.query(`
                                DELETE FROM candidate_tasks 
                                WHERE candidate_id = $1 
                                  AND action_date = $2
                            AND(action_note IS NULL OR action_note = '')
                                  AND is_completed = false
                                `, [candidateId, date]);
                        }
                    }

                    // (C) candidatesテーブルの同期 (未完了の直近タスクを本体に反映)
                    await syncNextActionDate(client, candidateId);

                    // 3. その他の付随処理 (着座ログ、選考進捗など)
                    if (toBooleanOrNull(payload.attendanceConfirmed) === true) {
                        const teleRes = await client.query(`SELECT id FROM teleapo WHERE candidate_id = $1 AND result LIKE '%設定%' ORDER BY called_at DESC LIMIT 1`, [candidateId]);
                        if (teleRes.rows.length > 0) await client.query("UPDATE teleapo SET result='着座' WHERE id=$1", [teleRes.rows[0].id]);
                    }

                    const selectionPayload = Array.isArray(payload.selectionProgress) ? payload.selectionProgress : (Array.isArray(payload.selection_progress) ? payload.selection_progress : null);
                    if (selectionPayload) {
                        console.log("📋 [DEBUG] selectionProgress received:", JSON.stringify(selectionPayload, null, 2));
                        for (const entry of selectionPayload) {
                            console.log("📋 [DEBUG] Processing entry:", JSON.stringify(entry, null, 2));
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
                            const s_offerAcceptedAt = emptyToNull(entry.offerAcceptedAt ?? entry.offer_accepted_at ?? entry.offerAcceptedDate ?? entry.offerAcceptDate ?? entry.offer_accept_date ?? entry.acceptanceDate);
                            const s_joinedAt = emptyToNull(entry.joinedAt ?? entry.joined_at ?? entry.joinedDate ?? entry.joinDate ?? entry.join_date ?? entry.onboardingDate);
                            const s_preJoinWithdrawDate = emptyToNull(entry.preJoinWithdrawDate ?? entry.pre_join_withdraw_date ?? entry.declinedDate ?? entry.preJoinDeclineDate);
                            const s_preJoinWithdrawReason = emptyToNull(entry.preJoinWithdrawReason ?? entry.pre_join_withdraw_reason ?? entry.declinedReason ?? entry.preJoinDeclineReason);
                            const s_postJoinQuitDate = emptyToNull(entry.postJoinQuitDate ?? entry.post_join_quit_date ?? entry.earlyTurnoverDate);
                            const s_postJoinQuitReason = emptyToNull(entry.postJoinQuitReason ?? entry.post_join_quit_reason ?? entry.earlyTurnoverReason);
                            const s_declinedAfterOfferAt = emptyToNull(entry.declinedAfterOfferAt ?? entry.declined_after_offer_at);
                            const s_declinedAfterOfferReason = emptyToNull(entry.declinedAfterOfferReason ?? entry.declined_after_offer_reason);
                            const s_earlyTurnoverAt = emptyToNull(entry.earlyTurnoverAt ?? entry.early_turnover_at ?? entry.earlyTurnoverDate);
                            const s_earlyTurnoverReason = emptyToNull(entry.earlyTurnoverReason ?? entry.early_turnover_reason);
                            const s_closeExpectedAt = emptyToNull(entry.closeExpectedAt ?? entry.close_expected_at ?? entry.closeExpectedDate ?? entry.closingForecastAt ?? entry.closing_forecast_at ?? entry.closingForecastDate);
                            const s_selectionNote = emptyToNull(entry.selectionNote ?? entry.selection_note ?? entry.note);
                            const s_fee = toIntOrNull(entry.fee ?? entry.feeAmount ?? entry.fee_amount);
                            const s_feeAmount = toIntOrNull(entry.feeAmount ?? entry.fee_amount);
                            const s_refundAmount = toIntOrNull(entry.refundAmount ?? entry.refund_amount);
                            const s_orderReported = toBooleanOrNull(entry.orderReported ?? entry.order_reported);
                            const s_refundReported = toBooleanOrNull(entry.refundReported ?? entry.refund_reported);

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
                                fee_amount = COALESCE($27, fee_amount),
                                refund_amount = COALESCE($28, refund_amount),
                                order_reported = COALESCE($29, order_reported),
                                refund_reported = COALESCE($30, refund_reported),
                                updated_at = NOW() 
                                    WHERE id = $1 AND candidate_id = $31
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
                                    s_feeAmount, s_refundAmount, s_orderReported, s_refundReported,
                                    candidateId
                                ]);
                            } else if (s_clientId) {
                                // INSERT: 新規レコードの作成
                                await client.query(`
                                    INSERT INTO candidate_applications(
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
                                    fee_amount, refund_amount, order_reported, refund_reported,
                                    created_at, updated_at
                                ) VALUES(
                                    $1, $2, $3, $4, $5,
                                    $6, $7, $8, $9, $10,
                                    $11, $12, $13, $14, $15,
                                    $16, $17, $18, $19, $20,
                                    $21, $22, $23, $24, $25, $26,
                                    $27, $28, $29, $30,
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
                                    s_closeExpectedAt, s_selectionNote, s_fee,
                                    s_feeAmount, s_refundAmount, s_orderReported, s_refundReported
                                ]);
                            }
                        }
                    }

                }

                const screeningRules = await loadScreeningRules(client);
                resolvedValidApplication = await syncCandidateValidApplication(client, candidateId, screeningRules);

                await client.query("COMMIT");
            } catch (err) {
                await client.query("ROLLBACK");
                throw err;
            }

            const updated = await fetchCandidateDetail(client, candidateId, false, resolvedValidApplication);
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
