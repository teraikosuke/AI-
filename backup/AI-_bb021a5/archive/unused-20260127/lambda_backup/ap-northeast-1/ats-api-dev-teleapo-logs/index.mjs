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
  "Access-Control-Allow-Origin": "http://localhost:8081", // 必要に応じて '*' に変更してください
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization",
};

const clampInt = (v, def, min, max) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
};

const normalizeFrom = (s) => (s.includes("T") ? s : `${s}T00:00:00+09:00`);
const normalizeToExclusive = (s) => {
  if (s.includes("T")) return s;
  const d = new Date(`${s}T00:00:00+09:00`);
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T00:00:00+09:00`;
};

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";

  // CORS preflight
  if (method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (method !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const qs = event.queryStringParameters ?? {};
  const fromRaw = (qs.from || "").trim();
  const toRaw = (qs.to || "").trim();
  const limit = clampInt(qs.limit, 500, 1, 2000);
  const offset = clampInt(qs.offset, 0, 0, 10_000_000);

  if (!fromRaw || !toRaw) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "from, to は必須です（YYYY-MM-DD）",
        example: "/teleapo/logs?from=2025-12-01&to=2025-12-31&limit=500&offset=0",
      }),
    };
  }

  const from = normalizeFrom(fromRaw);
  const toEx = normalizeToExclusive(toRaw);

  let client;
  try {
    client = await pool.connect();

    // ★修正箇所: テーブル名を teleapo に変更しました
    const sql = `
      SELECT
        t.id,
        t.candidate_id,
        t.call_no,
        t.called_at,
        t.route,
        t.result,
        t.memo,
        t.caller_user_id,
        u.name AS caller_name,
        c.name  AS candidate_name,
        c.phone AS candidate_phone,
        c.email AS candidate_email
      FROM teleapo t
      LEFT JOIN users u ON u.id = t.caller_user_id
      LEFT JOIN candidates c ON c.id = t.candidate_id
      WHERE t.called_at >= $1 AND t.called_at < $2
      ORDER BY t.called_at DESC
      LIMIT $3 OFFSET $4;
    `;

    const res = await client.query(sql, [from, toEx, limit, offset]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        period: { from: fromRaw, to: toRaw },
        paging: { limit, offset, count: res.rows.length },
        items: res.rows,
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