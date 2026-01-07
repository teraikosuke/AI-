# データベース設計書 (作成中！！！！！)

このドキュメントは、アプリケーションの永続化層に関する技術選定の経緯と、具体的なデータベース設計を定義します。

## 1. 永続化層の技術選定

アプリケーションの会話履歴などを永続化するため、本プロジェクトではリレーショナルデータベース（SQL）を採用します。

### 開発フロー

1.  **初期開発フェーズ**: 開発効率を考慮し、ローカル環境に構築した**PostgreSQL**をデータベースとして利用します。
2.  **本番展開フェーズ**: アプリケーションをGCPにデプロイする際、データベースを**Cloud SQL for PostgreSQL**に移行します。

PythonのORM（Object-Relational Mapper）であるSQLAlchemyを利用することで、コードの大部分を変更することなく、接続情報（データベースURL）の切り替えだけでこの移行を実現できます。

---

## 2. SQLデータベース設計

### 2.1. ER図 (最新)

現在のアプリケーションで採用されている設計です。
会話の各発言（ユーザーから、AIから）を個別のレコードとして記録する柔軟な構造になっています。

```mermaid
erDiagram
    T_USERS ||--o{ T_SESSIONS : "has"
    T_SESSIONS ||--o{ T_CONVERSATION_HISTORY : "contains"
    T_USERS ||--o{ T_USER_JOB_LOCK : "has"
    M_USERS }o--|| M_REGISTRATION_CODES : "uses"

    T_USERS {
        INTEGER id PK "主キー"
        VARCHAR(255) line_user_id "LINEユーザーID (一意)"
        VARCHAR(255) display_name "LINE表示名"
        DATETIME display_name_updated_at "display_name最終更新日時"
        DATETIME created_at "レコード作成日時"
        DATETIME updated_at "レコード更新日時"
    }

    T_SESSIONS {
        INTEGER id PK "主キー"
        INTEGER user_id FK "外部キー (M_USERS.id)"
        DATETIME start_time "セッション開始日時"
        DATETIME end_time "セッション終了日時 (NULL許容)"
        BOOLEAN is_active "セッション処理中フラグ"
    }

    T_CONVERSATION_HISTORY {
        INTEGER id PK "主キー"
        INTEGER session_id FK "外部キー (T_SESSIONS.id)"
        VARCHAR(50) role "発言者の役割 ('human' or 'ai')"
        TEXT message_content "メッセージ内容"
        TEXT etc "補足情報 (特殊コマンド、範囲外質問などの判定結果)"
        DATETIME timestamp "やり取りの日時"
    }

    T_USER_JOB_LOCK {
        INTEGER t_user_id PK "主キー (外部キー)"
        DATETIME lease_until "占有期限"
        VARCHAR(255) holder_id "実行識別子"
    }

    M_REGISTRATION_CODES {
        INTEGER id PK "主キー"
        VARCHAR(255) code "登録コード (一意)"
        VARCHAR(50) grade "紐づく学年 (将来利用)"
        BOOLEAN is_used "使用済みフラグ"
        INTEGER used_by_user_id FK "使用したユーザーID"
        DATETIME used_at "使用日時"
        DATETIME created_at "コード作成日時"
    }
```

### 2.2. テーブル定義 (最新)

#### `t_users` テーブル

LINEユーザーの情報を管理します。

| カラム名 | 型 | 説明 | 制約 |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | 主キー | PRIMARY KEY, AUTO_INCREMENT |
| `line_user_id` | `VARCHAR(255)` | LINEから提供される一意のユーザーID | NOT NULL, UNIQUE |
| `display_name` | `VARCHAR(255)` | LINEの表示名。初回登録時にAPIから取得 | |
| `display_name_updated_at` | `DATETIME` | display_nameが最後に更新された日時 | |
| `created_at` | `DATETIME` | レコードが最初に作成された日時 | NOT NULL, DEFAULT NOW() |
| `updated_at` | `DATETIME` | レコードが更新された日時 | NOT NULL, DEFAULT NOW() ON UPDATE NOW() |

