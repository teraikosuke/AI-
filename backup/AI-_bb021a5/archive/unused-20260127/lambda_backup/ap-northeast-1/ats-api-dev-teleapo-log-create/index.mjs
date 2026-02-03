import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  host: (process.env.DB_HOST || "").trim(),
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS,POST,PUT,DELETE",
  "Access-Control-Allow-Headers": "content-type,authorization",
};

const readBody = (event) => {
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf-8")
    : event.body;
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  return JSON.parse(raw);
};

const hasColumn = async (client, tableName, columnName) => {
  const res = await client.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1`,
    [tableName, columnName]
  );
  return res.rowCount > 0;
};

const resolveCandidateNameColumn = async (client) => {
  const res = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'candidates'
        AND column_name IN ('candidate_name','name')`
  );
  const cols = new Set(res.rows.map((r) => r.column_name));
  if (cols.has("candidate_name")) return "candidate_name";
  if (cols.has("name")) return "name";
  return "name";
};

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log("EVENT START:", JSON.stringify(event));

  const method =
    event?.requestContext?.http?.method ||
    event?.httpMethod ||
    "POST";

  if (method === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (!["POST", "PUT", "DELETE"].includes(method)) {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let client;
  try {
    let body = {};
    try {
      body = readBody(event);
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON body" }),
      };
    }

    // DELETE: 架電ログ削除
    if (method === "DELETE") {
      const idRaw =
        body.id ??
        event.pathParameters?.id ??
        event.queryStringParameters?.id;

      const idNum = Number(idRaw);
      if (!Number.isFinite(idNum)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "id is required" }),
        };
      }

      client = await pool.connect();
      // ★確認: ここは元のコードで既に teleapo になっていました（修正不要）
      const delRes = await client.query(
        "DELETE FROM teleapo WHERE id = $1 RETURNING id",
        [idNum]
      );

      if (delRes.rowCount === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "Log not found" }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: "Deleted", id: idNum }),
      };
    }

    // POST / PUT: 架電ログ作成
    const {
      candidateId,
      candidateName,
      callerUserId,
      calledAt,
      route,
      result,
      memo,
      callNo,
    } = body;

    if (!callerUserId || (!candidateId && !candidateName)) {
      throw new Error("Missing required fields");
    }

    const callerUserIdNum = Number(callerUserId);
    if (!Number.isFinite(callerUserIdNum)) {
      throw new Error("callerUserId must be number");
    }

    let candidateIdNum = candidateId ? Number(candidateId) : null;
    if (candidateId && !Number.isFinite(candidateIdNum)) {
      throw new Error("candidateId must be number");
    }

    const candidateNameTrim = (candidateName || "").trim();
    const calledAtValue = calledAt || new Date().toISOString();

    client = await pool.connect();
    await client.query("BEGIN");

    const candidateNameColumn = await resolveCandidateNameColumn(client);
    const candidatesHasKintone = await hasColumn(client, "candidates", "kintone_app_id");
    const kintoneAppId = (body.kintoneAppId || body.kintone_app_id || process.env.KINTONE_APP_ID || "").trim();

    if (!candidateIdNum) {
      if (!candidateNameTrim) throw new Error("Missing required fields");

      const findRes = await client.query(
        `SELECT id FROM candidates WHERE ${candidateNameColumn} = $1 ORDER BY id DESC LIMIT 1`,
        [candidateNameTrim]
      );

      if (findRes.rowCount) {
        candidateIdNum = findRes.rows[0].id;
      } else {
        const cols = [candidateNameColumn];
        const params = [candidateNameTrim];
        const vals = ["$1"];

        if (candidatesHasKintone && kintoneAppId) {
          cols.push("kintone_app_id");
          vals.push(`$${params.length + 1}`);
          params.push(kintoneAppId);
        }

        cols.push("created_at", "updated_at");
        vals.push("NOW()", "NOW()");

        const insertSql = `INSERT INTO candidates (${cols.join(", ")}) VALUES (${vals.join(", ")}) RETURNING id`;
        const insertRes = await client.query(insertSql, params);
        candidateIdNum = insertRes.rows[0].id;
      }
    }

    let nextNo;
    const callNoNum = Number(callNo);
    if (Number.isFinite(callNoNum) && callNoNum > 0) {
      nextNo = callNoNum;
    } else {
      // ★修正: FROM teleapo_logs を FROM teleapo に変更
      const countRes = await client.query(
        "SELECT COALESCE(MAX(call_no), 0) + 1 AS next_no FROM teleapo WHERE candidate_id = $1",
        [candidateIdNum]
      );
      nextNo = countRes.rows[0].next_no;
    }

    // ★修正: INSERT INTO teleapo_logs を INSERT INTO teleapo に変更
    const insertRes = await client.query(
      `
      INSERT INTO teleapo (candidate_id, caller_user_id, call_no, called_at, route, result, memo, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id
    `,
      [candidateIdNum, callerUserIdNum, nextNo, calledAtValue, route ?? null, result ?? null, memo ?? null]
    );

    const newLogId = insertRes.rows[0].id;

    let updateParts = ["updated_at = NOW()"];
    let updateParams = [candidateIdNum];
    let pIdx = 2;
    updateParts.push(`first_call_at = COALESCE(first_call_at, $${pIdx})`);
    updateParams.push(calledAtValue);
    pIdx++;
    if ((result || "").match(/通電|connect/)) updateParts.push("is_connected = TRUE");
    if ((route || "").toLowerCase().includes("sms")) updateParts.push("sms_sent_flag = TRUE");

    await client.query(
      `UPDATE candidates SET ${updateParts.join(", ")} WHERE id = $1`,
      updateParams
    );

    await client.query("COMMIT");
    console.log(`Success LogID: ${newLogId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Success", id: newLogId }),
    };
  } catch (err) {
    console.error("LAMBDA ERROR:", err);
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (e) {}
    }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: String(err?.message || err) }),
    };
  } finally {
    if (client) client.release();
  }
};