import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;

const pool = new Pool({
  host: (process.env.DB_HOST || "").trim(),
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 2,
  idleTimeoutMillis: 30000,
});

const ALLOW_HEADERS = "content-type,authorization";
const ALLOW_METHODS = "GET,POST,PUT,DELETE,OPTIONS";
const ALLOWED_ORIGINS = new Set([
  "http://localhost:8000",
  "http://localhost:8001",
  "http://localhost:8081",
]);

const JWT_SECRET = (process.env.JWT_SECRET || "dev-secret-change-me").trim();
const SES_REGION = (process.env.SES_REGION || process.env.AWS_REGION || "").trim();
const SES_FROM = (process.env.SES_FROM || "").trim();
const SES_TO = (process.env.SES_TO || "").trim();
const ROLE_ALLOWLIST = new Set(
  (process.env.MEMBER_ALLOWED_ROLES || "advisor,caller,marketing")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

let memberRequestsTableReady = false;
let sesClientPromise = null;

function buildCorsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
}

function json(headers, statusCode, bodyObj) {
  return {
    statusCode,
    headers,
    body: bodyObj === undefined ? "" : JSON.stringify(bodyObj),
  };
}

function parseJsonBody(event) {
  if (!event?.body) return null;
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function base64urlEncodeBuffer(buf) {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function verifyToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;
  const expected = base64urlEncodeBuffer(
    crypto.createHmac("sha256", JWT_SECRET).update(data).digest()
  );

  if (signature.length !== expected.length) return null;
  const matches = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
  if (!matches) return null;

  let decoded;
  try {
    decoded = JSON.parse(base64urlDecode(payload));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp && now > decoded.exp) return null;

  return decoded;
}

function getAuthPayload(event) {
  const authHeader = event?.headers?.authorization || event?.headers?.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;
  return verifyToken(token);
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }
  return false;
}

