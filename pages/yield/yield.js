// Yield Page JavaScript Module
import { RepositoryFactory } from '../../scripts/api/index.js';
import { hasRole } from '../../scripts/auth.js';

const repositories = RepositoryFactory.create();

const TODAY_GOAL_KEY = 'todayGoals.v1';
const MONTHLY_GOAL_KEY = 'monthlyGoals.v1';
let todayKPIState = null;
let monthlyKPIState = null;
let todayGoalsInitialized = false;
let monthlyGoalsInitialized = false;
let employeeListState = [];
let employeePeriodRange = { startDate: '', endDate: '' };
let isAdminUser = false;
const employeeFilters = { search: '', sortKey: 'name', sortOrder: 'asc' };

const RATE_KEYS = ['提案率', '推薦率', '面談設定率', '面談実施率', '内定率', '承諾率', '決定率'];
const DASHBOARD_YEARS = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];
const DASHBOARD_MONTHS = Array.from({ length: 12 }, (_, idx) => idx + 1);
const DASHBOARD_COLORS = ['#2563eb', '#0ea5e9', '#10b981', '#f97316', '#8b5cf6', '#14b8a6', '#ec4899'];
const dashboardState = {
  personal: {
    trendMode: 'month',
    year: DASHBOARD_YEARS[0],
    month: new Date().getMonth() + 1,
    charts: {}
  },
  company: {
    trendMode: 'month',
    year: DASHBOARD_YEARS[0],
    month: new Date().getMonth() + 1,
    charts: {}
  }
};

const mockDashboardData = {
  personal: {
    baseRates: {
      提案率: 62,
      推薦率: 58,
      面談設定率: 72,
      面談実施率: 65,
      内定率: 48,
      承諾率: 42,
      決定率: 35
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
      面談設定率: 80,
      面談実施率: 70,
      内定率: 52,
      承諾率: 46,
      決定率: 40
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

let chartJsPromise = null;

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
  if (!shouldShow) {
    employeeListState = [];
    renderEmployeeRows([]);
  }
}

function setupRangePresets({ buttonSelector, startInputId, endInputId, onApply }) {
  const buttons = document.querySelectorAll(buttonSelector);
  const startInput = document.getElementById(startInputId);
  const endInput = document.getElementById(endInputId);
  if (!buttons.length || !startInput || !endInput) {
    return;
  }

  const applyRange = (rawRange, shouldNotify = true) => {
    const months = parseInt(rawRange, 10) || 0;
    const baseEnd = endInput.value ? new Date(endInput.value) : new Date();
    const normalizedEnd = new Date(baseEnd.getFullYear(), baseEnd.getMonth(), baseEnd.getDate());
    if (!endInput.value) {
      endInput.value = normalizedEnd.toISOString().split('T')[0];
    }
    const startDate = new Date(normalizedEnd.getTime());
    startDate.setMonth(startDate.getMonth() - months);
    startInput.value = startDate.toISOString().split('T')[0];
    if (shouldNotify && typeof onApply === 'function') {
      onApply(startInput.value, endInput.value);
    }
  };

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      buttons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      applyRange(button.dataset.range);
    });
  });

  if (buttons[0] && !buttons[0].classList.contains('active')) {
    buttons[0].classList.add('active');
  }

  if (buttons[0]?.dataset.range) {
    applyRange(buttons[0].dataset.range, false);
  }

}

