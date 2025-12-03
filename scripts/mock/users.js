/**
 * フロントエンド単体動作用のモックユーザー
 * APIサーバーに接続できないときのログインフォールバックで使用
 */
export const mockUsers = [
  {
    id: 'mock-admin',
    name: '佐藤アドバイザー',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin'
  },
  {
    id: 'mock-member',
    name: '一般',
    email: 'member@example.com',
    password: 'member123',
    role: 'member'
  }
];
