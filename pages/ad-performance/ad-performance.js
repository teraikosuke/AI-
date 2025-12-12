// Ad Performance Page JavaScript Module
const adState = {
  data: [],
  filtered: [],
  sortField: 'applications',
  sortDirection: 'desc',
  currentPage: 1,
  pageSize: 50
};

const formatNumber = (num) => Number(num).toLocaleString();
const formatPercent = (num) => `${(Number(num) || 0).toFixed(1)}%`;
const formatCurrency = (num) => `¥${Number(num || 0).toLocaleString()}`;

let selectedMediaFilter = null;
let decisionLineChart = null;
let chartJsLoading = null;
let lastAggregated = [];
let lineMetric = 'decisionRate';

export function mount() {
  initializeAdFilters();
  initializeAdTable();
  initializePagination();
  loadAdPerformanceData();
}

export function unmount() {
  cleanupAdEventListeners();
  selectedMediaFilter = null;
  if (decisionLineChart) {
    decisionLineChart.destroy();
    decisionLineChart = null;
  }
}

function initializeAdFilters() {
  const mediaFilter = document.getElementById('adMediaFilter');
  const exportBtn = document.getElementById('exportAdManagement');
  const resetBtn = document.getElementById('adResetFilter');
  const metricSelect = document.getElementById('adMetricSelect');
  const metricTitle = document.getElementById('adMetricTitle');
  mediaFilter?.addEventListener('input', handleMediaFilter);
  exportBtn?.addEventListener('click', handleExportCSV);
  resetBtn?.addEventListener('click', () => {
    const filter = document.getElementById('adMediaFilter');
    if (filter) filter.value = '';
    selectedMediaFilter = null;
    applyFilters('');
  });
  metricSelect?.addEventListener('change', (e) => {
    lineMetric = e.target.value || 'decisionRate';
    if (metricTitle) {
      const metricLabels = {
        decisionRate: '決定率',
        initialInterviewRate: '初回面談設定率',
        retention30: '定着率',
        costPerHire: '費用/入社'
      };
      const titleLabel = metricLabels[lineMetric] || '決定率';
      metricTitle.textContent = `${titleLabel} 月別推移・媒体別`;
    }
    renderAdCharts(lastAggregated, adState.filtered);
  });
  ['adStartDate', 'adEndDate'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => applyFilters());
  });
  document.getElementById('adDateClear')?.addEventListener('click', () => {
    const s = document.getElementById('adStartDate');
    const e = document.getElementById('adEndDate');
    if (s) s.value = '';
    if (e) e.value = '';
    applyFilters();
  });
}

function initializeAdTable() {
  document.querySelectorAll('.sortable').forEach(header => {
    header.addEventListener('click', handleAdSort);
  });
}

function initializePagination() {
  const prevBtn = document.getElementById('adManagementPrevBtn');
  const nextBtn = document.getElementById('adManagementNextBtn');
  const prevBtn2 = document.getElementById('adManagementPrevBtn2');
  const nextBtn2 = document.getElementById('adManagementNextBtn2');
  [prevBtn, prevBtn2].forEach(btn => btn?.addEventListener('click', () => changePage(-1)));
  [nextBtn, nextBtn2].forEach(btn => btn?.addEventListener('click', () => changePage(1)));
}

