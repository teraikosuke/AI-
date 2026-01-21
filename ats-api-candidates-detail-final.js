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

// ヘルパー: 数値変換
const toIntOrNull = (v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
};

// ヘルパー: 空文字をnullに
const emptyToNull = (v) => {
    if (v === undefined || v === null) return null;
    if (typeof v === "string" && v.trim() === "") return null;
    return v;
};

// ヘルパー: ブール値変換
const toBooleanOrNull = (v) => {
    if (v === true || v === "true" || v === 1 || v === "1") return true;
    if (v === false || v === "false" || v === 0 || v === "0") return false;
    return null;
};

// マスタ取得
async function fetchMasters(client) {
    const [clientsRes, usersRes] = await Promise.all([
        client.query("SELECT id, name FROM clients ORDER BY name ASC"),
        client.query("SELECT id, name FROM users ORDER BY name ASC"),
    ]);
    return {
        clients: clientsRes.rows || [],
        users: usersRes.rows || [],
    };
}

// 候補者詳細取得
async function fetchCandidateDetail(client, candidateId, includeMaster = false) {
    // 1. 基本情報取得
    const baseSql = `
    SELECT
      c.id,
      c.name AS candidate_name,
      c.name_kana,
      c.phone,
      c.email,
      c.birth_date,
      c.age,
      c.gender,
      c.nationality,
      c.japanese_level,
      c.next_action_date,
      c.next_action_note,
      c.final_education,
      c.address_pref,
      c.address_city,
      c.address_detail,
      c.postal_code,
      c.employment_status,
      c.current_income,
      c.desired_income,
      c.contact_preferred_time,
      c.mandatory_interview_items,
      c.apply_company_name,
      c.apply_job_name,
      c.apply_route_text,
      c.application_note,
      c.desired_job_type,
      c.career_reason,
      c.transfer_timing,
      c.other_selection_status,
      c.interview_preferred_date,
      c.first_interview_note,
      c.recommendation_text,
      c.career_motivation,
      c.desired_location,
      c.first_contact_at AS first_interview_date,
      c.skills,
      c.personality,
      c.work_experience,
      c.memo,
      c.new_status,
      c.first_schedule_fixed_at,
      c.first_contact_planned_at,
      c.first_interview_attended,
      c.created_at,
      c.is_effective_application AS active_flag,
      c.advisor_user_id,
      c.partner_user_id,
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
    
    -- 最新の応募情報（企業名などの表示用）
    LEFT JOIN LATERAL (
      SELECT
        ca.client_id,
        cl.name AS client_name,
        ca.job_title,
        ca.apply_route,
        ca.stage_current,
        ca.updated_at,
        ca.created_at
      FROM candidate_applications ca
      LEFT JOIN clients cl ON cl.id = ca.client_id
      WHERE ca.candidate_id = c.id
      ORDER BY COALESCE(ca.updated_at, ca.created_at) DESC NULLS LAST
      LIMIT 1
    ) ca_latest ON TRUE

    -- 最新のテレアポ情報
    LEFT JOIN LATERAL (
      SELECT caller_user_id, called_at, result, call_no
      FROM teleapo t
      WHERE t.candidate_id = c.id
      ORDER BY (t.result='通電') DESC, t.called_at DESC
      LIMIT 1
    ) t_last ON TRUE
    LEFT JOIN users u_call ON u_call.id = t_last.caller_user_id
    
    -- テレアポ統計
    LEFT JOIN LATERAL (
       SELECT 
         MAX(call_no) as max_call_no,
         BOOL_OR(result = '通電') as has_connected,
         BOOL_OR(result = 'SMS送信') as has_sms,
         MAX(CASE WHEN result = '通電' THEN called_at END) as last_connected_at
       FROM teleapo WHERE candidate_id = c.id
    ) t_stat ON TRUE

    -- ステージリスト
    LEFT JOIN LATERAL (
      SELECT array_agg(DISTINCT ca.stage_current) AS stage_list
      FROM candidate_applications ca
      WHERE ca.candidate_id = c.id
        AND ca.stage_current IS NOT NULL
        AND ca.stage_current <> ''
    ) ca_stage ON TRUE

    WHERE c.id = $1
    LIMIT 1;
  `;

    const baseRes = await client.query(baseSql, [candidateId]);
    if (!baseRes.rows?.length) return null;
    const b = baseRes.rows[0];

    const address = [b.address_pref, b.address_city, b.address_detail].filter(Boolean).join("");

    // フェーズ決定
    let phase = "未接触";
    const phases = b.stage_list || [];
    if (phases.length > 0) {
        phase = phases.join(" / ");
    } else {
        if (b.has_connected) phase = "通電";
        else if (b.has_sms) phase = "SMS送信";
        else if ((b.max_call_no || 0) > 0) phase = "架電中";
    }

    // 2. 選考進捗（詳細）の取得
    const progressRes = await client.query(`
    SELECT 
      ca.client_id,
      cl.name AS client_name,
      ca.job_title,
      ca.apply_route,
      ca.stage_current AS status,
      ca.created_at,
      
      -- 日付フィールド (既存 + 新規追加)
      ca.recommended_at,
      ca.first_interview_set_at,
      ca.first_interview_at,
      ca.second_interview_set_at,
      ca.second_interview_at,
      ca.final_interview_set_at,
      ca.final_interview_at,
      ca.offer_at,
      ca.offer_accepted_at,
      ca.joined_at,
      ca.declined_after_offer_at,
      ca.declined_after_offer_reason,
      ca.early_turnover_at,
      ca.early_turnover_reason,
      ca.closing_forecast_at,
      ca.fee,
      ca.note

    FROM candidate_applications ca
    LEFT JOIN clients cl ON cl.id = ca.client_id
    WHERE ca.candidate_id = $1
    ORDER BY ca.created_at DESC
  `, [candidateId]);

    // マッピング
    const selectionProgress = progressRes.rows.map(row => ({
        clientId: row.client_id,
        companyName: row.client_name,
        jobName: row.job_title,
        status: row.status,
        source: row.apply_route,

        // 日付フィールド
        recommendationDate: row.recommended_at,
        firstInterviewAdjustDate: row.first_interview_set_at,
        firstInterviewDate: row.first_interview_at,
        secondInterviewAdjustDate: row.second_interview_set_at,
        secondInterviewDate: row.second_interview_at,
        finalInterviewAdjustDate: row.final_interview_set_at,
        finalInterviewDate: row.final_interview_at,

        offerDate: row.offer_at,
        offerAcceptedDate: row.offer_accepted_at,
        joinedDate: row.joined_at,
        declinedDate: row.declined_after_offer_at,
        declinedReason: row.declined_after_offer_reason,
        earlyTurnoverDate: row.early_turnover_at,
        earlyTurnoverReason: row.early_turnover_reason,
        closingForecastDate: row.closing_forecast_at,

        // 金額・備考
        fee: row.fee,
        note: row.note
    }));

    const detail = {
        id: String(b.id),
        candidateName: b.candidate_name ?? "",
        candidateKana: b.name_kana ?? "",
        phone: b.phone ?? "",
        email: b.email ?? "",
        birthday: b.birth_date ?? null,
        age: b.age ?? null,
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
        companyName: b.company_name ?? "",
        jobName: b.job_name ?? "",
        validApplication: Boolean(b.active_flag),
        advisorUserId: b.advisor_user_id ?? null,
        partnerUserId: b.partner_user_id ?? null,
        advisorName: b.advisor_name ?? "",
        partnerName: b.partner_name ?? "",
        callerName: b.caller_name ?? "",
        phase: phase,
        phases: phases,
        selectionProgress: selectionProgress, // ★ここに入ります
        registeredAt: b.created_at,
        source: b.source ?? "",
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
        otherProcessStatus: b.desired_location ?? "",
        desiredLocation: b.desired_location ?? "",
        firstInterviewDate: b.first_interview_date ?? null,
        skills: b.skills ?? "",
        personality: b.personality ?? "",
        workExperience: b.work_experience ?? "",
        memo: b.memo ?? "",
        firstContactPlannedAt: b.first_contact_planned_at ?? null,
        attendanceConfirmed: Boolean(b.first_interview_attended),
        scheduleConfirmedAt: b.first_schedule_fixed_at ?? null,
        csSummary: {
            hasConnected: Boolean(b.has_connected),
            hasSms: Boolean(b.has_sms),
            callCount: b.max_call_no ?? 0,
            lastConnectedAt: b.last_connected_at ?? null,
        },
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

        // GET: 詳細取得
        if (method === "GET") {
            const includeMaster = event?.queryStringParameters?.includeMaster === "true";
            const data = await fetchCandidateDetail(client, candidateId, includeMaster);
            if (!data) return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };
            return { statusCode: 200, headers, body: JSON.stringify(data) };
        }

        // PUT: 更新
        if (method === "PUT") {
            const rawBody = event?.isBase64Encoded
                ? Buffer.from(event.body || "", "base64").toString("utf8")
                : (event.body || "");
            const payload = JSON.parse(rawBody || "{}");
            console.log("PUT Payload:", JSON.stringify(payload));

            const detailMode = Boolean(payload.detailMode ?? payload.detail_mode);
            const validApplication = typeof payload.validApplication === "boolean" ? payload.validApplication : null;

            // パラメータ展開 (基本情報更新用)
            const advisorUserId = toIntOrNull(payload.advisorUserId);
            const partnerUserId = toIntOrNull(payload.partnerUserId);
            const scheduleConfirmedAt = emptyToNull(payload.scheduleConfirmedAt);
            const firstContactPlannedAt = emptyToNull(payload.firstContactPlannedAt);
            const firstInterviewDate = emptyToNull(payload.firstInterviewDate);
            const attendanceConfirmed = toBooleanOrNull(payload.attendanceConfirmed ?? payload.firstInterviewAttended);
            const candidateName = emptyToNull(payload.candidateName);
            const candidateKana = emptyToNull(payload.candidateKana);
            const gender = emptyToNull(payload.gender);
            const birthDate = emptyToNull(payload.birthDate);
            const phone = emptyToNull(payload.phone);
            const email = emptyToNull(payload.email);
            const postalCode = emptyToNull(payload.postalCode);
            const addressPref = emptyToNull(payload.addressPref);
            const addressCity = emptyToNull(payload.addressCity);
            const addressDetail = emptyToNull(payload.addressDetail);
            const education = emptyToNull(payload.education ?? payload.finalEducation);
            const nationality = emptyToNull(payload.nationality);
            const japaneseLevel = emptyToNull(payload.japaneseLevel);
            const mandatoryInterviewItems = emptyToNull(payload.mandatoryInterviewItems);
            const desiredLocation = emptyToNull(payload.desiredLocation);
            const desiredJobType = emptyToNull(payload.desiredJobType);
            const currentIncome = emptyToNull(payload.currentIncome);
            const desiredIncome = emptyToNull(payload.desiredIncome);
            const employmentStatus = emptyToNull(payload.employmentStatus);
            const careerReason = emptyToNull(payload.careerReason);
            const careerMotivation = emptyToNull(payload.careerMotivation);
            const transferTiming = emptyToNull(payload.transferTiming);
            const skills = emptyToNull(payload.skills);
            const personality = emptyToNull(payload.personality);
            const workExperience = emptyToNull(payload.workExperience);
            const otherSelectionStatus = emptyToNull(payload.otherSelectionStatus);
            const firstInterviewNote = emptyToNull(payload.firstInterviewNote);
            const interviewPreferredDate = emptyToNull(payload.interviewPreferredDate);
            const nextActionDate = emptyToNull(payload.nextActionDate);
            const nextActionNote = emptyToNull(payload.nextActionNote);

            // 選考進捗リスト
            const selectionProgress = payload.selectionProgress || payload.selection_progress || [];

            await client.query("BEGIN");

            try {
                if (detailMode) {
                    // 候補者テーブル本体の更新
                    const updateSql = `
            UPDATE candidates
            SET
              updated_at = NOW(),
              is_effective_application = COALESCE($2, is_effective_application),
              advisor_user_id = COALESCE($3, advisor_user_id),
              partner_user_id = COALESCE($4, partner_user_id),
              first_schedule_fixed_at = COALESCE($5, first_schedule_fixed_at),
              first_contact_planned_at = COALESCE($6, first_contact_planned_at),
              first_contact_at = COALESCE($7, first_contact_at),
              first_interview_attended = COALESCE($8, first_interview_attended),
              next_action_date = COALESCE($9, next_action_date),
              name = COALESCE($10, name),
              name_kana = COALESCE($11, name_kana),
              gender = COALESCE($12, gender),
              birth_date = COALESCE($13, birth_date),
              phone = COALESCE($14, phone),
              email = COALESCE($15, email),
              postal_code = COALESCE($16, postal_code),
              address_pref = COALESCE($17, address_pref),
              address_city = COALESCE($18, address_city),
              address_detail = COALESCE($19, address_detail),
              final_education = COALESCE($20, final_education),
              nationality = COALESCE($21, nationality),
              japanese_level = COALESCE($22, japanese_level),
              mandatory_interview_items = COALESCE($23, mandatory_interview_items),
              desired_location = COALESCE($24, desired_location),
              desired_job_type = COALESCE($25, desired_job_type),
              current_income = COALESCE($26, current_income),
              desired_income = COALESCE($27, desired_income),
              employment_status = COALESCE($28, employment_status),
              career_reason = COALESCE($29, career_reason),
              career_motivation = COALESCE($30, career_motivation),
              transfer_timing = COALESCE($31, transfer_timing),
              skills = COALESCE($32, skills),
              personality = COALESCE($33, personality),
              work_experience = COALESCE($34, work_experience),
              other_selection_status = COALESCE($35, other_selection_status),
              first_interview_note = COALESCE($36, first_interview_note),
              interview_preferred_date = COALESCE($37, interview_preferred_date),
              next_action_note = COALESCE($38, next_action_note)
            WHERE id = $1
            RETURNING id;
          `;

                    const p = [
                        candidateId, validApplication, advisorUserId, partnerUserId,
                        scheduleConfirmedAt, firstContactPlannedAt, firstInterviewDate,
                        attendanceConfirmed, nextActionDate, candidateName, candidateKana,
                        gender, birthDate, phone, email, postalCode, addressPref, addressCity,
                        addressDetail, education, nationality, japaneseLevel, mandatoryInterviewItems,
                        desiredLocation, desiredJobType, currentIncome, desiredIncome, employmentStatus,
                        careerReason, careerMotivation, transferTiming, skills, personality,
                        workExperience, otherSelectionStatus, firstInterviewNote, interviewPreferredDate,
                        nextActionNote
                    ];

                    await client.query(updateSql, p);

                    // 着座連携
                    if (attendanceConfirmed === true) {
                        const findTeleapoSql = `SELECT id FROM teleapo WHERE candidate_id = $1 AND result LIKE '%設定%' ORDER BY called_at DESC LIMIT 1`;
                        const teleRes = await client.query(findTeleapoSql, [candidateId]);
                        if (teleRes.rows.length > 0) {
                            await client.query("UPDATE teleapo SET result = '着座' WHERE id = $1", [teleRes.rows[0].id]);
                        }
                    }

                    // 選考進捗テーブルの更新 (Delete-Insert方式)
                    if (Array.isArray(selectionProgress)) {
                        await client.query("DELETE FROM candidate_applications WHERE candidate_id = $1", [candidateId]);

                        for (const item of selectionProgress) {
                            let clientId = emptyToNull(item.clientId || item.client_id);
                            const companyName = item.companyName || item.company_name;

                            // ID補完: UUID形式でない場合などに名前から検索
                            if (companyName && (!clientId || clientId.length < 10)) {
                                const cRes = await client.query("SELECT id FROM clients WHERE name = $1 LIMIT 1", [companyName]);
                                if (cRes.rows.length > 0) clientId = cRes.rows[0].id;
                            }

                            if (clientId) {
                                // フィールドマッピング
                                const recommendedAt = emptyToNull(item.recommendedAt || item.recommended_at || item.recommendationDate);
                                const firstInterviewSetAt = emptyToNull(item.firstInterviewSetAt || item.first_interview_set_at || item.firstInterviewAdjustDate);
                                const firstInterviewAt = emptyToNull(item.firstInterviewAt || item.first_interview_at || item.firstInterviewDate);
                                const secondInterviewSetAt = emptyToNull(item.secondInterviewSetAt || item.second_interview_set_at || item.secondInterviewAdjustDate);
                                const secondInterviewAt = emptyToNull(item.secondInterviewAt || item.second_interview_at || item.secondInterviewDate);

                                // 新規追加カラム
                                const finalInterviewSetAt = emptyToNull(item.finalInterviewSetAt || item.final_interview_set_at || item.finalInterviewAdjustDate);
                                const finalInterviewAt = emptyToNull(item.finalInterviewAt || item.final_interview_at || item.finalInterviewDate);
                                const offerAt = emptyToNull(item.offerAt || item.offer_at || item.offerDate);
                                const offerAcceptedAt = emptyToNull(item.offerAcceptedAt || item.offer_accepted_at || item.offerAcceptedDate);
                                const joinedAt = emptyToNull(item.joinedAt || item.joined_at || item.joinedDate);
                                const declinedAt = emptyToNull(item.declinedAt || item.declined_after_offer_at || item.declinedDate || item.declinedAfterOfferDate);
                                const declinedReason = emptyToNull(item.declinedReason || item.declined_after_offer_reason || item.declinedAfterOfferReason);
                                const earlyTurnoverAt = emptyToNull(item.earlyTurnoverAt || item.early_turnover_at || item.earlyTurnoverDate);
                                const earlyTurnoverReason = emptyToNull(item.earlyTurnoverReason || item.early_turnover_reason);
                                const closingForecastAt = emptyToNull(item.closingForecastAt || item.closing_forecast_at || item.closingForecastDate);
                                const fee = toIntOrNull(item.fee || item.FEE);
                                const note = emptyToNull(item.note || item.notes || item.remarks || item.memo);

                                await client.query(`
                    INSERT INTO candidate_applications (
                      candidate_id, client_id, job_title, 
                      stage_current, updated_at, created_at, apply_route,
                      recommended_at, first_interview_set_at, first_interview_at,
                      second_interview_set_at, second_interview_at,
                      final_interview_set_at, final_interview_at,
                      offer_at, offer_accepted_at, joined_at,
                      declined_after_offer_at, declined_after_offer_reason,
                      early_turnover_at, early_turnover_reason,
                      closing_forecast_at, fee, note
                    ) VALUES (
                      $1, $2, $3, $4, NOW(), NOW(), $5,
                      $6, $7, $8, $9, $10,
                      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
                    )
                  `, [
                                    candidateId, clientId,
                                    item.jobName || item.job_title,
                                    item.status || item.selection_status,
                                    item.source || item.apply_route,
                                    recommendedAt, firstInterviewSetAt, firstInterviewAt,
                                    secondInterviewSetAt, secondInterviewAt,
                                    finalInterviewSetAt, finalInterviewAt,
                                    offerAt, offerAcceptedAt, joinedAt,
                                    declinedAt, declinedReason,
                                    earlyTurnoverAt, earlyTurnoverReason,
                                    closingForecastAt, fee, note
                                ]);
                            }
                        }
                    }

                } else if (typeof validApplication === "boolean") {
                    // 有効フラグのみ更新モード
                    await client.query("UPDATE candidates SET is_effective_application = $2 WHERE id = $1", [candidateId, validApplication]);
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
