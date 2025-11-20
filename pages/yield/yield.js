// Yield Page JavaScript Module
import { RepositoryFactory } from '../../scripts/api/index.js';

const repositories = RepositoryFactory.create();

const TODAY_GOAL_KEY = 'todayGoals.v1';
const MONTHLY_GOAL_KEY = 'monthlyGoals.v1';
let todayKPIState = null;
let monthlyKPIState = null;
let periodKPIState = null;
let todayGoalsInitialized = false;
let monthlyGoalsInitialized = false;
let companyKPIState = null;
let employeeListState = [];
let employeePeriodRange = { startDate: '', endDate: '' };

function safe(name, fn) {
  try {
    return fn();
  } catch (e) {
    console.error(`[yield] ${name} failed:`, e);
  }
}

function pickOrFallback(raw, validator, fallbackFactory) {
  try {
    if (!validator) {
      return raw && !Array.isArray(raw) ? raw : fallbackFactory();
    }
    return validator(raw) ? raw : fallbackFactory();
  } catch {
    return fallbackFactory();
  }
}

function num(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function ensureValueWrap(cardEl) {
  const val = cardEl?.querySelector('.kpi-v2-value');
  if (!val) return null;
  let wrap = cardEl.querySelector('.kpi-v2-value-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'kpi-v2-value-wrap';
    val.parentNode.insertBefore(wrap, val);
    wrap.appendChild(val);
  }
  return wrap;
}

function writeRateDetailInline(cardEl, labelA, valA, labelB, valB, prevInflowB) {
  if (!cardEl) return;
  const wrap = ensureValueWrap(cardEl);
  if (!wrap) return;
  let el = cardEl.querySelector('.kpi-v2-rate-inline');
  if (!el) {
    el = document.createElement('div');
    el.className = 'kpi-v2-rate-inline';
    const val = wrap.querySelector('.kpi-v2-value');
    if (!val) return;
    val.insertAdjacentElement('afterend', el);
  }
  el.innerHTML = `${labelA} ${num(valA)} /<br> ${labelB} ${num(valB)}(${num(prevInflowB)})`;
}

const DEFAULT_COMPANY_RATES = {
  proposalRate: 65,
  recommendationRate: 62,
  interviewScheduleRate: 130,
  interviewHeldRate: 88,
  offerRate: 54,
  acceptRate: 60
};

const DEFAULT_EMPLOYEE_SERIES = [
  { name: '佐藤太郎', proposals: 24 },
  { name: '田中花子', proposals: 30 },
  { name: '鈴木健', proposals: 18 }
];

export function mount() {
  safe('initializeDatePickers', initializeDatePickers);
  safe('initTodayGoals', initTodayGoals);
  safe('initPeriodKPI', initPeriodKPI);
  safe('initCompanyPeriodKPI', initCompanyPeriodKPI);
  safe('initEmployeePeriodPreset', initEmployeePeriodPreset);
  safe('initializeKPICharts', initializeKPICharts);
  safe('initializeEmployeeControls', initializeEmployeeControls);
  safe('initializeFilters', initializeFilters);
  safe('loadYieldData', loadYieldData);
}

export function unmount() {
  cleanupEventListeners();
  cleanupCharts();
}

// 日付選択器の初期化
function initializeDatePickers() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const personalRangeStart = document.getElementById('personalRangeStart');
  const personalRangeEnd = document.getElementById('personalRangeEnd');
  const companyRangeStart = document.getElementById('companyRangeStart');
  const companyRangeEnd = document.getElementById('companyRangeEnd');
  const companyPeriodStart = document.getElementById('companyPeriodStart');
  const companyPeriodEnd = document.getElementById('companyPeriodEnd');
  
  if (personalRangeStart) personalRangeStart.value = thirtyDaysAgo;
  if (personalRangeEnd) personalRangeEnd.value = today;
  if (companyRangeStart) companyRangeStart.value = thirtyDaysAgo;
  if (companyRangeEnd) companyRangeEnd.value = today;
  if (companyPeriodEnd) companyPeriodEnd.value = today;
  if (companyPeriodStart) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    companyPeriodStart.value = ninetyDaysAgo;
  }
  
  // 日付変更イベントリスナー
  [personalRangeStart, personalRangeEnd, companyRangeStart, companyRangeEnd].forEach(input => {
    if (input) {
      input.addEventListener('change', handleDateRangeChange);
    }
  });
  
  [companyPeriodStart, companyPeriodEnd].forEach(input => {
    if (input) {
      input.addEventListener('change', () => {
        loadCompanyPeriodKPIData();
      });
    }
  });
}

// KPIチャートの初期化
function initializeKPICharts() {
  // 月次推移チャートの初期化
  drawTrendChart({ mode: 'rate', range: '6m' });
  drawCompanyTrend({ range: '6m' });
  drawEmployeeComparisonTrend({ range: '6m', employees: DEFAULT_EMPLOYEE_SERIES });
}

// 社員コントロールの初期化
function initializeEmployeeControls() {
  const searchInput = document.getElementById('employeeSearchInput');
  const sortSelect = document.getElementById('employeeSortSelect');
  
  if (searchInput) {
    searchInput.addEventListener('input', handleEmployeeSearch);
  }
  
  if (sortSelect) {
    sortSelect.addEventListener('change', handleEmployeeSort);
  }
  
}

// フィルターの初期化
function initializeFilters() {
  const filterApply = document.getElementById('filterApply');
  const filterReset = document.getElementById('filterReset');
  const sortDirection = document.getElementById('sortDirection');
  
  if (filterApply) {
    filterApply.addEventListener('click', handleFilterApply);
  }
  
  if (filterReset) {
    filterReset.addEventListener('click', handleFilterReset);
  }
  
  if (sortDirection) {
    sortDirection.addEventListener('click', handleSortDirection);
  }
  
  // 連絡先マスク解除の初期化
  initializeContactMasks();
}

function initTodayGoals() {
  if (todayGoalsInitialized) return;
  const inputs = document.querySelectorAll('.goal-input[data-ref^="todayGoal-"]');
  if (!inputs.length) return;
  const storedGoals = JSON.parse(localStorage.getItem(TODAY_GOAL_KEY) || '{}');

  inputs.forEach(input => {
    const metric = input.dataset.ref?.replace('todayGoal-', '');
    if (!metric) return;
    if (storedGoals[metric] !== undefined) {
      input.value = storedGoals[metric];
    }
    attachGoalHandlers(input, {
      metric,
      storageKey: TODAY_GOAL_KEY,
      onChange: updateTodayKPI
    });
  });
  
  todayGoalsInitialized = true;
  updateTodayKPI();
}

