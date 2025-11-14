/**
 * Personal Performance Section
 * 個人成績セクションのロジック
 */

import { RepositoryFactory } from '../../../../scripts/api/index.js';

const repositories = RepositoryFactory.create();

export class PersonalSection {
  constructor() {
    this.isInitialized = false;
    this.personalData = null;
    this.container = null;
  }

  /**
   * セクションの初期化とHTMLコンテンツの読み込み
   */
  async mount(container) {
    if (this.isInitialized) return;
    
    console.log('Personal section mounted');
    
    try {
      // コンテナを設定
      this.container = document.getElementById('personal-content-container');
      if (!this.container) {
        throw new Error('Personal content container not found');
      }

      // HTMLコンテンツを読み込み
      await this.loadHTMLContent();
      
      // 日付選択器の初期化
      this.initializeDatePickers();
      
      // 個人KPIデータの読み込み
      await this.loadPersonalKPIData();
      
      // イベントリスナーの設定
      this.setupEventListeners();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Error mounting personal section:', error);
    }
  }

  /**
   * HTMLコンテンツの読み込み
   */
  async loadHTMLContent() {
    try {
      // 絶対パスまたはルートから相対パスを使用
      const response = await fetch('/pages/yield/sections/personal/personal.html');
      if (!response.ok) {
        throw new Error(`Failed to load personal.html: ${response.status}`);
      }
      const html = await response.text();
      this.container.innerHTML = html;
      console.log('Personal HTML content loaded');
    } catch (error) {
      console.error('Error loading personal HTML:', error);
      // フォールバック処理
      this.loadFallbackContent();
    }
  }

  /**
   * フォールバック用のコンテンツ読み込み
   */
  loadFallbackContent() {
    console.log('Loading fallback content for personal section');
    this.container.innerHTML = `
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
          <div class="kpi-v2-card" data-kpi="interviewsHeld">
            <div class="kpi-v2-label">面談実施数</div>
            <div class="kpi-v2-value" id="personalInterviewsHeld">10</div>
            <div class="kpi-v2-meta">面談実施数 30(10)</div>
          </div>
          <div class="kpi-v2-card" data-kpi="offers">
            <div class="kpi-v2-label">内定数</div>
            <div class="kpi-v2-value" id="personalOffers">10</div>
            <div class="kpi-v2-meta">内定数 30(10)</div>
          </div>
          <div class="kpi-v2-card" data-kpi="accepts">
            <div class="kpi-v2-label">承諾数</div>
            <div class="kpi-v2-value" id="personalAccepts">10</div>
            <div class="kpi-v2-meta">承諾数 30(10)</div>
          </div>
          <div class="kpi-v2-card" data-kpi="hires">
            <div class="kpi-v2-label">決定数</div>
            <div class="kpi-v2-value" id="personalHires">10</div>
            <div class="kpi-v2-meta">決定数 30(10)</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * セクションのクリーンアップ
   */
  unmount() {
    console.log('Personal section unmounted');
    this.cleanupEventListeners();
    this.isInitialized = false;
  }

  /**
   * 日付選択器の初期化
   */
  initializeDatePickers() {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const personalRangeStart = document.getElementById('personalRangeStart');
    const personalRangeEnd = document.getElementById('personalRangeEnd');
    
    if (personalRangeStart) personalRangeStart.value = thirtyDaysAgo;
    if (personalRangeEnd) personalRangeEnd.value = today;
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    const startDate = document.getElementById('personalRangeStart');
    const endDate = document.getElementById('personalRangeEnd');
    
    if (startDate) {
      startDate.addEventListener('change', () => this.loadPersonalKPIData());
    }
    
    if (endDate) {
      endDate.addEventListener('change', () => this.loadPersonalKPIData());
    }
  }

  /**
   * イベントリスナーのクリーンアップ
   */
  cleanupEventListeners() {
    const startDate = document.getElementById('personalRangeStart');
    const endDate = document.getElementById('personalRangeEnd');
    
    if (startDate) {
      startDate.removeEventListener('change', () => this.loadPersonalKPIData());
    }
    
    if (endDate) {
      endDate.removeEventListener('change', () => this.loadPersonalKPIData());
    }
  }

  /**
   * 個人KPIデータの読み込み
   */
  async loadPersonalKPIData() {
    try {
      // 日付範囲を取得
      const startDate = document.getElementById('personalRangeStart')?.value || '2024-09-01';
      const endDate = document.getElementById('personalRangeEnd')?.value || '2024-11-30';
      
      // APIからデータを取得
      const data = await repositories.kpi.getPersonalKpi(startDate, endDate);
      
      // データを表示
      this.updatePersonalKPIDisplay(data);
    } catch (error) {
      console.error('Failed to load personal KPI data:', error);
      // フォールバック：モックデータを使用
      this.loadPersonalKPIDataFallback();
    }
  }

  /**
   * フォールバック用モックデータの読み込み
   */
  loadPersonalKPIDataFallback() {
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
    
    this.updatePersonalKPIDisplay(personalKPIData);
  }

  /**
   * 個人KPIデータを表示に反映
   */
  updatePersonalKPIDisplay(data) {
    // 基本KPI更新
    this.updateElement('personalAchievementRate', `${data.achievementRate || 0}%`);
    this.updateElement('personalCurrent', `¥${(data.currentAmount || 0).toLocaleString()}`);
    this.updateElement('personalTarget', `¥${(data.targetAmount || 0).toLocaleString()}`);
    
    // 各種数値の更新
    this.updateElement('personalProposals', data.proposals || 0);
    this.updateElement('personalRecommendations', data.recommendations || 0);
    this.updateElement('personalInterviewsScheduled', data.interviewsScheduled || 0);
    this.updateElement('personalInterviewsHeld', data.interviewsHeld || 0);
    this.updateElement('personalOffers', data.offers || 0);
    this.updateElement('personalAccepts', data.accepts || 0);
    this.updateElement('personalHires', data.hires || 0);
    
    // 率の更新
    this.updateElement('personalProposalRate', `${data.proposalRate || 0}%`);
    this.updateElement('personalRecommendationRate', `${data.recommendationRate || 0}%`);
    this.updateElement('personalInterviewScheduleRate', `${data.interviewScheduleRate || 0}%`);
    this.updateElement('personalInterviewHeldRate', `${data.interviewHeldRate || 0}%`);
    this.updateElement('personalOfferRate', `${data.offerRate || 0}%`);
    this.updateElement('personalAcceptRate', `${data.acceptRate || 0}%`);
    this.updateElement('personalHireRate', `${data.hireRate || 0}%`);
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
export default PersonalSection;