function ensureChartJs() {
  if (window.Chart) {
    return Promise.resolve(window.Chart);
  }
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

function initializeDashboardSection() {
  const panels = Array.from(document.querySelectorAll('.dashboard-panel[data-dashboard-scope]'));
  const scopes = Array.from(
    new Set(
      panels
        .map(panel => panel.dataset.dashboardScope)
        .filter(scope => scope && dashboardState[scope])
    )
  );
  if (!scopes.length) return;
  ensureChartJs()
    .then(() => {
      scopes.forEach(scope => {
        setupDashboardControls(scope);
        renderDashboardCharts(scope);
      });
    })
    .catch(error => {
      console.error('[yield] failed to load Chart.js', error);
    });
}

function setupDashboardControls(scope) {
  populateDashboardSelects(scope);
  const tabGroup = document.querySelector(`[data-trend-tabs="${scope}"]`);
  tabGroup?.querySelectorAll('.dashboard-tab').forEach(button => {
    button.addEventListener('click', () => {
      if (button.classList.contains('is-active')) return;
      tabGroup.querySelectorAll('.dashboard-tab').forEach(btn => btn.classList.remove('is-active'));
      button.classList.add('is-active');
      dashboardState[scope].trendMode = button.dataset.mode === 'year' ? 'year' : 'month';
      updateTrendSelectState(scope);
      renderTrendChart(scope);
    });
  });

  const yearSelect = document.getElementById(`${scope}TrendYearSelect`);
  const monthSelect = document.getElementById(`${scope}TrendMonthSelect`);
  yearSelect?.addEventListener('change', () => {
    const selectedYear = Number(yearSelect.value) || dashboardState[scope].year;
    dashboardState[scope].year = selectedYear;
    renderTrendChart(scope);
  });
  monthSelect?.addEventListener('change', () => {
    const selectedMonth = Number(monthSelect.value) || dashboardState[scope].month;
    dashboardState[scope].month = selectedMonth;
    if (dashboardState[scope].trendMode === 'month') {
      renderTrendChart(scope);
    }
  });
  updateTrendSelectState(scope);
}

function populateDashboardSelects(scope) {
  const yearSelect = document.getElementById(`${scope}TrendYearSelect`);
  const monthSelect = document.getElementById(`${scope}TrendMonthSelect`);
  if (yearSelect) {
    yearSelect.innerHTML = DASHBOARD_YEARS.map(year => `<option value="${year}">${year}年</option>`).join('');
    yearSelect.value = `${dashboardState[scope].year}`;
  }
  if (monthSelect) {
    monthSelect.innerHTML = DASHBOARD_MONTHS.map(month => `<option value="${month}">${String(month).padStart(2, '0')}月</option>`).join('');
    monthSelect.value = `${dashboardState[scope].month}`;
  }
}

function updateTrendSelectState(scope) {
  const monthSelect = document.getElementById(`${scope}TrendMonthSelect`);
  if (!monthSelect) return;
  const isMonthly = dashboardState[scope].trendMode === 'month';
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
  dashboardState[scope].charts[`${scope}TrendChart`] = new Chart(canvas, {
    type: 'line',
    data: config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true } }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => `${value}%`
          },
          suggestedMax: 100
        }
      }
    }
  });
}

function renderCategoryChart({ scope, chartId, datasetKey, type }) {
  const canvas = document.getElementById(chartId);
  const dataset = mockDashboardData[scope]?.[datasetKey];
  if (!canvas || !dataset || !window.Chart) return;
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
    plugins: {
      legend: { position: 'bottom' }
    },
    scales: type === 'doughnut'
      ? {}
      : {
          x: { ticks: { font: { size: 11 } } },
          y: { beginAtZero: true }
        }
  };
  dashboardState[scope].charts[chartId] = new Chart(canvas, {
    type,
    data,
    options: type === 'doughnut' ? { ...options, cutout: '55%' } : options
  });
}