function attachGoalHandlers(input, { metric, storageKey, onChange }) {
  const handleGoalInput = event => {
    const rawValue = event.target.value;
    const goals = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (rawValue === '') {
      delete goals[metric];
    } else {
      const parsedValue = Number(rawValue);
      if (Number.isFinite(parsedValue) && parsedValue >= 0) {
        goals[metric] = parsedValue;
      }
    }
    localStorage.setItem(storageKey, JSON.stringify(goals));
    if (typeof onChange === 'function') {
      onChange();
    }
  };
  input.addEventListener('change', handleGoalInput);
  input.addEventListener('input', handleGoalInput);
}

function updateTodayKPI(data) {
  if (data) {
    const todaySource = data.today || data.daily || null;
    const fallback = todaySource || data.monthly || data;
    todayKPIState = {
      proposals: fallback.proposals ?? 0,
      recommendations: fallback.recommendations ?? 0,
      interviewsScheduled: fallback.interviewsScheduled ?? 0,
      interviewsHeld: fallback.interviewsHeld ?? 0,
      offers: fallback.offers ?? 0,
      accepts: fallback.accepts ?? 0,
      hires: fallback.hires ?? fallback.accepts ?? 0
    };
  }
  
  const metrics = [
    { key: 'proposals', elementId: 'todayProposals' },
    { key: 'recommendations', elementId: 'todayRecommendations' },
    { key: 'interviewsScheduled', elementId: 'todayInterviewsScheduled' },
    { key: 'interviewsHeld', elementId: 'todayInterviewsHeld' },
    { key: 'offers', elementId: 'todayOffers' },
    { key: 'accepts', elementId: 'todayAccepts' },
    { key: 'hires', elementId: 'todayHires' }
  ];
  const goals = JSON.parse(localStorage.getItem(TODAY_GOAL_KEY) || '{}');
  
  metrics.forEach(({ key, elementId }) => {
    const current = todayKPIState?.[key] ?? 0;
    const rawTarget = goals[key];
    const target = Number(rawTarget);
    const hasValidTarget = Number.isFinite(target) && target > 0;
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = current.toLocaleString();
    }
    const achv = document.querySelector(`[data-ref="todayAchv-${key}"]`);
    if (achv) {
      achv.classList.add('kpi-v2-achv-badge');
      if (hasValidTarget) {
        const percent = Math.round((current / target) * 100);
        achv.textContent = `${percent}%`;
      } else {
        achv.textContent = '--%';
      }
    }
  });
}

function updateMonthlyKPI(data) {
  if (data) {
    const monthlyData = data.monthly || data;
    monthlyKPIState = { ...monthlyData };
  }
  
  const goals = JSON.parse(localStorage.getItem(MONTHLY_GOAL_KEY) || '{}');
  
  if (!monthlyGoalsInitialized) {
    const inputs = document.querySelectorAll('.goal-input[data-ref^="monthlyGoal-"]');
    inputs.forEach(input => {
      const metric = input.dataset.ref?.replace('monthlyGoal-', '');
      if (!metric) return;
      if (goals[metric] !== undefined) {
        input.value = goals[metric];
      }
      attachGoalHandlers(input, {
        metric,
        storageKey: MONTHLY_GOAL_KEY,
        onChange: updateMonthlyKPI
      });
    });
    monthlyGoalsInitialized = true;
  }
  
  const monthMetrics = [
    'proposals',
    'recommendations',
    'interviewsScheduled',
    'interviewsHeld',
    'offers',
    'accepts',
    'hires',
    'proposalRate',
    'recommendationRate',
    'interviewScheduleRate',
    'interviewHeldRate',
    'offerRate',
    'acceptRate',
    'hireRate'
  ];
  
  monthMetrics.forEach(metric => {
    const current = monthlyKPIState?.[metric] ?? 0;
    const rawTarget = goals[metric];
    const target = Number(rawTarget);
    const hasValidTarget = Number.isFinite(target) && target > 0;
    const achv = document.querySelector(`[data-ref="monthlyAchv-${metric}"]`);
    if (!achv) return;
    achv.classList.add('kpi-v2-achv-badge');
    if (hasValidTarget) {
      const percent = Math.round((current / target) * 100);
      achv.textContent = `${percent}%`;
    } else {
      achv.textContent = '--%';
    }
  });
}

function initPeriodKPI() {
  const buttons = document.querySelectorAll('.period-preset-btn');
  if (!buttons.length) return;
  const startInput = document.getElementById('personalRangeStart');
  const endInput = document.getElementById('personalRangeEnd');
  
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      buttons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      const months = parseInt(button.dataset.range, 10);
      if (!endInput) return;
      
      const endDate = endInput.value ? new Date(endInput.value) : new Date();
      const normalizedEnd = new Date(endDate.getTime());
      if (!endInput.value) {
        endInput.value = normalizedEnd.toISOString().split('T')[0];
      }
      if (startInput) {
        const startDate = new Date(normalizedEnd.getFullYear(), normalizedEnd.getMonth(), normalizedEnd.getDate());
        startDate.setMonth(startDate.getMonth() - (Number.isFinite(months) ? months : 0));
        startInput.value = startDate.toISOString().split('T')[0];
      }
      loadYieldData();
    });
  });
}

function initCompanyPeriodKPI() {
  const buttons = document.querySelectorAll('.period-preset-btn.company');
  if (!buttons.length) return;
  const startInput = document.getElementById('companyPeriodStart');
  const endInput = document.getElementById('companyPeriodEnd');
  
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      buttons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      const months = parseInt(button.dataset.range, 10) || 3;
      if (!endInput) return;
      const endDate = endInput.value ? new Date(endInput.value) : new Date();
      const normalizedEnd = new Date(endDate.getTime());
      if (endInput && !endInput.value) {
        endInput.value = normalizedEnd.toISOString().split('T')[0];
      }
      if (startInput) {
        const startDate = new Date(normalizedEnd.getFullYear(), normalizedEnd.getMonth(), normalizedEnd.getDate());
        startDate.setMonth(startDate.getMonth() - months);
        startInput.value = startDate.toISOString().split('T')[0];
      }
      loadCompanyPeriodKPIData();
    });
  });
  
  if (buttons.length) {
    buttons[0].classList.add('active');
  }
  
  loadCompanyPeriodKPIData();
}

