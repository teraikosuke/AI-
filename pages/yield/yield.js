// Yield Page JavaScript Module (simplified)
import { getSession } from '../../scripts/auth.js';
// 例: 実際のパスに合わせてください
import { getMockCandidates } from '../../scripts/mock/candidates.js';
import { goalSettingsService } from '../../scripts/services/goalSettings.js';
import {
  buildPersonalKpiFromCandidates,
  buildCompanyKpiFromCandidates
} from './yield-metrics-from-candidates.js';

// API接続設定
const YIELD_API_BASE = 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev';
const KPI_API_BASE = `${YIELD_API_BASE}/kpi`;
const MEMBERS_API_BASE = YIELD_API_BASE;
const MEMBERS_LIST_PATH = '/members';
const KPI_YIELD_PATH = '/yield';
const KPI_YIELD_TREND_PATH = '/yield/trend';
const KPI_YIELD_BREAKDOWN_PATH = '/yield/breakdown';
const KPI_TARGETS_PATH = '/kpi-targets';
const DEFAULT_ADVISOR_USER_ID = 30;
const DEFAULT_CALC_MODE = 'cohort';
const DEFAULT_RATE_CALC_MODE = 'base';
const RATE_CALC_MODE_STORAGE_KEY = 'yieldRateCalcMode.v1';
const YIELD_UI_VERSION = '20260203_14';

if (typeof window !== 'undefined') {
  window.__yieldVersion = YIELD_UI_VERSION;
}

async function fetchJson(url, params = {}) {
  const query = new URLSearchParams(params);
  const res = await fetch(`${url}?${query.toString()}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function fetchKpiTargetsFromApi(period) {
  try {
    const session = getSession();
    const headers = { Accept: 'application/json' };
    if (session?.token) headers.Authorization = `Bearer ${session.token}`;
    const res = await fetch(`${MEMBERS_API_BASE}${KPI_TARGETS_PATH}?period=${period}`, { headers });
    if (res.status === 404) return {};
    if (!res.ok) throw new Error(`kpi targets error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[yield] fetchKpiTargets failed', err);
    return {};
  }
}

async function saveKpiTargetsToApi(period, targets) {
  const session = getSession();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;

  const payload = { period, targets };
  const res = await fetch(`${MEMBERS_API_BASE}${KPI_TARGETS_PATH}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`save kpi targets error ${res.status}`);
  return res.json();
}

let membersCache = [];
let membersPromise = null;

function normalizeMembers(payload) {
  const raw = Array.isArray(payload)
    ? payload
    : (payload?.items || payload?.members || payload?.users || []);

  if (!Array.isArray(raw)) {
    console.warn('[DEBUG] normalizeMembers: raw payload is not an array', payload);
    return [];
  }

  const normalized = raw
    .map(member => ({
      id: member.id ?? member.user_id ?? member.userId,
      name: member.name || member.fullName || member.displayName || '',
      email: member.email || member.user_email || member.userEmail || member.mail || '',
      role: member.role || (member.is_admin ? 'admin' : 'member'),
      raw: member // for debugging
    }))
    .filter(member => member.id != null && member.id !== '');

  console.log('[DEBUG] normalizeMembers input count:', raw.length);
  console.log('[DEBUG] normalizeMembers output count:', normalized.length);
  if (raw.length > 0 && normalized.length === 0) {
    console.warn('[DEBUG] All members were filtered out! Sample raw member:', raw[0]);
  }
  return normalized;
}

async function ensureMembersList({ force = false } = {}) {
  if (!force && membersCache.length) return membersCache;
  if (membersPromise) return membersPromise;
  membersPromise = (async () => {
    try {
      const session = getSession();
      const headers = { Accept: 'application/json' };
      if (session?.token) headers.Authorization = `Bearer ${session.token}`;
      const res = await fetch(`${MEMBERS_API_BASE}${MEMBERS_LIST_PATH}`, { headers });
      if (!res.ok) throw new Error(`members HTTP ${res.status}`);
      const json = await res.json();
      membersCache = normalizeMembers(json);
      return membersCache;
    } catch (error) {
      console.warn('[yield] failed to load members', error);
      membersCache = [];
      return membersCache;
    } finally {
      membersPromise = null;
    }
  })();
  return membersPromise;
}

function normalizeAdvisorId(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isAdvisorRole(role) {
  return String(role || '').toLowerCase().includes('advisor');
}

// 部門別指標定義
const MS_MARKETING_METRICS = [
  { key: 'valid_applications', label: '有効応募数', targetKey: 'validApplications' }
];

const MS_CS_METRICS = [
  { key: 'appointments', label: '設定数', targetKey: 'appointments' },
  { key: 'sitting', label: '着座数', targetKey: 'sitting' }
];

const MS_SALES_METRICS = [
  { key: 'new_interviews', label: '新規面談数', targetKey: 'newInterviews' },
  { key: 'proposals', label: '提案数', targetKey: 'proposals' },
  { key: 'recommendations', label: '推薦数', targetKey: 'recommendations' },
  { key: 'interviews_scheduled', label: '面接設定数', targetKey: 'interviewsScheduled' },
  { key: 'interviews_held', label: '面接実施数', targetKey: 'interviewsHeld' },
  { key: 'offers', label: '内定数', targetKey: 'offers' },
  { key: 'accepts', label: '承諾数', targetKey: 'accepts' }
];

// 部門判定関数
function mapRoleToDepartment(role) {
  const r = String(role || '').toLowerCase();
  if (!r) return '';

  // CS / call
  if (
    r.includes('caller') ||
    r.includes('call') ||
    r.includes('teleapo') ||
    r.includes('テレアポ') ||
    r.includes('架電') ||
    r.includes('cs') ||
    r.includes('カスタマー') ||
    r.includes('サポート')
  ) {
    return 'cs';
  }

  // Marketing
  if (
    r.includes('marketer') ||
    r.includes('marketing') ||
    r.includes('market') ||
    r.includes('マーケ') ||
    r.includes('マーケティング')
  ) {
    return 'marketing';
  }

  // Sales
  if (
    r.includes('advisor') ||
    r.includes('sales') ||
    r.includes('営業') ||
    r.includes('アドバイザー')
  ) {
    return 'sales';
  }

  return '';
}

function getDepartmentFromRole(role) {
  const mapped = mapRoleToDepartment(role);
  if (mapped) return mapped;
  // それ以外は暫定的に営業（sales）
  return 'sales';
}

function getMembersByDepartment(members, deptKey) {
  const result = (members || []).filter(m => getDepartmentFromRole(m.role) === deptKey);
  if (result.length === 0 && members && members.length > 0) {
    console.warn(`[DEBUG] No members found for ${deptKey}. Sample roles:`, members.slice(0, 5).map(m => `${m.name}:${m.role}`));
  }
  return result;
}

function normalizeCalcMode(value) {
  return String(value || '').toLowerCase() === 'cohort' ? 'cohort' : 'period';
}

function getCalcMode() {
  return normalizeCalcMode(state?.calcMode || DEFAULT_CALC_MODE);
}

function getCalcModeLabel(mode = getCalcMode()) {
  return normalizeCalcMode(mode) === 'cohort' ? '応募時期優先' : 'リアルタイム優先';
}

function buildCalcModeParams() {
  const mode = getCalcMode();
  const basis = mode === 'cohort' ? 'application' : 'event';
  return {
    calcMode: mode,
    countBasis: basis,
    timeBasis: basis
  };
}

function normalizeRateCalcMode(value) {
  return String(value || '').toLowerCase() === 'step' ? 'step' : 'base';
}

function getRateCalcMode() {
  return normalizeRateCalcMode(state?.rateCalcMode || DEFAULT_RATE_CALC_MODE);
}

function getRateCalcModeLabel(mode = getRateCalcMode()) {
  return mode === 'step' ? '前段階を分母' : '新規面談数を分母';
}

async function mergeMembersWithDailyItems(items) {
  const members = await ensureMembersList();
  if (!members.length) return items;
  const map = new Map();
  (items || []).forEach(item => {
    const id = normalizeAdvisorId(item?.advisorUserId ?? item?.advisor_user_id ?? item?.id);
    if (!id) return;
    map.set(String(id), item);
  });
  const merged = members.map(member => {
    const id = normalizeAdvisorId(member.id);
    const existing = id ? map.get(String(id)) : null;
    if (existing) {
      return {
        ...existing,
        advisorUserId: id,
        name: existing.name || member.name || `ID:${id}`
      };
    }
    return {
      advisorUserId: id,
      name: member.name || `ID:${id}`,
      series: {}
    };
  });
  const extras = (items || []).filter(item => {
    const id = normalizeAdvisorId(item?.advisorUserId ?? item?.advisor_user_id ?? item?.id);
    return !id || !members.some(member => String(member.id) === String(id));
  });
  return [...merged, ...extras];
}

async function mergeMembersWithKpiItems(items) {
  const members = await ensureMembersList();
  if (!members.length) return items;
  const map = new Map();
  (items || []).forEach(item => {
    const id = normalizeAdvisorId(item?.advisorUserId ?? item?.advisor_user_id ?? item?.id);
    if (!id) return;
    map.set(String(id), item);
  });
  const merged = members.map(member => {
    const id = normalizeAdvisorId(member.id);
    const existing = id ? map.get(String(id)) : null;
    if (existing) {
      return {
        ...existing,
        advisorUserId: id,
        name: existing.name || member.name || `ID:${id}`
      };
    }
    return {
      advisorUserId: id,
      name: member.name || `ID:${id}`,
      kpi: {}
    };
  });
  const extras = (items || []).filter(item => {
    const id = normalizeAdvisorId(item?.advisorUserId ?? item?.advisor_user_id ?? item?.id);
    return !id || !members.some(member => String(member.id) === String(id));
  });
  return [...merged, ...extras];
}

let advisorUserIdCache = null;
let advisorUserIdCacheKey = null;

function resolveAdvisorCacheKey(session) {
  return session?.user?.id || session?.user?.email || session?.user?.name || '';
}

function parseAdvisorUserId(session) {
  const candidates = [
    session?.user?.advisorUserId,
    session?.user?.advisor_user_id,
    session?.user?.numericId,
    session?.user?.employeeId,
    session?.user?.userId,
    session?.user?.id,
    session?.advisorUserId,
    session?.advisor_user_id
  ];
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

async function resolveAdvisorUserId() {
  const session = getSession();
  const cacheKey = resolveAdvisorCacheKey(session);
  if (advisorUserIdCacheKey && advisorUserIdCacheKey !== cacheKey) {
    advisorUserIdCache = null;
  }
  if (Number.isFinite(advisorUserIdCache) && advisorUserIdCache > 0) {
    return advisorUserIdCache;
  }
  const parsed = parseAdvisorUserId(session);
  if (parsed) {
    advisorUserIdCache = parsed;
    advisorUserIdCacheKey = cacheKey;
    console.log('[yield] advisorUserId from session', { rawId: session?.user?.id, advisorUserId: parsed });
    return parsed;
  }
  const members = await ensureMembersList();
  const sessionEmail = String(session?.user?.email || '').toLowerCase();
  const sessionName = String(session?.user?.name || '');
  let matched = null;
  if (sessionEmail) {
    matched = members.find(member => String(member?.email || '').toLowerCase() === sessionEmail);
  }
  if (!matched && sessionName) {
    matched = members.find(member => String(member?.name || '') === sessionName);
  }
  const mapped = normalizeAdvisorId(matched?.id);
  if (mapped) {
    advisorUserIdCache = mapped;
    advisorUserIdCacheKey = cacheKey;
    console.log('[yield] advisorUserId from members', { mapped });
    return mapped;
  }
  console.warn('[yield] advisorUserId fallback', { rawId: session?.user?.id, fallback: DEFAULT_ADVISOR_USER_ID });
  advisorUserIdCache = DEFAULT_ADVISOR_USER_ID;
  advisorUserIdCacheKey = cacheKey;
  return DEFAULT_ADVISOR_USER_ID;
}

async function resolveUserDepartmentKey() {
  const session = getSession();
  const roleCandidates = [
    session?.user?.role,
    session?.user?.department,
    session?.user?.division,
    session?.user?.team,
    session?.user?.jobTitle
  ];
  for (const candidate of roleCandidates) {
    const mapped = mapRoleToDepartment(candidate);
    if (mapped) return mapped;
  }
  const members = await ensureMembersList();
  const sessionEmail = String(session?.user?.email || '').toLowerCase();
  const sessionName = String(session?.user?.name || '');
  const sessionId = String(session?.user?.id || '');
  let matched = null;
  if (sessionId) matched = members.find(member => String(member?.id || '') === sessionId);
  if (!matched && sessionEmail) {
    matched = members.find(member => String(member?.email || '').toLowerCase() === sessionEmail);
  }
  if (!matched && sessionName) {
    matched = members.find(member => String(member?.name || '') === sessionName);
  }
  const mapped = mapRoleToDepartment(matched?.role || '');
  return mapped || 'sales';
}


async function fetchPersonalKpiFromApi({ startDate, endDate, planned = false }) {
  const advisorUserId = await resolveAdvisorUserId();
  console.log('[yield] fetch personal kpi', { startDate, endDate, advisorUserId, planned });
  const params = {
    from: startDate,
    to: endDate,
    scope: 'personal',
    advisorUserId,
    granularity: 'summary',
    groupBy: 'none',
    ...buildCalcModeParams()
  };
  if (planned) params.planned = '1';
  const json = await fetchJson(`${KPI_API_BASE}${KPI_YIELD_PATH}`, params);
  console.log('[yield] personal kpi response', json);
  const kpi = json?.items?.[0]?.kpi || null;
  console.log('[yield] personal kpi fields', {
    revenue: kpi?.revenue,
    currentAmount: kpi?.currentAmount,
    revenueAmount: kpi?.revenueAmount,
    current_amount: kpi?.current_amount,
    revenue_amount: kpi?.revenue_amount,
    targetAmount: kpi?.targetAmount,
    revenueTarget: kpi?.revenueTarget,
    revenue_target: kpi?.revenue_target,
    achievementRate: kpi?.achievementRate
  });
  if (kpi && kpi.revenue === undefined && kpi.currentAmount === undefined && kpi.revenueAmount === undefined) {
    console.warn('[yield] personal kpi missing revenue fields', kpi);
  }
  return kpi;
}

async function fetchCompanyKpiFromApi({ startDate, endDate, msMode = false }) {
  const params = {
    from: startDate,
    to: endDate,
    scope: 'company',
    granularity: 'summary',
    groupBy: 'none',
    ...buildCalcModeParams()
  };
  if (msMode) {
    params.ms = '1';
  }
  const json = await fetchJson(`${KPI_API_BASE}${KPI_YIELD_PATH}`, params);
  console.log('[yield] company kpi response', json);
  const kpi = json?.items?.[0]?.kpi || null;
  console.log('[yield] company kpi fields', {
    revenue: kpi?.revenue,
    currentAmount: kpi?.currentAmount,
    revenueAmount: kpi?.revenueAmount,
    current_amount: kpi?.current_amount,
    revenue_amount: kpi?.revenue_amount,
    targetAmount: kpi?.targetAmount,
    revenueTarget: kpi?.revenueTarget,
    revenue_target: kpi?.revenue_target,
    achievementRate: kpi?.achievementRate
  });
  if (kpi && kpi.revenue === undefined && kpi.currentAmount === undefined && kpi.revenueAmount === undefined) {
    console.warn('[yield] company kpi missing revenue fields', kpi);
  }
  return kpi;
}

const dailyYieldCache = new Map();

async function fetchDailyYieldFromApi({ startDate, endDate, advisorUserId, msMode = false }) {
  const params = {
    from: startDate,
    to: endDate,
    scope: 'company',
    granularity: 'day',
    groupBy: 'advisor',
    ...buildCalcModeParams()
  };
  if (msMode) {
    params.ms = '1';
  }
  console.log('[yield] fetch daily kpi', params);
  const json = await fetchJson(`${KPI_API_BASE}${KPI_YIELD_PATH}`, params);
  console.log('[DEBUG] fetchDailyYieldFromApi raw json:', JSON.stringify(json, null, 2));
  const rawItems = Array.isArray(json?.items) ? json.items : [];
  const items = await mergeMembersWithDailyItems(rawItems);
  const employees = items.map(item => ({
    advisorUserId: item?.advisorUserId,
    name: item?.name || `ID:${item?.advisorUserId}`,
    daily: item?.series || {}
  }));
  const targetId = String(advisorUserId || '');
  const personalItem = items.find(item => String(item?.advisorUserId || '') === targetId);
  return {
    personal: personalItem ? { advisorUserId, daily: personalItem.series || {} } : { advisorUserId, daily: {} },
    employees
  };
}

async function fetchYieldTrendFromApi({ startDate, endDate, scope, advisorUserId, granularity = 'month' }) {
  const params = {
    from: startDate,
    to: endDate,
    scope,
    granularity,
    ...buildCalcModeParams()
  };
  if (Number.isFinite(advisorUserId) && advisorUserId > 0) {
    params.advisorUserId = advisorUserId;
  }
  const json = await fetchJson(`${KPI_API_BASE}${KPI_YIELD_TREND_PATH}`, params);
  const series = Array.isArray(json?.series) ? json.series : [];
  return {
    labels: series.map(item => item.period),
    rates: series.map(item => item.rates || {})
  };
}

async function fetchYieldBreakdownFromApi({ startDate, endDate, scope, advisorUserId, dimension }) {
  const params = {
    from: startDate,
    to: endDate,
    scope,
    dimension,
    ...buildCalcModeParams()
  };
  if (Number.isFinite(advisorUserId) && advisorUserId > 0) {
    params.advisorUserId = advisorUserId;
  }
  const json = await fetchJson(`${KPI_API_BASE}${KPI_YIELD_BREAKDOWN_PATH}`, params);
  const items = Array.isArray(json?.items) ? json.items : [];
  return {
    labels: items.map(item => item.label),
    data: items.map(item => num(item.count))
  };
}

// CS向け: teleapo APIから日別実績を取得
const csTeleapoCache = new Map();

async function fetchCsTeleapoDaily({ startDate, endDate, callerUserId }) {
  const cacheKey = `${startDate}:${endDate}:${callerUserId || 'all'}`;
  if (csTeleapoCache.has(cacheKey)) return csTeleapoCache.get(cacheKey);

  try {
    const params = {
      from: startDate,
      to: endDate,
      groupBy: 'date'
    };
    if (Number.isFinite(callerUserId) && callerUserId > 0) {
      params.callerUserId = callerUserId;
    }
    const json = await fetchJson(`${KPI_API_BASE}/teleapo`, params);
    const rows = Array.isArray(json?.rows) ? json.rows : [];

    // 日別データをdate -> counts形式に変換
    const dailyData = {};
    rows.forEach(row => {
      const dateStr = row.date ? String(row.date).split('T')[0] : null;
      if (!dateStr) return;
      dailyData[dateStr] = {
        appointments: row.counts?.scheduledCalls || 0,  // 設定数
        sitting: row.counts?.attendedCalls || 0          // 着座数
      };
    });

    csTeleapoCache.set(cacheKey, dailyData);
    return dailyData;
  } catch (error) {
    console.error('[yield] fetchCsTeleapoDaily failed', error);
    return {};
  }
}

// Marketing向け: 有効応募数の日別実績を取得
const marketingValidAppCache = new Map();

async function fetchMarketingValidApplicationsDaily({ startDate, endDate }) {
  const cacheKey = `${startDate}:${endDate}`;
  if (marketingValidAppCache.has(cacheKey)) return marketingValidAppCache.get(cacheKey);

  try {
    // candidates API から有効応募を日別集計
    const json = await fetchJson(`${YIELD_API_BASE}/candidates`, {
      from: startDate,
      to: endDate,
      effectiveOnly: true,
      groupBy: 'date'
    });

    // レスポンス形式に応じてパース
    const items = Array.isArray(json?.items) ? json.items : [];
    const dailyData = {};

    items.forEach(item => {
      const dateStr = item.date || item.created_at?.split('T')[0];
      if (!dateStr) return;
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { valid_applications: 0 };
      }
      dailyData[dateStr].valid_applications += 1;
    });

    marketingValidAppCache.set(cacheKey, dailyData);
    return dailyData;
  } catch (error) {
    console.error('[yield] fetchMarketingValidApplicationsDaily failed', error);
    return {};
  }
}

async function fetchCompanyEmployeeKpis({ startDate, endDate }) {
  const json = await fetchJson(`${KPI_API_BASE}${KPI_YIELD_PATH}`, {
    from: startDate,
    to: endDate,
    scope: 'company',
    granularity: 'summary',
    groupBy: 'advisor',
    ...buildCalcModeParams()
  });
  const items = Array.isArray(json?.items) ? json.items : [];
  return mergeMembersWithKpiItems(items);
}

async function fetchCompanyEmployeePlannedKpis({ baseDate }) {
  const date = baseDate || isoDate(new Date());
  const json = await fetchJson(`${KPI_API_BASE}${KPI_YIELD_PATH}`, {
    from: date,
    to: date,
    scope: 'company',
    granularity: 'summary',
    groupBy: 'advisor',
    planned: '1',
    ...buildCalcModeParams()
  });
  const items = Array.isArray(json?.items) ? json.items : [];
  return mergeMembersWithKpiItems(items);
}

function mapEmployeeKpiItems(items) {
  return (Array.isArray(items) ? items : []).map(item => ({
    advisorUserId: item?.advisorUserId,
    name: item?.name || `ID:${item?.advisorUserId}`,
    ...normalizeKpi(item?.kpi || {})
  }));
}

function applyDailyYieldResponse(periodId, payload) {
  if (!periodId || !payload) return;
  const personalDaily =
    payload?.personal?.daily ||
    payload?.personal?.dailyData ||
    payload?.personalDaily ||
    null;

  if (personalDaily && typeof personalDaily === 'object') {
    state.personalDailyData[periodId] = personalDaily;
  } else if (!state.personalDailyData[periodId]) {
    state.personalDailyData[periodId] = {};
  }

  const employees = Array.isArray(payload?.employees) ? payload.employees : [];
  console.log('[DEBUG] applyDailyYieldResponse employees count:', employees.length, 'sample:', employees[0]);
  if (employees.length) {
    state.companyDailyEmployees = employees
      .map(emp => {
        const id = String(emp?.advisorUserId ?? emp?.id ?? '');
        if (!id) return null;
        return {
          id,
          name: emp?.name || emp?.advisorName || `ID:${id}`
        };
      })
      .filter(Boolean);
  }

  employees.forEach(emp => {
    const id = String(emp?.advisorUserId ?? emp?.id ?? '');
    if (!id) return;
    if (!state.companyDailyData[id]) state.companyDailyData[id] = {};
    state.companyDailyData[id][periodId] = emp?.daily || emp?.dailyData || {};
  });
}

function getCompanyDailyEmployees() {
  return Array.isArray(state.companyDailyEmployees) ? state.companyDailyEmployees : [];
}

function ensureCompanyDailyEmployeeId() {
  const employees = getCompanyDailyEmployees();
  if (!employees.length) return;
  const current = String(state.companyDailyEmployeeId || '');
  const exists = employees.some(emp => String(emp.id) === current);
  if (!exists) {
    state.companyDailyEmployeeId = String(employees[0].id);
  }
}

async function ensureDailyYieldData(periodId, { msMode = false } = {}) {
  if (!periodId) return null;
  const period = state.evaluationPeriods.find(item => item.id === periodId);
  if (!period) return null;
  const advisorUserId = await resolveAdvisorUserId();
  const cacheKey = `${periodId}:${advisorUserId || 'none'}:${getCalcMode()}:${msMode ? 'ms' : 'default'}`;
  if (dailyYieldCache.has(cacheKey)) return dailyYieldCache.get(cacheKey);
  try {
    // 営業向けのKPIデータを取得
    const payload = await fetchDailyYieldFromApi({
      startDate: period.startDate,
      endDate: period.endDate,
      advisorUserId,
      msMode
    });
    dailyYieldCache.set(cacheKey, payload);
    applyDailyYieldResponse(periodId, payload);
    ensureCompanyDailyEmployeeId();

    // ★ロールに応じて追加のデータを取得
    const deptKey = await resolveUserDepartmentKey();

    if (deptKey === 'cs') {
      // CS: teleapoデータを取得してマージ
      const csData = await fetchCsTeleapoDaily({
        startDate: period.startDate,
        endDate: period.endDate,
        callerUserId: advisorUserId
      });
      if (csData && Object.keys(csData).length > 0) {
        // 既存のpersonalDailyDataにCSデータをマージ
        const existingData = state.personalDailyData[periodId] || {};
        Object.entries(csData).forEach(([date, counts]) => {
          if (!existingData[date]) existingData[date] = {};
          existingData[date].appointments = counts.appointments || 0;
          existingData[date].sitting = counts.sitting || 0;
        });
        state.personalDailyData[periodId] = existingData;
      }

    } else if (deptKey === 'marketing') {
      // Marketing: 有効応募数データを取得してマージ
      const marketingData = await fetchMarketingValidApplicationsDaily({
        startDate: period.startDate,
        endDate: period.endDate
      });
      if (marketingData && Object.keys(marketingData).length > 0) {
        const existingData = state.personalDailyData[periodId] || {};
        Object.entries(marketingData).forEach(([date, counts]) => {
          if (!existingData[date]) existingData[date] = {};
          existingData[date].valid_applications = counts.valid_applications || 0;
        });
        state.personalDailyData[periodId] = existingData;
      }
    }

    return payload;
  } catch (error) {
    console.error('[yield] daily api failed', error);
    return null;
  }
}


function buildDailyTotalsAllMetrics(periodId) {
  const totals = {};
  Object.values(state.companyDailyData || {}).forEach(periodMap => {
    const series = periodMap?.[periodId] || {};
    Object.entries(series).forEach(([date, counts]) => {
      if (!totals[date]) totals[date] = {};
      Object.entries(counts || {}).forEach(([key, value]) => {
        totals[date][key] = num(totals[date][key]) + num(value);
      });
    });
  });
  return totals;
}

let candidateDataset = [];
let candidateLoadedAt = null;
const getAdvisorName = () => getSession()?.user?.name || null;

async function ensureCandidateDataset() {
  if (candidateDataset.length) {
    console.log('[yield] reuse cached candidate dataset', {
      count: candidateDataset.length,
      loadedAt: candidateLoadedAt?.toISOString?.() || candidateLoadedAt
    });
    return candidateDataset;
  }

  // ★ サーバや candidatesRepository を使わず、モックから直接読み込む
  const raw = await getMockCandidates();

  candidateDataset = Array.isArray(raw) ? raw : [];
  candidateLoadedAt = new Date();
  console.log('[yield] loaded candidate dataset (mock)', {
    count: candidateDataset.length,
    loadedAt: candidateLoadedAt.toISOString()
  });

  return candidateDataset;
}
const TODAY_GOAL_KEY = 'todayGoals.v1';
const MONTHLY_GOAL_KEY = 'monthlyGoals.v1';
const goalCache = {};
const RATE_KEYS = ['提案率', '推薦率', '面接設定率', '面接実施率', '内定率', '承諾率', '入社決定率'];
const RATE_COUNT_LABELS = {
  newInterviews: '新規面談数',
  proposals: '提案数',
  recommendations: '推薦数',
  interviewsScheduled: '面接設定数',
  interviewsHeld: '面接実施数',
  offers: '内定数',
  accepts: '承諾数',
  hires: '入社数'
};
const RATE_CALC_STEPS = [
  { rateKey: 'proposalRate', numerator: 'proposals', stepDenom: 'newInterviews' },
  { rateKey: 'recommendationRate', numerator: 'recommendations', stepDenom: 'proposals' },
  { rateKey: 'interviewScheduleRate', numerator: 'interviewsScheduled', stepDenom: 'recommendations' },
  { rateKey: 'interviewHeldRate', numerator: 'interviewsHeld', stepDenom: 'interviewsScheduled' },
  { rateKey: 'offerRate', numerator: 'offers', stepDenom: 'interviewsHeld' },
  { rateKey: 'acceptRate', numerator: 'accepts', stepDenom: 'offers' },
  { rateKey: 'hireRate', numerator: 'hires', stepDenom: 'accepts' }
];

function buildRateDetailPipeline(denomMode) {
  const useStep = normalizeRateCalcMode(denomMode) === 'step';
  return RATE_CALC_STEPS.map(step => {
    const denomKey = useStep ? step.stepDenom : 'newInterviews';
    return {
      labelA: RATE_COUNT_LABELS[step.numerator] || step.numerator,
      keyA: step.numerator,
      labelB: RATE_COUNT_LABELS[denomKey] || denomKey,
      keyB: denomKey
    };
  });
}

const RATE_DETAIL_PIPELINE_BASE = buildRateDetailPipeline('base');
const RATE_DETAIL_PIPELINE_STEP = buildRateDetailPipeline('step');
const DASHBOARD_YEARS = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];
const DASHBOARD_MONTHS = Array.from({ length: 12 }, (_, idx) => idx + 1);
const DASHBOARD_COLORS = ['#2563eb', '#0ea5e9', '#10b981', '#f97316', '#8b5cf6', '#14b8a6', '#ec4899'];

const COUNT_ID_MAP = {
  today: {
    newInterviews: 'todayProposals',
    proposals: 'todayRecommendations',
    recommendations: 'todayInterviewsScheduled',
    interviewsScheduled: 'todayInterviewsHeld',
    interviewsHeld: 'todayOffers',
    offers: 'todayAccepts',
    accepts: 'todayHires'
  },
  personalMonthly: {
    newInterviews: 'personalProposals',
    proposals: 'personalRecommendations',
    recommendations: 'personalInterviewsScheduled',
    interviewsScheduled: 'personalInterviewsHeld',
    interviewsHeld: 'personalOffers',
    offers: 'personalAccepts',
    accepts: 'personalHires'
  },
  personalPeriod: {
    newInterviews: 'periodProposals',
    proposals: 'periodRecommendations',
    recommendations: 'periodInterviewsScheduled',
    interviewsScheduled: 'periodInterviewsHeld',
    interviewsHeld: 'periodOffers',
    offers: 'periodAccepts',
    accepts: 'periodHires'
  },
  companyMonthly: {
    newInterviews: 'companyProposals',
    proposals: 'companyRecommendations',
    recommendations: 'companyInterviewsScheduled',
    interviewsScheduled: 'companyInterviewsHeld',
    interviewsHeld: 'companyOffers',
    offers: 'companyAccepts',
    accepts: 'companyHires'
  },
  companyPeriod: {
    newInterviews: 'companyPeriodProposals',
    proposals: 'companyPeriodRecommendations',
    recommendations: 'companyPeriodInterviewsScheduled',
    interviewsScheduled: 'companyPeriodInterviewsHeld',
    interviewsHeld: 'companyPeriodOffers',
    offers: 'companyPeriodAccepts',
    accepts: 'companyPeriodHires'
  }
};

const RATE_ID_MAP = {
  personalMonthly: {
    proposalRate: 'personalProposalRate',
    recommendationRate: 'personalRecommendationRate',
    interviewScheduleRate: 'personalInterviewScheduleRate',
    interviewHeldRate: 'personalInterviewHeldRate',
    offerRate: 'personalOfferRate',
    acceptRate: 'personalAcceptRate',
    hireRate: 'personalHireRate'
  },
  personalPeriod: {
    proposalRate: 'periodProposalRate',
    recommendationRate: 'periodRecommendationRate',
    interviewScheduleRate: 'periodInterviewScheduleRate',
    interviewHeldRate: 'periodInterviewHeldRate',
    offerRate: 'periodOfferRate',
    acceptRate: 'periodAcceptRate',
    hireRate: 'periodHireRate'
  },
  companyMonthly: {
    proposalRate: 'companyProposalRate',
    recommendationRate: 'companyRecommendationRate',
    interviewScheduleRate: 'companyInterviewScheduleRate',
    interviewHeldRate: 'companyInterviewHeldRate',
    offerRate: 'companyOfferRate',
    acceptRate: 'companyAcceptRate',
    hireRate: 'companyHireRate'
  },
  companyPeriod: {
    proposalRate: 'companyPeriodProposalRate',
    recommendationRate: 'companyPeriodRecommendationRate',
    interviewScheduleRate: 'companyPeriodInterviewScheduleRate',
    interviewHeldRate: 'companyPeriodInterviewHeldRate',
    offerRate: 'companyPeriodOfferRate',
    acceptRate: 'companyPeriodAcceptRate',
    hireRate: 'companyPeriodHireRate'
  }
};

const RATE_CARD_IDS = {
  personalMonthly: [
    'personalProposalRate',
    'personalRecommendationRate',
    'personalInterviewScheduleRate',
    'personalInterviewHeldRate',
    'personalOfferRate',
    'personalAcceptRate',
    'personalHireRate'
  ],
  personalPeriod: [
    'periodProposalRate',
    'periodRecommendationRate',
    'periodInterviewScheduleRate',
    'periodInterviewHeldRate',
    'periodOfferRate',
    'periodAcceptRate',
    'periodHireRate'
  ],
  companyMonthly: [
    'companyProposalRate',
    'companyRecommendationRate',
    'companyInterviewScheduleRate',
    'companyInterviewHeldRate',
    'companyOfferRate',
    'companyAcceptRate',
    'companyHireRate'
  ],
  companyPeriod: [
    'companyPeriodProposalRate',
    'companyPeriodRecommendationRate',
    'companyPeriodInterviewScheduleRate',
    'companyPeriodInterviewHeldRate',
    'companyPeriodOfferRate',
    'companyPeriodAcceptRate',
    'companyPeriodHireRate'
  ]
};

const TARGET_TO_GOAL_KEY = {
  newInterviewsTarget: 'proposals',
  proposalsTarget: 'recommendations',
  recommendationsTarget: 'interviewsScheduled',
  interviewsScheduledTarget: 'interviewsHeld',
  interviewsHeldTarget: 'offers',
  offersTarget: 'accepts',
  acceptsTarget: 'hires',
  proposalRateTarget: 'proposalRate',
  recommendationRateTarget: 'recommendationRate',
  interviewScheduleRateTarget: 'interviewScheduleRate',
  interviewHeldRateTarget: 'interviewHeldRate',
  offerRateTarget: 'offerRate',
  acceptRateTarget: 'acceptRate',
  hireRateTarget: 'hireRate'
};

const TARGET_TO_DATA_KEY = {
  newInterviewsTarget: 'newInterviews',
  proposalsTarget: 'proposals',
  recommendationsTarget: 'recommendations',
  interviewsScheduledTarget: 'interviewsScheduled',
  interviewsHeldTarget: 'interviewsHeld',
  offersTarget: 'offers',
  acceptsTarget: 'accepts',
  proposalRateTarget: 'proposalRate',
  recommendationRateTarget: 'recommendationRate',
  interviewScheduleRateTarget: 'interviewScheduleRate',
  interviewHeldRateTarget: 'interviewHeldRate',
  offerRateTarget: 'offerRate',
  acceptRateTarget: 'acceptRate',
  hireRateTarget: 'hireRate'
};

const DAILY_FIELDS = [
  { targetKey: 'newInterviewsTarget', dataKey: 'newInterviews' },
  { targetKey: 'proposalsTarget', dataKey: 'proposals' },
  { targetKey: 'recommendationsTarget', dataKey: 'recommendations' },
  { targetKey: 'interviewsScheduledTarget', dataKey: 'interviewsScheduled' },
  { targetKey: 'interviewsHeldTarget', dataKey: 'interviewsHeld' },
  { targetKey: 'offersTarget', dataKey: 'offers' },
  { targetKey: 'acceptsTarget', dataKey: 'accepts' },
  { targetKey: 'revenueTarget', dataKey: 'revenue' }
];

const DAILY_LABELS = {
  newInterviews: '新規面談数',
  proposals: '提案数',
  recommendations: '推薦数',
  interviewsScheduled: '面接設定数',
  interviewsHeld: '面接実施数',
  offers: '内定数',
  accepts: '承諾数',
  revenue: '売上'
};

const MS_DEPARTMENTS = [
  { key: 'marketing', label: 'マーケ' },
  { key: 'cs', label: 'CS' },
  { key: 'sales', label: '営業' },
  { key: 'revenue', label: '売り上げ' }
];

const MS_METRIC_OPTIONS = DAILY_FIELDS.map(field => ({
  key: field.dataKey,
  targetKey: field.targetKey,
  label: DAILY_LABELS[field.dataKey] || field.dataKey
}));

const PREV_KEY_MAP = {
  newInterviews: 'prevNewInterviews',
  proposals: 'prevProposals',
  recommendations: 'prevRecommendations',
  interviewsScheduled: 'prevInterviewsScheduled',
  interviewsHeld: 'prevInterviewsHeld',
  offers: 'prevOffers',
  accepts: 'prevAccepts',
  proposalRate: 'prevProposalRate',
  recommendationRate: 'prevRecommendationRate',
  interviewScheduleRate: 'prevInterviewScheduleRate',
  interviewHeldRate: 'prevInterviewHeldRate',
  offerRate: 'prevOfferRate',
  acceptRate: 'prevAcceptRate',
  hireRate: 'prevHireRate'
};

const COMPANY_TODAY_ROWS = [
  {
    name: '田中 太郎',
    proposals: 12,
    proposalsGoal: 10,
    recommendations: 9,
    recommendationsGoal: 8,
    interviewsScheduled: 7,
    interviewsScheduledGoal: 6,
    interviewsHeld: 5,
    interviewsHeldGoal: 4,
    offers: 3,
    offersGoal: 3,
    accepts: 2,
    acceptsGoal: 2
  },
  {
    name: '佐藤 花子',
    proposals: 8,
    proposalsGoal: 9,
    recommendations: 7,
    recommendationsGoal: 8,
    interviewsScheduled: 6,
    interviewsScheduledGoal: 6,
    interviewsHeld: 5,
    interviewsHeldGoal: 5,
    offers: 4,
    offersGoal: 4,
    accepts: 1,
    acceptsGoal: 2
  },
  {
    name: '鈴木 次郎',
    proposals: 6,
    proposalsGoal: 7,
    recommendations: 5,
    recommendationsGoal: 6,
    interviewsScheduled: 4,
    interviewsScheduledGoal: 5,
    interviewsHeld: 3,
    interviewsHeldGoal: 4,
    offers: 2,
    offersGoal: 3,
    accepts: 1,
    acceptsGoal: 2
  }
];

const COMPANY_TERM_ROWS = [
  {
    name: '田中 太郎',
    proposals: 210,
    proposalsGoal: 200,
    recommendations: 180,
    recommendationsGoal: 170,
    interviewsScheduled: 150,
    interviewsScheduledGoal: 140,
    interviewsHeld: 120,
    interviewsHeldGoal: 110,
    offers: 90,
    offersGoal: 85,
    accepts: 60,
    acceptsGoal: 55,
    proposalRate: 68,
    proposalRateGoal: 65,
    recommendationRate: 60,
    recommendationRateGoal: 58,
    interviewScheduleRate: 72,
    interviewScheduleRateGoal: 70,
    interviewHeldRate: 66,
    interviewHeldRateGoal: 64,
    offerRate: 52,
    offerRateGoal: 50,
    acceptRate: 46,
    acceptRateGoal: 44
  },
  {
    name: '佐藤 花子',
    proposals: 180,
    proposalsGoal: 190,
    recommendations: 155,
    recommendationsGoal: 165,
    interviewsScheduled: 130,
    interviewsScheduledGoal: 135,
    interviewsHeld: 100,
    interviewsHeldGoal: 105,
    offers: 78,
    offersGoal: 80,
    accepts: 52,
    acceptsGoal: 55,
    proposalRate: 65,
    proposalRateGoal: 67,
    recommendationRate: 58,
    recommendationRateGoal: 60,
    interviewScheduleRate: 70,
    interviewScheduleRateGoal: 72,
    interviewHeldRate: 62,
    interviewHeldRateGoal: 64,
    offerRate: 48,
    offerRateGoal: 50,
    acceptRate: 42,
    acceptRateGoal: 45
  },
  {
    name: '鈴木 次郎',
    proposals: 150,
    proposalsGoal: 155,
    recommendations: 132,
    recommendationsGoal: 140,
    interviewsScheduled: 115,
    interviewsScheduledGoal: 118,
    interviewsHeld: 90,
    interviewsHeldGoal: 95,
    offers: 70,
    offersGoal: 75,
    accepts: 45,
    acceptsGoal: 48,
    proposalRate: 60,
    proposalRateGoal: 62,
    recommendationRate: 55,
    recommendationRateGoal: 57,
    interviewScheduleRate: 68,
    interviewScheduleRateGoal: 70,
    interviewHeldRate: 60,
    interviewHeldRateGoal: 62,
    offerRate: 46,
    offerRateGoal: 48,
    acceptRate: 40,
    acceptRateGoal: 42
  }
];

const GOAL_CONFIG = {
  today: {
    storageKey: TODAY_GOAL_KEY,
    inputPrefix: 'todayGoal-',
    achvPrefix: 'todayAchv-',
    metrics: [
      { goalKey: 'proposals', dataKey: 'newInterviews' },
      { goalKey: 'recommendations', dataKey: 'proposals' },
      { goalKey: 'interviewsScheduled', dataKey: 'recommendations' },
      { goalKey: 'interviewsHeld', dataKey: 'interviewsScheduled' },
      { goalKey: 'offers', dataKey: 'interviewsHeld' },
      { goalKey: 'accepts', dataKey: 'offers' },
      { goalKey: 'hires', dataKey: 'accepts' }
    ]
  },
  monthly: {
    storageKey: MONTHLY_GOAL_KEY,
    inputPrefix: 'monthlyGoal-',
    achvPrefix: 'monthlyAchv-',
    metrics: [
      { goalKey: 'proposals', dataKey: 'newInterviews' },
      { goalKey: 'recommendations', dataKey: 'proposals' },
      { goalKey: 'interviewsScheduled', dataKey: 'recommendations' },
      { goalKey: 'interviewsHeld', dataKey: 'interviewsScheduled' },
      { goalKey: 'offers', dataKey: 'interviewsHeld' },
      { goalKey: 'accepts', dataKey: 'offers' },
      { goalKey: 'hires', dataKey: 'accepts' },
      { goalKey: 'proposalRate', dataKey: 'proposalRate' },
      { goalKey: 'recommendationRate', dataKey: 'recommendationRate' },
      { goalKey: 'interviewScheduleRate', dataKey: 'interviewScheduleRate' },
      { goalKey: 'interviewHeldRate', dataKey: 'interviewHeldRate' },
      { goalKey: 'offerRate', dataKey: 'offerRate' },
      { goalKey: 'acceptRate', dataKey: 'acceptRate' },
      { goalKey: 'hireRate', dataKey: 'hireRate' }
    ]
  }
};

function getRateDetailPipeline() {
  return getRateCalcMode() === 'step' ? RATE_DETAIL_PIPELINE_STEP : RATE_DETAIL_PIPELINE_BASE;
}

const COHORT_NUMERATOR_MAP = {
  proposals: 'cohortProposals',
  recommendations: 'cohortRecommendations',
  interviewsScheduled: 'cohortInterviewsScheduled',
  interviewsHeld: 'cohortInterviewsHeld',
  offers: 'cohortOffers',
  accepts: 'cohortAccepts',
  hires: 'cohortHires'
};

const mockDashboardData = {
  personal: {
    baseRates: {
      提案率: 62,
      推薦率: 58,
      面接設定率: 72,
      面接実施率: 65,
      内定率: 48,
      承諾率: 42,
      入社決定率: 35
    },
    jobCategories: {
      labels: ['エンジニア', '営業', 'コーポレート', 'マーケ', 'その他'],
      data: [18, 12, 9, 7, 5]
    },
    gender: {
      labels: ['男性', '女性', 'その他', '不明'],
      data: [24, 19, 2, 3]
    },
    ageGroups: {
      labels: ['20代未満', '20代', '30代', '40代', '50代以上'],
      data: [2, 14, 18, 8, 4]
    }
  },
  company: {
    baseRates: {
      提案率: 66,
      推薦率: 60,
      面接設定率: 80,
      面接実施率: 70,
      内定率: 52,
      承諾率: 46,
      入社決定率: 40
    },
    jobCategories: {
      labels: ['エンジニア', '営業', 'コーポレート', 'マーケ', 'CS'],
      data: [120, 85, 60, 48, 52]
    },
    gender: {
      labels: ['男性', '女性', 'その他', '不明'],
      data: [210, 175, 12, 18]
    },
    mediaSources: {
      labels: ['Indeed', 'リクナビ', 'マイナビ', '自社HP', '紹介'],
      data: [95, 80, 72, 44, 38]
    },
    ageGroups: {
      labels: ['20代未満', '20代', '30代', '40代', '50代以上'],
      data: [12, 140, 182, 110, 45]
    }
  }
};

const state = {
  yieldScope: 'all',
  isAdmin: false,
  loadSeq: 0,
  calcMode: DEFAULT_CALC_MODE,
  rateCalcMode: DEFAULT_RATE_CALC_MODE,
  kpiTargets: {}, // New field
  kpi: {
    today: {},
    monthly: {},
    personalPeriod: {},
    companyMonthly: {},
    companyPeriod: {}
  },
  evaluationPeriods: [],
  personalEvaluationPeriodId: '',
  personalDisplayMode: 'monthly',
  companyEvaluationPeriodId: '',
  personalDailyPeriodId: '',
  companyDailyPeriodId: '',
  companyDailyEmployeeId: '',
  companyTermPeriodId: '',
  companyTermPeriodId: '',
  companyMsPeriodId: '',
  personalMsPeriodId: '',
  personalMs: {},
  personalDailyData: {},
  companyDailyData: {},
  companyDailyEmployees: [],
  ranges: {
    personalPeriod: {},
    companyPeriod: {},
    employee: getCurrentMonthRange()
  },
  employees: {
    list: [],
    filters: { search: '', sortKey: 'name', sortOrder: 'asc' }
  },
  companyToday: {
    rows: [],
    filters: { search: '', sortKey: 'name', sortOrder: 'asc' }
  },
  companyTerm: {
    rows: [],
    filters: { search: '', sortKey: 'name', sortOrder: 'asc' }
  },
  companyMs: {
    metricKeys: {
      marketing: 'newInterviews',
      cs: 'newInterviews',
      sales: 'newInterviews'
    },
    dates: [],
    dailyTotals: {},
    companyTarget: {},
    msTargets: {}, // 部門別・日付別のMS目標値
    msTargetTotals: {}, // 部門別・指標別の期間目標
    msActuals: {}, // 部門別・日付別のMS実績値
    revenue: {
      actual: 0,
      target: 0
    }
  },
  msRateModes: {
    personalDaily: 'daily',
    companyMs: 'daily'
  },
  personalDailyMs: {
    metricKeys: {},
    targets: {},
    totals: {}
  },
  // 個人別MSデータ
  personalMs: {
    marketing: { members: [], msTargets: {}, msTargetTotals: {}, msActuals: {}, dates: [], metricKeys: {} },
    cs: { members: [], msTargets: {}, msTargetTotals: {}, msActuals: {}, dates: [], metricKeys: {} },
    sales: { members: [], msTargets: {}, msTargetTotals: {}, msActuals: {}, dates: [], metricKeys: {} },
    importantMetrics: {
      marketing: {},
      cs: {},
      sales: {}
    }
  },
  companySales: {
    metricKeys: {},
    employees: [],
    dates: []
  },
  dashboard: {
    personal: {
      trendMode: 'month',
      year: DASHBOARD_YEARS[0],
      month: new Date().getMonth() + 1,
      charts: {},
      trendData: null,
      breakdown: null
    },
    company: {
      trendMode: 'month',
      year: DASHBOARD_YEARS[0],
      month: new Date().getMonth() + 1,
      charts: {},
      trendData: null,
      breakdown: null
    }
  }
};

if (typeof window !== 'undefined') {
  window.__yieldState = state;
}

let chartJsPromise = null;

function resolveYieldScope(root) {
  const host = root?.querySelector?.('[data-yield-scope]') || document.querySelector('[data-yield-scope]');
  return host?.dataset?.yieldScope || 'all';
}

function isYieldScope(scope) {
  return state.yieldScope === 'all' || state.yieldScope === scope;
}

function getCurrentMonthRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    startDate: isoDate(start),
    endDate: isoDate(end)
  };
}

function getOneYearRange() {
  const end = new Date();
  const start = new Date(end.getFullYear() - 1, end.getMonth(), end.getDate());
  return {
    startDate: isoDate(start),
    endDate: isoDate(end)
  };
}

function getDashboardRange(scope) {
  const current = state.dashboard[scope];
  const year = Number(current.year) || new Date().getFullYear();
  if (current.trendMode === 'year') {
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`
    };
  }
  const month = Number(current.month) || new Date().getMonth() + 1;
  const paddedMonth = String(month).padStart(2, '0');
  const endDate = isoDate(new Date(year, month, 0));
  return {
    startDate: `${year}-${paddedMonth}-01`,
    endDate
  };
}

