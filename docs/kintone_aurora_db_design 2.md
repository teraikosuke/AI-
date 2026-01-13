# kintone -> Aurora データベース設計書

## ER 図

```mermaid
erDiagram
    candidates ||--o{ applications : has
    applications ||--o{ call_logs : has
    applications ||--o{ application_staff_assignments : assigns

    candidates {
        BIGINT candidate_id PK
        VARCHAR name
        VARCHAR name_kana
        DATE birthday
        VARCHAR gender
        VARCHAR tel
        VARCHAR email
        TEXT address
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    applications {
        SERIAL application_id PK
        BIGINT candidate_id FK
        VARCHAR company_name
        VARCHAR job_name
        VARCHAR selection_stage
        VARCHAR status
        BOOLEAN active_flag
        BOOLEAN sms_sent
        VARCHAR line_follow_up
        DATE call_connected_date
        DATE schedule_fixed_date
        DATE next_call_date
        TEXT motivation_text
        VARCHAR intent_status
        INT current_income
        INT desired_income
        TEXT remarks
    }

    call_logs {
        SERIAL call_log_id PK
        INT application_id FK
        INT call_count
        TIMESTAMP called_at
        BOOLEAN is_effective
    }

    application_staff_assignments {
        SERIAL assignment_id PK
        INT application_id FK
        VARCHAR staff_name
        VARCHAR staff_role
    }
```

## テーブル定義

### candidates (求職者マスタ)

| カラム名 | データ型 | kintone項目名 | 備考 |
| --- | --- | --- | --- |
| candidate_id | BIGINT (PK) | 求職者コード | ユニークなID |
| name | VARCHAR(255) | 求職者名 |  |
| name_kana | VARCHAR(255) | 求職者名（カタカナ） |  |
| birthday | DATE | 生年月日 |  |
| gender | VARCHAR(10) | 性別 | ラジオボタン |
| tel | VARCHAR(20) | 電話番号 |  |
| email | VARCHAR(255) | メールアドレス |  |
| address | TEXT | 現住所 |  |
| created_at | TIMESTAMP | 登録日 |  |
| updated_at | TIMESTAMP | 更新日時 |  |

### applications (選考・案件管理)

| カラム名 | データ型 | kintone項目名 | 備考 |
| --- | --- | --- | --- |
| application_id | SERIAL (PK) | - | 内部管理ID |
| candidate_id | BIGINT (FK) | 求職者コード | candidatesテーブルと紐付け |
| company_name | VARCHAR(255) | 応募企業名 |  |
| job_name | VARCHAR(255) | 応募求人名 |  |
| selection_stage | VARCHAR(50) | 応募段階 | ドロップダウン |
| status | VARCHAR(50) | ステータス | ドロップダウン |
| active_flag | BOOLEAN | アクティブ | チェックボックス |
| sms_sent | BOOLEAN | SMS送信 | ラジオボタン |
| line_follow_up | VARCHAR(100) | LINE追客 |  |
| call_connected_date | DATE | 通電日 |  |
| schedule_fixed_date | DATE | 日程確定日 |  |
| next_call_date | DATE | 新規発信予定日 |  |
| motivation_text | TEXT | 動機文 |  |
| intent_status | VARCHAR(50) | 意欲ステータス |  |
| current_income | INT | 年収（現） |  |
| desired_income | INT | 年収（希望） |  |
| remarks | TEXT | 備考 |  |

### call_logs (架電履歴)

| カラム名 | データ型 | kintone項目名 | 備考 |
| --- | --- | --- | --- |
| call_log_id | SERIAL (PK) | - |  |
| application_id | INT (FK) | - | applicationsテーブルと紐付け |
| call_count | INT | - | 何回目の架電か(1〜10) |
| called_at | TIMESTAMP | ◯回目架電 | 架電日時 |
| is_effective | BOOLEAN | 有効応募/通電 | ラジオボタンの結果 |

### application_staff_assignments (担当者紐付け)

| カラム名 | データ型 | 備考 |
| --- | --- | --- |
| assignment_id | SERIAL (PK) |  |
| application_id | INT (FK) | applicationsテーブルと紐付け |
| staff_name | VARCHAR(255) | 担当者名（田中莉子など） |
| staff_role | VARCHAR(50) | CS / パートナー の種別 |

## ETL 設計

```mermaid
flowchart TD
    A[Extract: kintone API] --> B[Transform: 正規化/型変換]
    B --> C[Load: Aurora]

    subgraph Extract
        A1[差分取得: updated_at + id] --> A
        A2[ページング取得: 1000件/ページ] --> A
    end

    subgraph Transform
        B1[candidates 変換] --> B
        B2[applications 変換] --> B
        B3[call_logs 縦持ち展開] --> B
        B4[担当者分解: application_staff_assignments] --> B
    end

    subgraph Load
        C1[UPSERT: candidates] --> C
        C2[UPSERT: applications] --> C
        C3[UPSERT: call_logs] --> C
        C4[UPSERT: application_staff_assignments] --> C
    end
```

## 設計のポイント

- 正規化: call_logs と application_staff_assignments を分離し分析性を向上
- ユーザー選択: 中間テーブルで多対多を表現
- 履歴データ: remarks は TEXT で保持し、必要に応じて notes テーブル化
