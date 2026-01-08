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
const toStr = (v) => (v === undefined || v === null) ? null : String(v).trim();
const clampInt = (v, d, min, max) => Math.min(max, Math.max(min, Math.trunc(Number(v) || d)));

function mapRowToCandidate(row) {
  return {
    id: String(row.id),
    candidateName: row.candidate_name ?? "",
    candidateKana: row.name_kana ?? "",
    jobName: row.job_name ?? "",
    companyName: row.company_name ?? "",
    phase: row.phase ?? "",
    registeredAt: row.registered_at ?? row.created_at,
    phone: row.phone ?? "",
    memo: row.note ?? "",
    callDate: row.first_call_at ?? null,
    nextActionDate: row.next_contact_at ?? null,
    finalResult: row.final_result ?? "----",
    address: [row.address_pref, row.address_city].join("")
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
      c.id, c.name AS candidate_name, c.name_kana, c.phone, c.note, c.created_at,
      c.first_call_at, c.next_contact_at, c.new_status AS phase,
      c.address_pref, c.address_city,
      cl.name AS company_name, ca.job_title AS job_name, ca.final_result,
      ae.registered_at
    FROM candidates c
    LEFT JOIN candidate_applications ca ON ca.candidate_id = c.id
    LEFT JOIN clients cl ON cl.id = ca.client_id
    LEFT JOIN ad_entries ae ON ae.candidate_id = c.id
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