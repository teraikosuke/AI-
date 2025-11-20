// Yield Page JavaScript Module
import { RepositoryFactory } from '../../scripts/api/index.js';
import { hasRole } from '../../scripts/auth.js';

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
let isAdminUser = false;
let personalTrendRows = [];
let companyTrendRows = [];
const now = new Date();
const defaultTrendYear = now.getFullYear();
const defaultTrendMonth = now.getMonth() + 1;
const personalTrendMode = {
  valueMode: 'rate',
  periodMode: 'day',
  monthSelection: { year: defaultTrendYear, month: defaultTrendMonth },
  yearSelection: defaultTrendYear
};
const companyTrendMode = {
  periodMode: 'day',
  monthSelection: { year: defaultTrendYear, month: defaultTrendMonth },
  yearSelection: defaultTrendYear
};
let personalTrendOptions = { years: [], monthsByYear: new Map(), latest: null };
let companyTrendOptions = { years: [], monthsByYear: new Map(), latest: null };

function getCurrentMonthRange() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
}

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

function syncAccessRole() {
  isAdminUser = hasRole('admin');
  toggleEmployeeSections(isAdminUser);
}

function toggleEmployeeSections(shouldShow) {
  const employeeSection = document.getElementById('employeeTableBody')?.closest('.kpi-v2-subsection');
  if (employeeSection) {
    employeeSection.hidden = !shouldShow;
  }
  const employeeTrendContainer =
    document.getElementById('employeeTrendChart')?.closest('.kpi-v2-chart-container') ||
    document.getElementById('employeeTrendChart');
  if (employeeTrendContainer) {
    employeeTrendContainer.hidden = !shouldShow;
  }
  if (!shouldShow) {
    updateEmployeeDisplay([]);
    clearEmployeeTrendChart();
  }
}

