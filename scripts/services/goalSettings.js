const STORAGE_KEY = 'goalSettings.v1';
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

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function readState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch (error) {
    console.warn('[goalSettingsService] failed to parse storage', error);
    return {};
  }
}

function writeState(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

function padMonth(value) {
  return String(value).padStart(2, '0');
}

function buildDefaultPeriods(ruleInput) {
  const rule = normalizeRule(ruleInput);
  switch (rule.type) {
    case 'half-month':
      return buildHalfMonthPeriods();
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
  const dayOffset = startWeekday === 'sunday' ? 0 : 1; // Sunday=0, Monday=1
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

function ensureState() {
  const data = readState();
  data.evaluationRule = normalizeRule(data.evaluationRule);
  if (!Array.isArray(data.evaluationPeriods) || data.evaluationPeriods.length === 0) {
    data.evaluationPeriods = buildDefaultPeriods(data.evaluationRule);
  }
  data.company = data.company || {};
  data.company.periodTargets = data.company.periodTargets || {};
  data.personal = data.personal || {};
  data.personal.periodTargets = data.personal.periodTargets || {};
  data.personal.dailyTargets = data.personal.dailyTargets || {};
  return writeState(data);
}

function normalizeTarget(raw = {}) {
  return KPI_TARGET_KEYS.reduce((acc, key) => {
    const value = Number(raw[key]);
    acc[key] = Number.isFinite(value) ? value : 0;
    return acc;
  }, {});
}

function getDailyTargetsForPeriod(data, periodId) {
  const store = data.personal?.dailyTargets || {};
  return store[periodId] || {};
}

function setDailyTargetsForPeriod(data, periodId, dailyTargets) {
  if (!data.personal) data.personal = {};
  if (!data.personal.dailyTargets) data.personal.dailyTargets = {};
  data.personal.dailyTargets[periodId] = dailyTargets;
  return data.personal.dailyTargets[periodId];
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

export const goalSettingsService = {
  getEvaluationRule() {
    return ensureState().evaluationRule;
  },
  setEvaluationRule(rule) {
    const nextRule = normalizeRule(rule);
    const data = ensureState();
    data.evaluationRule = nextRule;
    data.evaluationPeriods = buildDefaultPeriods(nextRule);
    return writeState(data).evaluationRule;
  },
  getEvaluationPeriods() {
    const data = ensureState();
    return Array.isArray(data.evaluationPeriods) ? data.evaluationPeriods : [];
  },
  setEvaluationPeriods(periods = []) {
    const data = ensureState();
    data.evaluationPeriods = Array.isArray(periods) ? periods : [];
    return writeState(data).evaluationPeriods;
  },
  getCompanyPeriodTarget(periodId) {
    const data = ensureState();
    return data.company?.periodTargets?.[periodId] || null;
  },
  saveCompanyPeriodTarget(periodId, target = {}) {
    if (!periodId) return null;
    const data = ensureState();
    if (!data.company) data.company = {};
    if (!data.company.periodTargets) data.company.periodTargets = {};
    data.company.periodTargets[periodId] = normalizeTarget(target);
    writeState(data);
    return data.company.periodTargets[periodId];
  },
  getPersonalPeriodTarget(periodId) {
    const data = ensureState();
    return data.personal?.periodTargets?.[periodId] || null;
  },
  savePersonalPeriodTarget(periodId, target = {}) {
    if (!periodId) return null;
    const data = ensureState();
    if (!data.personal) data.personal = {};
    if (!data.personal.periodTargets) data.personal.periodTargets = {};
    data.personal.periodTargets[periodId] = normalizeTarget(target);
    writeState(data);
    return data.personal.periodTargets[periodId];
  },
  getPersonalDailyTargets(periodId) {
    const data = ensureState();
    return getDailyTargetsForPeriod(data, periodId);
  },
  savePersonalDailyTargets(periodId, dailyTargets = {}) {
    if (!periodId) return {};
    const data = ensureState();
    const normalized = {};
    Object.entries(dailyTargets || {}).forEach(([date, target]) => {
      normalized[date] = normalizeTarget(target || {});
    });
    setDailyTargetsForPeriod(data, periodId, normalized);
    writeState(data);
    return normalized;
  },
  getPeriodByDate(dateStr, periods) {
    const data = ensureState();
    return getPeriodByDate(dateStr, periods || data.evaluationPeriods);
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
  }
};

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
        : legacy;
  return { type: mapped || 'monthly', options: {} };
}

export default goalSettingsService;
