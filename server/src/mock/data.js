const today = new Date();
const TOTAL_MONTHS = Number(process.env.MOCK_MONTHS) || 36;
const monthKey = (offset = 0) => {
  const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
};

export const mockUsers = [
  {
    id: 'mock-admin',
    name: '管理者',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin'
  },
  {
    id: 'mock-user',
    name: '一般',
    email: 'member@example.com',
    password: 'member123',
    role: 'member'
  }
];

const baseRow = (offset = 0) => {
  const period = monthKey(offset);
  const seed = TOTAL_MONTHS - offset;
  return {
    period,
    date: period,
    new_interviews: 30 + seed * 2,
    proposals: 24 + seed,
    recommendations: 20 + seed,
    interviews_scheduled: 18 + seed,
    interviews_held: 15 + seed,
    offers: 8 + seed,
    accepts: 6 + seed,
    proposal_rate: 80,
    recommendation_rate: 75,
    interview_schedule_rate: 110,
    interview_held_rate: 90,
    offer_rate: 55,
    accept_rate: 65,
    hire_rate: 50,
    prev_new_interviews: 28 + seed,
    prev_proposals: 22 + seed,
    prev_recommendations: 19 + seed,
    prev_interviews_scheduled: 17 + seed,
    prev_interviews_held: 14 + seed,
    prev_offers: 7 + seed
  };
};

export const mockPersonalRows = Array.from({ length: TOTAL_MONTHS }, (_, idx) => baseRow(idx));

export const mockCompanyRows = mockPersonalRows.map((row, idx) => ({
  ...row,
  date: row.date,
  period: row.period,
  new_interviews: row.new_interviews * 5,
  proposals: row.proposals * 4,
  recommendations: row.recommendations * 4,
  interviews_scheduled: row.interviews_scheduled * 3.5,
  interviews_held: row.interviews_held * 3.2,
  offers: row.offers * 3,
  accepts: row.accepts * 3,
  prev_new_interviews: row.prev_new_interviews * 5,
  prev_proposals: row.prev_proposals * 4,
  prev_recommendations: row.prev_recommendations * 4,
  prev_interviews_scheduled: row.prev_interviews_scheduled * 3.5,
  prev_interviews_held: row.prev_interviews_held * 3.2,
  prev_offers: row.prev_offers * 3,
  id: idx + 1
}));

export const mockEmployeeRows = ['A', 'B', 'C', 'D'].map((name, idx) => ({
  user_id: `emp-${idx + 1}`,
  user_name: `Mock ${name}`,
  user_email: `mock${name.toLowerCase()}@example.com`,
  proposals: 20 + idx * 5,
  recommendations: 15 + idx * 4,
  interviews_scheduled: 10 + idx * 3,
  interviews_held: 8 + idx * 2,
  offers: 5 + idx,
  accepts: 3 + idx,
  new_interviews: 25 + idx * 3,
  proposal_rate: 75 - idx * 2,
  recommendation_rate: 70 - idx,
  interview_schedule_rate: 110 - idx * 2,
  interview_held_rate: 90 - idx,
  offer_rate: 50 + idx,
  accept_rate: 60 + idx,
  hire_rate: 40 + idx,
  trend: mockPersonalRows.map(row => ({
    period: row.period,
    value: 5 + idx + Math.floor(Math.random() * 4)
  }))
}));

export function filterRows(rows, from, to) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(row => {
    const date = row.period || row.date;
    if (!date) return true;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  });
}