function initEmployeePeriodPreset() {
  const presetContainer = document.getElementById('employeePeriodPresets');
  if (!presetContainer) return;
  const buttons = presetContainer.querySelectorAll('.period-preset-btn.employee');
  const setRange = months => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    start.setMonth(start.getMonth() - months);
    employeePeriodRange = {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  };
  
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      buttons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      const months = parseInt(button.dataset.range, 10) || 3;
      setRange(months);
      loadEmployeeData(employeePeriodRange);
    });
  });
  
  if (buttons.length) {
    buttons[0].classList.add('active');
    const months = parseInt(buttons[0].dataset.range, 10) || 3;
    setRange(months);
  }
}
// 連絡先マスク機能
function initializeContactMasks() {
  const contactFields = document.querySelectorAll('.contact-field');
  contactFields.forEach(field => {
    field.addEventListener('click', handleContactFieldClick);
  });
}

// Yield データの読み込み
async function loadYieldData() {
  try {
    const start = document.getElementById('personalRangeStart')?.value || '';
    const end = document.getElementById('personalRangeEnd')?.value || '';
    const rangeLabel = start && end ? `${start}〜${end}` : 'custom';
    
    // 個人成績データの読み込み
    const personalData = await loadPersonalKPIData();
    if (personalData) {
      updateTodayKPI(personalData);
      updateMonthlyKPI(personalData);
      drawTrendChart({ mode: 'rate', range: rangeLabel });
    }
    
    // 社内成績データの読み込み
    const companyData = await loadCompanyKPIData();
    await loadCompanyPeriodKPIData();
    
    // 社員成績データの読み込み
    const employeeData = await loadEmployeeData(
      employeePeriodRange.startDate
        ? { startDate: employeePeriodRange.startDate, endDate: employeePeriodRange.endDate }
        : {}
    );
    
    // 候補者データの読み込み
    await loadCandidateData();
    
    drawCompanyTrend({ range: rangeLabel, data: companyData });
    drawEmployeeComparisonTrend({ range: rangeLabel, employees: employeeData });
    
  } catch (error) {
    console.error('Failed to load yield data:', error);
  }
}

// 個人KPIデータの読み込み
async function loadPersonalKPIData() {
  try {
    // 日付範囲を取得
    const startDate = document.getElementById('personalRangeStart')?.value || '2024-09-01';
    const endDate = document.getElementById('personalRangeEnd')?.value || '2024-11-30';
    
    // APIからデータを取得
    const raw = await repositories.kpi.getPersonalKpi(startDate, endDate);
    const data = pickOrFallback(
      raw,
      value => !!value && !Array.isArray(value) && !!value.monthly && !!value.period,
      getPersonalKPIFallbackData
    );
    updatePersonalKPIDisplay(data);
    return data;
  } catch (error) {
    console.error('Failed to load personal KPI data:', error);
    // フォールバック：モックデータを使用
    return loadPersonalKPIDataFallback();
  }
}

function getPersonalKPIFallbackData() {
  return {
    achievementRate: 33,
    currentAmount: 957000,
    targetAmount: 3000000,
    today: {
      proposals: 2,
      recommendations: 1,
      interviewsScheduled: 1,
      interviewsHeld: 1,
      offers: 0,
      accepts: 0
    },
    monthly: {
      proposals: 80,
      recommendations: 60,
      interviewsScheduled: 50,
      interviewsHeld: 45,
      offers: 20,
      accepts: 12,
      hires: 8,
      proposalRate: 33,
      recommendationRate: 75,
      interviewScheduleRate: 120,
      interviewHeldRate: 90,
      offerRate: 44,
      acceptRate: 60,
      hireRate: 30
    },
    period: {
      proposals: 120,
      recommendations: 90,
      interviewsScheduled: 80,
      interviewsHeld: 70,
      offers: 40,
      accepts: 25,
      hires: 18,
      proposalRate: 50,
      recommendationRate: 75,
      interviewScheduleRate: 133,
      interviewHeldRate: 88,
      offerRate: 57,
      acceptRate: 62,
      hireRate: 35
    }
  };
}

// フォールバック用モックデータの読み込み
function loadPersonalKPIDataFallback() {
  const data = getPersonalKPIFallbackData();
  updatePersonalKPIDisplay(data);
  return data;
}

