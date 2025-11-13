// Teleapo Page JavaScript Module
export function mount() {
  console.log('Teleapo page mounted');
  
  // ページがマウントされた後に実行する初期化処理
  initializeTeleapoDatePickers();
  initializeTeleapoKPICharts();
  initializeTeleapoEmployeeControls();
  initializeTeleapoLogFilters();
  loadTeleapoData();
}

export function unmount() {
  console.log('Teleapo page unmounted');
  
  // ページがアンマウントされる前のクリーンアップ処理
  cleanupTeleapoEventListeners();
  cleanupTeleapoCharts();
}

// 日付選択器の初期化
function initializeTeleapoDatePickers() {
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  
  // KPI日付範囲
  const personalRangeStart = document.getElementById('teleapoPersonalRangeStart');
  const personalRangeEnd = document.getElementById('teleapoPersonalRangeEnd');
  const companyRangeStart = document.getElementById('teleapoCompanyRangeStart');
  const companyRangeEnd = document.getElementById('teleapoCompanyRangeEnd');
  
  // ログ日付範囲
  const logRangeStart = document.getElementById('teleapoLogRangeStart');
  const logRangeEnd = document.getElementById('teleapoLogRangeEnd');
  
  // 初期値設定
  [personalRangeStart, companyRangeStart, logRangeStart].forEach(input => {
    if (input) input.value = firstOfMonth;
  });
  
  [personalRangeEnd, companyRangeEnd, logRangeEnd].forEach(input => {
    if (input) input.value = today;
  });
  
  // 日付変更イベントリスナー
  [personalRangeStart, personalRangeEnd, companyRangeStart, companyRangeEnd, logRangeStart, logRangeEnd].forEach(input => {
    if (input) {
      input.addEventListener('change', handleTeleapoDateRangeChange);
    }
  });
}

// KPIチャートの初期化
function initializeTeleapoKPICharts() {
  drawTeleapoTrendChart();
}

// 社員コントロールの初期化
function initializeTeleapoEmployeeControls() {
  const searchInput = document.getElementById('teleapoEmployeeSearchInput');
  const sortSelect = document.getElementById('teleapoEmployeeSortSelect');
  
  if (searchInput) {
    searchInput.addEventListener('input', handleTeleapoEmployeeSearch);
  }
  
  if (sortSelect) {
    sortSelect.addEventListener('change', handleTeleapoEmployeeSort);
  }
}

// ログフィルターの初期化
function initializeTeleapoLogFilters() {
  const employeeFilter = document.getElementById('teleapoLogEmployeeFilter');
  const resultFilter = document.getElementById('teleapoLogResultFilter');
  const targetSearch = document.getElementById('teleapoLogTargetSearch');
  const filterReset = document.getElementById('teleapoLogFilterReset');
  
  [employeeFilter, resultFilter].forEach(element => {
    if (element) {
      element.addEventListener('change', applyTeleapoLogFilter);
    }
  });
  
  if (targetSearch) {
    targetSearch.addEventListener('input', applyTeleapoLogFilter);
  }
  
  if (filterReset) {
    filterReset.addEventListener('click', resetTeleapoLogFilters);
  }
  
  // ソート可能なヘッダー
  const sortableHeaders = document.querySelectorAll('#teleapoLogTable .sortable');
  sortableHeaders.forEach(header => {
    header.addEventListener('click', handleTeleapoLogSort);
  });
}

// Teleapo データの読み込み
async function loadTeleapoData() {
  try {
    // 個人KPIデータの読み込み
    await loadTeleapoPersonalKPIData();
    
    // 社内KPIデータの読み込み
    await loadTeleapoCompanyKPIData();
    
    // 社員データの読み込み
    await loadTeleapoEmployeeData();
    
    // 架電ログデータの読み込み
    await loadTeleapoLogData();
    
  } catch (error) {
    console.error('Failed to load teleapo data:', error);
  }
}

