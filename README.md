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

## 🛠️ ローカル環境構築ステップ（チーム共有用）

> ※ 最新のサーバーコードでは Postgres がなくてもモックデータで動作します。DB を使いたいメンバーは以下の手順に沿って準備してください。

1. **Node.js をインストール**  
   - バージョン 18 以上推奨（リポジトリでは 20.x で検証済み）。公式サイトのインストーラを使用すれば OK です。

2. **依存関係のインストール**
   ```bash
   git clone <repository-url>
   cd AI-
   npm install        # フロント/共通の依存
   cd server
   npm install        # API 用の依存
   ```

3. **Postgres の用意**  
   - **Docker を使わない場合**  
     1. 各自の PC に Postgres をインストールし、`ai_dashboard` などの DB を作成。  
     2. `server/.env` に `DATABASE_URL=postgres://user:pass@localhost:5432/ai_dashboard` を設定。  
   - **Docker を使う場合**  
     1. Docker Desktop をインストール。  
     2. `cd server && docker compose up -d` で Postgres14 が `localhost:54321` に起動。  
     3. `.env` に `DATABASE_URL=postgres://postgres:postgres@localhost:54321/postgres` などを設定。  
     4. `http://localhost:5050` で pgAdmin（ID: `admin@local` / PW: `admin`）が使えます。pgAdmin から接続する際はホストを `postgres`, ポートを `5432` に設定してください（docker-compose のサービス名が内部ホスト名になります）。

4. **初回のみマイグレーション＆シード（DB を使うメンバーだけ）**
   ```bash
   cd server
   npm run migrate
   npm run seed
   ```
   > モックデータのみで動かしたい場合はこのステップは不要です。

5. **API 起動**
   ```bash
   cd server
   npm run dev
   ```
   - `DATABASE_URL` が未設定/DB 停止中でも自動的にモックデータへフェイルオーバーします。  
   - フロントを別ポートで動かしたい場合は `.env` に `APP_ORIGINS=http://localhost:3000` などを追加するか、`ALLOW_ALL_ORIGINS=true` を設定してください。

6. **フロントエンド起動**
   ```bash
   cd AI-
   npm run dev
   ```

### よく使う環境変数
| 変数名 | 役割 | 例 |
| --- | --- | --- |
| `DATABASE_URL` | Postgres の接続文字列 | `postgres://postgres:postgres@localhost:54321/postgres` |
| `APP_ORIGINS` | フロントをホストする許可オリジン（カンマ区切り） | `http://localhost:3000,http://127.0.0.1:4173` |
| `ALLOW_ALL_ORIGINS` | true なら CORS を完全開放（開発用） | `true` |
| `USE_MOCK_AUTH` / `USE_MOCK_METRICS` | モックログイン / モックKPIを強制 | `true` |
| `MOCK_FAILOVER` | DB エラー時に自動でモックへ切り替えるか | `true`（既定） |

### 開発用アカウント一覧
| 権限 | メールアドレス | パスワード | 備考 |
| --- | --- | --- | --- |
| 管理者 | `admin@example.com` | `admin123` | モック / DB 共通 |
| 一般 | `user@example.com` | `user123` | モック / DB 共通 |
| 一般（DBシードのみ） | `analyst@example.com` | `analyst123` | DB を有効にしたときのみ使用可能 |
| 一般（DBシードのみ） | `sales@example.com` | `sales123` | 同上 |
| 一般（DBシードのみ） | `designer@example.com` | `designer123` | 同上 |
| 一般（DBシードのみ） | `hr@example.com` | `hr123` | 同上 |

### DB に保存される主なデータと注意点
- `users` … メール・ハッシュ化パスワード・ロール（`admin` か `member`）。ロールによって社員比較機能などのアクセス可否が決まります。  
- KPI 系テーブル … `new_interviews → proposals → recommendations → interviews_scheduled → interviews_held → offers → accepts` の順で歩留まり率を算出。データ投入時はこのチェーンの整合性を崩さないことが重要です。  
- 社員別 KPI … 管理者向けの社員比較グラフ／テーブルのデータソースです。

> まとめ: Postgres を触りたくないメンバーは手順 1・2・5・6 だけで動作確認できます。後から DB を使う場合は手順 3・4 を追加で実施してください。

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
