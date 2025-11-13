/**
 * TypeScriptライクな型定義とバリデーション
 * JSDocを使用してTypeScriptのような型安全性を提供
 */

/**
 * @typedef {Object} KpiData
 * @property {string} period - YYYY-MM-DD形式
 * @property {number} applications - 応募数
 * @property {number} introductions - 紹介数
 * @property {number} hires - 採用数
 * @property {number} cost - コスト
 * @property {string} currency - 通貨
 */

/**
 * @typedef {Object} Employee
 * @property {string} id - 従業員ID
 * @property {string} name - 名前
 * @property {string} department - 部署
 * @property {number} applications - 応募数
 * @property {number} introductions - 紹介数
 * @property {number} hires - 採用数
 * @property {number} rate - 成功率（%）
 * @property {string} rank - ランク
 */

/**
 * @typedef {Object} Candidate
 * @property {string} id - 候補者ID
 * @property {string} appliedAt - 応募日（YYYY-MM-DD）
 * @property {string} source - 応募元
 * @property {string} name - 名前
 * @property {string} phone - 電話番号
 * @property {string} email - メールアドレス
 * @property {string} jobTitle - 希望職種
 * @property {string} companyName - 現職会社名
 * @property {string} address - 住所
 * @property {number} age - 年齢
 * @property {string} [phase] - 選考フェーズ
 * @property {string} [status] - ステータス
 */

/**
 * @typedef {Object} AdPerformanceData
 * @property {string} media - 媒体名
 * @property {string} job_id - 求人ID
 * @property {string} period_start - 期間開始日
 * @property {string} period_end - 期間終了日
 * @property {number} impressions - 表示回数
 * @property {number} clicks - クリック数
 * @property {number} applications - 応募数
 * @property {number} introductions - 紹介数
 * @property {number} hires - 採用数
 * @property {number} cost - コスト
 * @property {string} currency - 通貨
 */

/**
 * @typedef {Object} TeleapoLog
 * @property {string} id - ログID
 * @property {string} date - 日付（YYYY-MM-DD）
 * @property {string} time - 時刻（HH:mm）
 * @property {string} companyName - 会社名
 * @property {string} contactPerson - 担当者名
 * @property {string} phone - 電話番号
 * @property {string} result - 結果
 * @property {string} notes - 備考
 * @property {string} nextAction - 次のアクション
 */

/**
 * @typedef {Object} ReferralCompany
 * @property {string} company - 企業名
 * @property {string} jobTitle - 募集職種
 * @property {number} planHeadcount - 採用予定人数
 * @property {number} remaining - 残り人数
 * @property {number} proposal - 提案件数
 * @property {number} docScreen - 書類選考通過数
 * @property {number} interview1 - 一次面接通過数
 * @property {number} interview2 - 二次面接通過数
 * @property {number} offer - 内定数
 * @property {number} joined - 入社数
 * @property {string} retention - 定着率
 * @property {number} prejoinDeclines - 入社前辞退数
 * @property {string} [location] - 所在地
 * @property {string} [contact] - 担当者
 * @property {string} [industry] - 業界
 * @property {string} [profile] - 企業概要
 */

/**
 * バリデーション関数群
 */
