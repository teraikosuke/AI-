import { goalSettingsService } from '../../scripts/services/goalSettings.js';

const KPI_FIELDS = [
  { key: 'newInterviewsTarget', label: '新規面談数' },
  { key: 'proposalsTarget', label: '提案数' },
  { key: 'recommendationsTarget', label: '推薦数' },
  { key: 'interviewsScheduledTarget', label: '面接設定数' },
  { key: 'interviewsHeldTarget', label: '面接実施数' },
  { key: 'offersTarget', label: '内定数' },
  { key: 'acceptsTarget', label: '承諾数' },
  { key: 'revenueTarget', label: '売上目標（金額）' },
  { key: 'proposalRateTarget', label: '提案率' },
  { key: 'recommendationRateTarget', label: '推薦率' },
  { key: 'interviewScheduleRateTarget', label: '面接設定率' },
  { key: 'interviewHeldRateTarget', label: '面接実施率' },
  { key: 'offerRateTarget', label: '内定率' },
  { key: 'acceptRateTarget', label: '承諾率' },
  { key: 'hireRateTarget', label: '入社決定率' }
];

const DAILY_FIELD_KEYS = [
  'newInterviewsTarget',
  'proposalsTarget',
  'recommendationsTarget',
  'interviewsScheduledTarget',
  'interviewsHeldTarget',
  'offersTarget',
  'acceptsTarget'
];

const DAILY_FIELDS = KPI_FIELDS.filter(field => DAILY_FIELD_KEYS.includes(field.key));

const state = {
  evaluationRule: { type: 'monthly', options: {} },
  evaluationPeriods: [],
  selectedCompanyPeriodId: '',
  selectedPersonalPeriodId: '',
  selectedPersonalDailyPeriodId: ''
};

export async function mount() {
  try {
    await goalSettingsService.load();
  } catch (error) {
    console.warn('[goal-settings] failed to load settings', error);
  }
  hydrateInitialState();
  initializeTabs();
  renderEvaluationRuleSection();
  renderPeriodSelects();
  await renderCompanyTargets();
  await renderPersonalTargets();
  await renderDailyTargets();
  bindEvents();
}

export function unmount() {}

function hydrateInitialState() {
  const rule = goalSettingsService.getEvaluationRule();
  state.evaluationRule = normalizeRule(rule);
  state.evaluationPeriods = goalSettingsService.getEvaluationPeriods();
  const todayStr = isoDate(new Date());
  const shouldRefreshDefaults =
    state.evaluationRule.type !== 'custom-month' &&
    (!Array.isArray(state.evaluationPeriods) ||
      !state.evaluationPeriods.length ||
      state.evaluationPeriods.length < 6 ||
      !findPeriodIdByDate(todayStr, state.evaluationPeriods));

  if (shouldRefreshDefaults) {
    state.evaluationPeriods = goalSettingsService.generateDefaultPeriods(state.evaluationRule);
    goalSettingsService.setEvaluationPeriods(state.evaluationPeriods);
  }
  const firstPeriod = state.evaluationPeriods[0];
  const todayId = findPeriodIdByDate(isoDate(new Date()), state.evaluationPeriods);
  state.selectedCompanyPeriodId = todayId || firstPeriod?.id || '';
  state.selectedPersonalPeriodId = state.selectedCompanyPeriodId;
  state.selectedPersonalDailyPeriodId = todayId || firstPeriod?.id || '';
}

function bindEvents() {
  document.querySelectorAll('input[name="evaluationRule"]').forEach(input => {
    input.addEventListener('change', () => handleRuleSelect(input.value));
  });

  document.getElementById('addCustomPeriodButton')?.addEventListener('click', () => {
    addCustomPeriodRow();
    renderCustomPeriodsTable();
    renderPeriodSelects();
  });

  document.getElementById('saveEvaluationRuleButton')?.addEventListener('click', handleSaveEvaluationRule);
  document.getElementById('companyPeriodSelect')?.addEventListener('change', handleCompanyPeriodChange);
  document.getElementById('saveCompanyTargetButton')?.addEventListener('click', handleSaveCompanyTarget);
  document.getElementById('personalPeriodSelect')?.addEventListener('change', handlePersonalPeriodChange);
  document.getElementById('copyCompanyTargetButton')?.addEventListener('click', handleCopyCompanyTarget);
  document.getElementById('savePersonalTargetButton')?.addEventListener('click', handleSavePersonalTarget);
  document.getElementById('distributeDailyButton')?.addEventListener('click', handleDistributeDailyTargets);
  document.getElementById('copyPreviousDailyButton')?.addEventListener('click', handleCopyPreviousDailyTargets);
  document.getElementById('saveDailyTargetsButton')?.addEventListener('click', handleSaveDailyTargets);
  document.getElementById('personalDailyPeriodSelect')?.addEventListener('change', handlePersonalDailyPeriodChange);
  document.getElementById('customStartDayInput')?.addEventListener('input', event => {
    updateCustomEndLabel(event.target.value);
  });
}