async function loadAdPerformanceData() {
  const mockData = [
    // リクナビ
    { id: 0, mediaName: 'リクナビ', applications: 130, validApplications: 100, initialInterviews: 64, offers: 28, hired: 20, retention30: 89.0, refund: 40000, cost: 220000, period: '2023-12' },
    { id: 1, mediaName: 'リクナビ', applications: 140, validApplications: 108, initialInterviews: 70, offers: 32, hired: 24, retention30: 90.0, refund: 42000, cost: 230000, period: '2024-03' },
    { id: 2, mediaName: 'リクナビ', applications: 156, validApplications: 120, initialInterviews: 78, offers: 36, hired: 29, retention30: 91.2, refund: 45000, cost: 245000, period: '2024-05' },
    { id: 3, mediaName: 'リクナビ', applications: 162, validApplications: 124, initialInterviews: 80, offers: 38, hired: 30, retention30: 92.0, refund: 47000, cost: 255000, period: '2024-07' },
    { id: 4, mediaName: 'リクナビ', applications: 168, validApplications: 130, initialInterviews: 84, offers: 40, hired: 31, retention30: 92.5, refund: 48000, cost: 260000, period: '2024-10' },
    // 求人ボックス
    { id: 5, mediaName: '求人ボックス', applications: 165, validApplications: 124, initialInterviews: 78, offers: 36, hired: 26, retention30: 92.0, refund: 70000, cost: 210000, period: '2023-12' },
    { id: 6, mediaName: '求人ボックス', applications: 175, validApplications: 130, initialInterviews: 82, offers: 38, hired: 28, retention30: 92.8, refund: 72000, cost: 215000, period: '2024-04' },
    { id: 7, mediaName: '求人ボックス', applications: 189, validApplications: 142, initialInterviews: 90, offers: 42, hired: 33, retention30: 93.5, refund: 78000, cost: 225000, period: '2024-05' },
    { id: 8, mediaName: '求人ボックス', applications: 202, validApplications: 150, initialInterviews: 96, offers: 46, hired: 35, retention30: 94.0, refund: 80000, cost: 235000, period: '2024-08' },
    { id: 9, mediaName: '求人ボックス', applications: 210, validApplications: 158, initialInterviews: 100, offers: 48, hired: 36, retention30: 94.2, refund: 81000, cost: 240000, period: '2024-11' },
    // エン転職
    { id: 10, mediaName: 'エン転職', applications: 82, validApplications: 60, initialInterviews: 32, offers: 14, hired: 10, retention30: 80.0, refund: 78000, cost: 160000, period: '2023-12' },
    { id: 11, mediaName: 'エン転職', applications: 88, validApplications: 65, initialInterviews: 36, offers: 16, hired: 11, retention30: 81.0, refund: 82000, cost: 165000, period: '2024-04' },
    { id: 12, mediaName: 'エン転職', applications: 98, validApplications: 74, initialInterviews: 41, offers: 18, hired: 13, retention30: 82.0, refund: 89000, cost: 170000, period: '2024-06' },
    { id: 13, mediaName: 'エン転職', applications: 110, validApplications: 80, initialInterviews: 45, offers: 19, hired: 14, retention30: 83.5, refund: 91000, cost: 175000, period: '2024-08' },
    { id: 14, mediaName: 'エン転職', applications: 118, validApplications: 86, initialInterviews: 48, offers: 20, hired: 15, retention30: 84.0, refund: 93000, cost: 180000, period: '2024-11' },
    // マイナビ
    { id: 15, mediaName: 'マイナビ', applications: 112, validApplications: 86, initialInterviews: 54, offers: 22, hired: 16, retention30: 84.0, refund: 115000, cost: 250000, period: '2023-12' },
    { id: 16, mediaName: 'マイナビ', applications: 120, validApplications: 92, initialInterviews: 58, offers: 24, hired: 18, retention30: 85.0, refund: 118000, cost: 255000, period: '2024-04' },
    { id: 17, mediaName: 'マイナビ', applications: 134, validApplications: 101, initialInterviews: 68, offers: 30, hired: 22, retention30: 86.4, refund: 124000, cost: 265000, period: '2024-06' },
    { id: 18, mediaName: 'マイナビ', applications: 148, validApplications: 112, initialInterviews: 74, offers: 34, hired: 26, retention30: 87.8, refund: 126000, cost: 275000, period: '2024-08' },
    { id: 19, mediaName: 'マイナビ', applications: 154, validApplications: 118, initialInterviews: 78, offers: 36, hired: 27, retention30: 88.5, refund: 128000, cost: 280000, period: '2024-11' },
    // Indeed
    { id: 20, mediaName: 'Indeed', applications: 205, validApplications: 164, initialInterviews: 102, offers: 46, hired: 35, retention30: 87.0, refund: 140000, cost: 320000, period: '2023-12' },
    { id: 21, mediaName: 'Indeed', applications: 220, validApplications: 176, initialInterviews: 108, offers: 49, hired: 37, retention30: 87.5, refund: 148000, cost: 330000, period: '2024-04' },
    { id: 22, mediaName: 'Indeed', applications: 245, validApplications: 198, initialInterviews: 120, offers: 54, hired: 41, retention30: 88.7, refund: 156000, cost: 345000, period: '2024-07' },
    { id: 23, mediaName: 'Indeed', applications: 260, validApplications: 205, initialInterviews: 128, offers: 58, hired: 43, retention30: 89.5, refund: 160000, cost: 355000, period: '2024-09' },
    { id: 24, mediaName: 'Indeed', applications: 272, validApplications: 214, initialInterviews: 132, offers: 60, hired: 44, retention30: 90.0, refund: 162000, cost: 365000, period: '2024-11' },
    // doda
    { id: 25, mediaName: 'doda', applications: 74, validApplications: 54, initialInterviews: 26, offers: 12, hired: 8, retention30: 74.0, refund: 50000, cost: 150000, period: '2023-12' },
    { id: 26, mediaName: 'doda', applications: 80, validApplications: 58, initialInterviews: 28, offers: 13, hired: 9, retention30: 75.0, refund: 52000, cost: 155000, period: '2024-04' },
    { id: 27, mediaName: 'doda', applications: 87, validApplications: 63, initialInterviews: 32, offers: 15, hired: 11, retention30: 76.5, refund: 56000, cost: 158000, period: '2024-07' },
    { id: 28, mediaName: 'doda', applications: 95, validApplications: 70, initialInterviews: 35, offers: 16, hired: 12, retention30: 78.0, refund: 58000, cost: 162000, period: '2024-09' },
    { id: 29, mediaName: 'doda', applications: 102, validApplications: 76, initialInterviews: 38, offers: 17, hired: 13, retention30: 79.0, refund: 60000, cost: 165000, period: '2024-11' },
    // Green
    { id: 30, mediaName: 'Green', applications: 90, validApplications: 68, initialInterviews: 40, offers: 17, hired: 13, retention30: 82.0, refund: 29000, cost: 90000, period: '2023-12' },
    { id: 31, mediaName: 'Green', applications: 96, validApplications: 72, initialInterviews: 42, offers: 18, hired: 14, retention30: 83.0, refund: 30000, cost: 95000, period: '2024-04' },
    { id: 32, mediaName: 'Green', applications: 102, validApplications: 80, initialInterviews: 48, offers: 21, hired: 16, retention30: 84.3, refund: 32000, cost: 98000, period: '2024-08' },
    { id: 33, mediaName: 'Green', applications: 110, validApplications: 86, initialInterviews: 50, offers: 22, hired: 17, retention30: 85.0, refund: 33000, cost: 100000, period: '2024-09' },
    { id: 34, mediaName: 'Green', applications: 116, validApplications: 90, initialInterviews: 52, offers: 23, hired: 18, retention30: 85.5, refund: 34000, cost: 105000, period: '2024-11' },
    // ビズリーチ
    { id: 35, mediaName: 'ビズリーチ', applications: 150, validApplications: 124, initialInterviews: 84, offers: 38, hired: 30, retention30: 88.5, refund: 18000, cost: 200000, period: '2023-12' },
    { id: 36, mediaName: 'ビズリーチ', applications: 160, validApplications: 132, initialInterviews: 90, offers: 42, hired: 32, retention30: 89.5, refund: 19000, cost: 205000, period: '2024-04' },
    { id: 37, mediaName: 'ビズリーチ', applications: 178, validApplications: 150, initialInterviews: 102, offers: 47, hired: 35, retention30: 90.8, refund: 21000, cost: 210000, period: '2024-08' },
    { id: 38, mediaName: 'ビズリーチ', applications: 184, validApplications: 155, initialInterviews: 106, offers: 49, hired: 36, retention30: 91.5, refund: 22000, cost: 215000, period: '2024-09' },
    { id: 39, mediaName: 'ビズリーチ', applications: 192, validApplications: 160, initialInterviews: 110, offers: 52, hired: 38, retention30: 92.0, refund: 23000, cost: 220000, period: '2024-11' }
  ].map(calcDerivedRates);

  adState.data = mockData;
  applyFilters();
}

