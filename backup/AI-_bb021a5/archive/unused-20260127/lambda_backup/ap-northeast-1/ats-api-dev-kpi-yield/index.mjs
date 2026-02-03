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
  connectionTimeoutMillis: 3000,
});

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

function getPath(event) {
  return event?.rawPath || event?.path || "";
}

function parseDate(raw) {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoDate(date) {
  return date.toISOString().split("T")[0];
}

function ensureDbEnv() {
  const hasHost = Boolean((process.env.DB_HOST || "").trim());
  const hasName = Boolean(process.env.DB_NAME);
  const hasUser = Boolean(process.env.DB_USER);
  const hasPassword = Boolean(process.env.DB_PASSWORD);
  return {
    ok: hasHost && hasName && hasUser && hasPassword,
    debug: { hasDBHost: hasHost, hasDBName: hasName, hasDBUser: hasUser, hasDBPassword: hasPassword },
  };
}

function resolveScope(event) {
  const qs = event?.queryStringParameters ?? {};
  if (qs.scope) return String(qs.scope).toLowerCase();
  const path = getPath(event);
  if (path.includes("/personal")) return "personal";
  if (path.includes("/company")) return "company";
  return "company";
}

function normalizeGranularity(raw) {
  const value = String(raw || "summary").toLowerCase();
  if (["day", "daily"].includes(value)) return "day";
  if (["month", "monthly"].includes(value)) return "month";
  return "summary";
}

function normalizeCalcMode(raw) {
  return String(raw || "").toLowerCase() === "cohort" ? "cohort" : "period";
}

function normalizeTrendGranularity(raw) {
  const value = String(raw || "month").toLowerCase();
  if (["day", "daily"].includes(value)) return "day";
  if (["month", "monthly", "year", "yearly"].includes(value)) return "month";
  return "month";
}

function normalizeGroupBy(raw) {
  const value = String(raw || "none").toLowerCase();
  return value === "advisor" ? "advisor" : "none";
}

function normalizeRateCalcMode(raw) {
  const value = String(raw || "step").toLowerCase();
  return value === "base" ? "base" : "step";
}

function normalizeDimension(raw) {
  const value = String(raw || "").toLowerCase();
  if (["job", "occupation", "role"].includes(value)) return "job";
  if (["gender", "sex"].includes(value)) return "gender";
  if (["age", "age_group", "agegroup"].includes(value)) return "age";
  if (["media", "source", "channel"].includes(value)) return "media";
  return "";
}

function parseAdvisorUserId(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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

const METRIC_KEYS = [
  "newInterviews",
  "proposals",
  "recommendations",
  "interviewsScheduled",
  "interviewsHeld",
  "offers",
  "accepts",
  "hires",
  "validApplications",
  "appointments",
  "sitting",
  "revenue",
];

const EMPTY_COUNTS = METRIC_KEYS.reduce((acc, key) => {
  acc[key] = 0;
  return acc;
}, {});

function cloneCounts() {
  return { ...EMPTY_COUNTS };
}

function addCounts(target, counts) {
  METRIC_KEYS.forEach((key) => {
    target[key] += Number(counts?.[key] || 0);
  });
}

function rate(num, denom) {
  const n = Number(num || 0);
  const d = Number(denom || 0);
  if (!d) return 0;
  return Math.round((1000 * n) / d) / 10;
}

function withRates(counts) {
  const safe = { ...cloneCounts(), ...counts };
  return {
    ...safe,
    proposalRate: rate(safe.proposals, safe.newInterviews),
    recommendationRate: rate(safe.recommendations, safe.proposals),
    interviewScheduleRate: rate(safe.interviewsScheduled, safe.recommendations),
    interviewHeldRate: rate(safe.interviewsHeld, safe.interviewsScheduled),
    offerRate: rate(safe.offers, safe.interviewsHeld),
    acceptRate: rate(safe.accepts, safe.offers),
    hireRate: rate(safe.hires, safe.newInterviews),
  };
}

// base方式（新規面談数を分母）
function withRatesBaseMode(counts) {
  const safe = { ...cloneCounts(), ...counts };
  return {
    ...safe,
    proposalRate: rate(safe.proposals, safe.newInterviews),
    recommendationRate: rate(safe.recommendations, safe.newInterviews),
    interviewScheduleRate: rate(safe.interviewsScheduled, safe.newInterviews),
    interviewHeldRate: rate(safe.interviewsHeld, safe.newInterviews),
    offerRate: rate(safe.offers, safe.newInterviews),
    acceptRate: rate(safe.accepts, safe.newInterviews),
    hireRate: rate(safe.hires, safe.newInterviews),
  };
}

// rateCalcModeに応じて切り替え
function withRatesByMode(counts, rateCalcMode) {
  return rateCalcMode === "base" ? withRatesBaseMode(counts) : withRates(counts);
}

function normalizeDateKey(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return isoDate(d);
}

function toDateString(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return isoDate(d);
}

function isInRange(dateStr, range) {
  return Boolean(dateStr && dateStr >= range.startDate && dateStr <= range.endDate);
}

function hasReached(stageDate, nextDate) {
  return Boolean(stageDate && nextDate && nextDate >= stageDate);
}

function isOnOrAfter(dateStr, baseDate) {
  return Boolean(dateStr && baseDate && dateStr >= baseDate);
}

function hasReachedFrom(stageDate, nextDate, cohortStart) {
  if (!isOnOrAfter(stageDate, cohortStart)) return false;
  return Boolean(nextDate && nextDate >= stageDate);
}

function monthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function enumeratePeriods(startDate, endDate, granularity) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) return [];
  const periods = [];
  if (granularity === "day") {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      periods.push(isoDate(d));
    }
    return periods;
  }
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    periods.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return periods;
}

function buildSummarySql(advisorFilter) {
  return `
    SELECT c.advisor_user_id AS advisor_user_id,
           'newInterviews' AS metric,
           COUNT(*)::int AS count
    FROM candidates c
    WHERE c.first_contact_at::date BETWEEN $1 AND $2
    ${advisorFilter}
    GROUP BY c.advisor_user_id
    UNION ALL
    SELECT c.advisor_user_id,
           'proposals' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.proposal_date::date BETWEEN $1 AND $2
    ${advisorFilter}
    GROUP BY c.advisor_user_id
    UNION ALL
    SELECT c.advisor_user_id,
           'recommendations' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.recommended_at::date BETWEEN $1 AND $2
    ${advisorFilter}
    GROUP BY c.advisor_user_id
    UNION ALL
    SELECT c.advisor_user_id,
           'interviewsScheduled' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.first_interview_set_at::date BETWEEN $1 AND $2
    ${advisorFilter}
    GROUP BY c.advisor_user_id
    UNION ALL
    SELECT c.advisor_user_id,
           'interviewsHeld' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.first_interview_at::date BETWEEN $1 AND $2
    ${advisorFilter}
    GROUP BY c.advisor_user_id
    UNION ALL
    SELECT c.advisor_user_id,
           'offers' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.offer_date::date BETWEEN $1 AND $2
    ${advisorFilter}
    GROUP BY c.advisor_user_id
    UNION ALL
    SELECT c.advisor_user_id,
           'accepts' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.offer_accept_date::date BETWEEN $1 AND $2
    ${advisorFilter}
    GROUP BY c.advisor_user_id
    UNION ALL
    SELECT c.advisor_user_id,
           'hires' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.join_date::date BETWEEN $1 AND $2
    ${advisorFilter}
    GROUP BY c.advisor_user_id
  `;
}

