// index.mjs
import pg from "pg";
const { Pool } = pg;

// ① RDS 接続プール
const pool = new Pool({
  host: (process.env.DB_HOST || "").trim(),
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 2,
  idleTimeoutMillis: 30000,
});

// CORS/共通ヘッダ（開発用）
// 本番はフロントのドメインに固定するのが推奨
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "http://localhost:8081",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization",
};

// ② Lambda 本体
export const handler = async (event) => {
  const qs = event.queryStringParameters ?? {};

  const from = (qs.from || "2025-12-01").trim();
  const to = (qs.to || "2025-12-31").trim();
  const userId = Number(qs.userId ?? 2);

  // バリデーション（userId=0 を弾きたい/弾きたくないで調整）
  if (!from || !to || !Number.isFinite(userId) || userId <= 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "from, to, userId は必須です" }),
    };
  }

  let client; // ★ finally で安全に release するため
  try {
    // ★ connect を try の中に入れる（ここが最重要）
    client = await pool.connect();

    const sql = `
      SELECT
        COUNT(*) FILTER (WHERE ca.recommended_at BETWEEN $1 AND $2)
          AS recommended_count,
        COUNT(*) FILTER (WHERE ca.first_interview_set_at BETWEEN $1 AND $2)
          AS first_interview_set_count,
        COUNT(*) FILTER (WHERE ca.first_interview_at BETWEEN $1 AND $2)
          AS first_interview_done_count,
        COUNT(*) FILTER (WHERE ca.offer_date BETWEEN $1 AND $2)
          AS offer_count,
        COUNT(*) FILTER (WHERE ca.offer_accept_date BETWEEN $1 AND $2)
          AS offer_accept_count,
        COUNT(*) FILTER (WHERE ca.join_date BETWEEN $1 AND $2)
          AS joined_count
      FROM candidate_applications ca
      JOIN candidates c ON ca.candidate_id = c.id
      WHERE c.advisor_user_id = $3;
    `;

    const result = await client.query(sql, [from, to, userId]);
    const row = result.rows?.[0] || {};

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        period: { from, to },
        userId,
        counts: {
          recommended: Number(row.recommended_count || 0),
          firstInterviewSet: Number(row.first_interview_set_count || 0),
          firstInterviewDone: Number(row.first_interview_done_count || 0),
          offer: Number(row.offer_count || 0),
          offerAccept: Number(row.offer_accept_count || 0),
          joined: Number(row.joined_count || 0),
        },
      }),
    };
  } catch (err) {
    // ★ ここに必ず入るようになる
    console.error("LAMBDA ERROR:", err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: String(err?.message || err),
        // 切り分け用：環境変数が空かどうかを見たい場合だけ一時的に使う（本番では消す）
        debug: {
          hasDBHost: Boolean((process.env.DB_HOST || "").trim()),
          hasDBName: Boolean(process.env.DB_NAME),
          hasDBUser: Boolean(process.env.DB_USER),
          hasDBPassword: Boolean(process.env.DB_PASSWORD),
        },
      }),
    };
  } finally {
    // ★ client が取れている時だけ release
    if (client) client.release();
  }
};
