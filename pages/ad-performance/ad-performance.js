// Ad Performance Page JavaScript Module (RDS integrated)

import { goalSettingsService } from '../../scripts/services/goalSettings.js';

// 目標値キャッシュ
let adRateTargets = {};

// ===== RDS API（あなたが作成した /dev/kpi/ads を利用）=====
const ADS_KPI_API_URL = 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev/kpi/ads';
// groupBy は route 固定（apply_route）。必要なら route_mid に変更可
const ADS_GROUP_BY = 'route';

// 既存のUIは「初回面談設定数」だが、APIは firstInterviewDone（first_interview_at）を返している想定。
// ひとまず initialInterviews = firstInterviewDone として接続
const MAP_INITIAL_INTERVIEWS_FIELD = 'firstInterviewDone';
// API Gatewayの媒体契約情報エンドポイント
const AD_CONTRACT_API_URL = 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev/ads/detail';

const DEFAULT_CONTRACT_INFO = {
  contractStartDate: '',
  contractEndDate: '',
  contractAmount: '',
  amountPeriod: '',
  contractMethod: '',
  renewalTerms: '',
  memo: '',
  totalSales: 0 // ★追加: 売上高初期値
};

const adState = {
  data: [],
  summary: null,
  filtered: [],
  sortField: 'applications',
  sortDirection: 'desc',
  currentPage: 1,
  pageSize: 50,
  calcMode: 'base' // 'base' | 'step'
};

const formatNumber = (num) => Number(num || 0).toLocaleString();
const formatPercent = (num) => `${(Number(num) || 0).toFixed(1)}%`;
const formatCurrency = (num) => `¥${Number(num || 0).toLocaleString()}`;
const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
const escapeAttr = (value) => escapeHtml(value);

let selectedMediaFilter = null;
let decisionLineChart = null;
let mainBarChart = null;
let mainPieChart = null;
let chartJsLoading = null;
let lastAggregated = [];
let lineMetric = 'decisionRate';
let currentGraphMetric = 'roas';
let contractInfoCache = new Map();
let contractFetchInFlight = new Map();
let contractEditTarget = null;

function formatContractDateValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const match = text.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (match) {
    const y = match[1];
    const m = String(match[2]).padStart(2, '0');
    const d = String(match[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const ADS_CHART_PALETTE = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#a78bfa', '#f472b6', '#38bdf8', '#ef4444', '#10b981'];

export async function mount() {
  initializeAdFilters();
  initializeAdTable();
  initializePagination();
  // 目標値をロード
  await loadAdRateTargets();
  loadAdPerformanceData();
}

// 目標値をロードする関数
async function loadAdRateTargets() {
  try {
    await goalSettingsService.load();
    const periods = goalSettingsService.getEvaluationPeriods();
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    const currentPeriod = goalSettingsService.getPeriodByDate(todayStr, periods);
    if (currentPeriod?.id) {
      adRateTargets = await goalSettingsService.loadPageRateTargets(currentPeriod.id) || {};
    }
  } catch (error) {
    console.warn('[ad-performance] failed to load rate targets', error);
    adRateTargets = {};
  }
}

// 目標達成度に応じた色クラスを取得
function getRateBadgeClass(actualRate, targetKey) {
  const targetRate = Number(adRateTargets[targetKey]);
  if (!Number.isFinite(targetRate) || targetRate <= 0) {
    // 目標未設定時はデフォルト色
    return 'bg-slate-100 text-slate-700';
  }
  const percentage = (actualRate / targetRate) * 100;
  if (percentage >= 100) return 'bg-green-100 text-green-700';  // 目標達成
  if (percentage >= 80) return 'bg-amber-100 text-amber-700';   // 80-99%
  return 'bg-red-100 text-red-700';                             // 80%未満
}

function getMediaColor(mediaName, allMediaNames) {
  if (!mediaName) return '#cbd5e1';
  // Sort distinct names to ensure deterministic index
  const sorted = [...new Set(allMediaNames)].sort();
  const index = sorted.indexOf(mediaName);
  if (index === -1) return '#cbd5e1';
  return ADS_CHART_PALETTE[index % ADS_CHART_PALETTE.length];
}

export function unmount() {
  cleanupAdEventListeners();
  selectedMediaFilter = null;
  if (decisionLineChart) {
    decisionLineChart.destroy();
    decisionLineChart = null;
  }
  if (mainBarChart) {
    mainBarChart.destroy();
    mainBarChart = null;
  }
  if (mainPieChart) {
    mainPieChart.destroy();
    mainPieChart = null;
  }
}

function initializeAdFilters() {
  const mediaFilter = document.getElementById('adMediaFilter');
  const exportBtn = document.getElementById('exportAdManagement');
  const resetBtn = document.getElementById('adResetFilter');
  const metricSelect = document.getElementById('adMetricSelect');
  const metricTitle = document.getElementById('adMetricTitle');
  const graphMetricSelect = document.getElementById('adGraphMetricSelect');

  mediaFilter?.addEventListener('change', handleMediaFilter);
  exportBtn?.addEventListener('click', handleExportCSV);

  resetBtn?.addEventListener('click', () => {
    const filter = document.getElementById('adMediaFilter');
    if (filter) filter.value = '';
    selectedMediaFilter = null;
    applyFilters('');
  });

  const calcModeSelect = document.getElementById('adCalcModeSelect');
  calcModeSelect?.addEventListener('change', handleCalcModeChange);

  metricSelect?.addEventListener('change', (e) => {
    lineMetric = e.target.value || 'initialInterviewRate';
    if (metricTitle) {
      const metricLabels = {
        decisionRate: '決定率',
        initialInterviewRate: '初回面談設定率',
        retentionWarranty: '定着率（保障期間）',
        retention30: '定着率（保障期間）'
      };
      const titleLabel = metricLabels[lineMetric] || '初回面談設定率';
      metricTitle.textContent = `${titleLabel} 月別推移・媒体別`;
    }
    renderAdCharts(lastAggregated, adState.filtered);
  });

  if (graphMetricSelect) {
    currentGraphMetric = graphMetricSelect.value || 'roas';
    graphMetricSelect.addEventListener('change', (e) => {
      currentGraphMetric = e.target.value || 'roas';
      renderAdCharts(lastAggregated, adState.filtered);
    });
  }

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

function handleCalcModeChange(e) {
  adState.calcMode = e.target.value || 'base';
  applySortAndRender();
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

function ymFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function resolveMediaId(item) {
  const candidates = [
    item?.mediaId, item?.media_id, item?.mediaID, item?.adMediaId, item?.ad_media_id
  ];
  for (const value of candidates) {
    const trimmed = String(value ?? '').trim();
    if (trimmed) return trimmed;
  }
  const rawId = String(item?.id ?? '').trim();
  if (rawId) {
    const composite = item?.period && item?.mediaName && rawId === `${item.period}-${item.mediaName}`;
    if (!composite) return rawId;
  }
  return '';
}

function getContractCacheKey(mediaName, mediaId) {
  const name = String(mediaName ?? '').trim();
  if (name) return name;
  const id = String(mediaId ?? '').trim();
  return id;
}

function normalizeContractInfo(payload) {
  const amount = payload?.contractAmount;
  return {
    // ★重要: IDをここで確保する
    id: payload?.id || '',

    contractStartDate: payload?.contractStartDate || '',
    contractEndDate: payload?.contractEndDate || '',
    contractAmount: amount === null || amount === undefined ? '' : String(amount),
    amountPeriod: payload?.amountPeriod || '',
    contractMethod: payload?.contractMethod || '',
    renewalTerms: payload?.renewalTerms || '',
    memo: payload?.memo || '',
    totalSales: Number(payload?.totalSales || 0)
  };
}

// 日付入力用 (YYYY-MM-DD)
function formatDateForInput(dateStr) {
  if (!dateStr) return '';
  // 文字列の場合、T以降をカット (例: 2025-01-01T00:00... -> 2025-01-01)
  if (typeof dateStr === 'string') return dateStr.split('T')[0];
  // Dateオブジェクトの場合
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
}

// 日付表示用 (YYYY/MM/DD)
function formatDateForDisplay(dateStr) {
  const ymd = formatDateForInput(dateStr);
  if (!ymd) return '';
  return ymd.replace(/-/g, '/');
}
function getContractInfo(cacheKey) {
  const stored = contractInfoCache.get(cacheKey);
  return { ...DEFAULT_CONTRACT_INFO, ...(stored || {}) };
}

function setContractInfoCache(cacheKey, payload) {
  if (!cacheKey) return;
  contractInfoCache.set(cacheKey, normalizeContractInfo(payload));
}

async function fetchContractInfo(mediaName, mediaId) {
  const url = new URL(AD_CONTRACT_API_URL);
  const idValue = String(mediaId ?? '').trim();
  const nameValue = String(mediaName ?? '').trim();
  if (idValue) url.searchParams.set('id', idValue);
  if (nameValue) url.searchParams.set('mediaName', nameValue);
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ad contract API HTTP ${res.status}: ${text}`);
  }
  const json = await res.json().catch(() => ({}));
  // リスト形式で返ってくる場合と単一オブジェクトの場合を考慮
  const data = json.contract || (Array.isArray(json.items) ? json.items[0] : null) || {};
  return normalizeContractInfo(data);
}

function ensureContractInfo(mediaName, mediaId) {
  const cacheKey = getContractCacheKey(mediaName, mediaId);
  if (!cacheKey) return Promise.reject(new Error('mediaName or id is required'));
  if (contractInfoCache.has(cacheKey)) {
    return Promise.resolve(getContractInfo(cacheKey));
  }
  if (contractFetchInFlight.has(cacheKey)) {
    return contractFetchInFlight.get(cacheKey);
  }
  const request = fetchContractInfo(mediaName, mediaId)
    .then((info) => {
      setContractInfoCache(cacheKey, info);
      return info;
    })
    .finally(() => {
      contractFetchInFlight.delete(cacheKey);
    });
  contractFetchInFlight.set(cacheKey, request);
  return request;
}

async function saveContractInfo(mediaName, payload, mediaId) {
  const body = { ...payload };
  const nameValue = String(mediaName ?? '').trim();
  const idValue = String(mediaId ?? '').trim();
  if (nameValue) body.mediaName = nameValue;
  if (idValue) body.id = idValue;
  const res = await fetch(AD_CONTRACT_API_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ad contract API HTTP ${res.status}: ${text}`);
  }
  const json = await res.json().catch(() => null);
  // 更新後のデータをキャッシュに反映
  const updatedData = json?.contract || payload;
  const cacheKey = getContractCacheKey(nameValue, idValue);
  setContractInfoCache(cacheKey, updatedData);
  return getContractInfo(cacheKey);
}

async function loadAdPerformanceData() {
  const startEl = document.getElementById('adStartDate');
  const endEl = document.getElementById('adEndDate');
  const startYm = (startEl?.value || '').trim();
  const endYm = (endEl?.value || '').trim();
  const isAutoRange = !startYm && !endYm;
  const nowYm = ymFromDate(new Date());
  const requestStart = startYm || '2000-01';
  const requestEnd = endYm || nowYm;

  const url = new URL(ADS_KPI_API_URL);
  url.searchParams.set('mode', 'performance');
  url.searchParams.set('startMonth', requestStart);
  url.searchParams.set('endMonth', requestEnd);
  url.searchParams.set('groupBy', 'route');

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];
  if (isAutoRange && items.length) {
    const periods = items.map(item => item.period).filter(Boolean).sort();
    const minPeriod = periods[0];
    const maxPeriod = periods[periods.length - 1];
    if (startEl && minPeriod) startEl.value = minPeriod;
    if (endEl && maxPeriod) endEl.value = maxPeriod;
  }

  adState.summary = data?.summary ?? null;
  adState.summary = data?.summary ?? null;
  // Raw data keeps basic counts. We recalculate rates when rendering/aggregating.
  // Actually calcDerivedRates was mapping items directly. 
  // We should NOT bake rates into data permanently if we want to switch modes without reloading.
  // But wait, applySortAndRender calls getAggregatedSorted which calls aggregateByMedia which calls calcDerivedRates.
  // So as long as calcDerivedRates uses adState.calcMode, we are good.
  adState.data = items; // Store raw items logic invoked in aggregate logic
  applyFilters();
}
function calcDerivedRates(item) {
  const rate = (num, den) => (den ? (num / den) * 100 : 0);

  const cost = Number(item.cost) || 0;
  const hired = Number(item.hired) || 0;
  const refund = Number(item.refund) || 0;
  const totalSales = Number(item.totalSales) || 0;
  const retentionWarranty = resolveRetentionValue(item);

  // ROAS計算：契約費用が0の時は'-'を返す
  const roas = cost > 0 ? (totalSales / cost) * 100 : null;

  const result = {
    ...item,
    refund,
    cost,
    totalSales,
    roas,
    costPerHire: hired ? cost / hired : 0,

    // 有効応募率 = 有効応募 / 応募 (モードによらず固定)
    validApplicationRate: rate(item.validApplications, item.applications),

    // 初期化
    initialInterviewRate: 0,
    offerRate: 0,
    hireRate: 0,
    retentionWarranty
  };

  // 計算モードに応じたレート計算
  const mode = adState.calcMode;

  if (mode === 'step') {
    // 段階別基準
    // 初回面談設定率 = 初回面談(Done) / 有効応募
    result.initialInterviewRate = rate(item.initialInterviews, item.validApplications);

    // 内定率 = 内定 / 初回面談(Done)
    result.offerRate = rate(item.offers, item.initialInterviews);

    // 入社率 = 入社 / 内定
    result.hireRate = rate(item.hired, item.offers);

  } else {
    // 有効応募数基準 (Default) - 全て有効応募数分母
    const valid = item.validApplications;
    result.initialInterviewRate = rate(item.initialInterviews, valid);
    result.offerRate = rate(item.offers, valid);
    result.hireRate = rate(item.hired, valid);
  }

  return result;
}

function resolveRetentionValue(item) {
  const candidates = [
    item?.retentionWarranty,
    item?.retention_warranty,
    item?.retention,
    item?.retention_rate,
    item?.retentionRate,
    item?.retention30,
    item?.retention_30
  ];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return 0;
}

function handleMediaFilter(event) {
  const value = (event.target.value || '').trim();
  selectedMediaFilter = value || null;
  applyFilters(value);
}

function applyFilters(text) {
  const rawValue = (text ?? document.getElementById('adMediaFilter')?.value ?? '').trim();
  const filterText = rawValue.toLowerCase();
  selectedMediaFilter = rawValue || null;
  const start = document.getElementById('adStartDate')?.value;
  const end = document.getElementById('adEndDate')?.value;

  adState.filtered = adState.data.filter(item => {
    const matchesMedia = !filterText || item.mediaName.toLowerCase() === filterText;
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
    const isActive = h.dataset.sort === adState.sortField;
    h.classList.toggle('is-sorted', isActive);
    if (isActive) {
      h.dataset.sortDir = adState.sortDirection;
      h.setAttribute('aria-sort', adState.sortDirection === 'asc' ? 'ascending' : 'descending');
    } else {
      h.removeAttribute('data-sort-dir');
      h.setAttribute('aria-sort', 'none');
    }
    const indicator = h.querySelector('.sort-indicator');
    if (indicator) {
      indicator.textContent = isActive ? (adState.sortDirection === 'asc' ? '▲' : '▼') : '▼';
    }
  });
}

function updateMediaFilterOptions(items) {
  const select = document.getElementById('adMediaFilter');
  if (!select) return;

  const names = Array.from(new Set(items
    .map(item => item.mediaName)
    .filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'ja'));

  const currentValue = (select.value || selectedMediaFilter || '').trim();
  const matched = currentValue
    ? names.find(name => name.toLowerCase() === currentValue.toLowerCase())
    : '';

  select.innerHTML = `<option value="">媒体を選択</option>` + names
    .map(name => `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`)
    .join('');

  if (matched) {
    select.value = matched;
    selectedMediaFilter = matched;
  } else {
    select.value = '';
    selectedMediaFilter = null;
  }
}

function applySortAndRender() {
  const aggregatedSorted = getAggregatedSorted();
  lastAggregated = aggregatedSorted;
  updateMediaFilterOptions(adState.data);
  renderAdTable(aggregatedSorted);
  updateAdPagination(aggregatedSorted.length);
  updateSortIndicators();
  updateAdSummary(aggregatedSorted, adState.summary);
  updateHeaderNotes();
  renderAdCharts(aggregatedSorted, adState.filtered);
}

function updateHeaderNotes() {
  const mode = adState.calcMode;
  const isStep = mode === 'step';

  const setNote = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  if (isStep) {
    setNote('headerNoteInitialInterviewRate', '（初回面談数/有効応募数）');
    setNote('headerNoteOfferRate', '（内定数/初回面談数）'); // Step logic
    setNote('headerNoteHireRate', '（入社数/内定数）'); // Step logic
  } else {
    setNote('headerNoteInitialInterviewRate', '（初回面談数/有効応募数）');
    setNote('headerNoteOfferRate', '（内定数/有効応募数）'); // Base logic
    setNote('headerNoteHireRate', '（入社数/有効応募数）'); // Base logic
  }
}

function aggregateByMedia(items) {
  const map = new Map();
  items.forEach(item => {
    const key = item.mediaName;
    const mediaId = resolveMediaId(item);
    if (!map.has(key)) {
      map.set(key, {
        mediaName: key,
        mediaId: mediaId || '',
        applications: 0,
        validApplications: 0,
        initialInterviews: 0,
        offers: 0,
        hired: 0,
        refund: 0,
        cost: 0,
        totalSales: 0, // ★追加
        retentionNumer: 0,
        retentionDenom: 0
      });
    }
    const agg = map.get(key);
    if (!agg.mediaId && mediaId) agg.mediaId = mediaId;

    agg.applications += (Number(item.applications) || 0);
    agg.validApplications += (Number(item.validApplications) || 0);
    agg.initialInterviews += (Number(item.initialInterviews) || 0);
    agg.offers += (Number(item.offers) || 0);
    agg.hired += (Number(item.hired) || 0);
    agg.refund += (Number(item.refund) || 0);
    agg.cost += (Number(item.cost) || 0);
    agg.totalSales += (Number(item.totalSales) || 0); // ★追加: 売上高を集計

    const retention = resolveRetentionValue(item);
    agg.retentionNumer += retention * (Number(item.hired) || 0);
    agg.retentionDenom += (Number(item.hired) || 0);
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
      retentionWarranty: retention,
      refund: agg.refund,
      cost: agg.cost,
      totalSales: agg.totalSales // ★追加
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
    // ★修正: 列数が16になったため colspan を 16 に設定
    tableBody.innerHTML = `<tr><td colspan="15" class="text-center text-slate-500 py-6">データがありません</td></tr>`;
    return;
  }

  // ROAS用のバッジスタイル (例: 100%以上なら緑、などの基準があればここで調整可能)
  // 今回は単純に数値表示とします

  tableBody.innerHTML = pageItems.map(ad => {
    const isStep = adState.calcMode === 'step';
    const offerTargetKey = isStep ? 'adOfferRateTargetStep' : 'adOfferRateTarget';
    const hireTargetKey = isStep ? 'adHireRateTargetStep' : 'adHireRateTarget';

    return `
      <tr class="ad-item hover:bg-slate-50" data-ad-id="${ad.id ?? ''}">
        <td class="sticky left-0 bg-white font-medium text-slate-900 z-30 whitespace-nowrap border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
          ${ad.mediaName}
        </td>
        <td class="text-right font-semibold whitespace-nowrap px-2">${formatNumber(ad.applications)}</td>
        <td class="text-right whitespace-nowrap px-2">${formatNumber(ad.validApplications)}</td>
        <td class="text-right whitespace-nowrap px-2"><span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRateBadgeClass(ad.validApplicationRate, 'adValidAppRate')}">${formatPercent(ad.validApplicationRate)}</span></td>
        <td class="text-right whitespace-nowrap px-2">${formatNumber(ad.initialInterviews)}</td>
        <td class="text-right whitespace-nowrap px-2"><span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRateBadgeClass(ad.initialInterviewRate, 'adInterviewSetupRate')}">${formatPercent(ad.initialInterviewRate)}</span></td>
        <td class="text-right whitespace-nowrap px-2">${formatNumber(ad.offers)}</td>
        <td class="text-right whitespace-nowrap px-2">
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRateBadgeClass(ad.offerRate, offerTargetKey)}">
            ${formatPercent(ad.offerRate)}
          </span>
        </td>
        <td class="text-right whitespace-nowrap px-2">${formatNumber(ad.hired)}</td>
        <td class="text-right whitespace-nowrap px-2"><span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRateBadgeClass(ad.hireRate, hireTargetKey)}">${formatPercent(ad.hireRate)}</span></td>
        <td class="text-right whitespace-nowrap px-2"><span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRateBadgeClass(ad.retentionWarranty, 'adRetentionRate')}">${formatPercent(ad.retentionWarranty)}</span></td>
        
        <td class="text-right font-semibold whitespace-nowrap px-2">${formatCurrency(ad.totalSales)}</td>
        
        <td class="text-right font-semibold whitespace-nowrap px-2 text-slate-700">${formatCurrency(ad.cost)}</td>
        
        <td class="text-right font-semibold whitespace-nowrap px-2 text-indigo-700">${ad.roas !== null ? formatPercent(ad.roas) : '-'}</td>
        
        <td class="text-right font-semibold whitespace-nowrap px-2">${formatCurrency(ad.refund)}</td>
      </tr>
  `;
  }).join('');
}

function updateAdSummary(data, summary) {
  const useSummary = summary && typeof summary === 'object' && !selectedMediaFilter;
  const rate = (num, den) => (den ? (num / den) * 100 : 0);

  const totalApps = useSummary
    ? Number(summary.totalApplications || 0)
    : data.reduce((sum, d) => sum + (d.applications || 0), 0);

  const totalValid = useSummary
    ? Number(summary.totalValid || 0)
    : data.reduce((sum, d) => sum + (d.validApplications || 0), 0);

  const totalHired = useSummary
    ? Number(summary.totalHired || 0)
    : data.reduce((sum, d) => sum + (d.hired || 0), 0);

  const totalSales = data.reduce((sum, d) => sum + (Number(d.totalSales) || 0), 0);
  const totalCost = data.reduce((sum, d) => sum + (Number(d.cost) || 0), 0);
  const totalInitialInterviews = data.reduce((sum, d) => sum + (d.initialInterviews || 0), 0);

  // (もし有効応募が0の場合は0%)
  // const decisionRate = rate(totalHired, totalValid); // Removed decision rate logic

  const validRate = rate(totalValid, totalApps);
  const interviewDenom = totalValid;
  const initialInterviewRate = rate(totalInitialInterviews, interviewDenom);

  const totalRoas = totalCost > 0 ? (totalSales / totalCost) * 100 : 0;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  const validText = totalValid ? `${formatNumber(totalValid)} (${formatPercent(validRate)})` : '-';
  setText('adSummaryValidWithRate', validText);
  setText('adSummaryInitialInterviewRate', interviewDenom ? formatPercent(initialInterviewRate) : '-');

  // 入社率の表示更新
  const hireRate = adState.calcMode === 'step'
    ? rate(totalHired, Number(summary?.totalOffers || data.reduce((sum, d) => sum + (d.offers || 0), 0))) // Step: Hired / Offers
    : rate(totalHired, totalValid); // Base: Hired / Valid

  setText('adSummaryHireRate', totalHired || totalValid ? formatPercent(hireRate) : '-');

  const noteEl = document.getElementById('adSummaryHireRateNote');
  if (noteEl) {
    noteEl.textContent = adState.calcMode === 'step'
      ? '内定数に対する入社割合'
      : '有効応募数に対する入社割合';
  }

  setText('adSummaryRoas', formatPercent(totalRoas));
}

function setMainBarChartPlaceholder(message) {
  const canvas = document.getElementById('adMainBarChartCanvas');
  const wrapper = canvas?.parentElement;
  if (!canvas || !wrapper) return;
  const placeholderId = 'adMainBarChartPlaceholder';
  let placeholder = wrapper.querySelector(`#${placeholderId}`);
  if (message) {
    canvas.style.display = 'none';
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.id = placeholderId;
      placeholder.className = 'absolute inset-0 flex items-center justify-center text-sm text-slate-500';
      wrapper.appendChild(placeholder);
    }
    placeholder.textContent = message;
    return;
  }
  canvas.style.display = '';
  if (placeholder) placeholder.remove();
}

function renderAdMainChart(data) {
  const canvas = document.getElementById('adMainBarChartCanvas');
  const pieContainer = document.getElementById('adMainPieChartContainer');
  const barContainer = document.getElementById('adMainBarChartContainer');
  if (!canvas) return;

  if (mainBarChart) {
    mainBarChart.destroy();
    mainBarChart = null;
  }

  if (!data.length) {
    setMainBarChartPlaceholder('データがありません');
    if (pieContainer) pieContainer.classList.add('hidden');
    if (barContainer) {
      barContainer.classList.remove('h-[720px]');
      barContainer.classList.add('h-[400px]');
    }
    return;
  }

  setMainBarChartPlaceholder('');

  const normalized = data.map(d => ({
    mediaName: d.mediaName,
    applications: Number(d.applications) || 0,
    validApplications: Number(d.validApplications) || 0,
    totalSales: Number(d.totalSales) || 0,
    cost: Number(d.cost) || 0,
    roas: Number(d.roas) || 0,
    initialInterviewRate: Number(d.initialInterviewRate) || 0,
    hireRate: Number(d.hireRate) || 0,
    retentionWarranty: Number(d.retentionWarranty) || 0
  }));

  // Layout Dynamic Switching
  if (currentGraphMetric === 'roas') {
    // ROAS Mode: Bar + Pie
    // Compact Bar Chart (400px)
    if (barContainer) {
      barContainer.classList.remove('h-[720px]');
      barContainer.classList.add('h-[400px]');
    }
    if (pieContainer) pieContainer.classList.remove('hidden');
  } else {
    // Other Metrics Mode: Bar Only
    // Expand Bar Chart (720px)
    if (barContainer) {
      barContainer.classList.remove('h-[400px]');
      barContainer.classList.add('h-[720px]');
    }
    if (pieContainer) pieContainer.classList.add('hidden');
    if (mainPieChart) {
      mainPieChart.destroy();
      mainPieChart = null;
    }
  }

  let sorted = normalized;
  let datasets = [];
  let xTickFormatter = (v) => formatNumber(v);
  let tooltipFormatter = (ctx) => `${ctx.dataset.label}: ${formatNumber(ctx.parsed.x || 0)}`;
  let scales = {
    x: {
      beginAtZero: true,
      grid: { color: '#f1f5f9' },
      ticks: { callback: xTickFormatter }
    },
    y: { grid: { display: false } }
  };

  // Determine all unique media names for consistent coloring (global scope of data)
  const allMediaNames = data.map(d => d.mediaName);

  if (currentGraphMetric === 'roas') {
    renderRoasPieChart(normalized); // Ensure this is called
    sorted = [...normalized].sort((a, b) => b.roas - a.roas);
    datasets = [{
      label: 'ROAS',
      data: sorted.map(d => d.roas),
      backgroundColor: '#6366f1',
      maxBarThickness: 20,
      categoryPercentage: 0.8,
      barPercentage: 0.9
    }];
    xTickFormatter = (v) => formatPercent(v);
    tooltipFormatter = (ctx) => `ROAS: ${formatPercent(ctx.parsed.x || 0)}`;
    scales.x.ticks.callback = xTickFormatter;
  } else {
    // Metric Chart Logic
    let metricKey = currentGraphMetric;
    let label = '';

    switch (metricKey) {
      case 'initialInterviewRate': label = '初回面談設定率'; break;
      case 'hireRate': label = '入社率'; break;
      case 'retentionWarranty': label = '定着率'; break;
      default: label = metricKey;
    }

    sorted = [...normalized].sort((a, b) => b[metricKey] - a[metricKey]);

    datasets = [{
      label: label,
      data: sorted.map(d => d[metricKey]),
      backgroundColor: sorted.map(d => getMediaColor(d.mediaName, allMediaNames)),
      maxBarThickness: 20,
      categoryPercentage: 0.8,
      barPercentage: 0.9
    }];

    // Rate formatting
    xTickFormatter = (v) => formatPercent(v);
    tooltipFormatter = (ctx) => `${ctx.dataset.label}: ${formatPercent(ctx.parsed.x || 0)}`;

    scales.x.ticks.callback = xTickFormatter;
  }

  const labels = sorted.map(d => d.mediaName);
  const handleClick = (evt, elements, chart) => {
    if (!elements.length) return;
    const index = elements[0].index;
    const mediaName = chart.data.labels[index];
    const input = document.getElementById('adMediaFilter');
    const isSame = selectedMediaFilter && selectedMediaFilter.toLowerCase() === String(mediaName).toLowerCase();
    selectedMediaFilter = isSame ? null : mediaName;
    if (input) input.value = isSame ? '' : mediaName;
    applyFilters(isSame ? '' : mediaName);
  };

  mainBarChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: { label: tooltipFormatter }
        },
        legend: { display: currentGraphMetric !== 'roas' }
      },
      interaction: { mode: 'nearest', intersect: true },
      onClick: handleClick,
      scales
    }
  });
}


