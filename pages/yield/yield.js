// Yield Page JavaScript Module

export async function mount() {
  console.log('Mounting yield page...');
  
  // ページがマウントされた後に実行する初期化処理
  initializeDatePickers();
  initializeKPICharts();
  initializeEmployeeControls();
  initializeFilters();
  loadYieldData();
  
  console.log('Yield page mounted successfully');
}

export async function unmount() {
  console.log('Unmounting yield page...');
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
  console.log('Initializing KPI charts...');
  
  // 個人成績の月次推移チャートを描画
  drawPersonalTrendChart();
  
  // 4軸比較チャートの初期化
  initializeFourAxisChart();
  
  // 時系列トレンドチャートの初期化
  initializeTimeSeriesChart();
}

// 個人成績の月次推移チャートを描画
function drawPersonalTrendChart() {
  const svg = document.getElementById('personalTrendChart');
  const legendContainer = document.getElementById('personalChartLegend');
  
  if (!svg || !legendContainer) return;
  
  // サンプルデータ（実際の実装では API から取得）
  const sampleData = [
    { month: '6月', proposals: 15, offers: 8, accepts: 5 },
    { month: '7月', proposals: 18, offers: 12, accepts: 7 },
    { month: '8月', proposals: 22, offers: 15, accepts: 9 },
    { month: '9月', proposals: 25, offers: 18, accepts: 12 },
    { month: '10月', proposals: 28, offers: 20, accepts: 14 },
    { month: '11月', proposals: 25, offers: 18, accepts: 11 }
  ];
  
  // SVGの内容をクリア
  svg.innerHTML = '';
  
  // チャートエリアの設定
  const margin = { top: 20, right: 30, bottom: 40, left: 40 };
  const width = 800 - margin.left - margin.right;
  const height = 300 - margin.top - margin.bottom;
  
  // データの最大値を計算
  const maxValue = Math.max(
    ...sampleData.map(d => Math.max(d.proposals, d.offers, d.accepts))
  );
  
  // X軸とY軸のスケール
  const xStep = width / (sampleData.length - 1);
  const yScale = height / maxValue;
  
  // グリッドライン
  for (let i = 0; i <= 5; i++) {
    const y = margin.top + (i * height / 5);
    const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    gridLine.setAttribute('x1', margin.left);
    gridLine.setAttribute('y1', y);
    gridLine.setAttribute('x2', margin.left + width);
    gridLine.setAttribute('y2', y);
    gridLine.setAttribute('stroke', '#e2e8f0');
    gridLine.setAttribute('stroke-width', '1');
    svg.appendChild(gridLine);
    
    // Y軸ラベル
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', margin.left - 10);
    label.setAttribute('y', y + 5);
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('font-size', '12');
    label.setAttribute('fill', '#64748b');
    label.textContent = Math.round(maxValue - (i * maxValue / 5));
    svg.appendChild(label);
  }
  
  // X軸
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', margin.left);
  xAxis.setAttribute('y1', margin.top + height);
  xAxis.setAttribute('x2', margin.left + width);
  xAxis.setAttribute('y2', margin.top + height);
  xAxis.setAttribute('stroke', '#374151');
  xAxis.setAttribute('stroke-width', '2');
  svg.appendChild(xAxis);
  
  // Y軸
  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', margin.left);
  yAxis.setAttribute('y1', margin.top);
  yAxis.setAttribute('x2', margin.left);
  yAxis.setAttribute('y2', margin.top + height);
  yAxis.setAttribute('stroke', '#374151');
  yAxis.setAttribute('stroke-width', '2');
  svg.appendChild(yAxis);
  
  // 線を描画する関数
  function drawLine(data, key, color) {
    let pathData = '';
    
    data.forEach((d, i) => {
      const x = margin.left + (i * xStep);
      const y = margin.top + height - (d[key] * yScale);
      
      if (i === 0) {
        pathData += `M ${x} ${y}`;
      } else {
        pathData += ` L ${x} ${y}`;
      }
      
      // データポイント
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', color);
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', '2');
      svg.appendChild(circle);
    });
    
    // ライン
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    svg.appendChild(path);
  }
  
  // 各線を描画
  drawLine(sampleData, 'proposals', '#3b82f6'); // 提案数 - 青
  drawLine(sampleData, 'offers', '#10b981');    // 内定数 - 緑
  drawLine(sampleData, 'accepts', '#f59e0b');   // 承諾数 - オレンジ
  
  // X軸ラベル
  sampleData.forEach((d, i) => {
    const x = margin.left + (i * xStep);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', margin.top + height + 20);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '12');
    label.setAttribute('fill', '#64748b');
    label.textContent = d.month;
    svg.appendChild(label);
  });
  
  // 凡例を生成
  legendContainer.innerHTML = `
    <div class="kpi-v2-legend-item">
      <div class="kpi-v2-legend-color" style="background-color: #3b82f6;"></div>
      <span>提案数</span>
    </div>
    <div class="kpi-v2-legend-item">
      <div class="kpi-v2-legend-color" style="background-color: #10b981;"></div>
      <span>内定数</span>
    </div>
    <div class="kpi-v2-legend-item">
      <div class="kpi-v2-legend-color" style="background-color: #f59e0b;"></div>
      <span>承諾数</span>
    </div>
  `;
}