function buildTrendChartConfig(scope) {
  const state = dashboardState[scope];
  const labels = state.trendMode === 'month'
    ? createTrendDayLabels(state.year, state.month)
    : DASHBOARD_MONTHS.map(month => `${month}月`);
  const datasets = RATE_KEYS.map((label, idx) => ({
    label,
    data: labels.map((_, index) => generateRateValue(scope, label, state.trendMode, index, idx)),
    borderColor: DASHBOARD_COLORS[idx % DASHBOARD_COLORS.length],
    backgroundColor: hexToRgba(DASHBOARD_COLORS[idx % DASHBOARD_COLORS.length], 0.15),
    tension: 0.35,
    fill: false,
    pointRadius: 2,
    pointHoverRadius: 4
  }));
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
  const charts = dashboardState[scope].charts;
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

function setCardAchievementProgress(achvElement, percentValue) {
  if (!achvElement) return;
  const card = achvElement.closest('.kpi-v2-card');
  if (!card) return;
  const numeric = Number(percentValue);
  const safeValue = Number.isFinite(numeric) ? numeric : 0;
  const normalized = Math.max(0, Math.min(safeValue, 100));
  card.style.setProperty('--achv-progress', `${normalized}%`);
}

function initializeKpiTabs() {
  const groups = document.querySelectorAll('.kpi-tab-group[data-kpi-tab-group]');
  groups.forEach(group => {
    const section = group.closest('.kpi-v2-section');
    if (!section) return;
    const tabs = Array.from(group.querySelectorAll('.kpi-tab[data-kpi-tab]'));
    const panels = Array.from(section.querySelectorAll('.kpi-tab-panel[data-kpi-tab-panel]'));

    const activate = tabId => {
      tabs.forEach(btn => {
        const isActive = btn.dataset.kpiTab === tabId;
        btn.classList.toggle('is-active', isActive);
      });
      panels.forEach(panel => {
        const match = panel.dataset.kpiTabPanel === tabId;
        panel.classList.toggle('is-hidden', !match);
      });
    };

    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.kpiTab;
        if (!id) return;
        activate(id);
      });
    });

    const initial = tabs.find(btn => btn.classList.contains('is-active')) || tabs[0];
    if (initial) {
      activate(initial.dataset.kpiTab);
    }
  });
}

export function mount() {
  syncAccessRole();
  safe('initializeDatePickers', initializeDatePickers);
  safe('initTodayGoals', initTodayGoals);
  safe('initPeriodKPI', initPeriodKPI);
  safe('initCompanyPeriodKPI', initCompanyPeriodKPI);
  safe('initEmployeePeriodPreset', initEmployeePeriodPreset);
  safe('initializeEmployeeControls', initializeEmployeeControls);
  safe('loadYieldData', loadYieldData);
  safe('initializeDashboardSection', initializeDashboardSection);
  safe('initializeKpiTabs', initializeKpiTabs);
}

export function unmount() {}

// 日付選択器の初期化
function initializeDatePickers() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const personalRangeStart = document.getElementById('personalRangeStart');
  const personalRangeEnd = document.getElementById('personalRangeEnd');
  const companyPeriodStart = document.getElementById('companyPeriodStart');
  const companyPeriodEnd = document.getElementById('companyPeriodEnd');
  
  if (personalRangeStart) personalRangeStart.value = thirtyDaysAgo;
  if (personalRangeEnd) personalRangeEnd.value = today;
  if (companyPeriodEnd) companyPeriodEnd.value = today;
  if (companyPeriodStart) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    companyPeriodStart.value = ninetyDaysAgo;
  }
  
  // 日付変更イベントリスナー
  [personalRangeStart, personalRangeEnd].forEach(input => {
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

function initializeEmployeeControls() {
  if (!isAdminUser) return;
  const searchInput = document.getElementById('employeeSearchInput');
  const searchButton = document.getElementById('employeeSearchButton');
  const sortSelect = document.getElementById('employeeSortSelect');
  
  if (searchInput && searchButton) {
    const triggerSearch = () => {
      handleEmployeeSearch(searchInput.value);
    };
    searchButton.addEventListener('click', triggerSearch);
    searchInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        triggerSearch();
      }
    });
  }
  
  if (sortSelect) {
    sortSelect.addEventListener('change', handleEmployeeSort);
  }
  
}

// フィルターの初期化
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
      if (hasValidTarget) {
        const percent = Math.round((current / target) * 100);
        achv.textContent = `${percent}%`;
        setCardAchievementProgress(achv, percent);
      } else {
        achv.textContent = '--%';
        setCardAchievementProgress(achv, 0);
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
    if (hasValidTarget) {
      const percent = Math.round((current / target) * 100);
      achv.textContent = `${percent}%`;
      setCardAchievementProgress(achv, percent);
    } else {
      achv.textContent = '--%';
      setCardAchievementProgress(achv, 0);
    }
  });
}

function initPeriodKPI() {
  setupRangePresets({
    buttonSelector: '.period-preset-btn:not(.company):not(.employee)',
    startInputId: 'personalRangeStart',
    endInputId: 'personalRangeEnd',
    onApply: () => loadYieldData()
  });
}

