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
  const origin = event?.headers?.origin || event?.headers?.Origin || "";
  const headers = buildCorsHeaders(origin);

  if (method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const payload = getAuthPayload(event);
  if (!payload) {
    return json(headers, 401, { error: "Unauthorized" });
  }

  let client;
  try {
    client = await pool.connect();

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

    const isAdmin = payload.role === "admin";

    if (method === "POST") {
      if (!isAdmin) {
        return json(headers, 403, { error: "Forbidden" });
      }
      const body = parseJsonBody(event);
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      const email = typeof body?.email === "string" ? body.email.trim() : "";
      const role = typeof body?.role === "string" ? body.role.trim() : "";
      const password = typeof body?.password === "string" ? body.password : "";
      const isAdmin = parseBoolean(body?.isAdmin ?? body?.is_admin);

      if (!name || !email || !role || !password) {
        return json(headers, 400, { error: "name, email, role, password are required" });
      }

      const result = await client.query(
        `
          INSERT INTO users (name, email, role, password_hash, is_admin, created_at, updated_at)
          VALUES ($1, $2, $3, crypt($4, gen_salt('bf')), $5, NOW(), NOW())
          RETURNING id, name, email, role, is_admin, created_at, updated_at
        `,
        [name, email, role, password, isAdmin]
      );

      return json(headers, 201, {
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
