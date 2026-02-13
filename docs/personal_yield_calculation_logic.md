# 個人成績画面の算出ロジック（データ取得元と計算式）

対象画面:
- `pages/yield-personal/yield-personal.js`
- 実処理本体 `pages/yield/yield.js`

この画面は「集計値の取得」と「フロントでの再計算」に分かれています。

## 1. どこから値を引っ張っているか

### 1-1. KPI実績（新規面談数〜承諾数、売上）
- フロントは `fetchPersonalKpiFromApi()` で `GET /kpi/yield` を呼び出し。
- 呼び出しパラメータ:
  - `scope=personal`
  - `advisorUserId=<ログインユーザーに紐づくID>`
  - `from`, `to`
  - `granularity=summary`
  - `groupBy=none`
  - `calcMode`（応募月計上/発生月計上）
  - `countBasis`, `timeBasis`（売上計上基準に連動）

参照コード:
- `pages/yield/yield.js` の `fetchPersonalKpiFromApi()`
- `pages/yield/yield.js` の `loadPersonalSummaryKPIData()`, `loadPersonalKPIData()`, `loadTodayPersonalKPIData()`

担当者IDの決定順（`advisorUserId`）:
1. セッション内の数値ID候補
2. members API とセッションの email/name 突合
3. 取れない場合は `DEFAULT_ADVISOR_USER_ID = 30`

### 1-2. 目標値（各カードの「目標」）
- `goalSettingsService.loadPersonalPeriodTarget()` / `getPersonalPeriodTarget()` を参照。
- バックエンド側は `goal_targets.targets` を参照（`scope='personal'`, `period_id`, `advisor_user_id`）。

参照コード:
- `scripts/services/goalSettings.js`
- `pages/yield/yield.js` の `seedMonthlyGoalsFromSettings()`, `seedTodayGoalsFromSettings()`

### 1-3. 売上目標（上部サマリー「目標」）
- KPI APIの `targetAmount/revenueTarget` も受け取るが、最終的には `goalSettingsService.getPersonalPeriodTarget(...).revenueTarget` があればそれを優先して上書き。

参照コード:
- `pages/yield/yield.js` の `renderPersonalSummary()`

## 2. KPI実績の元データ（バックエンドSQL）

`tmp/aws_lambda_pkg/ats-api-prod-kpi-yield/unzipped/index.mjs` の `buildSummarySql()` で、以下を集計。

| 画面項目 | 集計元 |
|---|---|
| 新規面談数 (`newInterviews`) | `candidates.first_contact_at::date` |
| 提案数 (`proposals`) | `COALESCE(candidate_applications.proposal_date, candidate_applications.recommended_at::date)` |
| 推薦数 (`recommendations`) | `candidate_applications.recommended_at::date` |
| 面接設定数 (`interviewsScheduled`) | `candidate_applications.first_interview_set_at::date` |
| 面接実施数 (`interviewsHeld`) | `candidate_applications.first_interview_at::date` |
| 内定数 (`offers`) | `COALESCE(candidate_applications.offer_date, candidate_applications.offer_at::date)` |
| 承諾数 (`accepts`) | `COALESCE(candidate_applications.offer_accept_date, candidate_applications.offer_accepted_at::date)` |
| 入社数 (`hires`) | `COALESCE(candidate_applications.join_date, candidate_applications.joined_at::date)` |
| 売上 (`revenue`) | `placements.fee_amount` 合計 - `placements.refund_amount` 合計 |

補足:
- 売上の日付軸は、`countBasis/timeBasis` が `application` の時は `candidates.created_at`、`occurrence` の時は `placements.order_date / withdraw_date`。

## 3. フロントでの算出式

### 3-1. 率カード（提案率〜入社決定率）
表示率は APIの率をそのまま使わず、フロントで再計算しています（`normalizeKpi()`）。

共通関数:
- `calcRate(numerator, denominator) = round((numerator / denominator) * 100)`

`率の計算 = 新規面談数から (base)` のとき:
- 提案率 = `proposals / newInterviews * 100`
- 推薦率 = `recommendations / newInterviews * 100`
- 面接設定率 = `interviewsScheduled / newInterviews * 100`
- 面接実施率 = `interviewsHeld / newInterviews * 100`
- 内定率 = `offers / newInterviews * 100`
- 承諾率 = `accepts / newInterviews * 100`
- 入社決定率 = `hires / newInterviews * 100`

`率の計算 = 前段階から (step)` のとき:
- 提案率 = `proposals / newInterviews * 100`
- 推薦率 = `recommendations / proposals * 100`
- 面接設定率 = `interviewsScheduled / recommendations * 100`
- 面接実施率 = `interviewsHeld / interviewsScheduled * 100`
- 内定率 = `offers / interviewsHeld * 100`
- 承諾率 = `accepts / offers * 100`
- 入社決定率 = `hires / accepts * 100`

参照コード:
- `pages/yield/yield.js` の `computeRateValues()`

### 3-2. 売り上げ達成率（上部サマリー）
- 現状 = `currentAmount`（実質 `revenue`）
- 目標 = `revenueTarget`（goal設定値を優先）
- 達成率 = `round(currentAmount / targetAmount * 100)`（targetAmount > 0 の場合）

参照コード:
- `pages/yield/yield.js` の `renderPersonalSummary()`

### 3-3. 各カード下部の「達成率」
- `renderGoalProgress()` で計算。
- 達成率 = `round(current / target * 100)`（target > 0）

`current` は現在KPI値、`target` は goalSettings からロードした目標値。

### 3-4. 目標キーの表示マッピング
画面カードの `data-ref` 名と、`goal_targets.targets` のキーは以下でマッピングされています（`TARGET_TO_GOAL_KEY`）。

- `newInterviewsTarget` -> `monthlyGoal-proposals`
- `proposalsTarget` -> `monthlyGoal-recommendations`
- `recommendationsTarget` -> `monthlyGoal-interviewsScheduled`
- `interviewsScheduledTarget` -> `monthlyGoal-interviewsHeld`
- `interviewsHeldTarget` -> `monthlyGoal-offers`
- `offersTarget` -> `monthlyGoal-accepts`
- `acceptsTarget` -> `monthlyGoal-hires`

そのため、見た目のカード名に対して1段ずれたキー名で保存される構成になっています（表示値自体は `renderGoalProgress()` で各 `dataKey` と対応づけて再計算）。

## 4. 画面表示までの処理順

1. `loadYieldData()` が個人成績向けに3種類を並列取得
   - 今日分予定: `loadTodayPersonalKPIData()`
   - 評価期間サマリー: `loadPersonalSummaryKPIData()`
   - 期間指定サマリー: `loadPersonalKPIData()`
2. `renderPersonalKpis()` で数値カード・率カード・差分バッジを描画
3. `renderPersonalSummary()` で売上達成率を描画
4. `seedMonthlyGoalsFromSettings()` + `renderGoalProgress()` で目標/達成率を描画

## 5. 補足（フォールバック）

- 本来は `https://st70aifr22.execute-api.ap-northeast-1.amazonaws.com/prod/kpi/yield` を呼びます。
- 5xx時はローカルの `/api/kpi/yield` にフォールバックします。
- ローカル `/api/kpi/yield.js` はDBではなく疑似データ生成ロジックです。