function initCompanyPeriodKPI() {
  setupRangePresets({
    buttonSelector: '.period-preset-btn.company',
    startInputId: 'companyPeriodStart',
    endInputId: 'companyPeriodEnd',
    onApply: () => loadCompanyPeriodKPIData()
  });
}

function initEmployeePeriodPreset() {
  if (!isAdminUser) return;
  const startInput = document.getElementById('employeeRangeStart');
  const endInput = document.getElementById('employeeRangeEnd');
  const applyRange = (startValue, endValue) => {
    employeePeriodRange = {
      startDate: startValue,
      endDate: endValue
    };
    loadEmployeeData(employeePeriodRange);
  };

  setupRangePresets({
    buttonSelector: '.period-preset-btn.employee',
    startInputId: 'employeeRangeStart',
    endInputId: 'employeeRangeEnd',
    onApply: applyRange
  });

  if (startInput?.value && endInput?.value) {
    employeePeriodRange = {
      startDate: startInput.value,
      endDate: endInput.value
    };
  }

  const handleManualChange = () => {
    if (!startInput?.value || !endInput?.value) return;
    if (new Date(startInput.value) > new Date(endInput.value)) return;
    document.querySelectorAll('.period-preset-btn.employee').forEach(btn => btn.classList.remove('active'));
    applyRange(startInput.value, endInput.value);
  };

  [startInput, endInput].forEach(input => {
    input?.addEventListener('change', handleManualChange);
  });
}
// Yield データの読み込み
async function loadYieldData() {
  try {
    const personalData = await loadPersonalKPIData();
    const monthlyData = await loadMonthToDatePersonalKPIData();
    if (personalData) {
      updateTodayKPI(personalData);
      updatePersonalKPIDisplay(personalData, monthlyData);
    }
    if (monthlyData) {
      updateMonthlyKPI(monthlyData);
    }
    await loadCompanyKPIData();
    await loadCompanyPeriodKPIData();

    if (isAdminUser) {
      await loadEmployeeData(
        employeePeriodRange.startDate
          ? { startDate: employeePeriodRange.startDate, endDate: employeePeriodRange.endDate }
          : {}
      );
    } else {
      employeeListState = [];
      renderEmployeeRows([]);
    }
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
    return raw && !Array.isArray(raw) ? raw : null;
  } catch (error) {
    console.error('Failed to load personal KPI data:', error);
    return null;
  }
}

async function loadMonthToDatePersonalKPIData() {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startDate = startOfMonth.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];
    const raw = await repositories.kpi.getPersonalKpi(startDate, endDate);
    return raw && !Array.isArray(raw) ? raw : null;
  } catch (error) {
    console.error('Failed to load month-to-date personal KPI data:', error);
    return null;
  }
}

// 個人KPIデータを表示に反映
function updatePersonalKPIDisplay(rangeData, monthOverride) {
  if (!rangeData && !monthOverride) return;
  const monthlyData = monthOverride?.monthly || monthOverride || rangeData?.monthly || rangeData || {};
  const periodData = rangeData?.period || rangeData || {};
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
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startDate = startOfMonth.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];
    
    // APIからデータを取得
    const raw = await repositories.kpi.getCompanyKpi(startDate, endDate);
    const data = raw && !Array.isArray(raw) ? raw : null;
    if (!data) {
      return null;
    }

    // データを表示
    updateCompanyKPIDisplay(data);
    return data;
  } catch (error) {
    console.error('Failed to load company KPI data:', error);
    return null;
  }
}

