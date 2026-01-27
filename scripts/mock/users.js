/**
 * フロントエンド単体動作用のモックユーザー
 * APIサーバーに接続できないときのログインフォールバックで使用
 */
export const mockUsers = [
  {
    id: 'mock-admin',
    name: '高橋 智也',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin'
  },
  {
    id: 'mock-member-1',
    name: '佐々木 美咲',
    email: 'member@example.com',
    password: 'member123',
    role: 'member'
  },
  {
    id: 'mock-analyst',
    name: '田中 修平',
    email: 'analyst@example.com',
    password: 'analyst123',
    role: 'member'
  },
  {
    id: 'mock-sales',
    name: '山本 拓海',
    email: 'sales@example.com',
    password: 'sales123',
    role: 'member'
  },
  {
    id: 'mock-designer',
    name: '石川 花蓮',
    email: 'designer@example.com',
    password: 'designer123',
    role: 'member'
  },
  {
    id: 'mock-hr',
    name: '斎藤 萌',
    email: 'hr@example.com',
    password: 'hr123',
    role: 'member'
  }
];