function calcDerivedRates(item) {
  const rate = (num, den) => (den ? (num / den) * 100 : 0);
  const cost = Number(item.cost) || 0;
  const hired = Number(item.hired) || 0;
  return {
    ...item,
    refund: Number(item.refund) || 0,
    cost,
    costPerHire: hired ? cost / hired : 0,
    validApplicationRate: rate(item.validApplications, item.applications),
    initialInterviewRate: rate(item.initialInterviews, item.validApplications || item.applications),
    offerRate: rate(item.offers, item.initialInterviews || item.validApplications || item.applications),
    hireRate: rate(item.hired, item.offers || item.initialInterviews || item.validApplications || item.applications),
    decisionRate: rate(item.hired, item.applications),
    retention30: Number(item.retention30) || 0
  };
}

function handleMediaFilter(event) {
  applyFilters(event.target.value);
}

function applyFilters(text) {
  const filterText = (text ?? document.getElementById('adMediaFilter')?.value ?? '').trim().toLowerCase();
  if (!filterText) selectedMediaFilter = null;
  const start = document.getElementById('adStartDate')?.value;
  const end = document.getElementById('adEndDate')?.value;

  adState.filtered = adState.data.filter(item => {
    const matchesMedia = item.mediaName.toLowerCase().includes(filterText);
    const withinStart = !start || (item.period && item.period >= start);
    const withinEnd = !end || (item.period && item.period <= end);
    return matchesMedia && withinStart && withinEnd;
  });
  adState.currentPage = 1;
  applySortAndRender();
}