#### `t_sessions` テーブル

ユーザーとの一連のやり取り（セッション）を管理します。

| カラム名 | 型 | 説明 | 制約 |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | 主キー | PRIMARY KEY, AUTO_INCREMENT |
| `t_user_id` | `INTEGER` | `t_users`テーブルへの外部キー | NOT NULL, FOREIGN KEY (`t_users`.`id`) |
| `start_time` | `DATETIME` | セッションの開始日時 | NOT NULL |
| `end_time` | `DATETIME` | セッションの終了日時。アクティブなセッションはNULL。 | |
| `is_active` | `BOOLEAN` | セッションが現在処理中かどうかのフラグ | NOT NULL, DEFAULT TRUE |

#### `t_conversation_history` テーブル

セッション内の具体的な会話履歴を、発言単位で保存します。

| カラム名 | 型 | 説明 | 制約 |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | 主キー | PRIMARY KEY, AUTO_INCREMENT |
| `t_session_id` | `INTEGER` | `t_sessions`テーブルへの外部キー | NOT NULL, FOREIGN KEY (`t_sessions`.`id`) |
| `role` | `VARCHAR(50)` | 発言者の役割。`'human'`または`'ai'`。 | NOT NULL |
| `message_content` | `TEXT` | メッセージの内容。 | NOT NULL |
| `etc` | `TEXT` | 補足情報（特殊コマンド、範囲外質問などの判定結果） | |
| `timestamp` | `DATETIME` | やり取りが発生した日時。 | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

#### `t_user_job_lock` テーブル

同時実行制御のための監視用テーブルです。ユーザー単位での処理の排他制御を行います。

| カラム名 | 型 | 説明 | 制約 |
| :--- | :--- | :--- | :--- |
| `t_user_id` | `INTEGER` | 主キー（外部キー） | PRIMARY KEY, FOREIGN KEY (`t_users`.`id`) |
| `lease_until` | `DATETIME` | 占有期限。DB の NOW() 基準 | NOT NULL |
| `holder_id` | `VARCHAR(255)` | 実行識別子（例：リクエストID） | NOT NULL |

#### `m_registration_codes` テーブル

ユーザー登録時に使用する登録コードを管理します。

| カラム名 | 型 | 説明 | 制約 |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | 主キー | PRIMARY KEY, AUTO_INCREMENT |
| `code` | `VARCHAR(255)` | ユニークな登録コード | NOT NULL, UNIQUE |
| `grade` | `VARCHAR(50)` | （将来利用）このコードに紐づく学年情報 | |
| `is_used` | `BOOLEAN` | 使用済みかを示すフラグ | NOT NULL, DEFAULT FALSE |
| `created_at` | `DATETIME` | このコードが作成された日時 | NOT NULL, DEFAULT NOW() |
| `used_at` | `DATETIME` | このコードが使用された日時 | |
| `used_by_user_id` | `INTEGER` | このコードを使用した`m_users`テーブルのID | FOREIGN KEY (`m_users`.`id`) |

---

## 3. データベース処理フロー

LINEからのWebhook通信から返答生成までのデータベース処理の流れを以下に示します。

```mermaid
flowchart TD
    A[LINE Webhook受信] --> B[ユーザー情報取得]
    B --> C[セッション情報取得]
    C --> D{セッション処理中？}
    
    D -->|Yes| E[「処理中です」返却]
    E --> F[処理終了]
    
    D -->|No| H[t_user_job_lock生成]
    H --> G{特殊コマンド判定}
    
    G -->|「リセット」| I{現在のセッション存在？}
    I -->|Yes| J[t_sessions.end_time更新]
    I -->|No| K[スキップ]
    J --> L[t_user_job_lock無効化]
    K --> L
    L --> M[リセット完了通知]
    M --> F
    
    G -->|その他| O{現在のセッション存在？}
    O -->|Yes| P[t_sessions.is_active更新]
    O -->|No| Q[新規セッション生成]
    P --> R[Cloud Tasks実行]
    Q --> R
    
    R --> S[Worker処理開始]
    S --> T[返答内容生成]
    T --> U[t_conversation_history更新]
    U --> V[t_sessions.is_active更新]
    V --> W[t_user_job_lock無効化]
    W --> X[LINE返答送信]
    X --> F
    
    style A fill:#1976d2,color:#ffffff
    style E fill:#f57c00,color:#ffffff
    style M fill:#388e3c,color:#ffffff
    style X fill:#388e3c,color:#ffffff
    style F fill:#7b1fa2,color:#ffffff
```