function buildPlannedSql(advisorFilter) {
  return `
    SELECT c.advisor_user_id AS advisor_user_id,
           'newInterviews' AS metric,
           COUNT(*)::int AS count
    FROM candidates c
    WHERE c.first_contact_at::date > $1
    ${advisorFilter}
    GROUP BY c.advisor_user_id
    UNION ALL
    SELECT c.advisor_user_id,
           'proposals' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.proposal_date::date > $1
    ${advisorFilter}
    GROUP BY c.advisor_user_id
    UNION ALL
    SELECT c.advisor_user_id,
           'recommendations' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.recommended_at::date > $1
    ${advisorFilter}
    GROUP BY c.advisor_user_id
    UNION ALL
    SELECT c.advisor_user_id,
           'interviewsScheduled' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.first_interview_set_at::date > $1
    ${advisorFilter}
    GROUP BY c.advisor_user_id
    UNION ALL
    SELECT c.advisor_user_id,
           'interviewsHeld' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.first_interview_at::date > $1
    ${advisorFilter}
    GROUP BY c.advisor_user_id
    UNION ALL
    SELECT c.advisor_user_id,
           'offers' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.offer_date::date > $1
    ${advisorFilter}
    GROUP BY c.advisor_user_id
    UNION ALL
    SELECT c.advisor_user_id,
           'accepts' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.offer_accept_date::date > $1
    ${advisorFilter}
    GROUP BY c.advisor_user_id
    UNION ALL
    SELECT c.advisor_user_id,
           'hires' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.join_date::date > $1
    ${advisorFilter}
    GROUP BY c.advisor_user_id
  `;
}

function buildDailySql(advisorFilterCandidates, advisorFilterTeleapo) {
  return `
    SELECT c.advisor_user_id AS advisor_user_id,
           c.first_contact_at::date AS day,
           'newInterviews' AS metric,
           COUNT(*)::int AS count
    FROM candidates c
    WHERE c.first_contact_at::date BETWEEN $1 AND $2
    ${advisorFilterCandidates}
    GROUP BY c.advisor_user_id, day
    UNION ALL
    SELECT c.advisor_user_id,
           ca.proposal_date::date,
           'proposals' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.proposal_date::date BETWEEN $1 AND $2
    ${advisorFilterCandidates}
    GROUP BY c.advisor_user_id, ca.proposal_date::date
    UNION ALL
    SELECT c.advisor_user_id,
           ca.recommended_at::date,
           'recommendations' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.recommended_at::date BETWEEN $1 AND $2
    ${advisorFilterCandidates}
    GROUP BY c.advisor_user_id, ca.recommended_at::date
    UNION ALL
    SELECT c.advisor_user_id,
           ca.first_interview_set_at::date,
           'interviewsScheduled' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.first_interview_set_at::date BETWEEN $1 AND $2
    ${advisorFilterCandidates}
    GROUP BY c.advisor_user_id, ca.first_interview_set_at::date
    UNION ALL
    SELECT c.advisor_user_id,
           ca.first_interview_at::date,
           'interviewsHeld' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.first_interview_at::date BETWEEN $1 AND $2
    ${advisorFilterCandidates}
    GROUP BY c.advisor_user_id, ca.first_interview_at::date
    UNION ALL
    SELECT c.advisor_user_id,
           ca.offer_date::date,
           'offers' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.offer_date::date BETWEEN $1 AND $2
    ${advisorFilterCandidates}
    GROUP BY c.advisor_user_id, ca.offer_date::date
    UNION ALL
    SELECT c.advisor_user_id,
           ca.offer_accept_date::date,
           'accepts' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.offer_accept_date::date BETWEEN $1 AND $2
    ${advisorFilterCandidates}
    GROUP BY c.advisor_user_id, ca.offer_accept_date::date
    UNION ALL
    SELECT c.advisor_user_id,
           ca.join_date::date,
           'hires' AS metric,
           COUNT(*)::int
    FROM candidates c
    JOIN candidate_applications ca ON ca.candidate_id = c.id
    WHERE ca.join_date::date BETWEEN $1 AND $2
    ${advisorFilterCandidates}
    GROUP BY c.advisor_user_id, ca.join_date::date
    UNION ALL
    SELECT c.advisor_user_id,
           c.created_at::date,
           'validApplications' AS metric,
           COUNT(*)::int
    FROM candidates c
    WHERE c.created_at::date BETWEEN $1 AND $2
      AND c.is_effective_application = true
    ${advisorFilterCandidates}
    GROUP BY c.advisor_user_id, c.created_at::date
    UNION ALL
    SELECT t.caller_user_id AS advisor_user_id,
           t.called_at::date,
           'appointments' AS metric,
           COUNT(*)::int
    FROM teleapo t
    WHERE t.called_at::date BETWEEN $1 AND $2
      AND t.result = '設定'
    ${advisorFilterTeleapo}
    GROUP BY t.caller_user_id, t.called_at::date
    UNION ALL
    SELECT t.caller_user_id AS advisor_user_id,
           t.called_at::date,
           'sitting' AS metric,
           COUNT(*)::int
    FROM teleapo t
    WHERE t.called_at::date BETWEEN $1 AND $2
      AND t.result = '着座'
    ${advisorFilterTeleapo}
    GROUP BY t.caller_user_id, t.called_at::date
    UNION ALL
    SELECT c.advisor_user_id,
           ca.joined_at::date,
           'revenue' AS metric,
           COALESCE(SUM(p.fee_amount), 0)::int
    FROM placements p
    JOIN candidate_applications ca ON ca.id = p.candidate_application_id
    JOIN candidates c ON c.id = ca.candidate_id
    WHERE ca.joined_at::date BETWEEN $1 AND $2
    ${advisorFilterCandidates}
    GROUP BY c.advisor_user_id, ca.joined_at::date
  `;
}

async function fetchSummaryRows(client, { startDate, endDate, advisorUserId }) {
  const params = [startDate, endDate];
  const advisorFilter = Number.isFinite(advisorUserId) && advisorUserId > 0 ? `AND c.advisor_user_id = $3` : "";
  if (advisorFilter) params.push(advisorUserId);
  const res = await client.query(buildSummarySql(advisorFilter), params);
  return res.rows || [];
}

async function fetchPlannedRows(client, { baseDate, advisorUserId }) {
  const params = [baseDate];
  const advisorFilter = Number.isFinite(advisorUserId) && advisorUserId > 0 ? `AND c.advisor_user_id = $2` : "";
  if (advisorFilter) params.push(advisorUserId);
  const res = await client.query(buildPlannedSql(advisorFilter), params);
  return res.rows || [];
}

async function fetchDailyRows(client, { startDate, endDate, advisorUserId }) {
  const params = [startDate, endDate];
  const hasAdvisor = Number.isFinite(advisorUserId) && advisorUserId > 0;
  const advisorFilterCandidates = hasAdvisor ? `AND c.advisor_user_id = $3` : "";
  const advisorFilterTeleapo = hasAdvisor ? `AND t.caller_user_id = $3` : "";
  if (hasAdvisor) params.push(advisorUserId);
  const res = await client.query(buildDailySql(advisorFilterCandidates, advisorFilterTeleapo), params);
  return res.rows || [];
}

function buildCountsMap(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const id = String(row.advisor_user_id || "");
    if (!id) return;
    const metric = String(row.metric || "");
    if (!METRIC_KEYS.includes(metric)) return;
    if (!map.has(id)) map.set(id, cloneCounts());
    const counts = map.get(id);
    counts[metric] = Number(row.count || 0);
  });
  return map;
}

function sumCountsMap(map) {
  const total = cloneCounts();
  map.forEach((counts) => addCounts(total, counts));
  return total;
}

function buildDailyMap(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const id = String(row.advisor_user_id || "");
    if (!id) return;
    const day = normalizeDateKey(row.day);
    if (!day) return;
    const metric = String(row.metric || "");
    if (!METRIC_KEYS.includes(metric)) return;
    if (!map.has(id)) map.set(id, {});
    const daily = map.get(id);
    if (!daily[day]) daily[day] = {};
    daily[day][metric] = Number(row.count || 0);
  });
  return map;
}

