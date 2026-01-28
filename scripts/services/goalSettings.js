import { getSession } from '../auth.js';

const DEFAULT_RULE = { type: 'monthly', options: {} };
const KPI_TARGET_KEYS = [
  'newInterviewsTarget',
  'proposalsTarget',
  'recommendationsTarget',
  'interviewsScheduledTarget',
  'interviewsHeldTarget',
  'offersTarget',
  'acceptsTarget',
  'revenueTarget',
  'proposalRateTarget',
  'recommendationRateTarget',
  'interviewScheduleRateTarget',
  'interviewHeldRateTarget',
  'offerRateTarget',
  'acceptRateTarget',
  'hireRateTarget'
];

// ページ別率目標キー（広告管理・架電管理・紹介先実績）
const PAGE_RATE_TARGET_KEYS = [
  // 広告管理画面
  'adValidApplicationRateTarget',
  'adInitialInterviewRateTarget',
  'adOfferRateTarget',
  'adOfferRateTargetStep', // 追加: 内定率（段階別）
  'adHireRateTarget',
  'adHireRateTargetStep', // 追加: 入社率（段階別）
  'adDecisionRateTarget',
  'adRetentionRateTarget',
  // 架電管理画面
  'teleapoContactRateTarget',
  'teleapoSetRateTarget',
  'teleapoShowRateTarget',
  'teleapoShowRateTargetWithContact', // 着座率(分母:接触数)
  'teleapoConnectRateTarget',
  // 紹介先実績管理画面
  'referralRetentionRateTarget'
];

const DEFAULT_GOAL_API_BASE = 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev/goal';
const KPI_TARGET_API_BASE = 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev'; // New API Base
const GOAL_API_BASE = resolveGoalApiBase();

const cache = {
  loaded: false,
  evaluationRule: normalizeRule(DEFAULT_RULE),
  evaluationPeriods: [],
  companyTargets: new Map(),
  personalTargets: new Map(),
  dailyTargets: new Map(),
  msTargets: new Map(),
  importantMetrics: new Map(),
  pageRateTargets: new Map() // ページ別率目標（periodId -> targets）
};

cache.evaluationPeriods = buildDefaultPeriods(cache.evaluationRule);

function resolveGoalApiBase() {
  if (typeof window === 'undefined') return DEFAULT_GOAL_API_BASE;
  const fromWindow = window.GOAL_API_BASE || '';
  let fromStorage = '';
  try {
    fromStorage = localStorage.getItem('dashboard.goalApiBase') || '';
  } catch {
    fromStorage = '';
  }
  const base = (fromWindow || fromStorage || '').trim();
  const resolved = base ? base : DEFAULT_GOAL_API_BASE;
  return resolved.replace(/\/$/, '');
}

function buildGoalUrl(path) {
  if (!GOAL_API_BASE) return path;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${GOAL_API_BASE}${suffix}`;
}

function buildApiUrl(base, path) {
  if (!base) return path;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/$/, '')}${suffix}`;
}

function getAuthHeaders() {
  const token = getSession()?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function requestJson(path, options = {}) {
  const res = await fetch(buildGoalUrl(path), {
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
      ...getAuthHeaders()
    },
    ...options
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = data?.error || data?.message || `HTTP ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}

async function requestJsonWithBase(base, path, options = {}) {
  const res = await fetch(buildApiUrl(base, path), {
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
      ...getAuthHeaders()
    },
    ...options
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = data?.error || data?.message || `HTTP ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function makeMsKey({ scope, departmentKey, metricKey, periodId, advisorUserId }) {
  const advisor = Number.isFinite(advisorUserId) ? advisorUserId : 0;
  return [scope, departmentKey, metricKey, periodId, advisor].join(':');
}

function makeImportantMetricKey({ departmentKey, userId }) {
  const user = Number.isFinite(userId) ? userId : 0;
  return [departmentKey || 'all', user].join(':');
}

async function loadImportantMetricsFromApi({ departmentKey, userId, force = false } = {}) {
  const key = makeImportantMetricKey({ departmentKey, userId });
  if (!force && cache.importantMetrics.has(key)) {
    return cache.importantMetrics.get(key);
  }
  const params = new URLSearchParams();
  if (departmentKey) params.set('departmentKey', departmentKey);
  if (Number.isFinite(userId) && userId > 0) params.set('userId', String(userId));
  const data = await requestJsonWithBase(KPI_TARGET_API_BASE, `/important-metrics?${params.toString()}`);
  const items = Array.isArray(data?.items) ? data.items : [];
  cache.importantMetrics.set(key, items);
  return items;
}

async function saveImportantMetricToApi({ departmentKey, userId, metricKey }) {
  if (!departmentKey || !userId || !metricKey) return null;
  await requestJsonWithBase(KPI_TARGET_API_BASE, '/important-metrics', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ departmentKey, userId, metricKey })
  });
  return { departmentKey, userId, metricKey };
}