function clearEmployeeTrendChart() {
  const host = document.getElementById('employeeTrendChart');
  if (host) {
    host.innerHTML = '';
  }
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

const PERSONAL_TREND_LABELS = ['11月', '12月', '1月', '2月', '3月', '4月'];
const PERSONAL_RATE_SERIES = {
  提案率: [62, 65, 63, 68, 70, 72],
  内定率: [40, 42, 38, 45, 47, 50],
  承諾率: [28, 30, 32, 34, 35, 37]
};
const PERSONAL_COUNT_SERIES = {
  提案数: [10, 12, 9, 14, 16, 13],
  内定数: [3, 4, 3, 5, 6, 5]
};

export function mount() {
  syncAccessRole();
  safe('initializeDatePickers', initializeDatePickers);
  safe('initTodayGoals', initTodayGoals);
  safe('initPeriodKPI', initPeriodKPI);
  safe('initCompanyPeriodKPI', initCompanyPeriodKPI);
  safe('initEmployeePeriodPreset', initEmployeePeriodPreset);
  safe('initializeKPICharts', initializeKPICharts);
  safe('initializeTrendControls', initializeTrendControls);
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
  renderPersonalTrendChart();
  renderCompanyTrendCharts({ rangeLabel: '6m', employeeData: DEFAULT_EMPLOYEE_SERIES });
}

function initializeTrendControls() {
  initPersonalTrendControls();
  initCompanyTrendControls();
}

function initPersonalTrendControls() {
  const modeContainer = document.getElementById('personalTrendMode');
  if (modeContainer) {
    modeContainer.querySelectorAll('[data-period-mode]').forEach(button => {
      button.addEventListener('click', () => {
        const mode = button.dataset.periodMode;
        if (!mode || personalTrendMode.periodMode === mode) return;
        personalTrendMode.periodMode = mode;
        updatePersonalTrendModeButtons();
        updatePersonalTrendControlVisibility();
        renderPersonalTrendChart();
      });
    });
    updatePersonalTrendModeButtons();
  }
  const yearSelect = document.getElementById('personalTrendYearSelect');
  const monthSelect = document.getElementById('personalTrendMonthSelect');
  const yearOnlySelect = document.getElementById('personalTrendYearOnlySelect');
  yearSelect?.addEventListener('change', () => {
    personalTrendMode.monthSelection.year = Number(yearSelect.value) || personalTrendMode.monthSelection.year;
    refreshPersonalMonthOptions();
    renderPersonalTrendChart();
  });
  monthSelect?.addEventListener('change', () => {
    personalTrendMode.monthSelection.month = Number(monthSelect.value) || personalTrendMode.monthSelection.month;
    renderPersonalTrendChart();
  });
  yearOnlySelect?.addEventListener('change', () => {
    personalTrendMode.yearSelection = Number(yearOnlySelect.value) || personalTrendMode.yearSelection;
    renderPersonalTrendChart();
  });
  refreshPersonalTrendSelectors();
  updatePersonalTrendControlVisibility();
}

function initCompanyTrendControls() {
  const modeContainer = document.getElementById('companyTrendMode');
  if (modeContainer) {
    modeContainer.querySelectorAll('[data-company-period]').forEach(button => {
      button.addEventListener('click', () => {
        const mode = button.dataset.companyPeriod;
        if (!mode || companyTrendMode.periodMode === mode) return;
        companyTrendMode.periodMode = mode;
        updateCompanyTrendModeButtons();
        updateCompanyTrendControlVisibility();
        renderCompanyTrendCharts();
      });
    });
    updateCompanyTrendModeButtons();
  }
  const yearSelect = document.getElementById('companyTrendYearSelect');
  const monthSelect = document.getElementById('companyTrendMonthSelect');
  const yearOnlySelect = document.getElementById('companyTrendYearOnlySelect');
  yearSelect?.addEventListener('change', () => {
    companyTrendMode.monthSelection.year = Number(yearSelect.value) || companyTrendMode.monthSelection.year;
    refreshCompanyMonthOptions();
    renderCompanyTrendCharts();
  });
  monthSelect?.addEventListener('change', () => {
    companyTrendMode.monthSelection.month = Number(monthSelect.value) || companyTrendMode.monthSelection.month;
    renderCompanyTrendCharts();
  });
  yearOnlySelect?.addEventListener('change', () => {
    companyTrendMode.yearSelection = Number(yearOnlySelect.value) || companyTrendMode.yearSelection;
    renderCompanyTrendCharts();
  });
  refreshCompanyTrendSelectors();
  updateCompanyTrendControlVisibility();
}

function updatePersonalTrendModeButtons() {
  const buttons = document.querySelectorAll('#personalTrendMode [data-period-mode]');
  buttons.forEach(button => {
    const mode = button.dataset.periodMode;
    button.classList.toggle('active', mode === personalTrendMode.periodMode);
  });
}

function updatePersonalTrendControlVisibility() {
  const monthControls = document.getElementById('personalTrendMonthControls');
  const yearControls = document.getElementById('personalTrendYearControls');
  if (monthControls) {
    monthControls.classList.toggle('is-active', personalTrendMode.periodMode === 'month');
  }
  if (yearControls) {
    yearControls.classList.toggle('is-active', personalTrendMode.periodMode === 'year');
  }
}

function refreshPersonalTrendSelectors() {
  personalTrendOptions = buildYearMonthSummary(personalTrendRows);
  const years = personalTrendOptions.years;
  const latestYear = personalTrendOptions.latest?.year ?? personalTrendMode.monthSelection.year;
  const latestMonth = personalTrendOptions.latest?.month ?? personalTrendMode.monthSelection.month;
  if (!years.includes(personalTrendMode.monthSelection.year) && years.length) {
    personalTrendMode.monthSelection.year = latestYear;
  }
  if (!years.includes(personalTrendMode.yearSelection) && years.length) {
    personalTrendMode.yearSelection = latestYear;
  }
  const resolvedYear = populateSelectOptions(
    document.getElementById('personalTrendYearSelect'),
    years,
    personalTrendMode.monthSelection.year,
    value => `${value}年`
  );
  if (resolvedYear !== null) {
    personalTrendMode.monthSelection.year = Number(resolvedYear);
  }
  refreshPersonalMonthOptions(latestMonth);
  const resolvedYearOnly = populateSelectOptions(
    document.getElementById('personalTrendYearOnlySelect'),
    years,
    personalTrendMode.yearSelection,
    value => `${value}年`
  );
  if (resolvedYearOnly !== null) {
    personalTrendMode.yearSelection = Number(resolvedYearOnly);
  }
}

function refreshPersonalMonthOptions(fallbackMonth) {
  const monthSelect = document.getElementById('personalTrendMonthSelect');
  const year = personalTrendMode.monthSelection.year;
  const months = personalTrendOptions.monthsByYear.get(year) || [];
  let activeMonth = personalTrendMode.monthSelection.month;
  if (!months.includes(activeMonth) && months.length) {
    activeMonth = fallbackMonth && months.includes(fallbackMonth) ? fallbackMonth : months[months.length - 1];
    personalTrendMode.monthSelection.month = activeMonth;
  }
  const resolvedMonth = populateSelectOptions(
    monthSelect,
    months,
    personalTrendMode.monthSelection.month,
    value => `${String(value).padStart(2, '0')}月`
  );
  if (resolvedMonth !== null) {
    personalTrendMode.monthSelection.month = Number(resolvedMonth);
  }
  if (monthSelect) {
    monthSelect.disabled = months.length === 0;
  }
}

function renderPersonalTrendChart() {
  drawTrendChart({
    mode: 'rate',
    range: getPersonalTrendRangeLabel(),
    periodMode: personalTrendMode.periodMode,
    monthSelection: { ...personalTrendMode.monthSelection },
    yearSelection: personalTrendMode.yearSelection
  });
}

function updateCompanyTrendModeButtons() {
  const buttons = document.querySelectorAll('#companyTrendMode [data-company-period]');
  buttons.forEach(button => {
    const mode = button.dataset.companyPeriod;
    button.classList.toggle('active', mode === companyTrendMode.periodMode);
  });
}

function updateCompanyTrendControlVisibility() {
  const monthControls = document.getElementById('companyTrendMonthControls');
  const yearControls = document.getElementById('companyTrendYearControls');
  if (monthControls) {
    monthControls.classList.toggle('is-active', companyTrendMode.periodMode === 'month');
  }
  if (yearControls) {
    yearControls.classList.toggle('is-active', companyTrendMode.periodMode === 'year');
  }
}

function refreshCompanyTrendSelectors() {
  companyTrendOptions = buildYearMonthSummary(companyTrendRows);
  const years = companyTrendOptions.years;
  const latestYear = companyTrendOptions.latest?.year ?? companyTrendMode.monthSelection.year;
  const latestMonth = companyTrendOptions.latest?.month ?? companyTrendMode.monthSelection.month;
  if (!years.includes(companyTrendMode.monthSelection.year) && years.length) {
    companyTrendMode.monthSelection.year = latestYear;
  }
  if (!years.includes(companyTrendMode.yearSelection) && years.length) {
    companyTrendMode.yearSelection = latestYear;
  }
  const resolvedYear = populateSelectOptions(
    document.getElementById('companyTrendYearSelect'),
    years,
    companyTrendMode.monthSelection.year,
    value => `${value}年`
  );
  if (resolvedYear !== null) {
    companyTrendMode.monthSelection.year = Number(resolvedYear);
  }
  refreshCompanyMonthOptions(latestMonth);
  const resolvedYearOnly = populateSelectOptions(
    document.getElementById('companyTrendYearOnlySelect'),
    years,
    companyTrendMode.yearSelection,
    value => `${value}年`
  );
  if (resolvedYearOnly !== null) {
    companyTrendMode.yearSelection = Number(resolvedYearOnly);
  }
}

function refreshCompanyMonthOptions(fallbackMonth) {
  const monthSelect = document.getElementById('companyTrendMonthSelect');
  const year = companyTrendMode.monthSelection.year;
  const months = companyTrendOptions.monthsByYear.get(year) || [];
  let activeMonth = companyTrendMode.monthSelection.month;
  if (!months.includes(activeMonth) && months.length) {
    activeMonth = fallbackMonth && months.includes(fallbackMonth) ? fallbackMonth : months[months.length - 1];
    companyTrendMode.monthSelection.month = activeMonth;
  }
  const resolvedMonth = populateSelectOptions(
    monthSelect,
    months,
    companyTrendMode.monthSelection.month,
    value => `${String(value).padStart(2, '0')}月`
  );
  if (resolvedMonth !== null) {
    companyTrendMode.monthSelection.month = Number(resolvedMonth);
  }
  if (monthSelect) {
    monthSelect.disabled = months.length === 0;
  }
}

function renderCompanyTrendCharts({ companyData, employeeData, rangeLabel } = {}) {
  const label = rangeLabel || getCompanyTrendRangeLabel();
  drawCompanyTrend({
    range: label,
    data: companyData,
    periodMode: companyTrendMode.periodMode,
    monthSelection: { ...companyTrendMode.monthSelection },
    yearSelection: companyTrendMode.yearSelection
  });
  if (isAdminUser) {
    drawEmployeeComparisonTrend({
      range: label,
      employees: employeeData || employeeListState,
      periodMode: companyTrendMode.periodMode,
      monthSelection: { ...companyTrendMode.monthSelection },
      yearSelection: companyTrendMode.yearSelection
    });
  } else {
    clearEmployeeTrendChart();
  }
}

// 社員コントロールの初期化
function initializeEmployeeControls() {
  if (!isAdminUser) return;
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
      newInterviews:
        fallback.newInterviews ??
        fallback.new_interviews ??
        fallback.proposals ??
        0,
      proposals: fallback.proposals ?? 0,
      recommendations: fallback.recommendations ?? 0,
      interviewsScheduled: fallback.interviewsScheduled ?? fallback.interviews_scheduled ?? 0,
      interviewsHeld: fallback.interviewsHeld ?? fallback.interviews_held ?? 0,
      offers: fallback.offers ?? 0,
      accepts: fallback.accepts ?? fallback.hires ?? 0,
      hires: fallback.hires ?? fallback.accepts ?? 0
    };
  }
  
  const metrics = [
    { key: 'newInterviews', elementId: 'todayProposals', goalKey: 'proposals' },
    { key: 'proposals', elementId: 'todayRecommendations', goalKey: 'recommendations' },
    { key: 'recommendations', elementId: 'todayInterviewsScheduled', goalKey: 'interviewsScheduled' },
    { key: 'interviewsScheduled', elementId: 'todayInterviewsHeld', goalKey: 'interviewsHeld' },
    { key: 'interviewsHeld', elementId: 'todayOffers', goalKey: 'offers' },
    { key: 'offers', elementId: 'todayAccepts', goalKey: 'accepts' },
    { key: 'accepts', elementId: 'todayHires', goalKey: 'hires' }
  ];
  const goals = JSON.parse(localStorage.getItem(TODAY_GOAL_KEY) || '{}');
  
  metrics.forEach(({ key, elementId, goalKey }) => {
    const current = todayKPIState?.[key] ?? 0;
    const rawTarget = goals[goalKey ?? key];
    const target = Number(rawTarget);
    const hasValidTarget = Number.isFinite(target) && target > 0;
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = current.toLocaleString();
    }
    const achv = document.querySelector(`[data-ref="todayAchv-${goalKey ?? key}"]`);
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
  
  const countMetricMap = [
    { domKey: 'proposals', valueKey: 'newInterviews' },
    { domKey: 'recommendations', valueKey: 'proposals' },
    { domKey: 'interviewsScheduled', valueKey: 'recommendations' },
    { domKey: 'interviewsHeld', valueKey: 'interviewsScheduled' },
    { domKey: 'offers', valueKey: 'interviewsHeld' },
    { domKey: 'accepts', valueKey: 'offers' },
    { domKey: 'hires', valueKey: 'accepts' }
  ];
  const rateMetricMap = [
    { domKey: 'proposalRate', valueKey: 'proposalRate' },
    { domKey: 'recommendationRate', valueKey: 'recommendationRate' },
    { domKey: 'interviewScheduleRate', valueKey: 'interviewScheduleRate' },
    { domKey: 'interviewHeldRate', valueKey: 'interviewHeldRate' },
    { domKey: 'offerRate', valueKey: 'offerRate' },
    { domKey: 'acceptRate', valueKey: 'acceptRate' },
    { domKey: 'hireRate', valueKey: 'hireRate' }
  ];
  const monthMetrics = [...countMetricMap, ...rateMetricMap];
  
  monthMetrics.forEach(({ domKey, valueKey }) => {
    const current = monthlyKPIState?.[valueKey] ?? 0;
    const rawTarget = goals[domKey];
    const target = Number(rawTarget);
    const hasValidTarget = Number.isFinite(target) && target > 0;
    const achv = document.querySelector(`[data-ref="monthlyAchv-${domKey}"]`);
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
  if (!isAdminUser) return;
  const presetContainer = document.getElementById('employeePeriodPresets');
  if (!presetContainer) return;
  const buttons = presetContainer.querySelectorAll('.period-preset-btn.employee');
  const startInput = document.getElementById('employeeRangeStart');
  const endInput = document.getElementById('employeeRangeEnd');
  const applyButton = document.getElementById('employeeRangeApply');

  const setRange = months => {
    const baseEnd = new Date();
    const start = new Date(baseEnd.getFullYear(), baseEnd.getMonth(), baseEnd.getDate());
    start.setMonth(start.getMonth() - months);
    employeePeriodRange = {
      startDate: start.toISOString().split('T')[0],
      endDate: baseEnd.toISOString().split('T')[0]
    };
    if (startInput) startInput.value = employeePeriodRange.startDate;
    if (endInput) endInput.value = employeePeriodRange.endDate;
  };
  const setCustomRange = (startValue, endValue) => {
    if (!startValue || !endValue) return false;
    if (new Date(startValue) > new Date(endValue)) return false;
    employeePeriodRange = {
      startDate: startValue,
      endDate: endValue
    };
    if (startInput) startInput.value = startValue;
    if (endInput) endInput.value = endValue;
    buttons.forEach(btn => btn.classList.remove('active'));
    return true;
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

  applyButton?.addEventListener('click', () => {
    const startVal = startInput?.value;
    const endVal = endInput?.value;
    if (setCustomRange(startVal, endVal)) {
      loadEmployeeData(employeePeriodRange);
    }
  });

  [startInput, endInput].forEach(input => {
    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyButton?.click();
      }
    });
  });

  if (buttons.length) {
    buttons[0].classList.add('active');
    const months = parseInt(buttons[0].dataset.range, 10) || 1;
    setRange(months);
  } else {
    const currentRange = getCurrentMonthRange();
    setCustomRange(currentRange.startDate, currentRange.endDate);
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
    // 個人成績データの読み込み
    const personalData = await loadPersonalKPIData();
    const monthlyData = await loadMonthToDatePersonalKPIData();
    updatePersonalTrendRows(personalData, monthlyData);
    if (personalData) {
      updateTodayKPI(personalData);
      updatePersonalKPIDisplay(personalData, monthlyData);
    }
    if (monthlyData) {
      updateMonthlyKPI(monthlyData);
    }
    renderPersonalTrendChart();
    
    // 社内成績データの読み込み
    const companyData = await loadCompanyKPIData();
    updateCompanyTrendRows(companyData);
    await loadCompanyPeriodKPIData();
    
    let employeeData = [];
    if (isAdminUser) {
      employeeData = await loadEmployeeData(
        employeePeriodRange.startDate
          ? { startDate: employeePeriodRange.startDate, endDate: employeePeriodRange.endDate }
          : {}
      );
    } else {
      employeeListState = [];
      updateEmployeeDisplay([]);
    }
    
    // 候補者データの読み込み
    await loadCandidateData();
    
    renderCompanyTrendCharts({
      companyData,
      employeeData
    });
    
  } catch (error) {
    console.error('Failed to load yield data:', error);
  }
}

