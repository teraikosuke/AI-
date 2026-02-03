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
});

const ALLOWED_ORIGINS = new Set(["http://localhost:8000", "http://localhost:8001","http://localhost:8080", "http://localhost:8081"]);
const baseHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization",
};

function buildHeaders(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "*";
  return { ...baseHeaders, "Access-Control-Allow-Origin": allowOrigin };
}

function json(body, statusCode = 200, headers = {}) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

const getPath = (event) => event?.rawPath || event?.path || "";
const getMethod = (event) => event?.requestContext?.http?.method || event?.httpMethod || "GET";
const parseAdvisorIds = (raw) =>
  String(raw || "")
    .split(",")
    .map((value) => Number(String(value || "").trim()))
    .filter((value) => Number.isFinite(value) && value > 0);

async function getGoalSettings(client) {
  const res = await client.query("SELECT evaluation_rule_type, evaluation_rule_options FROM goal_settings WHERE id = 1");
  return res.rows?.[0] || { evaluation_rule_type: "monthly", evaluation_rule_options: {} };
}

async function upsertGoalSettings(client, { type, options }) {
  await client.query(
    `INSERT INTO goal_settings (id, evaluation_rule_type, evaluation_rule_options)
     VALUES (1, $1, $2)
     ON CONFLICT (id)
     DO UPDATE SET evaluation_rule_type = EXCLUDED.evaluation_rule_type,
                   evaluation_rule_options = EXCLUDED.evaluation_rule_options,
                   updated_at = now()`,
    [type, options || {}]
  );
}

async function getGoalTargets(client, { scope, periodId, advisorUserId }) {
  if (scope === "company") {
    const res = await client.query(
      `SELECT targets FROM goal_targets WHERE scope='company' AND period_id=$1`,
      [periodId]
    );
    return res.rows?.[0]?.targets || {};
  } else {
    const res = await client.query(
      `SELECT targets FROM goal_targets WHERE scope='personal' AND advisor_user_id=$1 AND period_id=$2`,
      [advisorUserId, periodId]
    );
    return res.rows?.[0]?.targets || {};
  }
}

async function getGoalTargetsBulk(client, { periodId, advisorUserIds }) {
  const res = await client.query(
    `SELECT advisor_user_id, targets
     FROM goal_targets
     WHERE scope='personal' AND period_id=$1 AND advisor_user_id = ANY($2::int[])`,
    [periodId, advisorUserIds]
  );
  return res.rows || [];
}

async function upsertGoalTargets(client, { scope, periodId, advisorUserId, targets }) {
  if (scope === "company") {
    await client.query(
      `INSERT INTO goal_targets (scope, advisor_user_id, period_id, targets)
       VALUES ('company', NULL, $1, $2)
       ON CONFLICT (scope, period_id) WHERE scope='company'
       DO UPDATE SET targets = EXCLUDED.targets, updated_at = now()`,
      [periodId, targets]
    );
  } else {
    await client.query(
      `INSERT INTO goal_targets (scope, advisor_user_id, period_id, targets)
       VALUES ('personal', $1, $2, $3)
       ON CONFLICT (advisor_user_id, period_id) WHERE scope='personal'
       DO UPDATE SET targets = EXCLUDED.targets, updated_at = now()`,
      [advisorUserId, periodId, targets]
    );
  }
}

async function getDailyTargets(client, { advisorUserId, periodId, targetDate }) {
  const params = [advisorUserId, periodId];
  const dateFilter = targetDate ? `AND target_date=$3` : "";
  if (targetDate) params.push(targetDate);
  const res = await client.query(
    `SELECT target_date, targets
     FROM goal_daily_targets
     WHERE advisor_user_id=$1 AND period_id=$2
     ${dateFilter}
     ORDER BY target_date ASC`,
    params
  );
  return res.rows.reduce((acc, row) => {
    acc[row.target_date.toISOString().split("T")[0]] = row.targets;
    return acc;
  }, {});
}

async function getDailyTargetsBulk(client, { advisorUserIds, periodId, targetDate }) {
  const params = [periodId, advisorUserIds];
  let dateFilter = "";
  if (targetDate) {
    params.push(targetDate);
    dateFilter = `AND target_date=$${params.length}`;
  }
  const res = await client.query(
    `SELECT advisor_user_id, target_date, targets
     FROM goal_daily_targets
     WHERE period_id=$1 AND advisor_user_id = ANY($2::int[])
     ${dateFilter}
     ORDER BY advisor_user_id, target_date ASC`,
    params
  );
  const map = new Map();
  res.rows.forEach((row) => {
    const id = Number(row.advisor_user_id);
    if (!Number.isFinite(id)) return;
    if (!map.has(id)) map.set(id, {});
    const daily = map.get(id);
    daily[row.target_date.toISOString().split("T")[0]] = row.targets;
  });
  return Array.from(map.entries()).map(([advisorUserId, dailyTargets]) => ({
    advisorUserId,
    dailyTargets,
  }));
}

