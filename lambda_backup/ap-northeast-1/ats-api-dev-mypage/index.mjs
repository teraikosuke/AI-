import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  host: (process.env.DB_HOST || "").trim(),
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const BASE_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization",
};

function buildHeaders(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || "";
  const allowOrigin = (process.env.CORS_ORIGIN || "").trim() || origin || "*";
  return { ...BASE_HEADERS, "Access-Control-Allow-Origin": allowOrigin };
}

function toIntOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function clampInt(value, fallback, min, max) {
  const parsed = toIntOrNull(value);
  const safe = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(max, Math.max(min, safe));
}

function isoDate(date) {
  return date.toISOString().split("T")[0];
}

function getJstDateKey(now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return isoDate(jst);
}

function toDateKey(value) {
  if (!value) return null;
  if (typeof value === "string") return value.split("T")[0];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return isoDate(date);
}

function addDays(dateKey, days) {
  const base = new Date(`${dateKey}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return isoDate(base);
}

function isMonthKey(value) {
  return /^\d{4}-\d{2}$/.test(value);
}

function resolveMonthKey(value, fallbackKey) {
  if (typeof value !== "string") return fallbackKey;
  const trimmed = value.trim();
  return isMonthKey(trimmed) ? trimmed : fallbackKey;
}

function getMonthRange(monthKey) {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return { startDate: null, endDate: null };
  }
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

function resolvePhase(stageList, teleapo) {
  const list = Array.isArray(stageList)
    ? stageList.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const unique = Array.from(new Set(list));
  if (unique.length > 0) return unique.join(" / ");

  if (teleapo?.has_connected) return "通電";
  if (teleapo?.has_sms) return "SMS送信";
  if ((teleapo?.max_call_no || 0) > 0) return "架電中";
  return "未接触";
}

function pickMaxAction(actions) {
  let picked = null;
  actions.forEach((action) => {
    if (!action?.date) return;
    if (!picked || action.date > picked.date) {
      picked = action;
    }
  });
  return picked;
}

function pickMinAction(actions) {
  let picked = null;
  actions.forEach((action) => {
    if (!action?.date) return;
    if (!picked || action.date < picked.date) {
      picked = action;
    }
  });
  return picked;
}

function buildActionCandidates(row, { includeCallFallback = false } = {}) {
  const connectedDate = toDateKey(row.last_connected_at);
  const callDate = toDateKey(row.last_call_at);

  const actions = [
    { type: "通電日", date: connectedDate },
    { type: "推薦日", date: toDateKey(row.recommended_at_past) },
    { type: "一次面接日", date: toDateKey(row.first_interview_at_past) },
    { type: "二次面接日", date: toDateKey(row.second_interview_at_past) },
    { type: "内定日", date: toDateKey(row.offer_date_past) },
    { type: "内定承諾日", date: toDateKey(row.offer_accept_date_past) },
    { type: "入社日", date: toDateKey(row.join_date_past) },
    { type: "内定後辞退日", date: toDateKey(row.pre_join_withdraw_date_past) },
    { type: "入社後辞退日", date: toDateKey(row.post_join_quit_date_past) },
    { type: "クロージング予定日", date: toDateKey(row.close_expected_at_past) },
  ];

  if (includeCallFallback && !connectedDate && callDate) {
    actions.push({ type: "架電日", date: callDate });
  }

  return actions.filter((action) => action.date);
}

function buildFutureActionCandidates(row) {
  return [
    { type: "推薦日", date: toDateKey(row.recommended_at_future) },
    { type: "一次面接日", date: toDateKey(row.first_interview_at_future) },
    { type: "二次面接日", date: toDateKey(row.second_interview_at_future) },
    { type: "内定日", date: toDateKey(row.offer_date_future) },
    { type: "内定承諾日", date: toDateKey(row.offer_accept_date_future) },
    { type: "入社日", date: toDateKey(row.join_date_future) },
    { type: "内定後辞退日", date: toDateKey(row.pre_join_withdraw_date_future) },
    { type: "入社後辞退日", date: toDateKey(row.post_join_quit_date_future) },
    { type: "クロージング予定日", date: toDateKey(row.close_expected_at_future) },
  ].filter((action) => action.date);
}

function isClosedCandidate(row, todayKey) {
  const past = toDateKey(row.close_expected_at_past);
  const future = toDateKey(row.close_expected_at_future);
  if (future) return false;
  if (!past) return false;
  return past < todayKey;
}

function buildCandidate(row, todayKey, { includeCallFallback = false } = {}) {
  const teleapoSummary = {
    has_connected: Boolean(row.has_connected),
    has_sms: Boolean(row.has_sms),
    max_call_no: row.max_call_no,
  };
  const phase = resolvePhase(row.stage_list, teleapoSummary);

  const lastAction = pickMaxAction(buildActionCandidates(row, { includeCallFallback }));
  const nextAction = pickMinAction(buildFutureActionCandidates(row));

  return {
    candidateId: String(row.id),
    candidateName: row.candidate_name || "",
    phase,
    lastAction: lastAction || null,
    nextAction: nextAction || null,
    closeExpectedAt: toDateKey(row.close_expected_at_future) || toDateKey(row.close_expected_at_past),
    isClosed: isClosedCandidate(row, todayKey),
    createdAt: toDateKey(row.created_at),
    firstScheduleFixedAt: toDateKey(row.first_schedule_fixed_at),
    isEffective: row.is_effective_application === true,
    hasConnected: Boolean(row.has_connected),
    firstContactPlannedAt: toDateKey(row.first_contact_planned_at),
  };
}

function buildNotifications(candidates, todayKey, windowDays) {
  const windowStart = addDays(todayKey, -(windowDays - 1));
  const windowEnd = addDays(todayKey, windowDays);

  const notifications = [];
  candidates.forEach((candidate) => {
    if (candidate.createdAt && candidate.createdAt >= windowStart && candidate.createdAt <= todayKey) {
      notifications.push({
        type: "candidate_added",
        label: "候補者追加",
        date: candidate.createdAt,
        candidateId: candidate.candidateId,
        candidateName: candidate.candidateName,
      });
    }

    if (candidate.firstScheduleFixedAt && candidate.firstScheduleFixedAt >= windowStart && candidate.firstScheduleFixedAt <= todayKey) {
      notifications.push({
        type: "interview_set",
        label: "新規面談設定",
        date: candidate.firstScheduleFixedAt,
        candidateId: candidate.candidateId,
        candidateName: candidate.candidateName,
      });
    }

    if (candidate.nextAction?.date && candidate.nextAction.date >= todayKey && candidate.nextAction.date <= windowEnd) {
      notifications.push({
        type: "next_action_soon",
        label: "次回アクションが近い",
        date: candidate.nextAction.date,
        candidateId: candidate.candidateId,
        candidateName: candidate.candidateName,
      });
    }
  });

  return notifications.sort((a, b) => (a.date < b.date ? 1 : -1));
}

function normalizeTaskItems(rawTasks) {
  if (!Array.isArray(rawTasks)) return [];
  return rawTasks.map((task) => {
    const date = toDateKey(task?.date ?? task?.action_date ?? task?.actionDate);
    const rawType = task?.type ?? task?.action_note ?? task?.actionNote ?? null;
    const typeText = rawType ? String(rawType).trim() : "";
    const type = typeText ? typeText : "次回アクション";
    return { date, type };
  });
}

export const handler = async (event) => {
  const headers = buildHeaders(event);
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";

  if (method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (method !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const qs = event?.queryStringParameters ?? {};
  const userId = toIntOrNull(qs.userId ?? qs.user_id);
  const rawRole = String(qs.role || "").toLowerCase();
  const limit = clampInt(qs.limit, 10, 1, 50);
  const notifyWindowDays = clampInt(qs.notifyWindowDays ?? qs.notify_window_days, 3, 1, 30);
  const monthKey = resolveMonthKey(qs.month ?? qs.calendarMonth, getJstDateKey().slice(0, 7));
  const { startDate: monthStart, endDate: monthEnd } = getMonthRange(monthKey);

  if (!userId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "userId が不正です" }) };
  }

  const isCaller = rawRole.includes("caller");
  const roleField = isCaller ? "partner_user_id" : "advisor_user_id";
  const todayKey = getJstDateKey();

  const sql = `
    WITH teleapo_summary AS (
      SELECT
        candidate_id,
        MAX(CASE WHEN result = '通電' THEN called_at END) AS last_connected_at,
        MAX(called_at) AS last_call_at,
        BOOL_OR(result = '通電') AS has_connected,
        BOOL_OR(result = 'SMS送信') AS has_sms,
        MAX(call_no) AS max_call_no
      FROM teleapo
      GROUP BY candidate_id
    ),
    app_dates AS (
      SELECT
        candidate_id,
        MAX(recommended_at) FILTER (WHERE recommended_at::date <= $1) AS recommended_at_past,
        MIN(recommended_at) FILTER (WHERE recommended_at::date > $1) AS recommended_at_future,
        MAX(first_interview_at) FILTER (WHERE first_interview_at::date <= $1) AS first_interview_at_past,
        MIN(first_interview_at) FILTER (WHERE first_interview_at::date > $1) AS first_interview_at_future,
        MAX(second_interview_at) FILTER (WHERE second_interview_at::date <= $1) AS second_interview_at_past,
        MIN(second_interview_at) FILTER (WHERE second_interview_at::date > $1) AS second_interview_at_future,
        MAX(offer_date) FILTER (WHERE offer_date::date <= $1) AS offer_date_past,
        MIN(offer_date) FILTER (WHERE offer_date::date > $1) AS offer_date_future,
        MAX(offer_accept_date) FILTER (WHERE offer_accept_date::date <= $1) AS offer_accept_date_past,
        MIN(offer_accept_date) FILTER (WHERE offer_accept_date::date > $1) AS offer_accept_date_future,
        MAX(join_date) FILTER (WHERE join_date::date <= $1) AS join_date_past,
        MIN(join_date) FILTER (WHERE join_date::date > $1) AS join_date_future,
        MAX(pre_join_withdraw_date) FILTER (WHERE pre_join_withdraw_date::date <= $1) AS pre_join_withdraw_date_past,
        MIN(pre_join_withdraw_date) FILTER (WHERE pre_join_withdraw_date::date > $1) AS pre_join_withdraw_date_future,
        MAX(post_join_quit_date) FILTER (WHERE post_join_quit_date::date <= $1) AS post_join_quit_date_past,
        MIN(post_join_quit_date) FILTER (WHERE post_join_quit_date::date > $1) AS post_join_quit_date_future,
        MAX(close_expected_at) FILTER (WHERE close_expected_at::date <= $1) AS close_expected_at_past,
        MIN(close_expected_at) FILTER (WHERE close_expected_at::date > $1) AS close_expected_at_future
      FROM candidate_applications
      GROUP BY candidate_id
    ),
    stage_list AS (
      SELECT
        candidate_id,
        ARRAY_AGG(DISTINCT stage_current) FILTER (WHERE stage_current IS NOT NULL AND stage_current <> '') AS stage_list
      FROM candidate_applications
      GROUP BY candidate_id
    ),
    task_list AS (
      SELECT
        candidate_id,
        json_agg(
          json_build_object(
            'date', action_date::date,
            'type', COALESCE(NULLIF(action_note, ''), '次回アクション')
          )
          ORDER BY action_date ASC NULLS LAST, created_at ASC
        ) AS tasks,
        MIN(action_date) AS next_action_date
      FROM candidate_tasks
      WHERE is_completed = false
      GROUP BY candidate_id
    )
    SELECT
      c.id,
      c.name AS candidate_name,
      c.advisor_user_id,
      c.partner_user_id,
      u_partner.name AS partner_name,
      c.is_effective_application,
      c.first_contact_planned_at,
      c.first_schedule_fixed_at,
      c.created_at,
      t.last_connected_at,
      t.last_call_at,
      t.has_connected,
      t.has_sms,
      t.max_call_no,
      s.stage_list,
      tl.tasks AS pending_tasks,
      tl.next_action_date AS pending_task_date,
      a.*
    FROM candidates c
    LEFT JOIN teleapo_summary t ON t.candidate_id = c.id
    LEFT JOIN app_dates a ON a.candidate_id = c.id
    LEFT JOIN stage_list s ON s.candidate_id = c.id
    LEFT JOIN task_list tl ON tl.candidate_id = c.id
    LEFT JOIN users u_partner ON u_partner.id = c.partner_user_id
    WHERE c.${roleField} = $2
  `;

  let client;
  try {
    client = await pool.connect();
    const res = await client.query(sql, [todayKey, userId]);
    const includeCallFallback = isCaller;
    const candidates = res.rows.map((row) => buildCandidate(row, todayKey, { includeCallFallback }));
    const candidateById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
    const candidateMetaById = new Map(
      res.rows.map((row) => {
        const candidate = candidateById.get(String(row.id));
        const phase = candidate?.phase ?? resolvePhase(row.stage_list, {
          has_connected: Boolean(row.has_connected),
          has_sms: Boolean(row.has_sms),
          max_call_no: row.max_call_no,
        });
        return [
          String(row.id),
          {
            candidateName: candidate?.candidateName ?? row.candidate_name ?? "",
            phase,
            partnerName: row.partner_name || ""
          }
        ];
      })
    );

    const openCandidates = candidates.filter((candidate) => !candidate.isClosed);
    const closedCandidates = candidates.filter((candidate) => candidate.isClosed);

    let filtered = openCandidates;
    if (isCaller) {
      filtered = openCandidates.filter((candidate) => (
        candidate.isEffective
        && !candidate.hasConnected
        && !candidate.firstContactPlannedAt
      ));
    }

    const candidatesList = filtered
      .sort((a, b) => {
        const aDate = a.nextAction?.date || "9999-12-31";
        const bDate = b.nextAction?.date || "9999-12-31";
        if (aDate !== bDate) return aDate < bDate ? -1 : 1;
        return a.candidateName.localeCompare(b.candidateName, "ja");
      })
        .slice(0, limit);

    const tasksAll = isCaller
      ? []
      : res.rows
        .flatMap((row) => {
          const items = normalizeTaskItems(row.pending_tasks);
          if (items.length === 0) return [];
          const meta = candidateMetaById.get(String(row.id)) || {};
          return items.map((action) => ({
            candidateId: String(row.id),
            candidateName: meta.candidateName || "",
            phase: meta.phase || "",
            partnerName: meta.partnerName || "",
            nextAction: action,
            _sortKey: toDateKey(action.date) || "9999-12-31"
          }));
        })
        .sort((a, b) => {
          if (a._sortKey !== b._sortKey) return a._sortKey < b._sortKey ? -1 : 1;
          return a.candidateName.localeCompare(b.candidateName, "ja");
        })
        .map(({ _sortKey, ...rest }) => rest);

    const tasksUpcoming = tasksAll.slice(0, limit);
    const tasksToday = tasksAll
      .filter((task) => toDateKey(task.nextAction?.date) === todayKey)
      .slice(0, limit);
    const tasks = tasksUpcoming;

    const calendarPending = [];
    const calendarCompleted = [];
    const calendarProgress = [];

    if (!isCaller && monthStart && monthEnd) {
      const calendarTasksRes = await client.query(
        `
          SELECT t.candidate_id, t.action_date::date AS action_date, t.action_note, t.is_completed
          FROM candidate_tasks t
          JOIN candidates c ON c.id = t.candidate_id
          WHERE c.${roleField} = $1
            AND t.action_date::date BETWEEN $2 AND $3
          ORDER BY t.action_date ASC, t.created_at ASC
        `,
        [userId, monthStart, monthEnd]
      );

      calendarTasksRes.rows.forEach((row) => {
        const normalized = normalizeTaskItems([row])[0];
        if (!normalized?.date) return;
        const meta = candidateMetaById.get(String(row.candidate_id)) || {};
        const item = {
          candidateId: String(row.candidate_id),
          candidateName: meta.candidateName || "",
          phase: meta.phase || "",
          partnerName: meta.partnerName || "",
          date: normalized.date,
          type: normalized.type
        };
        if (row.is_completed) {
          calendarCompleted.push(item);
        } else {
          calendarPending.push(item);
        }
      });

      const progressRes = await client.query(
        `
          SELECT
            ca.candidate_id,
            ca.recommended_at,
            ca.first_interview_at,
            ca.second_interview_at,
            ca.final_interview_at,
            ca.offer_date,
            ca.offer_accept_date,
            ca.join_date,
            ca.close_expected_at
          FROM candidate_applications ca
          JOIN candidates c ON c.id = ca.candidate_id
          WHERE c.${roleField} = $1
            AND (
              ca.recommended_at::date BETWEEN $2 AND $3 OR
              ca.first_interview_at::date BETWEEN $2 AND $3 OR
              ca.second_interview_at::date BETWEEN $2 AND $3 OR
              ca.final_interview_at::date BETWEEN $2 AND $3 OR
              ca.offer_date::date BETWEEN $2 AND $3 OR
              ca.offer_accept_date::date BETWEEN $2 AND $3 OR
              ca.join_date::date BETWEEN $2 AND $3 OR
              ca.close_expected_at::date BETWEEN $2 AND $3
            )
        `,
        [userId, monthStart, monthEnd]
      );

      const pushProgress = (candidateId, dateValue, type) => {
        const date = toDateKey(dateValue);
        if (!date || date < monthStart || date > monthEnd) return;
        const meta = candidateMetaById.get(String(candidateId)) || {};
        calendarProgress.push({
          candidateId: String(candidateId),
          candidateName: meta.candidateName || "",
          phase: meta.phase || "",
          partnerName: meta.partnerName || "",
          date,
          type
        });
      };

      progressRes.rows.forEach((row) => {
        pushProgress(row.candidate_id, row.recommended_at, "推薦");
        pushProgress(row.candidate_id, row.first_interview_at, "一次面接");
        pushProgress(row.candidate_id, row.second_interview_at, "二次面接");
        pushProgress(row.candidate_id, row.final_interview_at, "最終面接");
        pushProgress(row.candidate_id, row.offer_date, "内定");
        pushProgress(row.candidate_id, row.offer_accept_date, "内定承諾");
        pushProgress(row.candidate_id, row.join_date, "入社");
        pushProgress(row.candidate_id, row.close_expected_at, "クロージング");
      });
    }

    const notifications = buildNotifications(candidates, todayKey, notifyWindowDays)
      .slice(0, limit);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        role: isCaller ? "caller" : "advisor",
        today: todayKey,
        tasks,
        tasksToday,
        tasksUpcoming,
        calendar: {
          month: monthKey,
          startDate: monthStart,
          endDate: monthEnd,
          pendingTasks: calendarPending,
          completedTasks: calendarCompleted,
          progressEvents: calendarProgress
        },
        notifications,
        candidates: candidatesList,
        closedCandidates: isCaller ? [] : closedCandidates.slice(0, limit),
      }),
    };
  } catch (error) {
    console.error("mypage lambda error", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: String(error?.message || error) }),
    };
  } finally {
    if (client) client.release();
  }
};