// 4軸比較チャートの初期化
function initializeFourAxisChart() {
  // 4軸比較チャートのプレースホルダーを実際のチャートに置き換える
  const chartContainers = document.querySelectorAll('.section-shell .grid .h-56');
  
  chartContainers.forEach((container, index) => {
    if (index === 0) {
      // レーダーチャートエリア
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; color: #64748b;">
          <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
          <p style="font-size: 14px; text-align: center;">レーダーチャート<br>（媒体別・職種別比較）</p>
          <div style="margin-top: 12px; padding: 8px 16px; background: #f1f5f9; border-radius: 6px; font-size: 12px;">
            Chart.js で実装予定
          </div>
        </div>
      `;
    } else if (index === 1) {
      // 分布比較チャートエリア
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; color: #64748b;">
          <div style="font-size: 48px; margin-bottom: 16px;">📈</div>
          <p style="font-size: 14px; text-align: center;">バブルチャート<br>（時期別・面接官別比較）</p>
          <div style="margin-top: 12px; padding: 8px 16px; background: #f1f5f9; border-radius: 6px; font-size: 12px;">
            Chart.js で実装予定
          </div>
        </div>
      `;
    }
  });
}

// 時系列トレンドチャートの初期化
function initializeTimeSeriesChart() {
  // 時系列トレンドチャートのプレースホルダーを実際のチャートに置き換える
  const timeSeriesContainer = document.querySelector('.section-shell .h-48');
  
  if (timeSeriesContainer) {
    timeSeriesContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; color: #64748b;">
        <div style="font-size: 48px; margin-bottom: 16px;">📉</div>
        <p style="font-size: 14px; text-align: center;">時系列トレンド（CV数・歩留・TAT）<br>ラインチャート</p>
        <div style="margin-top: 12px; padding: 8px 16px; background: #f1f5f9; border-radius: 6px; font-size: 12px;">
          Chart.js で実装予定
        </div>
      </div>
    `;
  }
}

// 社員コントロールの初期化
function initializeEmployeeControls() {
  console.log('Initializing employee controls...');
  
  // 社員成績表にサンプルデータを追加
  populateEmployeeTable();
  
  // 検索とフィルター機能を初期化
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
    viewToggle.addEventListener('click', handleEmployeeViewToggle);
  }
}

// 社員成績表にデータを追加
function populateEmployeeTable() {
  const tbody = document.getElementById('employeeTableBody');
  if (!tbody) return;
  
  // サンプル社員データ
  const sampleEmployees = [
    {
      name: '田中太郎',
      proposals: 28,
      recommendations: 25,
      interviews_set: 20,
      interviews_done: 18,
      offers: 15,
      accepts: 12,
      proposal_rate: 85.5,
      recommendation_rate: 89.3,
      interview_set_rate: 80.0,
      interview_done_rate: 90.0,
      offer_rate: 83.3,
      accept_rate: 80.0
    },
    {
      name: '佐藤花子',
      proposals: 35,
      recommendations: 30,
      interviews_set: 25,
      interviews_done: 22,
      offers: 18,
      accepts: 14,
      proposal_rate: 90.2,
      recommendation_rate: 85.7,
      interview_set_rate: 83.3,
      interview_done_rate: 88.0,
      offer_rate: 81.8,
      accept_rate: 77.8
    },
    {
      name: '鈴木次郎',
      proposals: 22,
      recommendations: 18,
      interviews_set: 15,
      interviews_done: 13,
      offers: 10,
      accepts: 8,
      proposal_rate: 78.9,
      recommendation_rate: 81.8,
      interview_set_rate: 83.3,
      interview_done_rate: 86.7,
      offer_rate: 76.9,
      accept_rate: 80.0
    },
    {
      name: '高橋美咲',
      proposals: 31,
      recommendations: 28,
      interviews_set: 23,
      interviews_done: 21,
      offers: 17,
      accepts: 13,
      proposal_rate: 88.7,
      recommendation_rate: 90.3,
      interview_set_rate: 82.1,
      interview_done_rate: 91.3,
      offer_rate: 81.0,
      accept_rate: 76.5
    },
    {
      name: '山田健一',
      proposals: 26,
      recommendations: 22,
      interviews_set: 18,
      interviews_done: 16,
      offers: 12,
      accepts: 9,
      proposal_rate: 82.1,
      recommendation_rate: 84.6,
      interview_set_rate: 81.8,
      interview_done_rate: 88.9,
      offer_rate: 75.0,
      accept_rate: 75.0
    }
  ];
  
  tbody.innerHTML = '';
  
  sampleEmployees.forEach(employee => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="kpi-v2-employee-name">${employee.name}</td>
      <td>${employee.proposals}</td>
      <td>${employee.recommendations}</td>
      <td>${employee.interviews_set}</td>
      <td>${employee.interviews_done}</td>
      <td>${employee.offers}</td>
      <td>${employee.accepts}</td>
      <td class="kpi-v2-rate">${employee.proposal_rate}%</td>
      <td class="kpi-v2-rate">${employee.recommendation_rate}%</td>
      <td class="kpi-v2-rate">${employee.interview_set_rate}%</td>
      <td class="kpi-v2-rate">${employee.interview_done_rate}%</td>
      <td class="kpi-v2-rate">${employee.offer_rate}%</td>
      <td class="kpi-v2-rate ${employee.accept_rate >= 80 ? 'high' : employee.accept_rate >= 75 ? 'medium' : 'low'}">${employee.accept_rate}%</td>
    `;
    tbody.appendChild(row);
  });
}

