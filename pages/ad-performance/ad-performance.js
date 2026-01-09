// Ad Performance Page JavaScript Module (RDS integrated)

// ===== RDS API（あなたが作成した /dev/kpi/ads を利用）=====
const ADS_KPI_API_URL = 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev/kpi/ads';
// groupBy は route 固定（apply_route）。必要なら route_mid に変更可
const ADS_GROUP_BY = 'route';

// 既存のUIは「初回面談設定数」だが、APIは firstInterviewDone（first_interview_at）を返している想定。
// ひとまず initialInterviews = firstInterviewDone として接続（後でAPIを firstInterviewSet に拡張するとより正確）
const MAP_INITIAL_INTERVIEWS_FIELD = 'firstInterviewDone';
const CONTRACT_STORAGE_KEY = 'ad.contractInfo.v1';
const DEFAULT_CONTRACT_INFO = {
  period: '2024-01-01 ～ 2024-12-31',
  price: '2,500,000 / 年',
  billing: '月額固定＋応募課金（応募 3,000）',
  autoRenew: '自動更新あり（30日前通知で解約可）',
  notes: ''
};

const adState = {
  data: [],
  filtered: [],
  sortField: 'applications',
  sortDirection: 'desc',
  currentPage: 1,
  pageSize: 50
};

const formatNumber = (num) => Number(num || 0).toLocaleString();
const formatPercent = (num) => `${(Number(num) || 0).toFixed(1)}%`;
// cost/refund は現状DBに無いので 0 表示が紛らわしければ '-' にしたいが、既存UIを崩さないため一旦0で表示
const formatCurrency = (num) => `¥${Number(num || 0).toLocaleString()}`;
const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');
const escapeAttr = (value) => escapeHtml(value);

let selectedMediaFilter = null;
let decisionLineChart = null;
let chartJsLoading = null;
let lastAggregated = [];
let lineMetric = 'decisionRate';
let contractInfoStore = new Map();