// 個人KPIデータを表示に反映
function updatePersonalKPIDisplay(data) {
  if (!data) return;
  
  const monthlyData = data.monthly || data;
  const periodData = data.period || data;
  const summarySource = {
    achievementRate: data.achievementRate ?? monthlyData.achievementRate ?? 0,
    currentAmount: data.currentAmount ?? monthlyData.currentAmount ?? 0,
    targetAmount: data.targetAmount ?? monthlyData.targetAmount ?? 0
  };
  
  const achievementEl = document.getElementById('personalAchievementRate');
  if (achievementEl) {
    achievementEl.textContent = `${summarySource.achievementRate || 0}%`;
  }
  
  const currentEl = document.getElementById('personalCurrent');
  if (currentEl) {
    currentEl.textContent = `¥${(summarySource.currentAmount || 0).toLocaleString()}`;
  }
  
  const targetEl = document.getElementById('personalTarget');
  if (targetEl) {
    targetEl.textContent = `¥${(summarySource.targetAmount || 0).toLocaleString()}`;
  }
  
  const monthlyElements = {
    personalProposals: monthlyData.proposals ?? 0,
    personalRecommendations: monthlyData.recommendations ?? 0,
    personalInterviewsScheduled: monthlyData.interviewsScheduled ?? 0,
    personalInterviewsHeld: monthlyData.interviewsHeld ?? 0,
    personalOffers: monthlyData.offers ?? 0,
    personalAccepts: monthlyData.accepts ?? 0,
    personalHires: monthlyData.hires ?? 0,
    personalProposalRate: `${monthlyData.proposalRate || 0}%`,
    personalRecommendationRate: `${monthlyData.recommendationRate || 0}%`,
    personalInterviewScheduleRate: `${monthlyData.interviewScheduleRate || 0}%`,
    personalInterviewHeldRate: `${monthlyData.interviewHeldRate || 0}%`,
    personalOfferRate: `${monthlyData.offerRate || 0}%`,
    personalAcceptRate: `${monthlyData.acceptRate || 0}%`,
    personalHireRate: `${monthlyData.hireRate || 0}%`
  };
  
  Object.entries(monthlyElements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = typeof value === 'number' ? value.toLocaleString() : value;
    }
  });
  
  const periodElements = {
    periodProposals: periodData.proposals ?? 0,
    periodRecommendations: periodData.recommendations ?? 0,
    periodInterviewsScheduled: periodData.interviewsScheduled ?? 0,
    periodInterviewsHeld: periodData.interviewsHeld ?? 0,
    periodOffers: periodData.offers ?? 0,
    periodAccepts: periodData.accepts ?? 0,
    periodHires: periodData.hires ?? 0,
    periodProposalRate: `${periodData.proposalRate || 0}%`,
    periodRecommendationRate: `${periodData.recommendationRate || 0}%`,
    periodInterviewScheduleRate: `${periodData.interviewScheduleRate || 0}%`,
    periodInterviewHeldRate: `${periodData.interviewHeldRate || 0}%`,
    periodOfferRate: `${periodData.offerRate || 0}%`,
    periodAcceptRate: `${periodData.acceptRate || 0}%`,
    periodHireRate: `${periodData.hireRate || 0}%`
  };
  
  Object.entries(periodElements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = typeof value === 'number' ? value.toLocaleString() : value;
    }
  });
  
  monthlyKPIState = { ...monthlyData };
  periodKPIState = { ...periodData };

  const m = monthlyData;
  const p = periodData;

  const monthlyProposalCard = document.getElementById('personalProposalRate')?.closest('.kpi-v2-card');
  const monthlyRecommendationCard = document.getElementById('personalRecommendationRate')?.closest('.kpi-v2-card');
  const monthlyInterviewScheduleCard = document
    .getElementById('personalInterviewScheduleRate')
    ?.closest('.kpi-v2-card');
  const monthlyInterviewHeldCard = document.getElementById('personalInterviewHeldRate')?.closest('.kpi-v2-card');
  const monthlyOfferCard = document.getElementById('personalOfferRate')?.closest('.kpi-v2-card');
  const monthlyAcceptCard = document.getElementById('personalAcceptRate')?.closest('.kpi-v2-card');
  const monthlyHireCard = document.getElementById('personalHireRate')?.closest('.kpi-v2-card');

  writeRateDetailInline(
    monthlyProposalCard,
    '提案数',
    m.proposals,
    '新規面談数',
    m.newInterviews,
    m.prevNewInterviews
  );
  writeRateDetailInline(
    monthlyRecommendationCard,
    '推薦数',
    m.recommendations,
    '提案数',
    m.proposals,
    m.prevProposals
  );
  writeRateDetailInline(
    monthlyInterviewScheduleCard,
    '面談設定数',
    m.interviewsScheduled,
    '推薦数',
    m.recommendations,
    m.prevRecommendations
  );
  writeRateDetailInline(
    monthlyInterviewHeldCard,
    '面談実施数',
    m.interviewsHeld,
    '面談設定数',
    m.interviewsScheduled,
    m.prevInterviewsScheduled
  );
  writeRateDetailInline(
    monthlyOfferCard,
    '内定数',
    m.offers,
    '面談実施数',
    m.interviewsHeld,
    m.prevInterviewsHeld
  );
  writeRateDetailInline(
    monthlyAcceptCard,
    '承諾数',
    m.accepts,
    '内定数',
    m.offers,
    m.prevOffers
  );
  writeRateDetailInline(
    monthlyHireCard,
    '承諾数',
    m.accepts,
    '新規面談数',
    m.newInterviews,
    m.prevNewInterviews
  );

  const periodProposalCard = document.getElementById('periodProposalRate')?.closest('.kpi-v2-card');
  const periodRecommendationCard = document.getElementById('periodRecommendationRate')?.closest('.kpi-v2-card');
  const periodInterviewScheduleCard = document.getElementById('periodInterviewScheduleRate')?.closest('.kpi-v2-card');
  const periodInterviewHeldCard = document.getElementById('periodInterviewHeldRate')?.closest('.kpi-v2-card');
  const periodOfferCard = document.getElementById('periodOfferRate')?.closest('.kpi-v2-card');
  const periodAcceptCard = document.getElementById('periodAcceptRate')?.closest('.kpi-v2-card');
  const periodHireCard = document.getElementById('periodHireRate')?.closest('.kpi-v2-card');

  writeRateDetailInline(
    periodProposalCard,
    '提案数',
    p.proposals,
    '新規面談数',
    p.newInterviews,
    p.prevNewInterviews
  );
  writeRateDetailInline(
    periodRecommendationCard,
    '推薦数',
    p.recommendations,
    '提案数',
    p.proposals,
    p.prevProposals
  );
  writeRateDetailInline(
    periodInterviewScheduleCard,
    '面談設定数',
    p.interviewsScheduled,
    '推薦数',
    p.recommendations,
    p.prevRecommendations
  );
  writeRateDetailInline(
    periodInterviewHeldCard,
    '面談実施数',
    p.interviewsHeld,
    '面談設定数',
    p.interviewsScheduled,
    p.prevInterviewsScheduled
  );
  writeRateDetailInline(
    periodOfferCard,
    '内定数',
    p.offers,
    '面談実施数',
    p.interviewsHeld,
    p.prevInterviewsHeld
  );
  writeRateDetailInline(
    periodAcceptCard,
    '承諾数',
    p.accepts,
    '内定数',
    p.offers,
    p.prevOffers
  );
  writeRateDetailInline(
    periodHireCard,
    '承諾数',
    p.accepts,
    '新規面談数',
    p.newInterviews,
    p.prevNewInterviews
  );
}

// 社内成績データの読み込み
// 会社KPIデータの読み込み
async function loadCompanyKPIData() {
  try {
    // 日付範囲を取得
    const startDate = document.getElementById('companyRangeStart')?.value || '2024-09-01';
    const endDate = document.getElementById('companyRangeEnd')?.value || '2024-11-30';
    
    // APIからデータを取得
    const raw = await repositories.kpi.getCompanyKpi(startDate, endDate);
    const data = pickOrFallback(
      raw,
      value =>
        !!value &&
        !Array.isArray(value) &&
        ['proposals', 'recommendations', 'offers', 'acceptRate'].every(key =>
          Object.prototype.hasOwnProperty.call(value, key)
        ),
      getCompanyKPIFallbackData
    );

    // データを表示
    updateCompanyKPIDisplay(data);
    companyKPIState = { ...data };
    return data;
  } catch (error) {
    console.error('Failed to load company KPI data:', error);
    // フォールバック：モックデータを使用
    return loadCompanyKPIDataFallback();
  }
}

