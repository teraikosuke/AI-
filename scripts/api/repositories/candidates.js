import { getMockCandidates } from '../../mock/candidates.js';

/**
 * kintone 由来の候補者データを取得する想定のリポジトリ関数。
 * 現時点ではモックデータを返す。
 */
export async function fetchKintoneCandidates(params = {}) {
  // TODO: 将来ここを kintone REST API 呼び出しに差し替える
  return getMockCandidates();
}