function mergeDailySeries(seriesList) {
  const merged = {};
  seriesList.forEach((series) => {
    if (!series) return;
    Object.entries(series).forEach(([day, counts]) => {
      if (!merged[day]) merged[day] = cloneCounts();
      addCounts(merged[day], counts);
    });
  });
  return merged;
}

function groupSeriesByMonth(series) {
  const monthly = {};
  Object.entries(series || {}).forEach(([day, counts]) => {
    const monthKey = String(day).slice(0, 7);
    if (!monthly[monthKey]) monthly[monthKey] = cloneCounts();
    addCounts(monthly[monthKey], counts);
  });
  return monthly;
}

async function fetchAdvisorNames(client, advisorIds) {
  const ids = Array.from(new Set(advisorIds)).map(Number).filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return new Map();
  const res = await client.query("SELECT id, name FROM users WHERE id = ANY($1::int[])", [ids]);
  return new Map(res.rows.map((row) => [String(row.id), row.name || `ID:${row.id}`]));
}

// 目標値取得関数
async function fetchGoalTarget(client, { periodId, advisorUserId, scope }) {
  const sql = `
    SELECT targets
    FROM goal_targets
    WHERE period_id = $1
      AND scope = $2
      ${advisorUserId ? 'AND advisor_user_id = $3' : ''}
    LIMIT 1
  `;

  const params = advisorUserId
    ? [periodId, scope, advisorUserId]
    : [periodId, scope];

  try {
    const res = await client.query(sql, params);

    if (res.rows.length === 0) {
      return {
        acceptsTarget: 0,
        newInterviewsTarget: 0,
        proposalsTarget: 0,
        recommendationsTarget: 0,
        interviewsScheduledTarget: 0,
        interviewsHeldTarget: 0,
        offersTarget: 0,
        hiresTarget: 0,
      };
    }

    const targets = res.rows[0].targets || {};

    return {
      acceptsTarget: Number(targets.acceptsTarget || targets.accepts || 0),
      newInterviewsTarget: Number(targets.newInterviewsTarget || targets.newInterviews || 0),
      proposalsTarget: Number(targets.proposalsTarget || targets.proposals || 0),
      recommendationsTarget: Number(targets.recommendationsTarget || targets.recommendations || 0),
      interviewsScheduledTarget: Number(targets.interviewsScheduledTarget || targets.interviewsScheduled || 0),
      interviewsHeldTarget: Number(targets.interviewsHeldTarget || targets.interviewsHeld || 0),
      offersTarget: Number(targets.offersTarget || targets.offers || 0),
      hiresTarget: Number(targets.hiresTarget || targets.hires || 0),
    };
  } catch (err) {
    console.warn('[fetchGoalTarget] error:', err);
    return {
      acceptsTarget: 0,
      newInterviewsTarget: 0,
      proposalsTarget: 0,
      recommendationsTarget: 0,
      interviewsScheduledTarget: 0,
      interviewsHeldTarget: 0,
      offersTarget: 0,
      hiresTarget: 0,
    };
  }
}

// period_id抽出関数
function extractPeriodId(dateStr) {
  // "2025-01-15" → "2025-01"
  return String(dateStr).substring(0, 7);
}

// 達成率計算関数
function calculateAchievementRate(current, target) {
  if (!target || target === 0) return 0;
  return Math.round((current / target) * 100);
}

// buildKpiPayload を拡張（達成率、目標値を含む）
async function buildKpiPayloadWithTargets(client, currentCounts, prevCounts, { periodId, advisorUserId, scope, rateCalcMode = 'step' }) {
  const current = withRatesByMode(currentCounts, rateCalcMode);
  const prev = withRatesByMode(prevCounts, rateCalcMode);

  // 目標値を取得
  const targets = await fetchGoalTarget(client, { periodId, advisorUserId, scope });

  // 達成率を計算
  const achievementRate = calculateAchievementRate(current.accepts, targets.acceptsTarget);

  return {
    ...current,
    // 達成率関連
    achievementRate,
    currentAmount: current.accepts,
    targetAmount: targets.acceptsTarget,

    // 前月比（カウント）
    prevNewInterviews: prev.newInterviews,
    prevProposals: prev.proposals,
    prevRecommendations: prev.recommendations,
    prevInterviewsScheduled: prev.interviewsScheduled,
    prevInterviewsHeld: prev.interviewsHeld,
    prevOffers: prev.offers,
    prevAccepts: prev.accepts,
    prevHires: prev.hires,

    // 前月比（率）
    prevProposalRate: prev.proposalRate,
    prevRecommendationRate: prev.recommendationRate,
    prevInterviewScheduleRate: prev.interviewScheduleRate,
    prevInterviewHeldRate: prev.interviewHeldRate,
    prevOfferRate: prev.offerRate,
    prevAcceptRate: prev.acceptRate,
    prevHireRate: prev.hireRate,
  };
}

// 既存の buildKpiPayload（互換性のため残す）
function buildKpiPayload(currentCounts, prevCounts) {
  const current = withRates(currentCounts);
  const prev = withRates(prevCounts);
  return {
    ...current,
    prevNewInterviews: prev.newInterviews,
    prevProposals: prev.proposals,
    prevRecommendations: prev.recommendations,
    prevInterviewsScheduled: prev.interviewsScheduled,
    prevInterviewsHeld: prev.interviewsHeld,
    prevOffers: prev.offers,
    prevAccepts: prev.accepts,
    prevHires: prev.hires,
    prevProposalRate: prev.proposalRate,
    prevRecommendationRate: prev.recommendationRate,
    prevInterviewScheduleRate: prev.interviewScheduleRate,
    prevInterviewHeldRate: prev.interviewHeldRate,
    prevOfferRate: prev.offerRate,
    prevAcceptRate: prev.acceptRate,
    prevHireRate: prev.hireRate,
  };
}

function buildRatesPayload(counts) {
  const withRatesResult = withRates(counts);
  const countsPayload = {};
  METRIC_KEYS.forEach((key) => {
    countsPayload[key] = Number(withRatesResult[key] || 0);
  });
  return {
    counts: countsPayload,
    rates: {
      proposalRate: withRatesResult.proposalRate,
      recommendationRate: withRatesResult.recommendationRate,
      interviewScheduleRate: withRatesResult.interviewScheduleRate,
      interviewHeldRate: withRatesResult.interviewHeldRate,
      offerRate: withRatesResult.offerRate,
      acceptRate: withRatesResult.acceptRate,
      hireRate: withRatesResult.hireRate,
    },
  };
}

async function fetchTrendSeries(client, { startDate, endDate, advisorUserId, granularity }) {
  const rows = await fetchDailyRows(client, { startDate, endDate, advisorUserId });
  const dailyMap = buildDailyMap(rows);
  const merged = mergeDailySeries(Array.from(dailyMap.values()));
  const grouped = granularity === "month" ? groupSeriesByMonth(merged) : merged;
  const periods = enumeratePeriods(startDate, endDate, granularity);
  return periods.map((period) => {
    const counts = grouped[period] || cloneCounts();
    const payload = buildRatesPayload(counts);
    return { period, ...payload };
  });
}

