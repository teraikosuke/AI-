# DBスキーマ（最新版）

生成日時: 2026-02-07 15:50:54 JST
参照先: server/.env の DATABASE_URL（host: localhost）
スキーマ: public

テーブル数: 31

## テーブル一覧

### ad_detail
用途: 広告媒体の契約・費用詳細を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('ad_detail_id_seq'::regclass) |
| media_name | text | YES |  |
| contract_start_date | date | YES |  |
| contract_end_date | date | YES |  |
| contract_amount | integer | YES |  |
| amount_period | text | YES |  |
| contract_method | text | YES |  |
| renewal_terms | text | YES |  |
| memo | text | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

主キー: id

インデックス:
- ad_detail_pkey: CREATE UNIQUE INDEX ad_detail_pkey ON public.ad_detail USING btree (id)

---

### ats_settings
用途: ATS外部連携設定（Kintone等）を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | smallint | NO | 1 |
| kintone_subdomain | text | NO |  |
| kintone_app_id | text | NO |  |
| kintone_api_token | text | NO |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

主キー: id

インデックス:
- ats_settings_pkey: CREATE UNIQUE INDEX ats_settings_pkey ON public.ats_settings USING btree (id)

---

### candidate_app_profile
用途: 候補者プロフィール拡張（国籍・日本語レベル等）を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('candidate_app_profile_id_seq1'::regclass) |
| candidate_id | bigint | NO |  |
| nationality | character varying(255) | YES |  |
| japanese_level | character varying(255) | YES |  |
| address_pref | character varying(255) | YES |  |
| address_city | character varying(255) | YES |  |
| address_detail | character varying(255) | YES |  |
| final_education | character varying(255) | YES |  |
| work_experience | text | YES |  |
| interview_memo_formatted | text | YES |  |
| current_income | character varying(255) | YES |  |
| desired_income | character varying(255) | YES |  |
| job_search_status | text | YES |  |
| desired_job_type | text | YES |  |
| desired_work_location | text | YES |  |
| reason_for_change | text | YES |  |
| strengths | text | YES |  |
| personality | text | YES |  |
| job_change_axis | text | YES |  |
| job_change_timing | text | YES |  |
| recommendation_text | text | YES |  |
| other_selection_status | text | YES |  |
| desired_interview_dates | text | YES |  |
| future_vision | text | YES |  |
| mandatory_interview_items | text | YES |  |
| shared_interview_date | text | YES |  |
| carrier_summary_sheet_url | text | YES |  |
| resume_url | text | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

主キー: id

外部キー:
- candidate_app_profile_candidate_id_fkey1: candidate_id -> candidates.id

インデックス:
- candidate_app_profile_candidate_id_key1: CREATE UNIQUE INDEX candidate_app_profile_candidate_id_key1 ON public.candidate_app_profile USING btree (candidate_id)
- candidate_app_profile_pkey1: CREATE UNIQUE INDEX candidate_app_profile_pkey1 ON public.candidate_app_profile USING btree (id)

---

### candidate_app_profile_deprecated
用途: 旧プロフィール構造の退避テーブル。互換維持のため残置。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('candidate_app_profile_id_seq'::regclass) |
| candidate_id | bigint | NO |  |
| nationality | character varying(255) | YES |  |
| japanese_level | character varying(255) | YES |  |
| address_pref | character varying(255) | YES |  |
| address_city | character varying(255) | YES |  |
| address_detail | character varying(255) | YES |  |
| final_education | character varying(255) | YES |  |
| work_experience | text | YES |  |
| interview_memo_formatted | text | YES |  |
| current_income | character varying(255) | YES |  |
| desired_income | character varying(255) | YES |  |
| job_search_status | text | YES |  |
| desired_job_type | text | YES |  |
| desired_work_location | text | YES |  |
| reason_for_change | text | YES |  |
| strengths | text | YES |  |
| personality | text | YES |  |
| carrier_summary_sheet_url | text | YES |  |
| resume_url | text | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| job_change_axis | text | YES |  |
| job_change_timing | text | YES |  |
| future_vision | text | YES |  |
| recommendation_text | text | YES |  |
| other_selection_status | text | YES |  |
| desired_interview_dates | text | YES |  |
| mandatory_interview_items | text | YES |  |
| shared_interview_date | text | YES |  |

