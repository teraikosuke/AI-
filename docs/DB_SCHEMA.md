# データベース設計書 (Database Schema)

現在のシステム（AgentKey）で使用されているデータベースの完全なスキーマ定義です。

## 概要

- **データベースエンジン**: PostgreSQL
- **同期元**: Kintone
- **スキーマファイル**: `db/schema.sql`

---

## 1. candidates (求職者テーブル)

求職者の基本情報、ステータス、選考進捗などを管理するメインテーブルです。

| カラム名 | 型 | 説明 | Kintoneフィールド | 備考 |
|---|---|---|---|---|
| `id` | BIGSERIAL | プライマリキー | - | 自動採番 |
| `kintone_record_id` | INTEGER | KintoneレコードID | `$id` | UNIQUE制約 |
| `candidate_code` | TEXT | 求職者コード | - | |
| `candidate_name` | TEXT | 求職者名 | `求職者名` | **NOT NULL** |
| `candidate_kana` | TEXT | 求職者名（カナ） | - | |
| `company_name` | TEXT | 応募企業名 | `応募企業名` | |
| `job_name` | TEXT | 応募求人名 | `応募求人名` | |
| `work_location` | TEXT | 勤務地 | - | |
| `cs_name` | TEXT | 担当CS | `担当CS` | **Smart Sync対象** |
| `caller_name` | TEXT | コール担当者名 | - | |
| `partner_name` | TEXT | 担当パートナー | `担当アドバイザー` | **Smart Sync対象** |
| `introduction_chance` | TEXT | 紹介確度 | - | |
| `phase` | TEXT | フェーズ | - | |
| `registered_date` | DATE | 登録日 | `登録日` | |
| `registered_at` | TIMESTAMPTZ | 登録日時 | - | |
| `candidate_updated_at` | TIMESTAMPTZ | 候補者情報更新日時 | - | |
| `media_registered_at` | DATE | 媒体登録日 | - | |
| `source` | TEXT | 応募経路 | `応募経路_0` | |
| `phone` | TEXT | 電話番号 | `電話番号` | |
| `email` | TEXT | メールアドレス | `メールアドレス` | |
| `birthday` | DATE | 生年月日 | `生年月日` | |
| `age` | INTEGER | 年齢 | `年齢` | |
| `gender` | TEXT | 性別 | - | |
| `education` | TEXT | 最終学歴 | - | |
| `postal_code` | TEXT | 郵便番号 | - | |
| `address` | TEXT | 住所 | - | |
| `city` | TEXT | 市区町村 | - | |
| `contact_time` | TEXT | 連絡可能時間帯 | - | |
| `remarks` | TEXT | 備考 | - | |
| `memo` | TEXT | メモ | - | |
| `memo_detail` | TEXT | 詳細メモ | - | |
| `hearing_memo` | TEXT | ヒアリングメモ | - | |
| `resume_status` | TEXT | 履歴書ステータス | - | |
| `meeting_video_url` | TEXT | 面談動画URL | - | |
| `resume_for_send` | TEXT | 送付用履歴書 | - | |
| `work_history_for_send` | TEXT | 送付用職務経歴書 | - | |
| `employment_status` | TEXT | 就業状況 | - | |
| `first_contact_planned_at` | DATE | 初回コンタクト予定日 | - | |
| `first_contact_at` | DATE | 初回コンタクト日 | - | |
| `call_date` | DATE | コール日 | - | |
| `schedule_confirmed_at` | DATE | 日程確定日 | - | |
| `recommendation_date` | DATE | 推薦日 | - | |
| `valid_application` | BOOLEAN | 有効応募フラグ | - | DEFAULT FALSE |
| `phone_connected` | BOOLEAN | 電話接続フラグ | - | DEFAULT FALSE |
| `sms_sent` | BOOLEAN | SMS送信フラグ | - | DEFAULT FALSE |
| `sms_confirmed` | BOOLEAN | SMS確認フラグ | - | DEFAULT FALSE |
| `attendance_confirmed` | BOOLEAN | 出席確認フラグ | - | DEFAULT FALSE |
| `next_action_date` | DATE | 次回アクション日 | - | |
| `next_action_content` | TEXT | 次回アクション内容 | - | |
| `final_result` | TEXT | 最終結果 | - | |
| `order_amount` | TEXT | 受注金額 | - | |
| `after_acceptance_job_type` | TEXT | 内定後職種 | - | |
| `line_reported` | BOOLEAN | LINE報告済フラグ | - | DEFAULT FALSE |
| `personal_sheet_reflected` | BOOLEAN | 個人シート反映フラグ | - | DEFAULT FALSE |
| `invoice_sent` | BOOLEAN | 請求書送付フラグ | - | DEFAULT FALSE |
| `cs_valid_confirmed` | BOOLEAN | CS有効確認フラグ | - | DEFAULT FALSE |
| `cs_connect_confirmed` | BOOLEAN | CS接続確認フラグ | - | DEFAULT FALSE |
| `refund_retirement_date` | DATE | 返金退職日 | - | |
| `refund_amount` | TEXT | 返金額 | - | |
| `refund_report` | TEXT | 返金報告 | - | |
| `cs_call_attempt1` | BOOLEAN | CSコール試行1 | - | DEFAULT FALSE |
| `cs_call_attempt2` | BOOLEAN | CSコール試行2 | - | DEFAULT FALSE |
| `cs_call_attempt3` | BOOLEAN | CSコール試行3 | - | DEFAULT FALSE |
| `cs_call_attempt4` | BOOLEAN | CSコール試行4 | - | DEFAULT FALSE |
| `cs_call_attempt5` | BOOLEAN | CSコール試行5 | - | DEFAULT FALSE |
| `cs_call_attempt6` | BOOLEAN | CSコール試行6 | - | DEFAULT FALSE |
| `cs_call_attempt7` | BOOLEAN | CSコール試行7 | - | DEFAULT FALSE |
| `cs_call_attempt8` | BOOLEAN | CSコール試行8 | - | DEFAULT FALSE |
| `cs_call_attempt9` | BOOLEAN | CSコール試行9 | - | DEFAULT FALSE |
| `cs_call_attempt10` | BOOLEAN | CSコール試行10 | - | DEFAULT FALSE |
| `detail` | JSONB | 詳細情報(JSON) | - | DEFAULT '{}' |
| `kintone_updated_time` | TIMESTAMPTZ | Kintone更新日時 | `更新日時` | |
| `created_at` | TIMESTAMPTZ | 作成日時 | - | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | 更新日時 | - | DEFAULT NOW() |

