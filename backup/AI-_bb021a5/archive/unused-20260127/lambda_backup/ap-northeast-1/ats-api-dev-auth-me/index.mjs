// index.mjs
import crypto from "crypto";

const ALLOWED_ORIGINS = new Set(["http://localhost:8000", "http://localhost:8001"]);
const baseHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization",
};

const JWT_SECRET = (process.env.JWT_SECRET || "dev-secret-change-me").trim();

function buildHeaders(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "*";
  return { ...baseHeaders, "Access-Control-Allow-Origin": allowOrigin };
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

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
  const headers = buildHeaders(event);
  if (method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (method !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const authHeader = event?.headers?.authorization || event?.headers?.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    }),
  };
};