function initializeTabs() {
  const groups = document.querySelectorAll('.settings-tab-group[data-settings-tab-group]');
  groups.forEach(group => {
    const tabs = Array.from(group.querySelectorAll('.settings-tab[data-settings-tab]'));
    const panels = Array.from(document.querySelectorAll('.settings-tab-panel[data-settings-tab-panel]'));
    const activate = tabId => {
      tabs.forEach(btn => btn.classList.toggle('is-active', btn.dataset.settingsTab === tabId));
      panels.forEach(panel => panel.classList.toggle('is-hidden', panel.dataset.settingsTabPanel !== tabId));
    };
    tabs.forEach(btn => btn.addEventListener('click', () => activate(btn.dataset.settingsTab)));
    const initial = tabs.find(btn => btn.classList.contains('is-active')) || tabs[0];
    if (initial) activate(initial.dataset.settingsTab);
  });
}

async function handleRuleSelect(nextRule) {
  const options = readRuleOptions(nextRule);
  state.evaluationRule = { type: nextRule, options };
  state.evaluationPeriods = goalSettingsService.generateDefaultPeriods(state.evaluationRule);
  const firstPeriod = state.evaluationPeriods[0];
  const todayId = findPeriodIdByDate(isoDate(new Date()), state.evaluationPeriods);
  state.selectedCompanyPeriodId = todayId || firstPeriod?.id || '';
  state.selectedPersonalPeriodId = state.selectedCompanyPeriodId;
  state.selectedPersonalDailyPeriodId = todayId || firstPeriod?.id || '';
  renderEvaluationRuleSection();
  renderPeriodSelects();
  await renderCompanyTargets();
  await renderPersonalTargets();
  await renderDailyTargets();
}

async function handleSaveEvaluationRule() {
  const type = getSelectedRule();
  const options = readRuleOptions(type);
  const rule = { type, options };
  state.evaluationRule = rule;
  state.evaluationPeriods = goalSettingsService.generateDefaultPeriods(rule);
  try {
    await goalSettingsService.setEvaluationRule(rule);
  } catch (error) {
    console.error('[goal-settings] failed to save evaluation rule', error);
    showSaveStatus('evaluationSaveStatus', '保存に失敗しました');
    return;
  }
  goalSettingsService.setEvaluationPeriods(state.evaluationPeriods);
  const firstPeriod = state.evaluationPeriods[0];
  const todayId = findPeriodIdByDate(isoDate(new Date()), state.evaluationPeriods);
  state.selectedCompanyPeriodId = todayId || firstPeriod?.id || '';
  state.selectedPersonalPeriodId = state.selectedCompanyPeriodId;
  state.selectedPersonalDailyPeriodId = todayId || firstPeriod?.id || '';
  renderEvaluationRuleSection();
  renderPeriodSelects();
  await renderCompanyTargets();
  await renderPersonalTargets();
  await renderDailyTargets();
  showSaveStatus('evaluationSaveStatus', '期間設定を保存しました');
}

function renderEvaluationRuleSection() {
  const radios = document.querySelectorAll('input[name="evaluationRule"]');
  radios.forEach(radio => {
    radio.checked = radio.value === state.evaluationRule.type;
  });
  toggleRuleOptions();
}

function renderCustomPeriodsTable() {
  // カスタム期間テーブルは廃止
}

function addCustomPeriodRow() {
  const now = new Date();
  const newPeriod = {
    id: `custom-${Date.now()}`,
    label: `評価期間 ${state.evaluationPeriods.length + 1}`,
    startDate: isoDate(now),
    endDate: isoDate(now)
  };
  state.evaluationPeriods = [...state.evaluationPeriods, newPeriod];
}

async function handleCompanyPeriodChange(event) {
  state.selectedCompanyPeriodId = event.target.value || '';
  await renderCompanyTargets();
}

async function handlePersonalPeriodChange(event) {
  state.selectedPersonalPeriodId = event.target.value || '';
  await renderPersonalTargets();
}