export function mount() {
  loadContractInfoStore();
  initializeAdFilters();
  initializeAdTable();
  initializePagination();
  loadAdPerformanceData(); // ★ここがRDS取得
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

  // ★月フィルタ変更時は再取得（RDSから該当期間だけ取り直す）
  ['adStartDate', 'adEndDate'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => loadAdPerformanceData());
  });

  document.getElementById('adDateClear')?.addEventListener('click', () => {
    const s = document.getElementById('adStartDate');
    const e = document.getElementById('adEndDate');
    if (s) s.value = '';
    if (e) e.value = '';
    loadAdPerformanceData();
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

// ===== 追加：月レンジ生成（type="month" 用）=====
function ymFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthListInclusive(startYm, endYm) {
  const [sy, sm] = startYm.split('-').map(Number);
  const [ey, em] = endYm.split('-').map(Number);
  const start = new Date(sy, sm - 1, 1);
  const end = new Date(ey, em - 1, 1);

  const list = [];
  const cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    list.push(ymFromDate(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return list;
}

function monthToFromTo(ym) {
  const [y, m] = ym.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate(); // mは1-12、Dateは月+1で末日が出る
  const mm = String(m).padStart(2, '0');
  const dd = String(lastDay).padStart(2, '0');
  return {
    period: ym,                 // "YYYY-MM"
    from: `${y}-${mm}-01`,      // "YYYY-MM-01"
    to: `${y}-${mm}-${dd}`      // "YYYY-MM-lastDay"
  };
}

function ensureDefaultMonthRange() {
  const startEl = document.getElementById('adStartDate');
  const endEl = document.getElementById('adEndDate');

  const startVal = (startEl?.value || '').trim(); // "YYYY-MM"
  const endVal = (endEl?.value || '').trim();

  // 未入力なら直近6ヶ月をデフォルト
  if (!startVal || !endVal) {
    const now = new Date();
    const end = ymFromDate(now);
    const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const start = ymFromDate(startDate);

    if (startEl && !startEl.value) startEl.value = start;
    if (endEl && !endEl.value) endEl.value = end;

    return { startYm: start, endYm: end };
  }

  // start > end の場合は入れ替え
  if (startVal > endVal) {
    if (startEl) startEl.value = endVal;
    if (endEl) endEl.value = startVal;
    return { startYm: endVal, endYm: startVal };
  }

  return { startYm: startVal, endYm: endVal };
}

function loadContractInfoStore() {
  try {
    const raw = localStorage.getItem(CONTRACT_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    contractInfoStore = new Map(Object.entries(parsed));
  } catch (err) {
    console.warn('Failed to load ad contract info:', err);
  }
}

function saveContractInfoStore() {
  try {
    const obj = Object.fromEntries(contractInfoStore.entries());
    localStorage.setItem(CONTRACT_STORAGE_KEY, JSON.stringify(obj));
  } catch (err) {
    console.warn('Failed to save ad contract info:', err);
  }
}

function getContractInfo(mediaName) {
  const stored = contractInfoStore.get(mediaName);
  return { ...DEFAULT_CONTRACT_INFO, ...(stored || {}) };
}

function updateContractInfoStore(mediaName, payload) {
  if (!mediaName) return;
  contractInfoStore.set(mediaName, payload);
  saveContractInfoStore();
}

// ===== 追加：RDS API 呼び出し =====
async function fetchAdsKpi(fromYmd, toYmd) {
  const url = new URL(ADS_KPI_API_URL);
  url.searchParams.set('from', fromYmd);
  url.searchParams.set('to', toYmd);
  url.searchParams.set('groupBy', ADS_GROUP_BY);

  // GETはpreflight回避のためContent-Typeは付けない
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ads KPI API HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function loadAdPerformanceData() {
  const startYm = document.getElementById('adStartDate')?.value || '2025-11';
  const endYm = document.getElementById('adEndDate')?.value || '2025-12';

  const url = new URL('https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev/kpi/ads');
  url.searchParams.set('mode', 'performance');
  url.searchParams.set('startMonth', startYm);
  url.searchParams.set('endMonth', endYm);
  url.searchParams.set('groupBy', 'route');

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];

  adState.data = items.map(calcDerivedRates);
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
  const start = document.getElementById('adStartDate')?.value; // YYYY-MM
  const end = document.getElementById('adEndDate')?.value;     // YYYY-MM

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
        retentionNumer: 0,
        retentionDenom: 0
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
      <tr class="ad-item hover:bg-slate-50" data-ad-id="${ad.id ?? ''}">
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
  const totalApps = data.reduce((sum, d) => sum + (d.applications || 0), 0);
  const totalValid = data.reduce((sum, d) => sum + (d.validApplications || 0), 0);
  const totalCost = data.reduce((sum, d) => sum + (d.cost || 0), 0);
  const totalHired = data.reduce((sum, d) => sum + (d.hired || 0), 0);

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
  // costは現状0しか無い想定なので、入社>0かつcost>0のときだけ表示
  setText('adSummaryCostPerHire', (totalHired && totalCost) ? formatCurrency(costPerHire) : '-');
}

// renderAdCharts 以降はあなたの既存コードをそのまま使用
// （以下、あなたが貼った renderAdCharts / renderMetricTable / updateContractInfo / ensureChartJs / pagination / export / cleanup などは無変更でOK）

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
    box.innerHTML = `<div class="text-sm text-slate-500 mb-1">??????</div><div class="text-base text-slate-700">???????????????????</div>`;
    return;
  }
  const contractInfo = getContractInfo(target.mediaName);
  box.innerHTML = `
    <div class="text-sm text-slate-500 mb-1">??????</div>
    <div class="text-base text-slate-800 font-semibold">${escapeHtml(target.mediaName)}</div>
    <div class="text-sm text-slate-600 mt-1">???: ${formatPercent(target.decisionRate || 0)}</div>
    <div class="text-sm text-slate-600">???: ${formatCurrency(target.refund || 0)}</div>
    <div class="text-sm text-slate-600">??: ${formatNumber(target.applications)} / ??: ${formatNumber(target.validApplications)}</div>
    <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
      <label class="text-xs text-slate-600">
        ????
        <input id="adContractPeriod" type="text" class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          value="${escapeAttr(contractInfo.period)}" />
      </label>
      <label class="text-xs text-slate-600">
        ????
        <input id="adContractPrice" type="text" class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          value="${escapeAttr(contractInfo.price)}" />
      </label>
      <label class="text-xs text-slate-600">
        ????
        <input id="adContractBilling" type="text" class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          value="${escapeAttr(contractInfo.billing)}" />
      </label>
      <label class="text-xs text-slate-600">
        ?????
        <input id="adContractAutoRenew" type="text" class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          value="${escapeAttr(contractInfo.autoRenew)}" />
      </label>
      <label class="text-xs text-slate-600 sm:col-span-2">
        ???
        <textarea id="adContractNotes" rows="2" class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm">${escapeHtml(contractInfo.notes || '')}</textarea>
      </label>
    </div>
    <div class="mt-2 flex items-center gap-2">
      <button type="button" id="adContractSaveBtn"
        class="px-3 py-1 rounded border border-slate-300 text-xs text-slate-700 hover:bg-slate-100">??</button>
      <span id="adContractSaveStatus" class="text-xs text-slate-500"></span>
    </div>
    <div class="text-[11px] text-slate-400 mt-1">???????????????????</div>
  `;

  const saveBtn = box.querySelector('#adContractSaveBtn');
  const statusEl = box.querySelector('#adContractSaveStatus');
  saveBtn?.addEventListener('click', () => {
    const payload = {
      period: box.querySelector('#adContractPeriod')?.value?.trim() || '',
      price: box.querySelector('#adContractPrice')?.value?.trim() || '',
      billing: box.querySelector('#adContractBilling')?.value?.trim() || '',
      autoRenew: box.querySelector('#adContractAutoRenew')?.value?.trim() || '',
      notes: box.querySelector('#adContractNotes')?.value?.trim() || ''
    };
    updateContractInfoStore(target.mediaName, payload);
    if (statusEl) {
      statusEl.textContent = '??????';
      window.setTimeout(() => {
        if (statusEl.textContent === '??????') statusEl.textContent = '';
      }, 2000);
    }
  });
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
  const headers = ['媒体名', '応募件数', '有効応募件数', '初回面談設定数', '初回面談設定率', '内定数', '内定率', '入社数', '入社率', '決定率', '定着率（30日）', '返金額（税込）', '契約費用'];
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
    tableBody.innerHTML = `<tr><td colspan="15" class="text-center text-red-500 py-6">${message}</td></tr>`;
  }
}

function cleanupAdEventListeners() {
  const elements = [
    'adMediaFilter',
    'exportAdManagement',
    'adManagementPrevBtn',
    'adManagementNextBtn',
    'adManagementPrevBtn2',
    'adManagementNextBtn2'
  ];
  elements.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
  });
}