function getDashboardTrendGranularity(scope) {
  return state.dashboard[scope].trendMode === 'year' ? 'month' : 'day';
}

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatPeriodMonthLabel(period) {
  if (!period) return '';
  if (period.startDate) {
    const [year, month] = String(period.startDate).split('-');
    if (year && month) return `${year}年${month}月`;
  }
  const id = String(period.id || '');
  const match = id.match(/^(\d{4})-(\d{2})/);
  if (match) return `${match[1]}年${match[2]}月`;
  return period.label || id || '';
}

function safe(name, fn) {
  try {
    return fn();
  } catch (e) {
    console.error(`[yield] ${name} failed:`, e);
    return null;
  }
}

function num(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function setTextByRef(ref, value) {
  const element = document.querySelector(`[data-ref="${ref}"]`);
  if (element) {
    element.textContent = value;
  }
}

function readGoals(storageKey) {
  return goalCache[storageKey] || {};
}

function persistGoal(storageKey, metric, rawValue, onChange) {
  const current = readGoals(storageKey);
  const next = { ...current };
  if (rawValue === '') {
    delete next[metric];
  } else {
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed) && parsed >= 0) {
      next[metric] = parsed;
    }
  }
  goalCache[storageKey] = next;
  if (onChange) onChange();
}

function mapTargetsToGoals(target = {}) {
  return Object.entries(TARGET_TO_GOAL_KEY).reduce((acc, [sourceKey, goalKey]) => {
    acc[goalKey] = num(target[sourceKey]);
    return acc;
  }, {});
}

function resolveAdvisorGoal(periodId, dateStr, advisorName, targetKey) {
  if (!periodId || !targetKey) return null;
  const dailyTargets = goalSettingsService.getPersonalDailyTargets(periodId, advisorName) || {};
  const daily = dailyTargets[dateStr];
  if (daily && daily[targetKey] !== undefined && daily[targetKey] !== null) {
    return num(daily[targetKey]);
  }
  const periodTarget = goalSettingsService.getPersonalPeriodTarget(periodId, advisorName) || {};
  const value = periodTarget[targetKey];
  return value === undefined || value === null ? null : num(value);
}

function updateGoalStorage(storageKey, updates = {}) {
  const current = readGoals(storageKey);
  const merged = { ...current, ...updates };
  goalCache[storageKey] = merged;
  return merged;
}

function seedMonthlyGoalsFromSettings() {
  const target = goalSettingsService.getPersonalPeriodTarget(state.personalEvaluationPeriodId, getAdvisorName()) || {};
  const mapped = mapTargetsToGoals(target);
  updateGoalStorage(MONTHLY_GOAL_KEY, mapped);
}

function seedTodayGoalsFromSettings() {
  const todayStr = isoDate(new Date());
  const todayPeriodId =
    goalSettingsService.resolvePeriodIdByDate(todayStr, state.evaluationPeriods) ||
    state.personalEvaluationPeriodId;
  const dailyTargets = todayPeriodId
    ? goalSettingsService.getPersonalDailyTargets(todayPeriodId, getAdvisorName())
    : {};
  const dayTarget = dailyTargets?.[todayStr];
  const fallback = todayPeriodId
    ? goalSettingsService.getPersonalPeriodTarget(todayPeriodId, getAdvisorName())
    : {};
  const mapped = mapTargetsToGoals(dayTarget || fallback || {});
  updateGoalStorage(TODAY_GOAL_KEY, mapped);
}

function seedGoalDefaultsFromSettings() {
  seedTodayGoalsFromSettings();
  seedMonthlyGoalsFromSettings();
}

function syncAccessRole() {
  state.isAdmin = true;
  toggleEmployeeSections(true);
}

function toggleEmployeeSections(shouldShow) {
  const employeeSection = document.getElementById('employeeTableBody')?.closest('.kpi-v2-subsection');
  if (employeeSection) {
    employeeSection.hidden = !shouldShow;
  }
  if (!shouldShow) {
    state.employees.list = [];
    renderEmployeeRows([]);
  }
}

function initializeCalcModeControls() {
  const selects = Array.from(document.querySelectorAll('[data-calc-mode-select]'));
  if (!selects.length) return;
  const initial = normalizeCalcMode(selects[0].value || state.calcMode || DEFAULT_CALC_MODE);
  state.calcMode = initial;
  selects.forEach(select => {
    select.value = initial;
  });
  selects.forEach(select => {
    select.addEventListener('change', () => {
      const next = normalizeCalcMode(select.value);
      if (next === state.calcMode) return;
      state.calcMode = next;
      dailyYieldCache.clear();
      state.personalDailyData = {};
      state.companyDailyData = {};
      selects.forEach(other => {
        if (other !== select) other.value = next;
      });
      loadYieldData();
      reloadDashboardData('personal');
      reloadDashboardData('company');
    });
  });
}

function updateRateModeLabels() {
  const mode = getRateCalcMode();
  const label = getRateCalcModeLabel(mode);
  document.querySelectorAll('[data-rate-calc-mode-select]').forEach(el => {
    el.value = mode;
  });
  document.querySelectorAll('[data-rate-mode-label]').forEach(el => {
    el.textContent = label;
  });
  document.querySelectorAll('[data-rate-mode-toggle]').forEach(button => {
    button.setAttribute('aria-pressed', mode === 'step' ? 'true' : 'false');
  });
}

function applyRateMode(nextMode, { syncSelects = true } = {}) {
  const next = normalizeRateCalcMode(nextMode);
  if (next === state.rateCalcMode) return;
  state.rateCalcMode = next;
  try {
    localStorage.setItem(RATE_CALC_MODE_STORAGE_KEY, next);
  } catch (error) {
    console.warn('[yield] failed to persist rate calc mode', error);
  }
  if (syncSelects) {
    document.querySelectorAll('[data-rate-calc-mode-select]').forEach(select => {
      select.value = next;
    });
  }
  updateRateModeLabels();
  loadYieldData();
  reloadDashboardData('personal');
  reloadDashboardData('company');
}

function initializeRateModeControls() {
  const selects = Array.from(document.querySelectorAll('[data-rate-calc-mode-select]'));
  const toggles = Array.from(document.querySelectorAll('[data-rate-mode-toggle]'));
  if (!selects.length && !toggles.length) return;
  let stored = null;
  try {
    stored = localStorage.getItem(RATE_CALC_MODE_STORAGE_KEY);
  } catch (error) {
    console.warn('[yield] rate calc mode storage unavailable', error);
  }
  state.rateCalcMode = normalizeRateCalcMode(stored || state.rateCalcMode || DEFAULT_RATE_CALC_MODE);
  updateRateModeLabels();
  selects.forEach(select => {
    select.addEventListener('change', (e) => {
      applyRateMode(e.target.value, { syncSelects: false });
      // Update other selects
      selects.forEach(other => {
        if (other !== select) other.value = state.rateCalcMode;
      });
    });
  });
  toggles.forEach(button => {
    if (button.dataset.bound) return;
    button.addEventListener('click', () => {
      const next = state.rateCalcMode === 'step' ? 'base' : 'step';
      applyRateMode(next);
    });
    button.dataset.bound = 'true';
  });
}

function updateMsRateToggleButton(button, mode) {
  if (!button) return;
  const label = mode === 'overall' ? '全体' : '毎日';
  button.textContent = label;
  button.setAttribute('aria-pressed', mode === 'overall' ? 'true' : 'false');
}

function initializeMsRateToggles() {
  document.querySelectorAll('[data-ms-rate-toggle]').forEach(button => {
    const scope = button.dataset.msRateScope;
    if (!scope) return;
    const current = state.msRateModes?.[scope] || 'daily';
    updateMsRateToggleButton(button, current);
    if (button.dataset.bound) return;
    button.addEventListener('click', () => {
      if (!state.msRateModes) state.msRateModes = {};
      const next = state.msRateModes[scope] === 'overall' ? 'daily' : 'overall';
      state.msRateModes[scope] = next;
      updateMsRateToggleButton(button, next);
      if (scope === 'personalDaily') {
        const periodId = state.personalDailyPeriodId;
        const dailyData = state.personalDailyData[periodId] || {};
        renderPersonalDailyTable(periodId, dailyData);
      }
      if (scope === 'companyMs') {
        renderCompanyMsTable();
        renderAllPersonalMsTables();
      }
    });
    button.dataset.bound = 'true';
  });
}