async function upsertDailyTargets(client, { advisorUserId, periodId, items }) {
  const sql = `
    INSERT INTO goal_daily_targets (advisor_user_id, period_id, target_date, targets)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (advisor_user_id, period_id, target_date)
    DO UPDATE SET targets = EXCLUDED.targets, updated_at = now()
  `;
  for (const item of items) {
    await client.query(sql, [advisorUserId, periodId, item.target_date, item.targets]);
  }
}

export const handler = async (event) => {
  const method = getMethod(event);
  const path = getPath(event);
  const headers = buildHeaders(event);

  if (method === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const qs = event.queryStringParameters ?? {};
  const body = event.body ? JSON.parse(event.body) : {};

  let client;
  try {
    client = await pool.connect();

    if (method === "GET" && path.endsWith("/goal-settings")) {
      const data = await getGoalSettings(client);
      return json(data, 200, headers);
    }

    if (method === "PUT" && path.endsWith("/goal-settings")) {
      await upsertGoalSettings(client, {
        type: body.evaluation_rule_type,
        options: body.evaluation_rule_options || {}
      });
      return json({ ok: true }, 200, headers);
    }

    if (method === "GET" && path.endsWith("/goal-targets")) {
      const scope = qs.scope;
      const periodId = qs.periodId;
      const advisorUserId = qs.advisorUserId ? Number(qs.advisorUserId) : null;
      const advisorUserIds = parseAdvisorIds(qs.advisorUserIds);
      if (!scope || !periodId) return json({ error: "scope, periodId are required" }, 400, headers);
      if (scope === "personal" && !advisorUserId && !advisorUserIds.length) {
        return json({ error: "advisorUserId or advisorUserIds required" }, 400, headers);
      }

      if (scope === "personal" && advisorUserIds.length) {
        const rows = await getGoalTargetsBulk(client, { periodId, advisorUserIds });
        const items = rows.map((row) => ({
          advisorUserId: row.advisor_user_id,
          targets: row.targets || {},
        }));
        return json({ items }, 200, headers);
      }

      const targets = await getGoalTargets(client, { scope, periodId, advisorUserId });
      return json({ targets }, 200, headers);
    }

    if (method === "PUT" && path.endsWith("/goal-targets")) {
      const { scope, periodId, advisorUserId, targets } = body;
      if (!scope || !periodId || !targets) return json({ error: "scope, periodId, targets are required" }, 400, headers);
      if (scope === "personal" && !advisorUserId) return json({ error: "advisorUserId required" }, 400, headers);

      await upsertGoalTargets(client, { scope, periodId, advisorUserId, targets });
      return json({ ok: true }, 200, headers);
    }

    if (method === "GET" && path.endsWith("/goal-daily-targets")) {
      const advisorUserId = qs.advisorUserId ? Number(qs.advisorUserId) : null;
      const periodId = qs.periodId;
      const advisorUserIds = parseAdvisorIds(qs.advisorUserIds);
      const targetDate = qs.date ? String(qs.date).trim() : "";
      if (!periodId || (!advisorUserId && !advisorUserIds.length)) {
        return json({ error: "advisorUserId or advisorUserIds and periodId required" }, 400, headers);
      }

      if (advisorUserIds.length) {
        const items = await getDailyTargetsBulk(client, { advisorUserIds, periodId, targetDate });
        return json({ items }, 200, headers);
      }

      const dailyTargets = await getDailyTargets(client, { advisorUserId, periodId, targetDate });
      return json({ dailyTargets }, 200, headers);
    }

    if (method === "PUT" && path.endsWith("/goal-daily-targets")) {
      const { advisorUserId, periodId, items } = body;
      if (!advisorUserId || !periodId || !Array.isArray(items)) {
        return json({ error: "advisorUserId, periodId, items required" }, 400, headers);
      }

      await upsertDailyTargets(client, { advisorUserId, periodId, items });
      return json({ ok: true }, 200, headers);
    }

    return json({ error: "Not Found" }, 404, headers);
  } catch (err) {
    console.error("LAMBDA ERROR:", err);
    return json({ error: String(err?.message || err) }, 500, headers);
  } finally {
    if (client) client.release();
  }
};