function getPath(event) {
  return event?.rawPath || event?.path || "";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  if (!value) return false;
  if (value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseEmailList(raw) {
  return String(raw || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function ensureMemberRequestsTable(client) {
  if (memberRequestsTableReady) return;
  await client.query(
    `
      CREATE TABLE IF NOT EXISTS member_requests (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        status TEXT NOT NULL DEFAULT 'pending',
        requested_by TEXT,
        requested_by_name TEXT,
        approved_by TEXT,
        approved_by_name TEXT,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        approved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
  );
  await client.query(
    `
      CREATE INDEX IF NOT EXISTS idx_member_requests_status
      ON member_requests (status);
    `
  );
  memberRequestsTableReady = true;
}

async function getSesClient() {
  if (sesClientPromise) return sesClientPromise;
  sesClientPromise = (async () => {
    const mod = await import("aws-sdk");
    const AWS = mod.default || mod;
    return new AWS.SES({ region: SES_REGION || process.env.AWS_REGION });
  })();
  return sesClientPromise;
}

async function sendNewMemberRequestEmail({ request, requestedByName }) {
  if (!SES_FROM || !SES_TO) {
    throw new Error("SES_FROM or SES_TO is missing");
  }
  const toAddresses = parseEmailList(SES_TO);
  if (!toAddresses.length) {
    throw new Error("SES_TO is empty");
  }
  const ses = await getSesClient();
  const subject = "新規メンバー登録リクエスト";
  const lines = [
    "新規登録申請が届きました。",
    "",
    `申請ID: ${request.id}`,
    `氏名: ${request.name}`,
    `メール: ${request.email}`,
    `役割: ${request.role}`,
    `管理者: ${request.is_admin ? "はい" : "いいえ"}`,
    `申請者: ${requestedByName || "-"}`,
    `申請日時: ${request.requested_at}`,
    "",
    "承認するには管理画面の承認待ち一覧、または承認APIを実行してください。",
  ];

  const params = {
    Source: SES_FROM,
    Destination: { ToAddresses: toAddresses },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: { Text: { Data: lines.join("\n"), Charset: "UTF-8" } },
    },
  };

  await ses.sendEmail(params).promise();
}

function pickId(event) {
  const raw =
    event?.pathParameters?.id ||
    event?.pathParameters?.memberId ||
    event?.queryStringParameters?.id ||
    "";
  if (typeof raw !== "string") return "";
  return decodeURIComponent(raw).trim();
}

export const handler = async (event) => {
  const method =
    event?.requestContext?.http?.method || event?.httpMethod || "GET";
  const path = getPath(event);
  const normalizedPath = path.replace(/\/+$/, "");
  const origin = event?.headers?.origin || event?.headers?.Origin || "";
  const headers = buildCorsHeaders(origin);

  if (method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const payload = getAuthPayload(event);
  if (!payload) {
    return json(headers, 401, { error: "Unauthorized" });
  }

  const isAdmin = payload.role === "admin";

  let client;
  try {
    client = await pool.connect();

    if (method === "GET" && normalizedPath.endsWith("/members/requests")) {
      if (!isAdmin) {
        return json(headers, 403, { error: "Forbidden" });
      }
      await ensureMemberRequestsTable(client);
      const statusRaw =
        event?.queryStringParameters?.status || "pending";
      const status = String(statusRaw || "").trim().toLowerCase();
      const allowedStatuses = new Set(["pending", "approved", "rejected"]);
      const normalizedStatus = allowedStatuses.has(status)
        ? status
        : "pending";

      const result = await client.query(
        `
          SELECT id, name, email, role, is_admin, status,
                 requested_by, requested_by_name, requested_at
          FROM member_requests
          WHERE status = $1
          ORDER BY requested_at DESC
        `,
        [normalizedStatus]
      );

      const items = result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        isAdmin: row.is_admin,
        status: row.status,
        requestedBy: row.requested_by,
        requestedByName: row.requested_by_name,
        requestedAt: row.requested_at,
      }));

      return json(headers, 200, { items });
    }

    if (method === "GET") {
      const result = await client.query(
        `
          SELECT id, name, email, role, is_admin, created_at, updated_at
          FROM users
          ORDER BY created_at DESC
        `
      );

      const items = result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        isAdmin: row.is_admin,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return json(headers, 200, { items });
    }

    if (method === "POST" && normalizedPath.endsWith("/members/approve")) {
      if (!isAdmin) {
        return json(headers, 403, { error: "Forbidden" });
      }
      await ensureMemberRequestsTable(client);
      const body = parseJsonBody(event);
      const requestId = String(body?.requestId || body?.id || "").trim();
      if (!requestId) {
        return json(headers, 400, { error: "requestId is required" });
      }

      await client.query("BEGIN");
      try {
        const requestResult = await client.query(
          `
            SELECT id, name, email, role, is_admin, password_hash, status, requested_at
            FROM member_requests
            WHERE id = $1
            FOR UPDATE
          `,
          [requestId]
        );
        if (requestResult.rowCount === 0) {
          await client.query("ROLLBACK");
          return json(headers, 404, { error: "Request not found" });
        }

        const request = requestResult.rows[0];
        if (request.status !== "pending") {
          await client.query("ROLLBACK");
          return json(headers, 409, { error: "Request already processed" });
        }

        const existing = await client.query(
          `
            SELECT id
            FROM users
            WHERE LOWER(email) = $1
            LIMIT 1
          `,
          [normalizeEmail(request.email)]
        );
        if (existing.rowCount > 0) {
          await client.query("ROLLBACK");
          return json(headers, 409, { error: "Email already exists" });
        }

        const userResult = await client.query(
          `
            INSERT INTO users (name, email, role, password_hash, is_admin, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            RETURNING id, name, email, role, is_admin, created_at, updated_at
          `,
          [
            request.name,
            request.email,
            request.role,
            request.password_hash,
            request.is_admin,
          ]
        );

        await client.query(
          `
            UPDATE member_requests
            SET status = 'approved',
                approved_at = NOW(),
                approved_by = $1,
                approved_by_name = $2,
                updated_at = NOW()
            WHERE id = $3
          `,
          [String(payload.sub || ""), payload.name || "", requestId]
        );

        await client.query("COMMIT");

        return json(headers, 200, {
          requestId,
          member: {
            id: userResult.rows[0].id,
            name: userResult.rows[0].name,
            email: userResult.rows[0].email,
            role: userResult.rows[0].role,
            isAdmin: userResult.rows[0].is_admin,
            createdAt: userResult.rows[0].created_at,
            updatedAt: userResult.rows[0].updated_at,
          },
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    if (method === "POST") {
      if (!isAdmin) {
        return json(headers, 403, { error: "Forbidden" });
      }
      await ensureMemberRequestsTable(client);
      const body = parseJsonBody(event);
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      const email = typeof body?.email === "string" ? body.email.trim() : "";
      const role = typeof body?.role === "string" ? body.role.trim() : "";
      const password = typeof body?.password === "string" ? body.password : "";
      const adminFlag = parseBoolean(body?.isAdmin ?? body?.is_admin);
      const normalizedEmail = normalizeEmail(email);
      const normalizedRole = role.toLowerCase();

      if (!name || !email || !role || !password) {
        return json(headers, 400, {
          error: "name, email, role, password are required",
        });
      }
      if (!isValidEmail(normalizedEmail)) {
        return json(headers, 400, { error: "email is invalid" });
      }
      if (ROLE_ALLOWLIST.size && !ROLE_ALLOWLIST.has(normalizedRole)) {
        return json(headers, 400, { error: "role is invalid" });
      }

      const userExists = await client.query(
        `
          SELECT id
          FROM users
          WHERE LOWER(email) = $1
          LIMIT 1
        `,
        [normalizedEmail]
      );
      if (userExists.rowCount > 0) {
        return json(headers, 409, { error: "Email already exists" });
      }

      const pendingExists = await client.query(
        `
          SELECT id
          FROM member_requests
          WHERE LOWER(email) = $1
            AND status = 'pending'
          LIMIT 1
        `,
        [normalizedEmail]
      );
      if (pendingExists.rowCount > 0) {
        return json(headers, 409, { error: "Request already pending" });
      }

      const result = await client.query(
        `
          INSERT INTO member_requests
            (name, email, role, password_hash, is_admin, status,
             requested_by, requested_by_name, requested_at, created_at, updated_at)
          VALUES
            ($1, $2, $3, crypt($4, gen_salt('bf')), $5, 'pending',
             $6, $7, NOW(), NOW(), NOW())
          RETURNING id, name, email, role, is_admin, status, requested_at
        `,
        [
          name,
          normalizedEmail,
          normalizedRole,
          password,
          adminFlag,
          String(payload.sub || ""),
          payload.name || "",
        ]
      );

      const request = result.rows[0];
      let mailStatus = "sent";
      try {
        await sendNewMemberRequestEmail({
          request,
          requestedByName: payload.name || "",
        });
      } catch (error) {
        mailStatus = "failed";
        console.error("members notification error:", error);
      }

      return json(headers, 202, {
        requestId: request.id,
        status: request.status,
        notification: {
          status: mailStatus,
        },
      });
    }

    if (method === "PUT") {
      const body = parseJsonBody(event);
      const id = String(pickId(event) || body?.id || "").trim();
      if (!id) {
        return json(headers, 400, { error: "id is required" });
      }

      const isSelf = String(payload.sub || "") === id;
      if (!isAdmin && !isSelf) {
        return json(headers, 403, { error: "Forbidden" });
      }

      let result;
      if (isAdmin) {
        const name = typeof body?.name === "string" ? body.name.trim() : "";
        const role = typeof body?.role === "string" ? body.role.trim() : "";
        const password = typeof body?.password === "string" ? body.password : "";
        const adminFlag = parseBoolean(body?.isAdmin ?? body?.is_admin);

        if (!name || !role) {
          return json(headers, 400, { error: "name, role are required" });
        }

        const params = [name, role, adminFlag];
        const setClauses = ["name = $1", "role = $2", "is_admin = $3"];
        if (password) {
          params.push(password);
          setClauses.push(`password_hash = crypt($${params.length}, gen_salt('bf'))`);
        }
        setClauses.push("updated_at = NOW()");
        params.push(id);

        result = await client.query(
          `
            UPDATE users
            SET ${setClauses.join(", ")}
            WHERE id = $${params.length}
            RETURNING id, name, email, role, is_admin, created_at, updated_at
          `,
          params
        );
      } else {
        const name = typeof body?.name === "string" ? body.name.trim() : "";
        const password = typeof body?.password === "string" ? body.password : "";
        if (!name && !password) {
          return json(headers, 400, { error: "name or password is required" });
        }

        const params = [];
        const setClauses = [];
        if (name) {
          params.push(name);
          setClauses.push(`name = $${params.length}`);
        }
        if (password) {
          params.push(password);
          setClauses.push(`password_hash = crypt($${params.length}, gen_salt('bf'))`);
        }
        setClauses.push("updated_at = NOW()");
        params.push(id);

        result = await client.query(
          `
            UPDATE users
            SET ${setClauses.join(", ")}
            WHERE id = $${params.length}
            RETURNING id, name, email, role, is_admin, created_at, updated_at
          `,
          params
        );
      }

      if (result.rowCount === 0) {
        return json(headers, 404, { error: "Member not found" });
      }

      return json(headers, 200, {
        member: {
          id: result.rows[0].id,
          name: result.rows[0].name,
          email: result.rows[0].email,
          role: result.rows[0].role,
          isAdmin: result.rows[0].is_admin,
          createdAt: result.rows[0].created_at,
          updatedAt: result.rows[0].updated_at,
        },
      });
    }

    if (method === "DELETE") {
      if (!isAdmin) {
        return json(headers, 403, { error: "Forbidden" });
      }
      const body = parseJsonBody(event);
      const id = String(pickId(event) || body?.id || "").trim();
      if (!id) {
        return json(headers, 400, { error: "id is required" });
      }

      const result = await client.query(
        `
          DELETE FROM users
          WHERE id = $1
          RETURNING id
        `,
        [id]
      );

      if (result.rowCount === 0) {
        return json(headers, 404, { error: "Member not found" });
      }

      return json(headers, 200, { deleted: true, id: result.rows[0].id });
    }

    return json(headers, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error("members error:", error);
    if (error?.code === "23505") {
      return json(headers, 409, { error: "Email already exists" });
    }
    return json(headers, 500, { error: "Internal Server Error" });
  } finally {
    if (client) client.release();
  }
};