function renderRoasPieChart(normalizedData) {
  const canvas = document.getElementById('adMainPieChartCanvas');
  if (!canvas) return;

  if (mainPieChart) {
    mainPieChart.destroy();
  }

  // Filter out items with 0 ROAS to keep clean
  const validData = normalizedData.filter(d => d.roas > 0).sort((a, b) => b.roas - a.roas);

  if (validData.length === 0) {
    // Clear canvas if no data
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const labels = validData.map(d => d.mediaName);
  const data = validData.map(d => d.roas);

  // Generate colors (using a palette or random if many)
  const baseColors = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff', '#94a3b8', '#cbd5e1'];
  const backgroundColors = validData.map((_, i) => baseColors[i % baseColors.length]);

  mainPieChart = new Chart(canvas.getContext('2d'), {
    type: 'doughnut', // Doughnut or Pie
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColors,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right', // Legend on right
          align: 'center',
          labels: { boxWidth: 12, font: { size: 12 } } // Bigger font
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = Number(ctx.raw) || 0;
              return `${ctx.label}: ${val.toFixed(1)}%`;
            }
          }
        }
      }
    }
  });
}

function renderAdCharts(aggregatedData, rawData = adState.filtered) {
  const lineCanvas = document.getElementById('adDecisionLine');
  const barCanvas = document.getElementById('adMainBarChartCanvas');
  if (!lineCanvas || !barCanvas) return;

  if (typeof Chart === 'undefined') {
    ensureChartJs().then(() => renderAdCharts(aggregatedData, rawData));
    return;
  }

  renderAdMainChart(aggregatedData);

  if (!aggregatedData.length) {
    if (decisionLineChart) {
      decisionLineChart.destroy();
      decisionLineChart = null;
    }
    updateContractInfo(aggregatedData);
    return;
  }

  const labels = Array.from(new Set(rawData.map(d => d.period))).sort();
  // Determine all unique media names available in the raw data for consistent coloring
  const allMediaNames = Array.from(new Set(rawData.map(d => d.mediaName)));

  const mediaMap = {};
  rawData.forEach(d => {
    if (!mediaMap[d.mediaName]) mediaMap[d.mediaName] = {};
    mediaMap[d.mediaName][d.period] = d[lineMetric];
  });
  const datasets = Object.keys(mediaMap).map((name) => {
    const color = getMediaColor(name, allMediaNames);
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
  const formatValue = (val) => formatPercent(val || 0);
  let yMin = 0, yMax = 100;

  if (values.length) {
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance) || 0;
    const pad = std || 0;
    yMin = Math.max(0, minVal - pad);
    yMax = Math.max(minVal + 1, maxVal + pad);
  }

  if (decisionLineChart) decisionLineChart.destroy();
  const parentWidth = lineCanvas.parentElement?.clientWidth || 800;
  lineCanvas.width = parentWidth;
  lineCanvas.height = 380;

  const metricLabels = {
    decisionRate: '決定率',
    initialInterviewRate: '初回面談設定率',
    retentionWarranty: '定着率（保障期間）',
    retention30: '定着率（保障期間）'
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
        y: { ticks: { callback: v => `${v}%` }, suggestedMin: yMin, suggestedMax: yMax }
      }
    }
  });

  renderMetricTable(labels, mediaMap);
  updateContractInfo(aggregatedData);
}

