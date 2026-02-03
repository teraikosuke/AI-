# MS Targets (Daily/Period) Design

## Scope
MS（目標）の日別・期間目標を保存し、既存の yield 日別実績一覧に紐づける。  
DB/Lambda 実装の設計ドキュメント。

## Business Rules
- 事業部判定: `users.role`
  - `marketing` → マーケ
  - `caller` → CS
  - `advisor` → 営業
- 期間
  - マーケ: 前月17日〜当月19日
  - CS/営業: 前月18日〜当月20日
  - 売上: 当月1日〜月末
- 実績は累計表示（各日付も累計）
- 日割りは均等割り（総目標→累計日割り）

## Metrics
- marketing: `validApplications`（candidates.is_effective_application）
- cs: `appointments`, `sitting`（teleapo.result = '設定' / '着座'）
- sales: `newInterviews` / `proposals` / `recommendations` / `interviewsScheduled` / `interviewsHeld` / `offers` / `accepts`
- revenue: `revenue`（placements.fee_amount, joined_at）

## DB (New Tables)

### ms_period_targets
期間目標（総目標）

```sql
CREATE TABLE ms_period_targets (
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

CREATE UNIQUE INDEX ms_period_targets_uq
  ON ms_period_targets (scope, department_key, metric_key, period_id, COALESCE(advisor_user_id, 0));
```

### ms_daily_targets
日別目標（累計値で保存）

```sql
CREATE TABLE ms_daily_targets (
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

CREATE UNIQUE INDEX ms_daily_targets_uq
  ON ms_daily_targets (scope, department_key, metric_key, period_id, target_date, COALESCE(advisor_user_id, 0));

CREATE INDEX ms_daily_targets_period_idx
  ON ms_daily_targets (period_id, department_key, metric_key);
```

## Lambda APIs (New)

### GET /ms-targets
**Query**
```
scope=personal|company
departmentKey=marketing|cs|sales|revenue
metricKey=...
periodId=YYYY-MM
advisorUserId=... (optional)
```

**Response**
```json
{
  "periodId":"2026-01",
  "scope":"personal",
  "departmentKey":"sales",
  "metricKey":"newInterviews",
  "advisorUserId":123,
  "targetTotal":100,
  "dailyTargets":{"2026-01-18":5,"2026-01-19":10}
}
```

### PUT /ms-targets
**Body**
```json
{
  "periodId":"2026-01",
  "scope":"personal",
  "departmentKey":"sales",
  "metricKey":"newInterviews",
  "advisorUserId":123,
  "targetTotal":100,
  "dailyTargets":{"2026-01-18":5,"2026-01-19":10}
}
```

- `ms_period_targets` と `ms_daily_targets` を UPSERT
- `advisor_user_id` は company の場合 NULL

## KPI Daily Extension (Existing /kpi/yield)
日別実績一覧のため daily payload に以下を追加

### Marketing (validApplications)
```sql
SELECT advisor_user_id,
       first_contact_at::date AS day,
       COUNT(*) FILTER (WHERE is_effective_application) AS validApplications
FROM candidates
WHERE first_contact_at::date BETWEEN $1 AND $2
GROUP BY advisor_user_id, day;
```

### CS (appointments / sitting)
```sql
SELECT caller_user_id AS advisor_user_id,
       called_at::date AS day,
       COUNT(*) FILTER (WHERE result = '設定') AS appointments,
       COUNT(*) FILTER (WHERE result = '着座') AS sitting
FROM teleapo
WHERE called_at::date BETWEEN $1 AND $2
GROUP BY caller_user_id, day;
```

### Revenue (revenue)
```sql
SELECT c.advisor_user_id,
       ca.joined_at::date AS day,
       SUM(COALESCE(p.fee_amount,0))::int AS revenue
FROM placements p
JOIN candidate_applications ca ON ca.id = p.candidate_application_id
JOIN candidates c ON c.id = ca.candidate_id
WHERE ca.joined_at::date BETWEEN $1 AND $2
GROUP BY c.advisor_user_id, day;
```

## Notes
- 日別目標は「累計値」で保存（フロントも累計表示）
- 売上の個人集計は `candidates.advisor_user_id` を使用
- 事業部ごとの日付範囲はフロントと同一ルール