// 個人KPIデータの読み込み
async function loadTeleapoPersonalKPIData() {
  // モックデータ
  const personalKPIData = {
    dials: 156,
    connects: 78,
    sets: 23,
    shows: 19,
    connectRate: 50,
    setRate: 29.5,
    showRate: 82.6
  };
  
  updateTeleapoPersonalKPIDisplay(personalKPIData);
}

// 社内KPIデータの読み込み
async function loadTeleapoCompanyKPIData() {
  const companyKPIData = {
    dials: 1247,
    connects: 623,
    sets: 187,
    shows: 154,
    connectRate: 49.9,
    setRate: 30.0,
    showRate: 82.4
  };
  
  updateTeleapoCompanyKPIDisplay(companyKPIData);
}

// 社員データの読み込み
async function loadTeleapoEmployeeData() {
  const employeeData = [
    {
      name: '佐藤',
      dials: 156,
      connects: 78,
      sets: 23,
      shows: 19,
      connectRate: 50.0,
      setRate: 29.5,
      showRate: 82.6
    },
    {
      name: '田中',
      dials: 189,
      connects: 95,
      sets: 32,
      shows: 28,
      connectRate: 50.3,
      setRate: 33.7,
      showRate: 87.5
    },
    {
      name: '山本',
      dials: 134,
      connects: 67,
      sets: 18,
      shows: 15,
      connectRate: 50.0,
      setRate: 26.9,
      showRate: 83.3
    },
    {
      name: '鈴木',
      dials: 168,
      connects: 82,
      sets: 25,
      shows: 20,
      connectRate: 48.8,
      setRate: 30.5,
      showRate: 80.0
    }
  ];
  
  updateTeleapoEmployeeDisplay(employeeData);
}

// 架電ログデータの読み込み
async function loadTeleapoLogData() {
  // テーブル内のモックデータをそのまま使用
  console.log('Teleapo log data loaded from HTML table');
  updateTeleapoLogCount(5);
}

// 個人KPI表示更新
function updateTeleapoPersonalKPIDisplay(data) {
  const elements = {
    teleapoPersonalDials: data.dials,
    teleapoPersonalConnects: data.connects,
    teleapoPersonalSets: data.sets,
    teleapoPersonalShows: data.shows,
    teleapoPersonalConnectRate: data.connectRate + '%',
    teleapoPersonalSetRate: data.setRate.toFixed(1) + '%',
    teleapoPersonalShowRate: data.showRate.toFixed(1) + '%'
  };
  
  Object.entries(elements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });
  
  // メタ情報も更新
  updateTeleapoPersonalMeta(data);
}

// 社内KPI表示更新
function updateTeleapoCompanyKPIDisplay(data) {
  const elements = {
    teleapoCompanyDials: data.dials.toLocaleString(),
    teleapoCompanyConnects: data.connects.toLocaleString(),
    teleapoCompanySets: data.sets.toLocaleString(),
    teleapoCompanyShows: data.shows.toLocaleString(),
    teleapoCompanyConnectRate: data.connectRate.toFixed(1) + '%',
    teleapoCompanySetRate: data.setRate.toFixed(1) + '%',
    teleapoCompanyShowRate: data.showRate.toFixed(1) + '%'
  };
  
  Object.entries(elements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });
  
  // メタ情報も更新
  updateTeleapoCompanyMeta(data);
}

// 社員表示更新
function updateTeleapoEmployeeDisplay(data) {
  const tableBody = document.getElementById('teleapoEmployeeTableBody');
  if (!tableBody) return;
  
  tableBody.innerHTML = data.map(employee => `
    <tr class="teleapo-employee-row hover:bg-slate-50">
      <td class="font-medium">${employee.name}</td>
      <td class="text-right">${employee.dials}</td>
      <td class="text-right">${employee.connects}</td>
      <td class="text-right">${employee.sets}</td>
      <td class="text-right font-semibold text-green-700">${employee.shows}</td>
      <td class="text-right">${employee.connectRate.toFixed(1)}%</td>
      <td class="text-right">${employee.setRate.toFixed(1)}%</td>
      <td class="text-right">${employee.showRate.toFixed(1)}%</td>
    </tr>
  `).join('');
}