function renderMetricTable(labels, mediaMap) {
  // 省略（変更なし）
  const wrapper = document.getElementById('adMetricTable');
  if (!wrapper) return;
  if (!labels.length || !Object.keys(mediaMap).length) {
    wrapper.innerHTML = `<div class="text-sm text-slate-500 p-3">データがありません</div>`;
    return;
  }
  const header = ['<th class="sticky left-0 bg-white z-10 text-left px-3 py-2 text-sm font-semibold text-slate-700">媒体名</th>']
    .concat(labels.map(l => `<th class="px-3 py-2 text-right text-sm font-semibold text-slate-700 whitespace-nowrap">${l}</th>`));

  const valueFormatter = (v) => formatPercent(v || 0);

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
    <div class="table-surface table-teleapo overflow-auto">
      <table class="table-grid min-w-max w-full text-left">
        <thead>
          <tr>${header.join('')}</tr>
        </thead>
        <tbody>
          ${rows.join('')}
        </tbody>
      </table>
    </div>
  `;
}

function formatContractField(value, emptyLabel = '-') {
  const trimmed = String(value ?? '').trim();
  return trimmed ? escapeHtml(trimmed) : emptyLabel;
}

function formatContractRange(startDate, endDate) {
  const start = String(startDate ?? '').trim();
  const end = String(endDate ?? '').trim();

  if (!start && !end) return '-';
  if (start && end) return `${start} ～ ${end}`;
  // ★追加: 終了日がない場合は継続中と表示
  if (start) return `${start} ～ (継続中)`;
  return `～ ${end}`;
}
function formatContractAmount(amount, period) {
  const raw = String(amount ?? '').trim();
  const numeric = raw ? Number(raw.replace(/,/g, '')) : null;
  const amountText = Number.isFinite(numeric) ? `¥${numeric.toLocaleString()}` : '';
  const periodText = String(period ?? '').trim();
  if (!amountText) return '-';
  return periodText ? `${amountText} / ${periodText}` : amountText;
}

function buildAmountPeriodOptions(current) {
  const base = ['', '月', '年', '一括', 'その他'];
  const currentVal = String(current ?? '').trim();
  const options = currentVal && !base.includes(currentVal)
    ? [currentVal, ...base]
    : base;
  return options.map((value) => {
    const label = value ? value : '未設定';
    const selected = value === currentVal ? ' selected' : '';
    return `<option value="${escapeAttr(value)}"${selected}>${escapeHtml(label)}</option>`;
  }).join('');
}

function buildContractSummary(target, contractInfo) {
  // ★変更: ここに totalSales を表示
  const sales = contractInfo?.totalSales || 0;
  return `
    <div class="text-sm text-slate-600 mt-1">決定率: ${formatPercent(target.decisionRate || 0)}</div>
    <div class="text-sm text-slate-600">売上高: ${formatCurrency(sales)}</div> <div class="text-sm text-slate-600">返金額: ${formatCurrency(target.refund || 0)}</div>
    <div class="text-sm text-slate-600">応募: ${formatNumber(target.applications)} / 有効: ${formatNumber(target.validApplications)}</div>
  `;
}

function renderContractLoading(box, target) {
  box.innerHTML = `
    <div class="space-y-1">
      <span class="inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold px-2 py-0.5">媒体契約情報</span>
      <div class="text-base text-slate-800 font-semibold">${escapeHtml(target.mediaName)}</div>
    </div>
    <div class="mt-2 text-sm text-slate-500">読み込み中...</div>
  `;
}

function renderContractError(box, target, message) {
  box.innerHTML = `
    <div class="space-y-1">
      <span class="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-semibold px-2 py-0.5">媒体契約情報</span>
      <div class="text-base text-slate-800 font-semibold">${escapeHtml(target.mediaName)}</div>
    </div>
    <div class="mt-2 text-sm text-rose-600">読み込みに失敗しました: ${escapeHtml(message)}</div>
    <button type="button" id="adContractRetryBtn"
      class="mt-2 px-3 py-1 rounded border border-rose-200 text-xs text-rose-600 hover:bg-rose-50">再読み込み</button>
  `;

  const retryBtn = box.querySelector('#adContractRetryBtn');
  retryBtn?.addEventListener('click', () => {
    const cacheKey = getContractCacheKey(target.mediaName, target.mediaId);
    if (cacheKey) contractInfoCache.delete(cacheKey);
    updateContractInfo(lastAggregated);
  });
}

function renderContractView(box, target, contractInfo) {
  const notes = String(contractInfo.memo ?? '').trim();
  const notesDisplay = notes ? escapeHtml(notes) : '（なし）';

  // ★修正: 表示用に日付を整形 (YYYY/MM/DD)
  const startDisp = formatDateForDisplay(contractInfo.contractStartDate);
  const endDisp = formatDateForDisplay(contractInfo.contractEndDate);

  // 期間表示の作成
  let rangeText = '-';
  if (startDisp) {
    rangeText = endDisp ? `${startDisp} ～ ${endDisp}` : `${startDisp} ～ (継続中)`;
  }

  const amountText = formatContractAmount(contractInfo.contractAmount, contractInfo.amountPeriod);
  const cacheKey = getContractCacheKey(target.mediaName, target.mediaId);

  box.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div class="space-y-1">
        <span class="inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold px-2 py-0.5">媒体契約情報</span>
        <div class="text-base text-slate-800 font-semibold">${escapeHtml(target.mediaName)}</div>
      </div>
      <button type="button" id="adContractEditBtn"
        class="px-3 py-1 rounded border border-slate-300 text-xs text-slate-700 hover:bg-slate-100">編集</button>
    </div>
    ${buildContractSummary(target, contractInfo)}
    <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
      <div class="rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
        <div class="text-[11px] text-slate-500">契約期間</div>
        <div class="text-sm font-semibold text-slate-900">${escapeHtml(rangeText)}</div>
      </div>
      <div class="rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
        <div class="text-[11px] text-slate-500">契約金額</div>
        <div class="text-sm font-semibold text-slate-900">${formatContractField(amountText)}</div>
      </div>
      <div class="rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
        <div class="text-[11px] text-slate-500">契約方式</div>
        <div class="text-sm font-semibold text-slate-900">${formatContractField(contractInfo.contractMethod)}</div>
      </div>
      <div class="rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
        <div class="text-[11px] text-slate-500">更新・解約</div>
        <div class="text-sm font-semibold text-slate-900">${formatContractField(contractInfo.renewalTerms)}</div>
      </div>
    </div>
    <div class="mt-3 rounded-lg border border-slate-200 bg-indigo-50/50 px-3 py-2 text-xs text-slate-600">
      <span class="font-semibold text-slate-700">その他</span>
      <span class="ml-2 text-slate-700">${notesDisplay}</span>
    </div>
    <div class="text-[11px] text-slate-400 mt-2">保存内容はDBに記録されます。</div>
  `;

  const editBtn = box.querySelector('#adContractEditBtn');
  editBtn?.addEventListener('click', () => {
    contractEditTarget = cacheKey;
    // 最新のデータを再取得してから編集モードにする（念のため）
    updateContractInfo(lastAggregated);
  });
}

