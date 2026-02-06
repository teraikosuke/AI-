# C) API仕様

## 概要

チャットボットバックエンドのREST API仕様を定義する。

---

## 基本情報

| 項目 | 値 |
|------|-----|
| ベースURL | `/api/v1/chat` |
| Content-Type | `application/json` |
| 認証 | セッションベース（既存の社内認証に準拠） |

---

## バージョニング

```
/api/v1/chat/*   # 現行バージョン
/api/v2/chat/*   # 将来のメジャー変更時
```

### バージョンアップポリシー

- **マイナー変更**（後方互換）: 同一バージョン内で拡張
- **破壊的変更**: 新バージョンエンドポイント作成、旧バージョンは6ヶ月維持

---

## 1. POST /api/v1/chat/start

チャットセッションを開始し、初期メニューを取得。

### Request

```json
{
  "screen_id": "yield_personal"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| screen_id | string | ✓ | 現在表示中の画面ID |

### Response（成功: 200）

```json
{
  "success": true,
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "state": {
    "state_id": "home:yield_personal",
    "history": []
  },
  "message": "こんにちは！ヘルプボットです。何かお困りですか？",
  "options": [
    {
      "id": "opt_1",
      "label": "よくある質問",
      "action": "navigate",
      "target": "category:faq:yield_personal"
    },
    {
      "id": "opt_2",
      "label": "使い方",
      "action": "navigate",
      "target": "category:howto:yield_personal"
    },
    {
      "id": "opt_3",
      "label": "用語",
      "action": "navigate",
      "target": "category:glossary:yield_personal"
    },
    {
      "id": "opt_4",
      "label": "エラー/困りごと",
      "action": "navigate",
      "target": "category:error:yield_personal"
    },
    {
      "id": "opt_5",
      "label": "全体ヘルプ",
      "action": "navigate",
      "target": "category:general:yield_personal"
    },
    {
      "id": "opt_6",
      "label": "歩留まりメニューに戻る",
      "action": "navigate",
      "target": "menu:watarimari"
    }
  ],
  "screen_info": {
    "name": "歩留まり（個人）",
    "group": "yield"
  }
}
```

### Response（エラー: 400）

```json
{
  "success": false,
  "error": {
    "code": "INVALID_SCREEN_ID",
    "message": "指定された画面IDが存在しません",
    "details": {
      "provided": "unknown_screen",
      "available": ["yield_personal", "yield_company", "settings_main"]
    }
  }
}
```

---

## 2. POST /api/v1/chat/step

選択肢を選択し、次の状態に遷移。

### Request

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "action": "navigate",
  "target": "category:faq:yield_personal"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| session_id | string | ✓ | セッションID |
| action | string | ✓ | アクション種別 |
| target | string | ✓ | 遷移先state_id |

### action 種別

| action | 説明 | targetの例 |
|--------|------|-----------|
| navigate | 状態遷移 | `category:faq:yield_personal` |
| show_content | コンテンツ表示 | `content:item_001` |
| back | 戻る | 自動計算（省略可） |
| search | 検索実行 | 検索クエリ文字列 |
| external | 外部リンク | URL（レスポンスで返すのみ） |

### Response（状態遷移成功: 200）

```json
{
  "success": true,
  "state": {
    "state_id": "category:faq:yield_personal",
    "history": ["home:yield_personal"]
  },
  "message": "「よくある質問」の項目を選択してください。",
  "options": [
    {
      "id": "opt_1",
      "label": "データの更新頻度は？",
      "action": "show_content",
      "target": "content:item_010"
    },
    {
      "id": "opt_2", 
      "label": "グラフの見方がわからない",
      "action": "show_content",
      "target": "content:item_011"
    },
    {
      "id": "opt_back",
      "label": "探しているものがない → 検索",
      "action": "navigate",
      "target": "search:active"
    },
    {
      "id": "opt_home",
      "label": "戻る",
      "action": "back",
      "target": "home:yield_personal"
    }
  ]
}
```

### Response（コンテンツ表示: 200）

```json
{
  "success": true,
  "state": {
    "state_id": "content:item_001",
    "history": ["home:yield_personal", "category:faq:yield_personal"]
  },
  "content": {
    "id": "item_001",
    "title": "歩留まりとは？",
    "body": "歩留まりとは、採用プロセスにおける各段階の通過率を示す指標です。\n\n計算式: 次ステップ通過数 ÷ 現ステップ数 × 100",
    "links": [
      { "label": "詳細ドキュメント", "url": "/docs/yield-guide.pdf" }
    ]
  },
  "options": [
    {
      "id": "opt_related",
      "label": "関連: 歩留まり改善のコツ",
      "action": "show_content",
      "target": "content:item_002"
    },
    {
      "id": "opt_back",
      "label": "戻る",
      "action": "back",
      "target": "category:faq:yield_personal"
    },
    {
      "id": "opt_home",
      "label": "最初に戻る",
      "action": "navigate",
      "target": "home:yield_personal"
    }
  ]
}
```

---

## 3. POST /api/v1/chat/search

キーワード検索を実行。

### Request

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "query": "グラフ 表示",
  "screen_id": "yield_personal"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| session_id | string | ✓ | セッションID |
| query | string | ✓ | 検索クエリ（2文字以上） |
| screen_id | string | - | 絞り込み用画面ID |

### Response（結果あり: 200）

```json
{
  "success": true,
  "state": {
    "state_id": "search:results",
    "history": ["home:yield_personal", "category:faq:yield_personal", "search:active"]
  },
  "message": "「グラフ 表示」の検索結果です。",
  "results": [
    {
      "id": "item_002",
      "title": "グラフが表示されない",
      "snippet": "グラフが表示されない場合は、以下をご確認ください...",
      "score": 0.95
    },
    {
      "id": "item_015",
      "title": "グラフの見方",
      "snippet": "各グラフの軸と凡例について説明します...",
      "score": 0.72
    }
  ],
  "options": [
    {
      "id": "opt_1",
      "label": "グラフが表示されない",
      "action": "show_content",
      "target": "content:item_002"
    },
    {
      "id": "opt_2",
      "label": "グラフの見方",
      "action": "show_content",
      "target": "content:item_015"
    },
    {
      "id": "opt_retry",
      "label": "別のキーワードで検索",
      "action": "navigate",
      "target": "search:active"
    },
    {
      "id": "opt_home",
      "label": "ホームに戻る",
      "action": "back",
      "target": "home:yield_personal"
    }
  ]
}
```

### Response（結果なし: 200）

```json
{
  "success": true,
  "state": {
    "state_id": "search:results",
    "history": ["home:yield_personal", "search:active"]
  },
  "message": "「不明なキーワード」に該当する項目が見つかりませんでした。",
  "results": [],
  "options": [
    {
      "id": "opt_retry",
      "label": "別のキーワードで検索",
      "action": "navigate",
      "target": "search:active"
    },
    {
      "id": "opt_contact",
      "label": "管理者に問い合わせる",
      "action": "external",
      "target": "mailto:support@example.com?subject=ヘルプリクエスト"
    },
    {
      "id": "opt_home",
      "label": "ホームに戻る",
      "action": "back",
      "target": "home:yield_personal"
    }
  ]
}
```

---

## 4. GET /api/v1/chat/session/:session_id

セッション情報を取得。

### Response（200）

```json
{
  "success": true,
  "session": {
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "screen_id": "yield_personal",
    "current_state": "category:faq:yield_personal",
    "history": ["home:yield_personal"],
    "created_at": "2026-01-30T18:00:00+09:00",
    "last_activity": "2026-01-30T18:05:32+09:00",
    "expires_at": "2026-01-30T18:35:32+09:00"
  }
}
```

---

## 5. DELETE /api/v1/chat/session/:session_id

セッションを終了。

### Response（200）

```json
{
  "success": true,
  "message": "セッションを終了しました"
}
```

---

## エラーコード一覧

| code | HTTP | 説明 |
|------|------|------|
| INVALID_SCREEN_ID | 400 | 不正な画面ID |
| INVALID_STATE_ID | 400 | 不正な状態ID |
| INVALID_ACTION | 400 | 不正なアクション |
| SESSION_NOT_FOUND | 404 | セッションが存在しない |
| SESSION_EXPIRED | 410 | セッション期限切れ |
| CONTENT_NOT_FOUND | 404 | コンテンツが存在しない |
| SEARCH_QUERY_TOO_SHORT | 400 | 検索クエリが短すぎる |
| INTERNAL_ERROR | 500 | 内部エラー |

### エラーレスポンス共通形式

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "ユーザー向けメッセージ",
    "details": {}
  }
}
```

---

## レートリミット

| エンドポイント | 制限 |
|--------------|------|
| /chat/start | 10回/分/ユーザー |
| /chat/step | 60回/分/ユーザー |
| /chat/search | 20回/分/ユーザー |

### 超過時のレスポンス（429）

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "リクエスト数が上限を超えました。しばらく待ってから再試行してください。",
    "details": {
      "retry_after": 30
    }
  }
}
```

---

## TODO / 仮置き事項

- [ ] 認証方式の詳細（既存認証との統合方法）
- [ ] ログ出力形式の確定
- [ ] レートリミット値の調整