function buildJobLabelSql() {
  return `
    CASE
      WHEN ca.job_title ILIKE '%エンジニア%' OR ca.job_title ILIKE '%開発%' OR ca.job_title ILIKE '%SE%' OR ca.job_title ILIKE '%ＰＧ%' OR ca.job_title ILIKE '%PG%' OR ca.job_title ILIKE '%システム%' OR ca.job_title ILIKE '%インフラ%' OR ca.job_title ILIKE '%データ%' OR ca.job_title ILIKE '%AI%' OR ca.job_title ILIKE '%機械学習%' THEN 'エンジニア'
      WHEN ca.job_title ILIKE '%営業%' OR ca.job_title ILIKE '%セールス%' OR ca.job_title ILIKE '%法人営業%' OR ca.job_title ILIKE '%インサイドセールス%' OR ca.job_title ILIKE '%フィールドセールス%' OR ca.job_title ILIKE '%BDR%' OR ca.job_title ILIKE '%SDR%' THEN '営業'
      WHEN ca.job_title ILIKE '%人事%' OR ca.job_title ILIKE '%採用%' OR ca.job_title ILIKE '%総務%' OR ca.job_title ILIKE '%経理%' OR ca.job_title ILIKE '%財務%' OR ca.job_title ILIKE '%法務%' OR ca.job_title ILIKE '%労務%' OR ca.job_title ILIKE '%バックオフィス%' OR ca.job_title ILIKE '%管理部%' THEN 'コーポレート'
      WHEN ca.job_title ILIKE '%マーケ%' OR ca.job_title ILIKE '%マーケティング%' OR ca.job_title ILIKE '%広報%' OR ca.job_title ILIKE '%PR%' OR ca.job_title ILIKE '%広告%' OR ca.job_title ILIKE '%プロモーション%' OR ca.job_title ILIKE '%デジタルマーケ%' THEN 'マーケ'
      WHEN ca.job_title ILIKE '%CS%' OR ca.job_title ILIKE '%カスタマーサクセス%' OR ca.job_title ILIKE '%サポート%' OR ca.job_title ILIKE '%カスタマーサポート%' OR ca.job_title ILIKE '%ヘルプデスク%' THEN 'CS'
      ELSE 'その他'
    END
  `;
}

function buildMediaLabelSql() {
  return `
    CASE
      WHEN ca.apply_route ILIKE '%Indeed%' THEN 'Indeed'
      WHEN ca.apply_route ILIKE '%求人ボックス%' OR ca.apply_route ILIKE '%求人BOX%' THEN '求人ボックス'
      WHEN ca.apply_route ILIKE '%リクナビ%' THEN 'リクナビ'
      WHEN ca.apply_route ILIKE '%マイナビ%' THEN 'マイナビ'
      WHEN ca.apply_route ILIKE '%doda%' THEN 'doda'
      WHEN ca.apply_route ILIKE '%自社%' OR ca.apply_route ILIKE '%HP%' OR ca.apply_route ILIKE '%ホームページ%' THEN '自社HP'
      WHEN ca.apply_route ILIKE '%紹介%' OR ca.apply_route ILIKE '%リファラル%' THEN '紹介'
      WHEN ca.apply_route IS NULL OR ca.apply_route = '' THEN '不明'
      ELSE ca.apply_route
    END
  `;
}

function buildGenderLabelSql() {
  return `
    CASE
      WHEN c.gender IN ('男性', '男', 'male', 'Male', 'M') THEN '男性'
      WHEN c.gender IN ('女性', '女', 'female', 'Female', 'F') THEN '女性'
      WHEN c.gender IS NULL OR c.gender = '' THEN '不明'
      ELSE 'その他'
    END
  `;
}

function buildAgeLabelSql() {
  return `
    CASE
      WHEN COALESCE(c.age, EXTRACT(YEAR FROM age(current_date, c.birth_date))) IS NULL THEN '不明'
      WHEN COALESCE(c.age, EXTRACT(YEAR FROM age(current_date, c.birth_date))) < 20 THEN '20代未満'
      WHEN COALESCE(c.age, EXTRACT(YEAR FROM age(current_date, c.birth_date))) < 30 THEN '20代'
      WHEN COALESCE(c.age, EXTRACT(YEAR FROM age(current_date, c.birth_date))) < 40 THEN '30代'
      WHEN COALESCE(c.age, EXTRACT(YEAR FROM age(current_date, c.birth_date))) < 50 THEN '40代'
      ELSE '50代以上'
    END
  `;
}

async function fetchBreakdownItems(client, { dimension, startDate, endDate, advisorUserId }) {
  const params = [startDate, endDate];
  let advisorFilter = "";
  if (Number.isFinite(advisorUserId) && advisorUserId > 0) {
    params.push(advisorUserId);
    advisorFilter = `AND c.advisor_user_id = $${params.length}`;
  }

  if (dimension === "gender") {
    const labelSql = buildGenderLabelSql();
    const res = await client.query(
      `SELECT ${labelSql} AS label, COUNT(*)::int AS count
       FROM candidates c
       WHERE c.first_contact_at::date BETWEEN $1 AND $2
       ${advisorFilter}
       GROUP BY label`,
      params
    );
    return res.rows || [];
  }

  if (dimension === "age") {
    const labelSql = buildAgeLabelSql();
    const res = await client.query(
      `SELECT ${labelSql} AS label, COUNT(*)::int AS count
       FROM candidates c
       WHERE c.first_contact_at::date BETWEEN $1 AND $2
       ${advisorFilter}
       GROUP BY label`,
      params
    );
    return res.rows || [];
  }

  if (dimension === "job") {
    const labelSql = buildJobLabelSql();
    const res = await client.query(
      `SELECT ${labelSql} AS label, COUNT(DISTINCT c.id)::int AS count
       FROM candidates c
       LEFT JOIN candidate_applications ca ON ca.candidate_id = c.id
       WHERE c.first_contact_at::date BETWEEN $1 AND $2
       ${advisorFilter}
       GROUP BY label`,
      params
    );
    return res.rows || [];
  }

  if (dimension === "media") {
    const labelSql = buildMediaLabelSql();
    const res = await client.query(
      `SELECT ${labelSql} AS label, COUNT(DISTINCT c.id)::int AS count
       FROM candidates c
       LEFT JOIN candidate_applications ca ON ca.candidate_id = c.id
       WHERE c.first_contact_at::date BETWEEN $1 AND $2
       ${advisorFilter}
       GROUP BY label`,
      params
    );
    return res.rows || [];
  }

  return [];
}

const COHORT_RATE_KEYS = [
  "proposalRate",
  "recommendationRate",
  "interviewScheduleRate",
  "interviewHeldRate",
  "offerRate",
  "acceptRate",
  "hireRate",
];

function initCohortNumerators() {
  return COHORT_RATE_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
}

function buildCohortRates(counts, numerators) {
  return {
    proposalRate: rate(numerators.proposalRate, counts.newInterviews),
    recommendationRate: rate(numerators.recommendationRate, counts.proposals),
    interviewScheduleRate: rate(numerators.interviewScheduleRate, counts.recommendations),
    interviewHeldRate: rate(numerators.interviewHeldRate, counts.interviewsScheduled),
    offerRate: rate(numerators.offerRate, counts.interviewsHeld),
    acceptRate: rate(numerators.acceptRate, counts.offers),
    hireRate: rate(numerators.hireRate, counts.newInterviews),
  };
}

function buildCohortRatesByMode(counts, numerators, rateCalcMode) {
  if (rateCalcMode === "base") {
    const base = withRatesBaseMode(counts);
    return {
      proposalRate: base.proposalRate,
      recommendationRate: base.recommendationRate,
      interviewScheduleRate: base.interviewScheduleRate,
      interviewHeldRate: base.interviewHeldRate,
      offerRate: base.offerRate,
      acceptRate: base.acceptRate,
      hireRate: base.hireRate,
    };
  }
  return buildCohortRates(counts, numerators);
}

function buildEmptyCohortAggregate(rateCalcMode = "step") {
  const counts = cloneCounts();
  const numerators = initCohortNumerators();
  return { counts, numerators, rates: buildCohortRatesByMode(counts, numerators, rateCalcMode) };
}

function initStepwiseCounts() {
  return { ...cloneCounts() };
}

