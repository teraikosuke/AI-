CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS candidates (
  id BIGSERIAL PRIMARY KEY,
  kintone_record_id INTEGER UNIQUE,
  candidate_code TEXT,
  candidate_name TEXT NOT NULL,
  candidate_kana TEXT,
  company_name TEXT,
  job_name TEXT,
  work_location TEXT,
  cs_name TEXT,
  caller_name TEXT,
  partner_name TEXT,
  introduction_chance TEXT,
  phase TEXT,
  registered_date DATE,
  registered_at TIMESTAMPTZ,
  candidate_updated_at TIMESTAMPTZ,
  media_registered_at DATE,
  source TEXT,
  phone TEXT,
  email TEXT,
  birthday DATE,
  age INTEGER,
  gender TEXT,
  education TEXT,
  postal_code TEXT,
  address TEXT,
  city TEXT,
  contact_time TEXT,
  remarks TEXT,
  memo TEXT,
  memo_detail TEXT,
  hearing_memo TEXT,
  resume_status TEXT,
  meeting_video_url TEXT,
  resume_for_send TEXT,
  work_history_for_send TEXT,
  employment_status TEXT,
  first_contact_planned_at DATE,
  first_contact_at DATE,
  call_date DATE,
  schedule_confirmed_at DATE,
  recommendation_date DATE,
  valid_application BOOLEAN DEFAULT FALSE,
  phone_connected BOOLEAN DEFAULT FALSE,
  sms_sent BOOLEAN DEFAULT FALSE,
  sms_confirmed BOOLEAN DEFAULT FALSE,
  attendance_confirmed BOOLEAN DEFAULT FALSE,
  next_action_date DATE,
  next_action_content TEXT,
  final_result TEXT,
  order_amount TEXT,
  after_acceptance_job_type TEXT,
  line_reported BOOLEAN DEFAULT FALSE,
  personal_sheet_reflected BOOLEAN DEFAULT FALSE,
  invoice_sent BOOLEAN DEFAULT FALSE,
  cs_valid_confirmed BOOLEAN DEFAULT FALSE,
  cs_connect_confirmed BOOLEAN DEFAULT FALSE,
  refund_retirement_date DATE,
  refund_amount TEXT,
  refund_report TEXT,
  cs_call_attempt1 BOOLEAN DEFAULT FALSE,
  cs_call_attempt2 BOOLEAN DEFAULT FALSE,
  cs_call_attempt3 BOOLEAN DEFAULT FALSE,
  cs_call_attempt4 BOOLEAN DEFAULT FALSE,
  cs_call_attempt5 BOOLEAN DEFAULT FALSE,
  cs_call_attempt6 BOOLEAN DEFAULT FALSE,
  cs_call_attempt7 BOOLEAN DEFAULT FALSE,
  cs_call_attempt8 BOOLEAN DEFAULT FALSE,
  cs_call_attempt9 BOOLEAN DEFAULT FALSE,
  cs_call_attempt10 BOOLEAN DEFAULT FALSE,
  detail JSONB DEFAULT '{}'::jsonb,
  kintone_updated_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_plans (
  id BIGSERIAL PRIMARY KEY,
  candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  planned_date DATE,
  attendance BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resume_documents (
  id BIGSERIAL PRIMARY KEY,
  candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  label TEXT,
  document_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS selection_progress (
  id BIGSERIAL PRIMARY KEY,
  candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  company_name TEXT,
  application_route TEXT,
  recommendation_date DATE,
  interview_schedule_date DATE,
  interview_date DATE,
  offer_date DATE,
  closing_plan_date DATE,
  offer_accept_date DATE,
  joining_date DATE,
  pre_join_quit_date DATE,
  introduction_fee TEXT,
  status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_state (
  source TEXT PRIMARY KEY,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT '2000-01-01T00:00:00Z'
);

CREATE TABLE IF NOT EXISTS ats_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  kintone_subdomain TEXT NOT NULL,
  kintone_app_id TEXT NOT NULL,
  kintone_api_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  email_verified_at TIMESTAMPTZ,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department VARCHAR(255),
  position VARCHAR(255),
  period_start_date DATE,
  period_end_date DATE,
  created_by BIGINT,
  updated_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  industry VARCHAR(255),
  location VARCHAR(255),
  employees_count INTEGER,
  job_categories TEXT,
  planned_hires_count INTEGER,
  fee_amount INTEGER,
  salary_min INTEGER,
  salary_max INTEGER,
  must_qualifications TEXT[],
  nice_qualifications TEXT[],
  desired_locations TEXT[],
  personality_traits TEXT[],
  required_experience TEXT[],
  selection_note TEXT,
  contact_name TEXT,
  contact_email TEXT,
  warranty_period TEXT,
  fee_details TEXT,
  contract_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidate_app_profile (
  id BIGSERIAL PRIMARY KEY,
  candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  nationality VARCHAR(255),
  japanese_level VARCHAR(255),
  address_pref VARCHAR(255),
  address_city VARCHAR(255),
  address_detail VARCHAR(255),
  final_education VARCHAR(255),
  work_experience TEXT,
  interview_memo_formatted TEXT,
  current_income VARCHAR(255),
  desired_income VARCHAR(255),
  job_search_status TEXT,
  desired_job_type TEXT,
  desired_work_location TEXT,
  reason_for_change TEXT,
  strengths TEXT,
  personality TEXT,
  job_change_axis TEXT,
  job_change_timing TEXT,
  recommendation_text TEXT,
  other_selection_status TEXT,
  desired_interview_dates TEXT,
  future_vision TEXT,
  mandatory_interview_items TEXT,
  shared_interview_date TEXT,
  carrier_summary_sheet_url TEXT,
  resume_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (candidate_id)
);

CREATE TABLE IF NOT EXISTS candidate_applications (
  id BIGSERIAL PRIMARY KEY,
  candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  application_route TEXT,
  job_title VARCHAR(255),
  work_mode VARCHAR(255),
  fee_rate VARCHAR(255),
  selection_status VARCHAR(255),
  recommendation_at TIMESTAMPTZ,
  first_interview_set_at TIMESTAMPTZ,
  first_interview_at TIMESTAMPTZ,
  second_interview_set_at TIMESTAMPTZ,
  second_interview_at TIMESTAMPTZ,
  final_interview_set_at TIMESTAMPTZ,
  final_interview_at TIMESTAMPTZ,
  offer_at TIMESTAMPTZ,
  offer_accepted_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  pre_join_decline_at TIMESTAMPTZ,
  post_join_quit_at TIMESTAMPTZ,
  selection_note TEXT,
  fee_amount TEXT,
  closing_plan_date DATE,
  declined_reason TEXT,
  early_turnover_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS placements (
  id BIGSERIAL PRIMARY KEY,
  candidate_application_id BIGINT NOT NULL REFERENCES candidate_applications(id) ON DELETE CASCADE,
  fee_amount NUMERIC,
  refund_amount NUMERIC,
  order_reported BOOLEAN DEFAULT FALSE,
  refund_reported BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kintone_sync_cursors (
  id BIGSERIAL PRIMARY KEY,
  system_name VARCHAR(255) NOT NULL,
  last_kintone_record_id_synced INTEGER,
  last_sync_started_at TIMESTAMPTZ,
  last_sync_finished_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kintone_sync_runs (
  id BIGSERIAL PRIMARY KEY,
  system_name VARCHAR(255) NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  inserted_count INTEGER,
  updated_count INTEGER,
  skipped_count INTEGER,
  error_count INTEGER,
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stamps (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER,
  sent_to_user_id UUID,
  read_at TIMESTAMPTZ,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stamp_reads (
  id BIGSERIAL PRIMARY KEY,
  stamp_id BIGINT NOT NULL REFERENCES stamps(id) ON DELETE CASCADE,
  user_id INTEGER,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 学歴テーブル
CREATE TABLE IF NOT EXISTS candidate_educations (
  id BIGSERIAL PRIMARY KEY,
  candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  school_name TEXT,
  department TEXT,
  admission_date DATE,
  graduation_date DATE,
  graduation_status TEXT,
  sequence INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 職歴テーブル
CREATE TABLE IF NOT EXISTS candidate_work_histories (
  id BIGSERIAL PRIMARY KEY,
  candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  company_name TEXT,
  department TEXT,
  position TEXT,
  join_date DATE,
  leave_date DATE,
  is_current BOOLEAN DEFAULT FALSE,
  job_description TEXT,
  sequence INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cand_registered ON candidates (registered_date);
CREATE INDEX IF NOT EXISTS idx_cand_phase ON candidates (phase);
CREATE INDEX IF NOT EXISTS idx_cand_advisor ON candidates (advisor_name);
CREATE INDEX IF NOT EXISTS idx_cand_source ON candidates (source);
CREATE INDEX IF NOT EXISTS idx_cand_detail_gin ON candidates USING GIN(detail);
CREATE INDEX IF NOT EXISTS idx_meeting_plans_candidate ON meeting_plans (candidate_id);
CREATE INDEX IF NOT EXISTS idx_resume_docs_candidate ON resume_documents (candidate_id);
CREATE INDEX IF NOT EXISTS idx_selection_progress_candidate ON selection_progress (candidate_id);
