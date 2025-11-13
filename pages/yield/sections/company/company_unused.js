/**
 * Company Performance Section
 * 社内成績セクションのロジック
 */

import { RepositoryFactory } from '../../../../scripts/api/index.js';

const repositories = RepositoryFactory.create();

export class CompanySection {
  constructor() {
    this.isInitialized = false;
    this.companyData = null;
    this.employeeData = [];
    this.currentView = 'table';
    this.container = null;
  }

  /**
   * セクションの初期化とHTMLコンテンツの読み込み
   */
  async mount(container) {
    if (this.isInitialized) return;
    
    console.log('Company section mounted');
    
    try {
      // コンテナを設定
      this.container = document.getElementById('company-content-container');
      if (!this.container) {
        throw new Error('Company content container not found');
      }

      // HTMLコンテンツを読み込み
      await this.loadHTMLContent();
      
      // 日付選択器の初期化
      this.initializeDatePickers();
      
      // 社内成績データの読み込み
      await this.loadCompanyKPIData();
      
      // 社員データの読み込み
      await this.loadEmployeeData();
      
      // イベントリスナーの設定
      this.setupEventListeners();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Error mounting company section:', error);
    }
  }

  /**
   * HTMLコンテンツの読み込み
   */
  async loadHTMLContent() {
    try {
      // 絶対パスまたはルートから相対パスを使用
      const response = await fetch('/pages/yield/sections/company/company.html');
      if (!response.ok) {
        throw new Error(`Failed to load company.html: ${response.status}`);
      }
      const html = await response.text();
      this.container.innerHTML = html;
      console.log('Company HTML content loaded');
    } catch (error) {
      console.error('Error loading company HTML:', error);
      // フォールバック処理
      this.loadFallbackContent();
    }
  }