---

## 2. meeting_plans (面談予定テーブル)

| カラム名 | 型 | 説明 | 備考 |
|---|---|---|---|
| `id` | BIGSERIAL | プライマリキー | 自動採番 |
| `candidate_id` | BIGINT | 候補者ID | FK → candidates(id), ON DELETE CASCADE |
| `sequence` | INTEGER | 連番 | NOT NULL |
| `planned_date` | DATE | 予定日 | |
| `attendance` | BOOLEAN | 出席フラグ | DEFAULT FALSE |
| `created_at` | TIMESTAMPTZ | 作成日時 | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | 更新日時 | DEFAULT NOW() |

---

## 3. resume_documents (提出書類テーブル)

| カラム名 | 型 | 説明 | 備考 |
|---|---|---|---|
| `id` | BIGSERIAL | プライマリキー | 自動採番 |
| `candidate_id` | BIGINT | 候補者ID | FK → candidates(id), ON DELETE CASCADE |
| `label` | TEXT | 書類ラベル | |
| `document_value` | TEXT | 書類URL/パス | |
| `created_at` | TIMESTAMPTZ | 作成日時 | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | 更新日時 | DEFAULT NOW() |

---

## 4. selection_progress (選考進捗テーブル)

| カラム名 | 型 | 説明 | 備考 |
|---|---|---|---|
| `id` | BIGSERIAL | プライマリキー | 自動採番 |
| `candidate_id` | BIGINT | 候補者ID | FK → candidates(id), ON DELETE CASCADE |
| `company_name` | TEXT | 企業名 | |
| `application_route` | TEXT | 応募経路 | |
| `recommendation_date` | DATE | 推薦日 | |
| `interview_schedule_date` | DATE | 面接調整日 | |
| `interview_date` | DATE | 面接日 | |
| `offer_date` | DATE | 内定日 | |
| `closing_plan_date` | DATE | クロージング予定日 | |
| `offer_accept_date` | DATE | 内定承諾日 | |
| `joining_date` | DATE | 入社日 | |
| `pre_join_quit_date` | DATE | 入社前辞退日 | |
| `introduction_fee` | TEXT | 紹介手数料 | |
| `status` | TEXT | ステータス | |
| `note` | TEXT | 備考 | |
| `created_at` | TIMESTAMPTZ | 作成日時 | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | 更新日時 | DEFAULT NOW() |