function computeStepwiseRatesAggregate(rows, range) {
  const counts = initStepwiseCounts();
  const numerators = initCohortNumerators();

  rows.forEach((row) => {
    const dates = row.dates;
    if (isInRange(dates.newInterviews, range)) {
      counts.newInterviews += 1;
      if (hasReached(dates.newInterviews, dates.proposals)) numerators.proposalRate += 1;
      if (hasReached(dates.newInterviews, dates.hires)) numerators.hireRate += 1;
    }
    if (isInRange(dates.proposals, range)) {
      counts.proposals += 1;
      if (hasReached(dates.proposals, dates.recommendations)) numerators.recommendationRate += 1;
    }
    if (isInRange(dates.recommendations, range)) {
      counts.recommendations += 1;
      if (hasReached(dates.recommendations, dates.interviewsScheduled)) {
        numerators.interviewScheduleRate += 1;
      }
    }
    if (isInRange(dates.interviewsScheduled, range)) {
      counts.interviewsScheduled += 1;
      if (hasReached(dates.interviewsScheduled, dates.interviewsHeld)) {
        numerators.interviewHeldRate += 1;
      }
    }
    if (isInRange(dates.interviewsHeld, range)) {
      counts.interviewsHeld += 1;
      if (hasReached(dates.interviewsHeld, dates.offers)) numerators.offerRate += 1;
    }
    if (isInRange(dates.offers, range)) {
      counts.offers += 1;
      if (hasReached(dates.offers, dates.accepts)) numerators.acceptRate += 1;
    }
    if (isInRange(dates.accepts, range)) counts.accepts += 1;
    if (isInRange(dates.hires, range)) counts.hires += 1;
  });

  return { counts, numerators, rates: buildCohortRates(counts, numerators) };
}

function applyCohortRow(agg, dates, range) {
  if (!isInRange(dates.newInterviews, range)) return;
  agg.counts.newInterviews += 1;
  if (hasReached(dates.newInterviews, dates.proposals)) {
    agg.counts.proposals += 1;
    agg.numerators.proposalRate += 1;
  }
  if (hasReached(dates.proposals, dates.recommendations)) {
    agg.counts.recommendations += 1;
    agg.numerators.recommendationRate += 1;
  }
  if (hasReached(dates.recommendations, dates.interviewsScheduled)) {
    agg.counts.interviewsScheduled += 1;
    agg.numerators.interviewScheduleRate += 1;
  }
  if (hasReached(dates.interviewsScheduled, dates.interviewsHeld)) {
    agg.counts.interviewsHeld += 1;
    agg.numerators.interviewHeldRate += 1;
  }
  if (hasReached(dates.interviewsHeld, dates.offers)) {
    agg.counts.offers += 1;
    agg.numerators.offerRate += 1;
  }
  if (hasReached(dates.offers, dates.accepts)) {
    agg.counts.accepts += 1;
    agg.numerators.acceptRate += 1;
  }
  if (hasReached(dates.newInterviews, dates.hires)) {
    agg.counts.hires += 1;
    agg.numerators.hireRate += 1;
  }
}

function computeCohortRangeAggregate(rows, range, rateCalcMode = "step") {
  const agg = { counts: initStepwiseCounts(), numerators: initCohortNumerators() };
  rows.forEach((row) => applyCohortRow(agg, row.dates, range));
  return { counts: agg.counts, numerators: agg.numerators, rates: buildCohortRatesByMode(agg.counts, agg.numerators, rateCalcMode) };
}

function buildCohortAggregateMap(rows, range, rateCalcMode = "step") {
  const map = new Map();
  rows.forEach((row) => {
    const id = String(row.advisorUserId || "");
    if (!id) return;
    let entry = map.get(id);
    if (!entry) {
      entry = { counts: initStepwiseCounts(), numerators: initCohortNumerators() };
      map.set(id, entry);
    }
    applyCohortRow(entry, row.dates, range);
  });
  const finalized = new Map();
  map.forEach((entry, id) => {
    finalized.set(id, {
      counts: entry.counts,
      numerators: entry.numerators,
      rates: buildCohortRatesByMode(entry.counts, entry.numerators, rateCalcMode),
    });
  });
  return finalized;
}

function initStepwiseBucket() {
  return { counts: initStepwiseCounts(), numerators: initCohortNumerators() };
}

function buildStepwiseRateSeries(rows, range, granularity) {
  const periods = enumeratePeriods(range.startDate, range.endDate, granularity);
  const bucketMap = new Map(periods.map((period) => [period, initStepwiseBucket()]));
  const bucketFor = (dateStr) => (granularity === "day" ? dateStr : dateStr.slice(0, 7));

  rows.forEach((row) => {
    const dates = row.dates;
    if (isInRange(dates.newInterviews, range)) {
      const bucket = bucketFor(dates.newInterviews);
      const entry = bucketMap.get(bucket) || initStepwiseBucket();
      entry.counts.newInterviews += 1;
      if (hasReached(dates.newInterviews, dates.proposals)) entry.numerators.proposalRate += 1;
      if (hasReached(dates.newInterviews, dates.hires)) entry.numerators.hireRate += 1;
      bucketMap.set(bucket, entry);
    }
    if (isInRange(dates.proposals, range)) {
      const bucket = bucketFor(dates.proposals);
      const entry = bucketMap.get(bucket) || initStepwiseBucket();
      entry.counts.proposals += 1;
      if (hasReached(dates.proposals, dates.recommendations)) entry.numerators.recommendationRate += 1;
      bucketMap.set(bucket, entry);
    }
    if (isInRange(dates.recommendations, range)) {
      const bucket = bucketFor(dates.recommendations);
      const entry = bucketMap.get(bucket) || initStepwiseBucket();
      entry.counts.recommendations += 1;
      if (hasReached(dates.recommendations, dates.interviewsScheduled)) {
        entry.numerators.interviewScheduleRate += 1;
      }
      bucketMap.set(bucket, entry);
    }
    if (isInRange(dates.interviewsScheduled, range)) {
      const bucket = bucketFor(dates.interviewsScheduled);
      const entry = bucketMap.get(bucket) || initStepwiseBucket();
      entry.counts.interviewsScheduled += 1;
      if (hasReached(dates.interviewsScheduled, dates.interviewsHeld)) {
        entry.numerators.interviewHeldRate += 1;
      }
      bucketMap.set(bucket, entry);
    }
    if (isInRange(dates.interviewsHeld, range)) {
      const bucket = bucketFor(dates.interviewsHeld);
      const entry = bucketMap.get(bucket) || initStepwiseBucket();
      entry.counts.interviewsHeld += 1;
      if (hasReached(dates.interviewsHeld, dates.offers)) entry.numerators.offerRate += 1;
      bucketMap.set(bucket, entry);
    }
    if (isInRange(dates.offers, range)) {
      const bucket = bucketFor(dates.offers);
      const entry = bucketMap.get(bucket) || initStepwiseBucket();
      entry.counts.offers += 1;
      if (hasReached(dates.offers, dates.accepts)) entry.numerators.acceptRate += 1;
      bucketMap.set(bucket, entry);
    }
    if (isInRange(dates.accepts, range)) {
      const bucket = bucketFor(dates.accepts);
      const entry = bucketMap.get(bucket) || initStepwiseBucket();
      entry.counts.accepts += 1;
      bucketMap.set(bucket, entry);
    }
    if (isInRange(dates.hires, range)) {
      const bucket = bucketFor(dates.hires);
      const entry = bucketMap.get(bucket) || initStepwiseBucket();
      entry.counts.hires += 1;
      bucketMap.set(bucket, entry);
    }
  });

  return periods.map((period) => {
    const entry = bucketMap.get(period) || initStepwiseBucket();
    return {
      period,
      rates: buildCohortRates(entry.counts, entry.numerators),
    };
  });
}

