/**
 * 認証リポジトリ
 * バックエンドAPIを利用したログイン/ログアウト/セッション取得
 */

import { defaultApiClient } from '../client.js';
import { setSession, logout as clearLocalSession } from '../../auth.js';

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
    const response = await api.post('/api/auth/login', { email, password });

    if (!response.success) {
      throw new Error(response.error || 'ログインに失敗しました');
    }

    const user = response.data.user || response.data;

    /** @type {Session} */
    const session = {
      user: {
        email: user.email,
        name: user.name
      },
      role: user.role,
      roles: [user.role],
      // 実際のJWTはHttpOnly Cookieに保存されるため、フロントでは保持しない
      token: 'cookie',
      exp: Date.now() + 12 * 60 * 60 * 1000
    };

    setSession(session);
    return session;
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
      const session = {
        user: {
          email: user.email,
          name: user.name
        },
        role: user.role,
        roles: [user.role],
        token: 'cookie',
        exp: Date.now() + 12 * 60 * 60 * 1000
      };

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

