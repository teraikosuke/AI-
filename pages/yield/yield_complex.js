// Yield Page JavaScript Module - Team Development Integration

// 動的インポート用の変数
let PersonalSection = null;
let CompanySection = null;
let ComparisonSection = null;

// セクションインスタンスの保持
let personalSectionInstance = null;
let companySectionInstance = null;
let comparisonSectionInstance = null;

export async function mount() {
  console.log('🚀 Yield page mounting started...');
  
  // 基本的な DOM 要素の確認
  const personalContainer = document.getElementById('personal-content-container');
  const companyContainer = document.getElementById('company-content-container');
  const comparisonContainer = document.getElementById('comparison-content-container');
  
  console.log('📋 Container check:', {
    personal: !!personalContainer,
    company: !!companyContainer,
    comparison: !!comparisonContainer
  });

  if (!personalContainer || !companyContainer || !comparisonContainer) {
    console.error('❌ Containers not found!');
    return;
  }

  try {
    // 各セクションのHTMLコンテンツを直接読み込み
    console.log('🔄 Loading section content from HTML files...');
    
    // Personal section
    try {
      const personalResponse = await fetch('/pages/yield/sections/personal/personal.html');
      if (personalResponse.ok) {
        const personalHTML = await personalResponse.text();
        personalContainer.innerHTML = personalHTML;
        console.log('✅ Personal section HTML loaded');
      } else {
        throw new Error('Personal HTML not found');
      }
    } catch (error) {
      console.warn('⚠️ Personal HTML fallback:', error);
      await loadPersonalFallback(personalContainer);
    }

    // Company section
    try {
      const companyResponse = await fetch('/pages/yield/sections/company/company.html');
      if (companyResponse.ok) {
        const companyHTML = await companyResponse.text();
        companyContainer.innerHTML = companyHTML;
        console.log('✅ Company section HTML loaded');
      } else {
        throw new Error('Company HTML not found');
      }
    } catch (error) {
      console.warn('⚠️ Company HTML fallback:', error);
      await loadCompanyFallback(companyContainer);
    }

    // Comparison section
    try {
      const comparisonResponse = await fetch('/pages/yield/sections/comparison/comparison.html');
      if (comparisonResponse.ok) {
        const comparisonHTML = await comparisonResponse.text();
        comparisonContainer.innerHTML = comparisonHTML;
        console.log('✅ Comparison section HTML loaded');
      } else {
        throw new Error('Comparison HTML not found');
      }
    } catch (error) {
      console.warn('⚠️ Comparison HTML fallback:', error);
      await loadComparisonFallback(comparisonContainer);
    }

    console.log('🎉 All sections loaded successfully');
    
  } catch (error) {
    console.error('❌ Failed to load sections:', error);
  }
}

