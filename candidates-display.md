# 候補者管理画面: 表示項目とDB対応（現行構造維持）

## 方針
- テーブル構造（candidates / candidate_applications / teleapo_logs など）は維持
- カラム名は必要に応じて変更可
- SMS送信/通電/架電回数は teleapo_logs 集計を正とする
- フェーズは候補者・企業進捗・テレアポログから派生する

## 使用テーブルとカラム（最小）

### candidates
- 登録: `created_at`, `advisor_user_id`, `partner_user_id`, `active_flag`
- 基本: `name`, `name_kana`, `gender`, `birth_date`, `age`, `final_education`
- 連絡: `phone`, `email`
- 住所: `address_pref`, `address_city`, `address_detail`
- 収入: `current_income`, `desired_income`
- 面談/希望: `employment_status`, `career_motivation`, `first_interview_note`, `note`
- 日程: `first_contact_planned_at`, `first_schedule_fixed_at`, `first_interview_attended`
- 進捗補助: `new_status`（派生フェーズの上書き用途があるなら残す）

### candidate_applications
- 企業/求人: `client_id`, `job_title`, `job_location`
- 進捗: `stage_current`, `apply_route`, `media_name`
- 日付: `recommended_at`, `first_interview_set_at`, `first_interview_at`,
  `offer_date`, `offer_accept_date`, `join_date`,
  `pre_join_withdraw_date`, `post_join_quit_date`
- 金額: `fee_amount`, `refund_amount`

### teleapo_logs
- CS/通電: `call_no`, `called_at`, `result`, `caller_user_id`, `memo`

### placements（レガシー運用にする場合のみ）
- 金額: `fee_amount`, `refund_amount`, `quit_date`

### 参照
- users: `id`, `name`（担当者/通電実施者名）
- clients: `id`, `name`（企業名）
- ad_entries: `candidate_id`, `apply_route`, `registered_at`（流入媒体/登録日時）

## 画面表示項目（DB対応）

### 登録情報
| 画面項目 | DBカラム | 備考 |
| --- | --- | --- |
| 登録日時 | `candidates.created_at` |  |
| 担当者 | `candidates.advisor_user_id` → `users.name` | JOIN |
| 担当パートナー | `candidates.partner_user_id` → `users.name` | JOIN |
| 有効応募 | `candidates.active_flag` |  |

### 基本情報
| 画面項目 | DBカラム | 備考 |
| --- | --- | --- |
| 名前/カナ | `candidates.name`, `candidates.name_kana` |  |
| 性別/誕生日/年齢 | `gender`, `birth_date`, `age` | 年齢は派生でも可 |
| 最終学歴 | `final_education` |  |
| 電話/メール | `phone`, `email` |  |
| 住所 | `address_pref` + `address_city` + `address_detail` | 連結表示 |
| 現在の年収 | `current_income` |  |

### 面談メモ / 希望条件
| 画面項目 | DBカラム | 備考 |
| --- | --- | --- |
| 着座確認 | `first_interview_attended` |  |
| 勤務ステータス | `employment_status` |  |
| 面談メモ | `first_interview_note` | 長文は `note` でも可 |
| 希望年収 | `desired_income` |  |
| モチベーション | `career_motivation` |  |
| 希望勤務地 | 運用決めが必要 | 例: `other_process_status` を転用 |

### CS項目（teleapo_logs 集計）
| 画面項目 | DBカラム | 備考 |
| --- | --- | --- |
| SMS送信 | teleapo_logs.result | `result='SMS送信'` を判定 |
| 架電回数 | teleapo_logs.call_no | `MAX(call_no)` |
| 通電 | teleapo_logs.result | `result='通電'` の有無 |
| 通電日 | teleapo_logs.called_at | `MAX(called_at)` where 通電 |
| 設定日 | `candidates.first_schedule_fixed_at` |  |
| 新規接触予定日 | `candidates.first_contact_planned_at` |  |

### クリック詳細（テレアポログ一覧）
| 画面項目 | DBカラム | 備考 |
| --- | --- | --- |
| 架電回数 | `teleapo_logs.call_no` |  |
| 担当者 | `teleapo_logs.caller_user_id` → `users.name` | JOIN |
| メモ | `teleapo_logs.memo` |  |
| 日時 | `teleapo_logs.called_at` |  |

### 企業ごとの進捗（candidate_applications）
| 画面項目 | DBカラム | 備考 |
| --- | --- | --- |
| 受験企業名 | `candidate_applications.client_id` → `clients.name` | JOIN |
| 職種/勤務地 | `job_title`, `job_location` |  |
| 応募経路 | `apply_route` / `media_name` |  |
| フェーズ | `stage_current` |  |
| 推薦日 | `recommended_at` |  |
| 面接設定日 | `first_interview_set_at` |  |
| 面接日 | `first_interview_at` |  |
| 内定日 | `offer_date` |  |
| 内定承諾日 | `offer_accept_date` |  |
| 入社日 | `join_date` |  |
| 入社前辞退日 | `pre_join_withdraw_date` |  |
| 内定後退社日 | `post_join_quit_date` |  |

### お金関係（candidate_applications）
| 画面項目 | DBカラム | 備考 |
| --- | --- | --- |
| 企業名 | `candidate_applications.client_id` → `clients.name` | JOIN |
| 入社承諾の金額 | `candidate_applications.fee_amount` |  |
| 退社返金額 | `candidate_applications.refund_amount` |  |
| 返金区分 | `pre_join_withdraw_date` / `post_join_quit_date` / `join_date` | 入社前 or 入社後n日 |

## フェーズ判定（派生ルール案）
優先順位は上から順に採用する。
1. `candidate_applications.join_date` → 入社
2. `candidate_applications.offer_accept_date` → 内定承諾
3. `candidate_applications.offer_date` → 内定
4. `candidate_applications.first_interview_at` → 面接
5. `candidate_applications.first_interview_set_at` → 面接設定
6. `teleapo_logs.result='通電'` → 通電
7. `teleapo_logs.result='SMS送信'` → SMS送信
8. `teleapo_logs.call_no > 0` → 架電中
9. それ以外 → 未接触