export async function mount(root) {
  state.yieldScope = resolveYieldScope(root);
  syncAccessRole();
  try {
    await goalSettingsService.load({ force: true });
  } catch (error) {
    console.warn('[yield] failed to load goal settings', error);
  }
  safe('initializeDatePickers', initializeDatePickers);
  safe('initPersonalPeriodPreset', initPersonalPeriodPreset);
  safe('initCompanyPeriodPreset', initCompanyPeriodPreset);
  safe('initEmployeePeriodPreset', initEmployeePeriodPreset);
  safe('initializeEmployeeControls', initializeEmployeeControls);
  safe('initializeCompanyDailyEmployeeSelect', initializeCompanyDailyEmployeeSelect);
  safe('initializeCompanyPeriodSections', initializeCompanyPeriodSections);
  safe('initializeDashboardSection', initializeDashboardSection);
  safe('initializeKpiTabs', initializeKpiTabs);
  safe('initializeEvaluationPeriods', initializeEvaluationPeriods);
  safe('initializeCalcModeControls', initializeCalcModeControls);
  safe('initializeRateModeControls', initializeRateModeControls);
  safe('initializeMsRateToggles', initializeMsRateToggles);
  safe('loadYieldData', loadYieldData);

  // Force load CSS with cache buster
  if (typeof document !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './pages/yield/yield.css?v=20260205_140149';
    document.head.appendChild(link);
  }
}

export function unmount() { }

function initializeDatePickers() {
  const monthRange = getCurrentMonthRange();

  const personalRangeStart = document.getElementById('personalRangeStart');
  const personalRangeEnd = document.getElementById('personalRangeEnd');
  const companyPeriodStart = document.getElementById('companyPeriodStart');
  const companyPeriodEnd = document.getElementById('companyPeriodEnd');

  if (personalRangeStart) personalRangeStart.value = monthRange.startDate;
  if (personalRangeEnd) personalRangeEnd.value = monthRange.endDate;
  if (companyPeriodStart) companyPeriodStart.value = monthRange.startDate;
  if (companyPeriodEnd) companyPeriodEnd.value = monthRange.endDate;

  state.ranges.personalPeriod = { startDate: personalRangeStart?.value, endDate: personalRangeEnd?.value };
  state.ranges.companyPeriod = { startDate: companyPeriodStart?.value, endDate: companyPeriodEnd?.value };

  const handlePersonalChange = () => {
    const nextRange = { startDate: personalRangeStart?.value, endDate: personalRangeEnd?.value };
    if (isValidRange(nextRange)) {
      state.personalDisplayMode = 'range';
      state.ranges.personalPeriod = nextRange;
      loadYieldData();
    }
  };
  [personalRangeStart, personalRangeEnd].forEach(input => input?.addEventListener('change', handlePersonalChange));

  const handleCompanyChange = async () => {
    const nextRange = { startDate: companyPeriodStart?.value, endDate: companyPeriodEnd?.value };
    if (isValidRange(nextRange)) {
      state.ranges.companyPeriod = nextRange;
      await loadCompanyPeriodKPIData();
    }
  };
  [companyPeriodStart, companyPeriodEnd].forEach(input => input?.addEventListener('change', handleCompanyChange));
}

function setupRangePresets({ buttonSelector, startInputId, endInputId, onApply }) {
  const buttons = document.querySelectorAll(buttonSelector);
  const startInput = document.getElementById(startInputId);
  const endInput = document.getElementById(endInputId);
  if (!buttons.length || !startInput || !endInput) return;

  const applyRange = rawRange => {
    const months = parseInt(rawRange, 10) || 0;
    const baseEnd = endInput.value ? new Date(endInput.value) : new Date();
    const normalizedEnd = new Date(baseEnd.getFullYear(), baseEnd.getMonth(), baseEnd.getDate());
    if (!endInput.value) endInput.value = isoDate(normalizedEnd);
    const startDate = new Date(normalizedEnd.getTime());
    startDate.setMonth(startDate.getMonth() - months);
    startInput.value = isoDate(startDate);
    if (onApply) onApply(startInput.value, endInput.value);
  };

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      buttons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      applyRange(button.dataset.range);
    });
  });

  const first = buttons[0];
  if (first) {
    first.classList.add('active');
    if (first.dataset.range) applyRange(first.dataset.range);
  }
}

function initPersonalPeriodPreset() {
  setupRangePresets({
    buttonSelector: '.period-preset-btn:not(.company):not(.employee)',
    startInputId: 'personalRangeStart',
    endInputId: 'personalRangeEnd',
    onApply: (startDate, endDate) => {
      state.personalDisplayMode = 'range';
      state.ranges.personalPeriod = { startDate, endDate };
      loadYieldData();
    }
  });
}

function initCompanyPeriodPreset() {
  setupRangePresets({
    buttonSelector: '.period-preset-btn.company',
    startInputId: 'companyPeriodStart',
    endInputId: 'companyPeriodEnd',
    onApply: (startDate, endDate) => {
      state.ranges.companyPeriod = { startDate, endDate };
      loadCompanyPeriodKPIData();
    }
  });
}

function initEmployeePeriodPreset() {
  const startInput = document.getElementById('employeeRangeStart');
  const endInput = document.getElementById('employeeRangeEnd');

  setupRangePresets({
    buttonSelector: '.period-preset-btn.employee',
    startInputId: 'employeeRangeStart',
    endInputId: 'employeeRangeEnd',
    onApply: (startDate, endDate) => {
      state.ranges.employee = { startDate, endDate };
      loadEmployeeData(state.ranges.employee);
    }
  });

  if (startInput?.value && endInput?.value) {
    state.ranges.employee = { startDate: startInput.value, endDate: endInput.value };
  }

  const handleManualChange = () => {
    if (!startInput?.value || !endInput?.value) return;
    if (!isValidRange({ startDate: startInput.value, endDate: endInput.value })) return;
    document.querySelectorAll('.period-preset-btn.employee').forEach(btn => btn.classList.remove('active'));
    state.ranges.employee = { startDate: startInput.value, endDate: endInput.value };
    loadEmployeeData(state.ranges.employee);
  };

  [startInput, endInput].forEach(input => input?.addEventListener('change', handleManualChange));
}

function initializeEmployeeControls() {
  const searchInput = document.getElementById('employeeSearchInput');
  const searchButton = document.getElementById('employeeSearchButton');
  const sortSelect = document.getElementById('employeeSortSelect');

  const triggerSearch = () => applyEmployeeSearch(searchInput?.value || '');
  searchButton?.addEventListener('click', triggerSearch);
  searchInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      triggerSearch();
    }
  });

  sortSelect?.addEventListener('change', handleEmployeeSort);
}

function initializeCompanyPeriodSections() {
  const termSearchInput = document.getElementById('companyTermSearchInput');
  const termSearchButton = document.getElementById('companyTermSearchButton');
  const termSortSelect = document.getElementById('companyTermSortSelect');

  // 本日の活動状況は非表示

  const triggerTermSearch = () => applyCompanyTermSearch(termSearchInput?.value || '');
  termSearchButton?.addEventListener('click', triggerTermSearch);
  termSearchInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      triggerTermSearch();
    }
  });
  termSortSelect?.addEventListener('change', handleCompanyTermSort);

  // renderCompanyTodayTable();
  renderCompanyTermTables();
}

function initGoalInputs(scope) {
  const config = GOAL_CONFIG[scope];
  if (!config) return;
  const inputs = document.querySelectorAll(`.goal-input[data-ref^="${config.inputPrefix}"]`);
  if (!inputs.length) return;
  const goals = readGoals(config.storageKey);

  inputs.forEach(input => {
    const metric = input.dataset.ref?.replace(config.inputPrefix, '');
    if (!metric) return;
    if (goals[metric] !== undefined) {
      input.value = goals[metric];
    }
    if (input.dataset.goalBound) return;
    const handler = event => {
      persistGoal(config.storageKey, metric, event.target.value, () => refreshAchievements(scope));
    };
    input.addEventListener('input', handler);
    input.addEventListener('change', handler);
    input.dataset.goalBound = 'true';
  });
}

function refreshAchievements(scope) {
  if (scope === 'today') {
    renderGoalProgress('today', state.kpi.today);
  }
  if (scope === 'monthly') {
    renderGoalProgress('monthly', state.kpi.monthly);
  }
}

function renderGoalProgress(scope, data) {
  const config = GOAL_CONFIG[scope];
  if (!config) return;
  const goals = readGoals(config.storageKey);

  config.metrics.forEach(({ dataKey, goalKey }) => {
    const current = num(data?.[dataKey]);
    const target = num(goals[goalKey]);
    const achv = document.querySelector(`[data-ref="${config.achvPrefix}${goalKey}"]`);
    if (!achv) return;
    if (target > 0) {
      const percent = Math.round((current / target) * 100);
      achv.textContent = `${percent}%`;
      setCardAchievementProgress(achv, percent);
    } else {
      achv.textContent = '--%';
      setCardAchievementProgress(achv, 0);
    }
  });
}

function renderGoalValues(scope) {
  const config = GOAL_CONFIG[scope];
  if (!config) return;
  const goals = readGoals(config.storageKey);
  Object.entries(goals).forEach(([key, value]) => {
    const el = document.querySelector(`[data-ref="${config.inputPrefix}${key}"]`);
    if (el) {
      el.textContent = num(value).toLocaleString();
    }
  });
}

function ensureDeltaElement(valueEl) {
  if (!valueEl) return null;
  let delta = valueEl.nextElementSibling;
  if (!delta || !delta.classList?.contains('kpi-v2-delta')) {
    delta = document.createElement('div');
    delta.className = 'kpi-v2-delta delta-neutral';
    valueEl.insertAdjacentElement('afterend', delta);
  }
  return delta;
}

function setDeltaValue(elementId, diff, isPercent = false) {
  const valueEl = document.getElementById(elementId);
  const deltaEl = ensureDeltaElement(valueEl);
  if (!deltaEl) return;
  if (diff === null || diff === undefined || Number.isNaN(diff)) {
    deltaEl.textContent = '--';
    deltaEl.className = 'kpi-v2-delta delta-neutral';
    return;
  }
  const isPositive = diff > 0;
  const isNegative = diff < 0;
  const arrow = isPositive ? '▲' : isNegative ? '▼' : '±';
  const cls = isPositive ? 'delta-positive' : isNegative ? 'delta-negative' : 'delta-neutral';
  const abs = Math.abs(Math.round(diff));
  const suffix = isPercent ? '%' : '';
  deltaEl.textContent = `${arrow}${abs}${suffix}`;
  deltaEl.className = `kpi-v2-delta ${cls}`;
}

function renderDeltaBadges(section, data, diffOverrides = {}, { includeRates = false } = {}) {
  const countMap = COUNT_ID_MAP[section];
  if (countMap) {
    Object.entries(countMap).forEach(([dataKey, elementId]) => {
      const current = num(data?.[dataKey]);
      const override = diffOverrides[dataKey];
      let diff = override !== undefined ? override : null;
      if (diff === null) {
        const prevKey = PREV_KEY_MAP[dataKey];
        if (prevKey && data?.[prevKey] !== undefined) {
          diff = current - num(data[prevKey]);
        }
      }
      setDeltaValue(elementId, diff, false);
    });
  }

  if (includeRates) {
    const rateMap = RATE_ID_MAP[section];
    if (rateMap) {
      Object.entries(rateMap).forEach(([dataKey, elementId]) => {
        const current = num(data?.[dataKey]);
        const prevKey = PREV_KEY_MAP[dataKey];
        const diff = prevKey && data?.[prevKey] !== undefined ? current - num(data[prevKey]) : null;
        setDeltaValue(elementId, diff, true);
      });
    }
  }
}

function computeTodayDiffsFromDaily() {
  const todayStr = isoDate(new Date());
  const periodId =
    goalSettingsService.resolvePeriodIdByDate(todayStr, state.evaluationPeriods) ||
    state.personalDailyPeriodId ||
    state.personalEvaluationPeriodId;
  if (!periodId) return {};
  const periodData = state.personalDailyData[periodId];
  if (!periodData) return {};
  const prevDate = isoDate(new Date(new Date(todayStr).getTime() - 24 * 60 * 60 * 1000));
  const todayValues = periodData[todayStr] || {};
  const prevValues = periodData[prevDate] || {};
  return DAILY_FIELDS.reduce((acc, field) => {
    acc[field.dataKey] = num(todayValues[field.dataKey]) - num(prevValues[field.dataKey]);
    return acc;
  }, {});
}

function renderCounts(section, data) {
  const map = COUNT_ID_MAP[section];
  if (!map) return;
  Object.entries(map).forEach(([dataKey, elementId]) => {
    setText(elementId, num(data?.[dataKey]).toLocaleString());
  });
}

function renderRates(section, data) {
  const map = RATE_ID_MAP[section];
  if (!map) return;
  Object.entries(map).forEach(([dataKey, elementId]) => {
    setText(elementId, `${num(data?.[dataKey])}%`);
  });
}

function renderRateDetails(section, data) {
  const cardIds = RATE_CARD_IDS[section];
  if (!cardIds) return;
  const isCohort = getCalcMode() === 'cohort';
  const pipeline = getRateDetailPipeline();
  cardIds.forEach((cardId, index) => {
    const detail = pipeline[index];
    if (!detail) return;
    const card = document.getElementById(cardId)?.closest('.kpi-v2-card');
    const numeratorKey = isCohort ? COHORT_NUMERATOR_MAP[detail.keyA] : null;
    const numeratorValue =
      isCohort && numeratorKey && data && data[numeratorKey] !== undefined
        ? data[numeratorKey]
        : data?.[detail.keyA];
    writeRateDetailInline(card, detail.labelA, numeratorValue, detail.labelB, data?.[detail.keyB]);
  });
}

function renderPersonalSummary(rangeData, monthOverride) {
  const primary = monthOverride || {};
  const fallback = rangeData || {};
  const primaryAmount = num(primary?.currentAmount ?? primary?.revenue ?? primary?.revenueAmount);
  const fallbackAmount = num(fallback?.currentAmount ?? fallback?.revenue ?? fallback?.revenueAmount);
  const useFallback = primaryAmount === 0 && fallbackAmount > 0;
  const targetPrimary = num(primary?.targetAmount ?? primary?.revenueTarget ?? primary?.target_amount ?? primary?.revenue_target);
  const targetFallback = num(fallback?.targetAmount ?? fallback?.revenueTarget ?? fallback?.target_amount ?? fallback?.revenue_target);
  const summary = {
    achievementRate: num(primary?.achievementRate ?? fallback?.achievementRate),
    currentAmount: useFallback ? fallbackAmount : primaryAmount,
    targetAmount: targetPrimary || targetFallback || 0,
    usedFallback: useFallback
  };
  console.log('[yield] personal revenue summary', { monthOverride, rangeData, summary });
  const periodTarget = goalSettingsService.getPersonalPeriodTarget(
    state.personalEvaluationPeriodId,
    getAdvisorName()
  );
  if (periodTarget?.revenueTarget !== undefined) {
    summary.targetAmount = num(periodTarget.revenueTarget);
  }
  if (summary.targetAmount > 0) {
    summary.achievementRate = Math.round((summary.currentAmount / summary.targetAmount) * 100);
  }
  const rateText = summary.targetAmount > 0 ? `${summary.achievementRate}%` : '--%';
  setText('personalAchievementRate', rateText);
  setText('personalCurrent', `¥${summary.currentAmount.toLocaleString()}`);
  setText('personalTarget', `¥${summary.targetAmount.toLocaleString()}`);
  const progressFill = document
    .getElementById('personalAchievementRate')
    ?.closest('.kpi-v2-summary-unified')
    ?.querySelector('.kpi-v2-progress span');
  if (progressFill) {
    const normalized = Math.max(0, Math.min(num(summary.achievementRate), 100));
    progressFill.style.width = `${normalized}%`;
  }
}



function renderPersonalKpis(todayData, summaryData, periodData) {
  const today = normalizeTodayKpi(todayData);
  const monthly = normalizeKpi(summaryData?.monthly || summaryData?.period || summaryData || {});
  const period = normalizeKpi(periodData?.period || periodData || {});

  state.kpi.today = today;
  state.kpi.monthly = monthly;
  state.kpi.personalPeriod = period;

  initGoalInputs('monthly');
  renderGoalValues('monthly');

  renderCounts('today', today);

  renderCounts('personalMonthly', monthly);
  renderRates('personalMonthly', monthly);
  renderRateDetails('personalMonthly', monthly);
  renderGoalProgress('monthly', monthly);
  renderDeltaBadges('personalMonthly', monthly, {}, { includeRates: true });

  renderCounts('personalPeriod', period);
  renderRates('personalPeriod', period);
  renderRateDetails('personalPeriod', period);

  renderPersonalSummary(monthly, monthly);
  updatePersonalPeriodLabels();
  syncEvaluationPeriodLabels();
}


function renderCompanyMonthly(data) {
  const titleEl = document.getElementById('companySummaryTitle');
  if (titleEl) titleEl.textContent = getCompanySummaryTitleText();

  state.kpi.companyMonthly = normalizeKpi(data || {});
  renderCounts('companyMonthly', state.kpi.companyMonthly);
  renderRates('companyMonthly', state.kpi.companyMonthly);
  renderRateDetails('companyMonthly', state.kpi.companyMonthly);
  renderDeltaBadges('companyMonthly', state.kpi.companyMonthly, {}, { includeRates: true });
  renderCompanyTargets();
  renderCompanyRateGoals();
}

function renderCompanyPeriod(data) {
  state.kpi.companyPeriod = normalizeKpi(data || {});
  renderCounts('companyPeriod', state.kpi.companyPeriod);
  renderRates('companyPeriod', state.kpi.companyPeriod);
  renderRateDetails('companyPeriod', state.kpi.companyPeriod);
}

function renderCompanyTargets() {
  const target = state.companyEvaluationPeriodId
    ? goalSettingsService.getCompanyPeriodTarget(state.companyEvaluationPeriodId) || {}
    : {};
  renderCompanyRevenueSummary(target);
  renderCompanyGoalCards(target, state.kpi.companyMonthly);
}

function renderCompanyRevenueSummary(target = {}) {
  const current = num(state.kpi.companyMonthly?.currentAmount ?? state.kpi.companyMonthly?.revenue ?? state.kpi.companyMonthly?.revenueAmount);
  const targetAmount = num(target.revenueTarget);
  const achv = targetAmount > 0 ? Math.round((current / targetAmount) * 100) : 0;
  console.log('[yield] company revenue summary', { target, current, targetAmount, monthly: state.kpi.companyMonthly });
  setText('companyCurrent', `¥${current.toLocaleString()}`);
  setText('companyTarget', `¥${targetAmount.toLocaleString()}`);
  setText('companyAchievementRate', targetAmount > 0 ? `${achv}%` : '--%');
  const bar = document.getElementById('companyAchievementBar');
  if (bar) {
    const normalized = Math.max(0, Math.min(achv, 100));
    bar.style.width = `${normalized}%`;
  }
}

function renderCompanyGoalCards(target = {}, actuals = {}) {
  Object.entries(TARGET_TO_DATA_KEY).forEach(([targetKey, dataKey]) => {
    const goalRef = `companyGoal-${dataKey}`;
    const achvRef = `companyAchv-${dataKey}`;
    const rawTarget = target[targetKey];
    const hasValue = rawTarget !== undefined && rawTarget !== null;
    const goalValue = hasValue ? num(rawTarget) : 0;
    setTextByRef(goalRef, hasValue ? goalValue.toLocaleString() : '--');
    const achvEl = document.querySelector(`[data-ref="${achvRef}"]`);
    if (!achvEl) return;
    if (goalValue > 0) {
      const percent = Math.round((num(actuals[dataKey]) / goalValue) * 100);
      achvEl.textContent = `${percent}%`;
      setCardAchievementProgress(achvEl, percent);
    } else {
      achvEl.textContent = '--%';
      setCardAchievementProgress(achvEl, 0);
    }
  });
}

function renderCompanyRateGoals() {
  const targets = state.kpiTargets || {};
  const rateKeys = [
    'proposalRate', 'recommendationRate', 'interviewScheduleRate',
    'interviewHeldRate', 'offerRate', 'acceptRate', 'hireRate'
  ];

  rateKeys.forEach(key => {
    // 目標値表示
    const goalRef = `companyGoal-${key}`;
    const el = document.querySelector(`[data-ref="${goalRef}"]`);
    if (el) {
      const val = targets[key];
      const hasVal = val !== undefined && val !== null;
      el.textContent = hasVal ? `${val}%` : '--';

      // 編集機能
      el.style.cursor = 'pointer';
      el.style.textDecoration = 'underline dotted';
      el.title = 'クリックして目標設定';
      el.onclick = (e) => handleRateGoalClick(e, key, val);
    }

    // 達成率表示
    const achvRef = `companyAchv-${key}`;
    const achvEl = document.querySelector(`[data-ref="${achvRef}"]`);
    if (achvEl) {
      const actual = num(state.kpi.companyMonthly?.[key]);
      const targetVal = num(targets[key]);
      if (targetVal > 0) {
        const rate = Math.round((actual / targetVal) * 100);
        achvEl.textContent = `${rate}%`;
        setCardAchievementProgress(achvEl, rate);
      } else {
        achvEl.textContent = '--%';
        setCardAchievementProgress(achvEl, 0);
      }
    }
  });
}

function handleRateGoalClick(e, key, currentVal) {
  const el = e.target;
  // input作成
  const input = document.createElement('input');
  input.type = 'number';
  input.value = currentVal !== undefined && currentVal !== null ? currentVal : '';
  input.style.width = '60px';
  input.style.fontSize = 'inherit';
  input.style.textAlign = 'right';
  input.onclick = (ev) => ev.stopPropagation(); // バブリング防止

  const save = async () => {
    const newVal = input.value.trim();
    if (newVal === '') {
      delete state.kpiTargets[key];
    } else {
      state.kpiTargets[key] = Number(newVal);
    }

    // 再描画
    renderCompanyRateGoals();

    // API保存
    try {
      await saveKpiTargetsToApi(state.companyEvaluationPeriodId, state.kpiTargets);
    } catch (err) {
      console.error('Save failed', err);
      alert('目標の保存に失敗しました');
    }
  };

  input.onblur = save;
  input.onkeydown = (ev) => {
    if (ev.key === 'Enter') {
      input.blur();
    }
  };

  el.textContent = '';
  el.appendChild(input);
  input.focus();
}

async function loadYieldData() {
  const loadToken = ++state.loadSeq;
  const isCurrent = () => state.loadSeq === loadToken;
  try {
    const wantsPersonal = isYieldScope('personal');
    const wantsCompany = isYieldScope('company');
    const wantsAdmin = isYieldScope('admin');

    const preloadTasks = [];
    if (wantsCompany) {
      preloadTasks.push(
        goalSettingsService.loadCompanyPeriodTarget(state.companyEvaluationPeriodId, { force: true })
      );
      preloadTasks.push(
        fetchKpiTargetsFromApi(state.companyEvaluationPeriodId).then(data => {
          state.kpiTargets = data || {};
        })
      );
    }
    if (wantsPersonal) {
      preloadTasks.push(
        goalSettingsService.loadPersonalPeriodTarget(state.personalEvaluationPeriodId, getAdvisorName(), { force: true }),
        goalSettingsService.loadPersonalDailyTargets(state.personalDailyPeriodId, getAdvisorName(), { force: true })
      );
    }
    if (preloadTasks.length) {
      await Promise.all(preloadTasks);
    }

    if (wantsPersonal) {
      const [todayData, personalSummary, personalRange] = await Promise.all([
        loadTodayPersonalKPIData(),
        loadPersonalSummaryKPIData(),
        loadPersonalKPIData()
      ]);
      if (!isCurrent()) return;
      if (todayData || personalSummary || personalRange) {
        const summaryPayload = personalSummary && Object.keys(personalSummary).length ? personalSummary : personalRange;
        renderPersonalKpis(todayData || {}, summaryPayload || {}, personalRange || {});
      }
    }

    if (wantsCompany) {
      const companyKPI = await loadCompanyKPIData();
      if (!isCurrent()) return;
      if (companyKPI) renderCompanyMonthly(companyKPI);
      await loadCompanyPeriodKPIData();
      if (!isCurrent()) return;
      // Load MS for Company scope too
      await loadAndRenderCompanyMs();
      if (!isCurrent()) return;
    }

    if (wantsAdmin) {
      // 本日の活動状況は非表示
      // const todayEmployeeRows = await loadCompanyTodayEmployeeKpi();
      // if (todayEmployeeRows?.length) renderCompanyTodayTable();

      const companyTermRows = await loadCompanyTermEmployeeKpi();
      if (!isCurrent()) return;
      if (companyTermRows?.length) renderCompanyTermTables();
    }

    if (wantsPersonal) {
      await loadAndRenderPersonalDaily();
      if (!isCurrent()) return;
      await loadAndRenderPersonalMs();
      if (!isCurrent()) return;
    }
    if (wantsCompany) {
      await loadAndRenderCompanyDaily();
      if (!isCurrent()) return;
    }
    if (wantsAdmin) {
      await loadAndRenderCompanyMs();
      if (!isCurrent()) return;
      await loadAndRenderCompanyDaily();
      if (!isCurrent()) return;
      await loadEmployeeData(state.ranges.employee.startDate ? state.ranges.employee : {});
      if (!isCurrent()) return;
    }
  } catch (error) {
    console.error('Failed to load yield data:', error);
  }
}

async function loadPersonalKPIData() {
  try {
    const fallbackRange = getCurrentMonthRange();
    const startDate = state.ranges.personalPeriod.startDate || fallbackRange.startDate;
    const endDate = state.ranges.personalPeriod.endDate || fallbackRange.endDate;
    if (!startDate || !endDate) return null;
    const kpi = await fetchPersonalKpiFromApi({ startDate, endDate });
    if (kpi) return { period: kpi };
  } catch (error) {
    console.error('Failed to load personal KPI data (api):', error);
  }
  // try {
  //   const candidates = await ensureCandidateDataset();
  //   const kpi = buildPersonalKpiFromCandidates(candidates, {
  //     startDate: state.ranges.personal.startDate,
  //     endDate: state.ranges.personal.endDate,
  //     advisorName: getAdvisorName()
  //   });
  //   return kpi && !Array.isArray(kpi) ? kpi : null;
  // } catch (error) {
  //   console.error('Failed to load personal KPI data (from candidates mock):', error);
  //   return null;
  // }
}

async function loadPersonalSummaryKPIData() {
  try {
    const period = state.evaluationPeriods.find(item => item.id === state.personalEvaluationPeriodId);
    const startDate = period?.startDate;
    const endDate = period?.endDate;
    if (!startDate || !endDate) return null;
    const kpi = await fetchPersonalKpiFromApi({ startDate, endDate });
    if (kpi) return { monthly: kpi };
  } catch (error) {
    console.log('Failed to load personal summary KPI data (api):', error);
  }
  // try {
  //   const period = state.evaluationPeriods.find(item => item.id === state.personalEvaluationPeriodId);
  //   const startDate = period?.startDate;
  //   const endDate = period?.endDate;
  //   if (!startDate || !endDate) return null;
  //   const candidates = await ensureCandidateDataset();
  //   const kpi = buildPersonalKpiFromCandidates(candidates, {
  //     startDate,
  //     endDate,
  //     advisorName: getAdvisorName()
  //   });
  //   return kpi && !Array.isArray(kpi) ? kpi : null;
  // } catch (error) {
  //   console.error('Failed to load personal summary KPI data (from candidates mock):', error);
  //   return null;
  // }
}

async function loadTodayPersonalKPIData() {
  try {
    const todayStr = isoDate(new Date());
    const kpi = await fetchPersonalKpiFromApi({ startDate: todayStr, endDate: todayStr, planned: true });
    if (kpi) return { today: kpi };
  } catch (error) {
    console.log('Failed to load today personal KPI data (api):', error);
  }
  // try {
  //   const todayStr = isoDate(new Date());
  //   const candidates = await ensureCandidateDataset();
  //   const kpi = buildPersonalKpiFromCandidates(candidates, {
  //     startDate: todayStr,
  //     endDate: todayStr,
  //     advisorName: getAdvisorName()
  //   });
  //   return kpi && !Array.isArray(kpi) ? kpi : null;
  // } catch (error) {
  //   console.error('Failed to load today personal KPI data (from candidates mock):', error);
  //   return null;
  // }
}

async function loadMonthToDatePersonalKPIData() {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const candidates = await ensureCandidateDataset();
    const kpi = buildPersonalKpiFromCandidates(candidates, {
      startDate: isoDate(startOfMonth),
      endDate: isoDate(today),
      advisorName: getAdvisorName()
    });
    return kpi && !Array.isArray(kpi) ? kpi : null;
  } catch (error) {
    console.error('Failed to load month-to-date personal KPI data (from candidates mock):', error);
    return null;
  }
}

async function loadCompanyKPIData() {
  try {
    const range = getCompanySummaryRange();
    if (!range.startDate || !range.endDate) return null;
    const kpi = await fetchCompanyKpiFromApi({ startDate: range.startDate, endDate: range.endDate });
    if (kpi) return kpi;
  } catch (error) {
    console.log('Failed to load company KPI data (api):', error);
  }
  // try {
  //   const range = getCompanySummaryRange();
  //   if (!range.startDate || !range.endDate) return null;

  //   const candidates = await ensureCandidateDataset();
  //   const kpi = buildCompanyKpiFromCandidates(candidates, range);
  //   console.log('[yield] company KPI (summary range)', { range, candidateCount: candidates.length });

  //   return kpi;
  // } catch (error) {
  //   console.error('Failed to load company KPI data (from candidates):', error);
  //   return null;
  // }
}

