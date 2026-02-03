import { fetchKintoneCandidates } from '../api/repositories/candidates.js';
import { loadLocalFields } from './candidatesLocalStore.js';

/**
 * 候補者マスタ配列を取得する。
 * 現時点では、モックデータを「kintone由来」とみなして扱う。
 */
export async function fetchCandidateMaster(params = {}) {
  const rawCandidates = await fetchKintoneCandidates(params);

  return rawCandidates.map(record => {
    const local = loadLocalFields(record.id);
    return { ...record, ...local };
  });
}
