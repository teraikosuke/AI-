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
  advisor_name TEXT,
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

CREATE INDEX IF NOT EXISTS idx_cand_registered ON candidates (registered_date);
CREATE INDEX IF NOT EXISTS idx_cand_phase ON candidates (phase);
CREATE INDEX IF NOT EXISTS idx_cand_advisor ON candidates (advisor_name);
CREATE INDEX IF NOT EXISTS idx_cand_source ON candidates (source);
CREATE INDEX IF NOT EXISTS idx_cand_detail_gin ON candidates USING GIN(detail);
CREATE INDEX IF NOT EXISTS idx_meeting_plans_candidate ON meeting_plans (candidate_id);
CREATE INDEX IF NOT EXISTS idx_resume_docs_candidate ON resume_documents (candidate_id);
CREATE INDEX IF NOT EXISTS idx_selection_progress_candidate ON selection_progress (candidate_id);