async function loadCompanyPeriodKPIData() {
  try {
    const startDate = state.ranges.companyPeriod.startDate;
    const endDate = state.ranges.companyPeriod.endDate;
    if (!startDate || !endDate) return null;

    const kpi = await fetchCompanyKpiFromApi({ startDate, endDate });
    if (kpi) {
      renderCompanyPeriod(kpi);
      return kpi;
    }
  } catch (error) {
    console.log('Failed to load company period KPI data (api):', error);
  }
  // try {
  //   const startDate = state.ranges.company.startDate;
  //   const endDate = state.ranges.company.endDate;
  //   if (!startDate || !endDate) return null;

  //   const candidates = await ensureCandidateDataset();
  //   const kpi = buildCompanyKpiFromCandidates(candidates, { startDate, endDate });
  //   console.log('[yield] company KPI (period range)', { startDate, endDate, candidateCount: candidates.length });

  //   if (kpi) renderCompanyPeriod(kpi);
  //   return kpi;
  // } catch (error) {
  //   console.error('Failed to load company period KPI data (from candidates):', error);
  //   return null;
  // }
}

async function loadCompanyTodayEmployeeKpi() {
  const todayStr = isoDate(new Date());
  const todayPeriodId = goalSettingsService.resolvePeriodIdByDate(todayStr, state.evaluationPeriods);
  const items = await fetchCompanyEmployeeKpis({ startDate: todayStr, endDate: todayStr });
  const rows = mapEmployeeKpiItems(items);
  const advisorIds = rows
    .map(row => row.advisorUserId)
    .filter(id => Number.isFinite(id) && id > 0);
  if (todayPeriodId && typeof goalSettingsService.loadPersonalPeriodTargetsBulk === 'function') {
    await goalSettingsService.loadPersonalPeriodTargetsBulk(todayPeriodId, advisorIds, { force: true });
  }

  state.companyToday.rows = rows.map(row => {
    const advisorKey = row.advisorUserId || row.name;
    return {
      advisorUserId: row.advisorUserId,
      name: row.name,
      newInterviews: row.newInterviews,
      newInterviewsGoal: resolveAdvisorGoal(todayPeriodId, todayStr, advisorKey, 'newInterviewsTarget'),
      proposals: row.proposals,
      proposalsGoal: resolveAdvisorGoal(todayPeriodId, todayStr, advisorKey, 'proposalsTarget'),
      recommendations: row.recommendations,
      recommendationsGoal: resolveAdvisorGoal(todayPeriodId, todayStr, advisorKey, 'recommendationsTarget'),
      interviewsScheduled: row.interviewsScheduled,
      interviewsScheduledGoal: resolveAdvisorGoal(todayPeriodId, todayStr, advisorKey, 'interviewsScheduledTarget'),
      interviewsHeld: row.interviewsHeld,
      interviewsHeldGoal: resolveAdvisorGoal(todayPeriodId, todayStr, advisorKey, 'interviewsHeldTarget'),
      offers: row.offers,
      offersGoal: resolveAdvisorGoal(todayPeriodId, todayStr, advisorKey, 'offersTarget'),
      accepts: row.accepts,
      acceptsGoal: resolveAdvisorGoal(todayPeriodId, todayStr, advisorKey, 'acceptsTarget')
    };
  });

  return state.companyToday.rows;
}

async function loadCompanyTermEmployeeKpi() {
  const periodId = state.companyTermPeriodId;
  const period = state.evaluationPeriods.find(item => item.id === periodId);
  if (!period) {
    state.companyTerm.rows = [];
    return [];
  }

  const items = await fetchCompanyEmployeeKpis({ startDate: period.startDate, endDate: period.endDate });
  const rows = mapEmployeeKpiItems(items);
  const members = await ensureMembersList();
  const advisorIdSet = new Set(
    members
      .filter(member => isAdvisorRole(member.role))
      .map(member => String(member.id))
  );
  const filteredRows = advisorIdSet.size
    ? rows.filter(row => advisorIdSet.has(String(row.advisorUserId)))
    : rows;
  const advisorIds = filteredRows
    .map(row => row.advisorUserId)
    .filter(id => Number.isFinite(id) && id > 0);
  if (typeof goalSettingsService.loadPersonalPeriodTargetsBulk === 'function') {
    await goalSettingsService.loadPersonalPeriodTargetsBulk(periodId, advisorIds, { force: true });
  }

  state.companyTerm.rows = filteredRows.map(row => {
    const advisorKey = row.advisorUserId || row.name;
    const target = goalSettingsService.getPersonalPeriodTarget(periodId, advisorKey) || {};
    const goalOrNull = key => {
      const raw = target[key];
      return raw === undefined || raw === null ? null : num(raw);
    };
    return {
      advisorUserId: row.advisorUserId,
      name: row.name,
      newInterviews: row.newInterviews,
      newInterviewsGoal: goalOrNull('newInterviewsTarget'),
      proposals: row.proposals,
      proposalsGoal: goalOrNull('proposalsTarget'),
      recommendations: row.recommendations,
      recommendationsGoal: goalOrNull('recommendationsTarget'),
      interviewsScheduled: row.interviewsScheduled,
      interviewsScheduledGoal: goalOrNull('interviewsScheduledTarget'),
      interviewsHeld: row.interviewsHeld,
      interviewsHeldGoal: goalOrNull('interviewsHeldTarget'),
      offers: row.offers,
      offersGoal: goalOrNull('offersTarget'),
      accepts: row.accepts,
      acceptsGoal: goalOrNull('acceptsTarget'),
      hireRate: row.hireRate,
      hireRateGoal: goalOrNull('hireRateTarget'),
      proposalRate: row.proposalRate,
      proposalRateGoal: goalOrNull('proposalRateTarget'),
      recommendationRate: row.recommendationRate,
      recommendationRateGoal: goalOrNull('recommendationRateTarget'),
      interviewScheduleRate: row.interviewScheduleRate,
      interviewScheduleRateGoal: goalOrNull('interviewScheduleRateTarget'),
      interviewHeldRate: row.interviewHeldRate,
      interviewHeldRateGoal: goalOrNull('interviewHeldRateTarget'),
      offerRate: row.offerRate,
      offerRateGoal: goalOrNull('offerRateTarget'),
      acceptRate: row.acceptRate,
      acceptRateGoal: goalOrNull('acceptRateTarget')
    };
  });

  return state.companyTerm.rows;
}

async function loadAndRenderPersonalDaily() {
  const isMonthlyMode = state.personalDisplayMode === 'range';
  const tableTitle = document.getElementById('personalDailySectionTitle');
  const periodSelectLabel = document.getElementById('personalDailyPeriodLabel');

  if (isMonthlyMode) {
    if (periodSelectLabel) periodSelectLabel.style.display = 'none';

    const startDate = state.ranges.personalPeriod?.startDate;
    const endDate = state.ranges.personalPeriod?.endDate;
    if (!startDate || !endDate) return;

    const months = enumerateMonthsInRange(startDate, endDate);
    const monthlyDataMap = {};

    // Fetch data for each month in parallel
    await Promise.all(months.map(async (monthStr) => {
      const [year, month] = monthStr.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      try {
        const data = await fetchPersonalKpiFromApi({ startDate: isoDate(start), endDate: isoDate(end) });
        monthlyDataMap[monthStr] = data || {};
      } catch (err) {
        console.error(`Failed to load month data for ${monthStr}`, err);
        monthlyDataMap[monthStr] = {};
      }
    }));

    renderPersonalMonthlyTable(months, monthlyDataMap);
    renderPersonalTableRates(startDate, endDate);

  } else {
    if (periodSelectLabel) periodSelectLabel.style.display = '';

    const periodId = state.personalDailyPeriodId;
    if (!periodId) return;
    const advisorName = getSession()?.user?.name || null;
    const advisorRole = getSession()?.user?.role || '';

    const period = state.evaluationPeriods.find(item => item.id === periodId);
    if (!period) return;

    await Promise.all([
      ensureDailyYieldData(periodId),
      goalSettingsService.loadPersonalDailyTargets(periodId, advisorName)
    ]);
    const deptKey = await resolveUserDepartmentKey();
    state.personalDailyMs.departmentKey = deptKey;
    const userId = await resolveAdvisorUserId();
    if (deptKey && userId) {
      try {
        const items = await goalSettingsService.loadImportantMetrics({
          departmentKey: deptKey,
          userId: Number(userId),
          force: true
        });
        const first = Array.isArray(items) ? items[0] : null;
        const metricKey = first?.metricKey || first?.metric_key || '';
        if (metricKey) {
          if (!state.personalMs.metricKeys) state.personalMs.metricKeys = {};
          state.personalMs.metricKeys[deptKey] = metricKey;
          if (!state.personalMs.importantMetrics) state.personalMs.importantMetrics = {};
          if (!state.personalMs.importantMetrics[deptKey]) state.personalMs.importantMetrics[deptKey] = {};
          state.personalMs.importantMetrics[deptKey][String(userId)] = metricKey;
        }
      } catch (error) {
        console.warn('[yield] failed to load important metric (personal daily)', error);
      }
    }
    const targetDepts = [];
    if (deptKey) targetDepts.push(deptKey);
    if (!targetDepts.includes('revenue')) targetDepts.push('revenue');
    await Promise.all(targetDepts.map(async dept => {
      const metrics = dept === 'revenue'
        ? [{ key: 'revenue', label: '売上', targetKey: 'revenue' }]
        : getMetricsForDept(dept);
      if (!metrics.length) return;
      await Promise.all(metrics.map(metric => loadPersonalDailyMsTargets(periodId, dept, metric.key)));
    }));
    const dailyData = state.personalDailyData[periodId] || {};
    renderPersonalDailyTable(periodId, dailyData);
    renderPersonalTableRates(period.startDate, period.endDate);
  }
}

function enumerateMonthsInRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const months = [];
  const curr = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (curr <= last) {
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
    curr.setMonth(curr.getMonth() + 1);
  }
  return months;
}

function renderPersonalMonthlyTable(months, monthlyDataMap) {
  const body = document.getElementById('personalDailyTableBody');
  const headerRow = document.getElementById('personalDailyHeaderRow');
  if (!body || !headerRow) return;

  // Build Header
  const cells = months.map(m => {
    const [y, mon] = m.split('-');
    return `<th scope="col">${y}年${mon}月</th>`;
  }).join('');
  // Use simpleMode style (no Category column)
  headerRow.innerHTML = `<th scope="col" class="kpi-v2-sticky-label">指標</th>${cells}`;

  // Build Rows
  const rows = [];
  DAILY_FIELDS.forEach((field, index) => {
    const baseLabel = DAILY_LABELS[field.dataKey] || field.dataKey;
    const tripletAlt = index % 2 === 1 ? 'daily-triplet-alt' : '';

    // Using simpleMode (Actuals only) logic
    const rowCells = months.map(m => {
      const data = monthlyDataMap[m] || {};
      const value = data[field.dataKey] ?? 0;
      return `<td class="">${formatNumberCell(value)}</td>`;
    }).join('');

    rows.push(`<tr class="${tripletAlt}">
      <th class="kpi-v2-sticky-label" scope="row">${baseLabel}</th>
      ${rowCells}
    </tr>`);
  });
  body.innerHTML = rows.join('');
}

async function renderPersonalTableRates(startDate, endDate) {
  const panel = document.getElementById('personalTableRatePanel');
  if (!panel) return;

  try {
    const kpi = await fetchPersonalKpiFromApi({ startDate, endDate });
    if (!kpi) {
      panel.innerHTML = '';
      return;
    }

    // Render Rate Cards
    const rates = [
      { label: '提案率', value: kpi.proposalRate, unit: '%' },
      { label: '推薦率', value: kpi.recommendationRate, unit: '%' },
      { label: '面接設定率', value: kpi.interviewScheduleRate, unit: '%' },
      { label: '面接実施率', value: kpi.interviewHeldRate, unit: '%' },
      { label: '内定率', value: kpi.offerRate, unit: '%' },
      { label: '承諾率', value: kpi.acceptRate, unit: '%' },
      { label: '決定率', value: kpi.hireRate, unit: '%' } // hireRate -> 決定率/入社決定率
    ];

    const html = rates.map(r => `
      <div class="kpi-v2-card is-neutral is-compact">
        <div class="kpi-v2-label">${r.label}</div>
        <div class="kpi-v2-value">${r.value !== undefined ? r.value : '--'}${r.unit}</div>
      </div>
    `).join('');

    panel.innerHTML = `<div class="kpi-v2-grid" data-kpi-type="rates" style="margin-bottom:1.5rem">${html}</div>`;

  } catch (e) {
    console.error('Failed to render personal table rates:', e);
    panel.innerHTML = '';
  }
}

async function loadCompanySummaryKPI() {
  const data = await loadCompanyKPIData();
  if (data) renderCompanyMonthly(data);
}

function buildDailyHeaderRow(headerRow, dates, simpleMode = false) {
  if (!headerRow) return;
  const cells = dates
    .map(date => {
      const label = formatDayLabel(date);
      return `<th scope="col">${label}</th>`;
    })
    .join('');

  const categoryHeader = simpleMode ? '' : '<th class="daily-type" scope="col">区分</th>';
  headerRow.innerHTML = `<th scope="col" class="kpi-v2-sticky-label">指標</th>${categoryHeader}${cells}`;
}

function buildDailyRow(label, cells, { rowClass = '', cellClass = '' } = {}) {
  const cellHtml = cells
    .map(cell => {
      const value = typeof cell === 'object' ? cell.value : cell;
      const specificClass = typeof cell === 'object' ? cell.className || '' : '';
      const className = [cellClass, specificClass].filter(Boolean).join(' ').trim();
      return `<td class="${className}">${value}</td>`;
    })
    .join('');
  return `<tr class="${rowClass}">${label}${cellHtml}</tr>`;
}

function renderDailyMatrix({ headerRow, body, dates, dailyData, resolveValues, simpleMode = false }) {
  if (!body) return;
  buildDailyHeaderRow(headerRow, dates, simpleMode);
  const rows = [];
  DAILY_FIELDS.forEach((field, index) => {
    const baseLabel = DAILY_LABELS[field.dataKey] || field.dataKey;
    const tripletAlt = index % 2 === 1 ? 'daily-triplet-alt' : '';
    const actualNumbers = [];
    const targetNumbers = [];
    let actualSum = 0;
    dates.forEach((date, dateIndex) => {
      const { actual = 0, target = null } = resolveValues(field, date, dateIndex);
      actualSum += num(actual);
      actualNumbers.push(actualSum);
      targetNumbers.push(target === null || target === undefined ? null : num(target));
    });
    const actualCells = actualNumbers.map(formatNumberCell);

    // 実績行
    const thAttr = simpleMode
      ? `class="kpi-v2-sticky-label" scope="row"`
      : `class="kpi-v2-sticky-label" scope="row" rowspan="3"`;

    // simpleModeのときは「実績」ラベルセルを表示しない（項目名のみ）
    // あるいはシンプルに項目名の横に何も出さない
    // ここでは単純化のため、simpleModeならthのみにする
    const rowContent = simpleMode
      ? `<th ${thAttr}>${baseLabel}</th>`
      : `<th ${thAttr}>${baseLabel}</th><td class="daily-type">実績</td>`;

    rows.push(
      buildDailyRow(
        rowContent,
        actualCells,
        { rowClass: tripletAlt }
      )
    );

    if (!simpleMode) {
      const targetCells = targetNumbers.map(formatNumberCell);
      const achvCells = targetNumbers.map((target, idx) => {
        if (Number.isFinite(target) && target > 0) {
          const percent = Math.round((actualNumbers[idx] / target) * 100);
          return formatAchievementCell(percent);
        }
        return formatAchievementCell(null);
      });
      rows.push(
        buildDailyRow(
          `<td class="daily-type">目標</td>`,
          targetCells,
          { rowClass: tripletAlt, cellClass: 'daily-muted' }
        )
      );
      rows.push(
        buildDailyRow(
          `<td class="daily-type">進捗率</td>`,
          achvCells,
          { rowClass: tripletAlt }
        )
      );
    }
  });
  body.innerHTML = rows.join('');
}