function computeCohortAggregate(rows, range) {
  const counts = cloneCounts();
  const numerators = initCohortNumerators();

  rows.forEach((row) => {
    const dates = row.dates;
    if (isInRange(dates.newInterviews, range)) {
      counts.newInterviews += 1;
      if (hasReached(dates.newInterviews, dates.proposals)) numerators.proposalRate += 1;
      if (hasReached(dates.newInterviews, dates.hires)) numerators.hireRate += 1;
    }
    if (isInRange(dates.proposals, range)) {
      counts.proposals += 1;
      if (hasReached(dates.proposals, dates.recommendations)) numerators.recommendationRate += 1;
    }
    if (isInRange(dates.recommendations, range)) {
      counts.recommendations += 1;
      if (hasReached(dates.recommendations, dates.interviewsScheduled)) numerators.interviewScheduleRate += 1;
    }
    if (isInRange(dates.interviewsScheduled, range)) {
      counts.interviewsScheduled += 1;
      if (hasReached(dates.interviewsScheduled, dates.interviewsHeld)) numerators.interviewHeldRate += 1;
    }
    if (isInRange(dates.interviewsHeld, range)) {
      counts.interviewsHeld += 1;
      if (hasReached(dates.interviewsHeld, dates.offers)) numerators.offerRate += 1;
    }
    if (isInRange(dates.offers, range)) {
      counts.offers += 1;
      if (hasReached(dates.offers, dates.accepts)) numerators.acceptRate += 1;
    }
    if (isInRange(dates.accepts, range)) {
      counts.accepts += 1;
    }
    if (isInRange(dates.hires, range)) {
      counts.hires += 1;
    }
  });

  return { counts, numerators, rates: buildCohortRates(counts, numerators) };
}

function buildCohortKpiPayload(currentAgg, prevAgg) {
  const currentCounts = currentAgg.counts;
  const prevCounts = prevAgg.counts;
  const currentRates = currentAgg.rates;
  const prevRates = prevAgg.rates;
  return {
    ...currentCounts,
    ...currentRates,
    prevNewInterviews: prevCounts.newInterviews,
    prevProposals: prevCounts.proposals,
    prevRecommendations: prevCounts.recommendations,
    prevInterviewsScheduled: prevCounts.interviewsScheduled,
    prevInterviewsHeld: prevCounts.interviewsHeld,
    prevOffers: prevCounts.offers,
    prevAccepts: prevCounts.accepts,
    prevHires: prevCounts.hires,
    prevProposalRate: prevRates.proposalRate,
    prevRecommendationRate: prevRates.recommendationRate,
    prevInterviewScheduleRate: prevRates.interviewScheduleRate,
    prevInterviewHeldRate: prevRates.interviewHeldRate,
    prevOfferRate: prevRates.offerRate,
    prevAcceptRate: prevRates.acceptRate,
    prevHireRate: prevRates.hireRate,
  };
}

function buildStepwiseKpiPayload(counts, prevCounts, currentRates, prevRates, numerators = {}) {
  const safeCounts = { ...cloneCounts(), ...counts };
  const safePrevCounts = { ...cloneCounts(), ...prevCounts };
  return {
    ...safeCounts,
    ...currentRates,
    cohortProposals: Number(numerators.proposalRate || 0),
    cohortRecommendations: Number(numerators.recommendationRate || 0),
    cohortInterviewsScheduled: Number(numerators.interviewScheduleRate || 0),
    cohortInterviewsHeld: Number(numerators.interviewHeldRate || 0),
    cohortOffers: Number(numerators.offerRate || 0),
    cohortAccepts: Number(numerators.acceptRate || 0),
    cohortHires: Number(numerators.hireRate || 0),
    prevNewInterviews: safePrevCounts.newInterviews,
    prevProposals: safePrevCounts.proposals,
    prevRecommendations: safePrevCounts.recommendations,
    prevInterviewsScheduled: safePrevCounts.interviewsScheduled,
    prevInterviewsHeld: safePrevCounts.interviewsHeld,
    prevOffers: safePrevCounts.offers,
    prevAccepts: safePrevCounts.accepts,
    prevHires: safePrevCounts.hires,
    prevProposalRate: prevRates.proposalRate,
    prevRecommendationRate: prevRates.recommendationRate,
    prevInterviewScheduleRate: prevRates.interviewScheduleRate,
    prevInterviewHeldRate: prevRates.interviewHeldRate,
    prevOfferRate: prevRates.offerRate,
    prevAcceptRate: prevRates.acceptRate,
    prevHireRate: prevRates.hireRate,
  };
}

// buildStepwiseKpiPayload を拡張（達成率、目標値を含む）
async function buildStepwiseKpiPayloadWithTargets(client, counts, prevCounts, currentRates, prevRates, numerators, { periodId, advisorUserId, scope }) {
  const safeCounts = { ...cloneCounts(), ...counts };
  const safePrevCounts = { ...cloneCounts(), ...prevCounts };

  // 目標値を取得
  const targets = await fetchGoalTarget(client, { periodId, advisorUserId, scope });

  // 達成率を計算
  const achievementRate = calculateAchievementRate(safeCounts.accepts, targets.acceptsTarget);

  return {
    ...safeCounts,
    ...currentRates,
    cohortProposals: Number(numerators.proposalRate || 0),
    cohortRecommendations: Number(numerators.recommendationRate || 0),
    cohortInterviewsScheduled: Number(numerators.interviewScheduleRate || 0),
    cohortInterviewsHeld: Number(numerators.interviewHeldRate || 0),
    cohortOffers: Number(numerators.offerRate || 0),
    cohortAccepts: Number(numerators.acceptRate || 0),
    cohortHires: Number(numerators.hireRate || 0),

    // 達成率関連
    achievementRate,
    currentAmount: safeCounts.accepts,
    targetAmount: targets.acceptsTarget,

    prevNewInterviews: safePrevCounts.newInterviews,
    prevProposals: safePrevCounts.proposals,
    prevRecommendations: safePrevCounts.recommendations,
    prevInterviewsScheduled: safePrevCounts.interviewsScheduled,
    prevInterviewsHeld: safePrevCounts.interviewsHeld,
    prevOffers: safePrevCounts.offers,
    prevAccepts: safePrevCounts.accepts,
    prevHires: safePrevCounts.hires,
    prevProposalRate: prevRates.proposalRate,
    prevRecommendationRate: prevRates.recommendationRate,
    prevInterviewScheduleRate: prevRates.interviewScheduleRate,
    prevInterviewHeldRate: prevRates.interviewHeldRate,
    prevOfferRate: prevRates.offerRate,
    prevAcceptRate: prevRates.acceptRate,
    prevHireRate: prevRates.hireRate,
  };
}

function initCohortBucket() {
  return { counts: cloneCounts(), numerators: initCohortNumerators() };
}

