// Yield Page JavaScript Module (simplified)
import { RepositoryFactory } from '../../scripts/api/index.js';
import { hasRole, getSession } from '../../scripts/auth.js';
import { mockUsers } from '../../scripts/mock/users.js';
// 例: 実際のパスに合わせてください
import { getMockCandidates } from '../../scripts/mock/candidates.js';
import { goalSettingsService } from '../../scripts/services/goalSettings.js';
import {
  buildPersonalKpiFromCandidates,
  buildCompanyKpiFromCandidates,
  buildDailyMetricsFromCandidates,
  buildEmployeeKpiFromCandidates,
  buildGenderAndAgeBreakdownFromCandidates,
  buildTrendRatesFromCandidates
} from './yield-metrics-from-candidates.js';

const repositories = RepositoryFactory.create();
const kpiRepository = repositories.kpi;

// API接続設定（仮のユーザーIDを使用）
const KPI_API_BASE = 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev/kpi';
const KPI_PERSONAL_PATH = '/yield/personal';
const KPI_COMPANY_PATH = '/yield/company';
const DEFAULT_ADVISOR_USER_ID = 2;

async function fetchJson(url, params = {}) {
  const query = new URLSearchParams(params);
  const res = await fetch(`${url}?${query.toString()}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function fetchPersonalKpiFromApi({ startDate, endDate }) {
  const advisorUserId = DEFAULT_ADVISOR_USER_ID;
  const json = await fetchJson(`${KPI_API_BASE}${KPI_PERSONAL_PATH}`, {
    from: startDate,
    to: endDate,
    advisorUserId
  });
  return json?.kpi || null;
}

async function fetchCompanyKpiFromApi({ startDate, endDate }) {
  const json = await fetchJson(`${KPI_API_BASE}${KPI_COMPANY_PATH}`, {
    from: startDate,
    to: endDate
  });
  return json?.kpi || null;
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
const RATE_KEYS = ['提案率', '推薦率', '面接設定率', '面接実施率', '内定率', '承諾率', '入社決定率'];
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
  { targetKey: 'acceptsTarget', dataKey: 'accepts' }
];

const DEFAULT_DAILY_TARGETS = {
  newInterviewsTarget: 5,
  proposalsTarget: 5,
  recommendationsTarget: 4,
  interviewsScheduledTarget: 4,
  interviewsHeldTarget: 3,
  offersTarget: 2,
  acceptsTarget: 2
};

const DAILY_LABELS = {
  newInterviews: '新規面談数',
  proposals: '提案数',
  recommendations: '推薦数',
  interviewsScheduled: '面接設定数',
  interviewsHeld: '面接実施数',
  offers: '内定数',
  accepts: '承諾数'
};

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

const COMPANY_DAILY_EMPLOYEES = [
  { id: 'emp-1', name: '田中 太郎' },
  { id: 'emp-2', name: '佐藤 花子' },
  { id: 'emp-3', name: '鈴木 次郎' }
];

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

const RATE_DETAIL_PIPELINE = [
  { labelA: '提案数', keyA: 'proposals', labelB: '新規面談数', keyB: 'newInterviews', prevKey: 'prevNewInterviews' },
  { labelA: '推薦数', keyA: 'recommendations', labelB: '提案数', keyB: 'proposals', prevKey: 'prevProposals' },
  { labelA: '面接設定数', keyA: 'interviewsScheduled', labelB: '推薦数', keyB: 'recommendations', prevKey: 'prevRecommendations' },
  { labelA: '面接実施数', keyA: 'interviewsHeld', labelB: '面接設定数', keyB: 'interviewsScheduled', prevKey: 'prevInterviewsScheduled' },
  { labelA: '内定数', keyA: 'offers', labelB: '面接実施数', keyB: 'interviewsHeld', prevKey: 'prevInterviewsHeld' },
  { labelA: '承諾数', keyA: 'accepts', labelB: '内定数', keyB: 'offers', prevKey: 'prevOffers' },
  { labelA: '承諾数', keyA: 'accepts', labelB: '新規面談数', keyB: 'newInterviews', prevKey: 'prevNewInterviews' }
];

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
  isAdmin: false,
  kpi: {
    today: {},
    monthly: {},
    personalPeriod: {},
    companyMonthly: {},
    companyPeriod: {}
  },
  evaluationPeriods: [],
  personalEvaluationPeriodId: '',
  companyEvaluationPeriodId: '',
  personalDailyPeriodId: '',
  companyDailyPeriodId: '',
  companyDailyEmployeeId: '',
  companyTermPeriodId: '',
  personalDailyData: {},
  companyDailyData: {},
  ranges: {
    personal: {},
    company: {},
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

let chartJsPromise = null;

function getCurrentMonthRange() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
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

function isoDate(date) {
  return date.toISOString().split('T')[0];
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
  try {
    return JSON.parse(localStorage.getItem(storageKey) || '{}');
  } catch (error) {
    console.warn('[yield] failed to parse goals', error);
    return {};
  }
}

function persistGoal(storageKey, metric, rawValue, onChange) {
  const goals = readGoals(storageKey);
  if (rawValue === '') {
    delete goals[metric];
  } else {
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed) && parsed >= 0) {
      goals[metric] = parsed;
    }
  }
  localStorage.setItem(storageKey, JSON.stringify(goals));
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
  localStorage.setItem(storageKey, JSON.stringify(merged));
  return merged;
}

function seedMonthlyGoalsFromSettings() {
  const target = goalSettingsService.getPersonalPeriodTarget(state.personalEvaluationPeriodId, getAdvisorName()) || {};
  const mapped = mapTargetsToGoals(target);
  updateGoalStorage(MONTHLY_GOAL_KEY, mapped);
}

function seedTodayGoalsFromSettings() {
  const todayStr = isoDate(new Date());
  const todayPeriodId = goalSettingsService.resolvePeriodIdByDate(todayStr) || state.personalEvaluationPeriodId;
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
  state.isAdmin = hasRole('admin');
  toggleEmployeeSections(state.isAdmin);
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

export function mount() {
  syncAccessRole();
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
  safe('loadYieldData', loadYieldData);
}

export function unmount() {}

function initializeDatePickers() {
  const today = isoDate(new Date());
  const thirtyDaysAgo = isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const ninetyDaysAgo = isoDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));

  const personalRangeStart = document.getElementById('personalRangeStart');
  const personalRangeEnd = document.getElementById('personalRangeEnd');
  const companyPeriodStart = document.getElementById('companyPeriodStart');
  const companyPeriodEnd = document.getElementById('companyPeriodEnd');

  if (personalRangeStart) personalRangeStart.value = thirtyDaysAgo;
  if (personalRangeEnd) personalRangeEnd.value = today;
  if (companyPeriodStart) companyPeriodStart.value = ninetyDaysAgo;
  if (companyPeriodEnd) companyPeriodEnd.value = today;

  state.ranges.personal = { startDate: personalRangeStart?.value, endDate: personalRangeEnd?.value };
  state.ranges.company = { startDate: companyPeriodStart?.value, endDate: companyPeriodEnd?.value };

  const handlePersonalChange = () => {
    const nextRange = { startDate: personalRangeStart?.value, endDate: personalRangeEnd?.value };
    if (isValidRange(nextRange)) {
      state.ranges.personal = nextRange;
      loadYieldData();
    }
  };
  [personalRangeStart, personalRangeEnd].forEach(input => input?.addEventListener('change', handlePersonalChange));

  const handleCompanyChange = () => {
    const nextRange = { startDate: companyPeriodStart?.value, endDate: companyPeriodEnd?.value };
    if (isValidRange(nextRange)) {
      state.ranges.company = nextRange;
      loadCompanyPeriodKPIData();
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
      state.ranges.personal = { startDate, endDate };
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
      state.ranges.company = { startDate, endDate };
      loadCompanyPeriodKPIData();
    }
  });
}

function initEmployeePeriodPreset() {
  if (!state.isAdmin) return;
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
  if (!state.isAdmin) return;
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
  const todaySearchInput = document.getElementById('companyTodaySearchInput');
  const todaySearchButton = document.getElementById('companyTodaySearchButton');
  const todaySortSelect = document.getElementById('companyTodaySortSelect');
  const termSearchInput = document.getElementById('companyTermSearchInput');
  const termSearchButton = document.getElementById('companyTermSearchButton');
  const termSortSelect = document.getElementById('companyTermSortSelect');

  const triggerTodaySearch = () => applyCompanyTodaySearch(todaySearchInput?.value || '');
  todaySearchButton?.addEventListener('click', triggerTodaySearch);
  todaySearchInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      triggerTodaySearch();
    }
  });
  todaySortSelect?.addEventListener('change', handleCompanyTodaySort);

  const triggerTermSearch = () => applyCompanyTermSearch(termSearchInput?.value || '');
  termSearchButton?.addEventListener('click', triggerTermSearch);
  termSearchInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      triggerTermSearch();
    }
  });
  termSortSelect?.addEventListener('change', handleCompanyTermSort);

  renderCompanyTodayTable();
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
    goalSettingsService.resolvePeriodIdByDate(todayStr) || state.personalDailyPeriodId || state.personalEvaluationPeriodId;
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
  cardIds.forEach((cardId, index) => {
    const detail = RATE_DETAIL_PIPELINE[index];
    const card = document.getElementById(cardId)?.closest('.kpi-v2-card');
    writeRateDetailInline(card, detail.labelA, data?.[detail.keyA], detail.labelB, data?.[detail.keyB], data?.[detail.prevKey]);
  });
}

function renderPersonalSummary(rangeData, monthOverride) {
  const summary = {
    achievementRate: num(monthOverride?.achievementRate ?? rangeData?.achievementRate),
    currentAmount: num(monthOverride?.currentAmount ?? rangeData?.currentAmount),
    targetAmount: num(monthOverride?.targetAmount ?? rangeData?.targetAmount)
  };
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
  const monthly = normalizeKpi(summaryData?.monthly || summaryData || {});
  const period = normalizeKpi(periodData?.period || periodData || {});

  state.kpi.today = today;
  state.kpi.monthly = monthly;
  state.kpi.personalPeriod = period;

  initGoalInputs('today');
  initGoalInputs('monthly');
  renderGoalValues('today');
  renderGoalValues('monthly');

  renderCounts('today', today);
  renderGoalProgress('today', today);
  renderDeltaBadges('today', today);

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
}

function renderCompanyMonthly(data) {
  state.kpi.companyMonthly = normalizeKpi(data || {});
  renderCounts('companyMonthly', state.kpi.companyMonthly);
  renderRates('companyMonthly', state.kpi.companyMonthly);
  renderRateDetails('companyMonthly', state.kpi.companyMonthly);
  renderDeltaBadges('companyMonthly', state.kpi.companyMonthly, {}, { includeRates: true });
  renderCompanyTargets();
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
  const current = num(state.kpi.companyMonthly?.revenue);
  const targetAmount = num(target.revenueTarget);
  const achv = targetAmount > 0 ? Math.round((current / targetAmount) * 100) : 0;
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

async function loadYieldData() {
  try {
    const [todayData, personalSummary, personalRange] = await Promise.all([
      loadTodayPersonalKPIData(),
      loadPersonalSummaryKPIData(),
      loadPersonalKPIData()
    ]);
    if (todayData || personalSummary || personalRange) {
      renderPersonalKpis(todayData || {}, personalSummary || {}, personalRange || {});
    }

    const companyMonthly = await loadCompanyKPIData();
    if (companyMonthly) renderCompanyMonthly(companyMonthly);

    const companyPeriod = await loadCompanyPeriodKPIData();
    if (companyPeriod) renderCompanyPeriod(companyPeriod);

    const todayEmployeeRows = await loadCompanyTodayEmployeeKpi();
    if (todayEmployeeRows?.length) renderCompanyTodayTable();

    const companyTermRows = await loadCompanyTermEmployeeKpi();
    if (companyTermRows?.length) renderCompanyTermTables();

    await loadAndRenderPersonalDaily();
    await loadAndRenderCompanyDaily();

    if (state.isAdmin) {
      await loadEmployeeData(state.ranges.employee.startDate ? state.ranges.employee : {});
    } else {
      renderEmployeeRows([]);
    }
  } catch (error) {
    console.error('Failed to load yield data:', error);
  }
}

async function loadPersonalKPIData() {
  try {
    const startDate = state.ranges.personal.startDate || '2025-01-01';
    const endDate = state.ranges.personal.endDate || isoDate(new Date());
    if (!startDate || !endDate) return null;
    const kpi = await fetchPersonalKpiFromApi({ startDate, endDate });
    if (kpi) return { period: kpi };
  } catch (error) {
    console.error('Failed to load personal KPI data (api):', error);
  }
  try {
    const candidates = await ensureCandidateDataset();
    const kpi = buildPersonalKpiFromCandidates(candidates, {
      startDate: state.ranges.personal.startDate,
      endDate: state.ranges.personal.endDate,
      advisorName: getAdvisorName()
    });
    return kpi && !Array.isArray(kpi) ? kpi : null;
  } catch (error) {
    console.error('Failed to load personal KPI data (from candidates mock):', error);
    return null;
  }
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
    console.error('Failed to load personal summary KPI data (api):', error);
  }
  try {
    const period = state.evaluationPeriods.find(item => item.id === state.personalEvaluationPeriodId);
    const startDate = period?.startDate;
    const endDate = period?.endDate;
    if (!startDate || !endDate) return null;
    const candidates = await ensureCandidateDataset();
    const kpi = buildPersonalKpiFromCandidates(candidates, {
      startDate,
      endDate,
      advisorName: getAdvisorName()
    });
    return kpi && !Array.isArray(kpi) ? kpi : null;
  } catch (error) {
    console.error('Failed to load personal summary KPI data (from candidates mock):', error);
    return null;
  }
}

async function loadTodayPersonalKPIData() {
  try {
    const todayStr = isoDate(new Date());
    const kpi = await fetchPersonalKpiFromApi({ startDate: todayStr, endDate: todayStr });
    if (kpi) return { today: kpi };
  } catch (error) {
    console.error('Failed to load today personal KPI data (api):', error);
  }
  try {
    const todayStr = isoDate(new Date());
    const candidates = await ensureCandidateDataset();
    const kpi = buildPersonalKpiFromCandidates(candidates, {
      startDate: todayStr,
      endDate: todayStr,
      advisorName: getAdvisorName()
    });
    return kpi && !Array.isArray(kpi) ? kpi : null;
  } catch (error) {
    console.error('Failed to load today personal KPI data (from candidates mock):', error);
    return null;
  }
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
    console.error('Failed to load company KPI data (api):', error);
  }
  try {
    const range = getCompanySummaryRange();
    if (!range.startDate || !range.endDate) return null;

    const candidates = await ensureCandidateDataset();
    const kpi = buildCompanyKpiFromCandidates(candidates, range);
    console.log('[yield] company KPI (summary range)', { range, candidateCount: candidates.length });

    return kpi;
  } catch (error) {
    console.error('Failed to load company KPI data (from candidates):', error);
    return null;
  }
}

async function loadCompanyPeriodKPIData() {
  try {
    const startDate = state.ranges.company.startDate;
    const endDate = state.ranges.company.endDate;
    if (!startDate || !endDate) return null;

    const kpi = await fetchCompanyKpiFromApi({ startDate, endDate });
    if (kpi) {
      renderCompanyPeriod(kpi);
      return kpi;
    }
  } catch (error) {
    console.error('Failed to load company period KPI data (api):', error);
  }
  try {
    const startDate = state.ranges.company.startDate;
    const endDate = state.ranges.company.endDate;
    if (!startDate || !endDate) return null;

    const candidates = await ensureCandidateDataset();
    const kpi = buildCompanyKpiFromCandidates(candidates, { startDate, endDate });
    console.log('[yield] company KPI (period range)', { startDate, endDate, candidateCount: candidates.length });

    if (kpi) renderCompanyPeriod(kpi);
    return kpi;
  } catch (error) {
    console.error('Failed to load company period KPI data (from candidates):', error);
    return null;
  }
}

async function loadCompanyTodayEmployeeKpi() {
  const todayStr = isoDate(new Date());
  const candidates = await ensureCandidateDataset();
  const todayPeriodId = goalSettingsService.resolvePeriodIdByDate(todayStr, state.evaluationPeriods);

  const rows = buildEmployeeKpiFromCandidates(candidates, {
    startDate: todayStr,
    endDate: todayStr
  });

  state.companyToday.rows = rows.map(row => ({
    name: row.name,
    newInterviews: row.newInterviews,
    newInterviewsGoal: resolveAdvisorGoal(todayPeriodId, todayStr, row.name, 'newInterviewsTarget'),
    proposals: row.proposals,
    proposalsGoal: resolveAdvisorGoal(todayPeriodId, todayStr, row.name, 'proposalsTarget'),
    recommendations: row.recommendations,
    recommendationsGoal: resolveAdvisorGoal(todayPeriodId, todayStr, row.name, 'recommendationsTarget'),
    interviewsScheduled: row.interviewsScheduled,
    interviewsScheduledGoal: resolveAdvisorGoal(todayPeriodId, todayStr, row.name, 'interviewsScheduledTarget'),
    interviewsHeld: row.interviewsHeld,
    interviewsHeldGoal: resolveAdvisorGoal(todayPeriodId, todayStr, row.name, 'interviewsHeldTarget'),
    offers: row.offers,
    offersGoal: resolveAdvisorGoal(todayPeriodId, todayStr, row.name, 'offersTarget'),
    accepts: row.accepts,
    acceptsGoal: resolveAdvisorGoal(todayPeriodId, todayStr, row.name, 'acceptsTarget')
  }));

  return state.companyToday.rows;
}

async function loadCompanyTermEmployeeKpi() {
  const periodId = state.companyTermPeriodId;
  const period = state.evaluationPeriods.find(item => item.id === periodId);
  if (!period) {
    state.companyTerm.rows = [];
    return [];
  }

  const candidates = await ensureCandidateDataset();
  const rows = buildEmployeeKpiFromCandidates(candidates, {
    startDate: period.startDate,
    endDate: period.endDate
  });

  state.companyTerm.rows = rows.map(row => {
    const target = goalSettingsService.getPersonalPeriodTarget(periodId, row.name) || {};
    const goalOrNull = key => {
      const raw = target[key];
      return raw === undefined || raw === null ? null : num(raw);
    };
    return {
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
  const periodId = state.personalDailyPeriodId;
  if (!periodId) return;
  const session = getSession();
  const advisorName = session?.user?.name || null;

  const period = state.evaluationPeriods.find(item => item.id === periodId);
  if (!period) return;

  const candidates = await ensureCandidateDataset();
  const data = buildDailyMetricsFromCandidates(candidates, {
    startDate: period.startDate,
    endDate: period.endDate,
    advisorName
  });

  renderPersonalDailyTable(periodId, data);
}

async function loadCompanySummaryKPI() {
  const data = await loadCompanyKPIData();
  if (data) renderCompanyMonthly(data);
}

async function loadPersonalDailyKpiData(periodId) {
  const period = state.evaluationPeriods.find(item => item.id === periodId);
  if (!period) return {};
  const candidates = await ensureCandidateDataset();
  const daily = buildDailyMetricsFromCandidates(candidates, {
    startDate: period.startDate,
    endDate: period.endDate,
    advisorName: getAdvisorName()
  });

  console.log('[yield] personal daily metrics', {
    period,
    candidateCount: candidates.length,
    firstDate: period.startDate,
    lastDate: period.endDate
  });

  return daily;
}

async function loadCompanyDailyKpiData(employeeId, periodId) {
  const period = state.evaluationPeriods.find(item => item.id === periodId);
  if (!period) return {};
  const candidates = await ensureCandidateDataset();
  const daily = buildDailyMetricsFromCandidates(candidates, {
    startDate: period.startDate,
    endDate: period.endDate,
    advisorName: employeeId || null
  });

  console.log('[yield] company daily metrics', {
    period,
    candidateCount: candidates.length
  });

  return daily;
}

function buildDailyHeaderRow(headerRow, dates) {
  if (!headerRow) return;
  const cells = dates
    .map(date => {
      const label = formatDayLabel(date);
      return `<th scope="col">${label}</th>`;
    })
    .join('');
  headerRow.innerHTML = `<th scope="col" class="kpi-v2-sticky-label">指標</th><th class="daily-type" scope="col">区分</th>${cells}`;
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

function renderDailyMatrix({ headerRow, body, dates, dailyData, resolveValues }) {
  if (!body) return;
  buildDailyHeaderRow(headerRow, dates);
  const rows = [];
  DAILY_FIELDS.forEach((field, index) => {
    const baseLabel = DAILY_LABELS[field.dataKey] || field.dataKey;
    const tripletAlt = index % 2 === 1 ? 'daily-triplet-alt' : '';
    const actualNumbers = [];
    const targetNumbers = [];
    dates.forEach(date => {
      const { actual = 0, target = 0 } = resolveValues(field, date);
      actualNumbers.push(num(actual));
      targetNumbers.push(num(target));
    });
    const actualCells = actualNumbers.map(formatNumberCell);
    const targetCells = targetNumbers.map(formatNumberCell);
    const achvCells = targetNumbers.map((target, idx) => {
      if (target > 0) {
        const percent = Math.round((actualNumbers[idx] / target) * 100);
        return formatAchievementCell(percent);
      }
      return formatAchievementCell(null);
    });
    rows.push(
      buildDailyRow(
        `<th scope="row" class="kpi-v2-sticky-label" rowspan="3">${baseLabel}</th><td class="daily-type">実績</td>`,
        actualCells,
        { rowClass: tripletAlt }
      )
    );
    rows.push(
      buildDailyRow(
        `<td class="daily-type">目標</td>`,
        targetCells,
        { rowClass: tripletAlt, cellClass: 'daily-muted' }
      )
    );
    rows.push(
      buildDailyRow(
        `<td class="daily-type">達成率</td>`,
        achvCells,
        { rowClass: tripletAlt }
      )
    );
  });
  body.innerHTML = rows.join('');
}

function formatNumberCell(value) {
  const numeric = num(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : '--';
}

function formatAchievementCell(percent) {
  if (percent === null || Number.isNaN(percent)) {
    return { value: '--%', className: 'daily-muted' };
  }
  const className = percent >= 100 ? 'daily-achv-high' : 'daily-achv-normal';
  return { value: `${percent}%`, className };
}

function formatDayLabel(dateStr) {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed)) return dateStr;
  return String(parsed.getDate());
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
  const dates = enumeratePeriodDates(period);
  const advisorName = getAdvisorName();
  const periodTarget = goalSettingsService.getPersonalPeriodTarget(periodId, advisorName) || {};
  const savedTargets = goalSettingsService.getPersonalDailyTargets(periodId, advisorName) || {};
  const perDayFallback = DAILY_FIELDS.reduce((acc, field) => {
    const total = num(periodTarget[field.targetKey]) || DEFAULT_DAILY_TARGETS[field.targetKey] || 0;
    const span = dates.length ? Math.max(1, Math.round(total / dates.length)) : total;
    acc[field.targetKey] = span;
    return acc;
  }, {});
  if (labelEl) labelEl.textContent = `評価期間：${period.startDate}〜${period.endDate}`;

  renderDailyMatrix({
    headerRow,
    body,
    dates,
    dailyData,
    resolveValues: (field, date) => {
      const actual = dailyData[date] || {};
      const target = savedTargets[date] || {};
      const expected =
        target[field.targetKey] !== undefined ? num(target[field.targetKey]) : perDayFallback[field.targetKey] || 0;
      return { actual: actual[field.dataKey], target: expected };
    }
  });
}

async function loadAndRenderCompanyDaily() {
  const periodId = state.companyDailyPeriodId;
  const employeeId = state.companyDailyEmployeeId;
  if (!periodId || !employeeId) return;
  if (!state.companyDailyData[employeeId]) state.companyDailyData[employeeId] = {};
  if (!state.companyDailyData[employeeId][periodId]) {
    state.companyDailyData[employeeId][periodId] = await loadCompanyDailyKpiData(employeeId, periodId);
  }
  renderCompanyDailyTable(periodId, employeeId, state.companyDailyData[employeeId][periodId]);
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
  const perDayFallback = DAILY_FIELDS.reduce((acc, field) => {
    const totalTarget = num(periodTarget[field.targetKey]) || DEFAULT_DAILY_TARGETS[field.targetKey] || 0;
    const span = dates.length ? Math.max(1, Math.round(totalTarget / dates.length)) : totalTarget;
    acc[field.targetKey] = span;
    return acc;
  }, {});
  if (labelEl) labelEl.textContent = `評価期間：${period.startDate}〜${period.endDate}`;

  renderDailyMatrix({
    headerRow,
    body,
    dates,
    dailyData,
    resolveValues: (field, date) => {
      const actual = dailyData[date] || {};
      const target = savedTargets[date] || {};
      const expected =
        target[field.targetKey] !== undefined ? num(target[field.targetKey]) : perDayFallback[field.targetKey] || 0;
      return { actual: actual[field.dataKey], target: expected };
    }
  });
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
  if (!state.isAdmin) return [];
  try {
    const range = rangeFilters.startDate ? rangeFilters : state.ranges.employee.startDate ? state.ranges.employee : getCurrentMonthRange();
    state.ranges.employee = { ...range };
    const startInput = document.getElementById('employeeRangeStart');
    const endInput = document.getElementById('employeeRangeEnd');
    if (startInput && range.startDate) startInput.value = range.startDate;
    if (endInput && range.endDate) endInput.value = range.endDate;

    const candidates = await ensureCandidateDataset();
    const rows = buildEmployeeKpiFromCandidates(candidates, {
      startDate: range.startDate,
      endDate: range.endDate
    });
    state.employees.list = [...rows];
    renderEmployeeRows();
    return rows;
  } catch (error) {
    console.error('Failed to load employee data (from candidates):', error);
    state.employees.list = [];
    renderEmployeeRows([]);
    return [];
  }
}

function normalizeCounts(src = {}) {
  return {
    newInterviews: num(src.newInterviews ?? src.new_interviews ?? src.proposals),
    proposals: num(src.proposals),
    recommendations: num(src.recommendations),
    interviewsScheduled: num(src.interviewsScheduled ?? src.interviews_scheduled),
    interviewsHeld: num(src.interviewsHeld ?? src.interviews_held),
    offers: num(src.offers),
    accepts: num(src.accepts ?? src.hires),
    hires: num(src.hires ?? src.accepts),
    revenue: num(src.revenue ?? src.currentAmount ?? src.revenueAmount)
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
  return {
    ...normalizeCounts(src),
    ...normalizeRates(src),
    ...normalizePrev(src)
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

function setCardAchievementProgress(achvElement, percentValue) {
  if (!achvElement) return;
  const card = achvElement.closest('.kpi-v2-card');
  if (!card) return;
  const normalized = Math.max(0, Math.min(num(percentValue), 100));
  card.style.setProperty('--achv-progress', `${normalized}%`);
}

function writeRateDetailInline(cardEl, labelA, valA, labelB, valB, prevInflowB) {
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
  subtext.textContent = `${labelA} ${num(valA)} / ${labelB} ${num(valB)}(${num(prevInflowB)})`;
}

function initializeKpiTabs() {
  const groups = document.querySelectorAll('.kpi-tab-group[data-kpi-tab-group]');
  groups.forEach(group => {
    const section = group.closest('.kpi-v2-section');
    if (!section) return;
    const tabs = Array.from(group.querySelectorAll('.kpi-tab[data-kpi-tab]'));
    const panels = Array.from(section.querySelectorAll('.kpi-tab-panel[data-kpi-tab-panel]'));

    const activate = tabId => {
      tabs.forEach(btn => btn.classList.toggle('is-active', btn.dataset.kpiTab === tabId));
      panels.forEach(panel => panel.classList.toggle('is-hidden', panel.dataset.kpiTabPanel !== tabId));
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
}

function loadEvaluationPeriods() {
  const periods = goalSettingsService.getEvaluationPeriods();
  state.evaluationPeriods = Array.isArray(periods) ? periods : [];
  if (!state.evaluationPeriods.length) {
    state.evaluationPeriods = goalSettingsService.generateDefaultPeriods(goalSettingsService.getEvaluationRule());
    goalSettingsService.setEvaluationPeriods(state.evaluationPeriods);
  }
  const todayPeriodId = goalSettingsService.resolvePeriodIdByDate(isoDate(new Date()));
  const first = state.evaluationPeriods[0];
  const hasPersonal = state.evaluationPeriods.some(period => period.id === state.personalEvaluationPeriodId);
  const hasCompany = state.evaluationPeriods.some(period => period.id === state.companyEvaluationPeriodId);
  const hasPersonalDaily = state.evaluationPeriods.some(period => period.id === state.personalDailyPeriodId);
  const hasCompanyDaily = state.evaluationPeriods.some(period => period.id === state.companyDailyPeriodId);
  const hasCompanyTerm = state.evaluationPeriods.some(period => period.id === state.companyTermPeriodId);
  if (!hasPersonal && (todayPeriodId || first)) state.personalEvaluationPeriodId = todayPeriodId || first?.id || '';
  if (!hasCompany && (todayPeriodId || first)) state.companyEvaluationPeriodId = todayPeriodId || first?.id || '';
  if (!hasPersonalDaily && (todayPeriodId || first)) state.personalDailyPeriodId = todayPeriodId || first?.id || '';
  if (!hasCompanyDaily && (todayPeriodId || first)) state.companyDailyPeriodId = todayPeriodId || first?.id || '';
  if (!hasCompanyTerm && (todayPeriodId || first)) state.companyTermPeriodId = todayPeriodId || first?.id || '';
  if (!state.companyDailyEmployeeId && COMPANY_DAILY_EMPLOYEES[0]) {
    state.companyDailyEmployeeId = COMPANY_DAILY_EMPLOYEES[0].id;
  }
  renderEvaluationSelectors();
  applyPersonalEvaluationPeriod(false);
}

function renderEvaluationSelectors() {
  const options = state.evaluationPeriods
    .map(period => `<option value="${period.id}">${goalSettingsService.formatPeriodLabel(period)}</option>`)
    .join('');
  const personalSelect = document.getElementById('personalEvaluationPeriodSelect');
  const companySelect = document.getElementById('companyEvaluationPeriodSelect');
  const personalDailySelect = document.getElementById('personalDailyPeriodSelect');
  const companyDailySelect = document.getElementById('companyDailyPeriodSelect');
  const companyTermSelect = document.getElementById('companyTermPeriodSelect');
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
  renderCompanyDailyEmployeeOptions();
  const companyDailyEmployeeSelect = document.getElementById('companyDailyEmployeeSelect');
  if (companyDailyEmployeeSelect && state.companyDailyEmployeeId) {
    companyDailyEmployeeSelect.value = state.companyDailyEmployeeId;
  }
  updatePersonalPeriodLabels();
}

function renderCompanyDailyEmployeeOptions() {
  const select = document.getElementById('companyDailyEmployeeSelect');
  if (!select) return;
  select.innerHTML = mockUsers.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
  state.companyDailyEmployeeId = select.value || '';
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

function handleCompanyPeriodChange(event) {
  state.companyEvaluationPeriodId = event.target.value || '';
  renderCompanyTargets();
  loadCompanySummaryKPI();
}

async function handleCompanyTermPeriodChange(event) {
  state.companyTermPeriodId = event.target.value || '';
  await loadCompanyTermEmployeeKpi();
  renderCompanyTermTables();
}

function handlePersonalDailyPeriodChange(event) {
  state.personalDailyPeriodId = event.target.value || '';
  loadAndRenderPersonalDaily();
}

function handleCompanyDailyPeriodChange(event) {
  state.companyDailyPeriodId = event.target.value || '';
  loadAndRenderCompanyDaily();
}

function handleCompanyDailyEmployeeChange(event) {
  state.companyDailyEmployeeId = event.target.value || '';
  loadAndRenderCompanyDaily();
}

function applyPersonalEvaluationPeriod(shouldReload = true) {
  const period = state.evaluationPeriods.find(item => item.id === state.personalEvaluationPeriodId);
  seedGoalDefaultsFromSettings();
  initGoalInputs('today');
  initGoalInputs('monthly');
  refreshAchievements('today');
  refreshAchievements('monthly');
  updatePersonalPeriodLabels();
  if (shouldReload) {
    loadYieldData();
    loadAndRenderPersonalDaily();
  }
}

function updatePersonalPeriodLabels() {
  const period = state.evaluationPeriods.find(item => item.id === state.personalEvaluationPeriodId);
  const dailyPeriod = state.evaluationPeriods.find(item => item.id === state.personalDailyPeriodId);
  const titleEl = document.getElementById('personalSummaryTitle');
  const dailyLabel = document.getElementById('personalDailyPeriodLabel');
  if (period) {
    const rangeText = `${period.startDate}〜${period.endDate}`;
    if (titleEl) titleEl.textContent = `${rangeText}の実績サマリー`;
  } else if (titleEl) {
    titleEl.textContent = '今月の実績サマリー';
  }
  if (dailyLabel) {
    if (dailyPeriod) {
      dailyLabel.textContent = `評価期間：${dailyPeriod.startDate}〜${dailyPeriod.endDate}`;
    } else {
      dailyLabel.textContent = '評価期間：--';
    }
  } else {
    if (dailyLabel) dailyLabel.textContent = '評価期間：--';
  }
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

  try {
    const candidates = await ensureCandidateDataset();
    const range = getOneYearRange();
    const advisorName = getAdvisorName();

    state.dashboard.personal.breakdown = buildGenderAndAgeBreakdownFromCandidates(candidates, {
      startDate: range.startDate,
      endDate: range.endDate,
      advisorName
    });

    state.dashboard.company.breakdown = buildGenderAndAgeBreakdownFromCandidates(candidates, {
      startDate: range.startDate,
      endDate: range.endDate,
      advisorName: null
    });

    state.dashboard.personal.trendData = buildTrendRatesFromCandidates(candidates, {
      startDate: range.startDate,
      endDate: range.endDate,
      advisorName
    });

    state.dashboard.company.trendData = buildTrendRatesFromCandidates(candidates, {
      startDate: range.startDate,
      endDate: range.endDate,
      advisorName: null
    });
  } catch (error) {
    console.error('[yield] failed to build dashboard breakdown:', error);
  }

  ensureChartJs()
    .then(() => {
      scopes.forEach(scope => {
        setupDashboardControls(scope);
        renderDashboardCharts(scope);
      });
    })
    .catch(error => console.error('[yield] failed to load Chart.js', error));
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
      renderTrendChart(scope);
    });
  });

  const yearSelect = document.getElementById(`${scope}TrendYearSelect`);
  const monthSelect = document.getElementById(`${scope}TrendMonthSelect`);
  yearSelect?.addEventListener('change', () => {
    const selectedYear = Number(yearSelect.value) || state.dashboard[scope].year;
    state.dashboard[scope].year = selectedYear;
    renderTrendChart(scope);
  });
  monthSelect?.addEventListener('change', () => {
    const selectedMonth = Number(monthSelect.value) || state.dashboard[scope].month;
    state.dashboard[scope].month = selectedMonth;
    if (state.dashboard[scope].trendMode === 'month') renderTrendChart(scope);
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
