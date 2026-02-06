# A) contents.json スキーマ定義

## 概要

ルールベースチャットボットのコンテンツデータ構造を定義する。
LLM推論は使用せず、登録済みの固定文言のみを返却する。

---

## スキーマ構造

```
contents.json
├── meta                    # メタ情報
├── screen_registry         # 画面ID定義
├── system_messages         # システムメッセージ
├── menu_states             # メニュー状態定義（親メニュー含む）
├── content_items           # コンテンツアイテム
├── categories              # カテゴリ定義
└── search_config           # 検索設定
```

---

## 1. meta（メタ情報）

```json
{
  "meta": {
    "version": "1.0.0",
    "lastUpdated": "2026-01-30T18:00:00+09:00",
    "updatedBy": "engineer@example.com"
  }
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| version | string | セマンティックバージョニング |
| lastUpdated | string | 最終更新日時（ISO8601） |
| updatedBy | string | 更新者 |

---

## 2. screen_registry（画面ID定義）

### 命名規則

```
{group}_{feature}[_{sub}]
```

| セグメント | 説明 | 例 |
|-----------|------|-----|
| group | 画面グループ | yield, settings, members |
| feature | 機能名 | personal, company, admin |
| sub | サブ機能（省略可） | detail, edit |

### 画面グループ一覧

| group | 親メニュー | 説明 |
|-------|-----------|------|
| yield | menu:watarimari | 歩留まり系画面 |
| settings | menu:settings | 設定系画面 |
| members | なし | メンバー管理 |
| mypage | なし | マイページ |
| その他 | なし | 独立画面 |

### 構造

```json
{
  "screen_registry": {
    "yield_personal": {
      "name": "歩留まり（個人）",
      "routes": ["/pages/yield-personal", "/yield-personal"],
      "group": "yield",
      "parentMenu": "menu:watarimari",
      "topItems": ["yield_personal_summary", "yield_personal_input"]
    },
    "yield_company": {
      "name": "歩留まり（企業）",
      "routes": ["/pages/yield-company", "/yield-company"],
      "group": "yield", 
      "parentMenu": "menu:watarimari",
      "topItems": ["yield_company_summary"]
    },
    "yield_admin": {
      "name": "歩留まり（管理）",
      "routes": ["/pages/yield-admin", "/yield-admin"],
      "group": "yield",
      "parentMenu": "menu:watarimari",
      "topItems": []
    },
    "settings_main": {
      "name": "設定",
      "routes": ["/pages/settings", "/settings"],
      "group": "settings",
      "parentMenu": "menu:settings",
      "topItems": ["settings_notification", "settings_account"]
    },
    "members_list": {
      "name": "メンバー一覧",
      "routes": ["/pages/members", "/members"],
      "group": "members",
      "parentMenu": null,
      "topItems": ["members_invite", "members_role"]
    },
    "mypage_main": {
      "name": "マイページ",
      "routes": ["/pages/mypage", "/mypage"],
      "group": "mypage",
      "parentMenu": null,
      "topItems": []
    }
  }
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| name | string | 画面表示名 |
| routes | string[] | マッチするURLパス |
| group | string | 画面グループ |
| parentMenu | string\|null | 親メニューstate_id |
| topItems | string[] | 画面固有のTopアイテムID |

---

## 3. system_messages（システムメッセージ）

```json
{
  "system_messages": {
    "welcome": "こんにちは！ヘルプボットです。何かお困りですか？",
    "no_match": "該当する回答が見つかりませんでした。キーワード検索を試しますか？",
    "search_prompt": "検索キーワードを入力してください",
    "search_no_result": "キーワードに該当する項目がありませんでした。管理者にお問い合わせください。",
    "back_to_home": "最初のメニューに戻ります",
    "error": "エラーが発生しました。もう一度お試しください。"
  }
}
```

---

## 4. menu_states（メニュー状態定義）

親メニュー（歩留まり/設定）は個別画面を持たないが、
チャット内での迷子防止用にメニュー状態を持つ。

```json
{
  "menu_states": {
    "menu:watarimari": {
      "name": "歩留まりメニュー",
      "message": "歩留まり関連の画面を選択してください。",
      "options": [
        { "label": "歩留まり（個人）", "action": "navigate", "target": "home:yield_personal" },
        { "label": "歩留まり（企業）", "action": "navigate", "target": "home:yield_company" },
        { "label": "歩留まり（管理）", "action": "navigate", "target": "home:yield_admin" }
      ]
    },
    "menu:settings": {
      "name": "設定メニュー",
      "message": "設定関連の画面を選択してください。",
      "options": [
        { "label": "目標設定", "action": "navigate", "target": "home:settings_goal" },
        { "label": "通知設定", "action": "navigate", "target": "home:settings_notification" },
        { "label": "アカウント設定", "action": "navigate", "target": "home:settings_account" }
      ]
    }
  }
}
```

---

## 5. categories（カテゴリ定義）

全画面共通の5カテゴリ。

```json
{
  "categories": {
    "faq": {
      "id": "faq",
      "name": "よくある質問",
      "icon": "help-circle",
      "order": 1
    },
    "howto": {
      "id": "howto",
      "name": "使い方",
      "icon": "book-open",
      "order": 2
    },
    "glossary": {
      "id": "glossary",
      "name": "用語",
      "icon": "file-text",
      "order": 3
    },
    "error": {
      "id": "error",
      "name": "エラー/困りごと",
      "icon": "alert-triangle",
      "order": 4
    },
    "general": {
      "id": "general",
      "name": "全体ヘルプ",
      "icon": "globe",
      "order": 5
    }
  }
}
```

---

## 6. content_items（コンテンツアイテム）

### 構造

```json
{
  "content_items": {
    "item_001": {
      "id": "item_001",
      "title": "歩留まりとは？",
      "body": "歩留まりとは、採用プロセスにおける各段階の通過率を示す指標です。",
      "category": "glossary",
      "screens": ["yield_personal", "yield_company", "yield_admin"],
      "keywords": ["歩留まり", "通過率", "指標"],
      "links": [
        { "label": "詳細ドキュメント", "url": "/docs/yield-guide.pdf" }
      ],
      "priority": 100
    },
    "item_002": {
      "id": "item_002",
      "title": "グラフが表示されない",
      "body": "グラフが表示されない場合は、以下をご確認ください：\n1. データが登録されているか\n2. 期間設定が正しいか\n3. ブラウザのキャッシュをクリア",
      "category": "error",
      "screens": ["yield_personal", "yield_company"],
      "keywords": ["グラフ", "表示されない", "エラー"],
      "links": [],
      "priority": 90
    }
  }
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | string | 一意のID |
| title | string | タイトル（選択肢に表示） |
| body | string | 回答本文（Markdown可） |
| category | string | カテゴリID |
| screens | string[] | 関連画面ID（空=全画面共通） |
| keywords | string[] | 検索用キーワード |
| links | object[] | 関連リンク |
| priority | number | 表示優先度（高いほど上） |

---

## 7. search_config（検索設定）

```json
{
  "search_config": {
    "enabled": true,
    "minQueryLength": 2,
    "maxResults": 5,
    "matchFields": ["title", "keywords", "body"],
    "highlightMatches": true
  }
}
```

---

## 完全スキーマ（TypeScript型定義）

```typescript
interface ContentsMeta {
  version: string;
  lastUpdated: string;
  updatedBy: string;
}

interface ScreenDefinition {
  name: string;
  routes: string[];
  group: string;
  parentMenu: string | null;
  topItems: string[];
}

interface MenuOption {
  label: string;
  action: 'navigate' | 'show_content' | 'back';
  target: string;
}

interface MenuState {
  name: string;
  message: string;
  options: MenuOption[];
}

interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;
}

