import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: { rejectUnauthorized: false }
});

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET"
  };

  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const client = await pool.connect();

    try {
      const query = `
        SELECT
          c.id,
          c.name,
          c.industry,
          c.location,
          c.job_categories,
          
          c.contact_name,
          c.contact_email,

          -- ★追加: 契約情報カラム
          c.warranty_period,
          c.fee_details,
          c.contract_note,

          COALESCE(c.planned_hires_count, 0) AS planned_hires_count,
          
          c.salary_range,
          c.must_qualifications,
          c.nice_qualifications,
          c.desired_locations,
          c.personality_traits,
          c.required_experience,
          c.selection_note,

          COUNT(ca.id) FILTER (WHERE ca.recommended_at IS NOT NULL) AS proposal_count,
          COUNT(ca.id) FILTER (WHERE ca.stage_current = '書類選考') AS document_screening_count,
          COUNT(ca.id) FILTER (WHERE ca.first_interview_at IS NOT NULL) AS first_interview_count,
          0 AS second_interview_count,
          COUNT(ca.id) FILTER (WHERE ca.offer_date IS NOT NULL) AS offer_count,
          
          COUNT(ca.id) FILTER (WHERE ca.join_date IS NOT NULL) AS hired_count,
          COUNT(ca.id) FILTER (WHERE ca.pre_join_withdraw_date IS NOT NULL) AS pre_join_decline_count,
          COUNT(ca.id) FILTER (WHERE ca.stage_current IN ('不採用', '辞退', '失注', 'クローズ')) AS dropped_count,
          
          -- 早期退職 (保証期間内退職) の計算
          COUNT(ca.id) FILTER (
            WHERE ca.join_date IS NOT NULL 
            AND ca.post_join_quit_date IS NOT NULL
            AND (ca.post_join_quit_date::date - ca.join_date::date) <= COALESCE(c.warranty_period, 90)
          ) AS early_quit_count,

          ROUND(AVG(EXTRACT(DAY FROM (ca.join_date - ca.recommended_at))) FILTER (WHERE ca.join_date IS NOT NULL AND ca.recommended_at IS NOT NULL), 1) AS average_lead_time,

          COALESCE(SUM(p.fee_amount), 0) AS fee_amount,
          COALESCE(SUM(p.refund_amount), 0) AS refund_amount,
          
          NULL AS pre_join_decline_reason

        FROM clients c
        LEFT JOIN candidate_applications ca ON c.id = ca.client_id
        LEFT JOIN placements p ON ca.id = p.candidate_application_id
        
        GROUP BY c.id
        ORDER BY c.id ASC;
      `;

      const res = await client.query(query);

      const items = res.rows.map(row => {
        const planned = parseInt(row.planned_hires_count || 0);
        const hired = parseInt(row.hired_count || 0);
        const earlyQuit = parseInt(row.early_quit_count || 0);
        const remaining = Math.max(0, planned - hired);

        let retention = 0;
        if (hired > 0) {
          retention = ((hired - earlyQuit) / hired) * 100;
        }

        return {
          id: row.id,
          name: row.name,
          industry: row.industry || '-',
          location: row.location || '-',
          jobCategories: row.job_categories || '-',

          contactName: row.contact_name || '',
          contactEmail: row.contact_email || '',

          // ★追加: 契約情報のマッピング
          warrantyPeriod: row.warranty_period, // null許容
          feeDetails: row.fee_details || '',
          contractNote: row.contract_note || '',

          plannedHiresCount: planned,
          remainingHiringCount: remaining,
          retentionRate: parseFloat(retention.toFixed(1)),

          refundAmount: parseInt(row.refund_amount || 0),
          averageLeadTime: parseFloat(row.average_lead_time || 0),
          feeAmount: parseInt(row.fee_amount || 0),

          preJoinDeclineCount: parseInt(row.pre_join_decline_count || 0),
          preJoinDeclineReason: row.pre_join_decline_reason || '-',
          droppedCount: parseInt(row.dropped_count || 0),

          stats: {
            proposal: parseInt(row.proposal_count || 0),
            docScreen: parseInt(row.document_screening_count || 0),
            interview1: parseInt(row.first_interview_count || 0),
            interview2: parseInt(row.second_interview_count || 0),
            offer: parseInt(row.offer_count || 0),
            joined: hired,
            leadTime: parseFloat(row.average_lead_time || 0)
          },
          desiredTalent: {
            salaryRange: row.salary_range,
            mustQualifications: row.must_qualifications,
            niceQualifications: row.nice_qualifications,
            locations: row.desired_locations,
            personality: row.personality_traits,
            experiences: row.required_experience
          },
          selectionNote: row.selection_note
        };
      });

      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          meta: { period: "all_time", count: items.length },
          items: items
        }),
      };

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Database Error:', err);
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
