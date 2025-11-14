/**
 * Comparison Section
 * 4軸比較セクションのロジック
 */

export class ComparisonSection {
  constructor() {
    this.isInitialized = false;
    this.currentAxis = 'media';
    this.chartData = null;
    this.container = null;
  }

  /**
   * セクションの初期化とHTMLコンテンツの読み込み
   */
  async mount(container) {
    if (this.isInitialized) return;
    
    console.log('Comparison section mounted');
    
    try {
      // コンテナを設定
      this.container = document.getElementById('comparison-content-container');
      if (!this.container) {
        throw new Error('Comparison content container not found');
      }

      // HTMLコンテンツを読み込み
      await this.loadHTMLContent();
      
      // チャートの初期化
      this.initializeCharts();
      
      // ファネルテーブルの初期化
      this.initializeFunnelTable();
      
      // イベントリスナーの設定
      this.setupEventListeners();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Error mounting comparison section:', error);
    }
  }

  /**
   * HTMLコンテンツの読み込み
   */
  async loadHTMLContent() {
    try {
      // 絶対パスまたはルートから相対パスを使用
      const response = await fetch('/pages/yield/sections/comparison/comparison.html');
      if (!response.ok) {
        throw new Error(`Failed to load comparison.html: ${response.status}`);
      }
      const html = await response.text();
      this.container.innerHTML = html;
      console.log('Comparison HTML content loaded');
    } catch (error) {
      console.error('Error loading comparison HTML:', error);
      // フォールバック処理
      this.loadFallbackContent();
    }
  }