interface ContentLink {
  label: string;
  url: string;
}

interface ContentItem {
  id: string;
  title: string;
  body: string;
  category: string;
  screens: string[];
  keywords: string[];
  links: ContentLink[];
  priority: number;
}

interface SearchConfig {
  enabled: boolean;
  minQueryLength: number;
  maxResults: number;
  matchFields: string[];
  highlightMatches: boolean;
}

interface ContentsJson {
  meta: ContentsMeta;
  screen_registry: Record<string, ScreenDefinition>;
  system_messages: Record<string, string>;
  menu_states: Record<string, MenuState>;
  categories: Record<string, Category>;
  content_items: Record<string, ContentItem>;
  search_config: SearchConfig;
}
```

---

## 画面別初期メニュー構成ルール

各画面の初期状態（`home:{screen_id}`）では以下を表示：

1. **共通カテゴリ**（5つ）
   - よくある質問
   - 使い方
   - 用語
   - エラー/困りごと
   - 全体ヘルプ

2. **画面固有のTopアイテム**
   - `screen_registry[screen_id].topItems` で定義

3. **親メニューへ戻る**（該当する場合のみ）
   - 歩留まり系 → 「歩留まりメニューに戻る」
   - 設定系 → 「設定メニューに戻る」

---

## TODO / 仮置き事項

- [ ] 実際の画面ルート確定後、routesを更新
- [ ] 画面固有topItemsの具体的内容はヒアリング後に追加
- [ ] アイコン名はLucide Iconsを想定（変更可能）