// Personal section fallback
async function loadPersonalFallback(container) {
  container.innerHTML = `
    <!-- 売り上げ達成率と目標金額（統合カード） -->
    <div class="kpi-v2-summary-unified" style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 24px; border-radius: 12px; margin: 20px 0; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);">
      <div class="kpi-v2-achievement-section" style="margin-bottom: 16px;">
        <div class="kpi-v2-label" style="font-size: 14px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">売り上げ達成率</div>
        <div class="kpi-v2-value kpi-v2-value-large" style="font-size: 36px; font-weight: 800; color: #3b82f6; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">33%</div>
      </div>
      <div class="kpi-v2-target-section">
        <div class="kpi-v2-label" style="font-size: 14px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">現状 / 目標金額</div>
        <div class="kpi-v2-value" style="font-size: 20px; font-weight: 700;">
          <span class="kpi-v2-current" style="color: #059669; font-size: 1.1em;">¥957,000</span>
          <span class="kpi-v2-separator" style="margin: 0 12px; color: #9ca3af;">/</span>
          <span class="kpi-v2-target" style="color: #6b7280;">¥3,000,000</span>
        </div>
      </div>
    </div>

    <!-- 7KPI 数の行 -->
    <div class="kpi-v2-scroll-wrapper" style="margin: 20px 0;">
      <div class="kpi-v2-row" data-kpi-type="counts" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;">
        <div class="kpi-v2-card" style="background: white; padding: 18px; border-radius: 10px; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.12); border-left: 4px solid #3b82f6; transform: translateY(0); transition: transform 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
          <div class="kpi-v2-label" style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">提案数</div>
          <div class="kpi-v2-value" style="font-size: 28px; font-weight: 700; color: #1f2937;">25</div>
          <div class="kpi-v2-meta" style="font-size: 11px; color: #9ca3af; margin-top: 4px;">新規面談数 30(10)</div>
        </div>
        <div class="kpi-v2-card" style="background: white; padding: 18px; border-radius: 10px; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.12); border-left: 4px solid #3b82f6; transform: translateY(0); transition: transform 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
          <div class="kpi-v2-label" style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">推薦数</div>
          <div class="kpi-v2-value" style="font-size: 28px; font-weight: 700; color: #1f2937;">18</div>
          <div class="kpi-v2-meta" style="font-size: 11px; color: #9ca3af; margin-top: 4px;">推薦数 30(10)</div>
        </div>
        <div class="kpi-v2-card" style="background: white; padding: 18px; border-radius: 10px; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.12); border-left: 4px solid #3b82f6; transform: translateY(0); transition: transform 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
          <div class="kpi-v2-label" style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">面談設定数</div>
          <div class="kpi-v2-value" style="font-size: 28px; font-weight: 700; color: #1f2937;">22</div>
          <div class="kpi-v2-meta" style="font-size: 11px; color: #9ca3af; margin-top: 4px;">面談設定数 30(10)</div>
        </div>
        <div class="kpi-v2-card" style="background: white; padding: 18px; border-radius: 10px; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.12); border-left: 4px solid #3b82f6; transform: translateY(0); transition: transform 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
          <div class="kpi-v2-label" style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">面談実施数</div>
          <div class="kpi-v2-value" style="font-size: 28px; font-weight: 700; color: #1f2937;">20</div>
          <div class="kpi-v2-meta" style="font-size: 11px; color: #9ca3af; margin-top: 4px;">面談実施数 30(10)</div>
        </div>
        <div class="kpi-v2-card" style="background: white; padding: 18px; border-radius: 10px; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.12); border-left: 4px solid #3b82f6; transform: translateY(0); transition: transform 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
          <div class="kpi-v2-label" style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">内定数</div>
          <div class="kpi-v2-value" style="font-size: 28px; font-weight: 700; color: #1f2937;">12</div>
          <div class="kpi-v2-meta" style="font-size: 11px; color: #9ca3af; margin-top: 4px;">内定数 30(10)</div>
        </div>
        <div class="kpi-v2-card" style="background: white; padding: 18px; border-radius: 10px; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.12); border-left: 4px solid #3b82f6; transform: translateY(0); transition: transform 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
          <div class="kpi-v2-label" style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">承諾数</div>
          <div class="kpi-v2-value" style="font-size: 28px; font-weight: 700; color: #1f2937;">8</div>
          <div class="kpi-v2-meta" style="font-size: 11px; color: #9ca3af; margin-top: 4px;">承諾数 30(10)</div>
        </div>
        <div class="kpi-v2-card" style="background: white; padding: 18px; border-radius: 10px; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.12); border-left: 4px solid #3b82f6; transform: translateY(0); transition: transform 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
          <div class="kpi-v2-label" style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">決定数</div>
          <div class="kpi-v2-value" style="font-size: 28px; font-weight: 700; color: #1f2937;">5</div>
          <div class="kpi-v2-meta" style="font-size: 11px; color: #9ca3af; margin-top: 4px;">決定数 30(10)</div>
        </div>
      </div>
    </div>
  `;
}

