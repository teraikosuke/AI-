-- name: personal
SELECT
  date,
  new_interviews,
  proposals,
  recommendations,
  interviews_scheduled,
  interviews_held,
  offers,
  accepts,
  ROUND(100 * proposals / NULLIF(new_interviews, 0), 1) AS proposal_rate,
  ROUND(100 * recommendations / NULLIF(proposals, 0), 1) AS recommendation_rate,
  ROUND(100 * interviews_scheduled / NULLIF(recommendations, 0), 1) AS interview_schedule_rate,
  ROUND(100 * interviews_held / NULLIF(interviews_scheduled, 0), 1) AS interview_held_rate,
  ROUND(100 * offers / NULLIF(interviews_held, 0), 1) AS offer_rate,
  ROUND(100 * accepts / NULLIF(offers, 0), 1) AS accept_rate,
  ROUND(100 * accepts / NULLIF(new_interviews, 0), 1) AS hire_rate
FROM metrics_daily
WHERE user_id = $1
  AND ($2::date IS NULL OR date >= $2::date)
  AND ($3::date IS NULL OR date <= $3::date)
ORDER BY date ASC;

-- name: company
SELECT
  date,
  SUM(new_interviews) AS new_interviews,
  SUM(proposals) AS proposals,
  SUM(recommendations) AS recommendations,
  SUM(interviews_scheduled) AS interviews_scheduled,
  SUM(interviews_held) AS interviews_held,
  SUM(offers) AS offers,
  SUM(accepts) AS accepts,
  ROUND(100 * SUM(proposals) / NULLIF(SUM(new_interviews), 0), 1) AS proposal_rate,
  ROUND(100 * SUM(recommendations) / NULLIF(SUM(proposals), 0), 1) AS recommendation_rate,
  ROUND(100 * SUM(interviews_scheduled) / NULLIF(SUM(recommendations), 0), 1) AS interview_schedule_rate,
  ROUND(100 * SUM(interviews_held) / NULLIF(SUM(interviews_scheduled), 0), 1) AS interview_held_rate,
  ROUND(100 * SUM(offers) / NULLIF(SUM(interviews_held), 0), 1) AS offer_rate,
  ROUND(100 * SUM(accepts) / NULLIF(SUM(offers), 0), 1) AS accept_rate,
  ROUND(100 * SUM(accepts) / NULLIF(SUM(new_interviews), 0), 1) AS hire_rate
FROM metrics_daily
WHERE ($1::date IS NULL OR date >= $1::date)
  AND ($2::date IS NULL OR date <= $2::date)
GROUP BY date
ORDER BY date ASC;

-- name: employees
SELECT
  u.id AS user_id,
  u.name AS user_name,
  u.email AS user_email,
  SUM(m.new_interviews) AS new_interviews,
  SUM(m.proposals) AS proposals,
  SUM(m.recommendations) AS recommendations,
  SUM(m.interviews_scheduled) AS interviews_scheduled,
  SUM(m.interviews_held) AS interviews_held,
  SUM(m.offers) AS offers,
  SUM(m.accepts) AS accepts,
  ROUND(100 * SUM(m.proposals) / NULLIF(SUM(m.new_interviews), 0), 1) AS proposal_rate,
  ROUND(100 * SUM(m.recommendations) / NULLIF(SUM(m.proposals), 0), 1) AS recommendation_rate,
  ROUND(100 * SUM(m.interviews_scheduled) / NULLIF(SUM(m.recommendations), 0), 1) AS interview_schedule_rate,
  ROUND(100 * SUM(m.interviews_held) / NULLIF(SUM(m.interviews_scheduled), 0), 1) AS interview_held_rate,
  ROUND(100 * SUM(m.offers) / NULLIF(SUM(m.interviews_held), 0), 1) AS offer_rate,
  ROUND(100 * SUM(m.accepts) / NULLIF(SUM(m.offers), 0), 1) AS accept_rate,
  ROUND(100 * SUM(m.accepts) / NULLIF(SUM(m.new_interviews), 0), 1) AS hire_rate
FROM users u
JOIN metrics_daily m ON m.user_id = u.id
WHERE ($1::date IS NULL OR m.date >= $1::date)
  AND ($2::date IS NULL OR m.date <= $2::date)
GROUP BY u.id, u.name, u.email
ORDER BY u.name ASC;

