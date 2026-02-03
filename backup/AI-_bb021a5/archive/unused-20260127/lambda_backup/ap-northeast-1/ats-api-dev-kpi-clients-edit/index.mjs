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

    const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
    const desiredTalent =
      hasOwn(body, 'desiredTalent') && body.desiredTalent && typeof body.desiredTalent === 'object'
        ? body.desiredTalent
        : null;
    const hasNested = (key) => Boolean(desiredTalent && hasOwn(desiredTalent, key));
    const pickValue = (keys, nestedKey) => {
      for (const key of keys) {
        if (hasOwn(body, key)) return body[key];
      }
      if (nestedKey && hasNested(nestedKey)) return desiredTalent[nestedKey];
      return undefined;
    };
    const shouldUpdate = (keys, nestedKey) => {
      if (keys.some((key) => hasOwn(body, key))) return true;
      return Boolean(nestedKey && hasNested(nestedKey));
    };
    const parseOptionalNumber = (value) => {
      if (value === undefined || value === null || value === '') return null;
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };

    const updates = [];
    const values = [];
    const addField = (column, value) => {
      values.push(value ?? null);
      updates.push(`${column} = $${values.length}`);
    };
    const addIfProvided = (column, keys, nestedKey, transform) => {
      if (!shouldUpdate(keys, nestedKey)) return;
      const raw = pickValue(keys, nestedKey);
      const value = transform ? transform(raw) : raw;
      addField(column, value);
    };

    addIfProvided('planned_hires_count', ['plannedHiresCount', 'planned_hires_count'], null, parseOptionalNumber);
    addIfProvided('salary_range', ['salaryRange'], 'salaryRange');
    addIfProvided('must_qualifications', ['mustQualifications'], 'mustQualifications');
    addIfProvided('nice_qualifications', ['niceQualifications'], 'niceQualifications');
    addIfProvided('desired_locations', ['desiredLocations', 'locations'], 'locations');
    addIfProvided('personality_traits', ['personalityTraits', 'personality'], 'personality');
    addIfProvided('required_experience', ['requiredExperience', 'experiences'], 'experiences');
    addIfProvided('selection_note', ['selectionNote']);
    addIfProvided('contact_name', ['contactName', 'contact_name']);
    addIfProvided('contact_email', ['contactEmail', 'contact_email']);
    addIfProvided('warranty_period', ['warrantyPeriod', 'warranty_period'], null, parseOptionalNumber);
    addIfProvided('fee_details', ['feeDetails', 'feeContract', 'fee_details']);
    addIfProvided('contract_note', ['contractNote', 'contractNotes', 'contract_note']);

    if (!updates.length) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No updatable fields provided" })
      };
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    const query = `
      UPDATE clients
      SET ${updates.join(', ')}
      WHERE id = $${values.length}
      RETURNING id;
    `;

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