async function handlePersonalDailyPeriodChange(event) {
  state.selectedPersonalDailyPeriodId = event.target.value || '';
  await renderDailyTargets();
}

function renderPeriodSelects() {
  const optionsHtml = state.evaluationPeriods
    .map(period => `<option value="${period.id}">${goalSettingsService.formatPeriodLabel(period)}</option>`)
    .join('');

  const firstPeriod = state.evaluationPeriods[0];
  const todayId = findPeriodIdByDate(isoDate(new Date()), state.evaluationPeriods);
  const hasCompany = state.evaluationPeriods.some(period => period.id === state.selectedCompanyPeriodId);
  const hasPersonal = state.evaluationPeriods.some(period => period.id === state.selectedPersonalPeriodId);
  const hasDaily = state.evaluationPeriods.some(period => period.id === state.selectedPersonalDailyPeriodId);
  if (!hasCompany && (todayId || firstPeriod)) state.selectedCompanyPeriodId = todayId || firstPeriod?.id || '';
  if (!hasPersonal && (todayId || firstPeriod)) state.selectedPersonalPeriodId = todayId || firstPeriod?.id || '';
  if (!hasDaily && (todayId || firstPeriod)) state.selectedPersonalDailyPeriodId = todayId || firstPeriod?.id || '';

  const companySelect = document.getElementById('companyPeriodSelect');
  if (companySelect) {
    companySelect.innerHTML = optionsHtml;
    if (!state.selectedCompanyPeriodId && state.evaluationPeriods[0]) {
      state.selectedCompanyPeriodId = state.evaluationPeriods[0].id;
    }
    if (state.selectedCompanyPeriodId) {
      companySelect.value = state.selectedCompanyPeriodId;
    }
  }

  const personalSelect = document.getElementById('personalPeriodSelect');
  if (personalSelect) {
    personalSelect.innerHTML = optionsHtml;
    if (!state.selectedPersonalPeriodId && state.evaluationPeriods[0]) {
      state.selectedPersonalPeriodId = state.evaluationPeriods[0].id;
    }
    if (state.selectedPersonalPeriodId) {
      personalSelect.value = state.selectedPersonalPeriodId;
    }
  }

  const personalDailySelect = document.getElementById('personalDailyPeriodSelect');
  if (personalDailySelect) {
    personalDailySelect.innerHTML = optionsHtml;
    if (!state.selectedPersonalDailyPeriodId && state.evaluationPeriods[0]) {
      state.selectedPersonalDailyPeriodId = state.evaluationPeriods[0].id;
    }
    if (state.selectedPersonalDailyPeriodId) {
      personalDailySelect.value = state.selectedPersonalDailyPeriodId;
    }
  }
}

async function renderCompanyTargets() {
  if (state.selectedCompanyPeriodId) {
    await goalSettingsService.loadCompanyPeriodTarget(state.selectedCompanyPeriodId);
  }
  const target = goalSettingsService.getCompanyPeriodTarget(state.selectedCompanyPeriodId) || {};
  renderTargetTable('companyTargetTableBody', target);
}

async function renderPersonalTargets() {
  if (state.selectedPersonalPeriodId) {
    await goalSettingsService.loadPersonalPeriodTarget(state.selectedPersonalPeriodId);
  }
  const target = goalSettingsService.getPersonalPeriodTarget(state.selectedPersonalPeriodId) || {};
  renderTargetTable('personalTargetTableBody', target);
}

function renderTargetTable(tbodyId, target = {}) {
  const body = document.getElementById(tbodyId);
  if (!body) return;
  const counts = KPI_FIELDS.slice(0, 8);
  const rates = KPI_FIELDS.slice(8);
  const buildRows = fields => {
    let rows = '';
    for (let i = 0; i < fields.length; i += 2) {
      const pair = fields.slice(i, i + 2);
      const cells = pair
        .map(
          field => `
        <td class="settings-kpi-label-cell">${field.label}</td>
        <td>
          <input type="number" min="0" class="settings-target-input" data-key="${field.key}" value="${numberOrEmpty(
            target[field.key]
          )}" />
        </td>`
        )
        .join('');
      const filler = pair.length === 1 ? '<td class="settings-kpi-label-cell"></td><td></td>' : '';
      rows += `<tr>${cells}${filler}</tr>`;
    }
    return rows;
  };
  body.innerHTML = `${buildRows(counts)}${buildRows(rates)}`;
}