async function loadCompanyPeriodKPIData() {
  try {
    const startDate = document.getElementById('companyPeriodStart')?.value || '';
    const endDate = document.getElementById('companyPeriodEnd')?.value || '';
    if (!startDate || !endDate) {
      return loadCompanyPeriodKPIDataFallback();
    }
    const raw = await repositories.kpi.getCompanyKpi(startDate, endDate);
    const data = pickOrFallback(
      raw,
      value =>
        !!value &&
        !Array.isArray(value) &&
        [
          'proposals',
          'recommendations',
          'interviewsScheduled',
          'interviewsHeld',
          'offers',
          'accepts',
          'hires'
        ].every(key => Object.prototype.hasOwnProperty.call(value, key)),
      getCompanyPeriodFallbackData
    );
    updateCompanyPeriodDisplay(data);
    return data;
  } catch (error) {
    console.error('Failed to load company period KPI data:', error);
    return loadCompanyPeriodKPIDataFallback();
  }
}

function getCompanyKPIFallbackData() {
  const companyKPIData = {
    proposals: 127,
    recommendations: 89,
    interviewsScheduled: 156,
    interviewsHeld: 132,
    offers: 68,
    accepts: 41,
    hires: 28,
    proposalRate: 69,
    recommendationRate: 70,
    interviewScheduleRate: 175,
    interviewHeldRate: 85,
    offerRate: 52,
    acceptRate: 60,
    hireRate: 45
  };
  return companyKPIData;
}

function loadCompanyKPIDataFallback() {
  const fallback = getCompanyKPIFallbackData();
  updateCompanyKPIDisplay(fallback);
  companyKPIState = { ...fallback };
  return fallback;
}

function getCompanyPeriodFallbackData() {
  return {
    proposals: 240,
    recommendations: 180,
    interviewsScheduled: 210,
    interviewsHeld: 190,
    offers: 90,
    accepts: 62,
    hires: 48,
    proposalRate: 72,
    recommendationRate: 68,
    interviewScheduleRate: 120,
    interviewHeldRate: 90,
    offerRate: 55,
    acceptRate: 62,
    hireRate: 40
  };
}

function loadCompanyPeriodKPIDataFallback() {
  const fallback = getCompanyPeriodFallbackData();
  updateCompanyPeriodDisplay(fallback);
  return fallback;
}

// 社員データの読み込み
async function loadEmployeeData(rangeFilters = {}) {
  try {
    // APIから社員データを取得
    const filters = {
      search: '',
      sortBy: 'rate',
      sortOrder: 'desc'
    };
    if (rangeFilters.startDate) {
      filters.startDate = rangeFilters.startDate;
    }
    if (rangeFilters.endDate) {
      filters.endDate = rangeFilters.endDate;
    }
    const raw = await repositories.kpi.getEmployeePerformance(filters);
    const data = pickOrFallback(
      raw,
      value =>
        (Array.isArray(value) && value.length) ||
        (Array.isArray(value?.employees) && value.employees.length),
      getEmployeeFallbackData
    );
    
    // データを表示
    updateEmployeeDisplay(data);
    employeeListState = [...data];
    return data;
  } catch (error) {
    console.error('Failed to load employee data:', error);
    // フォールバック：モックデータを使用
    const employeeData = getEmployeeFallbackData();
    updateEmployeeDisplay(employeeData);
    employeeListState = [...employeeData];
    return employeeData;
  }
}

function getEmployeeFallbackData() {
  return [
    {
      name: '佐藤太郎',
      proposals: 25,
      recommendations: 18,
      interviewsScheduled: 22,
      interviewsHeld: 20,
      offers: 12,
      accepts: 8,
      proposalRate: 72,
      recommendationRate: 72,
      interviewScheduleRate: 122,
      interviewHeldRate: 91,
      offerRate: 60,
      acceptRate: 67
    },
    {
      name: '田中花子',
      proposals: 32,
      recommendations: 28,
      interviewsScheduled: 35,
      interviewsHeld: 31,
      offers: 18,
      accepts: 11,
      proposalRate: 89,
      recommendationRate: 88,
      interviewScheduleRate: 125,
      interviewHeldRate: 89,
      offerRate: 58,
      acceptRate: 61
    }
  ];
}

// 候補者データの読み込み
async function loadCandidateData() {
  // 既存のHTMLテーブルデータを使用
  console.log('Candidate data loaded from HTML table');
}

// 個人KPI表示の更新
// 社内KPI表示の更新
function updateCompanyKPIDisplay(data) {
  const elements = {
    companyProposals: data.proposals,
    companyRecommendations: data.recommendations,
    companyInterviewsScheduled: data.interviewsScheduled,
    companyInterviewsHeld: data.interviewsHeld,
    companyOffers: data.offers,
    companyAccepts: data.accepts,
    companyProposalRate: data.proposalRate + '%',
    companyRecommendationRate: data.recommendationRate + '%',
    companyInterviewScheduleRate: data.interviewScheduleRate + '%',
    companyInterviewHeldRate: data.interviewHeldRate + '%',
    companyOfferRate: data.offerRate + '%',
    companyAcceptRate: data.acceptRate + '%'
  };
  
  Object.entries(elements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });

  const cScope = document.querySelectorAll('.kpi-v2-section')[1];
  const c = data || {};
  const companyProposalCard = document.getElementById('companyProposalRate')?.closest('.kpi-v2-card');
  const companyRecommendationCard = document.getElementById('companyRecommendationRate')?.closest('.kpi-v2-card');
  const companyInterviewScheduleCard = document
    .getElementById('companyInterviewScheduleRate')
    ?.closest('.kpi-v2-card');
  const companyInterviewHeldCard = document.getElementById('companyInterviewHeldRate')?.closest('.kpi-v2-card');
  const companyOfferCard = document.getElementById('companyOfferRate')?.closest('.kpi-v2-card');
  const companyAcceptCard = document.getElementById('companyAcceptRate')?.closest('.kpi-v2-card');

  writeRateDetailInline(
    companyProposalCard,
    '提案数',
    c.proposals,
    '新規面談数',
    c.newInterviews,
    c.prevNewInterviews
  );
  writeRateDetailInline(
    companyRecommendationCard,
    '推薦数',
    c.recommendations,
    '提案数',
    c.proposals,
    c.prevProposals
  );
  writeRateDetailInline(
    companyInterviewScheduleCard,
    '面談設定数',
    c.interviewsScheduled,
    '推薦数',
    c.recommendations,
    c.prevRecommendations
  );
  writeRateDetailInline(
    companyInterviewHeldCard,
    '面談実施数',
    c.interviewsHeld,
    '面談設定数',
    c.interviewsScheduled,
    c.prevInterviewsScheduled
  );
  writeRateDetailInline(
    companyOfferCard,
    '内定数',
    c.offers,
    '面談実施数',
    c.interviewsHeld,
    c.prevInterviewsHeld
  );
  writeRateDetailInline(
    companyAcceptCard,
    '承諾数',
    c.accepts,
    '内定数',
    c.offers,
    c.prevOffers
  );

  const companyRatesRow = cScope?.querySelector(
    '.kpi-v2-subsection:nth-of-type(1) .kpi-v2-row[data-kpi-type="rates"]'
  );
  const companyHireCard = companyRatesRow?.querySelectorAll('.kpi-v2-card')[6];
  writeRateDetailInline(
    companyHireCard,
    '承諾数',
    c.accepts,
    '新規面談数',
    c.newInterviews,
    c.prevNewInterviews
  );
}