function handleAdSort(event) {
  const header = event.currentTarget;
  const sortField = header.dataset.sort;
  const isSameField = adState.sortField === sortField;
  const newDirection = isSameField && adState.sortDirection === 'asc' ? 'desc' : 'asc';
  adState.sortField = sortField;
  adState.sortDirection = newDirection;
  updateSortIndicators();
  applySortAndRender();
}

function updateSortIndicators() {
  document.querySelectorAll('.sortable').forEach(h => {
    const indicator = h.querySelector('.sort-indicator');
    if (!indicator) return;
    if (h.dataset.sort === adState.sortField) {
      indicator.textContent = adState.sortDirection === 'asc' ? '▲' : '▼';
    } else {
      indicator.textContent = '▼';
    }
  });
}

function applySortAndRender() {
  const aggregatedSorted = getAggregatedSorted();
  lastAggregated = aggregatedSorted;
  renderAdTable(aggregatedSorted);
  updateAdPagination(aggregatedSorted.length);
  updateSortIndicators();
  updateAdSummary(aggregatedSorted);
  renderAdCharts(aggregatedSorted, adState.filtered);
}

function aggregateByMedia(items) {
  const map = new Map();
  items.forEach(item => {
    const key = item.mediaName;
    if (!map.has(key)) {
      map.set(key, {
        mediaName: key,
        applications: 0,
        validApplications: 0,
        initialInterviews: 0,
        offers: 0,
        hired: 0,
        refund: 0,
        cost: 0,
        retentionNumer: 0, // hired * retention%
        retentionDenom: 0  // hired
      });
    }
    const agg = map.get(key);
    const apps = Number(item.applications) || 0;
    const valApps = Number(item.validApplications) || 0;
    const initIv = Number(item.initialInterviews) || 0;
    const offers = Number(item.offers) || 0;
    const hired = Number(item.hired) || 0;
    const refund = Number(item.refund) || 0;
    const cost = Number(item.cost) || 0;
    const retention = Number(item.retention30) || 0;

    agg.applications += apps;
    agg.validApplications += valApps;
    agg.initialInterviews += initIv;
    agg.offers += offers;
    agg.hired += hired;
    agg.refund += refund;
    agg.cost += cost;
    agg.retentionNumer += retention * hired;
    agg.retentionDenom += hired;
  });

  const result = [];
  map.forEach(agg => {
    const retention = agg.retentionDenom ? agg.retentionNumer / agg.retentionDenom : 0;
    result.push(calcDerivedRates({
      mediaName: agg.mediaName,
      applications: agg.applications,
      validApplications: agg.validApplications,
      initialInterviews: agg.initialInterviews,
      offers: agg.offers,
      hired: agg.hired,
      retention30: retention,
      refund: agg.refund,
      cost: agg.cost
    }));
  });
  return result;
}

