/**
 * リポジトリ統合ファイル
 * 全てのリポジトリのエクスポートとファクトリー関数を提供
 */

import { KpiRepository } from './repositories/kpi.js';
import { defaultApiClient } from './client.js';

/**
 * リポジトリファクトリークラス
 * 依存性注入とリポジトリ管理を担当
 */
export class RepositoryFactory {
  constructor(apiClient = defaultApiClient) {
    this.apiClient = apiClient;
    this._kpiRepository = null;
  }

  /**
   * KPIリポジトリを取得（シングルトン）
   * @returns {KpiRepository}
   */
  getKpiRepository() {
    if (!this._kpiRepository) {
      this._kpiRepository = new KpiRepository(this.apiClient);
    }
    return this._kpiRepository;
  }

  /**
   * 全てのキャッシュをクリア
   */
  clearAllCaches() {
    if (this._kpiRepository) this._kpiRepository.clearCache();
  }

  /**
   * 全てのリポジトリを再初期化
   */
  reset() {
    this.clearAllCaches();
    this._kpiRepository = null;
  }

  /**
   * 互換API: 既存コード向けにリポジトリオブジェクトを生成
   * @param {import('./client.js').defaultApiClient} apiClient
   * @returns {{kpi: KpiRepository}}
   */
  static create(apiClient = defaultApiClient) {
    const factory = new RepositoryFactory(apiClient);
    return {
      kpi: factory.getKpiRepository()
    };
  }
}

// デフォルトのリポジトリファクトリーインスタンス
export const defaultRepositoryFactory = new RepositoryFactory();

// 個別リポジトリのエクスポート（後方互換性）
export { KpiRepository };

// APIクライアントのエクスポート
export { defaultApiClient } from './client.js';

/**
 * 便利関数：全てのデフォルトリポジトリを取得
 * @returns {{kpi: KpiRepository}}
 */
export function getAllRepositories() {
  return {
    kpi: defaultRepositoryFactory.getKpiRepository()
  };
}