export const TypeValidators = {
  /**
   * KpiDataの型チェック
   * @param {any} data 
   * @returns {data is KpiData}
   */
  isKpiData(data) {
    return data && 
           typeof data.period === 'string' &&
           typeof data.applications === 'number' &&
           typeof data.introductions === 'number' &&
           typeof data.hires === 'number' &&
           typeof data.cost === 'number' &&
           typeof data.currency === 'string';
  },

  /**
   * Employeeの型チェック
   * @param {any} data 
   * @returns {data is Employee}
   */
  isEmployee(data) {
    return data && 
           typeof data.id === 'string' &&
           typeof data.name === 'string' &&
           typeof data.department === 'string' &&
           typeof data.applications === 'number' &&
           typeof data.introductions === 'number' &&
           typeof data.hires === 'number' &&
           typeof data.rate === 'number' &&
           typeof data.rank === 'string';
  },

  /**
   * Candidateの型チェック
   * @param {any} data 
   * @returns {data is Candidate}
   */
  isCandidate(data) {
    return data && 
           typeof data.id === 'string' &&
           typeof data.appliedAt === 'string' &&
           typeof data.source === 'string' &&
           typeof data.name === 'string' &&
           typeof data.phone === 'string' &&
           typeof data.email === 'string' &&
           typeof data.jobTitle === 'string' &&
           typeof data.companyName === 'string' &&
           typeof data.address === 'string' &&
           typeof data.age === 'number';
  },

  /**
   * AdPerformanceDataの型チェック
   * @param {any} data 
   * @returns {data is AdPerformanceData}
   */
  isAdPerformanceData(data) {
    return data && 
           typeof data.media === 'string' &&
           typeof data.job_id === 'string' &&
           typeof data.period_start === 'string' &&
           typeof data.period_end === 'string' &&
           typeof data.impressions === 'number' &&
           typeof data.clicks === 'number' &&
           typeof data.applications === 'number' &&
           typeof data.introductions === 'number' &&
           typeof data.hires === 'number' &&
           typeof data.cost === 'number' &&
           typeof data.currency === 'string';
  },

  /**
   * TeleapoLogの型チェック
   * @param {any} data 
   * @returns {data is TeleapoLog}
   */
  isTeleapoLog(data) {
    return data && 
           typeof data.id === 'string' &&
           typeof data.date === 'string' &&
           typeof data.time === 'string' &&
           typeof data.companyName === 'string' &&
           typeof data.contactPerson === 'string' &&
           typeof data.phone === 'string' &&
           typeof data.result === 'string' &&
           typeof data.notes === 'string' &&
           typeof data.nextAction === 'string';
  },

  /**
   * ReferralCompanyの型チェック
   * @param {any} data 
   * @returns {data is ReferralCompany}
   */
  isReferralCompany(data) {
    return data && 
           typeof data.company === 'string' &&
           typeof data.jobTitle === 'string' &&
           typeof data.planHeadcount === 'number' &&
           typeof data.remaining === 'number' &&
           typeof data.proposal === 'number' &&
           typeof data.docScreen === 'number' &&
           typeof data.interview1 === 'number' &&
           typeof data.interview2 === 'number' &&
           typeof data.offer === 'number' &&
           typeof data.joined === 'number' &&
           typeof data.retention === 'string' &&
           typeof data.prejoinDeclines === 'number';
  }
};

/**
 * 型安全なキャストヘルパー
 */
export const TypeCasters = {
  /**
   * @param {any[]} data 
   * @returns {KpiData[]}
   */
  toKpiDataArray(data) {
    return Array.isArray(data) ? data.filter(TypeValidators.isKpiData) : [];
  },

  /**
   * @param {any[]} data 
   * @returns {Employee[]}
   */
  toEmployeeArray(data) {
    return Array.isArray(data) ? data.filter(TypeValidators.isEmployee) : [];
  },

  /**
   * @param {any[]} data 
   * @returns {Candidate[]}
   */
  toCandidateArray(data) {
    return Array.isArray(data) ? data.filter(TypeValidators.isCandidate) : [];
  },

  /**
   * @param {any[]} data 
   * @returns {AdPerformanceData[]}
   */
  toAdPerformanceArray(data) {
    return Array.isArray(data) ? data.filter(TypeValidators.isAdPerformanceData) : [];
  },

  /**
   * @param {any[]} data 
   * @returns {TeleapoLog[]}
   */
  toTeleapoLogArray(data) {
    return Array.isArray(data) ? data.filter(TypeValidators.isTeleapoLog) : [];
  },

  /**
   * @param {any[]} data 
   * @returns {ReferralCompany[]}
   */
  toReferralCompanyArray(data) {
    return Array.isArray(data) ? data.filter(TypeValidators.isReferralCompany) : [];
  }
};

/**
 * 型安全なオブジェクト作成ヘルパー
 */