// 個人KPIデータの読み込み
async function loadPersonalKPIData() {
  try {
    const startDate = document.getElementById('personalRangeStart')?.value || '2025-01-01';
    const endDate = document.getElementById('personalRangeEnd')?.value || new Date().toISOString().split('T')[0];
    const raw = await repositories.kpi.getPersonalKpi(startDate, endDate);
    return pickOrFallback(
      raw,
      value => !!value && !Array.isArray(value) && !!value.monthly && !!value.period,
      getPersonalKPIFallbackData
    );
  } catch (error) {
    console.error('Failed to load personal KPI data:', error);
    return getPersonalKPIFallbackData();
  }
}

function getPersonalKPIFallbackData() {
  const zero = {
    newInterviews: 0,
    proposals: 0,
    recommendations: 0,
    interviewsScheduled: 0,
    interviewsHeld: 0,
    offers: 0,
    accepts: 0,
    hires: 0,
    prevNewInterviews: 0,
    prevProposals: 0,
    prevRecommendations: 0,
    prevInterviewsScheduled: 0,
    prevInterviewsHeld: 0,
    prevOffers: 0,
    proposalRate: 0,
    recommendationRate: 0,
    interviewScheduleRate: 0,
    interviewHeldRate: 0,
    offerRate: 0,
    acceptRate: 0,
    hireRate: 0
  };
  return {
    achievementRate: 0,
    currentAmount: 0,
    targetAmount: 0,
    rows: [],
    today: {
      newInterviews: 0,
      proposals: 0,
      recommendations: 0,
      interviewsScheduled: 0,
      interviewsHeld: 0,
      offers: 0,
      accepts: 0,
      hires: 0
    },
    monthly: { ...zero },
    period: { ...zero }
  };
}