// トレンドチャート描画
function drawTeleapoTrendChart() {
  const svg = document.getElementById('teleapoPersonalTrendChart');
  if (!svg) return;
  
  // 簡易チャート表示（実際にはChart.jsやD3.jsを使用）
  svg.innerHTML = `
    <g>
      <text x="400" y="20" text-anchor="middle" class="text-sm font-semibold">テレアポKPI推移</text>
      <text x="400" y="290" text-anchor="middle" class="text-xs text-slate-500">※実装時はChart.jsライブラリを使用</text>
    </g>
  `;
}

// 個人メタ情報更新
function updateTeleapoPersonalMeta(data) {
  // 通電率のメタ情報
  const connectRateCard = document.querySelector('[data-kpi="connectRate"] .kpi-v2-meta');
  if (connectRateCard) {
    connectRateCard.textContent = `通電数 ${data.connects} / 架電数 ${data.dials}`;
  }
  
  // 設定率のメタ情報
  const setRateCard = document.querySelector('[data-kpi="setRate"] .kpi-v2-meta');
  if (setRateCard) {
    setRateCard.textContent = `設定数 ${data.sets} / 通電数 ${data.connects}`;
  }
  
  // 着座率のメタ情報
  const showRateCard = document.querySelector('[data-kpi="showRate"] .kpi-v2-meta');
  if (showRateCard) {
    showRateCard.textContent = `着座数 ${data.shows} / 設定数 ${data.sets}`;
  }
}

// 社内メタ情報更新
function updateTeleapoCompanyMeta(data) {
  const companySection = document.querySelector('.kpi-v2-subsection');
  
  // 通電率のメタ情報
  const connectRateCard = companySection?.querySelector('[data-kpi="connectRate"] .kpi-v2-meta');
  if (connectRateCard) {
    connectRateCard.textContent = `通電数 ${data.connects} / 架電数 ${data.dials}`;
  }
  
  // 設定率のメタ情報
  const setRateCard = companySection?.querySelector('[data-kpi="setRate"] .kpi-v2-meta');
  if (setRateCard) {
    setRateCard.textContent = `設定数 ${data.sets} / 通電数 ${data.connects}`;
  }
  
  // 着座率のメタ情報
  const showRateCard = companySection?.querySelector('[data-kpi="showRate"] .kpi-v2-meta');
  if (showRateCard) {
    showRateCard.textContent = `着座数 ${data.shows} / 設定数 ${data.sets}`;
  }
}

// ログ件数表示更新
function updateTeleapoLogCount(count) {
  const countElement = document.getElementById('teleapoLogFilterCount');
  if (countElement) {
    countElement.textContent = `${count}件`;
  }
}

// イベントハンドラー
function handleTeleapoDateRangeChange(event) {
  console.log('Teleapo date range changed:', event.target.value);
  // 日付範囲変更時の処理
  loadTeleapoData();
}

function handleTeleapoEmployeeSearch(event) {
  const searchTerm = event.target.value.toLowerCase();
  const rows = document.querySelectorAll('.teleapo-employee-row');
  
  rows.forEach(row => {
    const name = row.querySelector('td:first-child').textContent.toLowerCase();
    row.style.display = name.includes(searchTerm) ? '' : 'none';
  });
}

function handleTeleapoEmployeeSort(event) {
  const sortBy = event.target.value;
  console.log('Sorting teleapo employees by:', sortBy);
  // ソート処理の実装
}