async function loadMsTargetsFromApi({ scope, departmentKey, metricKey, periodId, advisorUserId, force = false }) {
  if (!scope || !departmentKey || !metricKey || !periodId) return null;
  const key = makeMsKey({ scope, departmentKey, metricKey, periodId, advisorUserId });
  if (!force && cache.msTargets.has(key)) {
    return cache.msTargets.get(key);
  }
  const params = new URLSearchParams({
    scope,
    departmentKey,
    metricKey,
    periodId
  });
  if (Number.isFinite(advisorUserId) && advisorUserId > 0) {
    params.set('advisorUserId', String(advisorUserId));
  }
  const data = await requestJsonWithBase(KPI_TARGET_API_BASE, `/ms-targets?${params.toString()}`);
  const normalized = {
    targetTotal: Number(data?.targetTotal || 0),
    dailyTargets: data?.dailyTargets || {}
  };
  cache.msTargets.set(key, normalized);
  return normalized;
}

async function saveMsTargetsToApi({ scope, departmentKey, metricKey, periodId, advisorUserId, targetTotal, dailyTargets }) {
  if (!scope || !departmentKey || !metricKey || !periodId) return null;
  await requestJsonWithBase(KPI_TARGET_API_BASE, '/ms-targets', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope,
      departmentKey,
      metricKey,
      periodId,
      advisorUserId: Number.isFinite(advisorUserId) ? advisorUserId : null,
      targetTotal: Number(targetTotal || 0),
      dailyTargets: dailyTargets || {}
    })
  });
  const key = makeMsKey({ scope, departmentKey, metricKey, periodId, advisorUserId });
  const normalized = {
    targetTotal: Number(targetTotal || 0),
    dailyTargets: dailyTargets || {}
  };
  cache.msTargets.set(key, normalized);
  return normalized;
}

function padMonth(value) {
  return String(value).padStart(2, '0');
}

function buildDefaultPeriods(ruleInput) {
  const rule = normalizeRule(ruleInput);
  switch (rule.type) {
    case 'half-month':
      return buildHalfMonthPeriods();
    case 'master-month':
      return buildMasterMonthPeriods();
    case 'weekly':
      return buildWeeklyPeriods(rule.options?.startWeekday || 'monday');
    case 'quarterly':
      return buildQuarterlyPeriods(rule.options?.fiscalStartMonth || 1);
    case 'custom-month':
      return buildCustomMonthPeriods(rule.options?.startDay || 1, rule.options?.endDay || 31);
    case 'monthly':
    default:
      return buildMonthlyPeriods();
  }
}

function buildMonthlyPeriods() {
  const now = new Date();
  const periods = [];
  for (let offset = -12; offset <= 12; offset += 1) {
    const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const year = base.getFullYear();
    const month = base.getMonth();
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);
    const id = `${year}-${padMonth(month + 1)}`;
    const label = `${year}年${padMonth(month + 1)}月`;
    periods.push({
      id,
      label,
      startDate: isoDate(startOfMonth),
      endDate: isoDate(endOfMonth)
    });
  }
  return periods;
}

