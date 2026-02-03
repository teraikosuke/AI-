import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  host: (process.env.DB_HOST || "").trim(),
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization",
};

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";

  if (method === "OPTIONS") return { statusCode: 204, headers, body: "" };

  let client;
  try {
    client = await pool.connect();

    // ==========================================================
    // GET: 設定の取得
    // ==========================================================
    if (method === "GET") {
      // id=1 の設定を取得（なければデフォルト値を返却）
      const res = await client.query("SELECT * FROM screening_rules WHERE id = 1");
      
      let data = res.rows[0];
      if (!data) {
        // データがない場合は初期値を挿入して返す
        const initSql = `
          INSERT INTO screening_rules (id, min_age, max_age, allowed_jlpt_levels, target_nationalities)
          VALUES (1, 18, 60, '{N1, N2}', '日本')
          RETURNING *
        `;
        const initRes = await client.query(initSql);
        data = initRes.rows[0];
      }

      // フロントエンドの形式に合わせて整形
      const responseData = {
        minAge: data.min_age,
        maxAge: data.max_age,
        // DBの配列型({N1,N2}) または 配列オブジェクト(['N1','N2']) をJS配列に変換
        allowedJlptLevels: Array.isArray(data.allowed_jlpt_levels) 
          ? data.allowed_jlpt_levels 
          : [], 
        targetNationalities: data.target_nationalities || "",
        updatedAt: data.updated_at
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(responseData),
      };
    }

    // ==========================================================
    // PUT: 設定の保存
    // ==========================================================
    if (method === "PUT") {
      const body = JSON.parse(event.body || "{}");
      
      // バリデーション & 値の整形
      const minAge = Number(body.minAge) || 0;
      const maxAge = Number(body.maxAge) || 100;
      const targetNationalities = body.targetNationalities || "";
      
      // チェックボックス等から送られてくる配列（例: ["N1", "N2"]）
      const allowedLevels = Array.isArray(body.allowedJlptLevels) 
        ? body.allowedJlptLevels 
        : [];

      // UPSERT（更新または挿入）
      const sql = `
        INSERT INTO screening_rules (id, min_age, max_age, allowed_jlpt_levels, target_nationalities, updated_at)
        VALUES (1, $1, $2, $3, $4, NOW())
        ON CONFLICT (id) 
        DO UPDATE SET
          min_age = EXCLUDED.min_age,
          max_age = EXCLUDED.max_age,
          allowed_jlpt_levels = EXCLUDED.allowed_jlpt_levels,
          target_nationalities = EXCLUDED.target_nationalities,
          updated_at = NOW()
        RETURNING *
      `;

      const res = await client.query(sql, [minAge, maxAge, allowedLevels, targetNationalities]);
      const updated = res.rows[0];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          minAge: updated.min_age,
          maxAge: updated.max_age,
          allowedJlptLevels: updated.allowed_jlpt_levels,
          targetNationalities: updated.target_nationalities,
        }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };

  } catch (err) {
    console.error("SETTINGS API ERROR:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  } finally {
    if (client) client.release();
  }
};