function readTargetTable(tbodyId) {
  const body = document.getElementById(tbodyId);
  const result = {};
  if (!body) return result;
  body.querySelectorAll('input[data-key]').forEach(input => {
    const key = input.dataset.key;
    const value = Number(input.value);
    result[key] = Number.isFinite(value) && value >= 0 ? value : 0;
  });
  return result;
}

async function handleSaveCompanyTarget() {
  if (!state.selectedCompanyPeriodId) return;
  const values = readTargetTable('companyTargetTableBody');
  try {
    await goalSettingsService.saveCompanyPeriodTarget(state.selectedCompanyPeriodId, values);
    showSaveStatus('companyTargetSaveStatus', '会社目標を保存しました');
  } catch (error) {
    console.error('[goal-settings] failed to save company target', error);
    showSaveStatus('companyTargetSaveStatus', '保存に失敗しました');
  }
}

async function handleSavePersonalTarget() {
  if (!state.selectedPersonalPeriodId) return;
  const values = readTargetTable('personalTargetTableBody');
  try {
    await goalSettingsService.savePersonalPeriodTarget(state.selectedPersonalPeriodId, values);
    showSaveStatus('personalTargetSaveStatus', '個人目標を保存しました');
  } catch (error) {
    console.error('[goal-settings] failed to save personal target', error);
    showSaveStatus('personalTargetSaveStatus', '保存に失敗しました');
  }
}

async function handleCopyCompanyTarget() {
  if (!state.selectedPersonalPeriodId) return;
  await goalSettingsService.loadCompanyPeriodTarget(state.selectedPersonalPeriodId);
  const source = goalSettingsService.getCompanyPeriodTarget(state.selectedPersonalPeriodId) || {};
  renderTargetTable('personalTargetTableBody', source);
}

async function renderDailyTargets() {
  const body = document.getElementById('personalDailyTableBody');
  if (!body) return;
  const period = state.evaluationPeriods.find(item => item.id === state.selectedPersonalDailyPeriodId);
  if (!period) {
    body.innerHTML = '';
    return;
  }
  const dates = enumerateDates(period.startDate, period.endDate);
  await goalSettingsService.loadPersonalDailyTargets(period.id);
  const savedTargets = goalSettingsService.getPersonalDailyTargets(period.id) || {};

  body.innerHTML = dates
    .map(date => {
      const saved = savedTargets[date] || {};
      return `
        <tr data-date="${date}">
          <td>${date}</td>
          ${DAILY_FIELDS.map(field => {
            const value = numberOrEmpty(saved[field.key]);
            return `<td><input type="number" min="0" class="settings-target-input" data-field="${field.key}" value="${value}" /></td>`;
          }).join('')}
        </tr>
      `;
    })
    .join('');
}

async function handleDistributeDailyTargets() {
  const period = state.evaluationPeriods.find(item => item.id === state.selectedPersonalDailyPeriodId);
  if (!period) return;
  const dates = enumerateDates(period.startDate, period.endDate);
  if (!dates.length) return;
  await goalSettingsService.loadPersonalPeriodTarget(state.selectedPersonalDailyPeriodId);
  const periodTarget = goalSettingsService.getPersonalPeriodTarget(state.selectedPersonalDailyPeriodId) || {};
  const body = document.getElementById('personalDailyTableBody');
  const totals = DAILY_FIELDS.reduce((acc, field) => {
    const raw = Number(periodTarget[field.key]);
    acc[field.key] = Number.isFinite(raw) && raw >= 0 ? raw : 0;
    return acc;
  }, {});
  body?.querySelectorAll('tr').forEach((row, index) => {
    row.querySelectorAll('input[data-field]').forEach(input => {
      const key = input.dataset.field;
      const total = totals[key] ?? 0;
      input.value = calcCumulativeValue(total, index, dates.length);
    });
  });
}

async function handleCopyPreviousDailyTargets() {
  const periodId = state.selectedPersonalDailyPeriodId;
  if (!periodId) return;
  const currentIndex = state.evaluationPeriods.findIndex(item => item.id === periodId);
  if (currentIndex <= 0) return;
  const previous = state.evaluationPeriods[currentIndex - 1];
  if (!previous) return;
  const body = document.getElementById('personalDailyTableBody');
  if (!body) return;

  await goalSettingsService.loadPersonalDailyTargets(previous.id);
  const previousTargets = goalSettingsService.getPersonalDailyTargets(previous.id) || {};
  const previousDates = enumerateDates(previous.startDate, previous.endDate);

  body.querySelectorAll('tr[data-date]').forEach((row, index) => {
    const previousDate = previousDates[index];
    const values = previousDate ? previousTargets[previousDate] || {} : {};
    row.querySelectorAll('input[data-field]').forEach(input => {
      const key = input.dataset.field;
      const value = Number(values[key]);
      input.value = Number.isFinite(value) ? value : '';
    });
  });
}