function getAggregatedSorted() {
  const { sortField, sortDirection, filtered } = adState;
  const aggregated = aggregateByMedia(filtered);
  return aggregated.sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === 'string' || typeof bVal === 'string') {
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });
}

function renderAdTable(data) {
  const tableBody = document.getElementById('adManagementTableBody');
  if (!tableBody) return;

  const start = (adState.currentPage - 1) * adState.pageSize;
  const end = start + adState.pageSize;
  const pageItems = data.slice(start, end);

  if (!pageItems.length) {
    tableBody.innerHTML = `<tr><td colspan="15" class="text-center text-slate-500 py-6">データがありません</td></tr>`;
    return;
  }

  const badgeClass = (val) => {
    if (val >= 90) return 'bg-green-100 text-green-700';
    if (val >= 80) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  tableBody.innerHTML = pageItems.map(ad => `
      <tr class="ad-item hover:bg-slate-50" data-ad-id="${ad.id}">
        <td class="sticky left-0 bg-white font-medium text-slate-900 z-30">${ad.mediaName}</td>
        <td class="text-right font-semibold">${formatNumber(ad.applications)}</td>
        <td class="text-right">${formatNumber(ad.validApplications)}</td>
        <td class="text-right"><span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badgeClass(ad.validApplicationRate)}">${formatPercent(ad.validApplicationRate)}</span></td>
        <td class="text-right">${formatNumber(ad.initialInterviews)}</td>
        <td class="text-right"><span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badgeClass(ad.initialInterviewRate)}">${formatPercent(ad.initialInterviewRate)}</span></td>
        <td class="text-right">${formatNumber(ad.offers)}</td>
        <td class="text-right">${formatPercent(ad.offerRate)}</td>
        <td class="text-right">${formatNumber(ad.hired)}</td>
        <td class="text-right">${formatPercent(ad.hireRate)}</td>
        <td class="text-right"><span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badgeClass(ad.decisionRate)}">${formatPercent(ad.decisionRate)}</span></td>
        <td class="text-right"><span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badgeClass(ad.retention30)}">${formatPercent(ad.retention30)}</span></td>
        <td class="text-right font-semibold">${formatCurrency(ad.refund)}</td>
        <td class="text-right font-semibold">${formatCurrency(ad.cost)}</td>
        <td class="text-right font-semibold">${ad.hired ? formatCurrency(ad.costPerHire) : '-'}</td>
      </tr>
  `).join('');
}

function updateAdSummary(data) {
  const totalApps = data.reduce((sum, d) => sum + d.applications, 0);
  const totalValid = data.reduce((sum, d) => sum + d.validApplications, 0);
  const totalCost = data.reduce((sum, d) => sum + (d.cost || 0), 0);
  const totalHired = data.reduce((sum, d) => sum + d.hired, 0);
  const decisionRate = totalApps ? (totalHired / totalApps) * 100 : 0;
  const validRate = totalApps ? (totalValid / totalApps) * 100 : 0;
  const costPerHire = totalHired ? totalCost / totalHired : 0;
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  const validText = totalValid ? `${formatNumber(totalValid)} (${formatPercent(validRate)})` : '-';
  setText('adSummaryValidWithRate', validText);
  setText('adSummaryDecisionRate', totalApps ? formatPercent(decisionRate) : '-');
  setText('adSummaryCostPerHire', totalHired ? formatCurrency(costPerHire) : '-');
}

function renderAdCharts(aggregatedData, rawData = adState.filtered) {
  const appsContainer = document.getElementById('adChartApplications');
  const lineCanvas = document.getElementById('adDecisionLine');
  if (!appsContainer || !lineCanvas) return;

  if (typeof Chart === 'undefined') {
    ensureChartJs().then(() => renderAdCharts(aggregatedData, rawData));
    return;
  }

  if (!aggregatedData.length) {
    appsContainer.innerHTML = `<div class="text-sm text-slate-500">データがありません</div>`;
    if (decisionLineChart) {
      decisionLineChart.destroy();
      decisionLineChart = null;
    }
    return;
  }

  const maxApps = Math.max(...aggregatedData.map(d => d.applications), 0);
  appsContainer.innerHTML = aggregatedData.map(d => {
    const appsWidth = maxApps ? (d.applications / maxApps) * 100 : 0;
    const validWidth = maxApps ? (d.validApplications / maxApps) * 100 : 0;
    return `
      <div class="relative">
        <div class="flex items-center justify-between text-sm font-medium text-slate-700">
          <span class="truncate">${d.mediaName}</span>
          <span class="text-slate-500 text-xs">${formatNumber(d.validApplications)} / ${formatNumber(d.applications)}</span>
        </div>
        <div class="mt-1 h-3 bg-slate-100 rounded relative overflow-hidden">
          <div class="absolute top-0 left-0 h-3 bg-indigo-200" style="width:${appsWidth}%"></div>
          <div class="absolute top-0 left-0 h-3 bg-indigo-500" style="width:${validWidth}%"></div>
        </div>
        <div class="flex justify-between text-[11px] text-slate-500 mt-1">
          <span>応募</span><span>有効応募</span>
        </div>
      </div>`;
  }).join('');

  const labels = Array.from(new Set(rawData.map(d => d.period))).sort();
  const palette = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#a78bfa', '#f472b6', '#38bdf8', '#ef4444', '#10b981'];
  const mediaMap = {};
  rawData.forEach(d => {
    if (!mediaMap[d.mediaName]) mediaMap[d.mediaName] = {};
    mediaMap[d.mediaName][d.period] = d[lineMetric];
  });
  const datasets = Object.keys(mediaMap).map((name, idx) => {
    const color = palette[idx % palette.length];
    return {
      label: name,
      data: labels.map(l => mediaMap[name][l] ?? null),
      borderColor: color,
      backgroundColor: color,
      tension: 0,
      spanGaps: true
    };
  });

  const values = aggregatedData.map(d => d[lineMetric]).filter(v => Number.isFinite(v));
  const isCostMetric = lineMetric === 'costPerHire';
  const formatValue = (val) => isCostMetric ? formatCurrency(val || 0) : formatPercent(val || 0);
  let yMin = 0, yMax = isCostMetric ? 0 : 100;
  if (values.length) {
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    if (isCostMetric) {
      yMin = Math.max(0, Math.floor(minVal * 0.9));
      yMax = Math.max(1, Math.ceil(maxVal * 1.1));
    } else {
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance) || 0;
      const pad = std || 0;
      yMin = Math.max(0, minVal - pad);
      yMax = Math.max(minVal + 1, maxVal + pad);
    }
  }

  if (decisionLineChart) decisionLineChart.destroy();
  const parentWidth = lineCanvas.parentElement?.clientWidth || 800;
  lineCanvas.width = parentWidth;
  lineCanvas.height = 380;
  const metricLabels = {
    decisionRate: '決定率',
    initialInterviewRate: '初回面談設定率',
    retention30: '定着率',
    costPerHire: '費用/入社'
  };
  const metricLabel = metricLabels[lineMetric] || '決定率';

  decisionLineChart = new Chart(lineCanvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatValue(ctx.parsed.y || 0)} (${metricLabel})` } }
      },
      interaction: { mode: 'nearest', intersect: true },
      elements: { point: { radius: 4, hoverRadius: 6 } },
      onClick: (evt) => {
        const points = decisionLineChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false);
        if (!points.length) return;
        const dsIndex = points[0].datasetIndex;
        const mediaName = decisionLineChart.data.datasets[dsIndex].label;
        const input = document.getElementById('adMediaFilter');
        const isSame = selectedMediaFilter && selectedMediaFilter.toLowerCase() === mediaName.toLowerCase();
        selectedMediaFilter = isSame ? null : mediaName;
        if (input) input.value = isSame ? '' : mediaName;
        applyFilters(isSame ? '' : mediaName);
      },
      scales: {
        y: { ticks: { callback: v => isCostMetric ? formatCurrency(v) : `${v}%` }, suggestedMin: yMin, suggestedMax: yMax }
      }
    }
  });

  renderMetricTable(labels, mediaMap);
  updateContractInfo(aggregatedData);
}

function renderMetricTable(labels, mediaMap) {
  const wrapper = document.getElementById('adMetricTable');
  if (!wrapper) return;
  if (!labels.length || !Object.keys(mediaMap).length) {
    wrapper.innerHTML = `<div class="text-sm text-slate-500 p-3">データがありません</div>`;
    return;
  }
  const header = ['<th class="sticky left-0 bg-white z-10 text-left px-3 py-2 text-sm font-semibold text-slate-700">媒体名</th>']
    .concat(labels.map(l => `<th class="px-3 py-2 text-right text-sm font-semibold text-slate-700 whitespace-nowrap">${l}</th>`));

  const valueFormatter = lineMetric === 'costPerHire'
    ? (v) => formatCurrency(v || 0)
    : (v) => formatPercent(v || 0);

  const rows = Object.keys(mediaMap).sort().map(name => {
    const cells = labels.map(lbl => {
      const v = mediaMap[name]?.[lbl];
      return `<td class="px-3 py-2 text-right text-sm text-slate-700">${Number.isFinite(v) ? valueFormatter(v) : '-'}</td>`;
    });
    return `<tr>
      <th class="sticky left-0 bg-white z-10 text-left px-3 py-2 text-sm font-medium text-slate-800">${name}</th>
      ${cells.join('')}
    </tr>`;
  });

  wrapper.innerHTML = `
    <div class="rounded-lg border border-slate-200 bg-white shadow-sm overflow-auto">
      <table class="min-w-max text-left w-full border-separate border-spacing-0">
        <thead class="bg-slate-50">
          <tr>${header.join('')}</tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${rows.join('')}
        </tbody>
      </table>
    </div>
  `;
}

function updateContractInfo(data) {
  const box = document.getElementById('adContractInfo');
  if (!box) return;
  const filterText = (document.getElementById('adMediaFilter')?.value || '').trim().toLowerCase();
  const target = data.find(d => d.mediaName.toLowerCase() === filterText) || null;
  if (!target) {
    box.innerHTML = `<div class="text-sm text-slate-500 mb-1">媒体契約情報</div><div class="text-base text-slate-700">媒体を選択すると契約条件を表示します。</div>`;
    return;
  }
  const contractMock = {
    period: '2024-01-01 〜 2024-12-31',
    price: '¥2,500,000 / 年',
    billing: '月額固定＋応募課金（応募 ¥3,000）',
    autoRenew: '自動更新あり（30日前通知で解約可）'
  };
  box.innerHTML = `
    <div class="text-sm text-slate-500 mb-1">媒体契約情報</div>
    <div class="text-base text-slate-800 font-semibold">${target.mediaName}</div>
    <div class="text-sm text-slate-600 mt-1">決定率: ${formatPercent(target.decisionRate || 0)}</div>
    <div class="text-sm text-slate-600">返金額: ${formatCurrency(target.refund || 0)}</div>
    <div class="text-sm text-slate-600">応募: ${formatNumber(target.applications)} / 有効: ${formatNumber(target.validApplications)}</div>
    <div class="text-sm text-slate-600">契約期間: ${contractMock.period}</div>
    <div class="text-sm text-slate-600">契約金額: ${contractMock.price}</div>
    <div class="text-sm text-slate-600">契約方式: ${contractMock.billing}</div>
    <div class="text-sm text-slate-600">更新・解約: ${contractMock.autoRenew}</div>
    <div class="text-xs text-slate-500 mt-1">契約条件のメモをここに追記できます</div>
  `;
}

function ensureChartJs() {
  if (typeof Chart !== 'undefined') return Promise.resolve();
  if (chartJsLoading) return chartJsLoading;
  chartJsLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
  return chartJsLoading;
}

function updateAdPagination(totalItems) {
  const { pageSize } = adState;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  adState.currentPage = Math.min(adState.currentPage, totalPages);
  const startItem = totalItems ? (adState.currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(adState.currentPage * pageSize, totalItems);
  const infoElement = document.getElementById('adManagementInfo');
  if (infoElement) infoElement.textContent = `${totalItems}件 ${startItem}-${endItem}表示`;
  ['adManagementPageInfo', 'adManagementPageInfo2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${adState.currentPage} / ${totalPages}`;
  });
  ['adManagementPrevBtn', 'adManagementPrevBtn2'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = adState.currentPage <= 1;
  });
  ['adManagementNextBtn', 'adManagementNextBtn2'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = adState.currentPage >= totalPages;
  });
}