async function loadMonthToDatePersonalKPIData() {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startDate = startOfMonth.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];
    const raw = await repositories.kpi.getPersonalKpi(startDate, endDate);
    return pickOrFallback(
      raw,
      value => !!value && !Array.isArray(value) && !!value.monthly && !!value.period,
      getPersonalKPIFallbackData
    );
  } catch (error) {
    console.error('Failed to load month-to-date personal KPI data:', error);
    return getPersonalKPIFallbackData();
  }
}

// 個人KPIデータを表示に反映
function updatePersonalKPIDisplay(rangeData, monthOverride) {
  if (!rangeData && !monthOverride) return;
  const fallback = getPersonalKPIFallbackData();
  const monthlyData = monthOverride?.monthly || monthOverride || rangeData?.monthly || rangeData || fallback;
  const periodData = rangeData?.period || rangeData || fallback;
  const summarySource = {
    achievementRate: monthOverride?.achievementRate ?? rangeData?.achievementRate ?? 0,
    currentAmount: monthOverride?.currentAmount ?? rangeData?.currentAmount ?? 0,
    targetAmount: monthOverride?.targetAmount ?? rangeData?.targetAmount ?? 0
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
  
  const monthlyCountMap = [
    { id: 'personalProposals', valueKey: 'newInterviews' },
    { id: 'personalRecommendations', valueKey: 'proposals' },
    { id: 'personalInterviewsScheduled', valueKey: 'recommendations' },
    { id: 'personalInterviewsHeld', valueKey: 'interviewsScheduled' },
    { id: 'personalOffers', valueKey: 'interviewsHeld' },
    { id: 'personalAccepts', valueKey: 'offers' },
    { id: 'personalHires', valueKey: 'accepts' }
  ];
  monthlyCountMap.forEach(({ id, valueKey }) => {
    const element = document.getElementById(id);
    if (element) {
      const value = num(monthlyData?.[valueKey]);
      element.textContent = value.toLocaleString();
    }
  });
  const monthlyRateElements = {
    personalProposalRate: `${monthlyData.proposalRate || 0}%`,
    personalRecommendationRate: `${monthlyData.recommendationRate || 0}%`,
    personalInterviewScheduleRate: `${monthlyData.interviewScheduleRate || 0}%`,
    personalInterviewHeldRate: `${monthlyData.interviewHeldRate || 0}%`,
    personalOfferRate: `${monthlyData.offerRate || 0}%`,
    personalAcceptRate: `${monthlyData.acceptRate || 0}%`,
    personalHireRate: `${monthlyData.hireRate || 0}%`
  };
  Object.entries(monthlyRateElements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });
  
  const periodCountMap = [
    { id: 'periodProposals', valueKey: 'newInterviews' },
    { id: 'periodRecommendations', valueKey: 'proposals' },
    { id: 'periodInterviewsScheduled', valueKey: 'recommendations' },
    { id: 'periodInterviewsHeld', valueKey: 'interviewsScheduled' },
    { id: 'periodOffers', valueKey: 'interviewsHeld' },
    { id: 'periodAccepts', valueKey: 'offers' },
    { id: 'periodHires', valueKey: 'accepts' }
  ];
  periodCountMap.forEach(({ id, valueKey }) => {
    const element = document.getElementById(id);
    if (element) {
      const value = num(periodData?.[valueKey]);
      element.textContent = value.toLocaleString();
    }
  });
  const periodRateElements = {
    periodProposalRate: `${periodData.proposalRate || 0}%`,
    periodRecommendationRate: `${periodData.recommendationRate || 0}%`,
    periodInterviewScheduleRate: `${periodData.interviewScheduleRate || 0}%`,
    periodInterviewHeldRate: `${periodData.interviewHeldRate || 0}%`,
    periodOfferRate: `${periodData.offerRate || 0}%`,
    periodAcceptRate: `${periodData.acceptRate || 0}%`,
    periodHireRate: `${periodData.hireRate || 0}%`
  };
  Object.entries(periodRateElements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
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
    const data = raw && !Array.isArray(raw) ? raw : getCompanyKPIFallbackData();

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
    const data = raw && !Array.isArray(raw) ? raw : getCompanyPeriodFallbackData();
    updateCompanyPeriodDisplay(data);
    return data;
  } catch (error) {
    console.error('Failed to load company period KPI data:', error);
    return loadCompanyPeriodKPIDataFallback();
  }
}

function getCompanyKPIFallbackData() {
  const companyKPIData = {
    newInterviews: 127,
    proposals: 89,
    recommendations: 156,
    interviewsScheduled: 132,
    interviewsHeld: 68,
    offers: 41,
    accepts: 28,
    hires: 28,
    prevNewInterviews: 0,
    prevProposals: 0,
    prevRecommendations: 0,
    prevInterviewsScheduled: 0,
    prevInterviewsHeld: 0,
    prevOffers: 0,
    proposalRate: 69,
    recommendationRate: 70,
    interviewScheduleRate: 175,
    interviewHeldRate: 85,
    offerRate: 52,
    acceptRate: 60,
    hireRate: 45,
    rows: []
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
    newInterviews: 240,
    proposals: 180,
    recommendations: 210,
    interviewsScheduled: 190,
    interviewsHeld: 150,
    offers: 90,
    accepts: 62,
    hires: 62,
    prevNewInterviews: 0,
    prevProposals: 0,
    prevRecommendations: 0,
    prevInterviewsScheduled: 0,
    prevInterviewsHeld: 0,
    prevOffers: 0,
    proposalRate: 72,
    recommendationRate: 68,
    interviewScheduleRate: 120,
    interviewHeldRate: 90,
    offerRate: 55,
    acceptRate: 62,
    hireRate: 40,
    rows: []
  };
}

function loadCompanyPeriodKPIDataFallback() {
  const fallback = getCompanyPeriodFallbackData();
  updateCompanyPeriodDisplay(fallback);
  return fallback;
}

