/**
 * 認証リポジトリ
 * バックエンドAPIを利用したログイン/ログアウト/セッション取得
 */

import { defaultApiClient } from '../client.js';
import { setSession, logout as clearLocalSession } from '../../auth.js';
import { mockUsers } from '../../mock/users.js';

/**
 * @typedef {import('../../types/index.js').Session} Session
 */

const api = defaultApiClient;

export const authRepo = {
  /**
   * ログイン処理
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Session>}
   */
  async login(email, password) {
    try {
      const response = await api.post('/api/auth/login', { email, password });

      if (!response.success) {
        const mockSession = tryMockLogin(email, password, response.error, response.status);
        if (mockSession) {
          return mockSession;
        }
        throw new Error(response.error || 'ログインに失敗しました');
      }

      const user = response.data.user || response.data;
      const session = createSessionFromUser(user);
      setSession(session);
      return session;
    } catch (error) {
      const mockSession = tryMockLogin(email, password, error?.message, error?.status);
      if (mockSession) {
        return mockSession;
      }
      throw error;
    }
  },

  /**
   * 現在のユーザー情報をAPIから取得し、ローカルセッションを同期
   * @returns {Promise<Session|null>}
   */
  async me() {
    try {
      const response = await api.get('/api/auth/me');
      if (!response.success) {
        return null;
      }
      const user = response.data;

      /** @type {Session} */
      const session = createSessionFromUser(user);

      setSession(session);
      return session;
    } catch (error) {
      console.warn('Failed to fetch /api/auth/me', error);
      clearLocalSession();
      return null;
    }
  },

  /**
   * ログアウト
   */
  async logout() {
    try {
      await api.post('/api/auth/logout', {});
    } catch (error) {
      console.warn('Logout request failed', error);
    } finally {
      clearLocalSession();
    }
  }
};

/**
 * APIレスポンスからセッションオブジェクトを作成
 * @param {{email: string, name: string, role: string}} user
 * @returns {Session}
 */
function createSessionFromUser(user) {
  return {
    user: {
      email: user.email,
      name: user.name
    },
    role: user.role,
    roles: [user.role],
    token: 'cookie',
    exp: Date.now() + 12 * 60 * 60 * 1000
  };
}

/**
 * APIへ接続できない場合のモックログイン処理
 * @param {string} email
 * @param {string} password
 * @param {string} [reason]
 * @returns {Session|null}
 */
function tryMockLogin(email, password, reason, status) {
  if (!shouldFallbackToMock(reason, status)) {
    return null;
  }
  const mockUser = mockUsers.find(user => user.email === email && user.password === password);
  if (!mockUser) {
    return null;
  }

  console.warn('[auth] Falling back to local mock login because API is unreachable.');
  const session = createSessionFromUser(mockUser);
  setSession(session);
  return session;
}

/**
 * ネットワーク系エラーか判定し、必要時のみモックへ切り替える
 * @param {string} [reason]
 * @returns {boolean}
 */
function shouldFallbackToMock(reason, status) {
  if (typeof status === 'number') {
    if (status >= 500) {
      return true;
    }
    if (status >= 400) {
      return false;
    }
  }

  if (!reason) {
    return false;
  }

  if (/503|ECONN|EAI_AGAIN/i.test(reason)) {
    return true;
  }

  if (reason.startsWith('HTTP')) {
    return false;
  }
  return /network|fetch|timeout|offline|Failed to fetch|TypeError/i.test(reason);
}
