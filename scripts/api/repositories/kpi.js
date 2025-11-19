/**
 * KPIデータリポジトリ
 * KPI関連のデータアクセスロジックを管理
 */

import { defaultApiClient } from '../client.js';
import { TypeValidators, TypeCasters } from '../../types/index.js';

/**
 * @typedef {import('../../types/index.js').KpiData} KpiData
 * @typedef {import('../../types/index.js').Employee} Employee
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
   * @returns {Promise<KpiData[]>}
   */
  async getPersonalKpi(startDate, endDate) {
    const cacheKey = `personal_kpi_${startDate}_${endDate}`;
    
    // キャッシュチェック
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.apiClient.get(`/api/kpi/personal`, {
        headers: {
          'X-Date-Range': `${startDate},${endDate}`
        }
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch personal KPI');
      }

      const kpiData = TypeCasters.toKpiDataArray(response.data);
      this.setCache(cacheKey, kpiData);
      return kpiData;

    } catch (error) {
      console.error('Error fetching personal KPI:', error);
      // モックデータにフォールバック
      return this.getPersonalKpiMock(startDate, endDate);
    }
  }

  /**
   * 会社全体KPIデータを取得
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD 
   * @returns {Promise<KpiData[]>}
   */
  async getCompanyKpi(startDate, endDate) {
    const cacheKey = `company_kpi_${startDate}_${endDate}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.apiClient.get(`/api/kpi/company`, {
        headers: {
          'X-Date-Range': `${startDate},${endDate}`
        }
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch company KPI');
      }

      const kpiData = TypeCasters.toKpiDataArray(response.data);
      this.setCache(cacheKey, kpiData);
      return kpiData;

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
   * @returns {Promise<Employee[]>}
   */
  async getEmployeePerformance(filters = {}) {
    const cacheKey = `employee_performance_${JSON.stringify(filters)}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const queryParams = new URLSearchParams(filters).toString();
      const endpoint = `/api/employees/performance${queryParams ? `?${queryParams}` : ''}`;
      
      const response = await this.apiClient.get(endpoint);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch employee performance');
      }

      const employees = TypeCasters.toEmployeeArray(response.data);
      this.setCache(cacheKey, employees);
      return employees;

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
   * 会社KPIモックデータ
   * @param {string} startDate 
   * @param {string} endDate 
   * @returns {KpiData[]}
   */
  getCompanyKpiMock(startDate, endDate) {
    return [
      {
        period: '2024-11',
        applications: 1250,
        introductions: 645,
        hires: 98,
        cost: 3200000,
        currency: 'JPY'
      },
      {
        period: '2024-10',
        applications: 1180,
        introductions: 590,
        hires: 85,
        cost: 2900000,
        currency: 'JPY'
      },
      {
        period: '2024-09',
        applications: 1350,
        introductions: 720,
        hires: 110,
        cost: 3500000,
        currency: 'JPY'
      }
    ];
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