主キー: id

外部キー:
- candidate_app_profile_candidate_id_fkey: candidate_id -> candidates.id

インデックス:
- candidate_app_profile_candidate_id_key: CREATE UNIQUE INDEX candidate_app_profile_candidate_id_key ON public.candidate_app_profile_deprecated USING btree (candidate_id)
- candidate_app_profile_pkey: CREATE UNIQUE INDEX candidate_app_profile_pkey ON public.candidate_app_profile_deprecated USING btree (id)

---

### candidate_applications
用途: 候補者ごとの応募/選考プロセス（企業別）を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('candidate_applications_id_seq'::regclass) |
| candidate_id | bigint | NO |  |
| client_id | bigint | NO |  |
| job_title | character varying(255) | YES |  |
| work_mode | character varying(255) | YES |  |
| fee_rate | character varying(255) | YES |  |
| selection_status | character varying(255) | YES |  |
| recommendation_at | timestamp with time zone | YES |  |
| first_interview_set_at | timestamp with time zone | YES |  |
| first_interview_at | timestamp with time zone | YES |  |
| second_interview_set_at | timestamp with time zone | YES |  |
| second_interview_at | timestamp with time zone | YES |  |
| final_interview_set_at | timestamp with time zone | YES |  |
| final_interview_at | timestamp with time zone | YES |  |
| offer_at | timestamp with time zone | YES |  |
| offer_accepted_at | timestamp with time zone | YES |  |
| joined_at | timestamp with time zone | YES |  |
| pre_join_decline_at | timestamp with time zone | YES |  |
| post_join_quit_at | timestamp with time zone | YES |  |
| selection_note | text | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| kintone_sub_id | text | YES |  |
| is_quit_30 | boolean | YES |  |
| proposal_date | timestamp with time zone | YES |  |
| closing_plan_date | date | YES |  |
| fee_amount | text | YES |  |
| declined_reason | text | YES |  |
| early_turnover_reason | text | YES |  |

主キー: id

外部キー:
- candidate_applications_candidate_id_fkey: candidate_id -> candidates.id
- candidate_applications_client_id_fkey: client_id -> clients.id

インデックス:
- candidate_applications_pkey: CREATE UNIQUE INDEX candidate_applications_pkey ON public.candidate_applications USING btree (id)

---

### candidate_educations
用途: 候補者の学歴履歴を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('candidate_educations_id_seq'::regclass) |
| candidate_id | bigint | NO |  |
| school_name | text | YES |  |
| department | text | YES |  |
| admission_date | date | YES |  |
| graduation_date | date | YES |  |
| graduation_status | text | YES |  |
| sequence | integer | YES | 0 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

主キー: id

外部キー:
- candidate_educations_candidate_id_fkey: candidate_id -> candidates.id

インデックス:
- candidate_educations_pkey: CREATE UNIQUE INDEX candidate_educations_pkey ON public.candidate_educations USING btree (id)

---

### candidate_tasks
用途: 候補者ごとの次回アクション・タスクを保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('candidate_tasks_id_seq'::regclass) |
| candidate_id | bigint | YES |  |
| action_date | date | YES |  |
| action_note | text | YES |  |
| is_completed | boolean | YES |  |
| completed_at | timestamp with time zone | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

主キー: id

外部キー:
- candidate_tasks_candidate_id_fkey: candidate_id -> candidates.id

インデックス:
- candidate_tasks_pkey: CREATE UNIQUE INDEX candidate_tasks_pkey ON public.candidate_tasks USING btree (id)

---

