import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  host: (process.env.DB_HOST || "").trim(),
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 1,
  idleTimeoutMillis: 1000,
  connectionTimeoutMillis: 5000,
});

// 広告データ変換用
const mapRowToAdContract = (row) => ({
  id: String(row.id),
  mediaName: row.media_name,
  contractStartDate: row.contract_start_date,
  contractEndDate: row.contract_end_date,
  contractAmount: row.contract_amount,
  amountPeriod: row.amount_period,
  contractMethod: row.contract_method,
  renewalTerms: row.renewal_terms,
  memo: row.memo,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  
  // 売上高合計
  totalSales: Number(row.total_sales || 0)
});

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,authorization",
  };

  const method = event.requestContext?.http?.method || event.httpMethod;

  if (method === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  let client;
  try {
    client = await pool.connect();

    // =================================================================
    // GET: 広告詳細・契約履歴の取得
    // =================================================================
    if (method === 'GET') {
      const qs = event.queryStringParameters || {};
      const mediaName = qs.mediaName;
      const id = qs.id || event.pathParameters?.id;

      let sql;
      let params = [];

      // 売上高計算のサブクエリ (placements結合)
      const salesSubQuery = `
        (
          SELECT COALESCE(SUM(p.fee_amount), 0)
          FROM candidate_applications ca
          JOIN placements p ON p.candidate_application_id = ca.id
          WHERE ca.apply_route = ad_details.media_name
          AND ca.join_date IS NOT NULL
        ) AS total_sales
      `;

      if (id) {
        // ID指定
        sql = `SELECT *, ${salesSubQuery} FROM ad_details WHERE id = $1`;
        params = [id];
      } else if (mediaName) {
        // 媒体名指定
        sql = `SELECT *, ${salesSubQuery} FROM ad_details WHERE media_name = $1 ORDER BY contract_start_date DESC`;
        params = [mediaName];
      } else {
        // 全件
        sql = `SELECT *, ${salesSubQuery} FROM ad_details ORDER BY contract_start_date DESC LIMIT 100`;
      }

      const res = await client.query(sql, params);
      const items = res.rows.map(mapRowToAdContract);

      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify({
          items,
          contract: items.length > 0 ? items[0] : null 
        }) 
      };
    }

    // =================================================================
    // POST / PUT: 広告契約の追加・更新
    // =================================================================
    if (method === 'POST' || method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const id = body.id || event.pathParameters?.id;
      
      // バリデーション: 開始日のみ必須
      if (!body.contractStartDate) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "契約開始日は必須です。" }) };
      }

      if (id) {
        // UPDATE
        const updateSql = `
          UPDATE ad_details
          SET
            media_name = COALESCE($2, media_name),
            contract_start_date = $3,
            contract_end_date = $4, -- NULL許容
            contract_amount = COALESCE($5, contract_amount),
            amount_period = COALESCE($6, amount_period),
            contract_method = COALESCE($7, contract_method),
            renewal_terms = COALESCE($8, renewal_terms),
            memo = COALESCE($9, memo),
            updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `;
        const params = [
          id, body.mediaName, body.contractStartDate, body.contractEndDate,
          body.contractAmount, body.amountPeriod, body.contractMethod,
          body.renewalTerms, body.memo
        ];
        
        const res = await client.query(updateSql, params);
        if (res.rows.length === 0) return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };
        
        return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify({ success: true, contract: mapRowToAdContract(res.rows[0]) }) 
        };

      } else {
        // INSERT
        if (!body.mediaName) return { statusCode: 400, headers, body: JSON.stringify({ error: "mediaName is required" }) };

        const insertSql = `
          INSERT INTO ad_details (
            media_name, contract_start_date, contract_end_date, 
            contract_amount, amount_period, contract_method, 
            renewal_terms, memo, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          RETURNING *
        `;
        const params = [
          body.mediaName, body.contractStartDate, body.contractEndDate,
          body.contractAmount, body.amountPeriod, body.contractMethod,
          body.renewalTerms, body.memo
        ];

        const res = await client.query(insertSql, params);
        return { 
          statusCode: 201, 
          headers, 
          body: JSON.stringify({ success: true, contract: mapRowToAdContract(res.rows[0]) }) 
        };
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };

  } catch (err) {
    if (client && (method === 'POST' || method === 'PUT')) await client.query('ROLLBACK');
    console.error("AD API Error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  } finally {
    if (client) client.release();
  }
};