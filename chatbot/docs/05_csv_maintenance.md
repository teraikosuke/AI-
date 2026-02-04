# CSVで質問/回答を保守する手順

このドキュメントは、CSVを編集してチャットボットの質問と回答を保守する方法をまとめたものです。

## 1. 使うCSVファイル

- `chatbot/contents/csv/content_items.csv`  
  質問・回答（コンテンツ）の本体
- `chatbot/contents/csv/menus.csv`  
  メニュー（カテゴリや選択肢の並び）

補助ファイル:
- `chatbot/contents/csv/screens.csv` 画面IDと表示名の定義
- `chatbot/contents/csv/system_messages.csv` システムメッセージ
- `chatbot/contents/csv/content_links.csv` 回答内のリンク（任意）
- `chatbot/contents/csv/content_related.csv` 関連リンク（任意）

## 2. 質問と回答を編集する（content_items.csv）

`content_items.csv` の主な列:
- `id` : 一意ID（例: `item_001`）。既存のIDは変更しない
- `title` : 質問のタイトル（一覧に表示される文言）
- `body` : 回答本文
- `category` : `faq` / `howto` / `glossary` / `error` / `general` など
- `screens` : 表示対象の画面ID（`|`区切り）
- `keywords` : 検索用キーワード（`|`区切り）
- `priority` : 優先度（0〜100）

### 例
```
id,title,body,category,screens,keywords,priority
item_101,架電数とは？,架電数の説明です。,glossary,teleapo,架電数|用語,80
```

## 3. メニューから質問へつなげる（menus.csv）

`menus.csv` の主な列:
- `menu_id` : メニューID（例: `cat:glossary:teleapo`）
- `message` : メニュー表示時の文言（最初の行だけでOK）
- `option_label` : 選択肢の表示テキスト
- `option_next_state` : 遷移先（`ans:item_101` のようにIDを指定）
- `option_order` : 表示順（1,2,3...）

### 例
```
menu_id,message,option_label,option_next_state,option_order
cat:glossary:teleapo,架電管理の用語です。,架電数とは？,ans:item_101,1
```

## 4. 画面ごとに出し分ける方法

画面ごとにメニューを分けます。

例:
- `cat:glossary:teleapo`
- `cat:glossary:referral`

同じ「用語」でも画面が違えば別メニューになります。

## 5. 反映手順（必ずこれをする）

CSVを編集したら、バックエンドを再起動してください。

```
cd chatbot\backend
python app.py
```

※ `CONTENT_SOURCE=csv` を設定している前提です。

## 6. 文字化けしないための注意

- CSVは **UTF-8(BOM付き)** で保存する
- Excelで開くときは `データ > テキスト/CSVから` を使う

## 7. 変更の基本ルール

- 既存の `id` は変更しない
- `menus.csv` の `option_next_state` は必ず存在する `ans:item_xxx` を指す
- `screens` は `screen_id` と一致させる
- `|` 区切りのスペースは入れない

## 8. よくあるミス

- CSVを開いたまま再生成して `PermissionError`
- `ans:item_xxx` が存在しない → 画面で「該当なし」になる
- `screens` が空のまま → すべての画面に出る