---

## 5. sync_state (同期状態テーブル)

| カラム名 | 型 | 説明 | 備考 |
|---|---|---|---|
| `source` | TEXT | 同期元識別子 | **PRIMARY KEY** |
| `last_synced_at` | TIMESTAMPTZ | 最終同期日時 | DEFAULT '2000-01-01' |

---

## 6. ats_settings (システム設定テーブル)

| カラム名 | 型 | 説明 | 備考 |
|---|---|---|---|
| `id` | SMALLINT | ID | PRIMARY KEY, DEFAULT 1 |
| `kintone_subdomain` | TEXT | Kintoneサブドメイン | NOT NULL |
| `kintone_app_id` | TEXT | KintoneアプリID | NOT NULL |
| `kintone_api_token` | TEXT | Kintone APIトークン | NOT NULL |
| `created_at` | TIMESTAMPTZ | 作成日時 | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | 更新日時 | DEFAULT NOW() |

---

## 7. users (ユーザーテーブル)

| カラム名 | 型 | 説明 | 備考 |
|---|---|---|---|
| `id` | UUID | ユーザーID | PRIMARY KEY |
| `email` | VARCHAR(255) | メールアドレス | NOT NULL |
| `name` | VARCHAR(255) | ユーザー名 | |
| `email_verified_at` | TIMESTAMPTZ | メール確認日時 | |
| `image` | TEXT | プロフィール画像URL | |
| `created_at` | TIMESTAMPTZ | 作成日時 | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | 更新日時 | DEFAULT NOW() |

---

## 8. user_profiles (ユーザープロフィールテーブル)

| カラム名 | 型 | 説明 | 備考 |
|---|---|---|---|
| `id` | BIGSERIAL | プライマリキー | 自動採番 |
| `user_id` | UUID | ユーザーID | FK → users(id), ON DELETE CASCADE |
| `department` | VARCHAR(255) | 部署 | |
| `position` | VARCHAR(255) | 役職 | |
| `period_start_date` | DATE | 期間開始日 | |
| `period_end_date` | DATE | 期間終了日 | |
| `created_by` | BIGINT | 作成者ID | |
| `updated_by` | BIGINT | 更新者ID | |
| `created_at` | TIMESTAMPTZ | 作成日時 | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | 更新日時 | DEFAULT NOW() |

---

## 9. clients (取引先企業テーブル)

| カラム名 | 型 | 説明 | 備考 |
|---|---|---|---|
| `id` | BIGSERIAL | プライマリキー | 自動採番 |
| `name` | VARCHAR(255) | 企業名 | NOT NULL |
| `industry` | VARCHAR(255) | 業種 | |
| `location` | VARCHAR(255) | 所在地 | |
| `employees_count` | INTEGER | 従業員数 | |
| `created_at` | TIMESTAMPTZ | 作成日時 | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | 更新日時 | DEFAULT NOW() |

---

## 10. candidate_app_profile (候補者アプリプロフィールテーブル)