export const TypeBuilders = {
  /**
   * 空のKpiDataを作成
   * @param {Partial<KpiData>} overrides
   * @returns {KpiData}
   */
  createKpiData(overrides = {}) {
    return {
      period: '',
      applications: 0,
      introductions: 0,
      hires: 0,
      cost: 0,
      currency: 'JPY',
      ...overrides
    };
  },

  /**
   * 空のEmployeeを作成
   * @param {Partial<Employee>} overrides
   * @returns {Employee}
   */
  createEmployee(overrides = {}) {
    return {
      id: '',
      name: '',
      department: '',
      applications: 0,
      introductions: 0,
      hires: 0,
      rate: 0,
      rank: 'C',
      ...overrides
    };
  },

  /**
   * 空のCandidateを作成
   * @param {Partial<Candidate>} overrides
   * @returns {Candidate}
   */
  createCandidate(overrides = {}) {
    return {
      id: '',
      appliedAt: '',
      source: '',
      name: '',
      phone: '',
      email: '',
      jobTitle: '',
      companyName: '',
      address: '',
      age: 0,
      phase: undefined,
      status: undefined,
      ...overrides
    };
  },

  /**
   * 空のAdPerformanceDataを作成
   * @param {Partial<AdPerformanceData>} overrides
   * @returns {AdPerformanceData}
   */
  createAdPerformanceData(overrides = {}) {
    return {
      media: '',
      job_id: '',
      period_start: '',
      period_end: '',
      impressions: 0,
      clicks: 0,
      applications: 0,
      introductions: 0,
      hires: 0,
      cost: 0,
      currency: 'JPY',
      ...overrides
    };
  },

  /**
   * 空のTeleapoLogを作成
   * @param {Partial<TeleapoLog>} overrides
   * @returns {TeleapoLog}
   */
  createTeleapoLog(overrides = {}) {
    return {
      id: '',
      date: '',
      time: '',
      companyName: '',
      contactPerson: '',
      phone: '',
      result: '',
      notes: '',
      nextAction: '',
      ...overrides
    };
  },

  /**
   * 空のReferralCompanyを作成
   * @param {Partial<ReferralCompany>} overrides
   * @returns {ReferralCompany}
   */
  createReferralCompany(overrides = {}) {
    return {
      company: '',
      jobTitle: '',
      planHeadcount: 0,
      remaining: 0,
      proposal: 0,
      docScreen: 0,
      interview1: 0,
      interview2: 0,
      offer: 0,
      joined: 0,
      retention: '0%',
      prejoinDeclines: 0,
      location: undefined,
      contact: undefined,
      industry: undefined,
      profile: undefined,
      ...overrides
    };
  }
};

/**
 * 型エラーハンドリング
 */
export class TypeValidationError extends Error {
  constructor(message, expectedType, receivedValue) {
    super(message);
    this.name = 'TypeValidationError';
    this.expectedType = expectedType;
    this.receivedValue = receivedValue;
  }
}

/**
 * 厳密な型チェックヘルパー
 */
export const TypeGuards = {
  /**
   * データが指定された型であることを保証
   * @template T
   * @param {any} data
   * @param {(data: any) => data is T} validator
   * @param {string} typeName
   * @returns {T}
   * @throws {TypeValidationError}
   */
  ensure(data, validator, typeName) {
    if (validator(data)) {
      return data;
    }
    throw new TypeValidationError(
      `Expected ${typeName}, received ${typeof data}`,
      typeName,
      data
    );
  },

  /**
   * 配列が指定された型の要素のみを含むことを保証
   * @template T
   * @param {any[]} data
   * @param {(item: any) => item is T} validator
   * @param {string} typeName
   * @returns {T[]}
   * @throws {TypeValidationError}
   */
  ensureArray(data, validator, typeName) {
    if (!Array.isArray(data)) {
      throw new TypeValidationError(
        `Expected array of ${typeName}, received ${typeof data}`,
        `${typeName}[]`,
        data
      );
    }
    
    const invalidItems = data.filter(item => !validator(item));
    if (invalidItems.length > 0) {
      throw new TypeValidationError(
        `Array contains invalid ${typeName} items`,
        `${typeName}[]`,
        invalidItems
      );
    }
    
    return data;
  }
};