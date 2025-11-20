/**
 * KPIデータリポジトリ
 * KPI関連のデータアクセスロジックを管理
 */

import { defaultApiClient } from '../client.js';

const toNumber = value => {
  const numValue = Number(value);
  return Number.isFinite(numValue) ? numValue : 0;
};

const readMetricValue = (row, keys, fallback = 0) => {
  if (!row || typeof row !== 'object') {
    return fallback;
  }
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      return toNumber(row[key]);
    }
  }
  return fallback;
};

const ensureDateLabel = row => row?.period ?? row?.month ?? row?.date ?? row?.label ?? row?.timestamp ?? null;

const normalizePersonalRow = (row = {}) => {
  const normalized = { ...row };
  const label = ensureDateLabel(row);
  if (label && !normalized.period) {
    normalized.period = label;
  }
  if (label && !normalized.date) {
    normalized.date = label;
  }
  const newInterviews = readMetricValue(row, ['new_interviews', 'newInterviews']);
  const proposals = readMetricValue(row, ['proposals']);
  const recommendations = readMetricValue(row, ['recommendations']);
  const interviewsScheduled = readMetricValue(row, ['interviews_scheduled', 'interviewsScheduled']);
  const interviewsHeld = readMetricValue(row, ['interviews_held', 'interviewsHeld']);
  const offers = readMetricValue(row, ['offers']);
  const accepts = readMetricValue(row, ['accepts']);
  const proposalRate = readMetricValue(row, ['proposal_rate', 'proposalRate']);
  const recommendationRate = readMetricValue(row, ['recommendation_rate', 'recommendationRate']);
  const interviewScheduleRate = readMetricValue(row, ['interview_schedule_rate', 'interviewScheduleRate']);
  const interviewHeldRate = readMetricValue(row, ['interview_held_rate', 'interviewHeldRate']);
  const offerRate = readMetricValue(row, ['offer_rate', 'offerRate']);
  const acceptRate = readMetricValue(row, ['accept_rate', 'acceptRate']);
  const hireRate = readMetricValue(row, ['hire_rate', 'hireRate']);
  const prevNewInterviews = readMetricValue(row, ['prev_new_interviews', 'prevNewInterviews']);
  const prevProposals = readMetricValue(row, ['prev_proposals', 'prevProposals']);
  const prevRecommendations = readMetricValue(row, ['prev_recommendations', 'prevRecommendations']);
  const prevInterviewsScheduled = readMetricValue(row, ['prev_interviews_scheduled', 'prevInterviewsScheduled']);
  const prevInterviewsHeld = readMetricValue(row, ['prev_interviews_held', 'prevInterviewsHeld']);
  const prevOffers = readMetricValue(row, ['prev_offers', 'prevOffers']);
  normalized.new_interviews = newInterviews;
  normalized.newInterviews = newInterviews;
  normalized.proposals = proposals;
  normalized.recommendations = recommendations;
  normalized.interviews_scheduled = interviewsScheduled;
  normalized.interviewsScheduled = interviewsScheduled;
  normalized.interviews_held = interviewsHeld;
  normalized.interviewsHeld = interviewsHeld;
  normalized.offers = offers;
  normalized.accepts = accepts;
  normalized.proposal_rate = proposalRate;
  normalized.proposalRate = proposalRate;
  normalized.recommendation_rate = recommendationRate;
  normalized.recommendationRate = recommendationRate;
  normalized.interview_schedule_rate = interviewScheduleRate;
  normalized.interviewScheduleRate = interviewScheduleRate;
  normalized.interview_held_rate = interviewHeldRate;
  normalized.interviewHeldRate = interviewHeldRate;
  normalized.offer_rate = offerRate;
  normalized.offerRate = offerRate;
  normalized.accept_rate = acceptRate;
  normalized.acceptRate = acceptRate;
  normalized.hire_rate = hireRate;
  normalized.hireRate = hireRate;
  normalized.prevNewInterviews = prevNewInterviews;
  normalized.prevProposals = prevProposals;
  normalized.prevRecommendations = prevRecommendations;
  normalized.prevInterviewsScheduled = prevInterviewsScheduled;
  normalized.prevInterviewsHeld = prevInterviewsHeld;
  normalized.prevOffers = prevOffers;
  return normalized;
};

