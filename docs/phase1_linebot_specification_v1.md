# LINEボット開発プロジェクト 仕様書 v1

## 1. はじめに

### 1.1. 本書の目的
本書は、「CELM様 AIペルソナプロジェクト」におけるフェーズ1（LINEボット）の開発仕様を定義するものである。要件定義書 `phase1_linebot_requirements_v1.md` の内容を基に、開発に必要な技術的仕様、機能詳細、非機能要件などを明確化することを目的とする。

### 1.2. プロジェクト概要
- **目的**: 研修参加者の予習・復習を支援するLINEボットを提供し、学習効果の向上を図る。また、フェーズ2の高度化に向けた利用データ（質問/回答ログ等）を収集する。
- **対象**: 九州電力の研修受講者 約25名（トライアル）

### 1.3. 対象読者
- プロジェクトマネージャー
- 開発エンジニア
- 品質保証担当者

### 1.4. 関連ドキュメント
- `phase1_linebot_requirements_v1.md`
- `phase1_linebot_brief_estimate_v1.md`
- `株式会社セルム御中_お見積り・スケジュール資料.pdf`

---

## 2. システム概要

### 2.1. システム目的
LINEプラットフォーム上で動作するQ&Aボットを開発し、ユーザーが研修内容に関する質問をテキストで投げかけると、関連ナレッジから適切な回答を自動生成して返す。

### 2.2. システムスコープ

#### 2.2.1. スコープ内
- LINEボットによるテキストベースのQ&A機能（RAG方式）
- 運用マニュアル（受講者向け、事務局向け簡易版）の作成
- 使い方を解説する動画（1本）の作成

#### 2.2.2. スコープ外（フェーズ2以降で検討）
- 音声入力、画像/資料のアップロード機能
- 専用ダッシュボード（リアルタイム可視化、通知、CSV出力機能）
- Webアプリケーションとしての詳細なUI/管理機能
- ユーザーごとの回答最適化など、個別高度チューニング

### 2.3. システム構成図（想定）
```mermaid
graph TD
    subgraph "ユーザー層"
        User["ユーザー (LINE)"]
    end

    subgraph "アプリケーション層 (GCP) - 非同期処理アーキテクチャ"
        direction LR
        WebhookHandler["Webhook受付<br/>(Cloud Run)<br/>Python/FastAPI"]
        TaskQueue["Task Queue<br/>(Cloud Tasks)"]
        Worker["非同期ワーカー<br/>(Cloud Run)<br/>Python/FastAPI"]
    end
    
    subgraph "外部API"
        MessagingAPI["LINE Messaging API"]
    end

    subgraph "データ層 (GCP)"
        KnowledgeSource["ナレッジ元データ<br/>(Object Storage)"]
        VertexAIRAGEngine["Vector DB<br/>(VertexAIRAGEngine)"]
        RDB["リレーショナルDB<br/>(PostgreSQL)"]
    end

    User -- "1. メッセージ送信" --> MessagingAPI
    MessagingAPI -- "2. Webhook通知" --> WebhookHandler
    WebhookHandler -- "3. 即時応答 (200 OK)" --> MessagingAPI
    WebhookHandler -- "4. 処理タスクを投入" --> TaskQueue
    TaskQueue -- "5. ワーカーをトリガー" --> Worker
    Worker -- "6. RAG/LLM処理" --> VertexAIRAGEngine
    Worker -- "7. ログ記録" --> RDB
    Worker -- "8. Push Messageで回答" --> MessagingAPI
    MessagingAPI -- "9. ユーザーに応答" --> User

    KnowledgeSource -- "前処理・インデックス化" --> VertexAIRAGEngine
```
- **クラウド**: GCP (Google Cloud Platform) を利用
- **主要コンポーネント**:
    - **LINE Messaging API**: ユーザーとのインターフェース
    - **Webhook受付 (Cloud Run, Python/FastAPI)**: LINEからのWebhookを受信し、メッセージ内容を判定するコンポーネント。メッセージが「リセット」などの即時処理可能なコマンドの場合は、その場で処理を実行し`Reply Message`で応答する。時間のかかるQA処理の場合は、`200 OK`を返却してタイムアウトを回避し、処理本体をTask Queueに投入する。
    - **Task Queue (Cloud Tasks)**: Webhook受付から受け取った処理リクエストをキューイングし、非同期ワーカーに渡すことで、リクエストのスパイクに対応するバッファの役割を担う。
    - **非同期ワーカー (Cloud Run, Python/FastAPI)**: Task Queueからタスクを受け取り、RAG検索、LLMによる回答生成などの時間のかかる処理を実行。完了後、`Push Message` APIでユーザーに応答を返す。
    - **Vector DB (VertexAIRAGEngine)**: 非構造化データ（PDF等）と構造化データに対応したフルマネージドの検索サービス。ベクトル検索とキーワード検索を組み合わせたハイブリッド検索が可能。
    - **リレーショナルDB**: ログなどの構造化データを格納 (e.g., PostgreSQL)
    - **Object Storage**: 学習用ドキュメント（PDF等）を格納
    - **Secret Manager**: APIキー等の機密情報を管理