function formatNumberCell(value) {
  if (value === null || value === undefined || value === '') return '--';
  const numeric = num(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : '--';
}

function formatCurrencyCell(value) {
  if (value === null || value === undefined || value === '') return '--';
  const numeric = num(value);
  if (!Number.isFinite(numeric)) return '--';
  // 万円単位で表示
  const manyen = Math.round(numeric / 10000);
  return `¥${manyen.toLocaleString()}万`;
}


function formatAchievementCell(percent) {
  if (percent === null || Number.isNaN(percent)) {
    return { value: '--%', className: 'daily-muted' };
  }
  const className = percent >= 100 ? 'daily-achv-high' : 'daily-achv-normal';
  return { value: `${percent}%`, className };
}

function formatDayLabel(dateStr) {
  const parsed = parseLocalDate(dateStr);
  if (!parsed || Number.isNaN(parsed)) return dateStr;
  return String(parsed.getDate());
}

function buildCumulativeSeries(total, length) {
  const series = [];
  if (!Number.isFinite(total) || length <= 0) return series;
  for (let index = 0; index < length; index += 1) {
    series.push(calcCumulativeValue(total, index, length));
  }
  return series;
}

function calcCumulativeValue(total, index, length) {
  const totalNumber = Number(total);
  if (!Number.isFinite(totalNumber) || totalNumber <= 0 || length <= 0) return 0;
  if (index >= length - 1) return totalNumber;
  return Math.round((totalNumber * (index + 1)) / length);
}

function buildDailyTargetsFromTotal(total, length) {
  if (!Number.isFinite(total) || length <= 0) return [];
  const cumulative = buildCumulativeSeries(total, length);
  return cumulative.map((value, index) => {
    if (index === 0) return value;
    return value - cumulative[index - 1];
  });
}

function getPersonalDailyTargetMap(deptKey, metricKey) {
  return state.personalDailyMs.targets?.[deptKey]?.[metricKey] || {};
}

function getLastCumulativeTarget(dates, targets = {}, deptKey, periodId) {
  let last = 0;
  dates.forEach(date => {
    const disabled = isDateBeforePersonalDeptStart(date, deptKey, periodId) || isDateAfterPersonalDeptEnd(date, deptKey, periodId);
    if (disabled) return;
    const value = targets?.[date];
    if (value !== undefined && value !== null && value !== '') {
      last = num(value);
    }
  });
  return last;
}

async function persistPersonalDailyMsTargets(periodId, deptKey, metricKey) {
  if (!periodId || !deptKey || !metricKey) return;
  const advisorUserId = await resolveAdvisorUserId();
  const dailyTargets = getPersonalDailyTargetMap(deptKey, metricKey);
  const period = state.evaluationPeriods.find(item => item.id === periodId);
  const range = resolvePersonalDailyDateRange(periodId, deptKey);
  const dates = range.startDate && range.endDate ? enumerateDateRange(range.startDate, range.endDate) : [];
  const targetTotal =
    state.personalDailyMs.totals?.[deptKey]?.[metricKey] ??
    getLastCumulativeTarget(dates, dailyTargets, deptKey, periodId);
  try {
    await goalSettingsService.saveMsTargets({
      scope: 'personal',
      departmentKey: deptKey,
      metricKey,
      periodId,
      advisorUserId,
      targetTotal,
      dailyTargets
    });
  } catch (error) {
    console.warn('[yield] failed to save personal daily ms targets', error);
  }
}

async function loadPersonalDailyMsTargets(periodId, deptKey, metricKey) {
  if (!periodId || !deptKey || !metricKey) return;
  const advisorUserId = await resolveAdvisorUserId();
  const data = await goalSettingsService.loadMsTargets({
    scope: 'personal',
    departmentKey: deptKey,
    metricKey,
    periodId,
    advisorUserId
  });
  if (!data) return;
  if (!state.personalDailyMs.targets) state.personalDailyMs.targets = {};
  if (!state.personalDailyMs.targets[deptKey]) state.personalDailyMs.targets[deptKey] = {};
  state.personalDailyMs.targets[deptKey][metricKey] = data.dailyTargets || {};
  if (!state.personalDailyMs.totals) state.personalDailyMs.totals = {};
  if (!state.personalDailyMs.totals[deptKey]) state.personalDailyMs.totals[deptKey] = {};
  state.personalDailyMs.totals[deptKey][metricKey] = num(data.targetTotal || 0);
}

async function handlePersonalDailyDistribute(event) {
  const button = event.target;
  const deptKey = button.dataset.dept;
  const metricKey = button.dataset.metric;
  const periodId = state.personalDailyPeriodId;
  if (!deptKey || !metricKey || !periodId) return;
  const datesForTotal = (() => {
    const range = resolvePersonalDailyDateRange(periodId, deptKey);
    return range.startDate && range.endDate ? enumerateDateRange(range.startDate, range.endDate) : [];
  })();
  const currentTotal =
    state.personalDailyMs.totals?.[deptKey]?.[metricKey] ??
    getLastCumulativeTarget(datesForTotal, getPersonalDailyTargetMap(deptKey, metricKey), deptKey, periodId);
  const input = prompt('最終目標値を入力してください', currentTotal ? String(currentTotal) : '');
  if (input === null) return;
  const total = Number(input);
  if (!Number.isFinite(total) || total < 0) return;
  const range = resolvePersonalDailyDateRange(periodId, deptKey);
  if (!range.startDate || !range.endDate) return;
  const dates = enumerateDateRange(range.startDate, range.endDate);
  const activeDates = dates.filter(date => {
    const disabled = isDateBeforePersonalDeptStart(date, deptKey, periodId) || isDateAfterPersonalDeptEnd(date, deptKey, periodId);
    return !disabled;
  });
  const cumulative = buildCumulativeSeries(total, activeDates.length);
  const targetMap = {};
  let activeIndex = 0;
  dates.forEach(date => {
    const disabled = isDateBeforePersonalDeptStart(date, deptKey, periodId) || isDateAfterPersonalDeptEnd(date, deptKey, periodId);
    if (disabled) return;
    targetMap[date] = cumulative[activeIndex] ?? 0;
    activeIndex += 1;
  });
  if (!state.personalDailyMs.targets) state.personalDailyMs.targets = {};
  if (!state.personalDailyMs.targets[deptKey]) state.personalDailyMs.targets[deptKey] = {};
  state.personalDailyMs.targets[deptKey][metricKey] = targetMap;
  if (!state.personalDailyMs.totals) state.personalDailyMs.totals = {};
  if (!state.personalDailyMs.totals[deptKey]) state.personalDailyMs.totals[deptKey] = {};
  state.personalDailyMs.totals[deptKey][metricKey] = total;
  const dailyData = state.personalDailyData[periodId] || {};
  renderPersonalDailyTable(periodId, dailyData);
  persistPersonalDailyMsTargets(periodId, deptKey, metricKey);
}

function renderPersonalDailyTable(periodId, dailyData = {}) {
  const body = document.getElementById('personalDailyTableBody');
  const headerRow = document.getElementById('personalDailyHeaderRow');
  const labelEl = document.getElementById('personalDailyPeriodLabel');
  const period = state.evaluationPeriods.find(item => item.id === periodId);
  if (!body || !headerRow) return;
  if (!period) {
    body.innerHTML = '';
    headerRow.innerHTML = '';
    if (labelEl) labelEl.textContent = '評価期間：--';
    return;
  }

  const deptKey = state.personalDailyMs.departmentKey || getDepartmentFromRole(getSession()?.user?.role || '');
  const useDeptTotals = deptKey === 'marketing';
  const effectiveDailyData = useDeptTotals
    ? buildDailyTotalsAllMetrics(periodId)
    : dailyData;
  const range = resolvePersonalDailyDateRange(periodId, deptKey);
  const dates = enumerateDateRange(range.startDate, range.endDate);
  const advisorName = getAdvisorName();
  const periodTarget = goalSettingsService.getPersonalPeriodTarget(periodId, advisorName) || {};
  if (labelEl) labelEl.textContent = `評価期間：${formatPeriodMonthLabel(period) || '--'}`;

  const targetDepts = [];
  if (deptKey) targetDepts.push(deptKey);
  // 常に売上を最後に表示するように制御
  if (!targetDepts.includes('revenue')) {
    targetDepts.push('revenue');
  }

  const dateCells = dates.map(date => `<th scope="col" class="ms-date-header">${formatDayLabel(date)}</th>`).join('');
  headerRow.innerHTML = `
    <th scope="col" class="kpi-v2-sticky-label">事業部</th>
    <th scope="col" class="kpi-v2-sticky-label kpi-v2-ms-metric">指標</th>
    <th scope="col" class="daily-type">区分</th>
    ${dateCells}
  `;

  if (!state.personalDailyMs) state.personalDailyMs = { metricKeys: {}, targets: {}, totals: {} };

  const rows = [];
  targetDepts.forEach((dept, deptIndex) => {
    const isRevenue = dept === 'revenue';
    const metrics = isRevenue
      ? [{ key: 'revenue', label: '売上金額', targetKey: 'revenue', isCurrency: true }]
      : getMetricsForDept(dept);

    if (!metrics.length) return;

    const deptRowspan = metrics.length * 3; // MS、達成率、実績の3行を各指標ごとに生成
    const deptLabel = dept === 'marketing' ? 'マーケ' : dept === 'cs' ? 'CS' : dept === 'sales' ? '営業' : '売上';
    if (!state.personalMs.metricKeys) state.personalMs.metricKeys = {};
    if (!state.personalMs.metricKeys[dept]) {
      state.personalMs.metricKeys[dept] = metrics[0]?.key || '';
    }
    const importantMetricKey = state.personalMs.metricKeys[dept] || '';
    const importantSelect = dept !== 'revenue'
      ? `<select class="kpi-v2-sort-select personal-daily-important-select" data-dept="${dept}">
           ${metrics.map(option => `<option value="${option.key}" ${option.key === importantMetricKey ? 'selected' : ''}>${option.label}</option>`).join('')}
         </select>`
      : '';

    metrics.forEach((metricOption, metricIndex) => {
      const metricKey = metricOption.key;
      const metricLabel = metricOption.label || '';
      const isImportant = !isRevenue && importantMetricKey && metricKey === importantMetricKey;
      const highlightClass = isImportant ? 'ms-important-row' : '';

      const distributeButton = `<button type="button" class="ms-distribute-btn" data-ms-distribute data-scope="personalDaily" data-dept="${dept}" data-metric="${metricKey}">日割り</button>`;
      const metricCell = `<th scope="row" class="kpi-v2-sticky-label kpi-v2-ms-metric" rowspan="3">
           <div class="ms-metric-cell">
             <span>${metricLabel}</span>
             ${distributeButton}
           </div>
         </th>`;

      const field = DAILY_FIELDS.find(f => f.dataKey === metricOption.targetKey);
      const periodTargetKey = field?.targetKey || null;
      const storedTotal = state.personalDailyMs.totals?.[dept]?.[metricKey];
      const totalTarget = Number.isFinite(storedTotal)
        ? num(storedTotal)
        : periodTargetKey
          ? num(periodTarget?.[periodTargetKey])
          : 0;

      const targetMap = getPersonalDailyTargetMap(dept, metricKey);
      const activeDates = dates.filter(date => {
        const disabled = isDateBeforePersonalDeptStart(date, dept, periodId) || isDateAfterPersonalDeptEnd(date, dept, periodId);
        return !disabled;
      });
      const fallbackCumulative = totalTarget > 0 ? buildCumulativeSeries(totalTarget, activeDates.length) : [];

      let activeIndex = 0;
      const cumulativeTargets = dates.map(date => {
        const isDisabled = isDateBeforePersonalDeptStart(date, dept, periodId) || isDateAfterPersonalDeptEnd(date, dept, periodId);
        if (isDisabled) return null;
        const saved = targetMap?.[date];
        if (saved !== undefined && saved !== null && saved !== '') {
          activeIndex += 1;
          return num(saved);
        }
        const fallback = fallbackCumulative[activeIndex] ?? null;
        activeIndex += 1;
        return fallback;
      });

      const dailyTargets = [];
      let prevTarget = 0;
      cumulativeTargets.forEach(value => {
        if (value === null) {
          dailyTargets.push(null);
          return;
        }
        const daily = num(value) - num(prevTarget);
        dailyTargets.push(daily);
        prevTarget = num(value);
      });

      const dailyActuals = [];
      let actualSum = 0;
      dates.forEach(date => {
        const isDisabled = isDateBeforePersonalDeptStart(date, dept, periodId) || isDateAfterPersonalDeptEnd(date, dept, periodId);
        if (isDisabled) {
          dailyActuals.push(null);
          return;
        }
        const dayCounts = effectiveDailyData?.[date] || {};
        const value = getDailyMetricValue(dayCounts, metricOption, metricKey);
        actualSum += num(value);
        dailyActuals.push(num(value));
      });

      const cumulativeActuals = [];
      let running = 0;
      dailyActuals.forEach(value => {
        if (value === null) {
          cumulativeActuals.push(null);
          return;
        }
        running += num(value);
        cumulativeActuals.push(running);
      });

      const totalTargetValue = Number.isFinite(storedTotal)
        ? num(storedTotal)
        : getLastCumulativeTarget(dates, targetMap, dept, periodId) || (totalTarget > 0 ? totalTarget : 0);

      const msCells = dates.map((date, idx) => {
        const isDisabled = isDateBeforePersonalDeptStart(date, dept, periodId) || isDateAfterPersonalDeptEnd(date, dept, periodId);
        if (isDisabled) return `<td class="ms-cell-disabled"></td>`;
        const value = cumulativeTargets[idx];
        const displayValue = Number.isFinite(value) ? value : '';
        return `
          <td class="ms-target-cell">
            <input type="number" class="ms-target-input personal-daily-ms-input"
                   data-dept="${dept}"
                   data-date="${date}"
                   data-metric="${metricKey}"
                   value="${displayValue}"
                   min="0" />
          </td>
        `;
      }).join('');

      const rateCells = dates.map((date, idx) => {
        const isDisabled = isDateBeforePersonalDeptStart(date, dept, periodId) || isDateAfterPersonalDeptEnd(date, dept, periodId);
        if (isDisabled) return `<td class="ms-cell-disabled"></td>`;
        // 進捗率 = その日までの累積実績 / その日までの累積目標
        const cumulativeActual = cumulativeActuals[idx] ?? 0;
        const cumulativeTarget = cumulativeTargets[idx] ?? 0;
        let rateDisplay = '-';
        let rateClass = '';
        if (cumulativeTarget && Number(cumulativeTarget) > 0) {
          const rate = Math.round((cumulativeActual / Number(cumulativeTarget)) * 100);
          rateDisplay = `${rate}%`;
          rateClass = rate >= 100 ? 'ms-rate-good' : rate >= 80 ? 'ms-rate-warn' : 'ms-rate-bad';
        }
        return `<td class="ms-rate-cell ${rateClass}">${rateDisplay}</td>`;
      }).join('');


      const actualCells = dates.map((date, idx) => {
        const isDisabled = isDateBeforePersonalDeptStart(date, dept, periodId) || isDateAfterPersonalDeptEnd(date, dept, periodId);
        if (isDisabled) return `<td class="ms-cell-disabled"></td>`;
        const displayValue = metricOption.isCurrency
          ? formatCurrencyCell(cumulativeActuals[idx])
          : formatNumberCell(cumulativeActuals[idx]);
        return `<td class="ms-actual-cell">${displayValue}</td>`;
      }).join('');


      const tripletAlt = (deptIndex + metricIndex) % 2 === 1 ? 'daily-triplet-alt' : '';
      const deptCell = metricIndex === 0
        ? `<th scope="row" class="kpi-v2-sticky-label ms-dept-cell" rowspan="${deptRowspan}">
             <div class="ms-metric-cell">
               <span>${deptLabel}</span>
               ${importantSelect}
             </div>
           </th>`
        : '';

      // 3行構造で統一: MS → 達成率 → 実績
      // 1行目: MS（deptCell と metricCell を出力）
      rows.push(`
        <tr class="${tripletAlt} ${highlightClass}">
          ${deptCell}
          ${metricCell}
          <td class="daily-type">MS</td>
          ${msCells}
        </tr>
      `);
      // 2行目: 達成率（rowspanで結合済みなので空セル不要）
      rows.push(`
        <tr class="${tripletAlt} ${highlightClass}">
          <td class="daily-type">達成率</td>
          ${rateCells}
        </tr>
      `);
      // 3行目: 実績
      rows.push(`
        <tr class="${tripletAlt} ${highlightClass}">
          <td class="daily-type">実績</td>
          ${actualCells}
        </tr>
      `);
    });
  });

  body.innerHTML = rows.join('');

  body.querySelectorAll('.personal-daily-ms-input').forEach(input => {
    if (input.dataset.bound) return;
    input.addEventListener('change', (event) => {
      const el = event.target;
      const { dept, metric, date } = el.dataset;
      if (!dept || !metric || !date) return;
      if (!state.personalDailyMs.targets) state.personalDailyMs.targets = {};
      if (!state.personalDailyMs.targets[dept]) state.personalDailyMs.targets[dept] = {};
      if (!state.personalDailyMs.targets[dept][metric]) state.personalDailyMs.targets[dept][metric] = {};
      state.personalDailyMs.targets[dept][metric][date] = num(el.value);
      if (!state.personalDailyMs.totals) state.personalDailyMs.totals = {};
      if (!state.personalDailyMs.totals[dept]) state.personalDailyMs.totals[dept] = {};
      state.personalDailyMs.totals[dept][metric] = getLastCumulativeTarget(dates, state.personalDailyMs.targets[dept][metric], dept, periodId);
      renderPersonalDailyTable(periodId, dailyData);
      persistPersonalDailyMsTargets(periodId, dept, metric);
    });
    input.dataset.bound = 'true';
  });

  body.querySelectorAll('.personal-daily-important-select').forEach(select => {
    if (select.dataset.bound) return;
    select.addEventListener('change', async (event) => {
      const dept = event.target.dataset.dept;
      const value = event.target.value;
      if (!dept) return;
      if (!state.personalMs.metricKeys) state.personalMs.metricKeys = {};
      state.personalMs.metricKeys[dept] = value;
      const userId = await resolveAdvisorUserId();
      if (userId) {
        if (!state.personalMs.importantMetrics) state.personalMs.importantMetrics = {};
        if (!state.personalMs.importantMetrics[dept]) state.personalMs.importantMetrics[dept] = {};
        state.personalMs.importantMetrics[dept][String(userId)] = value;
        try {
          await goalSettingsService.saveImportantMetric({
            departmentKey: dept,
            userId: Number(userId),
            metricKey: value
          });
        } catch (error) {
          console.warn('[yield] failed to save important metric (personal daily)', error);
        }
      }
      renderPersonalDailyTable(periodId, dailyData);
    });
    select.dataset.bound = 'true';
  });

  body.querySelectorAll('[data-ms-distribute][data-scope="personalDaily"]').forEach(button => {
    if (button.dataset.bound) return;
    button.addEventListener('click', handlePersonalDailyDistribute);
    button.dataset.bound = 'true';
  });
}

async function loadAndRenderCompanyDaily() {
  const periodId = state.companyDailyPeriodId;
  if (!periodId) return;

  await ensureDailyYieldData(periodId);
  renderCompanyDailyEmployeeOptions();
  ensureCompanyDailyEmployeeId();

  const employeeId = state.companyDailyEmployeeId;
  if (!employeeId) return;
  await Promise.all([
    goalSettingsService.loadPersonalPeriodTarget(periodId, employeeId),
    goalSettingsService.loadPersonalDailyTargets(periodId, employeeId)
  ]);
  const dailyData = state.companyDailyData[employeeId]?.[periodId] || {};
  renderCompanyDailyTable(periodId, employeeId, dailyData);
}

function renderCompanyDailyTable(periodId, employeeId, dailyData = {}) {
  const body = document.getElementById('companyDailyTableBody');
  const headerRow = document.getElementById('companyDailyHeaderRow');
  const labelEl = document.getElementById('companyDailyPeriodLabel');
  const period = state.evaluationPeriods.find(item => item.id === periodId);
  if (!body || !headerRow) return;
  if (!period) {
    body.innerHTML = '';
    headerRow.innerHTML = '';
    if (labelEl) labelEl.textContent = '評価期間：--';
    return;
  }
  const dates = enumeratePeriodDates(period);
  const advisorName = employeeId || null;
  const periodTarget = goalSettingsService.getPersonalPeriodTarget(periodId, advisorName) || {};
  const savedTargets = goalSettingsService.getPersonalDailyTargets(periodId, advisorName) || {};
  const cumulativeFallback = DAILY_FIELDS.reduce((acc, field) => {
    const rawTotal = periodTarget[field.targetKey];
    if (rawTotal === undefined || rawTotal === null) return acc;
    const totalTarget = num(rawTotal);
    acc[field.targetKey] = buildCumulativeSeries(totalTarget, dates.length);
    return acc;
  }, {});
  if (labelEl) labelEl.textContent = `評価期間：${period.startDate}〜${period.endDate}`;

  renderDailyMatrix({
    headerRow,
    body,
    dates,
    dailyData,
    resolveValues: (field, date, dateIndex) => {
      const actual = dailyData[date] || {};
      const target = savedTargets[date] || {};
      const rawTarget = target[field.targetKey];
      const expected = rawTarget !== undefined && rawTarget !== null
        ? num(rawTarget)
        : cumulativeFallback[field.targetKey] !== undefined
          ? cumulativeFallback[field.targetKey][dateIndex]
          : null;
      return { actual: actual[field.dataKey], target: expected };
    }
  });
  if (labelEl) labelEl.textContent = `評価期間：${formatPeriodMonthLabel(period) || '--'}`;
}

function getMsMetricOption(metricKey) {
  return MS_METRIC_OPTIONS.find(option => option.key === metricKey) || MS_METRIC_OPTIONS[0];
}

// 自動計算された実績値を取得
function getAutoCalculatedActual(memberId, date, metricKey) {
  // 部門別指標定義からtargetKeyを探す
  const allMetrics = [...MS_MARKETING_METRICS, ...MS_CS_METRICS, ...MS_SALES_METRICS];
  const metricDef = allMetrics.find(m => m.key === metricKey);
  const dataKey = metricDef ? metricDef.targetKey : metricKey; // targetKey (e.g. newInterviews)

  // APIデータはスネークケースの場合もあるので対応
  const snakeKey = dataKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

  const periodId = state.companyMsPeriodId;
  const dailyData = state.companyDailyData[String(memberId)]?.[periodId]?.[date];

  if (dailyData) {
    // データがあれば返す。優先順位: camelCase -> snake_case
    const val = dailyData[dataKey] ?? dailyData[snakeKey];
    if (val !== undefined && Math.random() < 0.05) console.log(`[DEBUG] AutoCalc hit for ${memberId}/${date}/${metricKey}:`, { dataKey, snakeKey, val, dailyData });
    return val !== undefined ? Number(val) : 0;
  }
  return 0;
}

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

function enumerateDateRange(startDate, endDate) {
  if (!startDate || !endDate) return [];
  const dates = [];
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (!start || !end || Number.isNaN(start) || Number.isNaN(end)) return [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(isoDate(d));
  }
  return dates;
}

function resolveCompanyMsRanges(period) {
  const emptyRange = { startDate: '', endDate: '' };
  const emptyResult = {
    salesRange: emptyRange,
    revenueRange: emptyRange,
    marketingRange: emptyRange,
    csRange: emptyRange
  };
  if (!period?.startDate || !period?.endDate) {
    return emptyResult;
  }
  const baseRange = { startDate: period.startDate, endDate: period.endDate };
  const end = new Date(period.endDate);
  if (Number.isNaN(end.getTime())) {
    return {
      salesRange: baseRange,
      revenueRange: baseRange,
      marketingRange: baseRange,
      csRange: baseRange
    };
  }
  const currentYear = end.getFullYear();
  const currentMonth = end.getMonth(); // 0-indexed

  // 個人日別実績と同じ基準（前月/当月の固定日）でMS期間を算出する
  const marketingStart = new Date(currentYear, currentMonth - 1, 17);
  const marketingEnd = new Date(currentYear, currentMonth, 19);
  const csStart = new Date(currentYear, currentMonth - 1, 18);
  const csEnd = new Date(currentYear, currentMonth, 20);
  const salesStart = new Date(currentYear, currentMonth - 1, 18);
  const salesEnd = new Date(currentYear, currentMonth, 19);
  const revenueStart = new Date(currentYear, currentMonth, 1);
  const revenueEnd = new Date(currentYear, currentMonth + 1, 0);
  const msOverallStart = new Date(currentYear, currentMonth - 1, 17);
  const msOverallEnd = new Date(currentYear, currentMonth + 1, 0);

  return {
    salesRange: { startDate: isoDate(salesStart), endDate: isoDate(salesEnd) },
    revenueRange: { startDate: isoDate(revenueStart), endDate: isoDate(revenueEnd) },
    marketingRange: { startDate: isoDate(marketingStart), endDate: isoDate(marketingEnd) },
    csRange: { startDate: isoDate(csStart), endDate: isoDate(csEnd) },
    msOverallRange: { startDate: isoDate(msOverallStart), endDate: isoDate(msOverallEnd) }
  };
}

if (typeof window !== 'undefined') {
  window.__yieldDebug = window.__yieldDebug || {};
  window.__yieldDebug.getCompanyMsRange = () => {
    const period = state.evaluationPeriods.find(p => p.id === state.companyMsPeriodId);
    return {
      periodId: state.companyMsPeriodId,
      period,
      ranges: resolveCompanyMsRanges(period)
    };
  };
  window.__yieldDebug.getCompanyMsDates = () => ({
    periodId: state.companyMsPeriodId,
    count: state.companyMs?.dates?.length || 0,
    head: (state.companyMs?.dates || []).slice(0, 5),
    tail: (state.companyMs?.dates || []).slice(-5)
  });
  window.__yieldDebug.reloadCompanyMs = () => loadAndRenderCompanyMs();
}

async function resolveAdvisorEmployeeIds() {
  const members = await ensureMembersList();
  const advisors = (members || []).filter(member => isAdvisorRole(member.role));
  const advisorIds = advisors.map(member => String(member.id));
  if (advisorIds.length) return advisorIds;
  return getCompanyDailyEmployees().map(emp => String(emp.id));
}

async function resolveAdvisorEmployees() {
  const members = await ensureMembersList();
  const advisors = (members || []).filter(member => isAdvisorRole(member.role));
  if (advisors.length) {
    return advisors.map(member => ({
      id: String(member.id),
      name: member.name || `ID:${member.id}`
    }));
  }
  return getCompanyDailyEmployees().map(emp => ({
    id: String(emp.id),
    name: emp.name || `ID:${emp.id}`
  }));
}

function buildCompanyMsDailyTotals(periodId, employeeIds) {
  const totals = {};
  (employeeIds || []).forEach(rawId => {
    const id = String(rawId || '');
    if (!id) return;
    const series = state.companyDailyData[id]?.[periodId] || {};
    Object.entries(series).forEach(([date, counts]) => {
      if (!totals[date]) totals[date] = {};
      Object.entries(counts || {}).forEach(([key, value]) => {
        totals[date][key] = num(totals[date][key]) + num(value);
      });
    });
  });
  return totals;
}

function buildCompanyMsDailyTotalsFromEmployees(employees, employeeIds) {
  const totals = {};
  const allowSet = new Set((employeeIds || []).map(id => String(id)));
  (employees || []).forEach(emp => {
    const id = String(emp?.advisorUserId ?? emp?.id ?? '');
    if (!id) return;
    if (allowSet.size && !allowSet.has(id)) return;
    const series = emp?.daily || emp?.dailyData || emp?.series || {};
    Object.entries(series).forEach(([date, counts]) => {
      if (!totals[date]) totals[date] = {};
      Object.entries(counts || {}).forEach(([key, value]) => {
        totals[date][key] = num(totals[date][key]) + num(value);
      });
    });
  });
  return totals;
}

function buildCompanyMsHeaderRow(headerRow, dates) {
  if (!headerRow) return;
  // 日付ごとに1列（MS/進捗率/実績は行で分ける）
  const dateCells = dates.map(date => {
    const dayLabel = formatDayLabel(date);
    return `<th scope="col" class="ms-date-header">${dayLabel}</th>`;
  }).join('');

  headerRow.innerHTML = `
    <th scope="col" class="kpi-v2-sticky-label">事業部</th>
    <th scope="col" class="kpi-v2-sticky-label kpi-v2-ms-metric">指標</th>
    <th scope="col" class="daily-type">区分</th>
    ${dateCells}
  `;
}

// 日付が部門の開始日より前かどうかを判定
function isDateBeforeDeptStart(date, deptKey) {
  const periodId = state.companyMsPeriodId;
  const period = state.evaluationPeriods.find(p => p.id === periodId);
  if (!period?.endDate) return false;

  const end = new Date(period.endDate);
  const currentYear = end.getFullYear();
  const currentMonth = end.getMonth();
  const dateObj = parseLocalDate(date);
  if (!dateObj) return false;

  // 部門別開始日
  let startDate;
  switch (deptKey) {
    case 'marketing':
      startDate = new Date(currentYear, currentMonth - 1, 17);
      break;
    case 'cs':
    case 'sales':
      startDate = new Date(currentYear, currentMonth - 1, 18);
      break;
    case 'revenue':
      startDate = new Date(currentYear, currentMonth, 1);
      break;
    default:
      return false;
  }
  return dateObj < startDate;
}

// 日付が部門の終了日より後かどうかを判定
function isDateAfterDeptEnd(date, deptKey) {
  const periodId = state.companyMsPeriodId;
  const period = state.evaluationPeriods.find(p => p.id === periodId);
  if (!period?.endDate) return false;

  const end = new Date(period.endDate);
  const currentYear = end.getFullYear();
  const currentMonth = end.getMonth();
  const dateObj = parseLocalDate(date);
  if (!dateObj) return false;

  // 部門別終了日
  let endDate;
  switch (deptKey) {
    case 'marketing':
      endDate = new Date(currentYear, currentMonth, 19);
      break;
    case 'cs':
      endDate = new Date(currentYear, currentMonth, 20);
      break;
    case 'sales':
      endDate = new Date(currentYear, currentMonth, 19);
      break;
    case 'revenue':
      endDate = new Date(currentYear, currentMonth + 1, 0); // 月末
      break;
    default:
      return false;
  }
  return dateObj > endDate;
}

function sumTargetValues(targets = {}) {
  return Object.values(targets).reduce((sum, value) => sum + num(value), 0);
}

function getLastCumulativeTargetForCompany(dates, targets = {}, deptKey) {
  let last = 0;
  dates.forEach(date => {
    const disabled = isDateBeforeDeptStart(date, deptKey) || isDateAfterDeptEnd(date, deptKey);
    if (disabled) return;
    const value = targets?.[date];
    if (value !== undefined && value !== null && value !== '') {
      last = num(value);
    }
  });
  return last;
}

function getCompanyMsTargetMap(deptKey, metricKey) {
  return state.companyMs.msTargets?.[deptKey]?.[metricKey] || {};
}

async function persistCompanyMsTargets(deptKey, metricKey) {
  const periodId = state.companyMsPeriodId;
  if (!periodId || !deptKey || !metricKey) return;
  const dailyTargets = getCompanyMsTargetMap(deptKey, metricKey);
  const dates = state.companyMs.dates || [];
  const targetTotal =
    state.companyMs.msTargetTotals?.[deptKey]?.[metricKey] ??
    (dates.length ? getLastCumulativeTargetForCompany(dates, dailyTargets, deptKey) : sumTargetValues(dailyTargets));
  try {
    await goalSettingsService.saveMsTargets({
      scope: 'company',
      departmentKey: deptKey,
      metricKey,
      periodId,
      targetTotal,
      dailyTargets
    });
  } catch (error) {
    console.warn('[yield] failed to save company ms targets', error);
  }
}

async function loadCompanyMsTargets(periodId) {
  if (!periodId) return;
  const tasks = [];
  MS_DEPARTMENTS.forEach(dept => {
    const isRevenue = dept.key === 'revenue';
    const metricKey = isRevenue
      ? 'revenue'
      : state.companyMs.metricKeys?.[dept.key] || getMetricsForDept(dept.key)[0]?.key;
    if (!metricKey) return;
    tasks.push((async () => {
      const data = await goalSettingsService.loadMsTargets({
        scope: 'company',
        departmentKey: dept.key,
        metricKey,
        periodId
      });
      if (!data) return;
      if (!state.companyMs.msTargets) state.companyMs.msTargets = {};
      if (!state.companyMs.msTargets[dept.key]) state.companyMs.msTargets[dept.key] = {};
      state.companyMs.msTargets[dept.key][metricKey] = data.dailyTargets || {};
      if (!state.companyMs.msTargetTotals) state.companyMs.msTargetTotals = {};
      if (!state.companyMs.msTargetTotals[dept.key]) state.companyMs.msTargetTotals[dept.key] = {};
      state.companyMs.msTargetTotals[dept.key][metricKey] = num(data.targetTotal || 0);
    })());
  });
  await Promise.all(tasks);
}

// MS目標入力ハンドラ
function handleMsTargetInput(event) {
  const input = event.target;
  const { dept, date, metric } = input.dataset;
  const value = Number(input.value) || 0;

  // stateに保存
  if (!state.companyMs.msTargets) state.companyMs.msTargets = {};
  if (!state.companyMs.msTargets[dept]) state.companyMs.msTargets[dept] = {};
  if (!state.companyMs.msTargets[dept][metric]) state.companyMs.msTargets[dept][metric] = {};
  state.companyMs.msTargets[dept][metric][date] = value;
  if (!state.companyMs.msTargetTotals) state.companyMs.msTargetTotals = {};
  if (!state.companyMs.msTargetTotals[dept]) state.companyMs.msTargetTotals[dept] = {};
  const dates = state.companyMs.dates || [];
  state.companyMs.msTargetTotals[dept][metric] = dates.length
    ? getLastCumulativeTargetForCompany(dates, state.companyMs.msTargets[dept][metric], dept)
    : sumTargetValues(state.companyMs.msTargets[dept][metric]);

  // 進捗率は全体に影響するため再描画
  renderCompanyMsTable();
  persistCompanyMsTargets(dept, metric);
}

function distributeMsTargets(totalTarget, dates, deptKey, periodId) {
  const activeDates = dates.filter(date => {
    const disabled = isDateBeforeDeptStart(date, deptKey) || isDateAfterDeptEnd(date, deptKey);
    return !disabled;
  });
  const cumulative = buildCumulativeSeries(totalTarget, activeDates.length);
  const map = {};
  let activeIndex = 0;
  dates.forEach(date => {
    const disabled = isDateBeforeDeptStart(date, deptKey) || isDateAfterDeptEnd(date, deptKey);
    if (disabled) return;
    map[date] = cumulative[activeIndex] ?? 0;
    activeIndex += 1;
  });
  return map;
}

function handleCompanyMsDistribute(event) {
  const button = event.target;
  const deptKey = button.dataset.dept;
  const metricKey = button.dataset.metric;
  const periodId = state.companyMsPeriodId;
  if (!deptKey || !metricKey || !periodId) return;
  const dates = state.companyMs.dates || [];
  const currentTotal = state.companyMs.msTargetTotals?.[deptKey]?.[metricKey]
    ?? (dates.length ? getLastCumulativeTargetForCompany(dates, getCompanyMsTargetMap(deptKey, metricKey), deptKey) : sumTargetValues(getCompanyMsTargetMap(deptKey, metricKey)));
  const input = prompt('最終目標値を入力してください', currentTotal ? String(currentTotal) : '');
  if (input === null) return;
  const total = Number(input);
  if (!Number.isFinite(total) || total < 0) return;
  const targetMap = distributeMsTargets(total, state.companyMs.dates || [], deptKey, periodId);
  if (!state.companyMs.msTargets) state.companyMs.msTargets = {};
  if (!state.companyMs.msTargets[deptKey]) state.companyMs.msTargets[deptKey] = {};
  state.companyMs.msTargets[deptKey][metricKey] = targetMap;
  if (!state.companyMs.msTargetTotals) state.companyMs.msTargetTotals = {};
  if (!state.companyMs.msTargetTotals[deptKey]) state.companyMs.msTargetTotals[deptKey] = {};
  state.companyMs.msTargetTotals[deptKey][metricKey] = total;
  renderCompanyMsTable();
  persistCompanyMsTargets(deptKey, metricKey);
}

// 進捗率を更新
function updateMsProgressRate(dept, date) {
  const msValue = state.companyMs.msTargets?.[dept]?.[date] || 0;
  const actualValue = state.companyMs.msActuals?.[dept]?.[date] || 0;

  const rateCell = document.querySelector(`[data-progress-rate][data-dept="${dept}"][data-date="${date}"]`);
  if (!rateCell) return;

  if (msValue > 0) {
    const rate = Math.round((actualValue / msValue) * 100);
    rateCell.textContent = `${rate}%`;
    rateCell.className = rate >= 100 ? 'ms-rate-good' : rate >= 80 ? 'ms-rate-warn' : 'ms-rate-bad';
  } else {
    rateCell.textContent = '-';
    rateCell.className = '';
  }
}

// MS実績入力ハンドラ
function handleMsActualInput(event) {
  const input = event.target;
  const { dept, date } = input.dataset;
  const value = Number(input.value) || 0;

  // stateに保存
  if (!state.companyMs.msActuals) state.companyMs.msActuals = {};
  if (!state.companyMs.msActuals[dept]) state.companyMs.msActuals[dept] = {};
  state.companyMs.msActuals[dept][date] = value;

  // 進捗率を再計算
  updateMsProgressRate(dept, date);
}

function resolveMetricDataKey(metricOption, fallbackKey = '') {
  return metricOption?.targetKey || metricOption?.key || fallbackKey || '';
}

function getDailyMetricValue(dailyCounts, metricOption, fallbackKey = '') {
  if (!dailyCounts) return 0;
  const dataKey = resolveMetricDataKey(metricOption, fallbackKey);
  if (!dataKey) return 0;
  if (dailyCounts[dataKey] !== undefined) return num(dailyCounts[dataKey]);
  const snakeKey = dataKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  if (dailyCounts[snakeKey] !== undefined) return num(dailyCounts[snakeKey]);
  return 0;
}

function buildCumulativeFromDaily(values) {
  const result = [];
  let sum = 0;
  values.forEach(value => {
    sum += num(value);
    result.push(sum);
  });
  return result;
}

function renderCompanyMsTable() {
  const headerRow = document.getElementById('companyMsHeaderRow');
  const body = document.getElementById('companyMsTableBody');
  if (!headerRow || !body) return;

  const dates = state.companyMs.dates || [];
  if (!dates.length) {
    headerRow.innerHTML = '';
    body.innerHTML = '';
    return;
  }

  // サブヘッダー行が残っていたら削除
  const thead = headerRow.parentElement;
  if (thead) {
    while (thead.rows.length > 1) {
      thead.deleteRow(1);
    }
  }

  buildCompanyMsHeaderRow(headerRow, dates);


  const rows = [];

  MS_DEPARTMENTS.forEach((dept, index) => {
    const isRevenue = dept.key === 'revenue';
    const deptMetrics = isRevenue
      ? [{ key: 'revenue', label: '売上', targetKey: 'revenue' }]
      : getMetricsForDept(dept.key);

    // 現在選択中の指標（なければデフォルト）
    let metricKey = isRevenue ? 'revenue' : state.companyMs.metricKeys?.[dept.key];
    if (!metricKey || !deptMetrics.some(m => m.key === metricKey)) {
      metricKey = deptMetrics[0]?.key;
      if (!metricKey) return;
      // stateも更新しておく
      if (!state.companyMs.metricKeys) state.companyMs.metricKeys = {};
      state.companyMs.metricKeys[dept.key] = metricKey;
    }

    const metricOption = metricKey ? deptMetrics.find(m => m.key === metricKey) : null;
    const metricLabel = isRevenue ? '売上（万円）' : metricOption?.label || '';

    // 指標セレクトボックスHTML
    const optionsHtml = deptMetrics.map(option =>
      `<option value="${option.key}" ${option.key === metricKey ? 'selected' : ''}>${option.label}</option>`
    ).join('');

    // 指標セル（セレクトボックスまたはラベル）
    const distributeButton = `<button type="button" class="ms-distribute-btn" data-ms-distribute data-scope="company" data-dept="${dept.key}" data-metric="${metricKey}">日割り</button>`;
    const metricCell = isRevenue
      ? `<th scope="row" class="kpi-v2-sticky-label kpi-v2-ms-metric" rowspan="3">
           <div class="ms-metric-cell">
             <span>${metricLabel}</span>
             ${distributeButton}
           </div>
         </th>`
      : `<th scope="row" class="kpi-v2-sticky-label kpi-v2-ms-metric" rowspan="3">
           <div class="ms-metric-cell">
             <select class="kpi-v2-sort-select company-ms-metric-select" data-dept="${dept.key}">
               ${optionsHtml}
             </select>
             ${distributeButton}
           </div>
         </th>`;

    const targetMap = state.companyMs.msTargets?.[dept.key]?.[metricKey] || {};
    const cumulativeTargets = [];
    const dailyActuals = [];
    dates.forEach(date => {
      const isDisabled = isDateBeforeDeptStart(date, dept.key) || isDateAfterDeptEnd(date, dept.key);
      if (isDisabled) {
        cumulativeTargets.push(null);
        dailyActuals.push(null);
        return;
      }
      const savedMs = targetMap?.[date];
      cumulativeTargets.push(savedMs !== undefined && savedMs !== null ? num(savedMs) : null);
      const dailyCount = isRevenue
        ? getDailyMetricValue(state.companyMs.dailyTotals?.[date], null, 'revenue')
        : getDailyMetricValue(state.companyMs.dailyTotals?.[date], metricOption, metricKey || '');
      dailyActuals.push(dailyCount);
    });

    const cumulativeActuals = buildCumulativeFromDaily(dailyActuals.map(value => (value === null ? 0 : value)));
    const totalTarget = Number.isFinite(state.companyMs.msTargetTotals?.[dept.key]?.[metricKey])
      ? num(state.companyMs.msTargetTotals?.[dept.key]?.[metricKey])
      : getLastCumulativeTargetForCompany(dates, targetMap, dept.key);

    const msCells = dates.map((date, idx) => {
      const isDisabled = isDateBeforeDeptStart(date, dept.key) || isDateAfterDeptEnd(date, dept.key);
      if (isDisabled) return `<td class="ms-cell-disabled"></td>`;
      const savedMs = cumulativeTargets[idx];
      const displayValue = Number.isFinite(savedMs) ? savedMs : '';
      return `
        <td class="ms-target-cell">
          <input type="number" class="ms-target-input" 
                 data-dept="${dept.key}" 
                 data-date="${date}" 
                 data-metric="${metricKey || ''}"
                 value="${displayValue}" 
                 min="0" />
        </td>
      `;
    }).join('');

    const rateCells = dates.map((date, idx) => {
      const isDisabled = isDateBeforeDeptStart(date, dept.key) || isDateAfterDeptEnd(date, dept.key);
      if (isDisabled) return `<td class="ms-cell-disabled"></td>`;

      const cumulativeActual = cumulativeActuals[idx] ?? 0;
      const cumulativeTarget = cumulativeTargets[idx] ?? 0;
      const numerator = cumulativeActual;
      const denominator = cumulativeTarget;

      let rateDisplay = '-';
      let rateClass = '';
      if (denominator && Number(denominator) > 0) {
        const rate = Math.round((numerator / Number(denominator)) * 100);
        rateDisplay = `${rate}%`;
        rateClass = rate >= 100 ? 'ms-rate-good' : rate >= 80 ? 'ms-rate-warn' : 'ms-rate-bad';
      }
      return `<td class="ms-rate-cell ${rateClass}" data-progress-rate data-dept="${dept.key}" data-date="${date}">
        ${rateDisplay}
      </td>`;
    }).join('');

    const actualCells = dates.map((date, idx) => {
      const isDisabled = isDateBeforeDeptStart(date, dept.key) || isDateAfterDeptEnd(date, dept.key);
      if (isDisabled) return `<td class="ms-cell-disabled"></td>`;
      const displayValue = cumulativeActuals[idx] ?? 0;
      return `<td class="ms-actual-cell">${formatNumberCell(displayValue)}</td>`;
    }).join('');

    const tripletAlt = index % 2 === 1 ? 'daily-triplet-alt' : '';

    // MS行
    rows.push(`
      <tr class="${tripletAlt}">
        <th scope="row" class="kpi-v2-sticky-label" rowspan="3">${dept.label}</th>
        ${metricCell}
        <td class="daily-type">MS</td>
        ${msCells}
      </tr>
    `);

    // 進捗率行
    rows.push(`
      <tr class="${tripletAlt}">
        <td class="daily-type">進捗率</td>
        ${rateCells}
      </tr>
    `);

    // 実績行
    rows.push(`
      <tr class="${tripletAlt}">
        <td class="daily-type">実績</td>
        ${actualCells}
      </tr>
    `);
  });

  body.innerHTML = rows.join('');

  // セレクトボックスのイベントバインド
  body.querySelectorAll('.company-ms-metric-select').forEach(select => {
    const deptKey = select.dataset.dept;
    if (!deptKey) return;
    select.value = state.companyMs.metricKeys?.[deptKey] || getMetricsForDept(deptKey)[0]?.key || '';
    if (select.dataset.bound) return;
    select.addEventListener('change', handleCompanyMsMetricChange);
    select.dataset.bound = 'true';
  });

  // MS目標入力のイベントバインド
  body.querySelectorAll('.ms-target-input').forEach(input => {
    if (input.dataset.bound) return;
    input.addEventListener('change', handleMsTargetInput);
    input.dataset.bound = 'true';
  });

  body.querySelectorAll('[data-ms-distribute][data-scope="company"]').forEach(button => {
    if (button.dataset.bound) return;
    button.addEventListener('click', handleCompanyMsDistribute);
    button.dataset.bound = 'true';
  });

}

// ==================== 個人別MSテーブル ====================

// 部門キーから指標定義を取得
function getMetricsForDept(deptKey) {
  if (deptKey === 'marketing') return MS_MARKETING_METRICS;
  if (deptKey === 'cs') return MS_CS_METRICS;
  if (deptKey === 'sales') return MS_SALES_METRICS;
  return [];
}

function getPersonalMsTargetMap(deptKey, memberId, metricKey) {
  if (!deptKey || !memberId || !metricKey) return {};
  return state.personalMs?.[deptKey]?.msTargets?.[memberId]?.[metricKey] || {};
}

function getPersonalMsTargetTotal(deptKey, memberId, metricKey) {
  if (!deptKey || !memberId || !metricKey) return null;
  return state.personalMs?.[deptKey]?.msTargetTotals?.[memberId]?.[metricKey];
}

async function loadPersonalMsTargetsForMember(deptKey, memberId, metricKey, periodId = state.companyMsPeriodId) {
  if (!deptKey || !memberId || !metricKey || !periodId) return;
  try {
    const data = await goalSettingsService.loadMsTargets({
      scope: 'personal',
      departmentKey: deptKey,
      metricKey,
      periodId,
      advisorUserId: Number(memberId)
    });
    if (!data) return;
    if (!state.personalMs[deptKey].msTargets) state.personalMs[deptKey].msTargets = {};
    if (!state.personalMs[deptKey].msTargets[memberId]) state.personalMs[deptKey].msTargets[memberId] = {};
    state.personalMs[deptKey].msTargets[memberId][metricKey] = data.dailyTargets || {};
    if (!state.personalMs[deptKey].msTargetTotals) state.personalMs[deptKey].msTargetTotals = {};
    if (!state.personalMs[deptKey].msTargetTotals[memberId]) state.personalMs[deptKey].msTargetTotals[memberId] = {};
    state.personalMs[deptKey].msTargetTotals[memberId][metricKey] = num(data.targetTotal || 0);
  } catch (error) {
    console.warn('[yield] failed to load personal ms targets', error);
  }
}

async function persistPersonalMsTargets(periodId, deptKey, memberId, metricKey) {
  if (!periodId || !deptKey || !memberId || !metricKey) return;
  const dailyTargets = getPersonalMsTargetMap(deptKey, memberId, metricKey);
  const dates = state.personalMs?.[deptKey]?.dates || [];
  const targetTotal =
    getPersonalMsTargetTotal(deptKey, memberId, metricKey) ??
    getLastCumulativeTarget(dates, dailyTargets, deptKey, periodId);
  try {
    await goalSettingsService.saveMsTargets({
      scope: 'personal',
      departmentKey: deptKey,
      metricKey,
      periodId,
      advisorUserId: Number(memberId),
      targetTotal,
      dailyTargets
    });
  } catch (error) {
    console.warn('[yield] failed to save personal ms targets', error);
  }
}

// 指標変更ハンドラ（管理者: 重要指標の更新）
async function handlePersonalMsMetricChange(event) {
  const select = event.target;
  const { dept, member } = select.dataset;
  const value = select.value;

  if (!dept || !member || !state.personalMs[dept]) return;
  if (!state.personalMs[dept].metricKeys) {
    state.personalMs[dept].metricKeys = {};
  }
  state.personalMs[dept].metricKeys[member] = value;
  if (!state.personalMs.importantMetrics) state.personalMs.importantMetrics = {};
  if (!state.personalMs.importantMetrics[dept]) state.personalMs.importantMetrics[dept] = {};
  state.personalMs.importantMetrics[dept][member] = value;

  try {
    await goalSettingsService.saveImportantMetric({
      departmentKey: dept,
      userId: Number(member),
      metricKey: value
    });
  } catch (error) {
    console.warn('[yield] failed to save important metric', error);
  }

  await loadPersonalMsTargetsForMember(dept, member, value);
  renderPersonalMsTable(dept);
}

// 個人別MS目標入力ハンドラ
function handlePersonalMsTargetInput(event) {
  const input = event.target;
  const { dept, member, date, metric } = input.dataset;
  const value = Number(input.value) || 0;

  if (!state.personalMs[dept]) return;
  if (!state.personalMs[dept].msTargets[member]) {
    state.personalMs[dept].msTargets[member] = {};
  }
  if (!state.personalMs[dept].msTargets[member][metric]) {
    state.personalMs[dept].msTargets[member][metric] = {};
  }
  state.personalMs[dept].msTargets[member][metric][date] = value;
  if (!state.personalMs[dept].msTargetTotals) state.personalMs[dept].msTargetTotals = {};
  if (!state.personalMs[dept].msTargetTotals[member]) state.personalMs[dept].msTargetTotals[member] = {};
  const dates = state.personalMs[dept]?.dates || [];
  state.personalMs[dept].msTargetTotals[member][metric] = getLastCumulativeTarget(
    dates,
    state.personalMs[dept].msTargets[member][metric],
    dept,
    state.companyMsPeriodId
  );
  renderPersonalMsTable(dept);
  persistPersonalMsTargets(state.companyMsPeriodId, dept, member, metric);
}

// 個人別MS実績入力ハンドラ
function handlePersonalMsActualInput(event) {
  const input = event.target;
  const { dept, member, date, metric } = input.dataset;
  const value = Number(input.value) || 0;

  if (!state.personalMs[dept]) return;
  if (!state.personalMs[dept].msActuals[member]) {
    state.personalMs[dept].msActuals[member] = {};
  }
  if (!state.personalMs[dept].msActuals[member][metric]) {
    state.personalMs[dept].msActuals[member][metric] = {};
  }
  state.personalMs[dept].msActuals[member][metric][date] = value;

  updatePersonalMsProgressRate(dept, member, date, metric);
}

function handlePersonalMsDistribute(event) {
  const button = event.target;
  const { dept, member, metric } = button.dataset;
  const periodId = state.companyMsPeriodId;
  if (!dept || !member || !metric || !periodId) return;

  const dates = state.personalMs?.[dept]?.dates || [];
  const currentTotal =
    getPersonalMsTargetTotal(dept, member, metric) ??
    getLastCumulativeTarget(dates, getPersonalMsTargetMap(dept, member, metric), dept, periodId);
  const input = prompt('最終目標値を入力してください', currentTotal ? String(currentTotal) : '');
  if (input === null) return;
  const total = Number(input);
  if (!Number.isFinite(total) || total < 0) return;

  const activeDates = dates.filter(date => {
    const disabled = isDateBeforeDeptStart(date, dept) || isDateAfterDeptEnd(date, dept);
    return !disabled;
  });
  const cumulative = buildCumulativeSeries(total, activeDates.length);
  const targetMap = {};
  let activeIndex = 0;
  dates.forEach(date => {
    const disabled = isDateBeforeDeptStart(date, dept) || isDateAfterDeptEnd(date, dept);
    if (disabled) return;
    targetMap[date] = cumulative[activeIndex] ?? 0;
    activeIndex += 1;
  });

  if (!state.personalMs[dept].msTargets) state.personalMs[dept].msTargets = {};
  if (!state.personalMs[dept].msTargets[member]) state.personalMs[dept].msTargets[member] = {};
  state.personalMs[dept].msTargets[member][metric] = targetMap;
  if (!state.personalMs[dept].msTargetTotals) state.personalMs[dept].msTargetTotals = {};
  if (!state.personalMs[dept].msTargetTotals[member]) state.personalMs[dept].msTargetTotals[member] = {};
  state.personalMs[dept].msTargetTotals[member][metric] = total;

  renderPersonalMsTable(dept);
  persistPersonalMsTargets(periodId, dept, member, metric);
}

// 個人別MS進捗率を更新
function updatePersonalMsProgressRate(dept, memberId, date, metricKey) {
  const msValue = state.personalMs[dept]?.msTargets?.[memberId]?.[metricKey]?.[date] || 0;
  const actualValue = state.personalMs[dept]?.msActuals?.[memberId]?.[metricKey]?.[date] || 0;

  const rateCell = document.querySelector(
    `[data-personal-progress-rate][data-dept="${dept}"][data-member="${memberId}"][data-date="${date}"][data-metric="${metricKey}"]`
  );
  if (!rateCell) return;

  if (msValue > 0) {
    const rate = Math.round((actualValue / msValue) * 100);
    rateCell.textContent = `${rate}%`;
    rateCell.className = `ms-rate-cell ${rate >= 100 ? 'ms-rate-good' : rate >= 80 ? 'ms-rate-warn' : 'ms-rate-bad'}`;
  } else {
    rateCell.textContent = '-';
    rateCell.className = 'ms-rate-cell';
  }
}

// 個人別MSテーブルをレンダリング
function renderPersonalMsTable(deptKey) {
  const deptConfig = {
    marketing: { headerRowId: 'marketingPersonalMsHeaderRow', bodyId: 'marketingPersonalMsTableBody' },
    cs: { headerRowId: 'csPersonalMsHeaderRow', bodyId: 'csPersonalMsTableBody' },
    sales: { headerRowId: 'salesPersonalMsHeaderRow', bodyId: 'salesPersonalMsTableBody' }
  };

  const config = deptConfig[deptKey];
  if (!config) return;

  const headerRow = document.getElementById(config.headerRowId);
  const body = document.getElementById(config.bodyId);
  if (!headerRow || !body) return;

  const deptData = state.personalMs[deptKey];
  if (!deptData) return;

  const periodId = state.companyMsPeriodId;
  const dates = deptData.dates || [];
  const members = deptData.members || [];
  const metrics = getMetricsForDept(deptKey);
  const defaultMetricKey = metrics[0]?.key;

  // サブヘッダーを削除
  const thead = headerRow.parentElement;
  if (thead) {
    while (thead.rows.length > 1) {
      thead.deleteRow(1);
    }
  }

  if (!dates.length || !metrics.length) {
    headerRow.innerHTML = '';
    body.innerHTML = '<tr><td colspan="10" class="kpi-v2-empty">該当するメンバーまたデータがありません</td></tr>';
    return;
  }

  // ヘッダー行を構築（1日1列）
  const dateCells = dates.map(date => {
    const dayLabel = formatDayLabel(date);
    return `<th scope="col" class="ms-date-header">${dayLabel}</th>`;
  }).join('');

  headerRow.innerHTML = `
    <th scope="col" class="kpi-v2-sticky-label">メンバー</th>
    <th scope="col" class="kpi-v2-sticky-label kpi-v2-ms-metric">指標</th>
    <th scope="col" class="daily-type">区分</th>
    ${dateCells}
  `;

  if (!members.length) {
    const colSpan = 3 + dates.length;
    body.innerHTML = `<tr><td colspan="${colSpan}" class="kpi-v2-empty">該当するメンバーまたデータがありません</td></tr>`;
    return;
  }

  // 各メンバーの行を生成
  const rows = [];
  members.forEach((member, index) => {
    const memberId = String(member.id || '');
    if (!memberId) return;
    const memberName = member.name || `ID:${memberId}`;

    // 重要指標（なければデフォルト）
    const importantMetricKey = state.personalMs?.importantMetrics?.[deptKey]?.[memberId];
    let currentMetricKey = importantMetricKey || state.personalMs[deptKey].metricKeys?.[memberId] || defaultMetricKey;
    if (!metrics.some(m => m.key === currentMetricKey)) currentMetricKey = defaultMetricKey;
    if (!state.personalMs[deptKey].metricKeys) state.personalMs[deptKey].metricKeys = {};
    state.personalMs[deptKey].metricKeys[memberId] = currentMetricKey;

    // 指標セレクトボックスHTML
    const metricOptionsHtml = metrics.map(m =>
      `<option value="${m.key}" ${m.key === currentMetricKey ? 'selected' : ''}>${m.label}</option>`
    ).join('');

    const isSingleMetric = metrics.length <= 1;
    const distributeButton = `<button type="button" class="ms-distribute-btn" data-ms-distribute data-scope="personalMs" data-dept="${deptKey}" data-member="${memberId}" data-metric="${currentMetricKey}">日割り</button>`;
    const metricCell = `
      <th scope="row" class="kpi-v2-sticky-label kpi-v2-ms-metric" rowspan="3">
        <div class="ms-metric-cell">
          <select class="kpi-v2-sort-select personal-ms-metric-select" 
                  data-dept="${deptKey}" 
                  data-member="${memberId}"
                  ${isSingleMetric ? 'disabled' : ''}>
            ${metricOptionsHtml}
          </select>
          ${distributeButton}
        </div>
      </th>
    `;

    const targetMap = getPersonalMsTargetMap(deptKey, memberId, currentMetricKey);
    const storedTotal = getPersonalMsTargetTotal(deptKey, memberId, currentMetricKey);
    const totalTarget = Number.isFinite(storedTotal)
      ? num(storedTotal)
      : getLastCumulativeTarget(dates, targetMap, deptKey, periodId);
    const activeDates = dates.filter(date => {
      const disabled = isDateBeforeDeptStart(date, deptKey) || isDateAfterDeptEnd(date, deptKey);
      return !disabled;
    });
    const fallbackCumulative = totalTarget > 0 ? buildCumulativeSeries(totalTarget, activeDates.length) : [];
    let activeIndex = 0;
    const cumulativeTargets = dates.map(date => {
      const isDisabled = isDateBeforeDeptStart(date, deptKey) || isDateAfterDeptEnd(date, deptKey);
      if (isDisabled) return null;
      const saved = targetMap?.[date];
      if (saved !== undefined && saved !== null && saved !== '') {
        activeIndex += 1;
        return num(saved);
      }
      const fallback = fallbackCumulative[activeIndex] ?? null;
      activeIndex += 1;
      return fallback;
    });

    const dailyTargets = [];
    let prevTarget = 0;
    cumulativeTargets.forEach(value => {
      if (value === null) {
        dailyTargets.push(null);
        return;
      }
      const daily = num(value) - num(prevTarget);
      dailyTargets.push(daily);
      prevTarget = num(value);
    });

    const dailyActuals = [];
    dates.forEach(date => {
      const isDisabled = isDateBeforeDeptStart(date, deptKey) || isDateAfterDeptEnd(date, deptKey);
      if (isDisabled) {
        dailyActuals.push(null);
        return;
      }
      const value = getAutoCalculatedActual(memberId, date, currentMetricKey);
      dailyActuals.push(num(value));
    });

    const cumulativeActuals = [];
    let running = 0;
    dailyActuals.forEach(value => {
      if (value === null) {
        cumulativeActuals.push(null);
        return;
      }
      running += num(value);
      cumulativeActuals.push(running);
    });

    const totalTargetValue = Number.isFinite(storedTotal)
      ? num(storedTotal)
      : getLastCumulativeTarget(dates, targetMap, deptKey, periodId) || (totalTarget > 0 ? totalTarget : 0);

    const msCells = dates.map((date, idx) => {
      const isDisabled = isDateBeforeDeptStart(date, deptKey) || isDateAfterDeptEnd(date, deptKey);
      if (isDisabled) return `<td class="ms-cell-disabled"></td>`;
      const value = cumulativeTargets[idx];
      const displayValue = Number.isFinite(value) ? value : '';
      return `
        <td class="ms-target-cell">
          <input type="number" class="ms-target-input personal-ms-target-input" 
                 data-dept="${deptKey}" 
                 data-member="${memberId}" 
                 data-date="${date}"
                 data-metric="${currentMetricKey}"
                 value="${displayValue}" 
                 min="0" />
        </td>
      `;
    }).join('');

    const rateCells = dates.map((date, idx) => {
      const isDisabled = isDateBeforeDeptStart(date, deptKey) || isDateAfterDeptEnd(date, deptKey);
      if (isDisabled) return `<td class="ms-cell-disabled"></td>`;
      const dailyTarget = dailyTargets[idx];
      const dailyActual = dailyActuals[idx] ?? 0;
      const cumulativeActual = cumulativeActuals[idx] ?? 0;
      const useOverall = state.msRateModes?.companyMs === 'overall';
      const numerator = useOverall ? cumulativeActual : dailyActual;
      const denominator = useOverall ? totalTargetValue : dailyTarget;

      let rateDisplay = '-';
      let rateClass = '';
      if (denominator && Number(denominator) > 0) {
        const rate = Math.round((numerator / Number(denominator)) * 100);
        rateDisplay = `${rate}%`;
        rateClass = rate >= 100 ? 'ms-rate-good' : rate >= 80 ? 'ms-rate-warn' : 'ms-rate-bad';
      }
      return `<td class="ms-rate-cell ${rateClass}">${rateDisplay}</td>`;
    }).join('');

    const actualCells = dates.map((date, idx) => {
      const isDisabled = isDateBeforeDeptStart(date, deptKey) || isDateAfterDeptEnd(date, deptKey);
      if (isDisabled) return `<td class="ms-cell-disabled"></td>`;
      return `<td class="ms-actual-cell">${formatNumberCell(cumulativeActuals[idx])}</td>`;
    }).join('');

    const rowAlt = index % 2 === 1 ? 'daily-triplet-alt' : '';

    rows.push(`
      <tr class="${rowAlt}">
        <th scope="row" class="kpi-v2-sticky-label" rowspan="3">${memberName}</th>
        ${metricCell}
        <td class="daily-type">MS</td>
        ${msCells}
      </tr>
    `);
    rows.push(`
      <tr class="${rowAlt}">
        <td class="daily-type">進捗率</td>
        ${rateCells}
      </tr>
    `);
    rows.push(`
      <tr class="${rowAlt}">
        <td class="daily-type">実績</td>
        ${actualCells}
      </tr>
    `);
  });

  body.innerHTML = rows.join('');

  // イベントバインド
  body.querySelectorAll('.personal-ms-metric-select').forEach(select => {
    if (select.dataset.bound) return;
    select.addEventListener('change', handlePersonalMsMetricChange);
    select.dataset.bound = 'true';
  });

  body.querySelectorAll('.personal-ms-target-input').forEach(input => {
    if (input.dataset.bound) return;
    input.addEventListener('change', handlePersonalMsTargetInput);
    input.dataset.bound = 'true';
  });

  body.querySelectorAll('[data-ms-distribute][data-scope="personalMs"]').forEach(button => {
    if (button.dataset.bound) return;
    button.addEventListener('click', handlePersonalMsDistribute);
    button.dataset.bound = 'true';
  });
}

// 個人別MSテーブルをすべてレンダリング
function renderAllPersonalMsTables() {
  ['cs', 'sales'].forEach(deptKey => {
    renderPersonalMsTable(deptKey);
  });
}

// 個人別MSデータを読み込み
// 個人別MSデータを読み込み
async function loadPersonalMsData() {
  const periodId = state.companyMsPeriodId;
  const period = state.evaluationPeriods.find(item => item.id === periodId);
  const marketingSection = document.querySelector('[data-personal-ms="marketing"]');
  if (marketingSection) marketingSection.hidden = true;
  if (!period) {
    state.personalMs.marketing.dates = [];
    state.personalMs.cs.dates = [];
    state.personalMs.sales.dates = [];
    state.personalMs.marketing.members = [];
    state.personalMs.cs.members = [];
    state.personalMs.sales.members = [];
    renderAllPersonalMsTables();
    return;
  }

  await ensureDailyYieldData(periodId, { msMode: true });

  const members = await ensureMembersList();
  const ranges = resolveCompanyMsRanges(period);

  // 部門別に日付を設定（部門ごとの期間のみ）
  state.personalMs.marketing.dates = enumerateDateRange(ranges.marketingRange?.startDate || '', ranges.marketingRange?.endDate || '');
  state.personalMs.cs.dates = enumerateDateRange(ranges.csRange?.startDate || '', ranges.csRange?.endDate || '');
  state.personalMs.sales.dates = enumerateDateRange(ranges.salesRange?.startDate || '', ranges.salesRange?.endDate || '');

  // 部門別にメンバーを振り分け
  state.personalMs.marketing.members = getMembersByDepartment(members, 'marketing');
  state.personalMs.cs.members = getMembersByDepartment(members, 'cs');
  state.personalMs.sales.members = getMembersByDepartment(members, 'sales');

  // 重要指標を取得してマッピング
  const deptKeys = ['cs', 'sales'];
  if (!state.personalMs.importantMetrics) state.personalMs.importantMetrics = {};
  deptKeys.forEach(deptKey => {
    state.personalMs.importantMetrics[deptKey] = {};
  });
  await Promise.all(deptKeys.map(async (deptKey) => {
    try {
      const items = await goalSettingsService.loadImportantMetrics({ departmentKey: deptKey, force: true });
      const map = {};
      (items || []).forEach(item => {
        const userId = String(item?.userId || item?.user_id || '');
        const metricKey = item?.metricKey || item?.metric_key || '';
        if (!userId || !metricKey) return;
        map[userId] = metricKey;
      });
      if (!state.personalMs.importantMetrics) state.personalMs.importantMetrics = {};
      state.personalMs.importantMetrics[deptKey] = map;
    } catch (error) {
      console.warn('[yield] failed to load important metrics', error);
    }
  }));

  // メンバー別の目標値をロード
  const loadPromises = [];
  deptKeys.forEach((deptKey) => {
    const metrics = getMetricsForDept(deptKey);
    const defaultMetricKey = metrics[0]?.key || '';
    const deptState = state.personalMs[deptKey];
    if (!deptState.metricKeys) deptState.metricKeys = {};
    deptState.msTargets = {};
    deptState.msTargetTotals = {};

    (deptState.members || []).forEach(member => {
      const memberId = String(member.id || '');
      if (!memberId) return;
      const important = state.personalMs?.importantMetrics?.[deptKey]?.[memberId];
      const validImportant = important && metrics.some(m => m.key === important) ? important : '';
      const selected = validImportant || deptState.metricKeys[memberId] || defaultMetricKey;
      if (!selected) return;
      deptState.metricKeys[memberId] = selected;
      loadPromises.push(loadPersonalMsTargetsForMember(deptKey, memberId, selected, periodId));
    });
  });

  await Promise.all(loadPromises);
  renderAllPersonalMsTables();
}



function buildCompanySalesHeaderRow(headerRow, dates) {
  if (!headerRow) return;
  const cells = dates.map(date => `<th scope="col">${formatDayLabel(date)}</th>`).join('');
  headerRow.innerHTML = `
    <th scope="col" class="kpi-v2-sticky-label">営業</th>
    <th scope="col" class="kpi-v2-sticky-label kpi-v2-ms-metric">指標</th>
    <th scope="col" class="daily-type">区分</th>
    ${cells}
  `;
}

function renderCompanySalesTable() {
  const headerRow = document.getElementById('companySalesHeaderRow');
  const body = document.getElementById('companySalesTableBody');
  if (!headerRow || !body) return;
  const dates = state.companySales.dates || [];
  const employees = state.companySales.employees || [];
  if (!dates.length || !employees.length) {
    headerRow.innerHTML = '';
    body.innerHTML = '';
    return;
  }
  buildCompanySalesHeaderRow(headerRow, dates);
  const optionsHtml = MS_METRIC_OPTIONS.map(option => `<option value="${option.key}">${option.label}</option>`).join('');
  const periodId = state.companyMsPeriodId;
  const rows = [];
  employees.forEach((employee, index) => {
    const employeeId = String(employee.id || '');
    if (!employeeId) return;
    const metricKey = state.companySales.metricKeys?.[employeeId] || MS_METRIC_OPTIONS[0]?.key;
    const metricOption = metricKey ? getMsMetricOption(metricKey) : null;
    const metricCell = `<th scope="row" class="kpi-v2-sticky-label kpi-v2-ms-metric" rowspan="3">
        <select class="kpi-v2-sort-select company-sales-metric-select" data-employee="${employeeId}">
          ${optionsHtml}
        </select>
      </th>`;
    const actualNumbers = [];
    const targetNumbers = [];
    const achvCells = [];
    let actualSum = 0;
    const series = periodId ? state.companyDailyData[employeeId]?.[periodId] || {} : {};
    const target = metricOption
      ? goalSettingsService.getPersonalPeriodTarget(periodId, employeeId)?.[metricOption.targetKey]
      : null;
    dates.forEach(date => {
      const raw = metricOption ? series?.[date]?.[metricOption.key] : null;
      actualSum += num(raw);
      actualNumbers.push(actualSum);
      const targetValue = target === undefined || target === null ? null : num(target);
      targetNumbers.push(targetValue);
      if (targetValue > 0) {
        const percent = Math.round((actualSum / targetValue) * 100);
        achvCells.push(formatAchievementCell(percent));
      } else {
        achvCells.push(formatAchievementCell(null));
      }
    });
    const tripletAlt = index % 2 === 1 ? 'daily-triplet-alt' : '';
    rows.push(
      buildDailyRow(
        `<th scope="row" class="kpi-v2-sticky-label" rowspan="3">${employee.name || `ID:${employeeId}`}</th>
         ${metricCell}
         <td class="daily-type">実績</td>`,
        actualNumbers.map(formatNumberCell),
        { rowClass: tripletAlt }
      )
    );
    rows.push(
      buildDailyRow(
        `<td class="daily-type">目標</td>`,
        targetNumbers.map(formatNumberCell),
        { rowClass: tripletAlt, cellClass: 'daily-muted' }
      )
    );
    rows.push(
      buildDailyRow(
        `<td class="daily-type">進捗率</td>`,
        achvCells,
        { rowClass: tripletAlt }
      )
    );
  });
  body.innerHTML = rows.join('');
  body.querySelectorAll('.company-sales-metric-select').forEach(select => {
    const employeeId = select.dataset.employee;
    if (!employeeId) return;
    select.value = state.companySales.metricKeys?.[employeeId] || MS_METRIC_OPTIONS[0]?.key;
    if (select.dataset.bound) return;
    select.addEventListener('change', handleCompanySalesMetricChange);
    select.dataset.bound = 'true';
  });
}

async function loadAndRenderCompanyMs() {
  const periodId = state.companyMsPeriodId;
  const period = state.evaluationPeriods.find(item => item.id === periodId);
  if (!period) {
    state.companyMs = {
      ...state.companyMs,
      dates: [],
      dailyTotals: {},
      companyTarget: {},
      msTargets: {},
      msTargetTotals: {},
      revenue: { actual: 0, target: 0 }
    };
    state.companySales = { ...state.companySales, dates: [], employees: [] };
    renderCompanyMsTable();
    renderCompanySalesTable();
    return;
  }
  state.companyMs.msTargets = {};
  state.companyMs.msTargetTotals = {};
  const ranges = resolveCompanyMsRanges(period);
  const msOverallRange = ranges.msOverallRange || ranges.salesRange;

  // Always update dates first so headers are correct even if API calls fail.
  state.companyMs = {
    ...state.companyMs,
    metricKeys: {
      marketing: state.companyMs.metricKeys?.marketing || getMetricsForDept('marketing')[0]?.key,
      cs: state.companyMs.metricKeys?.cs || getMetricsForDept('cs')[0]?.key,
      sales: state.companyMs.metricKeys?.sales || getMetricsForDept('sales')[0]?.key
    },
    dates: enumerateDateRange(msOverallRange.startDate, msOverallRange.endDate),
    marketingDates: enumerateDateRange(ranges.marketingRange?.startDate || '', ranges.msOverallRange?.endDate || ''),
    csDates: enumerateDateRange(ranges.csRange?.startDate || '', ranges.msOverallRange?.endDate || ''),
    salesDates: enumerateDateRange(ranges.salesRange?.startDate || '', ranges.msOverallRange?.endDate || ''),
    revenueDates: enumerateDateRange(ranges.revenueRange?.startDate || '', ranges.msOverallRange?.endDate || ''),
    dailyTotals: {},
    companyTarget: {},
    revenue: { actual: 0, target: 0 }
  };
  state.companySales = {
    ...state.companySales,
    dates: enumerateDateRange(ranges.salesRange.startDate, ranges.salesRange.endDate)
  };

  let payload;
  try {
    payload = await ensureDailyYieldData(periodId, { msMode: true });
  } catch (error) {
    console.warn('[yield] failed to load daily yield data for MS', error);
    renderCompanyMsTable();
    renderCompanySalesTable();
    return;
  }
  const advisors = await resolveAdvisorEmployees();
  const fallbackAdvisors = (payload?.employees || [])
    .map(emp => ({
      id: String(emp?.advisorUserId ?? ''),
      name: emp?.name || `ID:${emp?.advisorUserId}`
    }))
    .filter(item => item.id);
  const effectiveAdvisors = advisors.length ? advisors : fallbackAdvisors;
  const advisorIds = effectiveAdvisors.map(item => item.id).filter(id => id);
  const allEmployeeIds = (payload?.employees || [])
    .map(emp => String(emp?.advisorUserId ?? emp?.id ?? ''))
    .filter(id => id);
  const dailyTotalsFromPayload = payload?.employees?.length
    ? buildCompanyMsDailyTotalsFromEmployees(payload.employees, allEmployeeIds)
    : {};
  const fallbackIds = allEmployeeIds.length
    ? allEmployeeIds
    : getCompanyDailyEmployees().map(emp => String(emp?.id ?? '')).filter(id => id);
  const dailyTotals = Object.keys(dailyTotalsFromPayload).length
    ? dailyTotalsFromPayload
    : buildCompanyMsDailyTotals(periodId, fallbackIds);
  await goalSettingsService.loadCompanyPeriodTarget(periodId);
  const companyTarget = goalSettingsService.getCompanyPeriodTarget(periodId) || {};
  if (typeof goalSettingsService.loadPersonalPeriodTargetsBulk === 'function') {
    await goalSettingsService.loadPersonalPeriodTargetsBulk(periodId, advisorIds, { force: true });
  }
  let revenueActual = 0;
  if (ranges.revenueRange.startDate && ranges.revenueRange.endDate) {
    try {
      const revenueKpi = await fetchCompanyKpiFromApi({
        startDate: ranges.revenueRange.startDate,
        endDate: ranges.revenueRange.endDate,
        msMode: true
      });
      revenueActual = normalizeCounts(revenueKpi || {}).revenue;
    } catch (error) {
      console.warn('[yield] failed to load revenue for MS', error);
      revenueActual = 0;
    }
  }
  state.companyMs = {
    ...state.companyMs,
    dailyTotals,
    companyTarget,
    revenue: {
      actual: revenueActual,
      target: num(companyTarget.revenueTarget ?? 0)
    }
  };
  state.companySales = { ...state.companySales, employees: effectiveAdvisors };
  await loadCompanyMsTargets(periodId);
  renderCompanyMsTable();
  renderCompanySalesTable();
  await loadPersonalMsData();
}

function enumeratePeriodDates(period) {
  if (!period?.startDate || !period?.endDate) return [];
  const dates = [];
  const start = new Date(period.startDate);
  const end = new Date(period.endDate);
  if (Number.isNaN(start) || Number.isNaN(end)) return [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(isoDate(d));
  }
  return dates;
}

function getCompanySummaryRange() {
  const period = state.evaluationPeriods.find(item => item.id === state.companyEvaluationPeriodId);
  if (period?.startDate && period?.endDate) {
    return { startDate: period.startDate, endDate: period.endDate };
  }
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return { startDate: isoDate(startOfMonth), endDate: isoDate(today) };
}

async function loadEmployeeData(rangeFilters = {}) {
  try {
    const range = rangeFilters.startDate ? rangeFilters : state.ranges.employee.startDate ? state.ranges.employee : getCurrentMonthRange();
    state.ranges.employee = { ...range };
    const startInput = document.getElementById('employeeRangeStart');
    const endInput = document.getElementById('employeeRangeEnd');
    if (startInput && range.startDate) startInput.value = range.startDate;
    if (endInput && range.endDate) endInput.value = range.endDate;

    const todayStr = isoDate(new Date());
    const [items, plannedItems, members] = await Promise.all([
      fetchCompanyEmployeeKpis({ startDate: range.startDate, endDate: range.endDate }),
      fetchCompanyEmployeePlannedKpis({ baseDate: todayStr }),
      ensureMembersList()
    ]);
    const rows = mapEmployeeKpiItems(items);
    const plannedRows = mapEmployeeKpiItems(plannedItems);
    const plannedMap = new Map(
      plannedRows.map(row => [String(row?.advisorUserId ?? ''), row])
    );
    const advisorIdSet = new Set(
      (members || [])
        .filter(member => isAdvisorRole(member.role))
        .map(member => String(member.id))
    );
    const filteredRows = advisorIdSet.size
      ? rows.filter(row => advisorIdSet.has(String(row?.advisorUserId)))
      : rows;
    const enrichedRows = filteredRows.map(row => {
      const planned = plannedMap.get(String(row?.advisorUserId ?? '')) || {};
      return {
        ...row,
        plannedNewInterviews: num(planned.newInterviews),
        plannedProposals: num(planned.proposals),
        plannedRecommendations: num(planned.recommendations),
        plannedInterviewsScheduled: num(planned.interviewsScheduled),
        plannedInterviewsHeld: num(planned.interviewsHeld),
        plannedOffers: num(planned.offers),
        plannedAccepts: num(planned.accepts)
      };
    });
    state.employees.list = [...enrichedRows];
    renderEmployeeRows();
    return enrichedRows;
  } catch (error) {
    console.error('Failed to load employee data (api):', error);
    state.employees.list = [];
    renderEmployeeRows([]);
    return [];
  }
}

function normalizeCounts(src = {}) {
  if (src.revenue || src.currentAmount || src.fee_amount || src.offer_accept_date) console.log('[DEBUG] normalizeCounts src:', src);
  const revenue = num(src.revenue ?? src.currentAmount ?? src.revenueAmount ?? src.current_amount ?? src.revenue_amount);
  const targetAmount = num(src.targetAmount ?? src.revenueTarget ?? src.target_amount ?? src.revenue_target);
  const achievementRate = targetAmount > 0
    ? num(src.achievementRate) || Math.round((revenue / targetAmount) * 100)
    : num(src.achievementRate) || 0;
  return {
    newInterviews: num(src.newInterviews ?? src.new_interviews ?? src.proposals),
    proposals: num(src.proposals),
    recommendations: num(src.recommendations),
    interviewsScheduled: num(src.interviewsScheduled ?? src.interviews_scheduled),
    interviewsHeld: num(src.interviewsHeld ?? src.interviews_held),
    offers: num(src.offers),
    accepts: num(src.accepts ?? src.hires),
    hires: num(src.hires ?? src.accepts),
    revenue,
    currentAmount: revenue,
    targetAmount,
    achievementRate
  };
}


function calcRate(numerator, denominator) {
  const denom = num(denominator);
  if (denom <= 0) return 0;
  return Math.round((num(numerator) / denom) * 100);
}

function computeRateValues(counts = {}, mode = getRateCalcMode()) {
  const normalizedMode = normalizeRateCalcMode(mode);
  return RATE_CALC_STEPS.reduce((acc, step) => {
    const denomKey = normalizedMode === 'step' ? step.stepDenom : 'newInterviews';
    acc[step.rateKey] = calcRate(counts?.[step.numerator], counts?.[denomKey]);
    return acc;
  }, {});
}

function buildPrevCounts(prev = {}) {
  return {
    newInterviews: num(prev.prevNewInterviews),
    proposals: num(prev.prevProposals),
    recommendations: num(prev.prevRecommendations),
    interviewsScheduled: num(prev.prevInterviewsScheduled),
    interviewsHeld: num(prev.prevInterviewsHeld),
    offers: num(prev.prevOffers),
    accepts: num(prev.prevAccepts),
    hires: num(prev.prevAccepts)
  };
}

function computePrevRateValues(prevCounts = {}, mode = getRateCalcMode()) {
  const rates = computeRateValues(prevCounts, mode);
  return {
    prevProposalRate: rates.proposalRate,
    prevRecommendationRate: rates.recommendationRate,
    prevInterviewScheduleRate: rates.interviewScheduleRate,
    prevInterviewHeldRate: rates.interviewHeldRate,
    prevOfferRate: rates.offerRate,
    prevAcceptRate: rates.acceptRate,
    prevHireRate: rates.hireRate
  };
}

function normalizeRates(src = {}) {
  return {
    proposalRate: num(src.proposalRate),
    recommendationRate: num(src.recommendationRate),
    interviewScheduleRate: num(src.interviewScheduleRate),
    interviewHeldRate: num(src.interviewHeldRate),
    offerRate: num(src.offerRate),
    acceptRate: num(src.acceptRate),
    hireRate: num(src.hireRate ?? src.acceptRate)
  };
}

function normalizePrev(src = {}) {
  return {
    prevNewInterviews: num(src.prevNewInterviews),
    prevProposals: num(src.prevProposals),
    prevRecommendations: num(src.prevRecommendations),
    prevInterviewsScheduled: num(src.prevInterviewsScheduled),
    prevInterviewsHeld: num(src.prevInterviewsHeld),
    prevOffers: num(src.prevOffers),
    prevAccepts: num(src.prevAccepts),
    prevProposalRate: num(src.prevProposalRate),
    prevRecommendationRate: num(src.prevRecommendationRate),
    prevInterviewScheduleRate: num(src.prevInterviewScheduleRate),
    prevInterviewHeldRate: num(src.prevInterviewHeldRate),
    prevOfferRate: num(src.prevOfferRate),
    prevAcceptRate: num(src.prevAcceptRate),
    prevHireRate: num(src.prevHireRate)
  };
}

function normalizeKpi(src = {}) {
  const counts = normalizeCounts(src);
  const prev = normalizePrev(src);
  const computedRates = computeRateValues(counts, getRateCalcMode());
  const computedPrevRates = computePrevRateValues(buildPrevCounts(prev), getRateCalcMode());
  return {
    ...counts,
    ...normalizeRates(src),
    ...computedRates,
    ...prev,
    ...computedPrevRates
  };
}

function normalizeTodayKpi(data) {
  const todaySource = data?.today || data?.daily || null;
  const fallback = todaySource || data?.monthly || data || {};
  const prevSource = data?.period || data?.monthly || data || {};
  return { ...normalizeCounts(fallback), ...normalizePrev(prevSource) };
}

function updateEmployeeDisplay(rows) {
  const tableBody = document.getElementById('employeeTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = rows
    .map(employee => `
    <tr>
      <td>${employee.name || ''}</td>
      <td>${employee.newInterviews ?? ''}</td>
      <td>${employee.proposals ?? ''}</td>
      <td>${employee.recommendations ?? ''}</td>
      <td>${employee.interviewsScheduled ?? ''}</td>
      <td>${employee.interviewsHeld ?? ''}</td>
      <td>${employee.offers ?? ''}</td>
      <td>${employee.accepts ?? ''}</td>
      <td>${employee.proposalRate ?? ''}%</td>
      <td>${employee.recommendationRate ?? ''}%</td>
      <td>${employee.interviewScheduleRate ?? ''}%</td>
      <td>${employee.interviewHeldRate ?? ''}%</td>
      <td>${employee.offerRate ?? ''}%</td>
      <td>${employee.acceptRate ?? ''}%</td>
      <td>${employee.hireRate ?? ''}%</td>
      <td>${employee.plannedNewInterviews ?? ''}</td>
      <td>${employee.plannedProposals ?? ''}</td>
      <td>${employee.plannedRecommendations ?? ''}</td>
      <td>${employee.plannedInterviewsScheduled ?? ''}</td>
      <td>${employee.plannedInterviewsHeld ?? ''}</td>
      <td>${employee.plannedOffers ?? ''}</td>
      <td>${employee.plannedAccepts ?? ''}</td>
    </tr>
  `)
    .join('');
}

function filterAndSortEmployees(rows) {
  const searchTerm = state.employees.filters.search;
  let filtered = Array.isArray(rows) ? [...rows] : [];
  if (searchTerm) {
    filtered = filtered.filter(employee => (employee?.name || '').toLowerCase().includes(searchTerm));
  }
  const direction = state.employees.filters.sortOrder === 'asc' ? 1 : -1;
  filtered.sort((a, b) => {
    const aVal = a?.[state.employees.filters.sortKey];
    const bVal = b?.[state.employees.filters.sortKey];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal) * direction;
    }
    return (num(aVal) - num(bVal)) * direction;
  });
  return filtered;
}