  /**
   * フォールバック用のコンテンツ読み込み
   */
  loadFallbackContent() {
    console.log('Loading fallback content for comparison section');
    this.container.innerHTML = `
      <!-- チャートエリア -->
      <div class="chart-container">
        <canvas id="comparisonChart" width="800" height="400"></canvas>
        <p class="text-center text-gray-500 mt-4">※ チャートライブラリ実装時に表示されます</p>
      </div>
      
      <!-- ファンネルテーブル -->
      <div class="kpi-v2-table-wrapper">
        <table class="kpi-v2-table funnel-table">
          <thead>
            <tr>
              <th>段階</th>
              <th>件数</th>
              <th>転換率</th>
              <th>前月比</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>提案</td>
              <td>127</td>
              <td>100%</td>
              <td>+5%</td>
            </tr>
            <tr>
              <td>推薦</td>
              <td>89</td>
              <td>70%</td>
              <td>+3%</td>
            </tr>
            <tr>
              <td>面談設定</td>
              <td>156</td>
              <td>175%</td>
              <td>+8%</td>
            </tr>
            <tr>
              <td>面談実施</td>
              <td>132</td>
              <td>85%</td>
              <td>-2%</td>
            </tr>
            <tr>
              <td>オファー</td>
              <td>68</td>
              <td>52%</td>
              <td>+4%</td>
            </tr>
            <tr>
              <td>承諾</td>
              <td>41</td>
              <td>60%</td>
              <td>+7%</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * セクションのクリーンアップ
   */
  unmount() {
    console.log('Comparison section unmounted');
    this.cleanupEventListeners();
    this.isInitialized = false;
  }

  /**
   * チャートの初期化
   */
  initializeCharts() {
    this.initializeRadarChart();
    this.initializeDistributionChart();
    this.initializeTrendChart();
  }

  /**
   * レーダーチャートの初期化
   */
  initializeRadarChart() {
    const container = document.getElementById('radarChart');
    if (container) {
      container.innerHTML = '<p>レーダーチャート（実装予定）</p>';
    }
  }

  /**
   * 分布比較チャートの初期化
   */
  initializeDistributionChart() {
    const container = document.getElementById('distributionChart');
    if (container) {
      container.innerHTML = '<p>分布比較チャート（実装予定）</p>';
    }
  }

  /**
   * トレンドチャートの初期化
   */
  initializeTrendChart() {
    const container = document.getElementById('trendChart');
    if (container) {
      container.innerHTML = '<p>時系列トレンドチャート（実装予定）</p>';
    }
  }

  /**
   * ファネルテーブルの初期化
   */
  initializeFunnelTable() {
    const tableBody = document.getElementById('funnelTableBody');
    if (!tableBody) return;
    
    // モックデータでテーブルを初期化
    const mockFunnelData = [
      {
        name: '田中太郎',
        inProgress: 15,
        thisWeekInterviews: 3,
        documentReview: 5,
        firstInterview: 4,
        finalInterview: 2,
        offerWaiting: 1,
        acceptanceWaiting: 0,
        onboardingAdjustment: 2,
        thisMonthDecisions: 1,
        conversionRate: '65%',
        nextAction: '書類フォロー'
      },
      {
        name: '佐藤花子',
        inProgress: 12,
        thisWeekInterviews: 2,
        documentReview: 3,
        firstInterview: 3,
        finalInterview: 2,
        offerWaiting: 1,
        acceptanceWaiting: 1,
        onboardingAdjustment: 1,
        thisMonthDecisions: 2,
        conversionRate: '58%',
        nextAction: '面接調整'
      }
    ];
    
    tableBody.innerHTML = '';
    mockFunnelData.forEach(ca => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="fixed-col">${ca.name}</td>
        <td>${ca.inProgress}</td>
        <td>${ca.thisWeekInterviews}</td>
        <td>${ca.documentReview}</td>
        <td>${ca.firstInterview}</td>
        <td>${ca.finalInterview}</td>
        <td>${ca.offerWaiting}</td>
        <td>${ca.acceptanceWaiting}</td>
        <td>${ca.onboardingAdjustment}</td>
        <td>${ca.thisMonthDecisions}</td>
        <td>${ca.conversionRate}</td>
        <td><button class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">${ca.nextAction}</button></td>
      `;
      tableBody.appendChild(row);
    });
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    // 軸選択ボタン
    document.querySelectorAll('[data-axis]').forEach(button => {
      button.addEventListener('click', (e) => {
        const axis = e.target.dataset.axis;
        this.switchAxis(axis);
      });
    });
    
    // フィルター適用ボタン
    const filterButton = document.querySelector('[data-axis] ~ * button');
    if (filterButton) {
      filterButton.addEventListener('click', () => this.applyFilters());
    }
  }

  /**
   * イベントリスナーのクリーンアップ
   */
  cleanupEventListeners() {
    // 必要に応じてリスナーを削除
  }

  /**
   * 軸の切り替え
   */
  switchAxis(axis) {
    this.currentAxis = axis;
    
    // ボタンのアクティブ状態を更新
    document.querySelectorAll('[data-axis]').forEach(btn => {
      btn.classList.remove('bg-blue-500', 'text-white');
      btn.classList.add('border-slate-300');
    });
    
    document.querySelector(`[data-axis="${axis}"]`).classList.add('bg-blue-500', 'text-white');
    
    // チャートを更新
    this.updateChartsForAxis(axis);
  }

  /**
   * 軸に応じたチャート更新
   */
  updateChartsForAxis(axis) {
    console.log(`Updating charts for axis: ${axis}`);
    
    // 軸に応じてチャートデータを更新
    switch (axis) {
      case 'media':
        this.loadMediaComparisonData();
        break;
      case 'job-type':
        this.loadJobTypeComparisonData();
        break;
      case 'period':
        this.loadPeriodComparisonData();
        break;
      case 'interviewer':
        this.loadInterviewerComparisonData();
        break;
    }
  }

  /**
   * 媒体別データの読み込み
   */
  loadMediaComparisonData() {
    const radarChart = document.getElementById('radarChart');
    if (radarChart) {
      radarChart.innerHTML = '<p>媒体別レーダーチャート（実装予定）</p>';
    }
  }

  /**
   * 職種別データの読み込み
   */
  loadJobTypeComparisonData() {
    const radarChart = document.getElementById('radarChart');
    if (radarChart) {
      radarChart.innerHTML = '<p>職種別レーダーチャート（実装予定）</p>';
    }
  }

  /**
   * 時期別データの読み込み
   */
  loadPeriodComparisonData() {
    const radarChart = document.getElementById('radarChart');
    if (radarChart) {
      radarChart.innerHTML = '<p>時期別レーダーチャート（実装予定）</p>';
    }
  }

  /**
   * 面接官別データの読み込み
   */
  loadInterviewerComparisonData() {
    const radarChart = document.getElementById('radarChart');
    if (radarChart) {
      radarChart.innerHTML = '<p>面接官別レーダーチャート（実装予定）</p>';
    }
  }

  /**
   * フィルターの適用
   */
  applyFilters() {
    console.log('Applying filters for current axis:', this.currentAxis);
    // フィルター適用ロジックの実装
  }
}

// デフォルトエクスポート
export default ComparisonSection;