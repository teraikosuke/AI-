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
    "Access-Control-Allow-Methods": "OPTIONS,POST,PUT"
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  let client;

  try {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf-8')
      : event.body;

    if (!rawBody) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Empty body" }) };
    }

    const body = JSON.parse(rawBody);
    const method = event.httpMethod || event.requestContext?.http?.method;

    // バリデーション
    if (!body.name && !body.companyName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Company name is required" })
      };
    }

    const companyName = body.name || body.companyName;
    client = await pool.connect();

    // ==========================================================
    // PUT (更新) : ID指定でデータを更新する
    // ==========================================================
    if (method === 'PUT') {
      // IDはパスパラメータ(pathParameters.id) か ボディ(body.id) から取得
      const updateId = event.pathParameters?.id || body.id;

      if (!updateId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "ID is required for update" }) };
      }

      const updateQuery = `
        UPDATE clients
        SET
          name = $1,
          industry = $2,
          location = $3,
          job_categories = $4,
          planned_hires_count = $5,
          selection_note = $6,
          contact_name = $7,
          contact_email = $8,
          
          -- ★追加: 契約情報
          warranty_period = $9,
          fee_details = $10,
          contract_note = $11,

          updated_at = NOW()
        WHERE id = $12
        RETURNING *;
      `;

      const updateValues = [
        companyName,
        body.industry || null,
        body.location || null,
        body.jobCategories || null,
        body.plannedHiresCount || 0,
        body.selectionNote || null,
        body.contactName || null,
        body.contactEmail || null,
        // 追加項目
        body.warrantyPeriod || null,
        body.feeDetails || null,
        body.contractNote || null,

        updateId
      ];

      const res = await client.query(updateQuery, updateValues);

      if (res.rows.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Client not found" }) };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: "Updated successfully",
          item: res.rows[0]
        })
      };
    }

    // ==========================================================
    // POST (新規作成)
    // ==========================================================
    const insertQuery = `
      INSERT INTO clients (
        name,
        industry,
        location,
        job_categories,
        planned_hires_count,
        selection_note,
        contact_name,
        contact_email,
        
        -- ★追加
        warranty_period,
        fee_details,
        contract_note,

        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
      )
      RETURNING id, name, created_at;
    `;

    const insertValues = [
      companyName,
      body.industry || null,
      body.location || null,
      body.jobCategories || null,
      body.plannedHiresCount || 0,
      body.selectionNote || null,
      body.contactName || null,
      body.contactEmail || null,
      // 追加項目
      body.warrantyPeriod || null,
      body.feeDetails || null,
      body.contractNote || null
    ];

    const res = await client.query(insertQuery, insertValues);
    const newItem = res.rows[0];

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: "Created successfully",
        id: newItem.id,
        item: newItem
      })
    };

  } catch (err) {
    console.error('API Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  } finally {
    if (client) {
      client.release();
    }
  }
};