function buildCohortSeries(rows, range, granularity) {
  const periods = enumeratePeriods(range.startDate, range.endDate, granularity);
  const bucketMap = new Map(periods.map((period) => [period, initCohortBucket()]));
  const bucketFor = (dateStr) => (granularity === "day" ? dateStr : dateStr.slice(0, 7));

  rows.forEach((row) => {
    const dates = row.dates;
    if (isInRange(dates.newInterviews, range)) {
      const bucket = bucketFor(dates.newInterviews);
      const entry = bucketMap.get(bucket) || initCohortBucket();
      entry.counts.newInterviews += 1;
      if (hasReached(dates.newInterviews, dates.proposals)) entry.numerators.proposalRate += 1;
      if (hasReached(dates.newInterviews, dates.hires)) entry.numerators.hireRate += 1;
      bucketMap.set(bucket, entry);
    }
    if (isInRange(dates.proposals, range)) {
      const bucket = bucketFor(dates.proposals);
      const entry = bucketMap.get(bucket) || initCohortBucket();
      entry.counts.proposals += 1;
      if (hasReached(dates.proposals, dates.recommendations)) entry.numerators.recommendationRate += 1;
      bucketMap.set(bucket, entry);
    }
    if (isInRange(dates.recommendations, range)) {
      const bucket = bucketFor(dates.recommendations);
      const entry = bucketMap.get(bucket) || initCohortBucket();
      entry.counts.recommendations += 1;
      if (hasReached(dates.recommendations, dates.interviewsScheduled)) entry.numerators.interviewScheduleRate += 1;
      bucketMap.set(bucket, entry);
    }
    if (isInRange(dates.interviewsScheduled, range)) {
      const bucket = bucketFor(dates.interviewsScheduled);
      const entry = bucketMap.get(bucket) || initCohortBucket();
      entry.counts.interviewsScheduled += 1;
      if (hasReached(dates.interviewsScheduled, dates.interviewsHeld)) entry.numerators.interviewHeldRate += 1;
      bucketMap.set(bucket, entry);
    }
    if (isInRange(dates.interviewsHeld, range)) {
      const bucket = bucketFor(dates.interviewsHeld);
      const entry = bucketMap.get(bucket) || initCohortBucket();
      entry.counts.interviewsHeld += 1;
      if (hasReached(dates.interviewsHeld, dates.offers)) entry.numerators.offerRate += 1;
      bucketMap.set(bucket, entry);
    }
    if (isInRange(dates.offers, range)) {
      const bucket = bucketFor(dates.offers);
      const entry = bucketMap.get(bucket) || initCohortBucket();
      entry.counts.offers += 1;
      if (hasReached(dates.offers, dates.accepts)) entry.numerators.acceptRate += 1;
      bucketMap.set(bucket, entry);
    }
    if (isInRange(dates.accepts, range)) {
      const bucket = bucketFor(dates.accepts);
      const entry = bucketMap.get(bucket) || initCohortBucket();
      entry.counts.accepts += 1;
      bucketMap.set(bucket, entry);
    }
    if (isInRange(dates.hires, range)) {
      const bucket = bucketFor(dates.hires);
      const entry = bucketMap.get(bucket) || initCohortBucket();
      entry.counts.hires += 1;
      bucketMap.set(bucket, entry);
    }
  });

  return periods.map((period) => {
    const entry = bucketMap.get(period) || initCohortBucket();
    return {
      period,
      counts: entry.counts,
      rates: buildCohortRates(entry.counts, entry.numerators),
    };
  });
}