async function loadCompanyPeriodKPIData() {
  try {
    const startDate = document.getElementById('companyPeriodStart')?.value || '';
    const endDate = document.getElementById('companyPeriodEnd')?.value || '';
    if (!startDate || !endDate) {
      return null;
    }
    const raw = await repositories.kpi.getCompanyKpi(startDate, endDate);
    const data = raw && !Array.isArray(raw) ? raw : null;
    if (data) {
      updateCompanyPeriodDisplay(data);
    }
    return data;
  } catch (error) {
    console.error('Failed to load company period KPI data:', error);
    return null;
  }
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
    employeeListState = [...data];
    renderEmployeeRows();
    return data;
  } catch (error) {
    console.error('Failed to load employee data:', error);
    renderEmployeeRows([]);
    employeeListState = [];
    return [];
  }
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
function computeEmployeeColumnTopValues(rows = []) {
  const metrics = [
    'proposals',
    'recommendations',
    'interviewsScheduled',
    'interviewsHeld',
    'offers',
    'accepts',
    'proposalRate',
    'recommendationRate',
    'interviewScheduleRate',
    'interviewHeldRate',
    'offerRate',
    'acceptRate'
  ];
  const topValues = {};
  metrics.forEach(metric => {
    const values = rows.map(row => {
      const numeric = Number(row?.[metric]);
      return Number.isFinite(numeric) ? numeric : 0;
    });
    const unique = Array.from(new Set(values)).sort((a, b) => b - a).slice(0, 3);
    topValues[metric] = unique;
  });
  return topValues;
}

function updateEmployeeDisplay(data, topValues = {}) {
  const tableBody = document.getElementById('employeeTableBody');
  if (!tableBody) return;
  
  const rows = Array.isArray(data) ? data : [];
  const getRankClass = (metric, value) => {
    const metricTop = topValues?.[metric];
    if (!metricTop) return '';
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '';
    const index = metricTop.findIndex(val => val === numeric);
    return index >= 0 ? `kpi-v2-rank-${index + 1}` : '';
  };

  tableBody.innerHTML = rows.map(employee => `
    <tr>
      <td>${employee.name}</td>
      <td class="${getRankClass('proposals', employee.proposals)}">${employee.proposals}</td>
      <td class="${getRankClass('recommendations', employee.recommendations)}">${employee.recommendations}</td>
      <td class="${getRankClass('interviewsScheduled', employee.interviewsScheduled)}">${employee.interviewsScheduled}</td>
      <td class="${getRankClass('interviewsHeld', employee.interviewsHeld)}">${employee.interviewsHeld}</td>
      <td class="${getRankClass('offers', employee.offers)}">${employee.offers}</td>
      <td class="${getRankClass('accepts', employee.accepts)}">${employee.accepts}</td>
      <td class="${getRankClass('proposalRate', employee.proposalRate)}">${employee.proposalRate}%</td>
      <td class="${getRankClass('recommendationRate', employee.recommendationRate)}">${employee.recommendationRate}%</td>
      <td class="${getRankClass('interviewScheduleRate', employee.interviewScheduleRate)}">${employee.interviewScheduleRate}%</td>
      <td class="${getRankClass('interviewHeldRate', employee.interviewHeldRate)}">${employee.interviewHeldRate}%</td>
      <td class="${getRankClass('offerRate', employee.offerRate)}">${employee.offerRate}%</td>
      <td class="${getRankClass('acceptRate', employee.acceptRate)}">${employee.acceptRate}%</td>
    </tr>
  `).join('');
}

function renderEmployeeRows(source = employeeListState) {
  let rows = Array.isArray(source) ? [...source] : [];
  const searchTerm = employeeFilters.search;
  if (searchTerm) {
    rows = rows.filter(employee => (employee?.name?.toLowerCase() || '').includes(searchTerm));
  }
  const direction = employeeFilters.sortOrder === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const aVal = a?.[employeeFilters.sortKey];
    const bVal = b?.[employeeFilters.sortKey];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal) * direction;
    }
    const aNum = Number(aVal) || 0;
    const bNum = Number(bVal) || 0;
    return (aNum - bNum) * direction;
  });
  const topValues = computeEmployeeColumnTopValues(rows);
  updateEmployeeDisplay(rows, topValues);
}

function handleDateRangeChange() {
  // 日付範囲変更時の処理
  loadYieldData();
}

function applyEmployeeSearch(rawValue) {
  employeeFilters.search = (rawValue || '').trim().toLowerCase();
  renderEmployeeRows();
}

function handleEmployeeSearch(event) {
  applyEmployeeSearch(event?.target?.value || '');
}

function handleEmployeeSort(event) {
  const raw = event.target.value || '';
  const [key, direction = 'desc'] = raw.split('-');
  if (!key) return;
  employeeFilters.sortKey = key;
  employeeFilters.sortOrder = direction === 'asc' ? 'asc' : 'desc';
  renderEmployeeRows();
}