### candidate_work_histories
用途: 候補者の職歴履歴を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('candidate_work_histories_id_seq'::regclass) |
| candidate_id | bigint | NO |  |
| company_name | text | YES |  |
| department | text | YES |  |
| position | text | YES |  |
| join_date | date | YES |  |
| leave_date | date | YES |  |
| is_current | boolean | YES | false |
| job_description | text | YES |  |
| sequence | integer | YES | 0 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

主キー: id

外部キー:
- candidate_work_histories_candidate_id_fkey: candidate_id -> candidates.id

インデックス:
- candidate_work_histories_pkey: CREATE UNIQUE INDEX candidate_work_histories_pkey ON public.candidate_work_histories USING btree (id)

---

### candidates
用途: 候補者の基本情報・進捗・Kintone同期情報を保持する中核テーブル。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('candidates_id_seq'::regclass) |
| kintone_record_id | integer | YES |  |
| candidate_code | text | YES |  |
| candidate_name | text | NO |  |
| candidate_kana | text | YES |  |
| company_name | text | YES |  |
| job_name | text | YES |  |
| work_location | text | YES |  |
| advisor_name | text | YES |  |
| caller_name | text | YES |  |
| partner_name | text | YES |  |
| introduction_chance | text | YES |  |
| phase | text | YES |  |
| registered_date | date | YES |  |
| registered_at | timestamp with time zone | YES |  |
| candidate_updated_at | timestamp with time zone | YES |  |
| media_registered_at | date | YES |  |
| source | text | YES |  |
| phone | text | YES |  |
| email | text | YES |  |
| birthday | date | YES |  |
| age | integer | YES |  |
| gender | text | YES |  |
| education | text | YES |  |
| postal_code | text | YES |  |
| address | text | YES |  |
| city | text | YES |  |
| contact_time | text | YES |  |
| remarks | text | YES |  |
| memo | text | YES |  |
| memo_detail | text | YES |  |
| hearing_memo | text | YES |  |
| resume_status | text | YES |  |
| meeting_video_url | text | YES |  |
| resume_for_send | text | YES |  |
| work_history_for_send | text | YES |  |
| employment_status | text | YES |  |
| first_contact_planned_at | date | YES |  |
| first_contact_at | date | YES |  |
| call_date | date | YES |  |
| schedule_confirmed_at | date | YES |  |
| recommendation_date | date | YES |  |
| valid_application | boolean | YES | false |
| phone_connected | boolean | YES | false |
| sms_sent | boolean | YES | false |
| sms_confirmed | boolean | YES | false |
| attendance_confirmed | boolean | YES | false |
| next_action_date | date | YES |  |
| final_result | text | YES |  |
| order_amount | text | YES |  |
| after_acceptance_job_type | text | YES |  |
| line_reported | boolean | YES | false |
| personal_sheet_reflected | boolean | YES | false |
| invoice_sent | boolean | YES | false |
| cs_valid_confirmed | boolean | YES | false |
| cs_connect_confirmed | boolean | YES | false |
| refund_retirement_date | date | YES |  |
| refund_amount | text | YES |  |
| refund_report | text | YES |  |
| cs_call_attempt1 | boolean | YES | false |
| cs_call_attempt2 | boolean | YES | false |
| cs_call_attempt3 | boolean | YES | false |
| cs_call_attempt4 | boolean | YES | false |
| cs_call_attempt5 | boolean | YES | false |
| cs_call_attempt6 | boolean | YES | false |
| cs_call_attempt7 | boolean | YES | false |
| cs_call_attempt8 | boolean | YES | false |
| cs_call_attempt9 | boolean | YES | false |
| cs_call_attempt10 | boolean | YES | false |
| detail | jsonb | YES | '{}'::jsonb |
| kintone_updated_time | timestamp with time zone | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| cs_user_id | uuid | YES |  |
| partner_user_id | uuid | YES |  |
| nationality | text | YES |  |
| japanese_level | text | YES |  |
| final_education_detail | text | YES |  |
| work_experience | text | YES |  |
| current_income | text | YES |  |
| desired_income | text | YES |  |
| job_search_status | text | YES |  |
| desired_job_type | text | YES |  |
| desired_work_location | text | YES |  |
| reason_for_change | text | YES |  |
| strengths | text | YES |  |
| personality | text | YES |  |
| job_change_axis | text | YES |  |
| job_change_timing | text | YES |  |
| future_vision | text | YES |  |
| recommendation_text | text | YES |  |
| other_selection_status | text | YES |  |
| desired_interview_dates | text | YES |  |
| mandatory_interview_items | text | YES |  |
| shared_interview_date | text | YES |  |
| carrier_summary_sheet_url | text | YES |  |
| resume_url | text | YES |  |
| first_interview_note | text | YES |  |
| career_motivation | text | YES |  |
| new_status | text | YES |  |
| first_schedule_fixed_at | timestamp with time zone | YES |  |
| first_interview_attended | boolean | YES |  |
| is_connected | boolean | YES |  |
| first_call_at | timestamp with time zone | YES |  |
| skills | text | YES |  |
| application_note | text | YES |  |
| next_action_content | text | YES |  |
| cs_name | text | YES |  |

