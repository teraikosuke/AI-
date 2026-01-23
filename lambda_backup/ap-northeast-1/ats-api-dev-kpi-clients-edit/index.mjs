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
  // 元のコードのヘッダー設定を維持（これが環境に合っているため）
  const headers = {
    "Access-Control-Allow-Origin": "http://localhost:8081", // 必要に応じて "*" にしてもOK
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,POST,PUT"
  };

  const method =
    event.httpMethod ||
    event.requestContext?.http?.method ||
    event.requestContext?.httpMethod;

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  let client;

  try {
    // 【重要】AWS Lambdaプロキシ統合のためのボディ解析処理（元のコードを踏襲）
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf-8')
      : event.body;

    if (!rawBody) {
      throw new Error("Request body is empty");
    }

    const body = JSON.parse(rawBody);

    // パスパラメータ または ボディ からIDを取得
    const id = event.pathParameters?.id || body.id;
    if (!id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Company ID is required" })
      };
    }

    client = await pool.connect();
    console.log(`Updating client ID: ${id}`);

    // ★変更点1: UPDATE文に「planned_hires_count ($1)」を追加し、番号をずらしました
    const query = `
      UPDATE clients
      SET
        planned_hires_count = $1,   -- 追加: 採用予定人数
        salary_range = $2,
        must_qualifications = $3,
        nice_qualifications = $4,
        desired_locations = $5,
        personality_traits = $6,
        required_experience = $7,
        selection_note = $8,
        updated_at = NOW()
      WHERE id = $9
      RETURNING id;
    `;

    // ★変更点2: フロントエンドから送られてくるデータのゆらぎを吸収
    // (GET時の desiredTalent の中に入っている場合と、フラットな場合の両方に対応)
    const values = [
      body.plannedHiresCount || 0, // $1: 採用予定人数 (目標)

      // $2: 年収レンジ
      body.salaryRange || body.desiredTalent?.salaryRange || null,
      
      // $3: 必須資格
      body.mustQualifications || body.desiredTalent?.mustQualifications || null,
      
      // $4: 歓迎資格
      body.niceQualifications || body.desiredTalent?.niceQualifications || null,
      
      // $5: 勤務地 (以前の body.locations もケア)
      body.desiredLocations || body.locations || body.desiredTalent?.locations || null,
      
      // $6: 性格 (以前の body.personality もケア)
      body.personalityTraits || body.personality || body.desiredTalent?.personality || null,
      
      // $7: 経験 (以前の body.experiences もケア)
      body.requiredExperience || body.experiences || body.desiredTalent?.experiences || null,
      
      // $8: 選考メモ
      body.selectionNote || null,
      
      // $9: ID
      id
    ];

    const res = await client.query(query, values);

    if (res.rowCount === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Company not found (ID does not exist)" })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Update success",
        id: id,
        updatedFields: body
      })
    };

  } catch (err) {
    console.error('Update Error:', err);
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