const localById = new Map();

/**
 * 指定 ID のローカルフィールドを取得する。
 * 現時点では、何も保存していなければ空オブジェクトを返す。
 */
export function loadLocalFields(id) {
  return localById.get(id) ?? {};
}

/**
 * 指定 ID のローカルフィールドを保存する（将来用）。
 */
export function saveLocalFields(id, fields) {
  const current = localById.get(id) ?? {};
  localById.set(id, { ...current, ...fields });
}