主キー: id

外部キー:
- candidates_cs_user_id_fkey: cs_user_id -> users.id
- candidates_partner_user_id_fkey: partner_user_id -> users.id

インデックス:
- candidates_kintone_record_id_key: CREATE UNIQUE INDEX candidates_kintone_record_id_key ON public.candidates USING btree (kintone_record_id)
- candidates_pkey: CREATE UNIQUE INDEX candidates_pkey ON public.candidates USING btree (id)
- idx_cand_advisor: CREATE INDEX idx_cand_advisor ON public.candidates USING btree (advisor_name)
- idx_cand_cs_user: CREATE INDEX idx_cand_cs_user ON public.candidates USING btree (cs_user_id)
- idx_cand_detail_gin: CREATE INDEX idx_cand_detail_gin ON public.candidates USING gin (detail)
- idx_cand_partner_user: CREATE INDEX idx_cand_partner_user ON public.candidates USING btree (partner_user_id)
- idx_cand_phase: CREATE INDEX idx_cand_phase ON public.candidates USING btree (phase)
- idx_cand_registered: CREATE INDEX idx_cand_registered ON public.candidates USING btree (registered_date)
- idx_cand_source: CREATE INDEX idx_cand_source ON public.candidates USING btree (source)

---

### clients
用途: 紹介先企業マスタ（契約・要件・担当連絡先）を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('clients_id_seq'::regclass) |
| name | character varying(255) | NO |  |
| industry | character varying(255) | YES |  |
| location | character varying(255) | YES |  |
| employees_count | integer | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| salary_range | text | YES |  |
| job_categories | text | YES |  |
| planned_hires_count | integer | YES |  |
| fee_amount | integer | YES |  |
| salary_min | integer | YES |  |
| salary_max | integer | YES |  |
| must_qualifications | text[] | YES |  |
| nice_qualifications | text[] | YES |  |
| desired_locations | text[] | YES |  |
| personality_traits | text[] | YES |  |
| required_experience | text[] | YES |  |
| selection_note | text | YES |  |
| contact_name | text | YES |  |
| contact_email | text | YES |  |
| warranty_period | text | YES |  |
| fee_details | text | YES |  |
| contract_note | text | YES |  |

主キー: id

インデックス:
- clients_pkey: CREATE UNIQUE INDEX clients_pkey ON public.clients USING btree (id)

---

### goal_daily_targets
用途: 日次目標値を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('goal_daily_targets_id_seq'::regclass) |
| advisor_user_id | uuid | YES |  |
| period_id | text | YES |  |
| target_date | date | YES |  |
| targets | jsonb | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

主キー: id

外部キー:
- goal_daily_targets_advisor_user_id_fkey: advisor_user_id -> users.id

