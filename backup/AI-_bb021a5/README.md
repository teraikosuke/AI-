# 業務ダッシュボード (AI-Dashboard)

企業の採用活動とKPI管理を統合したWebダッシュボードアプリケーション。
シンプルで読みやすいコードアーキテクチャを採用し、外部依存を最小限に抑えた設計となっています。

> **🚀 デモサイト**: [https://ai-ivory-five-21.vercel.app](https://ai-ivory-five-21.vercel.app)

## 🎯 プロジェクト概要

### 主要機能

- **KPI管理**: 個人・会社全体の採用実績追跡
- **候補者管理**: 応募者情報と選考フェーズの管理
- **従業員成績**: チーム別・個人別パフォーマンス分析
- **広告パフォーマンス**: 求人媒体別の運用成果分析

### 技術仕様

- **フロントエンド**: Vanilla JavaScript（ES6+）- 外部依存なし
- **スタイリング**: CSS3（CSS変数・Flexbox/Grid活用）
- **バックエンド（オプション）**: Node.js + Express + PostgreSQL
- **デプロイ**: Vercel (静的サイトとして動作)

## 📁 ファイル構成

```
├── dashboard.html        # メインUIページ
├── dashboard.css         # 統一スタイルシート
├── dashboard.js          # アプリケーションロジック（モックデータ内蔵）
├── components/           # UIコンポーネント
├── server/               # バックエンドAPIサーバー（オプション）
│   ├── src/             # サーバーソースコード
│   └── package.json     # サーバー依存関係
├── scripts/              # ユーティリティスクリプト
├── styles/               # 追加スタイルシート
└── README.md            # このファイル
```

## 🚀 セットアップ（フロントエンド）

本プロジェクトはフロントエンド単体で動作するように設計されています（モックデータ使用）。

### 必要要件

- モダンWebブラウザ（Chrome, Firefox, Safari, Edge）

### 起動方法

VS Codeの "Live Server" 拡張機能、またはPythonの簡易サーバー等で `dashboard.html` を開いてください。

```bash
# Pythonを使用する場合
python3 -m http.server 8000
# ブラウザで http://localhost:8000/dashboard.html にアクセス
```

## 🛠️ バックエンド連携（上級者向け）

PostgreSQLデータベースと連携させる場合の手順です。通常利用では不要です。

1. **依存関係のインストール**

   ```bash
   cd server
   npm install
   ```

2. **環境変数設定**
   `server/.env` を作成し、データベース接続情報を設定してください（`server/.env.example` 参照）。
3. **サーバー起動**

   ```bash
   npm run dev
   ```

## 📦 依存関係 (Dependencies)

### Frontend

- なし (Vanilla JS)

### Backend (`server/`)

- `express`: Web Web Framework
- `pg`: PostgreSQL Client
- `dotenv`: Environment Variable Management
- `cors`: CORS Middleware
- `zod`, `jsonwebtoken`, `argon2`: Auth & Validation (Server側)

## 🎨 UI/UXガイドライン

### デザインシステム

- **カラーパレット**: CSS変数で定義（:root）
- **タイポグラフィ**: システムフォント優先
- **レスポンシブ**: Flexboxベースの柔軟レイアウト

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。