function renderEmployeeRows(source = state.employees.list) {
  const rows = filterAndSortEmployees(source);
  updateEmployeeDisplay(rows);
}

function applyEmployeeSearch(rawValue) {
  state.employees.filters.search = (rawValue || '').trim().toLowerCase();
  renderEmployeeRows();
}

function handleEmployeeSort(event) {
  const raw = event.target.value || '';
  const [key, direction = 'desc'] = raw.split('-');
  if (!key) return;
  state.employees.filters.sortKey = key;
  state.employees.filters.sortOrder = direction === 'asc' ? 'asc' : 'desc';
  renderEmployeeRows();
}

function filterAndSortGeneric(rows, filters = {}) {
  let filtered = Array.isArray(rows) ? [...rows] : [];
  const searchTerm = (filters.search || '').toLowerCase();
  if (searchTerm) {
    filtered = filtered.filter(row => (row?.name || '').toLowerCase().includes(searchTerm));
  }
  const direction = filters.sortOrder === 'asc' ? 1 : -1;
  const key = filters.sortKey || 'name';
  filtered.sort((a, b) => {
    const aVal = a?.[key];
    const bVal = b?.[key];
    if (typeof aVal === 'string' || typeof bVal === 'string') {
      return (String(aVal || '') || '').localeCompare(String(bVal || '')) * direction;
    }
    return (num(aVal) - num(bVal)) * direction;
  });
  return filtered;
}