| カラム名 | 型 | 説明 | 備考 |
|---|---|---|---|
| `id` | BIGSERIAL | プライマリキー | 自動採番 |
| `candidate_id` | BIGINT | 候補者ID | FK → candidates(id), UNIQUE |
| `nationality` | VARCHAR(255) | 国籍 | |
| `japanese_level` | VARCHAR(255) | 日本語レベル | |
| `address_pref` | VARCHAR(255) | 都道府県 | |
| `address_city` | VARCHAR(255) | 市区町村 | |
| `address_detail` | VARCHAR(255) | 住所詳細 | |
| `final_education` | VARCHAR(255) | 最終学歴 | |
| `work_experience` | TEXT | 職務経歴 | |
| `interview_memo_formatted` | TEXT | 面談メモ(整形済) | |
| `current_income` | VARCHAR(255) | 現在年収 | |
| `desired_income` | VARCHAR(255) | 希望年収 | |
| `job_search_status` | TEXT | 転職活動状況 | |
| `desired_job_type` | TEXT | 希望職種 | |
| `desired_work_location` | TEXT | 希望勤務地 | |
| `reason_for_change` | TEXT | 転職理由 | |
| `strengths` | TEXT | 強み | |
| `personality` | TEXT | 性格 | |
| `job_change_axis` | TEXT | 転職軸 | |
| `job_change_timing` | TEXT | 転職時期 | |
| `future_vision` | TEXT | 将来のビジョン・叶えたいこと | |
| `recommendation_text` | TEXT | 推薦文 | |
| `other_selection_status` | TEXT | 他社選考状態 | |
| `desired_interview_dates` | TEXT | 面接希望日 | |
| `mandatory_interview_items` | TEXT | 新規面談マスト項目 | |
| `shared_interview_date` | TEXT | 共有面談実施日 | |
| `carrier_summary_sheet_url` | TEXT | キャリアサマリーシートURL | |
| `resume_url` | TEXT | 履歴書URL | |
| `created_at` | TIMESTAMPTZ | 作成日時 | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | 更新日時 | DEFAULT NOW() |

---

## 11. candidate_applications (候補者応募テーブル)

| カラム名 | 型 | 説明 | 備考 |
|---|---|---|---|
| `id` | BIGSERIAL | プライマリキー | 自動採番 |
| `candidate_id` | BIGINT | 候補者ID | FK → candidates(id), ON DELETE CASCADE |
| `client_id` | BIGINT | 企業ID | FK → clients(id), ON DELETE CASCADE |
| `job_title` | VARCHAR(255) | 求人タイトル | |
| `work_mode` | VARCHAR(255) | 勤務形態 | |
| `fee_rate` | VARCHAR(255) | 手数料率 | |
| `selection_status` | VARCHAR(255) | 選考ステータス | |
| `recommendation_at` | TIMESTAMPTZ | 推薦日時 | |
| `first_interview_set_at` | TIMESTAMPTZ | 一次面接調整日時 | |
| `first_interview_at` | TIMESTAMPTZ | 一次面接日時 | |
| `second_interview_set_at` | TIMESTAMPTZ | 二次面接調整日時 | |
| `second_interview_at` | TIMESTAMPTZ | 二次面接日時 | |
| `final_interview_set_at` | TIMESTAMPTZ | 最終面接調整日時 | |
| `final_interview_at` | TIMESTAMPTZ | 最終面接日時 | |
| `offer_at` | TIMESTAMPTZ | 内定日時 | |
| `offer_accepted_at` | TIMESTAMPTZ | 内定承諾日時 | |
| `joined_at` | TIMESTAMPTZ | 入社日時 | |
| `pre_join_decline_at` | TIMESTAMPTZ | 入社前辞退日時 | |
| `post_join_quit_at` | TIMESTAMPTZ | 入社後退職日時 | |
| `selection_note` | TEXT | 選考備考 | |
| `created_at` | TIMESTAMPTZ | 作成日時 | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | 更新日時 | DEFAULT NOW() |

---

## 12. placements (成約テーブル)

