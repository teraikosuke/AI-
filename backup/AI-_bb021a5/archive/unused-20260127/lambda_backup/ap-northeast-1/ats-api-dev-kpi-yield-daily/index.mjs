// index.mjs
import pg from "pg";
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
  connectionTimeoutMillis: 3000
});

const ALLOWED_ORIGINS = new Set(["http://localhost:8000", "http://localhost:8081"]);
const baseHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization"
};

function buildHeaders(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "*";
  return { ...baseHeaders, "Access-Control-Allow-Origin": allowOrigin };
}

function parseDate(raw) {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoDate(d) {
  return d.toISOString().split("T")[0];
}

function ensureDbEnv() {
  const hasHost = Boolean((process.env.DB_HOST || "").trim());
  const hasName = Boolean(process.env.DB_NAME);
  const hasUser = Boolean(process.env.DB_USER);
  const hasPassword = Boolean(process.env.DB_PASSWORD);
  return {
    ok: hasHost && hasName && hasUser && hasPassword
  };
}

const METRIC_SQL = `
  SELECT c.advisor_user_id AS advisor_user_id,
         c.first_contact_at::date AS day,
         'newInterviews' AS metric,
         COUNT(*)::int AS count
  FROM candidates c
  WHERE c.first_contact_at::date BETWEEN $1 AND $2
  GROUP BY c.advisor_user_id, day
  UNION ALL
  SELECT c.advisor_user_id,
         ca.proposal_date::date,
         'proposals' AS metric,
         COUNT(*)::int
  FROM candidates c
  JOIN candidate_applications ca ON ca.candidate_id = c.id
  WHERE ca.proposal_date::date BETWEEN $1 AND $2
  GROUP BY c.advisor_user_id, ca.proposal_date::date
  UNION ALL
  SELECT c.advisor_user_id,
         ca.recommended_at::date,
         'recommendations' AS metric,
         COUNT(*)::int
  FROM candidates c
  JOIN candidate_applications ca ON ca.candidate_id = c.id
  WHERE ca.recommended_at::date BETWEEN $1 AND $2
  GROUP BY c.advisor_user_id, ca.recommended_at::date
  UNION ALL
  SELECT c.advisor_user_id,
         ca.first_interview_set_at::date,
         'interviewsScheduled' AS metric,
         COUNT(*)::int
  FROM candidates c
  JOIN candidate_applications ca ON ca.candidate_id = c.id
  WHERE ca.first_interview_set_at::date BETWEEN $1 AND $2
  GROUP BY c.advisor_user_id, ca.first_interview_set_at::date
  UNION ALL
  SELECT c.advisor_user_id,
         ca.first_interview_at::date,
         'interviewsHeld' AS metric,
         COUNT(*)::int
  FROM candidates c
  JOIN candidate_applications ca ON ca.candidate_id = c.id
  WHERE ca.first_interview_at::date BETWEEN $1 AND $2
  GROUP BY c.advisor_user_id, ca.first_interview_at::date
  UNION ALL
  SELECT c.advisor_user_id,
         ca.offer_date::date,
         'offers' AS metric,
         COUNT(*)::int
  FROM candidates c
  JOIN candidate_applications ca ON ca.candidate_id = c.id
  WHERE ca.offer_date::date BETWEEN $1 AND $2
  GROUP BY c.advisor_user_id, ca.offer_date::date
  UNION ALL
  SELECT c.advisor_user_id,
         ca.offer_accept_date::date,
         'accepts' AS metric,
         COUNT(*)::int
  FROM candidates c
  JOIN candidate_applications ca ON ca.candidate_id = c.id
  WHERE ca.offer_accept_date::date BETWEEN $1 AND $2
  GROUP BY c.advisor_user_id, ca.offer_accept_date::date
`;

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
  const headers = buildHeaders(event);
  if (method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (method !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const qs = event.queryStringParameters ?? {};
  const from = (qs.from || "").trim();
  const to = (qs.to || "").trim();
  const startDate = parseDate(from);
  const endDate = parseDate(to);

  if (!startDate || !endDate || startDate > endDate) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "from/to (YYYY-MM-DD) are required" })
    };
  }

  const advisorUserId = Number(qs.advisorUserId || 0);
  const hasAdvisor = Number.isFinite(advisorUserId) && advisorUserId > 0;

  const env = ensureDbEnv();
  if (!env.ok) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "DB env vars missing" }) };
  }

  let client;
  try {
    client = await pool.connect();
    const res = await client.query(METRIC_SQL, [isoDate(startDate), isoDate(endDate)]);

    const dailyByAdvisor = new Map();
    res.rows.forEach(row => {
      const id = String(row.advisor_user_id || "");
      if (!id) return;
      const day = typeof row.day === "string" ? row.day : isoDate(new Date(row.day));
      if (!dailyByAdvisor.has(id)) dailyByAdvisor.set(id, {});
      const daily = dailyByAdvisor.get(id);
      if (!daily[day]) daily[day] = {};
      daily[day][row.metric] = Number(row.count || 0);
    });

    const idSet = new Set(dailyByAdvisor.keys());
    if (hasAdvisor) idSet.add(String(advisorUserId));
    const idList = Array.from(idSet).map(Number).filter(n => Number.isFinite(n) && n > 0);

    let nameById = new Map();
    if (idList.length) {
      const users = await client.query("SELECT id, name FROM users WHERE id = ANY($1::int[])", [idList]);
      nameById = new Map(users.rows.map(r => [String(r.id), r.name || `ID:${r.id}`]));
    }

    const employees = Array.from(idSet).map(id => ({
      advisorUserId: Number(id),
      name: nameById.get(id) || `ID:${id}`,
      daily: dailyByAdvisor.get(id) || {}
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        period: { from: isoDate(startDate), to: isoDate(endDate) },
        personal: hasAdvisor ? { advisorUserId, daily: dailyByAdvisor.get(String(advisorUserId)) || {} } : null,
        employees
      })
    };
  } catch (error) {
    console.error("yield daily error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Internal Server Error" }) };
  } finally {
    if (client) client.release();
  }
};