function updateCompanyPeriodDisplay(data) {
  if (!data) return;
  const countElements = {
    companyPeriodProposals: data.proposals ?? 0,
    companyPeriodRecommendations: data.recommendations ?? 0,
    companyPeriodInterviewsScheduled: data.interviewsScheduled ?? 0,
    companyPeriodInterviewsHeld: data.interviewsHeld ?? 0,
    companyPeriodOffers: data.offers ?? 0,
    companyPeriodAccepts: data.accepts ?? 0,
    companyPeriodHires: data.hires ?? 0
  };
  
  Object.entries(countElements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = Number(value || 0).toLocaleString();
    }
  });
  
  const rateElements = {
    companyPeriodProposalRate: `${data.proposalRate ?? 0}%`,
    companyPeriodRecommendationRate: `${data.recommendationRate ?? 0}%`,
    companyPeriodInterviewScheduleRate: `${data.interviewScheduleRate ?? 0}%`,
    companyPeriodInterviewHeldRate: `${data.interviewHeldRate ?? 0}%`,
    companyPeriodOfferRate: `${data.offerRate ?? 0}%`,
    companyPeriodAcceptRate: `${data.acceptRate ?? 0}%`,
    companyPeriodHireRate: `${data.hireRate ?? 0}%`
  };
  
  Object.entries(rateElements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });

  const section = document.querySelectorAll('.kpi-v2-section')[1];
  const d = data || {};
  const periodProposalCard = document.getElementById('companyPeriodProposalRate')?.closest('.kpi-v2-card');
  const periodRecommendationCard = document
    .getElementById('companyPeriodRecommendationRate')
    ?.closest('.kpi-v2-card');
  const periodInterviewScheduleCard = document
    .getElementById('companyPeriodInterviewScheduleRate')
    ?.closest('.kpi-v2-card');
  const periodInterviewHeldCard = document
    .getElementById('companyPeriodInterviewHeldRate')
    ?.closest('.kpi-v2-card');
  const periodOfferCard = document.getElementById('companyPeriodOfferRate')?.closest('.kpi-v2-card');
  const periodAcceptCard = document.getElementById('companyPeriodAcceptRate')?.closest('.kpi-v2-card');
  const periodHireCard = document.getElementById('companyPeriodHireRate')?.closest('.kpi-v2-card');

  writeRateDetailInline(
    periodProposalCard,
    '提案数',
    d.proposals,
    '新規面談数',
    d.newInterviews,
    d.prevNewInterviews
  );
  writeRateDetailInline(
    periodRecommendationCard,
    '推薦数',
    d.recommendations,
    '提案数',
    d.proposals,
    d.prevProposals
  );
  writeRateDetailInline(
    periodInterviewScheduleCard,
    '面談設定数',
    d.interviewsScheduled,
    '推薦数',
    d.recommendations,
    d.prevRecommendations
  );
  writeRateDetailInline(
    periodInterviewHeldCard,
    '面談実施数',
    d.interviewsHeld,
    '面談設定数',
    d.interviewsScheduled,
    d.prevInterviewsScheduled
  );
  writeRateDetailInline(
    periodOfferCard,
    '内定数',
    d.offers,
    '面談実施数',
    d.interviewsHeld,
    d.prevInterviewsHeld
  );
  writeRateDetailInline(
    periodAcceptCard,
    '承諾数',
    d.accepts,
    '内定数',
    d.offers,
    d.prevOffers
  );
  writeRateDetailInline(
    periodHireCard,
    '承諾数',
    d.accepts,
    '新規面談数',
    d.newInterviews,
    d.prevNewInterviews
  );
}

// 社員表示の更新
function updateEmployeeDisplay(data) {
  const tableBody = document.getElementById('employeeTableBody');
  if (!tableBody) return;
  
  const rows = Array.isArray(data) ? data : [];
  tableBody.innerHTML = rows.map(employee => `
    <tr>
      <td>${employee.name}</td>
      <td>${employee.proposals}</td>
      <td>${employee.recommendations}</td>
      <td>${employee.interviewsScheduled}</td>
      <td>${employee.interviewsHeld}</td>
      <td>${employee.offers}</td>
      <td>${employee.accepts}</td>
      <td>${employee.proposalRate}%</td>
      <td>${employee.recommendationRate}%</td>
      <td>${employee.interviewScheduleRate}%</td>
      <td>${employee.interviewHeldRate}%</td>
      <td>${employee.offerRate}%</td>
      <td>${employee.acceptRate}%</td>
    </tr>
  `).join('');
}