async function fetchCohortStageRows(client, { advisorUserId }) {
  const params = [];
  let advisorFilter = "";
  if (Number.isFinite(advisorUserId) && advisorUserId > 0) {
    params.push(advisorUserId);
    advisorFilter = `AND c.advisor_user_id = $${params.length}`;
  }

  const res = await client.query(
    `SELECT c.id AS candidate_id,
            c.advisor_user_id AS advisor_user_id,
            c.first_contact_at::date AS new_interviews,
            MIN(ca.proposal_date)::date AS proposals,
            MIN(ca.recommended_at)::date AS recommendations,
            MIN(ca.first_interview_set_at)::date AS interviews_scheduled,
            MIN(ca.first_interview_at)::date AS interviews_held,
            MIN(ca.offer_date)::date AS offers,
            MIN(ca.offer_accept_date)::date AS accepts,
            MIN(ca.join_date)::date AS hires
     FROM candidates c
     LEFT JOIN candidate_applications ca ON ca.candidate_id = c.id
     WHERE c.first_contact_at IS NOT NULL
     ${advisorFilter}
     GROUP BY c.id, c.advisor_user_id, c.first_contact_at`,
    params
  );
  return (res.rows || []).map((row) => ({
    advisorUserId: Number(row.advisor_user_id) || null,
    dates: {
      newInterviews: toDateString(row.new_interviews),
      proposals: toDateString(row.proposals),
      recommendations: toDateString(row.recommendations),
      interviewsScheduled: toDateString(row.interviews_scheduled),
      interviewsHeld: toDateString(row.interviews_held),
      offers: toDateString(row.offers),
      accepts: toDateString(row.accepts),
      hires: toDateString(row.hires),
    },
  }));
}

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
  const headers = buildHeaders(event);
  if (method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (method !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const path = getPath(event);
  const qs = event.queryStringParameters ?? {};
  const scope = resolveScope(event);
  const granularity = normalizeGranularity(qs.granularity);
  const groupBy = normalizeGroupBy(qs.groupBy);
  const calcMode = normalizeCalcMode(qs.calcMode);
  const rateCalcMode = normalizeRateCalcMode(qs.rateCalcMode);
  const dimension = normalizeDimension(qs.dimension);
  const plannedRaw = String(qs.planned || "").toLowerCase();
  const isPlanned = plannedRaw === "1" || plannedRaw === "true" || plannedRaw === "planned";

  const from = (qs.from || "").trim();
  const to = (qs.to || "").trim();
  const startDate = parseDate(from);
  const endDate = parseDate(to);
  if (!startDate || !endDate || startDate > endDate) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "from, to（YYYY-MM-DD）は必須です",
        example: "/kpi/yield?scope=company&from=2025-12-01&to=2025-12-31",
      }),
    };
  }

  const advisorUserId = parseAdvisorUserId(qs.advisorUserId);
  if (scope === "personal" && !advisorUserId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "personal は advisorUserId 必須です",
        example: "/kpi/yield?scope=personal&from=2025-12-01&to=2025-12-31&advisorUserId=2",
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
    const trendGranularity = normalizeTrendGranularity(qs.granularity);
    const dimension = normalizeDimension(qs.dimension);
    const isTrendPath = path.includes("/yield/trend");
    const isBreakdownPath = path.includes("/yield/breakdown");

    if (isTrendPath) {
      let series = [];
      if (calcMode === "cohort") {
        const eventSeries = await fetchTrendSeries(client, {
          startDate: range.startDate,
          endDate: range.endDate,
          advisorUserId: scope === "personal" ? advisorUserId : advisorUserId,
          granularity: trendGranularity,
        });
        const rows = await fetchCohortStageRows(client, {
          advisorUserId: scope === "personal" ? advisorUserId : advisorUserId,
        });
        const rateSeries = buildStepwiseRateSeries(rows, range, trendGranularity);
        const rateMap = new Map(rateSeries.map((item) => [item.period, item.rates]));
        series = eventSeries.map((item) => ({
          period: item.period,
          counts: item.counts,
          rates: rateMap.get(item.period) || item.rates,
        }));
      } else {
        series = await fetchTrendSeries(client, {
          startDate: range.startDate,
          endDate: range.endDate,
          advisorUserId: scope === "personal" ? advisorUserId : advisorUserId,
          granularity: trendGranularity,
        });
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          meta: {
            from: range.startDate,
            to: range.endDate,
            scope,
            advisorUserId: advisorUserId ?? null,
            granularity: trendGranularity,
            calcMode,
          },
          series,
        }),
      };
    }

    if (isBreakdownPath) {
      if (!dimension) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "dimension is required", allowed: ["job", "gender", "age", "media"] }),
        };
      }
      const rows = await fetchBreakdownItems(client, {
        dimension,
        startDate: range.startDate,
        endDate: range.endDate,
        advisorUserId: scope === "personal" ? advisorUserId : advisorUserId,
      });
      let items = rows.map((row) => ({
        label: row.label || "不明",
        count: Number(row.count || 0),
      }));
      if (dimension === "gender") {
        const order = ["男性", "女性", "その他", "不明"];
        items.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
      } else if (dimension === "age") {
        const order = ["20代未満", "20代", "30代", "40代", "50代以上", "不明"];
        items.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
      } else {
        items.sort((a, b) => b.count - a.count);
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          meta: {
            from: range.startDate,
            to: range.endDate,
            scope,
            advisorUserId: advisorUserId ?? null,
            dimension,
            calcMode,
          },
          items,
        }),
      };
    }

    const meta = {
      from: range.startDate,
      to: range.endDate,
      scope,
      advisorUserId: advisorUserId ?? null,
      granularity,
      groupBy,
    };

    if (granularity === "summary") {
      if (isPlanned) {
        const plannedFilter = scope === "personal" ? advisorUserId : advisorUserId;
        const plannedRows = await fetchPlannedRows(client, {
          baseDate: range.endDate,
          advisorUserId: plannedFilter,
        });
        const countsMap = buildCountsMap(plannedRows);
        const ids = new Set(countsMap.keys());
        if (advisorUserId) ids.add(String(advisorUserId));
        const idList = Array.from(ids).filter((id) => id);
        const nameMap = await fetchAdvisorNames(client, idList);
        let items = [];
        if (groupBy === "advisor") {
          items = idList.map((id) => ({
            advisorUserId: Number(id),
            name: nameMap.get(id) || `ID:${id}`,
            kpi: countsMap.get(id) || cloneCounts(),
          }));
        } else {
          let counts;
          if (advisorUserId) {
            counts = countsMap.get(String(advisorUserId)) || cloneCounts();
          } else {
            counts = sumCountsMap(countsMap);
          }
          items = [
            {
              advisorUserId: advisorUserId ?? null,
              name: advisorUserId ? nameMap.get(String(advisorUserId)) || `ID:${advisorUserId}` : null,
              kpi: counts,
            },
          ];
        }
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            meta: { ...meta, planned: true, plannedBaseDate: range.endDate, calcMode },
            items,
          }),
        };
      }

      const prevRange = resolvePrevRange(range.startDate, range.endDate);
      let items = [];
      if (calcMode === "cohort") {
        const stageAdvisorFilter = advisorUserId ? advisorUserId : null;
        const stageRows = await fetchCohortStageRows(client, { advisorUserId: stageAdvisorFilter });
        const cohortMap = buildCohortAggregateMap(stageRows, range, rateCalcMode);
        const prevCohortMap = prevRange ? buildCohortAggregateMap(stageRows, prevRange, rateCalcMode) : new Map();
        const ids = new Set([...cohortMap.keys(), ...prevCohortMap.keys()]);
        if (advisorUserId) ids.add(String(advisorUserId));
        const idList = Array.from(ids).filter((id) => id);
        const nameMap = await fetchAdvisorNames(client, idList);
        const prevRangeSafe = prevRange || null;
        const emptyAgg = buildEmptyCohortAggregate(rateCalcMode);

        // period_idを取得
        const periodId = extractPeriodId(range.startDate);

        if (groupBy === "advisor") {
          items = [];
          for (const id of idList) {
            const currentAgg = cohortMap.get(id) || emptyAgg;
            const prevAgg = prevRangeSafe ? prevCohortMap.get(id) || emptyAgg : emptyAgg;
            const kpi = await buildStepwiseKpiPayloadWithTargets(
              client,
              currentAgg.counts,
              prevAgg.counts,
              currentAgg.rates,
              prevAgg.rates,
              currentAgg.numerators,
              {
                periodId,
                advisorUserId: Number(id),
                scope: 'personal'
              }
            );
            items.push({
              advisorUserId: Number(id),
              name: nameMap.get(id) || `ID:${id}`,
              kpi
            });
          }
        } else {
          let rowsForScope = stageRows;
          if (advisorUserId) {
            rowsForScope = stageRows.filter((row) => row.advisorUserId === advisorUserId);
          }
          const currentAgg = computeCohortRangeAggregate(rowsForScope, range, rateCalcMode);
          const prevAgg = prevRangeSafe
            ? computeCohortRangeAggregate(rowsForScope, prevRangeSafe, rateCalcMode)
            : emptyAgg;
          const kpi = await buildStepwiseKpiPayloadWithTargets(
            client,
            currentAgg.counts,
            prevAgg.counts,
            currentAgg.rates,
            prevAgg.rates,
            currentAgg.numerators,
            {
              periodId,
              advisorUserId,
              scope
            }
          );
          items = [
            {
              advisorUserId: advisorUserId ?? null,
              name: advisorUserId ? nameMap.get(String(advisorUserId)) || `ID:${advisorUserId}` : null,
              kpi
            },
          ];
        }
      } else {
        const summaryFilter = scope === "personal" ? advisorUserId : advisorUserId;
        const currentRows = await fetchSummaryRows(client, { ...range, advisorUserId: summaryFilter });
        const prevRows = prevRange ? await fetchSummaryRows(client, { ...prevRange, advisorUserId: summaryFilter }) : [];
        const countsMap = buildCountsMap(currentRows);
        const prevMap = buildCountsMap(prevRows);

        const ids = new Set(countsMap.keys());
        if (advisorUserId) ids.add(String(advisorUserId));
        const idList = Array.from(ids);
        const nameMap = await fetchAdvisorNames(client, idList);

        // period_idを取得
        const periodId = extractPeriodId(range.startDate);

        if (groupBy === "advisor") {
          items = [];
          for (const id of idList) {
            const counts = countsMap.get(id) || cloneCounts();
            const prevCounts = prevMap.get(id) || cloneCounts();
            const kpi = await buildKpiPayloadWithTargets(client, counts, prevCounts, {
              periodId,
              advisorUserId: Number(id),
              scope: 'personal',
              rateCalcMode
            });
            items.push({
              advisorUserId: Number(id),
              name: nameMap.get(id) || `ID:${id}`,
              kpi
            });
          }
        } else {
          let counts;
          let prevCounts;
          if (advisorUserId) {
            counts = countsMap.get(String(advisorUserId)) || cloneCounts();
            prevCounts = prevMap.get(String(advisorUserId)) || cloneCounts();
          } else {
            counts = sumCountsMap(countsMap);
            prevCounts = sumCountsMap(prevMap);
          }
          const kpi = await buildKpiPayloadWithTargets(client, counts, prevCounts, {
            periodId,
            advisorUserId,
            scope,
            rateCalcMode
          });
          items = [
            {
              advisorUserId: advisorUserId ?? null,
              name: advisorUserId ? nameMap.get(String(advisorUserId)) || `ID:${advisorUserId}` : null,
              kpi
            },
          ];
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ meta: { ...meta, calcMode }, items }),
      };
    }

    const dailyFilter = scope === "personal" ? advisorUserId : advisorUserId;
    const dailyRows = await fetchDailyRows(client, { ...range, advisorUserId: dailyFilter });
    const dailyMap = buildDailyMap(dailyRows);

    const ids = new Set(dailyMap.keys());
    if (advisorUserId) ids.add(String(advisorUserId));
    const idList = Array.from(ids);
    const nameMap = await fetchAdvisorNames(client, idList);

    let items = [];
    if (groupBy === "advisor") {
      items = idList.map((id) => {
        const series = dailyMap.get(id) || {};
        const normalized = granularity === "month" ? groupSeriesByMonth(series) : series;
        return {
          advisorUserId: Number(id),
          name: nameMap.get(id) || `ID:${id}`,
          series: normalized,
        };
      });
    } else {
      let series;
      if (advisorUserId) {
        series = dailyMap.get(String(advisorUserId)) || {};
      } else {
        series = mergeDailySeries(Array.from(dailyMap.values()));
      }
      const normalized = granularity === "month" ? groupSeriesByMonth(series) : series;
      items = [
        {
          advisorUserId: advisorUserId ?? null,
          name: advisorUserId ? nameMap.get(String(advisorUserId)) || `ID:${advisorUserId}` : null,
          series: normalized,
        },
      ];
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ meta: { ...meta, calcMode }, items }),
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
