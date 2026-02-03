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
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization",
};

const json = (statusCode, bodyObj) => ({
  statusCode,
  headers,
  body: bodyObj === undefined ? "" : JSON.stringify(bodyObj),
});

const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
  if (method === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const qs = event.queryStringParameters ?? {};
  const limit = toInt(qs.limit, 50);
  const offset = toInt(qs.offset, 0);
  const keyword = (qs.keyword || "").trim();

  // 検索フィルター用ID
  const advisorId = toInt(qs.advisorUserId, 0);
  const partnerId = toInt(qs.partnerUserId, 0);
  const phase = (qs.phase || "").trim();

  let client;
  try {
    client = await pool.connect();

    // 検索条件
    const conditions = ["1=1"];
    const params = [];

    if (keyword) {
      params.push(`%${keyword}%`);
      conditions.push(`(c.name ILIKE $${params.length} OR c.name_kana ILIKE $${params.length} OR c.email ILIKE $${params.length})`);
    }

    // フィルター条件 (担当CS/パートナー)
    if (advisorId > 0) {
      params.push(advisorId);
      conditions.push(`c.partner_user_id = $${params.length}`);
    }

    if (partnerId > 0) {
      params.push(partnerId);
      conditions.push(`c.advisor_user_id = $${params.length}`);
    }

    if (phase) {
      params.push(phase);
      conditions.push(`EXISTS (
        SELECT 1 FROM candidate_applications ca 
        WHERE ca.candidate_id = c.id 
        AND ca.stage_current = $${params.length}
      )`);
    }

    const whereClause = conditions.join(" AND ");

    // SQLクエリ
    const sql = `
      SELECT
        c.id,
        c.name,
        c.name_kana,
        c.email,
        c.phone,
        c.age,
        c.gender,
        c.created_at,
        c.updated_at,
        c.is_effective_application,
        
        c.nationality,
        c.japanese_level,
        
        c.apply_route_text,

        -- DB上のカラム定義
        c.advisor_user_id,         -- DB上のアドバイザーID
        u_ad.name AS db_advisor_name,
        
        c.partner_user_id,         -- DB上のパートナー(CS)ID
        u_pt.name AS db_partner_name,

        -- 最新の進捗（一覧表示用）
        ca_latest.stage_current,
        ca_latest.apply_route,
        ca_latest.client_name,
        
        -- ★修正: 全応募履歴をJSON配列として取得（フローチャート用）
        ca_all.apps

      FROM candidates c
      
      LEFT JOIN users u_ad ON c.advisor_user_id = u_ad.id
      LEFT JOIN users u_pt ON c.partner_user_id = u_pt.id
      
      -- 最新の応募情報を取得 (メイン一覧表示用)
      LEFT JOIN LATERAL (
        SELECT 
          ca.stage_current, 
          ca.apply_route,  -- DB: apply_route
          cl.name as client_name
        FROM candidate_applications ca
        LEFT JOIN clients cl ON ca.client_id = cl.id
        WHERE ca.candidate_id = c.id
        ORDER BY COALESCE(ca.updated_at, ca.created_at) DESC
        LIMIT 1
      ) ca_latest ON TRUE

      -- ★修正: すべての応募情報をJSON配列として取得 (フローチャート用)
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'id', ca.id,
          'clientId', ca.client_id,
          'clientName', cl.name,
          'stageCurrent', ca.stage_current, -- DB: stage_current
          'jobTitle', ca.job_title,         -- DB: job_title
          'applyRoute', ca.apply_route,     -- DB: apply_route (screenshot checked)
          'updatedAt', ca.updated_at,
          'createdAt', ca.created_at,
          'selectionNote', ca.selection_note, -- DB: selection_note

          -- 日付フィールド関連 (Screenshot mapping)
          'proposalDate', ca.proposal_date,              -- DB: proposal_date
          'recommendationDate', ca.recommended_at,       -- DB: recommended_at
          'firstInterviewSetAt', ca.first_interview_set_at, -- DB: first_interview_set_at
          'firstInterviewDate', ca.first_interview_at,      -- DB: first_interview_at
          'secondInterviewSetAt', ca.second_interview_set_at, -- DB: second_interview_set_at
          'secondInterviewDate', ca.second_interview_at,      -- DB: second_interview_at
          'finalInterviewSetAt', ca.final_interview_set_at,   -- DB: final_interview_set_at
          'finalInterviewDate', ca.final_interview_at,        -- DB: final_interview_at
          
          -- オファー日: offer_at か offer_date のどちらかを使用
          'offerDate', COALESCE(ca.offer_at, ca.offer_date), 
          
          -- オファー承諾日: offer_accepted_at か offer_accept_date
          'acceptanceDate', COALESCE(ca.offer_accepted_at, ca.offer_accept_date),
          
          -- 入社日: joined_at か join_date
          'onboardingDate', COALESCE(ca.joined_at, ca.join_date),
          
          'closeExpectedDate', COALESCE(ca.close_expected_at, ca.closing_forecast_at), -- DB: close_expected_at / closing_forecast_at 
          
          'preJoinWithdrawDate', ca.pre_join_withdraw_date, -- DB: pre_join_withdraw_date
          'postJoinQuitDate', ca.post_join_quit_date        -- DB: post_join_quit_date

        ) ORDER BY COALESCE(ca.updated_at, ca.created_at) DESC) as apps
        FROM candidate_applications ca
        LEFT JOIN clients cl ON ca.client_id = cl.id
        WHERE ca.candidate_id = c.id
      ) ca_all ON TRUE

      WHERE ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM candidates c
      WHERE ${whereClause}
    `;

    const [resItems, resCount] = await Promise.all([
      client.query(sql, [...params, limit, offset]),
      client.query(countSql, params)
    ]);

    const total = parseInt(resCount.rows[0].total || 0);

    const items = resItems.rows.map(r => {
      const mediaValue = r.apply_route || r.apply_route_text || '-';

      return {
        id: r.id,
        name: r.name,
        nameKana: r.name_kana,
        email: r.email,
        phone: r.phone,
        age: r.age,
        gender: r.gender,
        registeredAt: r.created_at,
        isEffective: r.is_effective_application,

        nationality: r.nationality || '-',
        japaneseLevel: r.japanese_level || '-',

        advisorUserId: r.partner_user_id,
        advisorName: r.db_partner_name || '',

        partnerUserId: r.advisor_user_id,
        partnerName: r.db_advisor_name || '',

        phase: r.stage_current || '未接触',

        media: mediaValue,
        route: mediaValue,
        source: mediaValue,
        applyRoute: mediaValue,

        applyCompany: r.client_name || '-',

        candidateApplications: r.apps || []
      };
    });

    return json(200, {
      items,
      total,
      limit,
      offset
    });

  } catch (err) {
    console.error("LIST API ERROR:", err);
    return json(500, { error: err.message });
  } finally {
    if (client) client.release();
  }
};