// 月次推移チャートの描画
function drawTrendChart(options = {}) {
  const { mode = 'rate', range = '6m' } = options;
  const svg = document.getElementById('personalTrendChart');
  if (!svg) return;
  const legend = document.getElementById('personalChartLegend');
  
  const labels = ['11月', '12月', '1月', '2月', '3月', '4月'];
  const rateSeries = {
    提案率: [62, 65, 63, 68, 70, 72],
    内定率: [40, 42, 38, 45, 47, 50],
    承諾率: [28, 30, 32, 34, 35, 37]
  };
  const countSeries = {
    提案数: [10, 12, 9, 14, 16, 13],
    内定数: [3, 4, 3, 5, 6, 5]
  };
  
  const series = mode === 'rate' ? rateSeries : countSeries;
  const entries = Object.entries(series);
  const palette = ['#6366f1', '#f97316', '#0ea5e9'];
  const width = 800;
  const height = 300;
  const paddingX = 60;
  const paddingY = 40;
  const chartHeight = height - paddingY * 2;
  const bottomY = paddingY + chartHeight;
  const xStep = labels.length > 1 ? (width - paddingX * 2) / (labels.length - 1) : 0;
  const allValues = entries.flatMap(([, data]) => data);
  const minValue = mode === 'rate' ? 0 : Math.min(...allValues, 0);
  const maxValue = Math.max(...allValues, mode === 'rate' ? 100 : Math.max(...allValues, 10));
  const rangeValue = maxValue - minValue || 1;
  
  const polylines = entries.map(([name, data], idx) => {
    const color = palette[idx % palette.length];
    const points = data.map((value, index) => {
      const x = paddingX + xStep * index;
      const normalized = (value - minValue) / rangeValue;
      const y = bottomY - normalized * chartHeight;
      return `${x},${y}`;
    }).join(' ');
    return `<polyline fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${points}" />`;
  }).join('');
  
  const xLabels = labels.map((label, idx) => {
    const x = paddingX + xStep * idx;
    return `<text x="${x}" y="${bottomY + 16}" text-anchor="middle" font-size="12" fill="#94a3b8">${label}</text>`;
  }).join('');
  
  svg.innerHTML = `
    <g>
      <text x="${width / 2}" y="24" text-anchor="middle" font-size="14" fill="#0f172a">個人${mode === 'rate' ? '歩留まり率' : '実績推移'} (${range})</text>
      <line x1="${paddingX}" y1="${paddingY}" x2="${paddingX}" y2="${bottomY}" stroke="#e2e8f0" stroke-width="1" />
      <line x1="${paddingX}" y1="${bottomY}" x2="${width - paddingX}" y2="${bottomY}" stroke="#e2e8f0" stroke-width="1" />
      ${polylines}
      ${xLabels}
      <text x="${width / 2}" y="${height - 8}" text-anchor="middle" font-size="11" fill="#94a3b8">※モックデータを表示しています</text>
    </g>
  `;
  
  if (legend) {
    const legendHtml = entries.map(([name], idx) => {
      const color = palette[idx % palette.length];
      return `
        <span class="inline-flex items-center gap-1">
          <span style="width:12px;height:12px;border-radius:9999px;background:${color};display:inline-block;"></span>
          <span>${name}</span>
        </span>
      `;
    }).join('');
    
    legend.innerHTML = `
      <div class="text-xs text-slate-500 mb-1">表示モード: ${mode === 'rate' ? '提案率〜承諾率' : '提案数〜内定数'}</div>
      <div class="text-xs text-slate-500 flex flex-wrap gap-3">${legendHtml}</div>
      <div class="text-xs text-slate-400">期間: ${range}</div>
    `;
  }
}

function drawCompanyTrend({ range = '6m', data } = {}) {
  const host = document.getElementById('companyTrendChart');
  if (!host) return;

  const labels = ['11月', '12月', '1月', '2月', '3月', '4月'];
  const snapshot = data || companyKPIState || DEFAULT_COMPANY_RATES;
  const rateConfigs = [
    { key: 'proposalRate', label: '提案率' },
    { key: 'recommendationRate', label: '推薦率' },
    { key: 'interviewScheduleRate', label: '面談設定率' },
    { key: 'interviewHeldRate', label: '面談実施率' },
    { key: 'offerRate', label: '内定率' },
    { key: 'acceptRate', label: '承諾率' }
  ];
  const seriesMap = {};
  rateConfigs.forEach((config, idx) => {
    const latest = snapshot[config.key] ?? (55 + idx * 5);
    seriesMap[config.label] = createAnchoredSeries(latest, labels.length, 2 + idx, idx);
  });
  
  host.innerHTML = createLineChartMarkup({
    title: `全体の歩留まり率 (${range})`,
    subtitle: '提案率〜承諾率（モックデータ）',
    labels,
    seriesMap
  });
}

function drawEmployeeComparisonTrend({ range = '6m', employees } = {}) {
  const host = document.getElementById('employeeTrendChart');
  if (!host) return;
  const labels = ['11月', '12月', '1月', '2月', '3月', '4月'];
  const sourceCandidates = Array.isArray(employees) && employees.length ? employees : employeeListState;
  const fallback = DEFAULT_EMPLOYEE_SERIES;
  const source = sourceCandidates.length ? sourceCandidates : fallback;
  if (!source || !source.length) {
    host.innerHTML = `<div class="text-sm text-slate-500">社員データが不足しています。</div>`;
    return;
  }
  
  const topEmployees = source.slice(0, 4);
  const seriesMap = {};
  topEmployees.forEach((employee, idx) => {
    const baseValue = employee.proposals || employee.recommendations || employee.offers || 6;
    seriesMap[employee.name] = createEmployeeSeries(baseValue, labels.length, idx);
  });
  
  host.innerHTML = createLineChartMarkup({
    title: `社員別比較推移 (${range})`,
    subtitle: '提案数ベースの簡易トレンド',
    labels,
    seriesMap
  });
}

