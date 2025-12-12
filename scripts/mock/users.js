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
    id: 'mock-member-a',
    name: '新田悠真',
    email: 'yuma.nitta@example.com',
    password: 'member123',
    role: 'member'
  },
  {
    id: 'mock-member-b',
    name: '高橋葵',
    email: 'aoi.takahashi@example.com',
    password: 'member123',
    role: 'member'
  },
  {
    id: 'mock-member-c',
    name: '鈴木光',
    email: 'hikaru.suzuki@example.com',
    password: 'member123',
    role: 'member'
  },
  {
    id: 'mock-member-d',
    name: '山本未来',
    email: 'mirai.yamamoto@example.com',
    password: 'member123',
    role: 'member'
  }
];