const normalizeCompanyRow = (row = {}) => {
  const normalized = { ...row };
  const label = ensureDateLabel(row);
  if (label && !normalized.period) {
    normalized.period = label;
  }
  if (label && !normalized.date) {
    normalized.date = label;
  }
  const newInterviews = readMetricValue(row, ['new_interviews', 'newInterviews']);
  const proposals = readMetricValue(row, ['proposals']);
  const recommendations = readMetricValue(row, ['recommendations']);
  const interviewsScheduled = readMetricValue(row, ['interviews_scheduled', 'interviewsScheduled']);
  const interviewsHeld = readMetricValue(row, ['interviews_held', 'interviewsHeld']);
  const offers = readMetricValue(row, ['offers']);
  const accepts = readMetricValue(row, ['accepts']);
  const proposalRate = readMetricValue(row, ['proposal_rate', 'proposalRate']);
  const recommendationRate = readMetricValue(row, ['recommendation_rate', 'recommendationRate']);
  const interviewScheduleRate = readMetricValue(row, ['interview_schedule_rate', 'interviewScheduleRate']);
  const interviewHeldRate = readMetricValue(row, ['interview_held_rate', 'interviewHeldRate']);
  const offerRate = readMetricValue(row, ['offer_rate', 'offerRate']);
  const acceptRate = readMetricValue(row, ['accept_rate', 'acceptRate']);
  const hireRate = readMetricValue(row, ['hire_rate', 'hireRate']);
  const prevNewInterviews = readMetricValue(row, ['prev_new_interviews', 'prevNewInterviews']);
  const prevProposals = readMetricValue(row, ['prev_proposals', 'prevProposals']);
  const prevRecommendations = readMetricValue(row, ['prev_recommendations', 'prevRecommendations']);
  const prevInterviewsScheduled = readMetricValue(row, ['prev_interviews_scheduled', 'prevInterviewsScheduled']);
  const prevInterviewsHeld = readMetricValue(row, ['prev_interviews_held', 'prevInterviewsHeld']);
  const prevOffers = readMetricValue(row, ['prev_offers', 'prevOffers']);
  normalized.new_interviews = newInterviews;
  normalized.newInterviews = newInterviews;
  normalized.proposals = proposals;
  normalized.recommendations = recommendations;
  normalized.interviews_scheduled = interviewsScheduled;
  normalized.interviewsScheduled = interviewsScheduled;
  normalized.interviews_held = interviewsHeld;
  normalized.interviewsHeld = interviewsHeld;
  normalized.offers = offers;
  normalized.accepts = accepts;
  normalized.proposal_rate = proposalRate;
  normalized.proposalRate = proposalRate;
  normalized.recommendation_rate = recommendationRate;
  normalized.recommendationRate = recommendationRate;
  normalized.interview_schedule_rate = interviewScheduleRate;
  normalized.interviewScheduleRate = interviewScheduleRate;
  normalized.interview_held_rate = interviewHeldRate;
  normalized.interviewHeldRate = interviewHeldRate;
  normalized.offer_rate = offerRate;
  normalized.offerRate = offerRate;
  normalized.accept_rate = acceptRate;
  normalized.acceptRate = acceptRate;
  normalized.hire_rate = hireRate;
  normalized.hireRate = hireRate;
  normalized.prevNewInterviews = prevNewInterviews;
  normalized.prevProposals = prevProposals;
  normalized.prevRecommendations = prevRecommendations;
  normalized.prevInterviewsScheduled = prevInterviewsScheduled;
  normalized.prevInterviewsHeld = prevInterviewsHeld;
  normalized.prevOffers = prevOffers;
  return normalized;
};

/**
 * @typedef {object} PersonalMetricRow
 * @property {string} date
 * @property {number} new_interviews
 * @property {number} proposals
 * @property {number} recommendations
 * @property {number} interviews_scheduled
 * @property {number} interviews_held
 * @property {number} offers
 * @property {number} accepts
 * @property {number} proposal_rate
 * @property {number} recommendation_rate
 * @property {number} interview_schedule_rate
 * @property {number} interview_held_rate
 * @property {number} offer_rate
 * @property {number} accept_rate
 * @property {number} hire_rate
 */

export class KpiRepository {
  constructor(apiClient = defaultApiClient) {
    this.apiClient = apiClient;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5分
  }

