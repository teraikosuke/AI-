// Yield Page JavaScript Module
import { RepositoryFactory } from '../../scripts/api/index.js';

const repositories = RepositoryFactory.create();

export function mount() {
  console.log('Yield page mounted');
  
  // ページがマウントされた後に実行する初期化処理
  initializeDatePickers();
  initializeKPICharts();
  initializeEmployeeControls();
  initializeFilters();
  loadYieldData();
}

export function unmount() {
  console.log('Yield page unmounted');
  
  // ページがアンマウントされる前のクリーンアップ処理
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
  
  if (personalRangeStart) personalRangeStart.value = thirtyDaysAgo;
  if (personalRangeEnd) personalRangeEnd.value = today;
  if (companyRangeStart) companyRangeStart.value = thirtyDaysAgo;
  if (companyRangeEnd) companyRangeEnd.value = today;
  
  // 日付変更イベントリスナー
  [personalRangeStart, personalRangeEnd, companyRangeStart, companyRangeEnd].forEach(input => {
    if (input) {
      input.addEventListener('change', handleDateRangeChange);
    }
  });
}

// KPIチャートの初期化
function initializeKPICharts() {
  // 月次推移チャートの初期化
  drawTrendChart();
}

// 社員コントロールの初期化
function initializeEmployeeControls() {
  const searchInput = document.getElementById('employeeSearchInput');
  const sortSelect = document.getElementById('employeeSortSelect');
  const viewToggle = document.getElementById('employeeViewToggle');
  
  if (searchInput) {
    searchInput.addEventListener('input', handleEmployeeSearch);
  }
  
  if (sortSelect) {
    sortSelect.addEventListener('change', handleEmployeeSort);
  }
  
  if (viewToggle) {
    viewToggle.addEventListener('click', handleViewToggle);
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
    // 個人成績データの読み込み
    await loadPersonalKPIData();
    
    // 社内成績データの読み込み
    await loadCompanyKPIData();
    
    // 社員成績データの読み込み
    await loadEmployeeData();
    
    // 候補者データの読み込み
    await loadCandidateData();
    
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
    const data = await repositories.kpi.getPersonalKpi(startDate, endDate);
    
    // データを表示
    updatePersonalKPIDisplay(data);
  } catch (error) {
    console.error('Failed to load personal KPI data:', error);
    // フォールバック：モックデータを使用
    loadPersonalKPIDataFallback();
  }
}

// フォールバック用モックデータの読み込み
function loadPersonalKPIDataFallback() {
  const personalKPIData = {
    achievementRate: 33,
    currentAmount: 957000,
    targetAmount: 3000000,
    proposals: 10,
    recommendations: 10,
    interviewsScheduled: 10,
    interviewsHeld: 10,
    offers: 10,
    accepts: 10,
    hires: 10,
    proposalRate: 33,
    recommendationRate: 33,
    interviewScheduleRate: 33,
    interviewHeldRate: 33,
    offerRate: 33,
    acceptRate: 33,
    hireRate: 33
  };
  
  updatePersonalKPIDisplay(personalKPIData);
}

// 個人KPIデータを表示に反映
function updatePersonalKPIDisplay(data) {
  // 基本KPI更新
  document.getElementById('personalAchievementRate').textContent = `${data.achievementRate || 0}%`;
  document.getElementById('personalCurrent').textContent = `¥${(data.currentAmount || 0).toLocaleString()}`;
  document.getElementById('personalTarget').textContent = `¥${(data.targetAmount || 0).toLocaleString()}`;
  
  // 各種数値の更新
  document.getElementById('personalProposals').textContent = data.proposals || 0;
  document.getElementById('personalRecommendations').textContent = data.recommendations || 0;
  document.getElementById('personalInterviewsScheduled').textContent = data.interviewsScheduled || 0;
  document.getElementById('personalInterviewsHeld').textContent = data.interviewsHeld || 0;
  document.getElementById('personalOffers').textContent = data.offers || 0;
  document.getElementById('personalAccepts').textContent = data.accepts || 0;
  document.getElementById('personalHires').textContent = data.hires || 0;
  
  // 率の更新
  document.getElementById('personalProposalRate').textContent = `${data.proposalRate || 0}%`;
  document.getElementById('personalRecommendationRate').textContent = `${data.recommendationRate || 0}%`;
  document.getElementById('personalInterviewScheduleRate').textContent = `${data.interviewScheduleRate || 0}%`;
  document.getElementById('personalInterviewHeldRate').textContent = `${data.interviewHeldRate || 0}%`;
  document.getElementById('personalOfferRate').textContent = `${data.offerRate || 0}%`;
  document.getElementById('personalAcceptRate').textContent = `${data.acceptRate || 0}%`;
  document.getElementById('personalHireRate').textContent = `${data.hireRate || 0}%`;
}

// 社内成績データの読み込み
// 会社KPIデータの読み込み
async function loadCompanyKPIData() {
  try {
    // 日付範囲を取得
    const startDate = document.getElementById('companyRangeStart')?.value || '2024-09-01';
    const endDate = document.getElementById('companyRangeEnd')?.value || '2024-11-30';
    
    // APIからデータを取得
    const data = await repositories.kpi.getCompanyKpi(startDate, endDate);
    
    // データを表示
    updateCompanyKPIDisplay(data);
  } catch (error) {
    console.error('Failed to load company KPI data:', error);
    // フォールバック：モックデータを使用
    loadCompanyKPIDataFallback();
  }
}