function changePage(direction) {
  const totalItems = adState.filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / adState.pageSize));
  const nextPage = adState.currentPage + direction;
  if (nextPage < 1 || nextPage > totalPages) return;
  adState.currentPage = nextPage;
  applySortAndRender();
}

function handleExportCSV() {
  const sortedData = getAggregatedSorted();
  const headers = ['媒体名', '応募件数', '有効応募件数', '初回面談設定数', '初回面談設定率', '冀数', '冀率', '入社数', '入社率', '決定率', '定着率（30日）', '返金額（税込）', '契約費用'];
  const csvContent = [
    headers.join(','),
    ...sortedData.map(ad => [
      ad.mediaName,
      ad.applications,
      ad.validApplications,
      ad.initialInterviews,
      `${ad.initialInterviewRate.toFixed(1)}%`,
      ad.offers,
      `${ad.offerRate.toFixed(1)}%`,
      ad.hired,
      `${ad.hireRate.toFixed(1)}%`,
      `${ad.decisionRate.toFixed(1)}%`,
      `${ad.retention30.toFixed(1)}%`,
      ad.refund,
      ad.cost
    ].join(','))
  ].join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'ad_management.csv';
  link.click();
}

function showAdError(message) {
  const tableBody = document.getElementById('adManagementTableBody');
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="15" class="text-center text-red-500 py-6"><div class="flex items-center justifycenter gap-2"><span>⚠</span><span>${message}</span></div></td></tr>`;
  }
}

function cleanupAdEventListeners() {
  const elements = ['adMediaFilter', 'exportAdManagement', 'adManagementPrevBtn', 'adManagementNextBtn', 'adManagementPrevBtn2', 'adManagementNextBtn2'];
  elements.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
  });
}
