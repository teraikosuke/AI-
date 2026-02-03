import pg from "pg";
const { Pool } = pg;

// コールドスタート後は使い回し（毎回new Poolしない）
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
  "Access-Control-Allow-Origin": "http://localhost:8081", // 必要に応じて環境変数化推奨
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization",
};

const toIntOrNull = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

export const handler = async (event) => {
  // CORS preflight
  const method =
    event?.requestContext?.http?.method || event?.httpMethod || "GET";
  if (method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const qs = event.queryStringParameters ?? {};
  // クエリ or パス どちらでも受けられるようにしておく
  const candidateIdRaw =
    event?.pathParameters?.candidateId ??
    qs.candidateId ??
    qs.candidate_id ??
    qs.id;

  const candidateId = toIntOrNull(candidateIdRaw);
  if (!candidateId || candidateId <= 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "candidateId が不正です" }),
    };
  }

  let client;
  try {
    client = await pool.connect();

    const sql = `
      SELECT id, name, phone, email
      FROM candidates
      WHERE id = $1
      LIMIT 1;
    `;
    const res = await client.query(sql, [candidateId]);

    if (!res.rows?.length) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Candidate not found", candidateId }),
      };
    }

    const c = res.rows[0];
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        candidateId: c.id,
        candidateName: c.name,
        phone: c.phone ?? "",
        email: c.email ?? "",
      }),
    };
  } catch (err) {
    console.error("LAMBDA ERROR:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: String(err?.message || err) }),
    };
  } finally {
    if (client) client.release();
  }
};
