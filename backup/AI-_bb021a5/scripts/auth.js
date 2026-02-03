/**
 * Authentication module with mock users
 * Provides login/logout functionality and role-based access control
 */

// セッション情報を保存するlocalStorageキー
export const SESSION_STORAGE_KEY = 'dashboard.session.v1';

const KEY = SESSION_STORAGE_KEY;

export function getSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    
    const s = JSON.parse(raw);
    if (s.exp && Date.now() > s.exp) {
      localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

/**
 * セッション情報を保存し、auth:changeイベントを発火する
 * @param {import('./types/index.js').Session} s
 */
export function setSession(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent('auth:change', { detail: s }));
}

export function logout() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event('auth:change'));
}

export function hasRole(role) {
  const s = getSession();
  if (!s) return false;

  const sessionRoles = Array.isArray(s.roles) && s.roles.length
    ? s.roles
    : (s.role ? [s.role] : []);

  if (!sessionRoles.length) return false;

  if (Array.isArray(role)) {
    return role.some(r => sessionRoles.includes(r));
  }

  return sessionRoles.includes(role);
}

export function applyRoleGates(root = document) {
  const s = getSession();
  root.querySelectorAll('[data-role]').forEach(el => {
    const allowed = (el.dataset.role || '').split(/\s+/);
    el.hidden = !s || !allowed.includes(s.role);
  });
}

/**
 * 認証状態の変更を購読するユーティリティ
 * @param {(session: import('./types/index.js').Session|null) => void} handler
 * @returns {() => void} unsubscribe関数
 */
export function onAuthChange(handler) {
  const listener = (event) => {
    // detail が無い場合は現在のセッションを参照
    handler(event.detail ?? getSession());
  };
  window.addEventListener('auth:change', listener);
  return () => window.removeEventListener('auth:change', listener);
}
