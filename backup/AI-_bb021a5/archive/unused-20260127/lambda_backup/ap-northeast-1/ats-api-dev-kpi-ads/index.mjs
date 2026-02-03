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

const CORS_ORIGIN = (process.env.CORS_ORIGIN || "http://localhost:8081").trim();
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization",
};

const json = (statusCode, bodyObj) => ({
  statusCode,
  headers,
  body: bodyObj === undefined ? "" : JSON.stringify(bodyObj),
});

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
  if (method === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const qs = event.queryStringParameters ?? {};
  const mode = (qs.mode || "").trim();

  // ==========================================
  // mode=performance (広告パフォーマンス分析)
  // ==========================================
  if (mode === "performance") {
    const startMonth = (qs.startMonth || "").trim(); // "YYYY-MM"
    const endMonth = (qs.endMonth || "").trim();

    if (!startMonth || !endMonth) {
      return json(400, { error: "startMonth, endMonth は必須です" });
    }

    // 日付計算
    const [sy, sm] = startMonth.split("-").map(Number);
    const [ey, em] = endMonth.split("-").map(Number);
    const startDate = new Date(sy, sm - 1, 1);
    const endDateExcl = new Date(ey, em, 1); 

    const sql = `
      -- 1. 対象期間の生成 (月単位)
      WITH target_months AS (
        SELECT generate_series($1::date, $2::date - INTERVAL '1 day', '1 month')::date AS month_start
      ),

      -- 2. コスト計算 (継続中対応・日割りロジック)
      costs AS (
        SELECT
          to_char(tm.month_start, 'YYYY-MM') AS period,
          ad.media_name,
          SUM(
            -- 金額(NULLなら0, 文字列ならカンマ除去)
            COALESCE(
              CASE 
                WHEN pg_typeof(ad.contract_amount) = 'character varying'::regtype 
                THEN REPLACE(CAST(ad.contract_amount AS TEXT), ',', '')::numeric
                ELSE ad.contract_amount::numeric
              END
            , 0)
            *
            (
              -- 【分子: 対象月との重複日数】
              -- 終了日がNULLの場合は「今日(CURRENT_DATE)」までの重複日数を計算
              (
                LEAST(
                  (tm.month_start + INTERVAL '1 month' - INTERVAL '1 day')::date, 
                  COALESCE(ad.contract_end_date, CURRENT_DATE) -- ★変更: NULLなら今日
                ) 
                - GREATEST(tm.month_start, ad.contract_start_date) 
                + 1
              )::numeric
              /
              -- 【分母: 期間日数】
              CASE 
                -- 年額の場合: 365日固定
                WHEN ad.amount_period IS NOT NULL AND (ad.amount_period ~* '^(year|yearly|年|年間|/.*年)$') THEN 365.0
                
                -- 月額の場合: その月の日数
                WHEN ad.amount_period IS NOT NULL AND (ad.amount_period ~* '^(month|monthly|月|月間|/.*月)$') THEN 
                  EXTRACT(DAY FROM (tm.month_start + INTERVAL '1 month' - INTERVAL '1 day')::date)::numeric
                
                -- その他 (一括など): 契約期間全体 (終了日がNULLなら今日までの日数)
                ELSE 
                  GREATEST(
                    (COALESCE(ad.contract_end_date, CURRENT_DATE) - ad.contract_start_date + 1), 
                    1
                  )::numeric
              END
            )
          ) AS calculated_cost
        FROM target_months tm
        JOIN ad_details ad 
          -- 期間結合: 開始日が対象月内以前 かつ (終了日がNULL または 終了日が対象月内以降)
          ON ad.contract_start_date <= (tm.month_start + INTERVAL '1 month' - INTERVAL '1 day')::date
          AND (ad.contract_end_date IS NULL OR ad.contract_end_date >= tm.month_start)
        
        WHERE
          -- ★重要: 計算上の終了日(今日)が、対象月より前になってしまう(＝未来の月)場合は計算しない
          -- これにより、未来月のコストがマイナスや不正な値になるのを防ぐ
          LEAST(
            (tm.month_start + INTERVAL '1 month' - INTERVAL '1 day')::date, 
            COALESCE(ad.contract_end_date, CURRENT_DATE)
          ) >= GREATEST(tm.month_start, ad.contract_start_date)

        GROUP BY 1, 2
      ),

      -- 3. 実績データの抽出
      apps AS (
        SELECT
          to_char(date_trunc('month', ca.created_at AT TIME ZONE 'Asia/Tokyo')::date, 'YYYY-MM') AS period,
          COALESCE(ca.apply_route, '(unknown)') AS media_name,
          ca.id AS app_id,
          ca.candidate_id,
          ca.first_interview_at,
          ca.offer_date,
          ca.join_date,
          ca.is_quit_30,
          ca.post_join_quit_date
        FROM candidate_applications ca
        WHERE ca.created_at >= $1::timestamptz AND ca.created_at < $2::timestamptz
      ),

      -- 4. KPI集計
      agg AS (
        SELECT
          a.period,
          a.media_name,
          COUNT(a.app_id) AS applications,
          COUNT(DISTINCT a.candidate_id) FILTER (WHERE c.is_effective_application) AS valid_applications,
          COUNT(a.app_id) FILTER (WHERE a.first_interview_at IS NOT NULL) AS initial_interviews,
          COUNT(a.app_id) FILTER (WHERE a.offer_date IS NOT NULL) AS offers,
          COUNT(a.app_id) FILTER (WHERE a.join_date IS NOT NULL) AS hired,
          COUNT(a.app_id) FILTER (
            WHERE a.join_date IS NOT NULL 
            AND (a.is_quit_30 = TRUE OR a.post_join_quit_date IS NOT NULL)
          ) AS early_quit,
          COALESCE(SUM(p.fee_amount), 0)::bigint AS fee_amount,
          COALESCE(SUM(p.refund_amount), 0)::bigint AS refund_amount
        FROM apps a
        LEFT JOIN candidates c ON c.id = a.candidate_id
        LEFT JOIN placements p ON p.candidate_application_id = a.app_id
        GROUP BY a.period, a.media_name
      )

      -- 5. 最終結合
      SELECT
        COALESCE(c.period, a.period) AS period,
        COALESCE(c.media_name, a.media_name) AS media_name,
        COALESCE(a.applications, 0) AS applications,
        COALESCE(a.valid_applications, 0) AS valid_applications,
        COALESCE(a.initial_interviews, 0) AS initial_interviews,
        COALESCE(a.offers, 0) AS offers,
        COALESCE(a.hired, 0) AS hired,
        COALESCE(a.early_quit, 0) AS early_quit,
        
        -- コスト
        COALESCE(c.calculated_cost, 0) AS cost,
        COALESCE(a.fee_amount, 0) AS fee_amount,
        COALESCE(a.refund_amount, 0) AS refund_amount

      FROM costs c
      FULL OUTER JOIN agg a ON c.period = a.period AND c.media_name = a.media_name
      ORDER BY 1 ASC, 2 ASC;
    `;

    let client;
    try {
      client = await pool.connect();
      const res = await client.query(sql, [ymd(startDate), ymd(endDateExcl)]);

      // 全体サマリー集計
      let totalCost = 0;
      let totalHired = 0;
      let totalApplications = 0;
      let totalValid = 0;

      const items = res.rows.map((r) => {
        const cost = Math.round(Number(r.cost || 0));
        const hired = Number(r.hired || 0);
        const fee = Number(r.fee_amount || 0);
        const earlyQuit = Number(r.early_quit || 0);
        
        totalCost += cost;
        totalHired += hired;
        totalApplications += Number(r.applications || 0);
        totalValid += Number(r.valid_applications || 0);

        const roi = cost > 0 ? Math.round(((fee - cost) / cost) * 100) : 0;
        const retention30 = hired > 0 ? Math.round(((hired - earlyQuit) / hired) * 1000) / 10 : 0;

        return {
          id: `${r.period}-${r.media_name}`,
          mediaName: r.media_name,
          period: r.period,
          applications: Number(r.applications || 0),
          validApplications: Number(r.valid_applications || 0),
          initialInterviews: Number(r.initial_interviews || 0),
          offers: Number(r.offers || 0),
          hired: hired,
          retention30: retention30,
          cost: cost,
          totalSales: fee,
          refund: Number(r.refund_amount || 0),
          roi: roi
        };
      });

      const summary = {
        totalApplications,
        totalValid,
        totalHired,
        totalCost
      };

      return json(200, { 
        range: { startMonth, endMonth }, 
        summary,
        items 
      });

    } catch (err) {
      console.error("LAMBDA ERROR:", err);
      return json(500, { error: err.message });
    } finally {
      if (client) client.release();
    }
  }

  return json(400, { error: "mode=performance required" });
};