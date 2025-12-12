/**
 * 認証リポジトリ（モック専用）
 * サーバーAPIは呼び出さず、ローカルの mockUsers だけで認証する。
 */

import { setSession, logout as clearLocalSession, getSession } from '../../auth.js';
import { mockUsers } from '../../mock/users.js';

/**
 * @typedef {import('../../types/index.js').Session} Session
 */

export const authRepo = {
  /**
   * ログイン（モックユーザーのみ）
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Session>}
   */
  async login(email, password) {
    const mockUser = mockUsers.find(user => user.email === email && user.password === password);
    if (!mockUser) {
      throw new Error('ログインに失敗しました（モック認証）');
    }
    const session = createSessionFromUser(mockUser);
    setSession(session);
    return session;
  },

  /**
   * 現在のセッションを返す（サーバー照会なし）
   * @returns {Promise<Session|null>}
   */
  async me() {
    return getSession();
  },

  /**
   * ログアウト（ローカルセッションのみ破棄）
   */
  async logout() {
    clearLocalSession();
  }
};

/**
 * モックユーザーからセッションオブジェクトを作成
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
    token: 'mock',
    exp: Date.now() + 12 * 60 * 60 * 1000
  };
}