function buildMasterMonthPeriods() {
  const now = new Date();
  const periods = [];
  for (let offset = -12; offset <= 12; offset += 1) {
    const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const year = base.getFullYear();
    const month = base.getMonth();
    const endDate = safeDay(year, month, 15);
    const previous = new Date(year, month - 1, 1);
    const startDate = safeDay(previous.getFullYear(), previous.getMonth(), 16);
    const id = `${year}-${padMonth(month + 1)}-M`;
    const label = `${year}年${padMonth(month + 1)}月評価`;
    periods.push({
      id,
      label,
      startDate: isoDate(startDate),
      endDate: isoDate(endDate)
    });
  }
  return periods;
}

function buildHalfMonthPeriods() {
  const now = new Date();
  const periods = [];
  for (let offset = -12; offset <= 12; offset += 1) {
    const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const year = base.getFullYear();
    const month = base.getMonth();
    const monthLabel = `${year}年${padMonth(month + 1)}月`;
    const startOfMonth = new Date(year, month, 1);
    const mid = new Date(year, month, 15);
    const endOfMonth = new Date(year, month + 1, 0);
    periods.push(
      {
        id: `${year}-${padMonth(month + 1)}-H1`,
        label: `${monthLabel}前半`,
        startDate: isoDate(startOfMonth),
        endDate: isoDate(mid)
      },
      {
        id: `${year}-${padMonth(month + 1)}-H2`,
        label: `${monthLabel}後半`,
        startDate: isoDate(new Date(year, month, 16)),
        endDate: isoDate(endOfMonth)
      }
    );
  }
  return periods;
}

