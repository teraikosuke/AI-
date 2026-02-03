-- MS targets: period + daily

CREATE TABLE IF NOT EXISTS ms_period_targets (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL, -- 'personal' | 'company'
  department_key TEXT NOT NULL, -- marketing | cs | sales | revenue
  metric_key TEXT NOT NULL,
  advisor_user_id BIGINT NULL,
  period_id TEXT NOT NULL, -- e.g. '2026-01'
  target_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ms_daily_targets (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL,
  department_key TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  advisor_user_id BIGINT NULL,
  period_id TEXT NOT NULL,
  target_date DATE NOT NULL,
  target_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ms_period_targets_uq
  ON ms_period_targets (scope, department_key, metric_key, period_id, COALESCE(advisor_user_id, 0));

CREATE UNIQUE INDEX IF NOT EXISTS ms_daily_targets_uq
  ON ms_daily_targets (scope, department_key, metric_key, period_id, target_date, COALESCE(advisor_user_id, 0));

CREATE INDEX IF NOT EXISTS ms_daily_targets_period_idx
  ON ms_daily_targets (period_id, department_key, metric_key);

-- User-specific important metric per department
CREATE TABLE IF NOT EXISTS user_important_metrics (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  department_key TEXT NOT NULL, -- marketing | cs | sales
  metric_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_important_metrics_uq
  ON user_important_metrics (user_id, department_key);

CREATE INDEX IF NOT EXISTS user_important_metrics_dept_idx
  ON user_important_metrics (department_key);