インデックス:
- goal_daily_targets_pkey: CREATE UNIQUE INDEX goal_daily_targets_pkey ON public.goal_daily_targets USING btree (id)

---

### goal_settings
用途: 目標設定の期間・対象設定を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | smallint | NO | 1 |
| evaluation_rule_type | text | YES |  |
| evaluation_rule_options | jsonb | YES |  |
| updated_at | timestamp with time zone | NO | now() |

主キー: id

インデックス:
- goal_settings_pkey: CREATE UNIQUE INDEX goal_settings_pkey ON public.goal_settings USING btree (id)

---

### goal_targets
用途: 目標値（期間単位）を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('goal_targets_id_seq'::regclass) |
| scope | text | YES |  |
| advisor_user_id | uuid | YES |  |
| period_id | text | YES |  |
| targets | jsonb | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

主キー: id

外部キー:
- goal_targets_advisor_user_id_fkey: advisor_user_id -> users.id

インデックス:
- goal_targets_pkey: CREATE UNIQUE INDEX goal_targets_pkey ON public.goal_targets USING btree (id)

---

### kintone_sync_cursors
用途: Kintone同期カーソル（最終同期位置）を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('kintone_sync_cursors_id_seq'::regclass) |
| system_name | character varying(255) | NO |  |
| last_kintone_record_id_synced | integer | YES |  |
| last_sync_started_at | timestamp with time zone | YES |  |
| last_sync_finished_at | timestamp with time zone | YES |  |
| updated_at | timestamp with time zone | NO | now() |

主キー: id

インデックス:
- kintone_sync_cursors_pkey: CREATE UNIQUE INDEX kintone_sync_cursors_pkey ON public.kintone_sync_cursors USING btree (id)

---

### kintone_sync_runs
用途: Kintone同期ジョブの実行履歴を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('kintone_sync_runs_id_seq'::regclass) |
| system_name | character varying(255) | NO |  |
| started_at | timestamp with time zone | YES |  |
| finished_at | timestamp with time zone | YES |  |
| inserted_count | integer | YES |  |
| updated_count | integer | YES |  |
| skipped_count | integer | YES |  |
| error_count | integer | YES |  |
| error_summary | text | YES |  |
| created_at | timestamp with time zone | NO | now() |

主キー: id

インデックス:
- kintone_sync_runs_pkey: CREATE UNIQUE INDEX kintone_sync_runs_pkey ON public.kintone_sync_runs USING btree (id)

---

### kpi_targets
用途: KPI目標値設定を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('kpi_targets_id_seq'::regclass) |
| target_month | text | YES |  |
| metric_key | text | YES |  |
| target_value | integer | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

主キー: id

インデックス:
- kpi_targets_pkey: CREATE UNIQUE INDEX kpi_targets_pkey ON public.kpi_targets USING btree (id)

---

### meeting_plans
用途: 面接回次ごとの予定・出席結果を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('meeting_plans_id_seq'::regclass) |
| candidate_id | bigint | NO |  |
| sequence | integer | NO |  |
| planned_date | date | YES |  |
| attendance | boolean | YES | false |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

主キー: id

外部キー:
- meeting_plans_candidate_id_fkey: candidate_id -> candidates.id

インデックス:
- idx_meeting_plans_candidate: CREATE INDEX idx_meeting_plans_candidate ON public.meeting_plans USING btree (candidate_id)
- meeting_plans_pkey: CREATE UNIQUE INDEX meeting_plans_pkey ON public.meeting_plans USING btree (id)

---

### member_requests
用途: メンバー申請/依頼データを保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('member_requests_id_seq'::regclass) |
| name | text | YES |  |
| email | text | YES |  |
| role | text | YES |  |
| password_hash | text | YES |  |
| is_admin | boolean | YES |  |
| status | text | YES |  |
| approval_token | text | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

主キー: id

インデックス:
- member_requests_pkey: CREATE UNIQUE INDEX member_requests_pkey ON public.member_requests USING btree (id)

---

