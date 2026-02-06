# 社内ヘルプチャットボット

ルールベース（非LLM）の社内ヘルプチャットボット。

## 特徴

- 🎯 **ルールベース**: LLM推論は使わず、登録済み固定文言のみ返却
- 🖥️ **画面コンテキスト対応**: `screen_id`に応じて初期メニュー切替
- 🔍 **キーワード検索**: 該当なし時のみ検索導線を提供
- 📝 **JSON管理**: コンテンツはJSONで直接管理

## ディレクトリ構造

```
chatbot/
├── docs/                # 設計ドキュメント
├── data/                # コンテンツデータ
├── frontend/            # フロントエンド（実装予定）
├── backend/             # バックエンドAPI（実装予定）
└── scripts/             # ユーティリティ（実装予定）
```

## 設計ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [01_contents_schema.md](docs/01_contents_schema.md) | contents.jsonスキーマ定義 |
| [02_state_machine.md](docs/02_state_machine.md) | 状態遷移設計 |
| [03_api_spec.md](docs/03_api_spec.md) | REST API仕様 |
| [04_frontend_integration.md](docs/04_frontend_integration.md) | フロント組み込み仕様 |
| [05_operation_guide.md](docs/05_operation_guide.md) | 運用ルール |

## クイックスタート（実装後）

```bash
# 開発サーバー起動
cd chatbot/backend
python app.py

# フロントエンド確認
# index.htmlにchatbotのCSS/JSを読み込み済み
```

## コンテンツ更新

`data/contents.json` を直接編集してPRを作成してください。

詳細は [05_operation_guide.md](docs/05_operation_guide.md) を参照。