export async function unmount() {
  console.log('Yield page unmounted - Cleaning up modular sections');
  
  try {
    // 各セクションのアンマウント処理を並列実行
    const unmountPromises = [];
    
    if (personalSectionInstance) {
      unmountPromises.push(personalSectionInstance.unmount());
    }
    
    if (companySectionInstance) {
      unmountPromises.push(companySectionInstance.unmount());
    }
    
    if (comparisonSectionInstance) {
      unmountPromises.push(comparisonSectionInstance.unmount());
    }
    
    await Promise.all(unmountPromises);
    
    // インスタンスをクリア
    personalSectionInstance = null;
    companySectionInstance = null;
    comparisonSectionInstance = null;
    
  } catch (error) {
    console.error('Error during yield sections unmount:', error);
  }
  
  // 共通のクリーンアップ処理
  cleanupEventListeners();
  cleanupCharts();
}

// フォールバック初期化（従来のコード）
async function fallbackInitialization() {
  console.log('Running fallback initialization for yield page');
  
  try {
    // 直接コンテンツを挿入
    const personalContainer = document.getElementById('personal-content-container');
    const companyContainer = document.getElementById('company-content-container');
    const comparisonContainer = document.getElementById('comparison-content-container');
    
    if (personalContainer) {
      personalContainer.innerHTML = `
        <!-- 売り上げ達成率と目標金額（統合カード） -->
        <div class="kpi-v2-summary-unified">
          <div class="kpi-v2-achievement-section">
            <div class="kpi-v2-label">売り上げ達成率</div>
            <div class="kpi-v2-value kpi-v2-value-large" id="personalAchievementRate">33%</div>
          </div>
          <div class="kpi-v2-target-section">
            <div class="kpi-v2-label">現状 / 目標金額</div>
            <div class="kpi-v2-value">
              <span class="kpi-v2-current" id="personalCurrent">¥957,000</span>
              <span class="kpi-v2-separator">/</span>
              <span class="kpi-v2-target" id="personalTarget">¥3,000,000</span>
            </div>
          </div>
        </div>
        <!-- 7KPI 数の行 -->
        <div class="kpi-v2-scroll-wrapper">
          <div class="kpi-v2-row" data-kpi-type="counts">
            <div class="kpi-v2-card" data-kpi="proposals">
              <div class="kpi-v2-label">提案数</div>
              <div class="kpi-v2-value" id="personalProposals">10</div>
              <div class="kpi-v2-meta">新規面談数 30(10)</div>
            </div>
            <div class="kpi-v2-card" data-kpi="recommendations">
              <div class="kpi-v2-label">推薦数</div>
              <div class="kpi-v2-value" id="personalRecommendations">10</div>
              <div class="kpi-v2-meta">推薦数 30(10)</div>
            </div>
            <div class="kpi-v2-card" data-kpi="interviewsScheduled">
              <div class="kpi-v2-label">面談設定数</div>
              <div class="kpi-v2-value" id="personalInterviewsScheduled">10</div>
              <div class="kpi-v2-meta">面談設定数 30(10)</div>
            </div>
          </div>
        </div>
      `;
      console.log('Personal section fallback content loaded');
    }
    
    if (companyContainer) {
      await loadCompanyFallback(companyContainer);
      console.log('Company section fallback content loaded');
    }
    
    if (comparisonContainer) {
      await loadComparisonFallback(comparisonContainer);
      console.log('Comparison section fallback content loaded');
    }
    
    // ページがマウントされた後に実行する初期化処理
    initializeDatePickers();
    // initializeKPICharts();
    // initializeEmployeeControls();
    // initializeFilters();
    // loadYieldData(); // API関連は無効化
    
    console.log('Fallback initialization completed');
  } catch (error) {
    console.error('Error in fallback initialization:', error);
  }
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
    // APIへの依存を一時的に無効化
    console.log('Yield data loading disabled - using static display');
    /*
    // 個人成績データの読み込み
    await loadPersonalKPIData();
    
    // 社内成績データの読み込み
    await loadCompanyKPIData();
    
    // 社員成績データの読み込み
    await loadEmployeeData();
    
    // 候補者データの読み込み
    await loadCandidateData();
    */
  } catch (error) {
    console.error('Failed to load yield data:', error);
  }
}

// API関連の関数は一時的に無効化
/*
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
    updateEmployeeDisplay(data);
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
*/

// 候補者データの読み込み
async function loadCandidateData() {
  // 既存のHTMLテーブルデータを使用
  console.log('Candidate data loaded from HTML table');
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