### ms_daily_targets
用途: MS向け日次目標値を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('ms_daily_targets_id_seq'::regclass) |
| scope | text | YES |  |
| department_key | text | YES |  |
| metric_key | text | YES |  |
| advisor_user_id | uuid | YES |  |
| period_id | text | YES |  |
| target_date | date | YES |  |
| target_value | numeric | YES |  |

主キー: id

外部キー:
- ms_daily_targets_advisor_user_id_fkey: advisor_user_id -> users.id

インデックス:
- ms_daily_targets_pkey: CREATE UNIQUE INDEX ms_daily_targets_pkey ON public.ms_daily_targets USING btree (id)

---

### ms_period_targets
用途: MS向け期間目標値を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('ms_period_targets_id_seq'::regclass) |
| scope | text | YES |  |
| department_key | text | YES |  |
| metric_key | text | YES |  |
| advisor_user_id | uuid | YES |  |
| period_id | text | YES |  |
| target_total | numeric | YES |  |

主キー: id

外部キー:
- ms_period_targets_advisor_user_id_fkey: advisor_user_id -> users.id

インデックス:
- ms_period_targets_pkey: CREATE UNIQUE INDEX ms_period_targets_pkey ON public.ms_period_targets USING btree (id)

---

### placements
用途: 成約/返金関連の実績情報を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('placements_id_seq'::regclass) |
| candidate_application_id | bigint | NO |  |
| fee_amount | numeric | YES |  |
| refund_amount | numeric | YES |  |
| order_reported | boolean | YES | false |
| refund_reported | boolean | YES | false |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| order_date | date | YES |  |
| withdraw_date | date | YES |  |

主キー: id

外部キー:
- placements_candidate_application_id_fkey: candidate_application_id -> candidate_applications.id

インデックス:
- placements_pkey: CREATE UNIQUE INDEX placements_pkey ON public.placements USING btree (id)

---

### resume_documents
用途: 候補者に紐づく提出書類メタ情報を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('resume_documents_id_seq'::regclass) |
| candidate_id | bigint | NO |  |
| label | text | YES |  |
| document_value | text | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

主キー: id

外部キー:
- resume_documents_candidate_id_fkey: candidate_id -> candidates.id

インデックス:
- idx_resume_docs_candidate: CREATE INDEX idx_resume_docs_candidate ON public.resume_documents USING btree (candidate_id)
- resume_documents_pkey: CREATE UNIQUE INDEX resume_documents_pkey ON public.resume_documents USING btree (id)

---

### screening_rules
用途: 有効応募判定ルール（年齢/国籍/JLPT）を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('screening_rules_id_seq'::regclass) |
| min_age | integer | YES |  |
| max_age | integer | YES |  |
| allowed_jlpt_levels | text[] | YES |  |
| target_nationalities | text | YES |  |
| updated_at | timestamp with time zone | NO | now() |

主キー: id

インデックス:
- screening_rules_pkey: CREATE UNIQUE INDEX screening_rules_pkey ON public.screening_rules USING btree (id)

---

### selection_progress
用途: 選考進捗の時系列（企業名・日付・状態）を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('selection_progress_id_seq'::regclass) |
| candidate_id | bigint | NO |  |
| company_name | text | YES |  |
| application_route | text | YES |  |
| recommendation_date | date | YES |  |
| interview_schedule_date | date | YES |  |
| interview_date | date | YES |  |
| offer_date | date | YES |  |
| closing_plan_date | date | YES |  |
| offer_accept_date | date | YES |  |
| joining_date | date | YES |  |
| pre_join_quit_date | date | YES |  |
| introduction_fee | text | YES |  |
| status | text | YES |  |
| note | text | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

主キー: id

外部キー:
- selection_progress_candidate_id_fkey: candidate_id -> candidates.id

インデックス:
- idx_selection_progress_candidate: CREATE INDEX idx_selection_progress_candidate ON public.selection_progress USING btree (candidate_id)
- selection_progress_pkey: CREATE UNIQUE INDEX selection_progress_pkey ON public.selection_progress USING btree (id)

