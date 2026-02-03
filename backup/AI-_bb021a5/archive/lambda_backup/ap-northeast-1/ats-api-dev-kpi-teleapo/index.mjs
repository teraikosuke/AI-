import pg from "pg";
const { Pool } = pg;

// DB接続設定
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

// 共通レスポンスヘッダー
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": (process.env.CORS_ORIGIN || "*").trim(),
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization",
};

// ヘルパー関数
const json = (statusCode, bodyObj) => ({
  statusCode,
  headers,
  body: bodyObj === undefined ? "" : JSON.stringify(bodyObj),
});

const rate = (numer, denom) => {
  if (!denom || denom === 0) return 0; // 0除算対策
  return Number((numer / denom).toFixed(4));
};

const toIntOrNull = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const getQS = (event) => event?.queryStringParameters ?? {};

// 安全なIDキャスト用
const callerIdExpr = `CASE WHEN (t.caller_user_id)::text ~ '^\\d+$' THEN (t.caller_user_id)::bigint END`;

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";

  if (method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const qs = getQS(event);

  const from = (qs.from || "2025-01-01").trim();
  const to = (qs.to || "2025-12-31").trim();
  const groupBy = (qs.groupBy || "date").trim(); // date | caller_date | caller
  const callerUserId = toIntOrNull(qs.callerUserId);
  const advisorUserId = toIntOrNull(qs.advisorUserId);

  if (!from || !to) {
    return json(400, {
      error: "from, to は必須です",
    });
  }

  const mode = ["date", "caller_date", "caller"].includes(groupBy)
    ? groupBy
    : "date";

  let client;
  try {
    client = await pool.connect();

    const params = [from, to];
    // 日付範囲の条件 (DATE型で比較)
    const where = [`DATE(t.called_at) BETWEEN $1 AND $2`];

    // 候補者担当(advisor)で絞る
    let joinCandidate = "";
    if (advisorUserId !== null) {
      joinCandidate = `JOIN candidates c ON t.candidate_id = c.id`;
      params.push(advisorUserId);
      where.push(`c.advisor_user_id = $${params.length}`);
    }

    // 架電担当者(caller)で絞る
    if (callerUserId !== null) {
      params.push(callerUserId);
      where.push(`${callerIdExpr} = $${params.length}`);
    }

    const callerSelect = `
      COALESCE(${callerIdExpr}, 0) AS caller_user_id,
      COALESCE(u.name, '(unknown)') AS caller_name
    `;
    const callerJoin = `LEFT JOIN users u ON u.id = ${callerIdExpr}`;

    // ★修正: 着座数 (attended_calls) を追加
    const metricsSelect = `
      COUNT(*)::int AS total_calls,
      COUNT(*) FILTER (WHERE t.result = '通電')::int AS connected_calls,
      COUNT(*) FILTER (WHERE t.result = '不在')::int AS no_answer_calls,
      COUNT(*) FILTER (WHERE t.result LIKE '%設定%')::int AS scheduled_calls,
      COUNT(*) FILTER (WHERE t.result = '着座')::int AS attended_calls,
      COUNT(DISTINCT t.candidate_id)::int AS unique_candidates
    `;

    let sql = "";

    if (mode === "date") {
      sql = `
        SELECT
          DATE(t.called_at) AS call_date,
          ${metricsSelect}
        FROM teleapo t
        ${joinCandidate}
        WHERE ${where.join(" AND ")}
        GROUP BY DATE(t.called_at)
        ORDER BY call_date ASC;
      `;
    } else if (mode === "caller") {
      sql = `
        SELECT
          ${callerSelect},
          ${metricsSelect}
        FROM teleapo t
        ${callerJoin}
        ${joinCandidate}
        WHERE ${where.join(" AND ")}
        GROUP BY COALESCE(${callerIdExpr}, 0), COALESCE(u.name, '(unknown)')
        ORDER BY total_calls DESC, caller_user_id ASC;
      `;
    } else {
      sql = `
        SELECT
          ${callerSelect},
          DATE(t.called_at) AS call_date,
          ${metricsSelect}
        FROM teleapo t
        ${callerJoin}
        ${joinCandidate}
        WHERE ${where.join(" AND ")}
        GROUP BY COALESCE(${callerIdExpr}, 0), COALESCE(u.name, '(unknown)'), DATE(t.called_at)
        ORDER BY call_date ASC, total_calls DESC, caller_user_id ASC;
      `;
    }

    const res = await client.query(sql, params);

    // データ整形
    const rows = (res.rows || []).map((r) => {
      const total = Number(r.total_calls || 0);
      const connected = Number(r.connected_calls || 0);
      const scheduled = Number(r.scheduled_calls || 0);
      const attended = Number(r.attended_calls || 0); // 着座数

      // ★デフォルトの計算ロジック変更
      // 設定率 = 設定数 / 通電数 (分母が0なら0)
      // 着座率 = 着座数 / 通電数 (分母が0なら0)
      const connectRateVal = rate(connected, total);
      const scheduleRateVal = rate(scheduled, connected);
      const attendanceRateVal = rate(attended, connected);

      const base = {
        counts: {
          totalCalls: total,
          connectedCalls: connected,
          noAnswerCalls: Number(r.no_answer_calls || 0),
          scheduledCalls: scheduled,
          attendedCalls: attended, // フロントエンドに渡す
          uniqueCandidates: Number(r.unique_candidates || 0),
        },
        rates: {
          connectRate: connectRateVal,
          scheduleRate: scheduleRateVal,
          attendanceRate: attendanceRateVal,
        },
      };

      if (mode === "date") return { date: r.call_date, ...base };
      
      const callerInfo = {
        callerUserId: Number(r.caller_user_id || 0),
        callerName: r.caller_name,
      };

      if (mode === "caller") return { ...callerInfo, ...base };

      return {
        date: r.call_date,
        ...callerInfo,
        ...base,
      };
    });

    return json(200, {
      period: { from, to },
      groupBy: mode,
      callerUserId,
      advisorUserId,
      rows,
    });

  } catch (err) {
    console.error("LAMBDA KPI ERROR:", err);
    return json(500, { error: String(err?.message || err) });
  } finally {
    if (client) client.release();
  }
};