function applyTeleapoLogFilter() {
  const employee = document.getElementById('teleapoLogEmployeeFilter')?.value || '';
  const result = document.getElementById('teleapoLogResultFilter')?.value || '';
  const target = document.getElementById('teleapoLogTargetSearch')?.value || '';
  
  const rows = document.querySelectorAll('#teleapoLogTableBody tr');
  let visibleCount = 0;
  
  rows.forEach(row => {
    let show = true;
    const cells = row.children;
    
    if (employee && cells[1].textContent !== employee) show = false;
    if (result && !cells[5].textContent.includes(result)) show = false;
    if (target && !cells[2].textContent.toLowerCase().includes(target.toLowerCase())) show = false;
    
    row.style.display = show ? '' : 'none';
    if (show) visibleCount++;
  });
  
  updateTeleapoLogCount(visibleCount);
}

function resetTeleapoLogFilters() {
  document.getElementById('teleapoLogEmployeeFilter').value = '';
  document.getElementById('teleapoLogResultFilter').value = '';
  document.getElementById('teleapoLogTargetSearch').value = '';
  
  const rows = document.querySelectorAll('#teleapoLogTableBody tr');
  rows.forEach(row => row.style.display = '');
  
  updateTeleapoLogCount(rows.length);
}

function handleTeleapoLogSort(event) {
  const header = event.currentTarget;
  const sortField = header.dataset.sort;
  const currentDirection = header.dataset.direction || 'asc';
  const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
  
  // すべてのソートインジケーターをリセット
  document.querySelectorAll('#teleapoLogTable .sortable').forEach(h => {
    h.dataset.direction = '';
    const indicator = h.querySelector('.ml-1');
    if (indicator) indicator.textContent = '↕';
  });
  
  // 現在の列のソート方向を更新
  header.dataset.direction = newDirection;
  const indicator = header.querySelector('.ml-1');
  if (indicator) {
    indicator.textContent = newDirection === 'asc' ? '▲' : '▼';
  }
  
  sortTeleapoLogTable(sortField, newDirection);
}

function sortTeleapoLogTable(field, direction) {
  const tableBody = document.getElementById('teleapoLogTableBody');
  const rows = Array.from(tableBody.querySelectorAll('tr'));
  
  rows.sort((a, b) => {
    let aValue, bValue;
    
    switch (field) {
      case 'datetime':
        aValue = a.children[0].textContent;
        bValue = b.children[0].textContent;
        break;
      case 'employee':
        aValue = a.children[1].textContent;
        bValue = b.children[1].textContent;
        break;
      case 'target':
        aValue = a.children[2].textContent;
        bValue = b.children[2].textContent;
        break;
      case 'result':
        aValue = a.children[5].textContent;
        bValue = b.children[5].textContent;
        break;
      default:
        return 0;
    }
    
    const comparison = aValue.localeCompare(bValue, 'ja');
    return direction === 'asc' ? comparison : -comparison;
  });
  
  // ソート済み行を再描画
  tableBody.innerHTML = '';
  rows.forEach(row => tableBody.appendChild(row));
}

// クリーンアップ関数
function cleanupTeleapoEventListeners() {
  console.log('Cleaning up teleapo page event listeners');
  
  const elements = [
    'teleapoPersonalRangeStart',
    'teleapoPersonalRangeEnd',
    'teleapoCompanyRangeStart',
    'teleapoCompanyRangeEnd',
    'teleapoLogRangeStart',
    'teleapoLogRangeEnd',
    'teleapoEmployeeSearchInput',
    'teleapoEmployeeSortSelect',
    'teleapoLogEmployeeFilter',
    'teleapoLogResultFilter',
    'teleapoLogTargetSearch',
    'teleapoLogFilterReset'
  ];
  
  elements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      // すべてのイベントリスナーを削除
      const clonedElement = element.cloneNode(true);
      element.parentNode.replaceChild(clonedElement, element);
    }
  });
}

function cleanupTeleapoCharts() {
  console.log('Cleaning up teleapo page charts');
  
  // チャートのクリーンアップ
  const svg = document.getElementById('teleapoPersonalTrendChart');
  if (svg) {
    svg.innerHTML = '';
  }
}