function formatAchvPercent(current, goal) {
  if (goal === null || goal === undefined) return { text: '--%', className: 'daily-muted' };
  if (!Number.isFinite(num(goal)) || num(goal) === 0) return { text: '--%', className: 'daily-muted' };
  const percent = Math.round((num(current) / num(goal)) * 100);
  const className = percent >= 100 ? 'daily-achv-high' : 'daily-achv-normal';
  return { text: `${percent}%`, className };
}

function displayGoal(value) {
  if (value === null || value === undefined) return '--';
  return num(value).toLocaleString();
}

function renderCompanyTodayTable() {
  const body = document.getElementById('companyTodayTableBody');
  if (!body) return;
  const rows = filterAndSortGeneric(state.companyToday.rows || [], state.companyToday.filters);
  body.innerHTML = rows
    .map(row => {
      const achv = key => {
        const meta = formatAchvPercent(row[key], row[`${key}Goal`]);
        return `<td class="${meta.className}">${meta.text}</td>`;
      };
      const renderCell = (key, labelGoal) => `
        <td class="term-count">${num(row[key]).toLocaleString()}</td>
        <td class="term-count term-goal">${displayGoal(row[labelGoal])}</td>
        ${achv(key)}
      `;
      return `
        <tr>
          <td>${row.name}</td>
          ${renderCell('newInterviews', 'newInterviewsGoal')}
          ${renderCell('proposals', 'proposalsGoal')}
          ${renderCell('recommendations', 'recommendationsGoal')}
          ${renderCell('interviewsScheduled', 'interviewsScheduledGoal')}
          ${renderCell('interviewsHeld', 'interviewsHeldGoal')}
          ${renderCell('offers', 'offersGoal')}
          ${renderCell('accepts', 'acceptsGoal')}
        </tr>
      `;
    })
    .join('');
}

function renderCompanyTermTables() {
  const body = document.getElementById('companyTermCombinedBody');
  if (!body) return;
  const rows = filterAndSortGeneric(state.companyTerm.rows || [], state.companyTerm.filters);
  body.innerHTML = rows
    .map(row => {
      const achv = key => {
        const meta = formatAchvPercent(row[key], row[`${key}Goal`]);
        return `<td class="${meta.className}">${meta.text}</td>`;
      };
      const renderCountCell = (key, goalKey) => `
        <td class="term-count">${num(row[key]).toLocaleString()}</td>
        <td class="term-count term-goal">${displayGoal(row[goalKey])}</td>
        ${achv(key)}
      `;
      const renderRateCell = (key, goalKey) => `
        <td class="term-rate">${num(row[key])}%</td>
        <td class="term-rate term-goal">${displayGoal(row[goalKey])}%</td>
        ${achv(key)}
      `;
      return `
        <tr>
          <td>${row.name}</td>
          ${renderCountCell('newInterviews', 'newInterviewsGoal')}
          ${renderCountCell('proposals', 'proposalsGoal')}
          ${renderCountCell('recommendations', 'recommendationsGoal')}
          ${renderCountCell('interviewsScheduled', 'interviewsScheduledGoal')}
          ${renderCountCell('interviewsHeld', 'interviewsHeldGoal')}
          ${renderCountCell('offers', 'offersGoal')}
          ${renderCountCell('accepts', 'acceptsGoal')}
          ${renderRateCell('hireRate', 'hireRateGoal')}
          ${renderRateCell('proposalRate', 'proposalRateGoal')}
          ${renderRateCell('recommendationRate', 'recommendationRateGoal')}
          ${renderRateCell('interviewScheduleRate', 'interviewScheduleRateGoal')}
          ${renderRateCell('interviewHeldRate', 'interviewHeldRateGoal')}
          ${renderRateCell('offerRate', 'offerRateGoal')}
          ${renderRateCell('acceptRate', 'acceptRateGoal')}
        </tr>
      `;
    })
    .join('');
}

function applyCompanyTodaySearch(rawValue) {
  state.companyToday.filters.search = (rawValue || '').trim().toLowerCase();
  renderCompanyTodayTable();
}

function applyCompanyTermSearch(rawValue) {
  state.companyTerm.filters.search = (rawValue || '').trim().toLowerCase();
  renderCompanyTermTables();
}

function handleCompanyTodaySort(event) {
  const raw = event.target.value || '';
  const [key, direction = 'asc'] = raw.split('-');
  if (!key) return;
  state.companyToday.filters.sortKey = key;
  state.companyToday.filters.sortOrder = direction === 'asc' ? 'asc' : 'desc';
  renderCompanyTodayTable();
}

function handleCompanyTermSort(event) {
  const raw = event.target.value || '';
  const [key, direction = 'asc'] = raw.split('-');
  if (!key) return;
  state.companyTerm.filters.sortKey = key;
  state.companyTerm.filters.sortOrder = direction === 'asc' ? 'asc' : 'desc';
  renderCompanyTermTables();
}

function handleCompanyMsMetricChange(event) {
  const next = event.target.value || '';
  const deptKey = event.target.dataset.dept;
  if (deptKey) {
    state.companyMs.metricKeys = {
      ...state.companyMs.metricKeys,
      [deptKey]: next
    };
  }
  if (deptKey && state.companyMsPeriodId) {
    loadCompanyMsTargets(state.companyMsPeriodId).then(() => {
      renderCompanyMsTable();
    });
  } else {
    renderCompanyMsTable();
  }
}

function handleCompanySalesMetricChange(event) {
  const next = event.target.value || '';
  const employeeId = event.target.dataset.employee;
  if (employeeId) {
    state.companySales.metricKeys = {
      ...state.companySales.metricKeys,
      [employeeId]: next
    };
  }
  renderCompanySalesTable();
}

function setCardAchievementProgress(achvElement, percentValue) {
  if (!achvElement) return;
  const card = achvElement.closest('.kpi-v2-card');
  if (!card) return;
  const normalized = Math.max(0, Math.min(num(percentValue), 100));
  card.style.setProperty('--achv-progress', `${normalized}%`);
}

function writeRateDetailInline(cardEl, labelA, valA, labelB, valB) {
  if (!cardEl) return;
  let subtext = cardEl.querySelector('.kpi-v2-subtext');
  if (!subtext) {
    subtext = document.createElement('div');
    subtext.className = 'kpi-v2-subtext';
    const valueEl = cardEl.querySelector('.kpi-v2-value');
    if (valueEl) {
      valueEl.insertAdjacentElement('afterend', subtext);
    } else {
      const meta = cardEl.querySelector('.kpi-v2-meta');
      if (meta) {
        meta.insertAdjacentElement('beforebegin', subtext);
      } else {
        cardEl.appendChild(subtext);
      }
    }
  }
  const modeLabel = getCalcModeLabel();
  const prefix = modeLabel ? `${modeLabel} ` : '';
  subtext.textContent = `${prefix}${labelA} ${num(valA)} / ${labelB} ${num(valB)}`;
}

function initializeKpiTabs() {
  const groups = document.querySelectorAll('.kpi-tab-group[data-kpi-tab-group]');
  groups.forEach(group => {
    const section = group.closest('.kpi-v2-section');
    if (!section) return;
    const tabs = Array.from(group.querySelectorAll('.kpi-tab[data-kpi-tab]'));
    const localPanels = Array.from(section.querySelectorAll('.kpi-tab-panel[data-kpi-tab-panel]'));
    const scope = group.dataset.kpiTabGroup || '';
    const scopedPanels = scope
      ? Array.from(document.querySelectorAll(`.kpi-tab-panel[data-kpi-tab-panel^="${scope}-"]`))
      : [];
    const panels = scopedPanels.length ? scopedPanels : localPanels;

    const activate = tabId => {
      tabs.forEach(btn => btn.classList.toggle('is-active', btn.dataset.kpiTab === tabId));
      panels.forEach(panel => {
        const isActive = panel.dataset.kpiTabPanel === tabId;
        panel.classList.toggle('is-active', isActive);
        panel.classList.toggle('is-hidden', !isActive);
        panel.style.display = isActive ? '' : 'none';
        panel.hidden = !isActive;
      });
      if (tabId.includes('graphs')) {
        // Trigger dashboard reload/resize to ensure charts render on visible canvas
        const scope = tabId.split('-')[0]; // 'personal' or 'company'
        if (scope && state.dashboard[scope]) {
          // Small delay to allow layout to settle
          setTimeout(() => reloadDashboardData(scope), 50);
        }
      }
    };

    tabs.forEach(btn => btn.addEventListener('click', () => activate(btn.dataset.kpiTab)));
    const initial = tabs.find(btn => btn.classList.contains('is-active')) || tabs[0];
    if (initial) activate(initial.dataset.kpiTab);
  });
}

function initializeEvaluationPeriods() {
  loadEvaluationPeriods();
  const personalSelect = document.getElementById('personalEvaluationPeriodSelect');
  const companySelect = document.getElementById('companyEvaluationPeriodSelect');
  personalSelect?.addEventListener('change', handlePersonalPeriodChange);
  companySelect?.addEventListener('change', handleCompanyPeriodChange);
  document.getElementById('personalDailyPeriodSelect')?.addEventListener('change', handlePersonalDailyPeriodChange);
  document.getElementById('companyDailyPeriodSelect')?.addEventListener('change', handleCompanyDailyPeriodChange);
  document.getElementById('companyDailyEmployeeSelect')?.addEventListener('change', handleCompanyDailyEmployeeChange);
  document.getElementById('companyTermPeriodSelect')?.addEventListener('change', handleCompanyTermPeriodChange);
  document.getElementById('companyMsPeriodSelect')?.addEventListener('change', handleCompanyMsPeriodChange);
  document.getElementById('personalMsPeriodSelect')?.addEventListener('change', handlePersonalMsPeriodChange);
}

function loadEvaluationPeriods() {
  state.evaluationPeriods = goalSettingsService.generateDefaultPeriods({ type: 'monthly' });
  goalSettingsService.setEvaluationPeriods(state.evaluationPeriods);
  const todayPeriodId = goalSettingsService.resolvePeriodIdByDate(
    isoDate(new Date()),
    state.evaluationPeriods
  );
  const first = state.evaluationPeriods[0];
  const hasPersonal = state.evaluationPeriods.some(period => period.id === state.personalEvaluationPeriodId);
  const hasCompany = state.evaluationPeriods.some(period => period.id === state.companyEvaluationPeriodId);
  const hasPersonalDaily = state.evaluationPeriods.some(period => period.id === state.personalDailyPeriodId);
  const hasCompanyDaily = state.evaluationPeriods.some(period => period.id === state.companyDailyPeriodId);
  const hasCompanyTerm = state.evaluationPeriods.some(period => period.id === state.companyTermPeriodId);
  const hasCompanyMs = state.evaluationPeriods.some(period => period.id === state.companyMsPeriodId);
  if (!hasPersonal && (todayPeriodId || first)) state.personalEvaluationPeriodId = todayPeriodId || first?.id || '';
  if (!hasCompany && (todayPeriodId || first)) state.companyEvaluationPeriodId = todayPeriodId || first?.id || '';
  if (!hasPersonalDaily && (todayPeriodId || first)) state.personalDailyPeriodId = todayPeriodId || first?.id || '';
  if (!hasCompanyDaily && (todayPeriodId || first)) state.companyDailyPeriodId = todayPeriodId || first?.id || '';
  if (!hasCompanyTerm && (todayPeriodId || first)) state.companyTermPeriodId = todayPeriodId || first?.id || '';
  if (!hasCompanyTerm && (todayPeriodId || first)) state.companyTermPeriodId = todayPeriodId || first?.id || '';
  if (!hasCompanyMs && (todayPeriodId || first)) state.companyMsPeriodId = todayPeriodId || first?.id || '';
  if (state.personalDailyPeriodId && !state.companyMsPeriodId) {
    state.companyMsPeriodId = state.personalDailyPeriodId;
  }
  const hasPersonalMs = state.evaluationPeriods.some(period => period.id === state.personalMsPeriodId);
  if (!hasPersonalMs && (todayPeriodId || first)) state.personalMsPeriodId = todayPeriodId || first?.id || '';
  ensureCompanyDailyEmployeeId();
  renderEvaluationSelectors();
  applyPersonalEvaluationPeriod(false);
}

