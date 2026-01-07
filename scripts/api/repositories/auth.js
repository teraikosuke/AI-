/**
 * 認証リポジトリ
 * Lambdaの /auth/login, /auth/me を呼び出してセッションを管理する。
 */

import { setSession, logout as clearLocalSession, getSession } from '../../auth.js';
import { mockUsers } from '../../mock/users.js';

const DEV_AUTO_LOGIN_KEY = 'dashboard.devAutoLogin';
const DEFAULT_AUTH_API_BASE = 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev/auth';
const AUTH_API_BASE = resolveAuthApiBase();

/**
 * @typedef {import('../../types/index.js').Session} Session
 */

function isDevHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location?.hostname || '';
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '';
}

function isDevAutoLoginEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search || '');
    const flag = params.get('devAutoLogin');
    if (flag === '1' || flag === 'true') return true;
    if (flag === '0' || flag === 'false') return false;
  } catch {
    // ignore URL parsing errors
  }
  try {
    const stored = localStorage.getItem(DEV_AUTO_LOGIN_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return true;
  } catch {
    return true;
  }
}

function resolveAuthApiBase() {
  if (typeof window === 'undefined') return '';
  const fromWindow = window.AUTH_API_BASE || '';
  let fromStorage = '';
  try {
    fromStorage = localStorage.getItem('dashboard.authApiBase') || '';
  } catch {
    fromStorage = '';
  }
  const base = (fromWindow || fromStorage || '').trim();
  const resolved = base ? base : DEFAULT_AUTH_API_BASE;
  return resolved.replace(/\/$/, '');
}

function buildAuthUrl(path) {
  if (!AUTH_API_BASE) return path;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${AUTH_API_BASE}${suffix}`;
}

function decodeBase64Url(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  if (typeof atob === 'function') {
    return atob(padded);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf8');
  }
  return '';
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(decodeBase64Url(parts[1]));
  } catch {
    return null;
  }
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    ...options
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = data?.error || data?.message || `HTTP ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const authRepo = {
  /**
   * ログイン
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Session>}
   */
  async login(email, password) {
    const url = buildAuthUrl('/login');
    const data = await requestJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!data?.token || !data?.user) {
      throw new Error('Invalid login response');
    }
    const session = createSessionFromUser(data.user, data.token);
    setSession(session);
    return session;
  },

  /**
   * 現在のセッションを返す（サーバー照会なし）
   * @returns {Promise<Session|null>}
   */
  async me() {
    const existing = getSession();
    const token = existing?.token;
    if (token) {
      try {
        const url = buildAuthUrl('/me');
        const data = await requestJson(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        });
        const session = createSessionFromUser(data, token);
        setSession(session);
        return session;
      } catch {
        clearLocalSession();
      }
    }

    if (isDevHost() && isDevAutoLoginEnabled()) {
      const mockUser = mockUsers.find(user => user.role === 'admin') || mockUsers[0];
      if (mockUser) {
        const session = createSessionFromUser(mockUser);
        setSession(session);
        return session;
      }
    }

    return null;
  },

  /**
   * ログアウト（ローカルセッションのみ破棄）
   */
  async logout() {
    clearLocalSession();
  },
  /**
   * 開発用ログイン（ローカルのみ）
   * @returns {Promise<Session>}
   */
  async devLogin() {
    if (!isDevHost()) {
      throw new Error('開発用ログインはローカル環境のみ使用できます。');
    }
    const mockUser = mockUsers.find(user => user.role === 'admin') || mockUsers[0];
    if (!mockUser) {
      throw new Error('開発用ユーザーが見つかりません。');
    }
    const session = createSessionFromUser(mockUser);
    setSession(session);
    return session;
  }
};

/**
 * セッションオブジェクトを作成
 * @param {{email: string, name: string, role: string}} user
 * @param {string} [token]
 * @returns {Session}
 */
function createSessionFromUser(user, token = 'mock') {
  const payload = token ? decodeJwtPayload(token) : null;
  const exp = payload?.exp ? payload.exp * 1000 : Date.now() + 12 * 60 * 60 * 1000;
  return {
    user: {
      email: user.email,
      name: user.name
    },
    role: user.role,
    roles: [user.role],
    token,
    exp
  };
}
