# 業務ダッシュボード

企業の採用活動とKPI管理を統合したWebダッシュボードアプリケーション。シンプルで読みやすいコードアーキテクチャを採用し、外部依存を最小限に抑えた設計となっています。

## 🎯 プロジェクト概要

### 主要機能
- **KPI管理**: 個人・会社全体の採用実績追跡
- **候補者管理**: 応募者情報と選考フェーズの管理
- **従業員成績**: チーム別・個人別パフォーマンス分析
- **広告パフォーマンス**: 求人媒体別の運用成果分析

### 技術仕様
- **フロントエンド**: Vanilla JavaScript（ES6+）
- **スタイリング**: CSS3（CSS変数・Flexbox活用）
- **アーキテクチャ**: リポジトリパターン、型安全設計
- **外部依存**: ゼロ（self-contained）

## 📁 ファイル構成

```
├── dashboard.html        # メインUIページ
├── dashboard.css         # 統一スタイルシート
├── dashboard.js          # アプリケーションロジック
├── /api/                 # データレイヤー
│   ├── client.js        # HTTP クライアント基盤
│   ├── index.js         # リポジトリ統合
│   └── /repositories/   # データリポジトリ群
│       ├── kpi.js
│       ├── candidate.js
│       └── adPerformance.js
├── /types/
│   └── index.js         # TypeScriptライクな型定義
└── README.md            # このファイル
```

## 🚀 セットアップ

### 必要要件
- モダンWebブラウザ（ES6+対応）
- ローカルWebサーバー（開発時）

### クイックスタート
```bash
# リポジトリクローン
git clone <repository-url>
cd AI-

# ローカルサーバーで起動（例：Python）
python3 -m http.server 8000

# ブラウザでアクセス
open http://localhost:8000/dashboard.html
```

### 特別な設定不要
- npm install 不要
- ビルドプロセス不要
- 外部CDN不要

## 🏗️ アーキテクチャ

### 設計原則
1. **ゼロ依存**: 外部ライブラリなしで完結
2. **型安全**: JSDocによるTypeScriptライクな型定義
3. **テスタブル**: 依存性注入対応のクリーンアーキテクチャ
4. **保守性**: 単一責任原則とリポジトリパターン
5. **アクセシビリティ**: WCAG準拠の配慮

### コンポーネント構成

#### フロントエンド層
- **HTML**: セマンティックマークアップ、A11y対応
- **CSS**: CSS変数・名前空間スコープ・ユーティリティクラス
- **JavaScript**: モジュール分割・初期化フラグ・イベント管理

#### データ層
- **ApiClient**: HTTP通信・リトライ・タイムアウト管理
- **Repository**: データアクセス抽象化・キャッシュ機能
- **Types**: 型定義・バリデーション・キャスト

## 📊 機能詳細

### KPI管理
- 個人・会社別実績表示
- 期間フィルタリング
- リアルタイム更新（モック対応）

### 候補者管理
- CRUD操作完全対応
- 選考フェーズ管理
- 検索・ソート・フィルタリング
- 応募元別統計

### パフォーマンス分析
- 従業員成績ランキング
- ROI分析・トレンド表示
- 媒体別コスト効率

## 🔧 開発ガイド

### DEBUG モードの有効化
```javascript
// dashboard.js の先頭で設定変更
const DEBUG = true; // デバッグログを有効化
```

### 新機能追加の流れ
1. `/types/index.js` で型定義追加
2. `/api/repositories/` で新リポジトリ作成
3. `dashboard.js` でUI・イベントハンドラー実装
4. `dashboard.css` でスタイリング

### APIモック開発
現在は開発用モックデータを使用。実際のAPI接続時は：
```javascript
// api/client.js の mockFetch メソッドを実装置換
async mockFetch(url, config) {
  return fetch(url, config); // 実際のfetch呼び出し
}
```

## 🎨 UI/UXガイドライン

### デザインシステム
- **カラーパレット**: CSS変数で定義（:root）
- **タイポグラフィ**: システムフォント優先
- **間隔**: 0.25rem 単位の一貫したスペーシング
- **レスポンシブ**: Flexboxベースの柔軟レイアウト

### アクセシビリティ
- すべてのボタンに `type="button"` 属性
- テーブルヘッダーに適切な `scope` 属性
- ナビゲーション要素の適切なラベリング
- キーボードナビゲーション対応

## 🧪 品質保証

### コード品質
- ESLint推奨（将来対応）
- JSDoc による型注釈
- 統一的な命名規則
- 単一責任原則の徹底

### パフォーマンス
- キャッシュ機能（3-10分TTL）
- 遅延初期化・重複初期化防止
- 効率的なDOM操作・イベント委譲

### ブラウザサポート
- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## 📈 拡張性

### 今後の拡張可能性
- TypeScript完全移行
- WebComponent化
- PWA対応
- テストスイート追加
- CI/CD パイプライン構築

### プラグインアーキテクチャ
```javascript
// 新機能の追加例
import { getAllRepositories } from './api/index.js';

const repositories = getAllRepositories();
// リポジトリを使用した機能実装
```

## 🔒 セキュリティ

### セキュリティ配慮事項
- XSS対策: DOMContentLoaded後の安全な操作
- CSRF対策: API実装時にトークン導入予定
- 入力検証: TypeValidatorsによるデータ検証

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 👥 コントリビューション

### 貢献方法
1. Issueで議論
2. フォークしてfeatureブランチ作成
3. コード実装・テスト
4. プルリクエスト作成

### コーディング規約
- 関数・変数名: camelCase
- 定数: UPPER_SNAKE_CASE
- ファイル名: kebab-case
- コメント: JSDocスタイル推奨

---

**最終更新日**: 2025年11月13日  
**バージョン**: v1.0.0  
**メンテナー**: Development Team