---

### stamp_reads
用途: スタンプ既読情報を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('stamp_reads_id_seq'::regclass) |
| stamp_id | bigint | NO |  |
| user_id | integer | YES |  |
| read_at | timestamp with time zone | YES |  |
| created_at | timestamp with time zone | NO | now() |

主キー: id

外部キー:
- stamp_reads_stamp_id_fkey: stamp_id -> stamps.id

インデックス:
- stamp_reads_pkey: CREATE UNIQUE INDEX stamp_reads_pkey ON public.stamp_reads USING btree (id)

---

### stamps
用途: スタンプ/メッセージ送信データを保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('stamps_id_seq'::regclass) |
| user_id | integer | YES |  |
| sent_to_user_id | uuid | YES |  |
| read_at | timestamp with time zone | YES |  |
| message | text | YES |  |
| created_at | timestamp with time zone | NO | now() |

主キー: id

インデックス:
- stamps_pkey: CREATE UNIQUE INDEX stamps_pkey ON public.stamps USING btree (id)

---

### sync_state
用途: データ同期元ごとの最終同期時刻を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| source | text | NO |  |
| last_synced_at | timestamp with time zone | NO | '2000-01-01 09:00:00+09'::timestamp with time zone |

主キー: source

インデックス:
- sync_state_pkey: CREATE UNIQUE INDEX sync_state_pkey ON public.sync_state USING btree (source)

---

### teleapo
用途: テレアポ活動ログを保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('teleapo_id_seq'::regclass) |
| candidate_id | bigint | YES |  |
| call_no | integer | YES |  |
| called_at | timestamp with time zone | YES |  |
| route | text | YES |  |
| result | text | YES |  |
| caller_user_id | uuid | YES |  |
| memo | text | YES |  |
| created_at | timestamp with time zone | NO | now() |

主キー: id

外部キー:
- teleapo_caller_user_id_fkey: caller_user_id -> users.id
- teleapo_candidate_id_fkey: candidate_id -> candidates.id

インデックス:
- teleapo_pkey: CREATE UNIQUE INDEX teleapo_pkey ON public.teleapo USING btree (id)

---

### user_important_metrics
用途: ユーザー別の重要指標設定/集計用データを保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('user_important_metrics_id_seq'::regclass) |
| user_id | uuid | YES |  |
| department_key | text | YES |  |
| metric_key | text | YES |  |
| updated_at | timestamp with time zone | NO | now() |

主キー: id

外部キー:
- user_important_metrics_user_id_fkey: user_id -> users.id

インデックス:
- user_important_metrics_pkey: CREATE UNIQUE INDEX user_important_metrics_pkey ON public.user_important_metrics USING btree (id)

---

### user_profiles
用途: ユーザーの所属・役職・期間などのプロファイルを保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | bigint | NO | nextval('user_profiles_id_seq'::regclass) |
| user_id | uuid | NO |  |
| department | character varying(255) | YES |  |
| position | character varying(255) | YES |  |
| period_start_date | date | YES |  |
| period_end_date | date | YES |  |
| created_by | bigint | YES |  |
| updated_by | bigint | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

主キー: id

外部キー:
- user_profiles_user_id_fkey: user_id -> users.id

インデックス:
- user_profiles_pkey: CREATE UNIQUE INDEX user_profiles_pkey ON public.user_profiles USING btree (id)

---

### users
用途: ユーザーアカウント情報を保持。

| カラム | 型 | NULL許可 | デフォルト |
| --- | --- | --- | --- |
| id | uuid | NO | uuid_generate_v4() |
| email | character varying(255) | NO |  |
| name | character varying(255) | YES |  |
| email_verified_at | timestamp with time zone | YES |  |
| image | text | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| role | text | YES |  |
| password_hash | text | YES |  |
| is_admin | boolean | YES | false |

主キー: id

インデックス:
- users_pkey: CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)

---