function renderContractEditor(box, target, contractInfo) {
  const amountOptions = buildAmountPeriodOptions(contractInfo.amountPeriod);
  const cacheKey = getContractCacheKey(target.mediaName, target.mediaId);

  // 終了日が空なら「未定」扱いとする
  const isIndefinite = !contractInfo.contractEndDate;

  // ★修正: input type="date" 用に値を整形 (YYYY-MM-DD)
  const startDateValue = formatDateForInput(contractInfo.contractStartDate);
  const endDateValue = formatDateForInput(contractInfo.contractEndDate);

  box.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div class="space-y-1">
        <span class="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold px-2 py-0.5">媒体契約情報（編集）</span>
        <div class="text-base text-slate-800 font-semibold">${escapeHtml(target.mediaName)}</div>
      </div>
      <button type="button" id="adContractCancelBtn"
        class="px-3 py-1 rounded border border-slate-300 text-xs text-slate-700 hover:bg-slate-100">キャンセル</button>
    </div>
    ${buildContractSummary(target, contractInfo)}
    <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label class="text-xs text-slate-600 sm:col-span-2">
        契約期間
        <div class="mt-1 flex items-start gap-2">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-grow">
            <input id="adContractStartDate" type="date" class="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-200"
              value="${escapeAttr(startDateValue)}" />
            <input id="adContractEndDate" type="date" class="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100 disabled:text-slate-400"
              value="${escapeAttr(endDateValue)}" ${isIndefinite ? 'disabled' : ''} />
          </div>
          <div class="pt-1">
            <label class="flex items-center gap-1 cursor-pointer select-none">
              <input type="checkbox" id="adContractIndefinite" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" ${isIndefinite ? 'checked' : ''}>
              <span class="text-xs whitespace-nowrap text-slate-700">終了日未定</span>
            </label>
          </div>
        </div>
      </label>
      <label class="text-xs text-slate-600">
        契約金額
        <div class="mt-1 flex items-center gap-2">
          <input id="adContractAmount" type="number" min="0" step="1" class="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-200"
            value="${escapeAttr(contractInfo.contractAmount)}" />
          <select id="adContractAmountPeriod" class="rounded border border-slate-300 px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-200">
            ${amountOptions}
          </select>
        </div>
      </label>
      <label class="text-xs text-slate-600">
        契約方式
        <input id="adContractMethod" type="text" class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-200"
          value="${escapeAttr(contractInfo.contractMethod)}" />
      </label>
      <label class="text-xs text-slate-600">
        更新・解約
        <input id="adContractRenewalTerms" type="text" class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-200"
          value="${escapeAttr(contractInfo.renewalTerms)}" />
      </label>
      <label class="text-xs text-slate-600 sm:col-span-2">
        その他
        <textarea id="adContractMemo" rows="2" class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-200">${escapeHtml(contractInfo.memo || '')}</textarea>
      </label>
    </div>
    <div class="mt-2 flex items-center gap-2">
      <button type="button" id="adContractSaveBtn"
        class="px-3 py-1 rounded border border-slate-300 text-xs text-slate-700 hover:bg-slate-100">保存</button>
      <span id="adContractSaveStatus" class="text-xs text-slate-500"></span>
    </div>
    <div class="text-[11px] text-slate-400 mt-1">保存内容はDBに記録されます。</div>
  `;

  const saveBtn = box.querySelector('#adContractSaveBtn');
  const cancelBtn = box.querySelector('#adContractCancelBtn');
  const statusEl = box.querySelector('#adContractSaveStatus');
  const indefiniteCheckbox = box.querySelector('#adContractIndefinite');
  const endDateInput = box.querySelector('#adContractEndDate');

  // キャンセルボタン
  cancelBtn?.addEventListener('click', () => {
    contractEditTarget = null;
    renderContractView(box, target, getContractInfo(cacheKey));
  });

  // 「終了日未定」チェックボックスの制御
  indefiniteCheckbox?.addEventListener('change', (e) => {
    if (e.target.checked) {
      endDateInput.value = '';
      endDateInput.disabled = true;
    } else {
      endDateInput.disabled = false;
    }
  });

  // 保存ボタン
  saveBtn?.addEventListener('click', async () => {
    if (!saveBtn) return;

    const startDateVal = box.querySelector('#adContractStartDate')?.value?.trim();
    const endDateVal = box.querySelector('#adContractEndDate')?.value?.trim();
    const isIndefiniteChecked = indefiniteCheckbox?.checked;

    // バリデーション: 開始日は必須
    if (!startDateVal) {
      alert("「契約開始日」は必須項目です。");
      return;
    }
    // バリデーション: 終了日は「未定」が未チェックなら必須
    if (!isIndefiniteChecked && !endDateVal) {
      alert("「契約終了日」を入力するか、「終了日未定」にチェックを入れてください。");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';
    if (statusEl) statusEl.textContent = '';

    const amountRaw = box.querySelector('#adContractAmount')?.value?.trim() || '';
    const amountValue = amountRaw ? Number(amountRaw.replace(/,/g, '')) : null;
    const contractAmount = Number.isFinite(amountValue) ? amountValue : null;

    const payload = {
      // IDを忘れずに送る
      id: contractInfo.id,

      contractStartDate: startDateVal,
      contractEndDate: isIndefiniteChecked ? null : endDateVal,
      contractAmount,
      amountPeriod: box.querySelector('#adContractAmountPeriod')?.value?.trim() || null,
      contractMethod: box.querySelector('#adContractMethod')?.value?.trim() || null,
      renewalTerms: box.querySelector('#adContractRenewalTerms')?.value?.trim() || null,
      memo: box.querySelector('#adContractMemo')?.value?.trim() || null
    };

    try {
      await saveContractInfo(target.mediaName, payload, target.mediaId);
      contractEditTarget = null;
      renderContractView(box, target, getContractInfo(cacheKey));
      // 一覧テーブルの再計算のためにリロード
      loadAdPerformanceData();
    } catch (err) {
      const message = err?.message || '保存に失敗しました';
      if (statusEl) statusEl.textContent = message;
      saveBtn.disabled = false;
      saveBtn.textContent = '保存';
    }
  });
}

function setContractVisibility(showContract) {
  const contractBox = document.getElementById('adContractInfo');
  const chartSection = document.getElementById('adMainBarChartSection');
  if (chartSection) chartSection.classList.toggle('hidden', showContract);
  if (contractBox) contractBox.classList.toggle('hidden', !showContract);
}

function updateContractInfo(data) {
  const box = document.getElementById('adContractInfo');
  if (!box) return;
  const rawFilter = (document.getElementById('adMediaFilter')?.value || selectedMediaFilter || '').trim();
  const filterText = rawFilter.toLowerCase();
  const hasFilter = Boolean(rawFilter);
  if (!hasFilter) {
    contractEditTarget = null;
    setContractVisibility(false);
    box.innerHTML = `<div class="text-sm text-slate-500 mb-1">媒体契約情報</div><div class="text-base text-slate-700">媒体を選択すると契約条件を表示します。</div>`;
    return;
  }
  setContractVisibility(true);
  const target = data.find(d => d.mediaName.toLowerCase() === filterText) || null;
  if (!target) {
    contractEditTarget = null;
    box.innerHTML = `<div class="text-sm text-slate-500 mb-1">媒体契約情報</div><div class="text-base text-slate-700">選択された媒体が見つかりません。</div>`;
    return;
  }
  const mediaId = resolveMediaId(target);
  const targetWithId = mediaId && !target.mediaId ? { ...target, mediaId } : target;
  const cacheKey = getContractCacheKey(targetWithId.mediaName, targetWithId.mediaId);
  if (contractEditTarget && contractEditTarget !== cacheKey) {
    contractEditTarget = null;
  }

  const cached = contractInfoCache.get(cacheKey);
  if (!cached) {
    renderContractLoading(box, targetWithId);
    ensureContractInfo(targetWithId.mediaName, targetWithId.mediaId)
      .then(() => updateContractInfo(lastAggregated))
      .catch((err) => renderContractError(box, targetWithId, err?.message || '読み込みに失敗しました'));
    return;
  }

  if (contractEditTarget === cacheKey) {
    renderContractEditor(box, targetWithId, getContractInfo(cacheKey));
    return;
  }
  renderContractView(box, targetWithId, getContractInfo(cacheKey));
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

  // ★列順変更: 売上高 -> 契約費用 -> ROAS
  const headers = ['媒体名', '応募件数', '有効応募件数', '初回面談設定数', '初回面談設定率', '内定数', '内定率', '入社数', '入社率', '決定率', '定着率（保障期間）', '売上高（税込）', '契約費用', 'ROAS（売上高/契約費用）', '返金額（税込）'];

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
      `${ad.retentionWarranty.toFixed(1)}%`,
      ad.totalSales,
      ad.cost, // ★ここへ移動
      `${ad.roas.toFixed(1)}%`,
      ad.refund
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
    // ★修正: colspanを16に変更
    tableBody.innerHTML = `<tr><td colspan="16" class="text-center text-red-500 py-6">${message}</td></tr>`;
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
