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

  // OPTIONSリクエスト（CORSプリフライト）対応
  const method =
    event.httpMethod ||
    event.requestContext?.http?.method ||
    event.requestContext?.httpMethod;

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (method !== 'POST' && method !== 'PUT') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
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

    // IDがあるかどうかで「更新」か「新規」かを判定
    // パスパラメータ(URL) または ボディ(JSON) からIDを取得
    const updateId = event.pathParameters?.id || body.id;

    client = await pool.connect();

    // ==========================================================
    // パターンA: IDがある場合 → 更新 (UPDATE)
    // ==========================================================
    if (updateId) {
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

      addIfProvided('name', ['name', 'companyName']);
      addIfProvided('industry', ['industry']);
      addIfProvided('location', ['location']);
      addIfProvided('job_categories', ['jobCategories', 'job_categories', 'jobTitle']);
      addIfProvided('planned_hires_count', ['plannedHiresCount', 'planned_hires_count'], null, parseOptionalNumber);
      addIfProvided('selection_note', ['selectionNote', 'selection_note']);
      addIfProvided('contact_name', ['contactName', 'contact_name']);
      addIfProvided('contact_email', ['contactEmail', 'contact_email']);
      addIfProvided('warranty_period', ['warrantyPeriod', 'warranty_period'], null, parseOptionalNumber);
      addIfProvided('fee_details', ['feeDetails', 'feeContract', 'fee_details']);
      addIfProvided('contract_note', ['contractNote', 'contractNotes', 'contract_note']);
      addIfProvided('salary_range', ['salaryRange'], 'salaryRange');
      addIfProvided('must_qualifications', ['mustQualifications'], 'mustQualifications');
      addIfProvided('nice_qualifications', ['niceQualifications'], 'niceQualifications');
      addIfProvided('desired_locations', ['desiredLocations', 'locations'], 'locations');
      addIfProvided('personality_traits', ['personalityTraits', 'personality'], 'personality');
      addIfProvided('required_experience', ['requiredExperience', 'experiences'], 'experiences');

      if (!updates.length) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "No updatable fields provided" }) };
      }

      updates.push('updated_at = NOW()');
      values.push(updateId);

      const updateQuery = `
        UPDATE clients
        SET ${updates.join(', ')}
        WHERE id = $${values.length}
        RETURNING *;
      `;

      const res = await client.query(updateQuery, values);
      
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
    // パターンB: IDがない場合 → 新規登録 (INSERT)
    // ==========================================================
    if (!body.name && !body.companyName) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Company name is required" }) };
    }

    const companyName = body.name || body.companyName;
    const insertQuery = `
      INSERT INTO clients (
        name, industry, location, job_categories, planned_hires_count, selection_note,
        contact_name, contact_email, warranty_period, fee_details, contract_note,
        salary_range, must_qualifications, nice_qualifications, desired_locations,
        personality_traits, required_experience,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17,
        NOW(), NOW()
      )
      RETURNING id, name, created_at;
    `;

    const insertValues = [
      companyName,
      body.industry ?? null,
      body.location ?? null,
      body.jobCategories ?? body.jobTitle ?? body.job_categories ?? null,
      parseOptionalNumber(body.plannedHiresCount ?? body.planned_hires_count) ?? 0,
      body.selectionNote ?? body.selection_note ?? null,
      body.contactName ?? body.contact_name ?? null,
      body.contactEmail ?? body.contact_email ?? null,
      parseOptionalNumber(body.warrantyPeriod ?? body.warranty_period),
      body.feeDetails ?? body.feeContract ?? body.fee_details ?? null,
      body.contractNote ?? body.contractNotes ?? body.contract_note ?? null,
      pickValue(['salaryRange'], 'salaryRange') ?? null,
      pickValue(['mustQualifications'], 'mustQualifications') ?? null,
      pickValue(['niceQualifications'], 'niceQualifications') ?? null,
      pickValue(['desiredLocations', 'locations'], 'locations') ?? null,
      pickValue(['personalityTraits', 'personality'], 'personality') ?? null,
      pickValue(['requiredExperience', 'experiences'], 'experiences') ?? null
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
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  } finally {
    if (client) client.release();
  }
};
