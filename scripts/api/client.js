/**
 * APIクライアントベースクラス
 * リポジトリパターンの基盤となるHTTPクライアント
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - 成功フラグ
 * @property {any} data - レスポンスデータ
 * @property {string} [error] - エラーメッセージ
 * @property {number} [status] - HTTPステータスコード
 */

/**
 * @typedef {Object} ApiRequestOptions
 * @property {string} [method] - HTTPメソッド
 * @property {Object} [headers] - リクエストヘッダー
 * @property {any} [body] - リクエストボディ
 * @property {number} [timeout] - タイムアウト（ミリ秒）
 * @property {boolean} [validateResponse] - レスポンス検証フラグ
 */

export class ApiClient {
  constructor(baseUrl = '', options = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // 末尾のスラッシュを削除
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    this.timeout = options.timeout || 10000;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  /**
   * HTTPリクエストを実行
   * @param {string} endpoint 
   * @param {ApiRequestOptions} options 
   * @returns {Promise<ApiResponse>}
   */
  async request(endpoint, options = {}) {
    const url = this.buildUrl(endpoint);
    const config = this.buildRequestConfig(options);

    let lastError = null;
    
    // リトライ機能付きリクエスト実行
    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.executeRequest(url, config);
        return await this.handleResponse(response, options.validateResponse);
      } catch (error) {
        lastError = error;
        
        if (attempt < this.retryAttempts && this.shouldRetry(error)) {
          await this.delay(this.retryDelay * (attempt + 1));
          continue;
        }
        break;
      }
    }

    return this.createErrorResponse(lastError);
  }

  /**
   * GETリクエスト
   * @param {string} endpoint 
   * @param {ApiRequestOptions} options 
   * @returns {Promise<ApiResponse>}
   */
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POSTリクエスト
   * @param {string} endpoint 
   * @param {any} data 
   * @param {ApiRequestOptions} options 
   * @returns {Promise<ApiResponse>}
   */
  async post(endpoint, data, options = {}) {
    return this.request(endpoint, { 
      ...options, 
      method: 'POST',
      body: data 
    });
  }

  /**
   * PUTリクエスト
   * @param {string} endpoint 
   * @param {any} data 
   * @param {ApiRequestOptions} options 
   * @returns {Promise<ApiResponse>}
   */
  async put(endpoint, data, options = {}) {
    return this.request(endpoint, { 
      ...options, 
      method: 'PUT',
      body: data 
    });
  }

  /**
   * DELETEリクエスト
   * @param {string} endpoint 
   * @param {ApiRequestOptions} options 
   * @returns {Promise<ApiResponse>}
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * URLを構築
   * @param {string} endpoint 
   * @returns {string}
   */
  buildUrl(endpoint) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return this.baseUrl ? `${this.baseUrl}/${cleanEndpoint}` : cleanEndpoint;
  }

  /**
   * リクエスト設定を構築
   * @param {ApiRequestOptions} options 
   * @returns {RequestInit}
   */
  buildRequestConfig(options) {
    const config = {
      method: options.method || 'GET',
      headers: { ...this.defaultHeaders, ...options.headers },
    };

    if (options.body && config.method !== 'GET') {
      config.body = typeof options.body === 'string' 
        ? options.body 
        : JSON.stringify(options.body);
    }

    return config;
  }

  /**
   * リクエストを実行（タイムアウト付き）
   * @param {string} url 
   * @param {RequestInit} config 
   * @returns {Promise<Response>}
   */
  async executeRequest(url, config) {
    const timeoutId = setTimeout(() => {
      throw new Error(`Request timeout after ${this.timeout}ms`);
    }, this.timeout);

    try {
      // 実際のAPI環境では fetch(url, config) を使用
      // モック環境ではモックレスポンスを返す
      const response = await this.mockFetch(url, config);
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * モックfetch実装（開発環境用）
   * @param {string} url 
   * @param {RequestInit} config 
   * @returns {Promise<Response>}
   */
  async mockFetch(url, config) {
    // 実際のAPIが利用可能になるまでのモック実装
    await this.delay(100); // ネットワーク遅延をシミュレート
    
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ 
        success: true, 
        data: [], 
        timestamp: new Date().toISOString() 
      })
    };
  }

  /**
   * レスポンスを処理
   * @param {Response} response 
   * @param {boolean} validateResponse 
   * @returns {Promise<ApiResponse>}
   */
  async handleResponse(response, validateResponse = false) {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (validateResponse && !this.isValidResponse(data)) {
      throw new Error('Invalid response format');
    }

    return {
      success: true,
      data: data.data || data,
      status: response.status
    };
  }

  /**
   * エラーレスポンスを作成
   * @param {Error} error 
   * @returns {ApiResponse}
   */
  createErrorResponse(error) {
    return {
      success: false,
      data: null,
      error: error.message,
      status: error.status || 500
    };
  }

  /**
   * リトライすべきエラーかチェック
   * @param {Error} error 
   * @returns {boolean}
   */
  shouldRetry(error) {
    // ネットワークエラーやサーバーエラーの場合はリトライ
    return error.message.includes('timeout') || 
           error.message.includes('network') ||
           (error.status >= 500 && error.status < 600);
  }

  /**
   * レスポンス形式の検証
   * @param {any} data 
   * @returns {boolean}
   */
  isValidResponse(data) {
    return data && typeof data === 'object';
  }

  /**
   * 遅延処理
   * @param {number} ms 
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// デフォルトのAPIクライアントインスタンス
export const defaultApiClient = new ApiClient('', {
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000
});