### 2.3.1. 技術選定理由
本プロジェクトでは、仕様の要求を満たしつつ、将来の拡張性や運用効率を考慮し、以下の技術スタックを選定しました。

- **Webhook受付 / 非同期ワーカー: `Cloud Run`**
  - **理由**: コンテナベースであるため、Pythonのバージョンやライブラリ依存関係を柔軟に管理できます。また、1インスタンスで複数リクエストを並列処理できる`concurrency`（同時接続）設定により、リクエストのスパイク（集中）発生時にもコスト効率良く対応可能です。LLM呼び出しなど、タイムアウトが長くなる可能性のある非同期ワーカーの処理にも適しています。

- **Task Queue: `Cloud Tasks`**
  - **理由**: 「1つのリクエストを1つのワーカーで処理する」という本プロジェクトの要件に最も合致しています。指定したHTTPエンドポイント（ワーカー）に対し、実行レート制御、詳細なリトライ設定、スケジュール実行など、きめ細やかなタスク配信制御が可能です。これにより、ワーカーや外部LLM APIへの過負荷を防ぎ、システム全体の安定性を高めます。
  - **補足**: 複数システムが同一イベントを購読するような「Fan-out」パターンが必要な場合は`Pub/Sub`が適しますが、今回はPoint-to-Pointの通信であるため`Cloud Tasks`が最適です。

### 2.4. シーケンス図
以下に、ユーザーからのメッセージ受信から応答を返すまでの一連の処理フローを示します。
```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Line as LINE Platform
    participant Handler as Webhook受付
    participant Queue as Task Queue
    participant Worker as 非同期ワーカー
    participant LLM
    participant VertexAIRAGEngine as VertexAIRAGEngine
    participant RDB as PostgreSQL

    User->>Line: 1. メッセージ送信
    Line->>Handler: 2. Webhook通知 (メッセージ内容 + replyToken)

    alt メッセージが「リセット」の場合
        Handler->>RDB: 3a. 会話コンテキストをリセット
        RDB-->>Handler: リセット完了
        Handler->>Line: 4a. Reply Messageでリセット完了を通知
        Line->>User: 5a. ユーザーに完了メッセージ表示
    else 通常の質問の場合
        Handler-->>Line: 3b. 200 OK (即時応答)
        Handler->>Queue: 4b. 処理タスク投入

        Queue->>Worker: 5b. タスクをワーカーに渡す
        activate Worker

        Worker->>RDB: 6. 会話履歴を取得
        RDB-->>Worker: 履歴データ

        Worker->>LLM: 7. 質問文の再構成を依頼<br/>(最新の質問 + 会話履歴)
        LLM-->>Worker: 8. 再構成された質問文

        Worker->>VertexAIRAGEngine: 9. 再構成された質問文で検索
        VertexAIRAGEngine-->>Worker: 10. 関連ナレッジ

        Worker->>LLM: 11. 最終回答の生成を依頼<br/>(関連ナレッジ + 会話全体)
        LLM-->>Worker: 12. 生成された回答

        Worker->>RDB: 13. QAログを保存
        RDB-->>Worker: 保存完了

        Worker->>Line: 14. Push Messageで回答を送信
        Line->>User: 15. ユーザーに応答

        deactivate Worker
    end
```

---

## 3. 機能仕様

### 3.1. チャットQA機能

#### 3.1.1. 機能概要
ユーザーからのテキスト質問に対し、RAG（Retrieval-Augmented Generation）を用いてナレッジベースから適切な回答を生成し、テキストで応答する。

#### 3.1.2. 入出力仕様
- **入力**:
    - 形式: LINE テキストメッセージ
    - 言語: 日本語
- **出力**:
    - 形式: LINE テキストメッセージ
    - 言語: 日本語

#### 3.1.3. 処理仕様
アプリケーションは、ユーザーからのメッセージを受信した際、以下の順序で処理を行う。