// 社員データの読み込み
async function loadEmployeeData(rangeFilters = {}) {
  if (!isAdminUser) {
    return [];
  }
  try {
    // APIから社員データを取得
    const filters = {
      search: '',
      sortBy: 'rate',
      sortOrder: 'desc'
    };
    const range = rangeFilters.startDate
      ? rangeFilters
      : employeePeriodRange.startDate
        ? employeePeriodRange
        : getCurrentMonthRange();
    employeePeriodRange = { ...range };
    const startInput = document.getElementById('employeeRangeStart');
    const endInput = document.getElementById('employeeRangeEnd');
    if (startInput && range.startDate) startInput.value = range.startDate;
    if (endInput && range.endDate) endInput.value = range.endDate;
    if (range.startDate) filters.from = range.startDate;
    if (range.endDate) filters.to = range.endDate;
    const raw = await repositories.kpi.getEmployeePerformance(filters);
    const data = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.employees)
        ? raw.employees
        : [];
    
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

function extractTrendRows(candidate) {
  if (!candidate) return [];
  const rows = Array.isArray(candidate.rows) ? candidate.rows : [];
  return rows.filter(Boolean);
}

function updatePersonalTrendRows(...candidates) {
  const next = candidates
    .map(extractTrendRows)
    .find(rows => rows.length > 1);
  personalTrendRows = next || [];
  refreshPersonalTrendSelectors();
}

function updateCompanyTrendRows(candidate) {
  const rows = extractTrendRows(candidate);
  companyTrendRows = rows.length > 1 ? rows : [];
  refreshCompanyTrendSelectors();
}

// 個人KPI表示の更新
// 社内KPI表示の更新
function updateCompanyKPIDisplay(data) {
  const countMap = [
    { id: 'companyProposals', valueKey: 'newInterviews' },
    { id: 'companyRecommendations', valueKey: 'proposals' },
    { id: 'companyInterviewsScheduled', valueKey: 'recommendations' },
    { id: 'companyInterviewsHeld', valueKey: 'interviewsScheduled' },
    { id: 'companyOffers', valueKey: 'interviewsHeld' },
    { id: 'companyAccepts', valueKey: 'offers' },
    { id: 'companyHires', valueKey: 'accepts' }
  ];
  countMap.forEach(({ id, valueKey }) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = num(data?.[valueKey]).toLocaleString();
    }
  });

  const rateElements = {
    companyProposalRate: `${data.proposalRate ?? 0}%`,
    companyRecommendationRate: `${data.recommendationRate ?? 0}%`,
    companyInterviewScheduleRate: `${data.interviewScheduleRate ?? 0}%`,
    companyInterviewHeldRate: `${data.interviewHeldRate ?? 0}%`,
    companyOfferRate: `${data.offerRate ?? 0}%`,
    companyAcceptRate: `${data.acceptRate ?? 0}%`,
    companyHireRate: `${data.hireRate ?? 0}%`
  };
  Object.entries(rateElements).forEach(([id, value]) => {
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
  const countMap = [
    { id: 'companyPeriodProposals', valueKey: 'newInterviews' },
    { id: 'companyPeriodRecommendations', valueKey: 'proposals' },
    { id: 'companyPeriodInterviewsScheduled', valueKey: 'recommendations' },
    { id: 'companyPeriodInterviewsHeld', valueKey: 'interviewsScheduled' },
    { id: 'companyPeriodOffers', valueKey: 'interviewsHeld' },
    { id: 'companyPeriodAccepts', valueKey: 'offers' },
    { id: 'companyPeriodHires', valueKey: 'accepts' }
  ];
  countMap.forEach(({ id, valueKey }) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = num(data?.[valueKey]).toLocaleString();
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
  const { mode = 'rate', range = '6m', periodMode = 'day', monthSelection, yearSelection } = options;
  const svg = document.getElementById('personalTrendChart');
  if (!svg) return;
  const legend = document.getElementById('personalChartLegend');
  const actualSeries = resolvePersonalTrendSeries({ mode, periodMode, monthSelection, yearSelection });
  const fallback = getPersonalTrendFallback(mode);
  const labels = actualSeries?.labels ?? fallback.labels;
  const series = actualSeries?.series ?? fallback.series;
  const entries = Object.entries(series);
  if (!labels.length || !entries.length) return;
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
      ${actualSeries ? '' : `<text x="${width / 2}" y="${height - 8}" text-anchor="middle" font-size="11" fill="#94a3b8">※モックデータを表示しています</text>`}
    </g>
  `;
  
  if (legend) {
    const periodLabelMap = { day: '日次', month: '月次', year: '年次' };
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
      <div class="text-xs text-slate-500 mb-1">表示モード: ${
        mode === 'rate' ? '提案率〜承諾率' : '提案数〜内定数'
      } / ${periodLabelMap[periodMode] || '日次'}</div>
      <div class="text-xs text-slate-500 flex flex-wrap gap-3">${legendHtml}</div>
      <div class="text-xs text-slate-400">期間: ${range}</div>
      <div class="text-xs text-slate-400">${actualSeries ? 'APIデータから描画しています' : 'モックデータから描画しています'}</div>
    `;
  }
}

function drawCompanyTrend({ range = '6m', data, periodMode = 'day', monthSelection, yearSelection } = {}) {
  const host = document.getElementById('companyTrendChart');
  if (!host) return;
  if (!companyTrendRows.length && Array.isArray(data?.rows) && data.rows.length > 1) {
    companyTrendRows = [...data.rows];
    refreshCompanyTrendSelectors();
  }

  const actualSeries = resolveCompanyTrendSeries({ periodMode, monthSelection, yearSelection });
  if (actualSeries) {
    host.innerHTML = createLineChartMarkup({
      title: `全体の歩留まり率 (${range})`,
      subtitle: `APIデータ / ${periodMode === 'day' ? '日次' : periodMode === 'month' ? '月次' : '年次'}`,
      labels: actualSeries.labels,
      seriesMap: actualSeries.series
    });
    return;
  }

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

function drawEmployeeComparisonTrend({ range = '6m', employees, periodMode = 'day', monthSelection, yearSelection } = {}) {
  if (!isAdminUser) return;
  const host = document.getElementById('employeeTrendChart');
  if (!host) return;
  const sourceCandidates = Array.isArray(employees) && employees.length ? employees : employeeListState;
  const actualSeries = buildEmployeeTrendSeries(sourceCandidates, {
    periodMode,
    monthSelection,
    yearSelection
  });
  if (actualSeries) {
    host.innerHTML = createLineChartMarkup({
      title: `社員別比較推移 (${range})`,
      subtitle: `${periodMode === 'day' ? '日次' : periodMode === 'month' ? '月次' : '年次'}の比較`,
      labels: actualSeries.labels,
      seriesMap: actualSeries.series
    });
    return;
  }

  const fallbackLabels = ['11月', '12月', '1月', '2月', '3月', '4月'];
  const fallbackSource = sourceCandidates.length ? sourceCandidates : DEFAULT_EMPLOYEE_SERIES;
  const safeSource = fallbackSource.length ? fallbackSource : DEFAULT_EMPLOYEE_SERIES;
  const topEmployees = safeSource.slice(0, 4);
  if (!topEmployees.length) {
    host.innerHTML = `<div class="text-sm text-slate-500">社員データが不足しています。</div>`;
    return;
  }

  const seriesMap = {};
  topEmployees.forEach((employee, idx) => {
    const baseValue = employee.proposals || employee.recommendations || employee.offers || 6;
    seriesMap[employee.name] = createEmployeeSeries(baseValue, fallbackLabels.length, idx);
  });

  host.innerHTML = createLineChartMarkup({
    title: `社員別比較推移 (${range})`,
    subtitle: '提案数ベースの簡易モックトレンド',
    labels: fallbackLabels,
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

function getPersonalTrendFallback(mode) {
  const baseSeries = mode === 'rate' ? PERSONAL_RATE_SERIES : PERSONAL_COUNT_SERIES;
  const labels = [...PERSONAL_TREND_LABELS];
  const series = Object.fromEntries(
    Object.entries(baseSeries).map(([label, values]) => [label, [...values]])
  );
  return { labels, series };
}

function buildPersonalTrendSeriesFromRows(mode, sourceRows = personalTrendRows) {
  const rows = Array.isArray(sourceRows) ? sourceRows : [];
  if (rows.length < 2) return null;
  const entries = createSortedTrendEntries(rows);
  if (entries.length < 2) return null;
  const labels = entries.map(entry => entry.label);
  const configs =
    mode === 'rate'
      ? [
          { key: 'proposal_rate', label: '提案率' },
          { key: 'offer_rate', label: '内定率' },
          { key: 'accept_rate', label: '承諾率' }
        ]
      : [
          { key: 'proposals', label: '提案数' },
          { key: 'offers', label: '内定数' }
        ];
  const series = {};
  configs.forEach(config => {
    const values = entries.map(entry => readRowMetric(entry.row, config.key));
    if (values.some(value => Number.isFinite(value))) {
      series[config.label] = values.map(value => num(value));
    }
  });
  return Object.keys(series).length ? { labels, series } : null;
}

function buildCompanyTrendSeriesFromRows(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const entries = createSortedTrendEntries(rows);
  if (!entries.length) return null;
  const labels = entries.map(entry => entry.label);
  const configs = [
    { key: 'proposal_rate', label: '提案率' },
    { key: 'recommendation_rate', label: '推薦率' },
    { key: 'interview_schedule_rate', label: '面談設定率' },
    { key: 'interview_held_rate', label: '面談実施率' },
    { key: 'offer_rate', label: '内定率' },
    { key: 'accept_rate', label: '承諾率' }
  ];
  const series = {};
  configs.forEach(config => {
    const values = entries.map(entry => readRowMetric(entry.row, config.key));
    if (values.some(value => Number.isFinite(value))) {
      series[config.label] = values.map(value => num(value));
    }
  });
  return Object.keys(series).length ? { labels, series } : null;
}

function buildEmployeeTrendSeries(employees = [], options = {}) {
  const datasets = (Array.isArray(employees) ? employees : [])
    .slice(0, 4)
    .map(employee => ({
      name: employee?.name || '社員',
      points: extractEmployeeTrendPoints(employee, options)
    }))
    .filter(item => Array.isArray(item.points) && item.points.length > 1);
  if (!datasets.length) return null;

  const labelMeta = new Map();
  datasets.forEach(dataset => {
    dataset.points.forEach(point => {
      if (!labelMeta.has(point.label) || point.sortValue < labelMeta.get(point.label).sortValue) {
        labelMeta.set(point.label, { label: point.label, sortValue: point.sortValue });
      }
    });
  });

  const labels = Array.from(labelMeta.values())
    .sort((a, b) => (a.sortValue === b.sortValue ? a.label.localeCompare(b.label) : a.sortValue - b.sortValue))
    .map(entry => entry.label);

  if (labels.length < 2) return null;

  const series = {};
  datasets.forEach(dataset => {
    const valueMap = new Map(dataset.points.map(point => [point.label, point.value]));
    series[dataset.name] = labels.map(label => num(valueMap.get(label)));
  });
  return Object.keys(series).length ? { labels, series } : null;
}

function extractEmployeeTrendPoints(employee, options = {}) {
  if (!employee) return null;
  const trendSource =
    (Array.isArray(employee.trend) && employee.trend.length && employee.trend) ||
    (Array.isArray(employee.history) && employee.history.length && employee.history) ||
    (Array.isArray(employee.metricsHistory) && employee.metricsHistory.length && employee.metricsHistory) ||
    (Array.isArray(employee.metrics_history) && employee.metrics_history.length && employee.metrics_history) ||
    null;
  if (!trendSource) return null;
  const points = trendSource
    .map((point, index) => {
      const labelHint = point?.period ?? point?.month ?? point?.date ?? point?.label ?? point?.timestamp;
      const { label, sortValue } = parseTrendLabelValue(labelHint, index);
      const valueSource =
        point?.value ??
        point?.proposals ??
        point?.recommendations ??
        point?.offers ??
        point?.accepts ??
        point?.count ??
        point?.metrics;
      return { label, sortValue, value: num(valueSource), rawValue: labelHint };
    })
    .filter(point => Number.isFinite(point.value));
  if (points.length < 2) return null;
  points.sort((a, b) => (a.sortValue === b.sortValue ? a.label.localeCompare(b.label) : a.sortValue - b.sortValue));
  if (options.periodMode === 'month') {
    const aggregated = aggregateEmployeePointsByMonth(points);
    const limited = filterMonthlyEntriesBySelection(aggregated, options.monthSelection);
    return limited.length >= 2 ? limited : aggregated;
  }
  if (options.periodMode === 'year') {
    const aggregated = aggregateEmployeePointsByMonth(points);
    const targetYear =
      Number(options.yearSelection) || companyTrendMode.yearSelection || aggregated[aggregated.length - 1]?.year;
    const filtered = aggregated.filter(point => point.year === targetYear);
    return filtered.length >= 2 ? filtered : aggregated;
  }
  return points;
}

function createSortedTrendEntries(rows, labelSelector = defaultRowLabelSelector) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, index) => {
      const rawLabel = labelSelector(row);
      const { label, sortValue } = parseTrendLabelValue(rawLabel, index);
      return { row, label, sortValue, index };
    })
    .sort((a, b) => {
      if (a.sortValue === b.sortValue) {
        return a.index - b.index;
      }
      return a.sortValue - b.sortValue;
    });
}

function defaultRowLabelSelector(row) {
  return row?.period ?? row?.month ?? row?.date ?? row?.label ?? row?.timestamp;
}

function parseTrendLabelValue(rawValue, fallbackIndex = 0) {
  if (rawValue instanceof Date) {
    const time = rawValue.getTime();
    if (!Number.isNaN(time)) {
      return { label: formatMonthYearLabel(rawValue), sortValue: time };
  }
  }
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    if (rawValue > 10000) {
      const fromTimestamp = new Date(rawValue);
      if (!Number.isNaN(fromTimestamp.getTime())) {
        return { label: formatMonthYearLabel(fromTimestamp), sortValue: fromTimestamp.getTime() };
      }
    }
    return { label: String(rawValue), sortValue: rawValue };
  }
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (trimmed) {
      const normalized = trimmed.replace(/\./g, '-').replace(/\//g, '-');
      if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        const date = new Date(`${normalized}T00:00:00Z`);
        if (!Number.isNaN(date.getTime())) {
          return { label: formatMonthYearLabel(date), sortValue: date.getTime() };
        }
      }
      if (/^\d{4}-\d{2}$/.test(normalized)) {
        const date = new Date(`${normalized}-01T00:00:00Z`);
        if (!Number.isNaN(date.getTime())) {
          return { label: formatMonthYearLabel(date), sortValue: date.getTime() };
        }
      }
      if (/^\d{6}$/.test(normalized)) {
        const year = Number(normalized.slice(0, 4));
        const month = Number(normalized.slice(4));
        const date = new Date(Date.UTC(year, month - 1, 1));
        if (!Number.isNaN(date.getTime())) {
          return { label: formatMonthYearLabel(date), sortValue: date.getTime() };
        }
      }
      const jpMatch = trimmed.match(/^(\d{4})年(\d{1,2})月$/);
      if (jpMatch) {
        const year = Number(jpMatch[1]);
        const month = Number(jpMatch[2]);
        const date = new Date(Date.UTC(year, month - 1, 1));
        if (!Number.isNaN(date.getTime())) {
          return { label: formatMonthYearLabel(date), sortValue: date.getTime() };
        }
      }
      return { label: trimmed, sortValue: fallbackIndex };
    }
  }
  return { label: `#${fallbackIndex + 1}`, sortValue: fallbackIndex };
}