  /**
   * フォールバック用のコンテンツ読み込み
   */
  loadFallbackContent() {
    console.log('Loading fallback content for company section');
    this.container.innerHTML = `
      <!-- 社内成績KPI -->
      <div class="kpi-v2-scroll-wrapper">
        <div class="kpi-v2-row" data-kpi-type="counts">
          <div class="kpi-v2-card" data-kpi="companyProposals">
            <div class="kpi-v2-label">提案数</div>
            <div class="kpi-v2-value" id="companyProposals">127</div>
            <div class="kpi-v2-meta">全社</div>
          </div>
          <div class="kpi-v2-card" data-kpi="companyRecommendations">
            <div class="kpi-v2-label">推薦数</div>
            <div class="kpi-v2-value" id="companyRecommendations">89</div>
            <div class="kpi-v2-meta">全社</div>
          </div>
          <div class="kpi-v2-card" data-kpi="companyInterviewsScheduled">
            <div class="kpi-v2-label">面談設定数</div>
            <div class="kpi-v2-value" id="companyInterviewsScheduled">156</div>
            <div class="kpi-v2-meta">全社</div>
          </div>
          <div class="kpi-v2-card" data-kpi="companyInterviewsHeld">
            <div class="kpi-v2-label">面談実施数</div>
            <div class="kpi-v2-value" id="companyInterviewsHeld">132</div>
            <div class="kpi-v2-meta">全社</div>
          </div>
          <div class="kpi-v2-card" data-kpi="companyOffers">
            <div class="kpi-v2-label">オファー数</div>
            <div class="kpi-v2-value" id="companyOffers">68</div>
            <div class="kpi-v2-meta">全社</div>
          </div>
          <div class="kpi-v2-card" data-kpi="companyAccepts">
            <div class="kpi-v2-label">承諾数</div>
            <div class="kpi-v2-value" id="companyAccepts">41</div>
            <div class="kpi-v2-meta">全社</div>
          </div>
        </div>
      </div>
      
      <!-- 社員成績テーブル -->
      <div class="kpi-v2-employee-section">
        <div class="kpi-v2-search-filters">
          <input type="text" id="employeeSearchInput" placeholder="社員検索..." class="kpi-v2-search-input">
          <select id="employeeSortSelect" class="kpi-v2-select">
            <option value="name">名前順</option>
            <option value="performance">成績順</option>
          </select>
          <button id="employeeViewToggle" class="kpi-v2-view-toggle" data-view="table">
            <span class="toggle-text">カード表示</span>
          </button>
        </div>
        
        <!-- テーブル表示 -->
        <div id="employeeTableView" class="kpi-v2-table-wrapper">
          <table class="kpi-v2-table">
            <thead>
              <tr>
                <th>社員名</th>
                <th>提案数</th>
                <th>推薦数</th>
                <th>面談設定数</th>
                <th>面談実施数</th>
                <th>オファー数</th>
                <th>承諾数</th>
              </tr>
            </thead>
            <tbody id="employeeTableBody">
              <tr>
                <td>佐藤太郎</td>
                <td>25</td>
                <td>18</td>
                <td>22</td>
                <td>20</td>
                <td>12</td>
                <td>8</td>
              </tr>
              <tr>
                <td>田中花子</td>
                <td>32</td>
                <td>28</td>
                <td>35</td>
                <td>31</td>
                <td>18</td>
                <td>11</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * セクションのクリーンアップ
   */
  unmount() {
    console.log('Company section unmounted');
    this.cleanupEventListeners();
    this.isInitialized = false;
  }

  /**
   * 日付選択器の初期化
   */
  initializeDatePickers() {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const companyRangeStart = document.getElementById('companyRangeStart');
    const companyRangeEnd = document.getElementById('companyRangeEnd');
    
    if (companyRangeStart) companyRangeStart.value = thirtyDaysAgo;
    if (companyRangeEnd) companyRangeEnd.value = today;
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    const startDate = document.getElementById('companyRangeStart');
    const endDate = document.getElementById('companyRangeEnd');
    const searchInput = document.getElementById('employeeSearchInput');
    const sortSelect = document.getElementById('employeeSortSelect');
    const viewToggle = document.getElementById('employeeViewToggle');
    
    if (startDate) {
      startDate.addEventListener('change', () => this.loadCompanyKPIData());
    }
    
    if (endDate) {
      endDate.addEventListener('change', () => this.loadCompanyKPIData());
    }
    
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.filterEmployees(e.target.value));
    }
    
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => this.sortEmployees(e.target.value));
    }
    
    if (viewToggle) {
      viewToggle.addEventListener('click', () => this.toggleEmployeeView());
    }
  }

  /**
   * イベントリスナーのクリーンアップ
   */
  cleanupEventListeners() {
    // 必要に応じてリスナーを削除
  }

  /**
   * 社内成績データの読み込み
   */
  async loadCompanyKPIData() {
    try {
      // 日付範囲を取得
      const startDate = document.getElementById('companyRangeStart')?.value || '2024-09-01';
      const endDate = document.getElementById('companyRangeEnd')?.value || '2024-11-30';
      
      // APIからデータを取得
      const data = await repositories.kpi.getCompanyKpi(startDate, endDate);
      
      // データを表示
      this.updateCompanyKPIDisplay(data);
    } catch (error) {
      console.error('Failed to load company KPI data:', error);
      // フォールバック：モックデータを使用
      this.loadCompanyKPIDataFallback();
    }
  }

  /**
   * フォールバック用モックデータの読み込み
   */
  loadCompanyKPIDataFallback() {
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
    
    this.updateCompanyKPIDisplay(companyKPIData);
  }

  /**
   * 社員データの読み込み
   */
  async loadEmployeeData() {
    try {
      // APIから社員データを取得
      const data = await repositories.kpi.getEmployeePerformance({
        search: '',
        sortBy: 'rate',
        sortOrder: 'desc'
      });
      
      this.employeeData = data;
      this.updateEmployeeTable(data);
    } catch (error) {
      console.error('Failed to load employee data:', error);
      // フォールバック：モックデータを使用
      this.loadEmployeeDataFallback();
    }
  }

  /**
   * フォールバック用モックデータの読み込み
   */
  loadEmployeeDataFallback() {
    this.employeeData = [
      {
        name: '田中太郎',
        proposals: 45,
        recommendations: 28,
        interviewsScheduled: 32,
        interviewsHeld: 28,
        offers: 12,
        accepts: 8,
        proposalRate: 62.2,
        recommendationRate: 87.5,
        interviewScheduleRate: 89.3,
        interviewHeldRate: 87.5,
        offerRate: 42.9,
        acceptRate: 66.7
      },
      // 他の社員データ...
    ];
    
    this.updateEmployeeTable(this.employeeData);
  }

  /**
   * 社内成績データを表示に反映
   */
  updateCompanyKPIDisplay(data) {
    // 社内成績の更新
    this.updateElement('companyProposals', data.proposals || 0);
    this.updateElement('companyRecommendations', data.recommendations || 0);
    this.updateElement('companyInterviewsScheduled', data.interviewsScheduled || 0);
    this.updateElement('companyInterviewsHeld', data.interviewsHeld || 0);
    this.updateElement('companyOffers', data.offers || 0);
    this.updateElement('companyAccepts', data.accepts || 0);
    
    this.updateElement('companyProposalRate', `${data.proposalRate || 0}%`);
    this.updateElement('companyRecommendationRate', `${data.recommendationRate || 0}%`);
    this.updateElement('companyInterviewScheduleRate', `${data.interviewScheduleRate || 0}%`);
    this.updateElement('companyInterviewHeldRate', `${data.interviewHeldRate || 0}%`);
    this.updateElement('companyOfferRate', `${data.offerRate || 0}%`);
    this.updateElement('companyAcceptRate', `${data.acceptRate || 0}%`);
  }

  /**
   * 社員表の更新
   */
  updateEmployeeTable(employees) {
    const tableBody = document.getElementById('employeeTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    employees.forEach(employee => {
      const row = document.createElement('tr');
      row.innerHTML = `
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
      `;
      tableBody.appendChild(row);
    });
  }

  /**
   * 社員フィルタリング
   */
  filterEmployees(searchTerm) {
    const filtered = this.employeeData.filter(employee =>
      employee.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    this.updateEmployeeTable(filtered);
  }

  /**
   * 社員ソート
   */
  sortEmployees(sortBy) {
    // ソート機能の実装
    console.log('Sorting by:', sortBy);
  }

  /**
   * 表示形式の切り替え
   */
  toggleEmployeeView() {
    this.currentView = this.currentView === 'table' ? 'card' : 'table';
    // 表示切り替えロジックの実装
  }

  /**
   * 要素の更新ヘルパー
   */
  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }
}

// デフォルトエクスポート
export default CompanySection;