function renderEvaluationSelectors() {
  const options = state.evaluationPeriods
    .map(period => `<option value="${period.id}">${formatPeriodMonthLabel(period)}</option>`)
    .join('');
  const personalSelect = document.getElementById('personalEvaluationPeriodSelect');
  const companySelect = document.getElementById('companyEvaluationPeriodSelect');
  const personalDailySelect = document.getElementById('personalDailyPeriodSelect');
  const companyDailySelect = document.getElementById('companyDailyPeriodSelect');
  const companyTermSelect = document.getElementById('companyTermPeriodSelect');

  const companyMsSelect = document.getElementById('companyMsPeriodSelect');
  const personalMsSelect = document.getElementById('personalMsPeriodSelect');
  if (personalSelect) {
    personalSelect.innerHTML = options;
    if (state.personalEvaluationPeriodId) personalSelect.value = state.personalEvaluationPeriodId;
  }
  if (companySelect) {
    companySelect.innerHTML = options;
    if (state.companyEvaluationPeriodId) companySelect.value = state.companyEvaluationPeriodId;
  }
  if (personalDailySelect) {
    personalDailySelect.innerHTML = options;
    if (state.personalDailyPeriodId) personalDailySelect.value = state.personalDailyPeriodId;
  }
  if (companyDailySelect) {
    companyDailySelect.innerHTML = options;
    if (state.companyDailyPeriodId) companyDailySelect.value = state.companyDailyPeriodId;
  }
  if (companyTermSelect) {
    companyTermSelect.innerHTML = options;
    if (state.companyTermPeriodId) companyTermSelect.value = state.companyTermPeriodId;
  }
  if (companyMsSelect) {
    companyMsSelect.innerHTML = options;
    if (state.companyMsPeriodId) companyMsSelect.value = state.companyMsPeriodId;
  }
  if (personalMsSelect) {
    personalMsSelect.innerHTML = options;
    if (state.personalMsPeriodId) personalMsSelect.value = state.personalMsPeriodId;
  }
  renderCompanyDailyEmployeeOptions();
  const companyDailyEmployeeSelect = document.getElementById('companyDailyEmployeeSelect');
  if (companyDailyEmployeeSelect && state.companyDailyEmployeeId) {
    companyDailyEmployeeSelect.value = state.companyDailyEmployeeId;
  }
  updatePersonalPeriodLabels();
  syncEvaluationPeriodLabels();
}

function renderCompanyDailyEmployeeOptions() {
  const select = document.getElementById('companyDailyEmployeeSelect');
  if (!select) return;
  const employees = getCompanyDailyEmployees();
  if (!employees.length) {
    select.innerHTML = '<option value="">社員が見つかりません</option>';
    return;
  }
  select.innerHTML = employees.map(emp => `<option value="${emp.id}">${emp.name}</option>`).join('');
  if (state.companyDailyEmployeeId) {
    select.value = state.companyDailyEmployeeId;
  }
  if (!select.value) {
    select.value = String(employees[0].id);
  }
  if (select.value !== state.companyDailyEmployeeId) {
    state.companyDailyEmployeeId = select.value;
  }
}

function initializeCompanyDailyEmployeeSelect() {
  renderCompanyDailyEmployeeOptions();
  const select = document.getElementById('companyDailyEmployeeSelect');
  if (select) {
    select.removeEventListener('change', handleCompanyDailyEmployeeChange);
    select.addEventListener('change', handleCompanyDailyEmployeeChange);
  }
}

function handlePersonalPeriodChange(event) {
  state.personalEvaluationPeriodId = event.target.value || '';
  applyPersonalEvaluationPeriod(true);
}

async function handleCompanyPeriodChange(event) {
  state.companyEvaluationPeriodId = event.target.value || '';
  await goalSettingsService.loadCompanyPeriodTarget(state.companyEvaluationPeriodId);
  renderCompanyTargets();
  loadCompanySummaryKPI();
}

async function handleCompanyTermPeriodChange(event) {
  state.companyTermPeriodId = event.target.value || '';
  await loadCompanyTermEmployeeKpi();
  renderCompanyTermTables();
}

async function handleCompanyMsPeriodChange(event) {
  state.companyMsPeriodId = event.target.value || '';
  await loadAndRenderCompanyMs();
}

async function handlePersonalMsPeriodChange(event) {
  state.personalMsPeriodId = event.target.value || '';
  await loadAndRenderPersonalMs();
}

function handlePersonalDailyPeriodChange(event) {
  state.personalDailyPeriodId = event.target.value || '';
  if (state.personalDailyPeriodId) {
    state.companyMsPeriodId = state.personalDailyPeriodId;
  }
  state.personalDisplayMode = 'monthly'; // Force daily mode when dropdown is used
  if (state.personalDailyMs) {
    state.personalDailyMs.targets = {};
    state.personalDailyMs.totals = {};
  }
  loadAndRenderPersonalDaily();
  loadAndRenderCompanyMs();
}

function handleCompanyDailyPeriodChange(event) {
  state.companyDailyPeriodId = event.target.value || '';
  loadAndRenderCompanyDaily();
}

function handleCompanyDailyEmployeeChange(event) {
  state.companyDailyEmployeeId = event.target.value || '';
  loadAndRenderCompanyDaily();
}

function syncPersonalRangeToEvaluationPeriod() {
  const period = state.evaluationPeriods.find(item => item.id === state.personalEvaluationPeriodId);
  if (!period?.startDate || !period?.endDate) return;
  const startInput = document.getElementById('personalRangeStart');
  const endInput = document.getElementById('personalRangeEnd');
  if (startInput) startInput.value = period.startDate;
  if (endInput) endInput.value = period.endDate;
  state.ranges.personalPeriod = { startDate: period.startDate, endDate: period.endDate };
}

function applyPersonalEvaluationPeriod(shouldReload = true) {
  state.personalDisplayMode = 'monthly';
  seedGoalDefaultsFromSettings();
  initGoalInputs('today');
  initGoalInputs('monthly');
  refreshAchievements('today');
  refreshAchievements('monthly');
  updatePersonalPeriodLabels();
  syncEvaluationPeriodLabels();
  if (shouldReload) {
    loadYieldData();
    loadAndRenderPersonalDaily();
  }
}


function getPersonalSummaryTitleText() {
  const period = state.evaluationPeriods.find(item => item.id === state.personalEvaluationPeriodId);
  const labelText = formatPeriodMonthLabel(period);
  return labelText ? `${labelText}の実績サマリー` : '今月の実績サマリー';
}

function updatePersonalPeriodLabels() {
  const dailyPeriod = state.evaluationPeriods.find(item => item.id === state.personalDailyPeriodId);
  const titleEl = document.getElementById('personalSummaryTitle');
  const dailyLabel = document.getElementById('personalDailyPeriodLabel');
  if (titleEl) titleEl.textContent = getPersonalSummaryTitleText();
  if (dailyLabel) {
    dailyLabel.textContent = dailyPeriod
      ? `評価期間：${formatPeriodMonthLabel(dailyPeriod) || '--'}`
      : '評価期間：-';
  }
}


function syncEvaluationPeriodLabels() {
  const dailyPeriod = state.evaluationPeriods.find(item => item.id === state.personalDailyPeriodId);
  const titleEl = document.getElementById('personalSummaryTitle');
  const dailyLabel = document.getElementById('personalDailyPeriodLabel');
  if (titleEl) {
    titleEl.textContent = getPersonalSummaryTitleText();
  }
  if (dailyLabel) {
    dailyLabel.textContent = dailyPeriod
      ? `評価期間：${formatPeriodMonthLabel(dailyPeriod) || '--'}`
      : '評価期間：-';
  }
}

function getCompanySummaryTitleText() {
  const period = state.evaluationPeriods.find(item => item.id === state.companyEvaluationPeriodId);
  const labelText = formatPeriodMonthLabel(period);
  return labelText ? `${labelText}の実績サマリー` : '今月の実績サマリー';
}


function ensureChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (!chartJsPromise) {
    chartJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.async = true;
      script.onload = () => resolve(window.Chart);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return chartJsPromise;
}

async function initializeDashboardSection() {
  const panels = Array.from(document.querySelectorAll('.dashboard-panel[data-dashboard-scope]'));
  const scopes = Array.from(new Set(panels.map(panel => panel.dataset.dashboardScope).filter(scope => scope && state.dashboard[scope])));
  if (!scopes.length) return;

  ensureChartJs()
    .then(() => {
      scopes.forEach(scope => {
        setupDashboardControls(scope);
        reloadDashboardData(scope);
      });
    })
    .catch(error => console.error('[yield] failed to load Chart.js', error));
}

async function reloadDashboardData(scope) {
  const range = getDashboardRange(scope);
  const advisorUserId = scope === 'personal' ? await resolveAdvisorUserId() : null;
  const granularity = getDashboardTrendGranularity(scope);
  try {
    const [trend, job, gender, age, media] = await Promise.all([
      fetchYieldTrendFromApi({
        startDate: range.startDate,
        endDate: range.endDate,
        scope,
        advisorUserId,
        granularity
      }),
      fetchYieldBreakdownFromApi({
        startDate: range.startDate,
        endDate: range.endDate,
        scope,
        advisorUserId,
        dimension: 'job'
      }),
      fetchYieldBreakdownFromApi({
        startDate: range.startDate,
        endDate: range.endDate,
        scope,
        advisorUserId,
        dimension: 'gender'
      }),
      fetchYieldBreakdownFromApi({
        startDate: range.startDate,
        endDate: range.endDate,
        scope,
        advisorUserId,
        dimension: 'age'
      }),
      scope === 'company'
        ? fetchYieldBreakdownFromApi({
          startDate: range.startDate,
          endDate: range.endDate,
          scope,
          dimension: 'media'
        })
        : Promise.resolve(null)
    ]);

    state.dashboard[scope].trendData = trend;
    state.dashboard[scope].breakdown = {
      jobCategories: job,
      gender,
      ageGroups: age,
      ...(scope === 'company' ? { mediaSources: media } : {})
    };
    renderDashboardCharts(scope);
  } catch (error) {
    console.error('[yield] failed to reload dashboard data:', error);
  }
}

function setupDashboardControls(scope) {
  populateDashboardSelects(scope);
  const tabGroup = document.querySelector(`[data-trend-tabs="${scope}"]`);
  tabGroup?.querySelectorAll('.dashboard-tab').forEach(button => {
    button.addEventListener('click', () => {
      if (button.classList.contains('is-active')) return;
      tabGroup.querySelectorAll('.dashboard-tab').forEach(btn => btn.classList.remove('is-active'));
      button.classList.add('is-active');
      state.dashboard[scope].trendMode = button.dataset.mode === 'year' ? 'year' : 'month';
      updateTrendSelectState(scope);
      reloadDashboardData(scope);
    });
  });

  const yearSelect = document.getElementById(`${scope}TrendYearSelect`);
  const monthSelect = document.getElementById(`${scope}TrendMonthSelect`);
  yearSelect?.addEventListener('change', () => {
    const selectedYear = Number(yearSelect.value) || state.dashboard[scope].year;
    state.dashboard[scope].year = selectedYear;
    reloadDashboardData(scope);
  });
  monthSelect?.addEventListener('change', () => {
    const selectedMonth = Number(monthSelect.value) || state.dashboard[scope].month;
    state.dashboard[scope].month = selectedMonth;
    if (state.dashboard[scope].trendMode === 'month') reloadDashboardData(scope);
  });
  updateTrendSelectState(scope);
}

function populateDashboardSelects(scope) {
  const yearSelect = document.getElementById(`${scope}TrendYearSelect`);
  const monthSelect = document.getElementById(`${scope}TrendMonthSelect`);
  if (yearSelect) {
    yearSelect.innerHTML = DASHBOARD_YEARS.map(year => `<option value="${year}">${year}年</option>`).join('');
    yearSelect.value = `${state.dashboard[scope].year}`;
  }
  if (monthSelect) {
    monthSelect.innerHTML = DASHBOARD_MONTHS.map(month => `<option value="${month}">${String(month).padStart(2, '0')}月</option>`).join('');
    monthSelect.value = `${state.dashboard[scope].month}`;
  }
}

function updateTrendSelectState(scope) {
  const monthSelect = document.getElementById(`${scope}TrendMonthSelect`);
  if (!monthSelect) return;
  const isMonthly = state.dashboard[scope].trendMode === 'month';
  monthSelect.disabled = !isMonthly;
  monthSelect.parentElement?.classList.toggle('is-disabled', !isMonthly);
}

function renderDashboardCharts(scope) {
  renderTrendChart(scope);
  renderCategoryChart({ scope, chartId: `${scope}JobChart`, datasetKey: 'jobCategories', type: 'bar' });
  renderCategoryChart({ scope, chartId: `${scope}GenderChart`, datasetKey: 'gender', type: 'doughnut' });
  renderCategoryChart({ scope, chartId: `${scope}AgeChart`, datasetKey: 'ageGroups', type: 'bar' });
  if (scope === 'company') {
    renderCategoryChart({ scope, chartId: 'companyMediaChart', datasetKey: 'mediaSources', type: 'bar' });
  }
}

function renderTrendChart(scope) {
  const canvas = document.getElementById(`${scope}TrendChart`);
  if (!canvas || !window.Chart) return;

  const trendCard = canvas.closest('.dashboard-card');
  if (trendCard) {
    trendCard.style.gridColumn = scope === 'company' ? '1 / -1' : 'span 2';
    trendCard.style.minHeight = scope === 'company' ? '480px' : '420px';
  }
  const chartWrap = canvas.closest('.dashboard-chart');
  if (chartWrap) {
    chartWrap.style.height = scope === 'company' ? '400px' : '360px';
    chartWrap.style.minHeight = scope === 'company' ? '400px' : '360px';
  }
  destroyChart(scope, `${scope}TrendChart`);
  const config = buildTrendChartConfig(scope);
  state.dashboard[scope].charts[`${scope}TrendChart`] = new Chart(canvas, {
    type: 'line',
    data: config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true } } },
      scales: { y: { beginAtZero: true, ticks: { callback: value => `${value}%` }, suggestedMax: 100 } }
    }
  });
}

function renderCategoryChart({ scope, chartId, datasetKey, type }) {
  const canvas = document.getElementById(chartId);
  if (!canvas || !window.Chart) return;

  const breakdown = state.dashboard[scope]?.breakdown;
  let dataset = null;
  if (breakdown && breakdown[datasetKey]) {
    dataset = breakdown[datasetKey];
  } else {
    dataset = mockDashboardData[scope]?.[datasetKey];
  }

  if (!dataset || !Array.isArray(dataset.labels) || !Array.isArray(dataset.data)) {
    return;
  }

  destroyChart(scope, chartId);
  const colors = getChartColors(dataset.labels.length, type === 'doughnut' ? 0.9 : 0.25);
  const data = {
    labels: dataset.labels,
    datasets: [
      {
        label: '人数',
        data: dataset.data,
        backgroundColor: colors.background,
        borderColor: colors.border,
        borderWidth: type === 'doughnut' ? 1 : 1.5,
        hoverOffset: type === 'doughnut' ? 8 : undefined
      }
    ]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: type === 'doughnut' ? {} : { x: { ticks: { font: { size: 11 } } }, y: { beginAtZero: true } }
  };
  state.dashboard[scope].charts[chartId] = new Chart(canvas, {
    type,
    data,
    options: type === 'doughnut' ? { ...options, cutout: '55%' } : options
  });
}

function buildTrendChartConfig(scope) {
  const current = state.dashboard[scope];
  const trend = current.trendData;

  let labels = [];
  let series = null;

  if (trend && Array.isArray(trend.labels) && Array.isArray(trend.rates) && trend.labels.length) {
    labels = trend.labels;
    series = trend.rates;
  } else {
    const fallbackLabels =
      current.trendMode === 'month'
        ? createTrendDayLabels(current.year, current.month)
        : DASHBOARD_MONTHS.map(month => `${month}月`);
    labels = fallbackLabels;
  }

  const keyMap = {
    提案率: 'proposalRate',
    推薦率: 'recommendationRate',
    面接設定率: 'interviewScheduleRate',
    面接実施率: 'interviewHeldRate',
    内定率: 'offerRate',
    承諾率: 'acceptRate',
    入社決定率: 'hireRate'
  };

  const datasets = RATE_KEYS.map((label, idx) => {
    let data = [];

    if (series) {
      const key = keyMap[label] || null;
      if (key) {
        data = series.map(row => Number(row[key] || 0));
      } else {
        data = series.map(() => 0);
      }
    } else {
      data = labels.map((_, index) => generateRateValue(scope, label, current.trendMode, index, idx));
    }

    return {
      label,
      data,
      borderColor: DASHBOARD_COLORS[idx % DASHBOARD_COLORS.length],
      backgroundColor: hexToRgba(DASHBOARD_COLORS[idx % DASHBOARD_COLORS.length], 0.15),
      tension: 0.35,
      fill: false,
      pointRadius: 2,
      pointHoverRadius: 4
    };
  });

  return { labels, datasets };
}

function generateRateValue(scope, label, mode, index, seed) {
  const base = mockDashboardData[scope].baseRates[label] || 50;
  const amplitude = mode === 'month' ? 6 : 4;
  const noise = Math.sin((index + seed) / 2) * amplitude;
  const seasonal = mode === 'month' ? (index % 4) - 2 : seed - 2;
  return Math.max(5, Math.min(100, Math.round(base + noise + seasonal)));
}

function getChartColors(count, alpha) {
  const background = [];
  const border = [];
  for (let i = 0; i < count; i += 1) {
    const color = DASHBOARD_COLORS[i % DASHBOARD_COLORS.length];
    border.push(color);
    background.push(hexToRgba(color, alpha));
  }
  return { background, border };
}

function createTrendDayLabels(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  return Array.from({ length: lastDay }, (_, idx) => `${idx + 1}日`);
}

function destroyChart(scope, key) {
  const charts = state.dashboard[scope].charts;
  if (charts[key]) {
    charts[key].destroy();
    delete charts[key];
  }
}

function hexToRgba(hex, alpha) {
  const sanitized = hex.replace('#', '');
  const bigint = parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isValidRange(range) {
  if (!range.startDate || !range.endDate) return false;
  return new Date(range.startDate) <= new Date(range.endDate);
}

function resolvePeriodEndById(periodId) {
  if (!periodId) return null;
  const period = state.evaluationPeriods.find(p => p.id === periodId);
  if (!period?.endDate) return null;
  const end = new Date(period.endDate);
  return Number.isNaN(end.getTime()) ? null : end;
}

function resolveDeptStartDate(periodId, deptKey) {
  const end = resolvePeriodEndById(periodId);
  if (!end) return null;
  const year = end.getFullYear();
  const month = end.getMonth();
  switch (deptKey) {
    case 'marketing':
      return new Date(year, month - 1, 17);
    case 'cs':
    case 'sales':
      return new Date(year, month - 1, 18);
    case 'revenue':
      return new Date(year, month, 1);
    default:
      return new Date(year, month, 1);
  }
}

function resolveDeptEndDate(periodId, deptKey) {
  const end = resolvePeriodEndById(periodId);
  if (!end) return null;
  const year = end.getFullYear();
  const month = end.getMonth();
  switch (deptKey) {
    case 'marketing':
      return new Date(year, month, 19);
    case 'cs':
      return new Date(year, month, 20);
    case 'sales':
      return new Date(year, month, 19);
    case 'revenue':
      return new Date(year, month + 1, 0);
    default:
      return new Date(year, month + 1, 0);
  }
}

function isDateBeforeDeptStartForPeriod(date, deptKey, periodId) {
  const startDate = resolveDeptStartDate(periodId, deptKey);
  if (!startDate) return false;
  const dateObj = parseLocalDate(date);
  if (!dateObj) return false;
  return dateObj < startDate;
}

function isDateAfterDeptEndForPeriod(date, deptKey, periodId) {
  const endDate = resolveDeptEndDate(periodId, deptKey);
  if (!endDate) return false;
  const dateObj = parseLocalDate(date);
  if (!dateObj) return false;
  return dateObj > endDate;
}

function isDateBeforePersonalDeptStart(date, deptKey, periodId = state.personalMsPeriodId) {
  return isDateBeforeDeptStartForPeriod(date, deptKey, periodId);
}

function isDateAfterPersonalDeptEnd(date, deptKey, periodId = state.personalMsPeriodId) {
  return isDateAfterDeptEndForPeriod(date, deptKey, periodId);
}

function resolvePersonalDailyDateRange(periodId, deptKey) {
  const end = resolvePeriodEndById(periodId);
  if (!end) return { startDate: '', endDate: '' };
  const revenueStart = new Date(end.getFullYear(), end.getMonth(), 1);
  const revenueEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0);
  const deptStart = resolveDeptStartDate(periodId, deptKey) || revenueStart;
  const deptEnd = resolveDeptEndDate(periodId, deptKey) || revenueEnd;
  const start = deptStart < revenueStart ? deptStart : revenueStart;
  const finish = deptEnd > revenueEnd ? deptEnd : revenueEnd;
  return { startDate: isoDate(start), endDate: isoDate(finish) };
}

function buildAdvisorMsHeaderRow(headerRow, dates) {
  if (!headerRow) return;
  const dateCells = dates.map(date => {
    const dayLabel = formatDayLabel(date);
    return `<th scope="col" colspan="2" class="ms-date-header">${dayLabel}</th>`;
  }).join('');

  const subHeaderCells = dates.map(() => `
    <th scope="col" class="ms-sub-header">MS</th>
    <th scope="col" class="ms-sub-header">進捗率</th>
  `).join('');

  headerRow.innerHTML = `
    <th scope="col" class="kpi-v2-sticky-label" rowspan="2" style="min-width: 180px; z-index: 10;">
       <div style="text-align: center;">メンバー・指標</div>
    </th>
    ${dateCells}
  `;

  // Clear existing subheaders more aggressively
  let nextRow = headerRow.nextElementSibling;
  while (nextRow && nextRow.classList.contains('ms-subheader-row')) {
    nextRow.remove();
    nextRow = headerRow.nextElementSibling;
  }

  // Create and append subheader
  const subHeaderRow = document.createElement('tr');
  subHeaderRow.classList.add('ms-subheader-row');
  subHeaderRow.innerHTML = subHeaderCells;
  headerRow.parentElement?.appendChild(subHeaderRow);
}

async function loadAndRenderPersonalMs() {
  const periodId = state.personalMsPeriodId;
  const period = state.evaluationPeriods.find(item => item.id === periodId);
  if (!period) {
    state.personalMs = { ...state.personalMs, dates: [], dailyTotals: {}, companyTarget: {}, revenue: { actual: 0, target: 0 } };
    renderAdvisorMsTable();
    return;
  }
  const ranges = resolveCompanyMsRanges(period);
  const [payload, members] = await Promise.all([
    ensureDailyYieldData(periodId, { msMode: true }),
    ensureMembersList()
  ]);

  const myUserId = resolveAdvisorUserId();
  const myEmployee = payload?.employees?.find(e => String(e.advisorUserId) === String(myUserId));
  const myMemberInfo = members.find(m => String(m.id) === String(myUserId));
  const advisorIds = myEmployee ? [String(myUserId)] : [];

  const dailyTotals = myEmployee
    ? buildCompanyMsDailyTotalsFromEmployees([myEmployee], advisorIds)
    : {};

  const userRole = myMemberInfo?.role || myEmployee?.role || '';

  const msOverallRange = ranges.msOverallRange || ranges.salesRange;

  state.personalMs = {
    ...state.personalMs,
    metricKeys: state.personalMs.metricKeys || {
      marketing: MS_METRIC_OPTIONS[0]?.key,
      cs: MS_METRIC_OPTIONS[0]?.key,
      sales: MS_METRIC_OPTIONS[0]?.key
    },
    dates: enumerateDateRange(msOverallRange.startDate, msOverallRange.endDate),
    dailyTotals,
    msTargets: state.personalMs.msTargets || {},
    dailyTotals,
    msTargets: state.personalMs.msTargets || {},
    revenue: { actual: 0, target: 0 },
    userName: myEmployee?.name || myMemberInfo?.name || '自分',
    userRole: userRole
  };

  renderAdvisorMsTable();
}

function renderAdvisorMsTable() {
  const headerRow = document.getElementById('personalMsHeaderRow');
  const body = document.getElementById('personalMsTableBody');
  if (!headerRow || !body) return;

  const dates = state.personalMs.dates || [];
  if (!dates.length) {
    headerRow.innerHTML = '';
    body.innerHTML = '';
    return;
  }

  // Clean up subheader
  const thead = headerRow.parentElement;
  if (thead) {
    while (thead.rows.length > 1) {
      thead.deleteRow(1);
    }
  }

  buildAdvisorMsHeaderRow(headerRow, dates);
  const rows = [];
  const userRole = state.personalMs.userRole || '';

  // Filter departments based on role
  // Rule: Marketing -> ['marketing', 'revenue']
  //       CS -> ['cs', 'revenue']
  //       Sales -> ['sales', 'revenue']
  //       Others -> All

  let targetDepts = MS_DEPARTMENTS;
  if (userRole) {
    const roleLower = String(userRole).toLowerCase();
    if (roleLower.includes('marketing') || roleLower.includes('マーケ')) {
      targetDepts = MS_DEPARTMENTS.filter(d => d.key === 'marketing' || d.key === 'revenue');
    } else if (roleLower.includes('cs') || roleLower.includes('カスタマー')) {
      targetDepts = MS_DEPARTMENTS.filter(d => d.key === 'cs' || d.key === 'revenue');
    } else if (roleLower.includes('sales') || roleLower.includes('営業') || roleLower.includes('advisor') || roleLower.includes('アドバイザー')) {
      // Advisor is usually Sales in this context? Assuming Sales.
      targetDepts = MS_DEPARTMENTS.filter(d => d.key === 'sales' || d.key === 'revenue');
    }
  }

  targetDepts.forEach((dept) => {
    const isRevenue = dept.key === 'revenue';
    const deptMetrics = getMetricsForDept(dept.key);

    let metricKey = state.personalMs.metricKeys?.[dept.key];
    if (!metricKey && deptMetrics.length > 0) {
      metricKey = deptMetrics[0].key;
      if (!state.personalMs.metricKeys) state.personalMs.metricKeys = {};
      state.personalMs.metricKeys[dept.key] = metricKey;
    }

    const metricOption = metricKey ? deptMetrics.find(m => m.key === metricKey) : null;
    const metricLabel = isRevenue ? '売上' : metricOption?.label || '';

    const optionsHtml = deptMetrics.map(option =>
      `<option value="${option.key}" ${option.key === metricKey ? 'selected' : ''}>${option.label}</option>`
    ).join('');

    const userName = state.personalMs.userName || '自分';
    const metricCell = isRevenue
      ? `<th scope="row" class="kpi-v2-sticky-label kpi-v2-ms-metric" rowspan="1" style="min-width: 180px; z-index: 10;">
             <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
               <span style="font-weight: bold; font-size: 0.9em; color: #333;">${userName}</span>
               <span style="font-size: 0.85em; color: #666;">${metricLabel}</span>
             </div>
         </th>`
      : `<th scope="row" class="kpi-v2-sticky-label kpi-v2-ms-metric" rowspan="1" style="min-width: 180px; z-index: 10;">
           <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
             <span style="font-weight: bold; font-size: 0.9em; color: #333;">${userName}</span>
             <select class="kpi-v2-sort-select personal-ms-metric-select" data-dept="${dept.key}" style="width: 100%;">
               ${optionsHtml}
             </select>
           </div>
         </th>`;

    const msAndRateCells = dates.map(date => {
      // Use Personal version of date checks
      const isDisabled = isDateBeforePersonalDeptStart(date, dept.key) || isDateAfterPersonalDeptEnd(date, dept.key);
      if (isDisabled) return '<td class="ms-cell-disabled"></td><td class="ms-cell-disabled"></td>';

      const savedMs = state.personalMs.msTargets?.[dept.key]?.[date] || '';
      const actual = isRevenue
        ? 0
        : (state.personalMs.dailyTotals?.[date]?.[metricOption?.key] || 0);

      let rateDisplay = '-';
      let rateClass = '';
      if (savedMs && Number(savedMs) > 0) {
        const rate = Math.round((actual / Number(savedMs)) * 100);
        rateDisplay = `${rate}%`;
        rateClass = rate >= 100 ? 'ms-rate-good' : rate >= 80 ? 'ms-rate-warn' : 'ms-rate-bad';
      }

      return `
            <td class="ms-target-cell">
               <input type="number" class="ms-target-input is-readonly" readonly value="${savedMs}">
            </td>
            <td class="ms-actual-cell">
               <div class="ms-actual-value">${formatNumberCell(actual)}</div>
               <div class="ms-progress-rate ${rateClass}">${rateDisplay}</div>
            </td>
        `;
    }).join('');

    rows.push(`
      <tr class="ms-metric-row">
        ${metricCell}
        ${msAndRateCells}
      </tr>
    `);
  });

  body.innerHTML = rows.join('');

  body.querySelectorAll('.personal-ms-metric-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const key = e.target.getAttribute('data-dept');
      if (state.personalMs.metricKeys) {
        state.personalMs.metricKeys[key] = e.target.value;
        renderAdvisorMsTable();
      }
    });
  });
}