| カラム名 | 型 | 説明 | 備考 |
|---|---|---|---|
| `id` | BIGSERIAL | プライマリキー | 自動採番 |
| `candidate_application_id` | BIGINT | 応募ID | FK → candidate_applications(id), ON DELETE CASCADE |
| `fee_amount` | NUMERIC | 手数料額 | |
| `refund_amount` | NUMERIC | 返金額 | |
| `order_reported` | BOOLEAN | 受注報告フラグ | DEFAULT FALSE |
| `refund_reported` | BOOLEAN | 返金報告フラグ | DEFAULT FALSE |
| `created_at` | TIMESTAMPTZ | 作成日時 | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | 更新日時 | DEFAULT NOW() |

---

## 13. kintone_sync_cursors (Kintone同期カーソルテーブル)

| カラム名 | 型 | 説明 | 備考 |
|---|---|---|---|
| `id` | BIGSERIAL | プライマリキー | 自動採番 |
| `system_name` | VARCHAR(255) | システム名 | NOT NULL |
| `last_kintone_record_id_synced` | INTEGER | 最終同期レコードID | |
| `last_sync_started_at` | TIMESTAMPTZ | 最終同期開始日時 | |
| `last_sync_finished_at` | TIMESTAMPTZ | 最終同期終了日時 | |
| `updated_at` | TIMESTAMPTZ | 更新日時 | DEFAULT NOW() |

---

## 14. kintone_sync_runs (Kintone同期実行履歴テーブル)

| カラム名 | 型 | 説明 | 備考 |
|---|---|---|---|
| `id` | BIGSERIAL | プライマリキー | 自動採番 |
| `system_name` | VARCHAR(255) | システム名 | NOT NULL |
| `started_at` | TIMESTAMPTZ | 開始日時 | |
| `finished_at` | TIMESTAMPTZ | 終了日時 | |
| `inserted_count` | INTEGER | 挿入件数 | |
| `updated_count` | INTEGER | 更新件数 | |
| `skipped_count` | INTEGER | スキップ件数 | |
| `error_count` | INTEGER | エラー件数 | |
| `error_summary` | TEXT | エラー概要 | |
| `created_at` | TIMESTAMPTZ | 作成日時 | DEFAULT NOW() |

---

## 15. stamps (スタンプテーブル)

| カラム名 | 型 | 説明 | 備考 |
|---|---|---|---|
| `id` | BIGSERIAL | プライマリキー | 自動採番 |
| `user_id` | INTEGER | 送信者ユーザーID | |
| `sent_to_user_id` | UUID | 送信先ユーザーID | |
| `read_at` | TIMESTAMPTZ | 既読日時 | |
| `message` | TEXT | メッセージ | |
| `created_at` | TIMESTAMPTZ | 作成日時 | DEFAULT NOW() |

---

## 16. stamp_reads (スタンプ既読テーブル)

| カラム名 | 型 | 説明 | 備考 |
|---|---|---|---|
| `id` | BIGSERIAL | プライマリキー | 自動採番 |
| `stamp_id` | BIGINT | スタンプID | FK → stamps(id), ON DELETE CASCADE |
| `user_id` | INTEGER | ユーザーID | |
| `read_at` | TIMESTAMPTZ | 既読日時 | |
| `created_at` | TIMESTAMPTZ | 作成日時 | DEFAULT NOW() |

---

## インデックス一覧

| インデックス名 | テーブル | カラム | 種類 |
|---|---|---|---|
| `idx_cand_registered` | candidates | registered_date | B-tree |
| `idx_cand_phase` | candidates | phase | B-tree |
| `idx_cand_advisor` | candidates | advisor_name | B-tree |
| `idx_cand_source` | candidates | source | B-tree |
| `idx_cand_detail_gin` | candidates | detail | GIN |
| `idx_meeting_plans_candidate` | meeting_plans | candidate_id | B-tree |
| `idx_resume_docs_candidate` | resume_documents | candidate_id | B-tree |
| `idx_selection_progress_candidate` | selection_progress | candidate_id | B-tree |

---

## 同期ロジック (Smart Sync)

以下のカラムは「DBに既に値がある場合、Kintoneで上書きしない」という条件付き更新（COALESCE）が適用されています。

- `cs_name` (担当CS)
- `partner_name` (担当パートナー)
