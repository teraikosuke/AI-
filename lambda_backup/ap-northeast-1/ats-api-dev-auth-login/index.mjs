// index.mjs
import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;

const pool = new Pool({
  host: (process.env.DB_HOST || "").trim(),
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

const ALLOWED_ORIGINS = new Set(["http://localhost:8000", "http://localhost:8001"]);
const baseHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization",
};

const JWT_SECRET = (process.env.JWT_SECRET || "dev-secret-change-me").trim();
const TOKEN_TTL_HOURS = Number(process.env.JWT_TTL_HOURS || 12);

function buildHeaders(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "*";
  return { ...baseHeaders, "Access-Control-Allow-Origin": allowOrigin };
}

function ensureDbEnv() {
  const hasHost = Boolean((process.env.DB_HOST || "").trim());
  const hasName = Boolean(process.env.DB_NAME);
  const hasUser = Boolean(process.env.DB_USER);
  const hasPassword = Boolean(process.env.DB_PASSWORD);
  return {
    ok: hasHost && hasName && hasUser && hasPassword,
    debug: {
      hasDBHost: hasHost,
      hasDBName: hasName,
      hasDBUser: hasUser,
      hasDBPassword: hasPassword,
    },
  };
}

function base64urlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlEncodeBuffer(buf) {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signToken(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const data = `${base64urlEncode(JSON.stringify(header))}.${base64urlEncode(JSON.stringify(payload))}`;
  const signature = base64urlEncodeBuffer(
    crypto.createHmac("sha256", JWT_SECRET).update(data).digest()
  );
  return `${data}.${signature}`;
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

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
  const headers = buildHeaders(event);
  if (method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (method !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const body = parseJsonBody(event);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "email and password are required" }),
    };
  }

  const envCheck = ensureDbEnv();
  if (!envCheck.ok) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "DB env vars are missing", debug: envCheck.debug }),
    };
  }

  let client;
  try {
    client = await pool.connect();

    const result = await client.query(
      `
        SELECT id, email, name, role, is_admin
        FROM users
        WHERE email = $1
          AND password_hash = crypt($2, password_hash)
        LIMIT 1
      `,
      [email, password]
    );

    if (result.rowCount === 0) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Invalid credentials" }),
      };
    }

    const user = result.rows[0];
    const appRole = user.is_admin ? "admin" : "member";

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: appRole,
      iat: now,
      exp: now + TOKEN_TTL_HOURS * 60 * 60,
    };

    const token = signToken(payload);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: appRole,
        },
      }),
    };
  } catch (err) {
    console.error("LAMBDA ERROR:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  } finally {
    if (client) client.release();
  }
};
