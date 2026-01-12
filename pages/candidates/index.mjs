// 【GET専用】ats-api-dev-candidates-list
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: (process.env.DB_HOST || "").trim(),
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS,POST,PUT",
  "Access-Control-Allow-Headers": "content-type,authorization",
};

// ヘルパー関数
const toStr = (v) => (v === undefined || v === null) ? "" : String(v).trim();
const clampInt = (v, d, min, max) => Math.min(max, Math.max(min, Math.trunc(Number(v) || d)));

function fallbackPhaseFromTeleapo(teleapo) {
  if (teleapo?.has_connected) return "通電";
  if (teleapo?.has_sms) return "SMS送信";
  if ((teleapo?.max_call_no || 0) > 0) return "架電中";
  return "未接触";
}

function resolvePhase(stageList, teleapo) {
  const unique = Array.from(
    new Set((Array.isArray(stageList) ? stageList : [])
      .map((value) => toStr(value))
      .filter((value) => value))
  );
  const phase = unique.length ? unique.join(" / ") : fallbackPhaseFromTeleapo(teleapo);
  return { phases: unique, phase };
}

function mapRowToCandidate(row) {
  const teleapo = {
    has_connected: row.has_connected,
    has_sms: row.has_sms,
    max_call_no: row.max_call_no,
  };
  const phaseInfo = resolvePhase(row.stage_list, teleapo);

  return {
    id: String(row.id),
    candidateName: row.candidate_name ?? "",
    candidateKana: row.name_kana ?? "",
    jobName: row.job_name ?? "",
    companyName: row.company_name ?? "",
    phase: phaseInfo.phase ?? "",
    phases: phaseInfo.phases ?? [],
    registeredAt: row.registered_at ?? row.created_at,
    validApplication: Boolean(row.active_flag),
    phoneConnected: Boolean(row.has_connected),
    callerName: row.caller_name ?? "",
    advisorName: row.advisor_name ?? "",
    partnerName: row.partner_name ?? "",
    phone: row.phone ?? "",
    memo: row.note ?? "",
    callDate: row.last_connected_at ?? row.first_call_at ?? null,
    nextActionDate: row.next_contact_at ?? null,
    finalResult: row.final_result ?? "----",
    source: row.source ?? "",
    address: [row.address_pref, row.address_city, row.address_detail].filter(Boolean).join("")
  };
}

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log("EVENT START (GET):", JSON.stringify(event?.queryStringParameters));

  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
  if (method === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const qs = event.queryStringParameters ?? {};
  const limit = clampInt(qs.limit, 200, 1, 500);
  const offset = clampInt(qs.offset, 0, 0, 1000000);

  const sql = `
    SELECT
      c.id,
      c.name AS candidate_name,
      c.name_kana,
      c.phone,
      c.note,
      c.created_at,
      c.first_call_at,
      c.next_contact_at,
      c.address_pref,
      c.address_city,
      c.address_detail,
      c.active_flag,
      u_ad.name AS advisor_name,
      u_pt.name AS partner_name,
      ae.created_at AS registered_at,
      ae.apply_route AS source,
      ca_latest.client_name AS company_name,
      ca_latest.job_title AS job_name,
      ca_latest.final_result,
      ca_stage.stage_list,
      t_summary.max_call_no,
      t_summary.has_connected,
      t_summary.has_sms,
      t_summary.last_connected_at,
      u_call.name AS caller_name
    FROM candidates c
    LEFT JOIN users u_ad ON u_ad.id = c.advisor_user_id
    LEFT JOIN users u_pt ON u_pt.id = c.partner_user_id
    LEFT JOIN LATERAL (
      SELECT apply_route, created_at, updated_at
      FROM ad_entries ae
      WHERE ae.candidate_id = c.id
      ORDER BY COALESCE(ae.updated_at, ae.created_at) DESC NULLS LAST
      LIMIT 1
    ) ae ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        ca.client_id,
        cl.name AS client_name,
        ca.job_title,
        ca.final_result,
        ca.updated_at,
        ca.created_at
      FROM candidate_applications ca
      LEFT JOIN clients cl ON cl.id = ca.client_id
      WHERE ca.candidate_id = c.id
      ORDER BY COALESCE(ca.updated_at, ca.created_at) DESC NULLS LAST
      LIMIT 1
    ) ca_latest ON TRUE
    LEFT JOIN LATERAL (
      SELECT array_agg(DISTINCT ca.stage_current) AS stage_list
      FROM candidate_applications ca
      WHERE ca.candidate_id = c.id
        AND ca.stage_current IS NOT NULL
        AND ca.stage_current <> ''
    ) ca_stage ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        MAX(call_no) AS max_call_no,
        BOOL_OR(result = '通電') AS has_connected,
        BOOL_OR(result = 'SMS送信') AS has_sms,
        MAX(CASE WHEN result = '通電' THEN called_at END) AS last_connected_at
      FROM teleapo t
      WHERE t.candidate_id = c.id
    ) t_summary ON TRUE
    LEFT JOIN LATERAL (
      SELECT caller_user_id, called_at, result
      FROM teleapo t
      WHERE t.candidate_id = c.id
      ORDER BY (t.result='通電') DESC, t.called_at DESC
      LIMIT 1
    ) t_last ON TRUE
    LEFT JOIN users u_call ON u_call.id = t_last.caller_user_id
    WHERE c.active_flag = TRUE
    ORDER BY c.created_at DESC
    LIMIT $1 OFFSET $2
  `;

  let client;
  try {
    client = await pool.connect();
    const res = await client.query(sql, [limit, offset]);
    const items = res.rows.map(mapRowToCandidate);
    
    // total取得
    const countRes = await client.query("SELECT COUNT(*) as total FROM candidates WHERE active_flag = TRUE");
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        items, 
        total: String(countRes.rows[0].total) 
      })
    };
  } catch (err) {
    console.error("LAMBDA ERROR:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(err) }) };
  } finally {
    if (client) client.release();
  }
};