  /**
   * 個人KPIデータを取得
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD 
   * @returns {Promise<any>}
   */
  async getPersonalKpi(startDate, endDate) {
    try {
      const response = await this.apiClient.get(`/api/metrics/personal?from=${startDate}&to=${endDate}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch personal metrics');
      }

      /** @type {PersonalMetricRow[]} */
      const rows = response.data.rows || response.data || [];

      return this.transformPersonalMetrics(rows);

    } catch (error) {
      console.error('Error fetching personal KPI:', error);
      return this.getPersonalKpiMock(startDate, endDate);
    }
  }

  /**
   * 会社全体KPIデータを取得
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD 
   * @returns {Promise<any>}
   */
  async getCompanyKpi(startDate, endDate) {
    try {
      const response = await this.apiClient.get(`/api/metrics/company?from=${startDate}&to=${endDate}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch company metrics');
      }

      const rows = response.data.rows || response.data || [];
      return this.transformCompanyMetrics(rows);

    } catch (error) {
      console.error('Error fetching company KPI:', error);
      return this.getCompanyKpiMock(startDate, endDate);
    }
  }

  /**
   * 従業員成績データを取得
   * @param {Object} filters - フィルター条件
   * @param {string} [filters.search] - 検索クエリ
   * @param {string} [filters.sortBy] - ソート項目
   * @param {string} [filters.sortOrder] - ソート順序 (asc/desc)
   * @returns {Promise<any[]>}
   */
  async getEmployeePerformance(filters = {}) {
    try {
      const searchParams = new URLSearchParams(filters);
      const endpoint = `/api/metrics/employees?${searchParams.toString()}`;
      const response = await this.apiClient.get(endpoint);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch employee metrics');
      }

      const rows = response.data.rows || response.data || [];
      return this.transformEmployeeMetrics(rows);

    } catch (error) {
      console.error('Error fetching employee performance:', error);
      return this.getEmployeePerformanceMock(filters);
    }
  }

  /**
   * キャッシュから取得
   * @param {string} key 
   * @returns {any|null}
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * キャッシュに設定
   * @param {string} key 
   * @param {any} data 
   */
  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * キャッシュをクリア
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * 個人KPIモックデータ
   * @param {string} startDate 
   * @param {string} endDate 
   * @returns {KpiData[]}
   */
  getPersonalKpiMock(startDate, endDate) {
    return [
      {
        period: '2024-11',
        applications: 156,
        introductions: 78,
        hires: 12,
        cost: 450000,
        currency: 'JPY'
      },
      {
        period: '2024-10',
        applications: 142,
        introductions: 65,
        hires: 9,
        cost: 380000,
        currency: 'JPY'
      },
      {
        period: '2024-09',
        applications: 198,
        introductions: 89,
        hires: 15,
        cost: 520000,
        currency: 'JPY'
      }
    ];
  }

  /**
   * バックエンドの行データから、既存UIで扱いやすいサマリ形式に変換
   * @param {PersonalMetricRow[]} rows
   */
  transformPersonalMetrics(rows) {
    const normalizedRows = Array.isArray(rows) ? rows.map(normalizePersonalRow) : [];
    if (!normalizedRows.length) {
      return this.createEmptyPersonalMetrics();
    }

    const todayRow = normalizedRows[normalizedRows.length - 1];

    const sum = normalizedRows.reduce(
      (acc, row) => {
        acc.newInterviews += row.newInterviews;
        acc.proposals += row.proposals;
        acc.recommendations += row.recommendations;
        acc.interviewsScheduled += row.interviewsScheduled;
        acc.interviewsHeld += row.interviewsHeld;
        acc.offers += row.offers;
        acc.accepts += row.accepts;
        acc.prevNewInterviews += row.prevNewInterviews || 0;
        acc.prevProposals += row.prevProposals || 0;
        acc.prevRecommendations += row.prevRecommendations || 0;
        acc.prevInterviewsScheduled += row.prevInterviewsScheduled || 0;
        acc.prevInterviewsHeld += row.prevInterviewsHeld || 0;
        acc.prevOffers += row.prevOffers || 0;
        return acc;
      },
      {
        newInterviews: 0,
        proposals: 0,
        recommendations: 0,
        interviewsScheduled: 0,
        interviewsHeld: 0,
        offers: 0,
        accepts: 0,
        prevNewInterviews: 0,
        prevProposals: 0,
        prevRecommendations: 0,
        prevInterviewsScheduled: 0,
        prevInterviewsHeld: 0,
        prevOffers: 0
      }
    );

    const toRate = (num, den) => (den === 0 ? 0 : Math.round((1000 * num) / den) / 10);

    const period = {
      newInterviews: sum.newInterviews,
      proposals: sum.proposals,
      recommendations: sum.recommendations,
      interviewsScheduled: sum.interviewsScheduled,
      interviewsHeld: sum.interviewsHeld,
      offers: sum.offers,
      accepts: sum.accepts,
      hires: sum.accepts,
      prevNewInterviews: sum.prevNewInterviews,
      prevProposals: sum.prevProposals,
      prevRecommendations: sum.prevRecommendations,
      prevInterviewsScheduled: sum.prevInterviewsScheduled,
      prevInterviewsHeld: sum.prevInterviewsHeld,
      prevOffers: sum.prevOffers,
      proposalRate: toRate(sum.proposals, sum.newInterviews),
      recommendationRate: toRate(sum.recommendations, sum.proposals),
      interviewScheduleRate: toRate(sum.interviewsScheduled, sum.recommendations),
      interviewHeldRate: toRate(sum.interviewsHeld, sum.interviewsScheduled),
      offerRate: toRate(sum.offers, sum.interviewsHeld),
      acceptRate: toRate(sum.accepts, sum.offers),
      hireRate: toRate(sum.accepts, sum.newInterviews)
    };

    const today = {
      newInterviews: todayRow.newInterviews,
      proposals: todayRow.proposals,
      recommendations: todayRow.recommendations,
      interviewsScheduled: todayRow.interviewsScheduled,
      interviewsHeld: todayRow.interviewsHeld,
      offers: todayRow.offers,
      accepts: todayRow.accepts,
      hires: todayRow.accepts
    };

    return {
      achievementRate: period.hireRate,
      currentAmount: period.accepts,
      targetAmount: period.accepts * 2,
      today,
      monthly: { ...period },
      period,
      rows: normalizedRows
    };
  }

  createEmptyPersonalMetrics() {
    const zero = {
      newInterviews: 0,
      proposals: 0,
      recommendations: 0,
      interviewsScheduled: 0,
      interviewsHeld: 0,
      offers: 0,
      accepts: 0,
      hires: 0,
      prevNewInterviews: 0,
      prevProposals: 0,
      prevRecommendations: 0,
      prevInterviewsScheduled: 0,
      prevInterviewsHeld: 0,
      prevOffers: 0,
      proposalRate: 0,
      recommendationRate: 0,
      interviewScheduleRate: 0,
      interviewHeldRate: 0,
      offerRate: 0,
      acceptRate: 0,
      hireRate: 0
    };
    return {
      achievementRate: 0,
      currentAmount: 0,
      targetAmount: 0,
      today: {
        newInterviews: 0,
        proposals: 0,
        recommendations: 0,
        interviewsScheduled: 0,
        interviewsHeld: 0,
        offers: 0,
        accepts: 0,
        hires: 0
      },
      monthly: { ...zero },
      period: { ...zero },
      rows: []
    };
  }

  transformCompanyMetrics(rows) {
    const normalizedRows = Array.isArray(rows) ? rows.map(normalizeCompanyRow) : [];
    if (!normalizedRows.length) {
      return this.createEmptyCompanyMetrics();
    }

    const totals = normalizedRows.reduce(
      (acc, row) => {
        acc.newInterviews += row.newInterviews;
        acc.proposals += row.proposals;
        acc.recommendations += row.recommendations;
        acc.interviewsScheduled += row.interviewsScheduled;
        acc.interviewsHeld += row.interviewsHeld;
        acc.offers += row.offers;
        acc.accepts += row.accepts;
        acc.prevNewInterviews += row.prevNewInterviews || 0;
        acc.prevProposals += row.prevProposals || 0;
        acc.prevRecommendations += row.prevRecommendations || 0;
        acc.prevInterviewsScheduled += row.prevInterviewsScheduled || 0;
        acc.prevInterviewsHeld += row.prevInterviewsHeld || 0;
        acc.prevOffers += row.prevOffers || 0;
        return acc;
      },
      {
        newInterviews: 0,
        proposals: 0,
        recommendations: 0,
        interviewsScheduled: 0,
        interviewsHeld: 0,
        offers: 0,
        accepts: 0,
        prevNewInterviews: 0,
        prevProposals: 0,
        prevRecommendations: 0,
        prevInterviewsScheduled: 0,
        prevInterviewsHeld: 0,
        prevOffers: 0
      }
    );

    const toRate = (num, den) => (den === 0 ? 0 : Math.round((1000 * num) / den) / 10);

    return {
      ...totals,
      hires: totals.accepts,
      proposalRate: toRate(totals.proposals, totals.newInterviews),
      recommendationRate: toRate(totals.recommendations, totals.proposals),
      interviewScheduleRate: toRate(totals.interviewsScheduled, totals.recommendations),
      interviewHeldRate: toRate(totals.interviewsHeld, totals.interviewsScheduled),
      offerRate: toRate(totals.offers, totals.interviewsHeld),
      acceptRate: toRate(totals.accepts, totals.offers),
      hireRate: toRate(totals.accepts, totals.newInterviews),
      rows: normalizedRows
    };
  }

  createEmptyCompanyMetrics() {
    return {
      newInterviews: 0,
      proposals: 0,
      recommendations: 0,
      interviewsScheduled: 0,
      interviewsHeld: 0,
      offers: 0,
      accepts: 0,
      hires: 0,
      prevNewInterviews: 0,
      prevProposals: 0,
      prevRecommendations: 0,
      prevInterviewsScheduled: 0,
      prevInterviewsHeld: 0,
      prevOffers: 0,
      proposalRate: 0,
      recommendationRate: 0,
      interviewScheduleRate: 0,
      interviewHeldRate: 0,
      offerRate: 0,
      acceptRate: 0,
      hireRate: 0,
      rows: []
    };
  }

  /**
   * 会社KPIモックデータ
   * @param {string} startDate 
   * @param {string} endDate 
   * @returns {KpiData[]}
   */
  getCompanyKpiMock(startDate, endDate) {
    return this.createEmptyCompanyMetrics();
  }

  transformEmployeeMetrics(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(row => ({
      id: row.user_id,
      name: row.user_name || row.user_email || '未設定',
      email: row.user_email,
      proposals: toNumber(row.proposals),
      recommendations: toNumber(row.recommendations),
      interviewsScheduled: toNumber(row.interviews_scheduled ?? row.interviewsScheduled),
      interviewsHeld: toNumber(row.interviews_held ?? row.interviewsHeld),
      offers: toNumber(row.offers),
      accepts: toNumber(row.accepts),
      proposalRate: toNumber(row.proposal_rate),
      recommendationRate: toNumber(row.recommendation_rate),
      interviewScheduleRate: toNumber(row.interview_schedule_rate),
      interviewHeldRate: toNumber(row.interview_held_rate),
      offerRate: toNumber(row.offer_rate),
      acceptRate: toNumber(row.accept_rate),
      hireRate: toNumber(row.hire_rate),
      trend: this.extractEmployeeTrend(row)
    }));
  }

  extractEmployeeTrend(row) {
    if (Array.isArray(row.trend)) return row.trend;
    if (Array.isArray(row.history)) return row.history;
    if (Array.isArray(row.metricsHistory)) return row.metricsHistory;
    if (Array.isArray(row.metrics_history)) return row.metrics_history;
    return null;
  }

  /**
   * 従業員成績モックデータ
   * @param {Object} filters 
   * @returns {Employee[]}
   */
  getEmployeePerformanceMock(filters = {}) {
    let employees = [
      {
        id: 'EMP001',
        name: '田中太郎',
        department: '営業部',
        applications: 45,
        introductions: 28,
        hires: 5,
        rate: 62.2,
        rank: 'A'
      },
      {
        id: 'EMP002',
        name: '佐藤花子',
        department: '営業部',
        applications: 38,
        introductions: 19,
        hires: 3,
        rate: 50.0,
        rank: 'B'
      },
      {
        id: 'EMP003',
        name: '鈴木一郎',
        department: 'マーケティング部',
        applications: 52,
        introductions: 35,
        hires: 8,
        rate: 67.3,
        rank: 'A'
      },
      {
        id: 'EMP004',
        name: '高橋美咲',
        department: 'マーケティング部',
        applications: 29,
        introductions: 15,
        hires: 2,
        rate: 51.7,
        rank: 'B'
      },
      {
        id: 'EMP005',
        name: '渡辺健太',
        department: '営業部',
        applications: 41,
        introductions: 22,
        hires: 4,
        rate: 53.7,
        rank: 'B'
      }
    ];

    // 検索フィルター適用
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      employees = employees.filter(emp => 
        emp.name.toLowerCase().includes(searchTerm) ||
        emp.department.toLowerCase().includes(searchTerm)
      );
    }

    // ソート適用
    if (filters.sortBy) {
      employees.sort((a, b) => {
        const aVal = a[filters.sortBy];
        const bVal = b[filters.sortBy];
        const order = filters.sortOrder === 'desc' ? -1 : 1;
        
        if (typeof aVal === 'string') {
          return aVal.localeCompare(bVal) * order;
        }
        return (aVal - bVal) * order;
      });
    }

    return employees;
  }
}

// デフォルトのKPIリポジトリインスタンス
export const defaultKpiRepository = new KpiRepository();
