import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: { rejectUnauthorized: false }
});

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET,PUT" // 指定通り PUT, GET, OPTIONS
  };

  // ==========================================================
  // OPTIONS: CORSプリフライトリクエスト
  // ==========================================================
  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  let client;
  try {
    client = await pool.connect();
    const method = event.httpMethod || event.requestContext?.http?.method;

    // ==========================================================
    // GET: 目標値の取得
    // URL例: /kpi-targets?period=2026-02
    // ==========================================================
    if (method === 'GET') {
      const period = event.queryStringParameters?.period;
      
      if (!period) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Period parameter is required (e.g., ?period=2026-02)" }) };
      }

      // 指定月のデータを取得
      const query = `
        SELECT metric_key, target_value 
        FROM kpi_targets 
        WHERE target_month = $1
      `;
      const res = await client.query(query, [period]);

      // フロントエンドで使いやすい形 { key: value, ... } に変換
      const targets = {};
      res.rows.forEach(row => {
        // 数値型として返す
        targets[row.metric_key] = Number(row.target_value);
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(targets)
      };
    }

    // ==========================================================
    // PUT: 目標値の保存・更新
    // Body例: { "period": "2026-02", "targets": { "ads_valid_app_rate": 10, ... } }
    // ==========================================================
    if (method === 'PUT') {
      const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64').toString('utf-8')
        : event.body;
      
      const body = JSON.parse(rawBody || '{}');
      const period = body.period;
      const targets = body.targets || {};

      if (!period) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Period is required in body" }) };
      }

      await client.query('BEGIN');

      try {
        const keys = Object.keys(targets);
        
        for (const key of keys) {
          const value = targets[key];
          
          // 値が数値として有効な場合は UPSERT (登録or更新)
          if (value !== "" && value !== null && !isNaN(Number(value))) {
            const upsertQuery = `
              INSERT INTO kpi_targets (target_month, metric_key, target_value, updated_at)
              VALUES ($1, $2, $3, NOW())
              ON CONFLICT (target_month, metric_key) 
              DO UPDATE SET target_value = EXCLUDED.target_value, updated_at = NOW();
            `;
            await client.query(upsertQuery, [period, key, Number(value)]);
          } else {
             // 値が空の場合は、設定を削除する（クリア処理）
             await client.query(
               `DELETE FROM kpi_targets WHERE target_month = $1 AND metric_key = $2`, 
               [period, key]
             );
          }
        }

        await client.query('COMMIT');
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: "Targets updated successfully", period: period })
        };

      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };

  } catch (err) {
    console.error('API Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  } finally {
    if (client) client.release();
  }
};