// フィルター機能の初期化
function initializeFilters() {
  // フィルター初期化処理
  console.log('Initializing filters...');
  
  // KPIタイプ切り替えボタン
  const kpiTypeButtons = document.querySelectorAll('.kpi-type-btn');
  kpiTypeButtons.forEach(button => {
    button.addEventListener('click', handleKPITypeChange);
  });
  
  // 期間フィルター
  const periodButtons = document.querySelectorAll('.period-filter-btn');
  periodButtons.forEach(button => {
    button.addEventListener('click', handlePeriodChange);
  });
}

// データ読み込み
async function loadYieldData() {
  try {
    console.log('Loading yield data...');
    // API calls would go here
    // const data = await fetch('/api/yield-data').then(res => res.json());
    // updateKPICards(data);
    // updateEmployeeTable(data);
    console.log('Yield data loaded successfully');
  } catch (error) {
    console.error('Failed to load yield data:', error);
  }
}

// イベントハンドラー
function handleDateRangeChange(event) {
  const input = event.target;
  const startDate = input.value;
  const endDate = input.nextElementSibling ? input.nextElementSibling.value : null;
  
  console.log('Date range change detected:', { startDate, endDate });
}

function handleEmployeeSort(event) {
  const sortType = event.target.value;
  const tbody = document.getElementById('employeeTableBody');
  if (!tbody) return;
  
  const rows = Array.from(tbody.querySelectorAll('tr'));
  
  rows.sort((a, b) => {
    const aName = a.querySelector('.kpi-v2-employee-name').textContent;
    const bName = b.querySelector('.kpi-v2-employee-name').textContent;
    
    switch (sortType) {
      case 'name-asc':
        return aName.localeCompare(bName, 'ja');
      case 'proposals-desc':
        const aProposals = parseInt(a.cells[1].textContent);
        const bProposals = parseInt(b.cells[1].textContent);
        return bProposals - aProposals;
      case 'offers-desc':
        const aOffers = parseInt(a.cells[5].textContent);
        const bOffers = parseInt(b.cells[5].textContent);
        return bOffers - aOffers;
      case 'acceptRate-desc':
        const aRate = parseFloat(a.cells[12].textContent.replace('%', ''));
        const bRate = parseFloat(b.cells[12].textContent.replace('%', ''));
        return bRate - aRate;
      default:
        return 0;
    }
  });
  
  tbody.innerHTML = '';
  rows.forEach(row => tbody.appendChild(row));
  
  console.log('Employee table sorted by:', sortType);
}

function handleEmployeeSearch(event) {
  const query = event.target.value.toLowerCase();
  const tbody = document.getElementById('employeeTableBody');
  if (!tbody) return;
  
  const rows = tbody.querySelectorAll('tr');
  
  rows.forEach(row => {
    const name = row.querySelector('.kpi-v2-employee-name').textContent.toLowerCase();
    if (name.includes(query)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
  
  console.log('Employee search:', query);
}

function handleEmployeeViewToggle(event) {
  const button = event.target.closest('#employeeViewToggle');
  const currentView = button.dataset.view;
  const tableView = document.getElementById('employeeTableView');
  const cardView = document.getElementById('employeeCardView');
  const toggleText = button.querySelector('.toggle-text');
  
  if (currentView === 'table') {
    // テーブル表示からカード表示に切り替え
    tableView.classList.add('hidden');
    cardView.classList.remove('hidden');
    button.dataset.view = 'card';
    toggleText.textContent = 'テーブル表示';
  } else {
    // カード表示からテーブル表示に切り替え
    cardView.classList.add('hidden');
    tableView.classList.remove('hidden');
    button.dataset.view = 'table';
    toggleText.textContent = 'カード表示';
  }
  
  console.log('Employee view toggled to:', button.dataset.view);
}

function handleKPITypeChange(event) {
  const kpiType = event.target.dataset.kpiType;
  
  // Remove active class from all buttons
  document.querySelectorAll('.kpi-type-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Add active class to clicked button
  event.target.classList.add('active');
  
  console.log('KPI type changed to:', kpiType);
}

function handlePeriodChange(event) {
  const period = event.target.dataset.period;
  
  // Remove active class from all buttons
  document.querySelectorAll('.period-filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Add active class to clicked button
  event.target.classList.add('active');
  
  console.log('Period changed to:', period);
}

function cleanupEventListeners() {
  // イベントリスナーのクリーンアップ
  console.log('Cleaning up yield page event listeners');
}

function cleanupCharts() {
  // チャートのクリーンアップ
  console.log('Cleaning up yield page charts');
}