// フォールバック用モックデータの読み込み
function loadCompanyKPIDataFallback() {
  const companyKPIData = {
    proposals: 127,
    recommendations: 89,
    interviewsScheduled: 156,
    interviewsHeld: 132,
    offers: 68,
    accepts: 41,
    proposalRate: 69,
    recommendationRate: 70,
    interviewScheduleRate: 175,
    interviewHeldRate: 85,
    offerRate: 52,
    acceptRate: 60
  };
  
  updateCompanyKPIDisplay(companyKPIData);
}

// 社員データの読み込み
async function loadEmployeeData() {
  try {
    // APIから社員データを取得
    const data = await repositories.kpi.getEmployeePerformance({
      search: '',
      sortBy: 'rate',
      sortOrder: 'desc'
    });
    
    // データを表示
    updateEmployeeTable(data);
  } catch (error) {
    console.error('Failed to load employee data:', error);
    // フォールバック：モックデータを使用
    loadEmployeeDataFallback();
  }
}

// フォールバック用モックデータの読み込み
function loadEmployeeDataFallback() {
  // モック社員データ
  const employeeData = [
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
  
  updateEmployeeDisplay(employeeData);
}

// 候補者データの読み込み
async function loadCandidateData() {
  // 既存のHTMLテーブルデータを使用
  console.log('Candidate data loaded from HTML table');
}

// 個人KPI表示の更新
function updatePersonalKPIDisplay(data) {
  const elements = {
    personalAchievementRate: data.achievementRate + '%',
    personalCurrent: '¥' + data.currentAmount.toLocaleString(),
    personalTarget: '¥' + data.targetAmount.toLocaleString(),
    personalProposals: data.proposals,
    personalRecommendations: data.recommendations,
    personalInterviewsScheduled: data.interviewsScheduled,
    personalInterviewsHeld: data.interviewsHeld,
    personalOffers: data.offers,
    personalAccepts: data.accepts,
    personalHires: data.hires,
    personalProposalRate: data.proposalRate + '%',
    personalRecommendationRate: data.recommendationRate + '%',
    personalInterviewScheduleRate: data.interviewScheduleRate + '%',
    personalInterviewHeldRate: data.interviewHeldRate + '%',
    personalOfferRate: data.offerRate + '%',
    personalAcceptRate: data.acceptRate + '%',
    personalHireRate: data.hireRate + '%'
  };
  
  Object.entries(elements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });
}

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
}

// 社員表示の更新
function updateEmployeeDisplay(data) {
  const tableBody = document.getElementById('employeeTableBody');
  if (!tableBody) return;
  
  tableBody.innerHTML = data.map(employee => `
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
function drawTrendChart() {
  const svg = document.getElementById('personalTrendChart');
  if (!svg) return;
  
  // モックチャートデータ
  const months = ['11月', '12月', '1月', '2月', '3月', '4月'];
  const proposalData = [8, 12, 15, 10, 18, 10];
  const offerData = [3, 5, 7, 4, 8, 10];
  
  // SVGチャートの簡易描画（実際にはChart.jsやD3.jsを使用することを推奨）
  svg.innerHTML = `
    <g>
      <text x="400" y="20" text-anchor="middle" class="text-sm font-semibold">月次KPI推移</text>
      <text x="400" y="290" text-anchor="middle" class="text-xs text-slate-500">※実装時はChart.jsライブラリを使用</text>
    </g>
  `;
}

// イベントハンドラー
function handleDateRangeChange(event) {
  console.log('Date range changed:', event.target.value);
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
  console.log('Sorting employees by:', sortBy);
  // ソート処理の実装
}

function handleViewToggle(event) {
  const button = event.target.closest('.kpi-v2-view-toggle');
  const currentView = button.dataset.view;
  const tableView = document.getElementById('employeeTableView');
  const cardView = document.getElementById('employeeCardView');
  const toggleText = button.querySelector('.toggle-text');
  
  if (currentView === 'table') {
    tableView.classList.add('hidden');
    cardView.classList.remove('hidden');
    button.dataset.view = 'card';
    toggleText.textContent = 'テーブル表示';
  } else {
    cardView.classList.add('hidden');
    tableView.classList.remove('hidden');
    button.dataset.view = 'table';
    toggleText.textContent = 'カード表示';
  }
}

function handleFilterApply(event) {
  console.log('Applying filters');
  // フィルター適用処理
  applyFilters();
}

function handleFilterReset(event) {
  console.log('Resetting filters');
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
  console.log('Applying sort');
}

function checkContactPermission() {
  // 実際の権限チェックロジック
  // 今はダミーでtrueを返す
  return true;
}

function cleanupEventListeners() {
  // イベントリスナーのクリーンアップ
  console.log('Cleaning up yield page event listeners');
}

function cleanupCharts() {
  // チャートのクリーンアップ
  console.log('Cleaning up yield page charts');
}