function createLineChartMarkup({ title, subtitle = '', labels = [], seriesMap = {} }) {
  const entries = Object.entries(seriesMap).filter(([, data]) => Array.isArray(data) && data.length);
  if (!labels.length || !entries.length) {
    return `<div class="text-sm text-slate-500">${title || 'データが見つかりません。'}</div>`;
  }
  
  const width = 720;
  const height = 260;
  const paddingX = 50;
  const paddingY = 40;
  const palette = ['#6366f1', '#0ea5e9', '#f97316', '#22c55e', '#ec4899', '#a855f7', '#14b8a6'];
  const allValues = entries.flatMap(([, data]) => data);
  const minValue = Math.min(...allValues, 0);
  const maxValue = Math.max(...allValues, 1);
  const range = maxValue - minValue || 1;
  const chartHeight = height - paddingY * 1.5;
  const bottomY = paddingY + chartHeight;
  const xStep = labels.length > 1 ? (width - paddingX * 2) / (labels.length - 1) : 0;
  
  const polylines = entries.map(([name, data], idx) => {
    const color = palette[idx % palette.length];
    const points = data.map((value, index) => {
      const x = paddingX + xStep * index;
      const normalized = (value - minValue) / range;
      const y = bottomY - normalized * chartHeight;
      return `${x},${y}`;
    }).join(' ');
    return `<polyline fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${points}" />`;
  }).join('');
  
  const xLabels = labels.map((label, idx) => {
    const x = paddingX + xStep * idx;
    return `<text x="${x}" y="${bottomY + 16}" text-anchor="middle" font-size="12" fill="#94a3b8">${label}</text>`;
  }).join('');
  
  const svgMarkup = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <text x="${width / 2}" y="20" text-anchor="middle" font-size="14" fill="#0f172a">${title}</text>
      <line x1="${paddingX}" y1="${paddingY}" x2="${paddingX}" y2="${bottomY}" stroke="#e2e8f0" stroke-width="1" />
      <line x1="${paddingX}" y1="${bottomY}" x2="${width - paddingX}" y2="${bottomY}" stroke="#e2e8f0" stroke-width="1" />
      ${polylines}
      ${xLabels}
    </svg>
  `;
  
  const legend = entries.map(([name], idx) => {
    const color = palette[idx % palette.length];
    return `
      <span class="inline-flex items-center gap-1">
        <span style="width:12px;height:12px;border-radius:9999px;background:${color};display:inline-block;"></span>
        <span>${name}</span>
      </span>
    `;
  }).join('');
  
  return `
    <div class="space-y-2">
      ${svgMarkup}
      <div class="text-xs text-slate-500">${subtitle}</div>
      <div class="text-xs text-slate-500 flex flex-wrap gap-3">${legend}</div>
    </div>
  `;
}

function createAnchoredSeries(latest, length, spread = 2, seed = 0) {
  const safeLatest = Number.isFinite(latest) ? latest : 0;
  const result = [];
  for (let i = 0; i < length; i++) {
    const distance = length - 1 - i;
    const jitter = seed * 0.3;
    const value = safeLatest - distance * spread + jitter;
    result.push(Math.max(0, Math.round(value)));
  }
  return result;
}

function createEmployeeSeries(base, length, seed = 0) {
  const safeBase = Math.max(5, Number.isFinite(base) ? base : 5);
  const growth = 0.4 + seed * 0.08;
  const result = [];
  for (let i = 0; i < length; i++) {
    const progress = i / Math.max(1, length - 1);
    const value = safeBase * (0.5 + progress * growth);
    result.push(Math.max(0, Math.round(value)));
  }
  return result;
}

// イベントハンドラー
function handleDateRangeChange(event) {
  // 日付範囲変更時の処理
  loadYieldData();
}

function handleEmployeeSearch(event) {
  const searchTerm = event.target.value.toLowerCase();
  const rows = document.querySelectorAll('#employeeTableBody tr');
  
  rows.forEach(row => {
    const name = row.querySelector('td:first-child').textContent.toLowerCase();
    row.style.display = name.includes(searchTerm) ? '' : 'none';
  });
}

function handleEmployeeSort(event) {
  const sortBy = event.target.value;
  // ソート処理の実装
}

function handleFilterApply(event) {
  // フィルター適用処理
  applyFilters();
}

function handleFilterReset(event) {
  // フィルターリセット処理
  resetFilters();
}

function handleSortDirection(event) {
  const button = event.target;
  const currentOrder = button.dataset.order;
  const newOrder = currentOrder === 'desc' ? 'asc' : 'desc';
  
  button.dataset.order = newOrder;
  button.textContent = newOrder === 'desc' ? '降順' : '昇順';
  
  // ソート処理の実行
  applySorting();
}

function handleContactFieldClick(event) {
  const field = event.target;
  const type = field.dataset.type;
  const fullValue = field.dataset.full;
  const maskedValue = field.dataset.masked;
  
  // 権限チェック（実際の実装では認証システムと連携）
  const hasPermission = checkContactPermission();
  
  if (hasPermission) {
    field.textContent = field.textContent === fullValue ? maskedValue : fullValue;
  } else {
    alert('連絡先情報を表示する権限がありません。');
  }
}

// ユーティリティ関数
function applyFilters() {
  const candidateName = document.getElementById('filterCandidateName')?.value || '';
  const company = document.getElementById('filterCompany')?.value || '';
  const owner = document.getElementById('filterOwner')?.value || '';
  const dateFrom = document.getElementById('filterInitialFrom')?.value || '';
  const dateTo = document.getElementById('filterInitialTo')?.value || '';
  const phases = Array.from(document.querySelectorAll('.phase-filter:checked')).map(cb => cb.value);
  
  const rows = document.querySelectorAll('.candidate-row');
  
  rows.forEach(row => {
    let show = true;
    
    if (candidateName && !row.dataset.name.toLowerCase().includes(candidateName.toLowerCase())) {
      show = false;
    }
    
    if (company && company !== 'すべて' && row.dataset.company !== company) {
      show = false;
    }
    
    if (owner && owner !== 'すべて' && row.dataset.owner !== owner) {
      show = false;
    }
    
    if (dateFrom && row.dataset.initial < dateFrom) {
      show = false;
    }
    
    if (dateTo && row.dataset.initial > dateTo) {
      show = false;
    }
    
    if (phases.length > 0 && !phases.includes(row.dataset.phase)) {
      show = false;
    }
    
    row.style.display = show ? '' : 'none';
  });
}

function resetFilters() {
  document.getElementById('filterCandidateName').value = '';
  document.getElementById('filterCompany').value = '';
  document.getElementById('filterOwner').value = '';
  document.getElementById('filterInitialFrom').value = '';
  document.getElementById('filterInitialTo').value = '';
  
  document.querySelectorAll('.phase-filter').forEach(cb => {
    cb.checked = ['新規面談', '面接前'].includes(cb.value);
  });
  
  document.querySelectorAll('.candidate-row').forEach(row => {
    row.style.display = '';
  });
}

function applySorting() {
  // ソート処理の実装
}

function checkContactPermission() {
  // 実際の権限チェックロジック
  // 今はダミーでtrueを返す
  return true;
}

function cleanupEventListeners() {
  // イベントリスナーのクリーンアップ
}

function cleanupCharts() {
  // チャートのクリーンアップ
}