function formatMonthYearLabel(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}/${month}`;
}

function readRowMetric(row, key) {
  if (!row) return 0;
  const candidates = [key];
  if (key.includes('_')) {
    candidates.push(snakeToCamel(key));
  } else if (/[A-Z]/.test(key)) {
    candidates.push(camelToSnake(key));
  }
  for (const candidate of candidates) {
    if (row[candidate] !== undefined && row[candidate] !== null) {
      return num(row[candidate]);
    }
  }
  return 0;
}

function snakeToCamel(value) {
  return value.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

function camelToSnake(value) {
  return value.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function buildYearMonthSummary(rows = []) {
  const monthsByYear = new Map();
  let latest = null;
  let latestSort = -Infinity;
  rows.forEach(row => {
    const date = extractRowDate(row);
    if (!date) return;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const sortValue = year * 100 + month;
    if (!monthsByYear.has(year)) {
      monthsByYear.set(year, new Set());
    }
    monthsByYear.get(year).add(month);
    if (sortValue > latestSort) {
      latestSort = sortValue;
      latest = { year, month };
    }
  });
  const years = Array.from(monthsByYear.keys()).sort((a, b) => b - a);
  const normalizedMonths = new Map();
  monthsByYear.forEach((set, year) => {
    normalizedMonths.set(year, Array.from(set).sort((a, b) => a - b));
  });
  return { years, monthsByYear: normalizedMonths, latest };
}

function populateSelectOptions(select, options, preferredValue, labelFormatter = value => value) {
  if (!select) return null;
  if (!Array.isArray(options) || options.length === 0) {
    select.innerHTML = '<option value="">--</option>';
    select.value = '';
    select.disabled = true;
    return null;
  }
  select.disabled = false;
  const template = options
    .map(value => `<option value="${value}">${labelFormatter(value)}</option>`)
    .join('');
  select.innerHTML = template;
  const normalizedValue = options.includes(preferredValue) ? preferredValue : options[0];
  select.value = normalizedValue;
  return normalizedValue;
}

function getPersonalTrendRangeLabel() {
  if (personalTrendMode.periodMode === 'day') {
    const start = document.getElementById('personalRangeStart')?.value;
    const end = document.getElementById('personalRangeEnd')?.value;
    return start && end ? `${start}〜${end}` : '日次カスタム';
  }
  if (personalTrendMode.periodMode === 'month') {
    const year = personalTrendMode.monthSelection.year ?? defaultTrendYear;
    const month = personalTrendMode.monthSelection.month ?? defaultTrendMonth;
    return `月次 ${year}/${String(month).padStart(2, '0')}`;
  }
  const year = personalTrendMode.yearSelection ?? defaultTrendYear;
  return `${year}年の月次`;
}

function getCompanyTrendRangeLabel() {
  if (companyTrendMode.periodMode === 'day') {
    const start = document.getElementById('companyRangeStart')?.value;
    const end = document.getElementById('companyRangeEnd')?.value;
    return start && end ? `${start}〜${end}` : '日次カスタム';
  }
  if (companyTrendMode.periodMode === 'month') {
    const year = companyTrendMode.monthSelection.year ?? defaultTrendYear;
    const month = companyTrendMode.monthSelection.month ?? defaultTrendMonth;
    return `月次 ${year}/${String(month).padStart(2, '0')}`;
  }
  const year = companyTrendMode.yearSelection ?? defaultTrendYear;
  return `${year}年の月次`;
}

function extractRowDate(row) {
  if (!row) return null;
  const candidates = [row.date, row.period, row.timestamp];
  for (const candidate of candidates) {
    const parsed = parseDateCandidate(candidate);
    if (parsed) return parsed;
  }
  return null;
}

function parseDateCandidate(candidate) {
  if (!candidate) return null;
  if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) {
    return candidate;
  }
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    const date = new Date(candidate);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof candidate === 'string') {
    const normalized = candidate.replace(/\./g, '-').replace(/\//g, '-');
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      const date = new Date(`${normalized}T00:00:00Z`);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (/^\d{4}-\d{2}$/.test(normalized)) {
      const date = new Date(`${normalized}-01T00:00:00Z`);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (/^\d{4}$/.test(normalized)) {
      const date = new Date(`${normalized}-01-01T00:00:00Z`);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  return null;
}

const MONTH_MODE_WINDOW = 12;

function aggregateRowsByMonth(rows = []) {
  const buckets = new Map();
  rows.forEach(row => {
    const date = extractRowDate(row);
    if (!date) return;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        year,
        month,
        sortValue: year * 100 + month,
        newInterviews: 0,
        proposals: 0,
        recommendations: 0,
        interviewsScheduled: 0,
        interviewsHeld: 0,
        offers: 0,
        accepts: 0
      });
    }
    const bucket = buckets.get(key);
    bucket.newInterviews += num(row.newInterviews ?? row.new_interviews);
    bucket.proposals += num(row.proposals);
    bucket.recommendations += num(row.recommendations);
    bucket.interviewsScheduled += num(row.interviewsScheduled ?? row.interviews_scheduled);
    bucket.interviewsHeld += num(row.interviewsHeld ?? row.interviews_held);
    bucket.offers += num(row.offers);
    bucket.accepts += num(row.accepts ?? row.hires);
  });
  return Array.from(buckets.values())
    .map(bucket => createAggregatedTrendRow(bucket))
    .sort((a, b) => a.sortValue - b.sortValue);
}

function createAggregatedTrendRow(bucket) {
  const toRate = (num, den) => (den === 0 ? 0 : Math.round((1000 * num) / den) / 10);
  const period = `${bucket.year}-${String(bucket.month).padStart(2, '0')}-01`;
  const base = {
    ...bucket,
    period,
    date: period,
    label: period,
    hires: bucket.accepts,
    new_interviews: bucket.newInterviews,
    interviews_scheduled: bucket.interviewsScheduled,
    interviews_held: bucket.interviewsHeld
  };
  const withRates = {
    ...base,
    proposalRate: toRate(bucket.proposals, bucket.newInterviews),
    proposal_rate: toRate(bucket.proposals, bucket.newInterviews),
    recommendationRate: toRate(bucket.recommendations, bucket.proposals),
    recommendation_rate: toRate(bucket.recommendations, bucket.proposals),
    interviewScheduleRate: toRate(bucket.interviewsScheduled, bucket.recommendations),
    interview_schedule_rate: toRate(bucket.interviewsScheduled, bucket.recommendations),
    interviewHeldRate: toRate(bucket.interviewsHeld, bucket.interviewsScheduled),
    interview_held_rate: toRate(bucket.interviewsHeld, bucket.interviewsScheduled),
    offerRate: toRate(bucket.offers, bucket.interviewsHeld),
    offer_rate: toRate(bucket.offers, bucket.interviewsHeld),
    acceptRate: toRate(bucket.accepts, bucket.offers),
    accept_rate: toRate(bucket.accepts, bucket.offers),
    hireRate: toRate(bucket.accepts, bucket.newInterviews),
    hire_rate: toRate(bucket.accepts, bucket.newInterviews)
  };
  return withRates;
}

function filterMonthlyEntriesBySelection(entries = [], selection) {
  if (!entries.length) return [];
  const sortValue =
    selection && Number.isFinite(Number(selection.year)) && Number.isFinite(Number(selection.month))
      ? Number(selection.year) * 100 + Number(selection.month)
      : null;
  const filtered =
    sortValue !== null
      ? entries.filter(entry => entry.sortValue <= sortValue)
      : [...entries];
  const usable = filtered.length >= 2 ? filtered : entries;
  if (usable.length <= MONTH_MODE_WINDOW) {
    return usable;
  }
  return usable.slice(usable.length - MONTH_MODE_WINDOW);
}

function resolvePersonalTrendSeries({ mode, periodMode, monthSelection, yearSelection }) {
  if (periodMode === 'day') {
    return buildPersonalTrendSeriesFromRows(mode);
  }
  const monthlyRows = aggregateRowsByMonth(personalTrendRows);
  if (!monthlyRows.length) {
    return null;
  }
  if (periodMode === 'month') {
    const limited = filterMonthlyEntriesBySelection(monthlyRows, monthSelection);
    return limited.length >= 2 ? buildPersonalTrendSeriesFromRows(mode, limited) : null;
  }
  if (periodMode === 'year') {
    const targetYear =
      Number(yearSelection) || personalTrendMode.yearSelection || monthlyRows[monthlyRows.length - 1]?.year;
    const filtered = monthlyRows.filter(entry => entry.year === targetYear);
    if (filtered.length >= 2) {
      return buildPersonalTrendSeriesFromRows(mode, filtered);
    }
    const fallback = monthlyRows.slice(-Math.min(monthlyRows.length, MONTH_MODE_WINDOW));
    return fallback.length >= 2 ? buildPersonalTrendSeriesFromRows(mode, fallback) : null;
  }
  return null;
}

function resolveCompanyTrendSeries({ periodMode, monthSelection, yearSelection }) {
  const sourceRows =
    (Array.isArray(companyTrendRows) && companyTrendRows.length > 1 && companyTrendRows) ||
    (Array.isArray(companyKPIState?.rows) && companyKPIState.rows.length > 1 && companyKPIState.rows) ||
    [];
  if (!sourceRows.length) return null;
  if (periodMode === 'day') {
    return buildCompanyTrendSeriesFromRows(sourceRows);
  }
  const monthlyRows = aggregateRowsByMonth(sourceRows);
  if (!monthlyRows.length) return null;
  if (periodMode === 'month') {
    const limited = filterMonthlyEntriesBySelection(monthlyRows, monthSelection);
    return limited.length >= 2 ? buildCompanyTrendSeriesFromRows(limited) : null;
  }
  if (periodMode === 'year') {
    const year = Number(yearSelection) || companyTrendMode.yearSelection || monthlyRows[monthlyRows.length - 1]?.year;
    const filtered = monthlyRows.filter(entry => entry.year === year);
    if (filtered.length >= 2) {
      return buildCompanyTrendSeriesFromRows(filtered);
    }
    const fallback = monthlyRows.slice(-Math.min(monthlyRows.length, MONTH_MODE_WINDOW));
    return fallback.length >= 2 ? buildCompanyTrendSeriesFromRows(fallback) : null;
  }
  return null;
}

function aggregateEmployeePointsByMonth(points = []) {
  const buckets = new Map();
  points.forEach(point => {
    const date = resolvePointDate(point);
    if (!date) return;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = `${year}-${month}`;
    if (!buckets.has(key)) {
      buckets.set(key, { year, month, sortValue: year * 100 + month, value: 0 });
    }
    const bucket = buckets.get(key);
    bucket.value += num(point.value);
  });
  return Array.from(buckets.values())
    .map(bucket => ({
      label: `${bucket.year}/${String(bucket.month).padStart(2, '0')}`,
      sortValue: bucket.sortValue,
      value: bucket.value,
      year: bucket.year,
      month: bucket.month
    }))
    .sort((a, b) => a.sortValue - b.sortValue);
}

function resolvePointDate(point) {
  const raw = point?.rawValue ?? point?.label;
  return (
    parseDateCandidate(raw) ||
    (typeof point?.sortValue === 'number' && point.sortValue > 1_000_000_000 ? new Date(point.sortValue) : null)
  );
}

// イベントハンドラー
function handleDateRangeChange(event) {
  // 日付範囲変更時の処理
  loadYieldData();
}

function handleEmployeeSearch(event) {
  const searchTerm = event.target.value.toLowerCase();
  employeeListState.forEach(employee => {
    employee.hiddenBySearch = !employee.name?.toLowerCase().includes(searchTerm);
  });
  updateEmployeeDisplay(employeeListState);
}

function handleEmployeeSort(event) {
  const sortBy = event.target.value;
  const sorted = [...employeeListState];
  sorted.sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (typeof aVal === 'string') return aVal.localeCompare(bVal);
    return (Number(aVal) || 0) - (Number(bVal) || 0);
  });
  employeeListState = sorted;
  updateEmployeeDisplay(employeeListState);
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