function buildWeeklyPeriods(startWeekday = 'monday') {
  const now = new Date();
  const periods = [];
  const dayOffset = startWeekday === 'sunday' ? 0 : 1;
  for (let offset = -26; offset <= 26; offset += 1) {
    const base = new Date(now);
    base.setDate(base.getDate() + offset * 7);
    const diff = (base.getDay() - dayOffset + 7) % 7;
    const start = new Date(base);
    start.setDate(base.getDate() - diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const id = `${start.getFullYear()}-${padMonth(start.getMonth() + 1)}-${String(start.getDate()).padStart(2, '0')}`;
    const label = `${isoDate(start)}〜${isoDate(end)}`;
    periods.push({
      id,
      label,
      startDate: isoDate(start),
      endDate: isoDate(end)
    });
  }
  return periods;
}

function buildQuarterlyPeriods(fiscalStartMonth = 1) {
  const now = new Date();
  const periods = [];
  const startMonth = Number(fiscalStartMonth) || 1;
  for (let offset = -8; offset <= 8; offset += 1) {
    const qStartMonth = ((startMonth - 1 + offset * 3) % 12 + 12) % 12;
    const startYear = now.getFullYear() + Math.floor((startMonth - 1 + offset * 3) / 12);
    const start = new Date(startYear, qStartMonth, 1);
    const end = new Date(startYear, qStartMonth + 3, 0);
    const qIndex = ((offset % 4) + 4) % 4 + 1;
    const id = `${start.getFullYear()}-Q${qIndex}-${startMonth}`;
    const label = `Q${qIndex}（${isoDate(start)}〜${isoDate(end)}）`;
    periods.push({
      id,
      label,
      startDate: isoDate(start),
      endDate: isoDate(end)
    });
  }
  return periods;
}

function buildCustomMonthPeriods(startDayRaw = 1, endDayRaw = 31) {
  const now = new Date();
  const periods = [];
  const startDay = clampDay(startDayRaw);
  const endDay = clampDay(endDayRaw);
  for (let offset = -12; offset <= 12; offset += 1) {
    const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const year = base.getFullYear();
    const month = base.getMonth();
    const startDate = safeDay(year, month, startDay);
    let endDate;
    if (startDay <= endDay) {
      endDate = safeDay(year, month, endDay);
    } else {
      const next = new Date(year, month + 1, 1);
      endDate = safeDay(next.getFullYear(), next.getMonth(), endDay);
    }
    const id = `${year}-${padMonth(month + 1)}-C`;
    const label = `${year}年${padMonth(month + 1)}月（${isoDate(startDate)}〜${isoDate(endDate)}）`;
    periods.push({
      id,
      label,
      startDate: isoDate(startDate),
      endDate: isoDate(endDate)
    });
  }
  return periods;
}

function clampDay(day) {
  const num = Number(day);
  if (!Number.isFinite(num)) return 1;
  return Math.min(31, Math.max(1, Math.round(num)));
}

function safeDay(year, month, day) {
  const last = new Date(year, month + 1, 0).getDate();
  const clamped = Math.min(last, Math.max(1, day));
  return new Date(year, month, clamped);
}

function normalizeTarget(raw = {}) {
  return KPI_TARGET_KEYS.reduce((acc, key) => {
    const value = Number(raw[key]);
    acc[key] = Number.isFinite(value) ? value : 0;
    return acc;
  }, {});
}

// ページ別率目標の正規化
function normalizePageRateTarget(raw = {}) {
  return PAGE_RATE_TARGET_KEYS.reduce((acc, key) => {
    const value = Number(raw[key]);
    acc[key] = Number.isFinite(value) && value >= 0 ? value : 0;
    return acc;
  }, {});
}

// ページ別率目標のAPI読み込み
async function loadPageRateTargetsFromApi(periodId, { force = false } = {}) {
  if (!periodId) return null;
  if (!force && cache.pageRateTargets.has(periodId)) return cache.pageRateTargets.get(periodId);

  const headers = getAuthHeaders();
  // DB expects 'YYYY-MM' (7 chars). Match save logic.
  const targetMonth = (periodId && periodId.length >= 7) ? periodId.substring(0, 7) : periodId;
  const url = `${KPI_TARGET_API_BASE}/kpi-targets?period=${targetMonth}`;

  try {
    const res = await fetch(url, { headers: { ...headers, Accept: 'application/json' } });
    if (res.status === 404) {
      const empty = {};
      cache.pageRateTargets.set(periodId, empty);
      return empty;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // API returns { key: value, ... } directly
    const target = normalizePageRateTarget(data || {});
    cache.pageRateTargets.set(periodId, target);
    return target;
  } catch (error) {
    console.warn('[goalSettingsService] failed to load page rate targets', error);
    return {};
  }
}

function getPeriodByDate(dateStr, periods) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const list = Array.isArray(periods) ? periods : [];
  return (
    list.find(period => {
      if (!period?.startDate || !period?.endDate) return false;
      const start = new Date(period.startDate);
      const end = new Date(period.endDate);
      return start <= target && target <= end;
    }) || null
  );
}

function normalizeRule(raw) {
  if (raw && typeof raw === 'object' && raw.type) {
    return {
      type: raw.type,
      options: raw.options || {}
    };
  }
  const legacy = typeof raw === 'string' ? raw : DEFAULT_RULE.type;
  const mapped =
    legacy === 'half-monthly'
      ? 'half-month'
      : legacy === 'custom'
        ? 'custom-month'
        : legacy === 'master-monthly'
          ? 'master-month'
          : legacy;
  return { type: mapped || 'monthly', options: {} };
}

function resolveAdvisorUserId(advisorName) {
  const session = getSession();
  const sessionId = Number(session?.user?.id);
  if (Number.isFinite(sessionId) && sessionId > 0) {
    if (!advisorName || session?.user?.name === advisorName) {
      return sessionId;
    }
  }
  const parsed = Number(advisorName);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return null;
}

function makePersonalKey(advisorUserId, periodId) {
  return `${advisorUserId}:${periodId}`;
}

function normalizeAdvisorIds(advisorUserIds) {
  if (!advisorUserIds) return [];
  const raw = Array.isArray(advisorUserIds) ? advisorUserIds : String(advisorUserIds).split(',');
  return raw
    .map(value => Number(String(value).trim()))
    .filter(value => Number.isFinite(value) && value > 0);
}

async function loadEvaluationRuleFromApi() {
  const data = await requestJson('/goal-settings');
  const rule = normalizeRule({
    type: data?.evaluation_rule_type || DEFAULT_RULE.type,
    options: data?.evaluation_rule_options || {}
  });
  cache.evaluationRule = rule;
  cache.evaluationPeriods = buildDefaultPeriods(rule);
  cache.loaded = true;
  return cache.evaluationRule;
}

async function loadCompanyTargetFromApi(periodId, { force = false } = {}) {
  if (!periodId) return null;
  if (!force && cache.companyTargets.has(periodId)) return cache.companyTargets.get(periodId);
  const params = new URLSearchParams({ scope: 'company', periodId });
  const data = await requestJson(`/goal-targets?${params.toString()}`);
  const target = normalizeTarget(data?.targets || {});
  cache.companyTargets.set(periodId, target);
  return target;
}

async function loadPersonalTargetFromApi(periodId, advisorName, { force = false } = {}) {
  if (!periodId) return null;
  const advisorUserId = resolveAdvisorUserId(advisorName);
  if (!advisorUserId) return null;
  const key = makePersonalKey(advisorUserId, periodId);
  if (!force && cache.personalTargets.has(key)) return cache.personalTargets.get(key);
  const params = new URLSearchParams({
    scope: 'personal',
    periodId,
    advisorUserId: String(advisorUserId)
  });
  const data = await requestJson(`/goal-targets?${params.toString()}`);
  const target = normalizeTarget(data?.targets || {});
  cache.personalTargets.set(key, target);
  return target;
}

async function loadDailyTargetsFromApi(periodId, advisorName, { force = false } = {}) {
  if (!periodId) return {};
  const advisorUserId = resolveAdvisorUserId(advisorName);
  if (!advisorUserId) return {};
  const key = makePersonalKey(advisorUserId, periodId);
  if (!force && cache.dailyTargets.has(key)) return cache.dailyTargets.get(key);
  const params = new URLSearchParams({
    advisorUserId: String(advisorUserId),
    periodId
  });
  const data = await requestJson(`/goal-daily-targets?${params.toString()}`);
  const raw = data?.dailyTargets || {};
  const normalized = {};
  Object.entries(raw).forEach(([date, target]) => {
    normalized[date] = normalizeTarget(target || {});
  });
  cache.dailyTargets.set(key, normalized);
  return normalized;
}

async function loadPersonalTargetsBulkFromApi(periodId, advisorUserIds, { force = false } = {}) {
  if (!periodId) return [];
  const ids = normalizeAdvisorIds(advisorUserIds);
  if (!ids.length) return [];
  const pending = force ? ids : ids.filter(id => !cache.personalTargets.has(makePersonalKey(id, periodId)));
  if (!pending.length) return [];
  const params = new URLSearchParams({
    scope: 'personal',
    periodId,
    advisorUserIds: pending.join(',')
  });
  const data = await requestJson(`/goal-targets?${params.toString()}`);
  const items = Array.isArray(data?.items)
    ? data.items
    : data?.targetsByAdvisor && typeof data.targetsByAdvisor === 'object'
      ? Object.entries(data.targetsByAdvisor).map(([advisorUserId, targets]) => ({
        advisorUserId,
        targets
      }))
      : [];
  items.forEach(item => {
    const advisorUserId = Number(item?.advisorUserId ?? item?.advisor_user_id);
    if (!Number.isFinite(advisorUserId) || advisorUserId <= 0) return;
    const target = normalizeTarget(item?.targets || {});
    const key = makePersonalKey(advisorUserId, periodId);
    cache.personalTargets.set(key, target);
  });
  return items;
}

async function loadDailyTargetsBulkFromApi(periodId, advisorUserIds, { force = false, date } = {}) {
  if (!periodId) return [];
  const ids = normalizeAdvisorIds(advisorUserIds);
  if (!ids.length) return [];
  const pending = force ? ids : ids.filter(id => !cache.dailyTargets.has(makePersonalKey(id, periodId)));
  if (!pending.length) return [];
  const params = new URLSearchParams({
    periodId,
    advisorUserIds: pending.join(',')
  });
  if (date) params.set('date', date);
  const data = await requestJson(`/goal-daily-targets?${params.toString()}`);
  const items = Array.isArray(data?.items)
    ? data.items
    : data?.dailyTargetsByAdvisor && typeof data.dailyTargetsByAdvisor === 'object'
      ? Object.entries(data.dailyTargetsByAdvisor).map(([advisorUserId, dailyTargets]) => ({
        advisorUserId,
        dailyTargets
      }))
      : [];
  items.forEach(item => {
    const advisorUserId = Number(item?.advisorUserId ?? item?.advisor_user_id);
    if (!Number.isFinite(advisorUserId) || advisorUserId <= 0) return;
    const raw = item?.dailyTargets || {};
    const normalized = {};
    Object.entries(raw).forEach(([targetDate, target]) => {
      normalized[targetDate] = normalizeTarget(target || {});
    });
    const key = makePersonalKey(advisorUserId, periodId);
    cache.dailyTargets.set(key, normalized);
  });
  return items;
}

export const goalSettingsService = {
  async load({ force = false } = {}) {
    if (!force && cache.loaded) return cache.evaluationRule;
    try {
      return await loadEvaluationRuleFromApi();
    } catch (error) {
      console.warn('[goalSettingsService] failed to load settings', error);
      cache.loaded = true;
      return cache.evaluationRule;
    }
  },
  getEvaluationRule() {
    return cache.evaluationRule;
  },
  async setEvaluationRule(rule) {
    const nextRule = normalizeRule(rule);
    await requestJson('/goal-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evaluation_rule_type: nextRule.type,
        evaluation_rule_options: nextRule.options || {}
      })
    });
    cache.evaluationRule = nextRule;
    cache.evaluationPeriods = buildDefaultPeriods(nextRule);
    return cache.evaluationRule;
  },
  getEvaluationPeriods() {
    return Array.isArray(cache.evaluationPeriods) ? cache.evaluationPeriods : [];
  },
  setEvaluationPeriods(periods = []) {
    cache.evaluationPeriods = Array.isArray(periods) ? periods : [];
    return cache.evaluationPeriods;
  },
  getCompanyPeriodTarget(periodId) {
    return cache.companyTargets.get(periodId) || null;
  },
  async loadCompanyPeriodTarget(periodId, { force = false } = {}) {
    try {
      return await loadCompanyTargetFromApi(periodId, { force });
    } catch (error) {
      console.warn('[goalSettingsService] failed to load company target', error);
      return this.getCompanyPeriodTarget(periodId);
    }
  },
  async saveCompanyPeriodTarget(periodId, target = {}) {
    if (!periodId) return null;
    const normalized = normalizeTarget(target);
    await requestJson('/goal-targets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'company', periodId, targets: normalized })
    });
    cache.companyTargets.set(periodId, normalized);
    return normalized;
  },
  getPersonalPeriodTarget(periodId, advisorName) {
    const advisorUserId = resolveAdvisorUserId(advisorName);
    if (!advisorUserId || !periodId) return null;
    const key = makePersonalKey(advisorUserId, periodId);
    return cache.personalTargets.get(key) || null;
  },
  async loadPersonalPeriodTarget(periodId, advisorName, { force = false } = {}) {
    try {
      return await loadPersonalTargetFromApi(periodId, advisorName, { force });
    } catch (error) {
      console.warn('[goalSettingsService] failed to load personal target', error);
      return this.getPersonalPeriodTarget(periodId, advisorName);
    }
  },
  async loadPersonalPeriodTargetsBulk(periodId, advisorUserIds, { force = false } = {}) {
    try {
      return await loadPersonalTargetsBulkFromApi(periodId, advisorUserIds, { force });
    } catch (error) {
      console.warn('[goalSettingsService] failed to load personal targets (bulk)', error);
      const ids = normalizeAdvisorIds(advisorUserIds);
      await Promise.all(ids.map(id => loadPersonalTargetFromApi(periodId, id, { force: true })));
      return [];
    }
  },
  async savePersonalPeriodTarget(periodId, target = {}, advisorName) {
    if (!periodId) return null;
    const advisorUserId = resolveAdvisorUserId(advisorName);
    if (!advisorUserId) {
      throw new Error('advisorUserId is required');
    }
    const normalized = normalizeTarget(target);
    await requestJson('/goal-targets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: 'personal',
        advisorUserId,
        periodId,
        targets: normalized
      })
    });
    const key = makePersonalKey(advisorUserId, periodId);
    cache.personalTargets.set(key, normalized);
    return normalized;
  },
  getPersonalDailyTargets(periodId, advisorName) {
    const advisorUserId = resolveAdvisorUserId(advisorName);
    if (!advisorUserId || !periodId) return {};
    const key = makePersonalKey(advisorUserId, periodId);
    return cache.dailyTargets.get(key) || {};
  },
  async loadPersonalDailyTargets(periodId, advisorName, { force = false } = {}) {
    try {
      return await loadDailyTargetsFromApi(periodId, advisorName, { force });
    } catch (error) {
      console.warn('[goalSettingsService] failed to load daily targets', error);
      return this.getPersonalDailyTargets(periodId, advisorName);
    }
  },
  async loadPersonalDailyTargetsBulk(periodId, advisorUserIds, { force = false, date } = {}) {
    try {
      return await loadDailyTargetsBulkFromApi(periodId, advisorUserIds, { force, date });
    } catch (error) {
      console.warn('[goalSettingsService] failed to load daily targets (bulk)', error);
      const ids = normalizeAdvisorIds(advisorUserIds);
      await Promise.all(ids.map(id => loadDailyTargetsFromApi(periodId, id, { force: true })));
      return [];
    }
  },
  async savePersonalDailyTargets(periodId, dailyTargets = {}, advisorName) {
    if (!periodId) return {};
    const advisorUserId = resolveAdvisorUserId(advisorName);
    if (!advisorUserId) {
      throw new Error('advisorUserId is required');
    }
    const items = Object.entries(dailyTargets || {}).map(([date, target]) => ({
      target_date: date,
      targets: normalizeTarget(target || {})
    }));
    await requestJson('/goal-daily-targets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ advisorUserId, periodId, items })
    });
    const key = makePersonalKey(advisorUserId, periodId);
    const normalized = {};
    items.forEach(item => {
      normalized[item.target_date] = item.targets;
    });
    cache.dailyTargets.set(key, normalized);
    return normalized;
  },
  getMsTargets({ scope, departmentKey, metricKey, periodId, advisorUserId }) {
    const key = makeMsKey({ scope, departmentKey, metricKey, periodId, advisorUserId });
    return cache.msTargets.get(key) || null;
  },
  async loadMsTargets({ scope, departmentKey, metricKey, periodId, advisorUserId, force = false } = {}) {
    try {
      return await loadMsTargetsFromApi({ scope, departmentKey, metricKey, periodId, advisorUserId, force });
    } catch (error) {
      console.warn('[goalSettingsService] failed to load ms targets', error);
      return this.getMsTargets({ scope, departmentKey, metricKey, periodId, advisorUserId });
    }
  },
  async saveMsTargets({ scope, departmentKey, metricKey, periodId, advisorUserId, targetTotal, dailyTargets } = {}) {
    try {
      return await saveMsTargetsToApi({ scope, departmentKey, metricKey, periodId, advisorUserId, targetTotal, dailyTargets });
    } catch (error) {
      console.warn('[goalSettingsService] failed to save ms targets', error);
      return null;
    }
  },
  getImportantMetrics({ departmentKey, userId } = {}) {
    const key = makeImportantMetricKey({ departmentKey, userId });
    return cache.importantMetrics.get(key) || [];
  },
  async loadImportantMetrics({ departmentKey, userId, force = false } = {}) {
    try {
      return await loadImportantMetricsFromApi({ departmentKey, userId, force });
    } catch (error) {
      console.warn('[goalSettingsService] failed to load important metrics', error);
      return this.getImportantMetrics({ departmentKey, userId });
    }
  },
  async saveImportantMetric({ departmentKey, userId, metricKey } = {}) {
    try {
      const saved = await saveImportantMetricToApi({ departmentKey, userId, metricKey });
      const key = makeImportantMetricKey({ departmentKey, userId });
      cache.importantMetrics.set(key, [saved]);
      const deptKey = makeImportantMetricKey({ departmentKey });
      const current = Array.isArray(cache.importantMetrics.get(deptKey))
        ? cache.importantMetrics.get(deptKey)
        : [];
      const next = current.filter(item => Number(item?.userId || item?.user_id) !== Number(userId));
      next.push(saved);
      cache.importantMetrics.set(deptKey, next);
      return saved;
    } catch (error) {
      console.warn('[goalSettingsService] failed to save important metric', error);
      return null;
    }
  },
  getPeriodByDate(dateStr, periods) {
    return getPeriodByDate(dateStr, periods || cache.evaluationPeriods);
  },
  resolvePeriodIdByDate(dateStr, periods) {
    const period = this.getPeriodByDate(dateStr, periods);
    return period?.id || null;
  },
  formatPeriodLabel(period) {
    if (!period) return '';
    const range = period.startDate && period.endDate ? `（${period.startDate}〜${period.endDate}）` : '';
    return `${period.label || period.id || '期間未設定'}${range}`;
  },
  generateDefaultPeriods(rule) {
    return buildDefaultPeriods(rule || DEFAULT_RULE);
  },
  listKpiTargetKeys() {
    return [...KPI_TARGET_KEYS];
  },
  listPageRateTargetKeys() {
    return [...PAGE_RATE_TARGET_KEYS];
  },
  // ページ別率目標の取得
  getPageRateTargets(periodId) {
    return cache.pageRateTargets.get(periodId) || null;
  },
  // ページ別率目標のロード
  async loadPageRateTargets(periodId, { force = false } = {}) {
    try {
      return await loadPageRateTargetsFromApi(periodId, { force });
    } catch (error) {
      console.warn('[goalSettingsService] failed to load page rate targets', error);
      return this.getPageRateTargets(periodId);
    }
  },
  // ページ別率目標の保存
  async savePageRateTargets(periodId, targets = {}) {
    if (!periodId) return null;
    const normalized = normalizePageRateTarget(targets);

    // New API: PUT /kpi-targets
    const url = `${KPI_TARGET_API_BASE}/kpi-targets`;
    const headers = getAuthHeaders();

    // DB expects 'YYYY-MM' (7 chars). Extract standard month part if ID is longer (e.g. '2026-03-M' -> '2026-03')
    const targetMonth = (periodId && periodId.length >= 7) ? periodId.substring(0, 7) : periodId;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ period: targetMonth, targets: normalized })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to save targets: ${res.status} ${text}`);
    }

    cache.pageRateTargets.set(periodId, normalized);
    return normalized;
  },
  // 目標達成度から色クラスを判定
  getRateColorClass(actualRate, targetRate, options = {}) {
    const { highThreshold = 100, midThreshold = 80 } = options;
    if (!Number.isFinite(targetRate) || targetRate <= 0) {
      return 'bg-slate-100 text-slate-700'; // 目標未設定
    }
    const percentage = (actualRate / targetRate) * 100;
    if (percentage >= highThreshold) return 'bg-green-100 text-green-700';   // 目標達成
    if (percentage >= midThreshold) return 'bg-amber-100 text-amber-700';    // 80-99%
    return 'bg-red-100 text-red-700';                                        // 80%未満
  }
};

export default goalSettingsService;