### 処理フロー詳細

#### 1. 初期処理
- LINE Webhookからユーザー情報とセッション情報を取得
- セッションの処理状態を確認

#### 2. 排他制御チェック
- `t_user_job_lock`テーブルで有効なロックが存在するかチェック
- `t_sessions.is_active`が`true`のセッションが存在するかチェック
- いずれかが該当する場合は「処理中です」メッセージを返却して終了

#### 3. 特殊コマンド処理（「リセット」）
- 新しい`t_user_job_lock`を生成
- 既存のアクティブセッションがあれば`end_time`を更新
- ロックを無効化してリセット完了を通知

#### 4. 通常処理
- 新しい`t_user_job_lock`を生成
- 既存セッションの`is_active`を更新、または新規セッションを生成
- Cloud Tasksでワーカープロセスを実行

#### 5. ワーカー処理
- AI返答を生成
- `t_conversation_history`に会話履歴を記録
- セッションの`is_active`を更新
- ロックを無効化
- LINEに返答を送信

---

## 4. 旧設計案 (参考)

開発初期に検討された設計案です。ユーザーとAIの1往復のやり取りを1つのレコードとして記録する方式です。

### 3.1. ER図 (旧)

```mermaid
erDiagram
    USERS ||--o{ SESSIONS : "has"
    SESSIONS ||--o{ CONVERSATION_HISTORY : "contains"

    USERS {
        INTEGER id PK "主キー"
        VARCHAR(255) line_user_id "LINEのユーザーID (一意)"
        DATETIME created_at "登録日時"
        DATETIME updated_at "更新日時"
    }

    SESSIONS {
        INTEGER id PK "主キー"
        INTEGER user_id FK "外部キー (USERS.id)"
        DATETIME start_time "セッション開始日時"
        DATETIME end_time "セッション終了日時 (NULL許容)"
        TEXT summary "セッションの要約 (NULL許容)"
    }

    CONVERSATION_HISTORY {
        INTEGER id PK "主キー"
        INTEGER session_id FK "外部キー (SESSIONS.id)"
        JSON user_message "ユーザーからのメッセージ"
        TEXT ai_message "AIからの応答"
        DATETIME timestamp "やり取りの日時"
    }
```

### 3.2. テーブル定義 (旧)

#### `conversation_history` テーブル (旧)

セッション内の具体的な会話履歴を、**1往復単位で**保存します。

| カラム名       | 型           | 説明                                                                                             | 制約                                      |
| :------------- | :----------- | :----------------------------------------------------------------------------------------------- | :---------------------------------------- |
| `id`           | `INTEGER`    | 主キー                                                                                           | PRIMARY KEY, AUTO_INCREMENT               |
| `session_id`   | `INTEGER`    | `sessions`テーブルへの外部キー                                                                   | NOT NULL, FOREIGN KEY (`sessions`.`id`)   |
| `user_message` | `TEXT`/`JSON`  | ユーザーからのメッセージ。テキスト、または画像情報(`{"type": "image", "original_content_url": "..."}`)などを格納。 | NOT NULL                                  |
| `ai_message`   | `TEXT`       | AIからの応答メッセージ。                                                                         | NOT NULL                                  |
| `timestamp`    | `DATETIME`   | やり取りが発生した日時。                                                                         | NOT NULL, DEFAULT CURRENT_TIMESTAMP       |

---