1.  **特殊コマンド判定**:
    - ユーザーからのメッセージが、定義済みの特殊コマンド（例: 「リセット」）と完全一致するかを最初に判定する。
    - 一致した場合、後続のQA処理は行わず、各コマンドに対応した処理（[3.1.4.](#314-特殊コマンド仕様)参照）を実行する。

2.  **VertexAIRAGEngineによる回答生成**:
    - ユーザーの最新の質問と対話履歴を `VertexAIRAGEngine` に送信します。
    - `VertexAIRAGEngine` は、以下の統合されたRAGプロセスをエンドツーエンドで実行します。
        - **Retrieval（検索）**: Googleの高性能なベクトル検索とテキスト検索を組み合わせ、ナレッジベースから関連性の高い情報を抽出します。
        - **Augmentation（文脈付与）**: 検索で得られた情報（チャンク）を、LLM（Gemini系）への指示（プロンプト）に効果的に組み込みます。
        - **Generation（生成）**: `Vertex AI` の `Gemini` モデルが、文脈を考慮した最終的な回答を生成します。
        - **Evaluation（評価）**: 生成された回答が、参照した情報源に忠実であるか（Faithfulness）、質問内容と妥当であるか（Relevance）を自動でスコアリングします。これにより、回答の品質と信頼性を担保します。

3.  **範囲外質問への対応**:
    - **判定**: `VertexAIRAGEngine` の評価スコアが低い場合や、ナレッジベースに関連情報が見つからなかった場合、質問がナレッジベースの範囲外であると判定します。（例: 「あなたの誕生日はいつですか？」）
    - **応答**:
        - 応答不能である旨を、丁寧かつユーモアを交えて伝える。
        - 口調は丁寧語を基本とし、攻撃的、揶揄的、政治的、宗教的、その他不適切な表現は使用しない。
        - **返信例**:
            - 「そのご質問は私の専門外です。代わりに◯◯の章についてならお手伝いできます！」
            - 「誕生日はひみつです……代わりに次回講義日ならお答えできます。」
    - **ログ記録**: 範囲外と判定した場合、ログに `reason=oos` のフラグを付与して記録する。
4.  **ガードレール**:
    - 個人情報の開示を要求する質問や、企業の機密情報に関する質問には応答しない。
    - 必要に応じて、関連するトピックや次のアクションを提案し、ユーザーを適切に誘導する。

#### 3.1.4. 特殊コマンド仕様
- **履歴リセット機能**
  - **目的**: 会話の文脈が複雑になり、意図通りの回答が得られにくくなった場合に、ユーザーが会話の状態を初期化できるようにする。
  - **トリガー**: ユーザーが「リセット」という文字列を、他の文言を含まずに完全一致で送信する。
  - **処理**:
    - サーバーサイドで、該当ユーザーの**会話コンテキスト（LLMが参照する直近の対話履歴）のみをリセット**します。
    - これにより、過去の会話の流れに影響されずに、全く新しいトピックとして質問を開始できます。**なお、分析を目的としてデータベースに保存されている過去のQAログは削除されません。**
    - 処理完了後、「会話のコンテキストをリセットしました。新しい質問をどうぞ。」などの確認メッセージをユーザーに返信する。
  - **ログ**: 履歴リセットが実行されたことを示すログを記録する（例: `action=reset_context`）。

### 3.2. ナレッジ更新機能
- **更新頻度**: 月1回
- **更新フロー**:
    1.  クライアント（セルム様）から追加/修正データを受領する。
    2.  受領したドキュメント（PDF等）を、指定されたGCS (Google Cloud Storage) バケットにアップロードする。
    3.  VertexAIRAGEngine のデータストアがGCSバケットを自動的に同期し、新しいドキュメントを取り込んでインデックスを更新する。
    4.  更新内容を検証し、本番環境に反映する。

### 3.3. ログ機能
- **取得項目**:
    - 質問テキスト
    - 回答テキスト
    - タイムスタンプ
    - ユーザー識別子（ハッシュ化または代替ID）
    - 範囲外判定理由（該当する場合）
- **閲覧方法**:
    - 当面は、LINE Official Account Manager の管理画面にて基本的なログを閲覧する。専用ダッシュボードは開発スコープ外とする。

### 3.4. ドキュメント
- **運用マニュアル**:
    - 受講者向けと事務局向けの2種類を作成する。
    - 内容: 初期セットアップ、利用手順、FAQ、問い合わせ先を記載する。
- **使い方動画**:
    - 1〜3分程度の画面操作デモ動画を作成する。

---

## 4. 非機能仕様

### 4.1. 可用性
- トライアル期間中、平日9:00〜20:00の稼働を主対象とする。
- 24時間365日の連続稼働はベストエフォート対応とする。

### 4.2. 性能
- **応答時間**: 目標として、ユーザーからの質問に対し30秒以内に応答を返す。
- **同時利用者数**: 最大25名の同時利用を想定して設計する。

### 4.3. スケーラビリティ・拡張性
- 他の講師への展開も考慮し、汎用性の高い設計とする。
- IaC (Infrastructure as Code) や設定のコード化を可能な範囲で実施し、保守性を高める。

### 4.4. セキュリティ
- **認証情報管理**: LINEチャネルのシークレット情報やAPIキーは、GCP Secret Managerを用いて安全に管理する。
- **個人情報保護**:
    - ユーザーを特定できる個人情報の収集は最小限に留める。
    - ユーザー識別子はハッシュ化等の措置を講じる（現時点では不要）。
    - ログへのアクセス制御・権限管理を適切に行う（現時点では不要）。
- **データ利用**: 外部モデルの学習にユーザーデータが利用されないよう、オプトアウト設定済みのAPIを利用する。

### 4.5. 監査・記録
- ナレッジの更新やシステム設定の変更履歴は、追跡可能な形で記録する。

### 4.6. ネットワーク構成 (VPC)
本プロジェクトでは、PoC段階からセキュリティを確保するため、VPC (Virtual Private Cloud) を用いてGCPリソースを論理的に分離したプライベートネットワーク空間に配置します。

#### 4.6.1. 設定方針
- **目的**: データベース等の重要なリソースをインターネットから隔離し、不正アクセスを防止する。
- **基本構成**:
    1.  **VPCネットワーク**: プロジェクト専用のVPC (`celm-linebot-vpc`) を作成し、外部ネットワークから分離します。
    2.  **サブネット**: リージョン (`asia-northeast1` 等) ごとにサブネットを作成し、IPアドレス範囲を管理します。
    3.  **データベースのプライベートIP化**: Cloud SQL (PostgreSQL) インスタンスは、**プライベートIPのみ**を持つように構成し、パブリックIPアドレスを割り当てません。これにより、インターネット経由での直接的なDB接続を不可能にします。
    4.  **VPCアクセスコネクタ**: Cloud Runのようなサーバーレス環境から、VPC内のリソース（Cloud SQL）へプライベートIPで接続するための「橋渡し」となるコネクタを設置します。
    5.  **ファイアウォールルール**:
        - **原則**: 最小権限の原則に基づき、不要な通信はすべて拒否します。
        - **許可ルール**: Cloud RunからVPCアクセスコネクタ経由でCloud SQLのポートへの通信など、アプリケーションの動作に**必要最低限の通信のみ**を明示的に許可します。
        - **外部への通信**: Cloud RunからLINE APIや外部LLM APIへのアウトバウンド（外向き）通信は許可します。

---

## 5. データ仕様

### 5.1. 入力データ（ナレッジソース）
- 書籍（PDF）
- 講義資料（PDF, etc.）
- 補足Q&A集

### 5.2. データストア構成 (VertexAIRAGEngine)
本プロジェクトでは、VertexAIRAGEngine を用いてナレッジの管理と検索を行います。手動での複雑なデータ前処理は不要となり、運用が大幅に簡素化されます。

- **データソース**:
  - ナレッジソースとなるドキュメント（PDF等）は、GCS (Google Cloud Storage) の指定されたバケットに格納します。
- **データストア**:
  - VertexAIRAGEngine 上に、GCSバケットをデータソースとするデータストアを作成します。
- **インデックス作成**:
  - データストアは、GCSバケット内のドキュメントを自動的に検出し、テキスト抽出、チャンク分割、エンベディング、インデックス作成までの一連の処理をフルマネージドで実行します。
- **データ格納**:
  - 全てのベクトルデータ、メタデータ、およびインデックスは VertexAIRAGEngine 内で一元管理されます。開発者が直接ベクトルDB等を操作する必要はありません。

### 5.3. 注意事項
- 著作権を侵害するデータや、機密情報を無断でナレッジに取り込むことを固く禁止する。
- ナレッジの対象は、クライアントから提供された素材に限定する。

---

## 6. 外部インターフェース

### 6.1. ユーザーインターフェース
- **プラットフォーム**: LINE公式アカウント
- **インタラクション**: テキストメッセージによるトーク

### 6.2. 管理インターフェース
- **プラットフォーム**: LINE Official Account Manager
- **機能**: 簡易的なログ閲覧

---

## 7. テスト・受入基準

### 7.1. 受入テスト（UAT）目標
- **チャットQA**:
    - 事前に用意したテスト用代表質問50件に対し、80%以上の意図一致率を達成する（ナレッジ範囲内の質問に限る）。
    - テストケース（質問、期待される回答の根拠箇所/概要）は10/15までに準備する。
- **範囲外質問対応**:
    - 範囲外と判定された質問に対し、定型メッセージの出し分けが正しく機能することを確認する。
- **ナレッジ更新**:
    - 月次更新手順に従い、ナレッジの追加・修正が正しく反映され、検索結果に現れることを確認する。
- **ドキュメント**:
    - マニュアルおよび使い方動画を見て、初めて利用するユーザーが独力で操作可能であることを確認する。

---

## 8. 運用・保守

### 8.1. 月次運用タスク
- ナレッジの追加・更新
- 応答品質の調整
- 簡易レポートの提出
- 軽微な機能改善
- 基本的なインフラ運用・監視

### 8.2. 問い合わせ対応フロー
- **一次窓口**: セルム様
- **二次窓口（技術）**: Sakura Rin（セルム様経由での問い合わせに対応）

### 8.3. データ保持期間
- ユーザーとの対話ログの保持期間は、トライアル終了月の2026年2月末までとする。

---

## 9. 潜在的なリスクと対策

### 9.1. ユーザーの連続投稿（応答待ち中のメッセージ送信）

- **シナリオ**:
  - ユーザーがボットからの応答（30秒程度かかる場合がある）を待たずに、連続してメッセージを送信するケース。

- **潜在的な問題**:
  - **処理の競合**: 前のメッセージに対する処理（RAG検索、LLM生成）が完了する前に次のメッセージ処理が開始され、コンテキストの不整合や意図しない応答が生成される可能性がある。
  - **APIコストの増大**: 連続したメッセージごとにバックエンド処理が実行され、不要なAPIコールやコンピューティングリソースを消費する。
  - **ユーザー体験の低下**: どの質問に対する応答なのかが不明瞭になり、ユーザーが混乱する可能性がある。

- **対策方針**:
  - **サーバーサイドでの制御（必須）**:
    - **ステート管理**: ユーザーごとに「応答生成中」のステート（状態）を管理する。応答生成中に新たなメッセージを受信した場合は、そのメッセージに対するバックエンド処理は実行せず、代わりに「現在、前の質問への回答を準備中です。恐れ入りますが、少々お待ちください。」といった定型メッセージを即時返信する方式を第一候補とする。
    - **リクエストのキューイング**: もしくは、ユーザーからのリクエストをキューに入れ、一つずつ順次処理するアーキテクチャを検討する。これにより処理の競合を防ぎ、コンテキストの整合性を保つ。
  - **フロントエンドでのUX向上（検討）**:
    - **応答中インジケーター**: LINE Messaging APIの機能で、応答を準備していることを示すインジケーター（"..."のようなタイピング表示）を利用し、ユーザーがシステムが動作中であることを視覚的に認識できるようにする。

### 9.2. LINE APIのタイムアウト

- **シナリオ**:
  - RAG検索やLLMによる回答生成など、バックエンドの処理に時間がかかり、LINE Messaging APIが定めるWebhookのタイムアウト時間（一般的に数秒〜30秒）を超過してしまうケース。

- **潜在的な問題**:
  - Webhookへの応答がタイムアウトし、LINEプラットフォーム側でエラーと判断される。
  - 標準の `Reply Message` APIが使用できなくなるため、ユーザーに応答を返すことができず、結果として無応答（無視された）状態となる。
  - LINEプラットフォームからのリトライにより、意図せず同じ処理が複数回実行されるリスクも考えられる。

- **対策方針**:
  - **非同期プッシュメッセージの導入（必須）**:
    - **即時応答**: Webhookリクエストを受信後、まず即座に `200 OK` ステータスをLINEプラットフォームに返すことで、タイムアウトを確実に回避する。
    - **バックグラウンド処理**: ユーザーからの質問に対する時間のかかる処理（RAG検索、LLM生成）は、バックグラウンドの非同期タスクとして実行する。
    - **Push Messageによる応答**: 回答生成が完了した後、`Push Message` APIを使用して、生成した回答をユーザーに送信する。このアーキテクチャにより、応答生成に30秒以上かかったとしてもユーザーに応答を届けることが可能になる。
  - **処理中ステータスの通知（UX向上）**:
    - Webhook受信時に即時応答を返す代わりに、まず「回答を生成しています。30秒ほどお待ちください...」のようなメッセージを `Reply Message` で送信し、その後 `Push Message` で本応答を返す構成も検討する。これにより、ユーザーは無応答であるとの誤解を避けられる。
  - **応答性能の最適化（継続的）**:
    - 応答時間30秒以内という目標達成のため、プロンプトの最適化、キャッシュ戦略の導入、より高速なEmbeddingsモデルやLLMの検討など、継続的な性能改善を行う。

---

## 10. 命名規則 (Naming Convention)

本プロジェクトで利用するGCPリソースの命名規則を以下に定めます。環境ごと、目的ごとにプレフィックスやサフィックスを統一することで、リソースの識別を容易にします。本プロジェクトでは、**開発環境 (`dev`)** と **本番環境 (`prd`)** の2つの環境を構築します。

### 10.1. 基本フォーマット
`{リソース種別略称}-{プロジェクト名}-{環境}-{用途/役割}`

### 10.2. 各リソースの命名規則

| リソース種別 | 命名規則 | 開発環境 (dev) の例 | 本番環境 (prd) の例 |
| :--- | :--- | :--- | :--- |
| **GitHub Repository**| `celm-linebot-backend` | (共通) | (共通) |
| **GCP Project ID** | `celm-linebot-pj-<env>` | `celm-linebot-pj-dev` | `celm-linebot-pj-prd` |
| **GCS Bucket** | `gcs-celm-linebot-<env>-<purpose>` | `gcs-celm-linebot-dev-knowledge` | `gcs-celm-linebot-prd-knowledge` |
| **Cloud Run** | `cr-celm-linebot-<env>-<service-name>` | `cr-celm-linebot-dev-webhook`<br>`cr-celm-linebot-dev-worker` | `cr-celm-linebot-prd-webhook`<br>`cr-celm-linebot-prd-worker` |
| **Vertex AI RAG Engine** | `rag-celm-linebot-<env>-<purpose>` | `rag-celm-linebot-dev-rag` | `rag-celm-linebot-prd-rag` |
| **Vertex AI RAG Corpus** | `corpus-celm-linebot-<env>-<purpose>` | `corpus-celm-linebot-dev-knowledge` | `corpus-celm-linebot-prd-knowledge` |
| **Cloud Tasks Queue**| `ctq-celm-linebot-<env>-<queue-name>`| `ctq-celm-linebot-dev-rag` | `ctq-celm-linebot-prd-rag` |
| **Cloud SQL Instance**| `sql-celm-linebot-<env>` | `sql-celm-linebot-dev` | `sql-celm-linebot-prd` |
| **VPC Network** | `vpc-celm-linebot-<env>` | `vpc-celm-linebot-dev` | `vpc-celm-linebot-prd` |
| **VPC Connector** | `vpcc-celm-linebot-<env>` | `vpcc-celm-linebot-dev` | `vpcc-celm-linebot-prd` |
| **Secret Manager** | `secret-celm-linebot-<env>-<secret-name>` | `secret-celm-linebot-dev-line-secret` | `secret-celm-linebot-prd-line-secret`|
| **GCP Service Account** | `sa-celm-linebot-<env>-<service-name>` | `sa-celm-linebot-dev-webhook`<br>`sa-celm-linebot-dev-worker` | `sa-celm-linebot-prd-webhook`<br>`sa-celm-linebot-prd-worker` |

### 10.3. 推奨リポジトリ構成

モノレポ戦略をサポートし、効率的なCI/CDを実現するため、`celm-linebot-backend` リポジトリは以下のディレクトリ構成を推奨します。

```plaintext
celm-linebot-backend/
├── .github/workflows/      # CI/CDパイプラインの定義 (例: GitHub Actions)
│   └── deploy.yml
│
├── services/               # 各マイクロサービスのコードを格納
│   ├── webhook/            # Webhook受付サービス
│   │   ├── app/
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── worker/             # 非同期ワーカーサービス
│       ├── app/
│       ├── Dockerfile
│       └── requirements.txt
│
└── shared/                 # サービス間で共有する共通コード
    └── ...
```

-   **`services/webhook/`**: Webhook受付用のCloud Runサービスに対応するソースコードを格納します。このディレクトリへの変更があった場合のみ、`cr-celm-linebot-<env>-webhook` がデプロイされます。
-   **`services/worker/`**: 非同期ワーカー用のCloud Runサービスに対応するソースコードを格納します。このディレクトリへの変更があった場合のみ、`cr-celm-linebot-<env>-worker` がデプロイされます。
-   **`shared/`**: データベースのモデル定義など、複数のサービスで共通して利用するコードを格納します。このディレクトリに変更があった場合は、依存する全てのサービス（`webhook` と `worker`）がデプロイ対象となります。

### 10.4. Secret Manager 登録項目一覧

本プロジェクトでSecret Managerに登録・管理する機密情報は以下の通りです。

| シークレット名 (`<secret-name>` 部分) | 内容・目的 | 開発環境 (`dev`) での名前 | 本番環境 (`prd`) での名前 |
| :--- | :--- | :--- | :--- |
| **`line-channel-secret`** | LINEからのWebhookリクエストが正当なものであることを検証するためのシークレットキー。 | `secret-celm-linebot-dev-line-channel-secret` | `secret-celm-linebot-prd-line-channel-secret` |
| **`line-channel-access-token`** | ボットからユーザーへPush Messageを送信するなど、Messaging APIを呼び出す際に必要な長期アクセストークン。 | `secret-celm-linebot-dev-line-channel-access-token` | `secret-celm-linebot-prd-line-channel-access-token` |
| **`database-url`** | Cloud SQL (PostgreSQL) データベースに接続するための接続文字列。<br>*(例: `postgresql://user:password@host:port/dbname`)* | `secret-celm-linebot-dev-database-url` | `secret-celm-linebot-prd-database-url` |
| **`llm-api-key`** | RAGの回答生成で利用する外部LLM (大規模言語モデル) のAPIキー。 | `secret-celm-linebot-dev-llm-api-key` | `secret-celm-linebot-prd-llm-api-key` |

### 10.5. サービスアカウントの役割と権限 (IAM)

最小権限の原則に従い、各Cloud Runサービスは専用のサービスアカウントで実行します。これにより、各コンポーネントは自身の機能に必要な権限のみを持つことになります。

| サービスアカウント名 | アタッチ先サービス | 主要なIAMロール | 目的 |
| :--- | :--- | :--- | :--- |
| `sa-celm-linebot-<env>-webhook` | `cr-celm-linebot-<env>-webhook` | `roles/cloudtasks.enqueuer`<br>`roles/cloudsql.client`<br>`roles/secretmanager.secretAccessor` | - Cloud Tasksキューへのタスク投入<br>- DB接続（コンテキストリセット等）<br>- Secret Managerからの認証情報取得 |
| `sa-celm-linebot-<env>-worker` | `cr-celm-linebot-<env>-worker` | `roles/cloudsql.client`<br>`roles/secretmanager.secretAccessor`<br>`roles/aiplatform.user` | - DB接続（ログ記録、履歴取得）<br>- Secret ManagerからのAPIキー取得<br>- VertexAIRAGEngine等AIサービス利用（Vector DB, LLM） |

---

## 11. バージョン管理とブランチ戦略

### 11.1. Gitのブランチ戦略とは？
これは、「どのような目的で、いつ、どのブランチを作成し、どのようにマージしていくか」という一連のルール（お作法）を定義することです。
これにより、複数人が同時に作業しても、本番環境のコードを常に安定させ、安全に新機能の追加やバグ修正を行えるようになります。

### 11.2. 推奨するブランチ戦略： GitHub Flow + α
今回のプロジェクト（継続的にデプロイするWebサービス）には、シンプルでモダンな「GitHub Flow」をベースにした戦略が最適です。伝統的な「Git Flow」はバージョン管理が厳格なソフトウェアリリースには向いていますが、少し複雑すぎるためです。

以下に、今回のプロジェクトに合わせた具体的なブランチ戦略を提案します。

- **`main` ブランチ**
  - **役割**: 本番環境 (`prd`) にデプロイされる、常に安定稼働しているコードを管理します。
  - このブランチに直接コミットすることは固く禁止します。

- **`develop` ブランチ**
  - **役割**: 開発環境 (`dev`) にデプロイされる、開発のベースとなるブランチです。
  - 開発者は、新しい機能を作る際にまずこのブランチから自分の作業ブランチを作成します。
  - 機能が完成し、レビューが通ったら、このブランチにマージされます。

- **フィーチャーブランチ (例: `feature/add-reset-function`)**
  - **役割**: 新しい機能を追加・開発するためのブランチです。
  - 必ず `develop` ブランチから作成します。
  - 作業が完了したら、`develop` ブランチに対してプルリクエスト (Pull Request) を作成します。

- **ホットフィックスブランチ (例: `hotfix/fix-critical-bug`)**
  - **役割**: 本番環境で発生した緊急のバグを修正するためのブランチです。
  - `main` ブランチから直接作成し、修正が完了したら `main` と `develop` の両方にマージします。

### 11.3. 開発の基本的な流れ
1.  開発者は、`develop` ブランチから `feature/xxx` ブランチを作成して作業を開始します。
2.  作業が完了したら、GitHub上で `develop` ブランチへのプルリクエストを作成します。
3.  他の開発者がコードをレビューし、問題なければ承認します。
4.  承認されたプルリクエストが `develop` ブランチにマージされます。
5.  マージをトリガーに、CI/CDが自動で `develop` ブランチのコードを開発環境 (`dev`) にデプロイします。
6.  リリース準備が整ったら、`develop` ブランチから `main` ブランチへのプルリクエストを作成します。
7.  最終確認後、`main` ブランチにマージされ、CI/CDによって本番環境 (`prd`) にデプロイされます。

---

## 12. 障害検知とエラーハンドリング

### 12.1. 基本方針
- **ユーザーへの影響を最小化**: 内部エラーが発生した場合でも、ユーザーに応答がない「無言」の状態は避ける。必ず何らかの応答を返し、可能な限り丁寧なメッセージで状況を伝える。
- **原因の特定を容易に**: 全てのエラーは、原因調査に必要な情報（タイムスタンプ, ユーザーID, エラーメッセージ, スタックトレース等）を含んだログとして記録する。
- **システムの自己回復**: 一時的なネットワーク障害など、リトライによって回復が見込めるエラーについては、指数バックオフを用いたリトライ処理を実装する。

### 12.2. 主要なエラーシナリオと対応

| シナリオ | 発生コンポーネント | 対応方針 |
| :--- | :--- | :--- |
| **1. 外部APIの障害**<br>(LINE API, LLM API, VertexAIRAGEngine) | `worker` | 1. **リトライ**: 3回まで指数バックオフでリトライを実行する。<br>2. **ログ記録**: 3回失敗後、エラーログを記録する。<br>3. **ユーザー通知**: 「現在、システムが混み合っているため、回答の生成に失敗しました。時間をおいてもう一度お試しください。」という趣旨のメッセージをPush Messageで送信する。<br>4. **タスクの終了**: 処理を中断し、Cloud Tasksに成功応答(2xx)を返してタスクをキューから削除する。（リトライはアプリケーション層で行うため） |
| **2. データベース接続障害** | `webhook`, `worker` | 上記「1. 外部APIの障害」に準ずる。 |
| **3. 予期せぬプログラムエラー**<br>(バグ、不正なデータ等) | `webhook`, `worker` | 1. **例外捕捉**: FastAPIのグローバル例外ハンドラで全ての未捕捉例外をキャッチする。<br>2. **ログ記録**: **スタックトレースを含んだ**詳細なエラーログを記録する。<br>3. **ユーザー通知**: 上記「1. 外部APIの障害」と同様のメッセージを送信する。<br>4. **Cloud Tasksへの応答**: Cloud Tasksには**エラー応答(5xx)を返す**。これにより、Cloud Tasks側のリトライ機能が作動する。数回のリトライ後も失敗する場合は、デッドレターキューにタスクが送られるように設定する。（要検討） |
| **4. Cloud Tasksへの投入失敗** | `webhook` | 1. **リトライ**: 3回までリトライを実行する。<br>2. **ログ記録**: 3回失敗後、クリティカルエラーとしてログを記録する。<br>3. **ユーザー通知**: ユーザーには即時応答(200 OK)を返しているため、この時点での追加通知は行わない。（ただし、監視アラートで開発者が即時検知できる必要がある） |

### 12.3. エラー処理フロー

#### 12.3.1. Worker: 外部API障害
以下に、「1. 外部APIの障害」シナリオにおけるworkerコンポーネントの処理フローを示します。

```mermaid
graph TD
    subgraph "Worker: 外部API呼び出しエラーハンドリング"
        direction LR
        Start("API呼び出し開始") --> CallAPI
        CallAPI("1. API呼び出し実行") --> CheckSuccess{"2. 呼び出し成功？"}
        CheckSuccess -- "Yes" --> Success("正常処理へ")

        CheckSuccess -- "No" --> RetryCheck{"3. リトライ回数 < 3回？"}
        RetryCheck -- "Yes" --> ExponentialBackoff("4. 指数バックオフで待機")
        ExponentialBackoff --> CallAPI

        RetryCheck -- "No" --> LogError("5. エラーログを記録")
        LogError --> NotifyUser("6. ユーザーにエラーメッセージを送信")
        NotifyUser --> RespondToQueue("7. Cloud Tasksに成功(2xx)を返す")
        RespondToQueue --> End("処理終了")
    end
```

#### 12.3.2. Webhook: Cloud Tasks投入失敗
以下に、「4. Cloud Tasksへの投入失敗」シナリオにおけるwebhookコンポーネントの処理フローを示します。このエラーはユーザーに応答を返した後で発生するため、クリティカルエラーとしてログに記録し、監視アラートによって即時検知することが重要です。

```mermaid
graph TD
    subgraph "Webhook: Cloud Tasks投入エラーハンドリング"
        direction LR
        Start("タスク投入処理 開始") --> EnqueueTask
        EnqueueTask("1. Cloud Tasksにタスクを投入") --> CheckSuccess{"2. 投入成功？"}
        CheckSuccess -- "Yes" --> Success("正常終了")

        CheckSuccess -- "No" --> RetryCheck{"3. リトライ回数 < 3回？"}
        RetryCheck -- "Yes" --> ExponentialBackoff("4. 指数バックオフで待機")
        ExponentialBackoff --> EnqueueTask

        RetryCheck -- "No" --> LogError("5. クリティカルエラーとしてログ記録")
        LogError --> End("処理終了 (監視アラートで検知)")
    end
```

### 12.4. ロギング・監視方針

アプリケーションの健全性を監視し、問題発生時に迅速な原因調査を可能にするため、以下のロギング方針を定めます。

#### 12.4.1. ログの目的と種類
本プロジェクトでは、ログを以下の2種類に大別して管理します。

- **1. 分析・評価ログ (永続ログ)**
  - **目的**: ユーザーとのインタラクションを記録し、QA傾向分析や回答品質の評価に利用する。
  - **保存先**: Cloud SQL (PostgreSQL)
  - **記録内容**: ユーザーID、質問・回答テキスト、RAGの検索結果、処理時間など、サービスの品質改善に繋がる情報を構造化データとして永続化します。（詳細は別途DB設計書にて定義）

- **2. 運用・デバッグログ (実行時ログ)**
  - **目的**: アプリケーションの動作状況の確認、パフォーマンス監視、エラー発生時の原因調査を行う。
  - **保存先**: Cloud Logging
  - **記録内容**: 各コンポーネントの処理開始・終了、外部API呼び出し、エラー情報、スタックトレースなど、開発者向けの実行時情報を記録します。

#### 12.4.2. 運用・デバッグログの実装方針
Cloud Loggingに出力する運用ログは、以下の実装方針に基づきます。

- **環境に応じた出力形式**: ローカルでの開発体験（DX）とGCP環境での運用性を両立させるため、環境変数 (`ENV`) によってログの出力形式を動的に切り替えます。
  - **GCP環境 (`ENV=gcp`)**: Cloud Loggingが自動的にパース可能な **JSON形式の構造化ログ** を出力します。
  - **ローカル環境 (`ENV=local`)**: 開発者がターミナルで読みやすい、タイムスタンプやログレベルを含む **テキスト形式** で出力します。

- **設定の一元管理**: `webhook`と`worker`の両サービスでログフォーマットの一貫性を保つため、ロギング設定を行う共有ライブラリ (`shared/logging_config.py` など) を作成します。各サービスの起動時にこの設定を一度だけ呼び出すことで、アプリケーション全体のロギングを統一的に管理します。

#### 12.4.3. 構造化ログの基本フォーマット
GCP環境で出力されるJSONログには、検索性と追跡性を高めるため、以下の共通フィールドを含めることを推奨します。

```json
{
  "severity": "INFO",
  "message": "人間が読むためのログメッセージ",
  "timestamp": "2025-10-09T10:00:00.123Z",
  "service_context": {
    "service": "webhook"
  },
  "trace_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "line_context": {
    "user_id": "Uxxxxxxxxxxxx"
  },
  "details": {
    // イベント固有の情報を格納
  }
}
```
- **`trace_id`**: Webhook受信時に生成し、Cloud Tasks経由でWorkerに引き継ぐことで、一連の非同期処理を横断して追跡可能にします。

#### 12.4.4. アラート設定
- Cloud Monitoringを利用し、「5xxエラーの発生率が5分間で1%を超えた場合」や「Cloud Tasksのキューの滞留数が100を超えた場合」といった条件で、開発チームにアラートが通知されるように設定します。

---
**凡例**
- `<env>`: 環境識別子 (`dev`: 開発, `prd`: 本番)
- `<purpose>`: バケットの目的 (`knowledge`, `