async function handleSaveDailyTargets() {
  const periodId = state.selectedPersonalDailyPeriodId;
  if (!periodId) return;
  const body = document.getElementById('personalDailyTableBody');
  if (!body) return;
  const dailyTargets = {};
  body.querySelectorAll('tr[data-date]').forEach(row => {
    const date = row.dataset.date;
    const target = {};
    row.querySelectorAll('input[data-field]').forEach(input => {
      const key = input.dataset.field;
      const value = Number(input.value);
      target[key] = Number.isFinite(value) && value >= 0 ? value : 0;
    });
    dailyTargets[date] = target;
  });
  try {
    await goalSettingsService.savePersonalDailyTargets(periodId, dailyTargets);
    showSaveStatus('dailyTargetSaveStatus', '日別目標を保存しました');
  } catch (error) {
    console.error('[goal-settings] failed to save daily targets', error);
    showSaveStatus('dailyTargetSaveStatus', '保存に失敗しました');
  }
}

function getSelectedRule() {
  const checked = document.querySelector('input[name="evaluationRule"]:checked');
  return checked?.value || state.evaluationRule.type;
}

function enumerateDates(start, end) {
  if (!start || !end) return [];
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate) || Number.isNaN(endDate) || startDate > endDate) return [];
  const dates = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dates.push(isoDate(d));
  }
  return dates;
}

function isoDate(date) {
  return date.toISOString().split('T')[0];
}

function numberOrEmpty(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : '';
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function findPeriodIdByDate(dateStr, periods) {
  if (!dateStr) return '';
  const target = new Date(dateStr);
  const match = (periods || []).find(period => {
    if (!period.startDate || !period.endDate) return false;
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    return start <= target && target <= end;
  });
  return match?.id || '';
}

function normalizeRule(raw) {
  if (raw && typeof raw === 'object' && raw.type) return { type: raw.type, options: raw.options || {} };
  const legacy = typeof raw === 'string' ? raw : 'monthly';
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

function readRuleOptions(type) {
  switch (type) {
    case 'weekly':
      return { startWeekday: document.getElementById('startWeekdaySelect')?.value || 'monday' };
    case 'quarterly':
      return { fiscalStartMonth: Number(document.getElementById('fiscalStartMonthSelect')?.value) || 1 };
    case 'custom-month': {
      const start = clampDay(document.getElementById('customStartDayInput')?.value, 1);
      const end = start - 1 <= 0 ? 31 : start - 1;
      return { startDay: start, endDay: end };
    }
    default:
      return {};
  }
}

function clampDay(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(31, Math.max(1, Math.round(num)));
}

function toggleRuleOptions() {
  const type = state.evaluationRule.type;
  document.querySelectorAll('.settings-option-row').forEach(row => {
    const target = row.dataset.option;
    row.hidden = target !== type;
  });
  const rule = state.evaluationRule;
  if (type === 'weekly') {
    const select = document.getElementById('startWeekdaySelect');
    if (select) select.value = rule.options?.startWeekday || 'monday';
  }
  if (type === 'quarterly') {
    const select = document.getElementById('fiscalStartMonthSelect');
    if (select) select.value = `${rule.options?.fiscalStartMonth || 1}`;
  }
  if (type === 'custom-month') {
    const startInput = document.getElementById('customStartDayInput');
    if (startInput) startInput.value = rule.options?.startDay || 1;
    updateCustomEndLabel(rule.options?.startDay || 1);
  }
}

function updateCustomEndLabel(startDayValue) {
  const label = document.getElementById('customEndDayLabel');
  if (!label) return;
  const start = clampDay(startDayValue, 1);
  const end = start - 1 <= 0 ? 31 : start - 1;
  label.textContent = `毎月${start}日〜翌${end}日`;
}

function showSaveStatus(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  setTimeout(() => {
    el.textContent = '';
  }, 2000);
}

function calcCumulativeValue(total, index, length) {
  const totalNumber = Number(total);
  if (!Number.isFinite(totalNumber) || totalNumber <= 0 || length <= 0) return 0;
  if (index >= length - 1) return totalNumber;
  return Math.round((totalNumber * (index + 1)) / length);
}
