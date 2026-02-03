// index.mjs
import pg from "pg";
const { Pool } = pg;

// ① RDS 接続プール
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

// CORS/共通ヘッダ（開発用）
const ALLOWED_ORIGINS = new Set(["http://localhost:8000", "http://localhost:8001"]);
const baseHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization",
};

function buildHeaders(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "*";
  return { ...baseHeaders, "Access-Control-Allow-Origin": allowOrigin };
}

// 率計算（0除算回避、%を1桁小数で返す）
const rate = (numer, denom) => {
  if (!denom || denom === 0) return 0;
  return Math.round((1000 * numer) / denom) / 10; // 1桁小数の%
};

const toNumber = value => Number(value || 0);

const isoDate = date => date.toISOString().split("T")[0];

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

function parseDate(raw) {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolvePrevRange(from, to) {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end || start > end) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((end - start) / dayMs);
  const prevEnd = new Date(start.getTime() - dayMs);
  const prevStart = new Date(prevEnd.getTime() - diffDays * dayMs);
  return { startDate: isoDate(prevStart), endDate: isoDate(prevEnd) };
}

async function fetchCounts(client, { startDate, endDate, advisorUserId }) {
  const sql = `
    SELECT
      COUNT(*) FILTER (WHERE c.first_contact_at::date BETWEEN $1 AND $2)          AS new_interviews,
      COUNT(*) FILTER (WHERE ca.proposal_date::date BETWEEN $1 AND $2)            AS proposals,
      COUNT(*) FILTER (WHERE ca.recommended_at::date BETWEEN $1 AND $2)           AS recommended,
      COUNT(*) FILTER (WHERE ca.first_interview_set_at::date BETWEEN $1 AND $2)   AS first_interview_set,
      COUNT(*) FILTER (WHERE ca.first_interview_at::date BETWEEN $1 AND $2)       AS first_interview_done,
      COUNT(*) FILTER (WHERE ca.offer_date::date BETWEEN $1 AND $2)               AS offers,
      COUNT(*) FILTER (WHERE ca.offer_accept_date::date BETWEEN $1 AND $2)        AS accepts,
      COUNT(*) FILTER (WHERE ca.join_date::date BETWEEN $1 AND $2)                AS hires
    FROM candidates c
    LEFT JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE c.advisor_user_id = $3;
  `;

  const res = await client.query(sql, [startDate, endDate, advisorUserId]);
  const row = res.rows?.[0] || {};

  return {
    newInterviews: toNumber(row.new_interviews),
    proposals: toNumber(row.proposals),
    recommendations: toNumber(row.recommended),
    interviewsScheduled: toNumber(row.first_interview_set),
    interviewsHeld: toNumber(row.first_interview_done),
    offers: toNumber(row.offers),
    accepts: toNumber(row.accepts),
    hires: toNumber(row.hires),
  };
}

function withRates(counts) {
  return {
    ...counts,
    proposalRate: rate(counts.proposals, counts.newInterviews),
    recommendationRate: rate(counts.recommendations, counts.proposals),
    interviewScheduleRate: rate(counts.interviewsScheduled, counts.recommendations),
    interviewHeldRate: rate(counts.interviewsHeld, counts.interviewsScheduled),
    offerRate: rate(counts.offers, counts.interviewsHeld),
    acceptRate: rate(counts.accepts, counts.offers),
    hireRate: rate(counts.hires, counts.newInterviews),
  };
}

// ② Lambda 本体
export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
  const headers = buildHeaders(event);
  if (method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const qs = event.queryStringParameters ?? {};

  // 例: from=2025-12-01&to=2025-12-31（現状運用に合わせて“そのまま”）
  const from = (qs.from || "2025-12-01").trim();
  const to = (qs.to || "2025-12-31").trim();

  // /kpi/yield は advisorUserId を使う
  const advisorUserId = Number(qs.advisorUserId ?? 0);

  const startDate = parseDate(from);
  const endDate = parseDate(to);

  if (!startDate || !endDate || startDate > endDate || !Number.isFinite(advisorUserId) || advisorUserId <= 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "from, to（YYYY-MM-DD）と advisorUserId は必須です",
        example: "/kpi/yield?from=2025-12-01&to=2025-12-31&advisorUserId=2",
      }),
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

    const range = { startDate: isoDate(startDate), endDate: isoDate(endDate) };
    const prevRange = resolvePrevRange(range.startDate, range.endDate);

    const currentCounts = await fetchCounts(client, { ...range, advisorUserId });
    const prevCounts = prevRange
      ? await fetchCounts(client, { ...prevRange, advisorUserId })
      : {
          newInterviews: 0,
          proposals: 0,
          recommendations: 0,
          interviewsScheduled: 0,
          interviewsHeld: 0,
          offers: 0,
          accepts: 0,
          hires: 0,
        };

    const current = withRates(currentCounts);
    const previous = withRates(prevCounts);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        period: { from, to },
        prevPeriod: prevRange,
        advisorUserId,
        kpi: {
          ...current,
          prevNewInterviews: previous.newInterviews,
          prevProposals: previous.proposals,
          prevRecommendations: previous.recommendations,
          prevInterviewsScheduled: previous.interviewsScheduled,
          prevInterviewsHeld: previous.interviewsHeld,
          prevOffers: previous.offers,
          prevAccepts: previous.accepts,
          prevHires: previous.hires,
          prevProposalRate: previous.proposalRate,
          prevRecommendationRate: previous.recommendationRate,
          prevInterviewScheduleRate: previous.interviewScheduleRate,
          prevInterviewHeldRate: previous.interviewHeldRate,
          prevOfferRate: previous.offerRate,
          prevAcceptRate: previous.acceptRate,
          prevHireRate: previous.hireRate,
        },
      }),
    };
  } catch (err) {
    console.error("LAMBDA ERROR:", err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: String(err?.message || err),
        debug: {
          hasDBHost: Boolean((process.env.DB_HOST || "").trim()),
          hasDBName: Boolean(process.env.DB_NAME),
          hasDBUser: Boolean(process.env.DB_USER),
          hasDBPassword: Boolean(process.env.DB_PASSWORD),
        },
      }),
    };
  } finally {
    if (client) client.release();
  }
};
