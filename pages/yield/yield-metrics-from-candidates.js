/**
 * yield-metrics-from-candidates.js
 *
 * 現時点では metrics.js のモック行 (mockPersonalRows / mockCompanyRows) を元に
 * 個人KPI・全社KPIを集計するユーティリティ。
 *
 * 将来的には「候補者マスタ（fetchCandidateMaster() の結果）」から
 * 歩留まりKPIを算出する実装に差し替える前提で、このファイル名にしている。
 */

// 現時点では metrics のモックデータを利用（将来ここを候補者マスタに差し替える想定）
import { mockPersonalRows, mockCompanyRows, filterMockRows } from '../../scripts/mock/metrics.js';
import { goalSettingsService } from '../../scripts/services/goalSettings.js';

const toNumber = value => {
  const numValue = Number(value);
  return Number.isFinite(numValue) ? numValue : 0;
};

const toRate = (num, den) => (den === 0 ? 0 : Math.round((1000 * num) / den) / 10);

function isoDate(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const readMetricValue = (row, keys, fallback = 0) => {
  if (!row || typeof row !== 'object') {
    return fallback;
  }
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      return toNumber(row[key]);
    }
  }
  return fallback;
};

const ensureDateLabel = row => row?.date ?? row?.period ?? row?.month ?? row?.label ?? row?.timestamp ?? null;

const normalizePersonalRow = (row = {}) => {
  const normalized = { ...row };
  const label = ensureDateLabel(row);
  if (label && !normalized.period) {
    normalized.period = label;
  }
  if (label && !normalized.date) {
    normalized.date = label;
  }
  const newInterviews = readMetricValue(row, ['new_interviews', 'newInterviews']);
  const proposals = readMetricValue(row, ['proposals']);
  const recommendations = readMetricValue(row, ['recommendations']);
  const interviewsScheduled = readMetricValue(row, ['interviews_scheduled', 'interviewsScheduled']);
  const interviewsHeld = readMetricValue(row, ['interviews_held', 'interviewsHeld']);
  const offers = readMetricValue(row, ['offers']);
  const accepts = readMetricValue(row, ['accepts']);
  const proposalRate = readMetricValue(row, ['proposal_rate', 'proposalRate']);
  const recommendationRate = readMetricValue(row, ['recommendation_rate', 'recommendationRate']);
  const interviewScheduleRate = readMetricValue(row, ['interview_schedule_rate', 'interviewScheduleRate']);
  const interviewHeldRate = readMetricValue(row, ['interview_held_rate', 'interviewHeldRate']);
  const offerRate = readMetricValue(row, ['offer_rate', 'offerRate']);
  const acceptRate = readMetricValue(row, ['accept_rate', 'acceptRate']);
  const hireRate = readMetricValue(row, ['hire_rate', 'hireRate']);
  const prevNewInterviews = readMetricValue(row, ['prev_new_interviews', 'prevNewInterviews']);
  const prevProposals = readMetricValue(row, ['prev_proposals', 'prevProposals']);
  const prevRecommendations = readMetricValue(row, ['prev_recommendations', 'prevRecommendations']);
  const prevInterviewsScheduled = readMetricValue(row, ['prev_interviews_scheduled', 'prevInterviewsScheduled']);
  const prevInterviewsHeld = readMetricValue(row, ['prev_interviews_held', 'prevInterviewsHeld']);
  const prevOffers = readMetricValue(row, ['prev_offers', 'prevOffers']);
  normalized.new_interviews = newInterviews;
  normalized.newInterviews = newInterviews;
  normalized.proposals = proposals;
  normalized.recommendations = recommendations;
  normalized.interviews_scheduled = interviewsScheduled;
  normalized.interviewsScheduled = interviewsScheduled;
  normalized.interviews_held = interviewsHeld;
  normalized.interviewsHeld = interviewsHeld;
  normalized.offers = offers;
  normalized.accepts = accepts;
  normalized.proposal_rate = proposalRate;
  normalized.proposalRate = proposalRate;
  normalized.recommendation_rate = recommendationRate;
  normalized.recommendationRate = recommendationRate;
  normalized.interview_schedule_rate = interviewScheduleRate;
  normalized.interviewScheduleRate = interviewScheduleRate;
  normalized.interview_held_rate = interviewHeldRate;
  normalized.interviewHeldRate = interviewHeldRate;
  normalized.offer_rate = offerRate;
  normalized.offerRate = offerRate;
  normalized.accept_rate = acceptRate;
  normalized.acceptRate = acceptRate;
  normalized.hire_rate = hireRate;
  normalized.hireRate = hireRate;
  normalized.prevNewInterviews = prevNewInterviews;
  normalized.prevProposals = prevProposals;
  normalized.prevRecommendations = prevRecommendations;
  normalized.prevInterviewsScheduled = prevInterviewsScheduled;
  normalized.prevInterviewsHeld = prevInterviewsHeld;
  normalized.prevOffers = prevOffers;
  return normalized;
};

const normalizeCompanyRow = (row = {}) => {
  const normalized = { ...row };
  const label = ensureDateLabel(row);
  if (label && !normalized.period) {
    normalized.period = label;
  }
  if (label && !normalized.date) {
    normalized.date = label;
  }
  const newInterviews = readMetricValue(row, ['new_interviews', 'newInterviews']);
  const proposals = readMetricValue(row, ['proposals']);
  const recommendations = readMetricValue(row, ['recommendations']);
  const interviewsScheduled = readMetricValue(row, ['interviews_scheduled', 'interviewsScheduled']);
  const interviewsHeld = readMetricValue(row, ['interviews_held', 'interviewsHeld']);
  const offers = readMetricValue(row, ['offers']);
  const accepts = readMetricValue(row, ['accepts']);
  const proposalRate = readMetricValue(row, ['proposal_rate', 'proposalRate']);
  const recommendationRate = readMetricValue(row, ['recommendation_rate', 'recommendationRate']);
  const interviewScheduleRate = readMetricValue(row, ['interview_schedule_rate', 'interviewScheduleRate']);
  const interviewHeldRate = readMetricValue(row, ['interview_held_rate', 'interviewHeldRate']);
  const offerRate = readMetricValue(row, ['offer_rate', 'offerRate']);
  const acceptRate = readMetricValue(row, ['accept_rate', 'acceptRate']);
  const hireRate = readMetricValue(row, ['hire_rate', 'hireRate']);
  const prevNewInterviews = readMetricValue(row, ['prev_new_interviews', 'prevNewInterviews']);
  const prevProposals = readMetricValue(row, ['prev_proposals', 'prevProposals']);
  const prevRecommendations = readMetricValue(row, ['prev_recommendations', 'prevRecommendations']);
  const prevInterviewsScheduled = readMetricValue(row, ['prev_interviews_scheduled', 'prevInterviewsScheduled']);
  const prevInterviewsHeld = readMetricValue(row, ['prev_interviews_held', 'prevInterviewsHeld']);
  const prevOffers = readMetricValue(row, ['prev_offers', 'prevOffers']);
  normalized.new_interviews = newInterviews;
  normalized.newInterviews = newInterviews;
  normalized.proposals = proposals;
  normalized.recommendations = recommendations;
  normalized.interviews_scheduled = interviewsScheduled;
  normalized.interviewsScheduled = interviewsScheduled;
  normalized.interviews_held = interviewsHeld;
  normalized.interviewsHeld = interviewsHeld;
  normalized.offers = offers;
  normalized.accepts = accepts;
  normalized.proposal_rate = proposalRate;
  normalized.proposalRate = proposalRate;
  normalized.recommendation_rate = recommendationRate;
  normalized.recommendationRate = recommendationRate;
  normalized.interview_schedule_rate = interviewScheduleRate;
  normalized.interviewScheduleRate = interviewScheduleRate;
  normalized.interview_held_rate = interviewHeldRate;
  normalized.interviewHeldRate = interviewHeldRate;
  normalized.offer_rate = offerRate;
  normalized.offerRate = offerRate;
  normalized.accept_rate = acceptRate;
  normalized.acceptRate = acceptRate;
  normalized.hire_rate = hireRate;
  normalized.hireRate = hireRate;
  normalized.prevNewInterviews = prevNewInterviews;
  normalized.prevProposals = prevProposals;
  normalized.prevRecommendations = prevRecommendations;
  normalized.prevInterviewsScheduled = prevInterviewsScheduled;
  normalized.prevInterviewsHeld = prevInterviewsHeld;
  normalized.prevOffers = prevOffers;
  return normalized;
};

function createEmptyPersonalMetrics() {
  const zero = {
    newInterviews: 0,
    proposals: 0,
    recommendations: 0,
    interviewsScheduled: 0,
    interviewsHeld: 0,
    offers: 0,
    accepts: 0,
    hires: 0,
    prevNewInterviews: 0,
    prevProposals: 0,
    prevRecommendations: 0,
    prevInterviewsScheduled: 0,
    prevInterviewsHeld: 0,
    prevOffers: 0,
    proposalRate: 0,
    recommendationRate: 0,
    interviewScheduleRate: 0,
    interviewHeldRate: 0,
    offerRate: 0,
    acceptRate: 0,
    hireRate: 0
  };
  return {
    achievementRate: 0,
    currentAmount: 0,
    targetAmount: 0,
    today: {
      newInterviews: 0,
      proposals: 0,
      recommendations: 0,
      interviewsScheduled: 0,
      interviewsHeld: 0,
      offers: 0,
      accepts: 0,
      hires: 0
    },
    monthly: { ...zero },
    period: { ...zero },
    rows: []
  };
}

function createEmptyCompanyMetrics() {
  return {
    newInterviews: 0,
    proposals: 0,
    recommendations: 0,
    interviewsScheduled: 0,
    interviewsHeld: 0,
    offers: 0,
    accepts: 0,
    hires: 0,
    prevNewInterviews: 0,
    prevProposals: 0,
    prevRecommendations: 0,
    prevInterviewsScheduled: 0,
    prevInterviewsHeld: 0,
    prevOffers: 0,
    prevAccepts: 0,
    prevProposalRate: 0,
    prevRecommendationRate: 0,
    prevInterviewScheduleRate: 0,
    prevInterviewHeldRate: 0,
    prevOfferRate: 0,
    prevAcceptRate: 0,
    prevHireRate: 0,
    proposalRate: 0,
    recommendationRate: 0,
    interviewScheduleRate: 0,
    interviewHeldRate: 0,
    offerRate: 0,
    acceptRate: 0,
    hireRate: 0,
    rows: []
  };
}

function transformPersonalMetrics(rows) {
  const normalizedRows = Array.isArray(rows) ? rows.map(normalizePersonalRow) : [];
  if (!normalizedRows.length) {
    return createEmptyPersonalMetrics();
  }

  const todayRow = normalizedRows[normalizedRows.length - 1];

  const sum = normalizedRows.reduce(
    (acc, row) => {
      acc.newInterviews += row.newInterviews;
      acc.proposals += row.proposals;
      acc.recommendations += row.recommendations;
      acc.interviewsScheduled += row.interviewsScheduled;
      acc.interviewsHeld += row.interviewsHeld;
      acc.offers += row.offers;
      acc.accepts += row.accepts;
      acc.prevNewInterviews += row.prevNewInterviews || 0;
      acc.prevProposals += row.prevProposals || 0;
      acc.prevRecommendations += row.prevRecommendations || 0;
      acc.prevInterviewsScheduled += row.prevInterviewsScheduled || 0;
      acc.prevInterviewsHeld += row.prevInterviewsHeld || 0;
      acc.prevOffers += row.prevOffers || 0;
      return acc;
    },
    {
      newInterviews: 0,
      proposals: 0,
      recommendations: 0,
      interviewsScheduled: 0,
      interviewsHeld: 0,
      offers: 0,
      accepts: 0,
      prevNewInterviews: 0,
      prevProposals: 0,
      prevRecommendations: 0,
      prevInterviewsScheduled: 0,
      prevInterviewsHeld: 0,
      prevOffers: 0
    }
  );

  const period = {
    newInterviews: sum.newInterviews,
    proposals: sum.proposals,
    recommendations: sum.recommendations,
    interviewsScheduled: sum.interviewsScheduled,
    interviewsHeld: sum.interviewsHeld,
    offers: sum.offers,
    accepts: sum.accepts,
    hires: sum.accepts,
    prevNewInterviews: sum.prevNewInterviews,
    prevProposals: sum.prevProposals,
    prevRecommendations: sum.prevRecommendations,
    prevInterviewsScheduled: sum.prevInterviewsScheduled,
    prevInterviewsHeld: sum.prevInterviewsHeld,
    prevOffers: sum.prevOffers,
    proposalRate: toRate(sum.proposals, sum.newInterviews),
    recommendationRate: toRate(sum.recommendations, sum.proposals),
    interviewScheduleRate: toRate(sum.interviewsScheduled, sum.recommendations),
    interviewHeldRate: toRate(sum.interviewsHeld, sum.interviewsScheduled),
    offerRate: toRate(sum.offers, sum.interviewsHeld),
    acceptRate: toRate(sum.accepts, sum.offers),
    hireRate: toRate(sum.accepts, sum.newInterviews)
  };

  const today = {
    newInterviews: todayRow.newInterviews,
    proposals: todayRow.proposals,
    recommendations: todayRow.recommendations,
    interviewsScheduled: todayRow.interviewsScheduled,
    interviewsHeld: todayRow.interviewsHeld,
    offers: todayRow.offers,
    accepts: todayRow.accepts,
    hires: todayRow.accepts
  };

  return {
    achievementRate: period.hireRate,
    currentAmount: period.accepts,
    targetAmount: period.accepts * 2,
    today,
    monthly: { ...period },
    period,
    rows: normalizedRows
  };
}

function transformCompanyMetrics(rows) {
  const normalizedRows = Array.isArray(rows) ? rows.map(normalizeCompanyRow) : [];
  if (!normalizedRows.length) {
    return createEmptyCompanyMetrics();
  }

  const totals = normalizedRows.reduce(
    (acc, row) => {
      acc.newInterviews += row.newInterviews;
      acc.proposals += row.proposals;
      acc.recommendations += row.recommendations;
      acc.interviewsScheduled += row.interviewsScheduled;
      acc.interviewsHeld += row.interviewsHeld;
      acc.offers += row.offers;
      acc.accepts += row.accepts;
      acc.prevNewInterviews += row.prevNewInterviews || 0;
      acc.prevProposals += row.prevProposals || 0;
      acc.prevRecommendations += row.prevRecommendations || 0;
      acc.prevInterviewsScheduled += row.prevInterviewsScheduled || 0;
      acc.prevInterviewsHeld += row.prevInterviewsHeld || 0;
      acc.prevOffers += row.prevOffers || 0;
      return acc;
    },
    {
      newInterviews: 0,
      proposals: 0,
      recommendations: 0,
      interviewsScheduled: 0,
      interviewsHeld: 0,
      offers: 0,
      accepts: 0,
      prevNewInterviews: 0,
      prevProposals: 0,
      prevRecommendations: 0,
      prevInterviewsScheduled: 0,
      prevInterviewsHeld: 0,
      prevOffers: 0
    }
  );

  return {
    ...totals,
    hires: totals.accepts,
    proposalRate: toRate(totals.proposals, totals.newInterviews),
    recommendationRate: toRate(totals.recommendations, totals.proposals),
    interviewScheduleRate: toRate(totals.interviewsScheduled, totals.recommendations),
    interviewHeldRate: toRate(totals.interviewsHeld, totals.interviewsScheduled),
    offerRate: toRate(totals.offers, totals.interviewsHeld),
    acceptRate: toRate(totals.accepts, totals.offers),
    hireRate: toRate(totals.accepts, totals.newInterviews),
    rows: normalizedRows
  };
}

export async function getPersonalKpiFromCandidates(startDate, endDate) {
  const rows = filterMockRows(mockPersonalRows, startDate, endDate);
  return transformPersonalMetrics(rows);
}

export async function getCompanyKpiFromCandidates(startDate, endDate) {
  const rows = filterMockRows(mockCompanyRows, startDate, endDate);
  return transformCompanyMetrics(rows);
}

function findPreviousRange(range = {}) {
  const periods = goalSettingsService.getEvaluationPeriods();
  if (!Array.isArray(periods) || !range.startDate || !range.endDate) return null;
  const idx = periods.findIndex(p => p.startDate === range.startDate && p.endDate === range.endDate);
  if (idx > 0) {
    const prev = periods[idx - 1];
    return { startDate: prev.startDate, endDate: prev.endDate };
  }
  return null;
}

function resolvePrevRange(range = {}) {
  if (range.startDate && range.endDate && range.startDate === range.endDate) {
    const prev = isoDate(new Date(range.startDate).getTime() - 24 * 60 * 60 * 1000);
    return prev ? { startDate: prev, endDate: prev } : null;
  }
  return findPreviousRange(range);
}

function countCompanyTotals(candidates, range = {}) {
  const inRange = dateStr => {
    if (!dateStr) return false;
    if (range.startDate && dateStr < range.startDate) return false;
    if (range.endDate && dateStr > range.endDate) return false;
    return true;
  };

  return candidates.reduce(
    (acc, c) => {
      const p = c.phaseDates || {};

      if (inRange(p.newInterview)) acc.newInterviews += 1;
      if (inRange(p.proposal)) acc.proposals += 1;
      if (inRange(p.recommendation)) acc.recommendations += 1;
      if (inRange(p.interviewScheduled)) acc.interviewsScheduled += 1;
      if (inRange(p.interviewHeld)) acc.interviewsHeld += 1;
      if (inRange(p.offer)) acc.offers += 1;
      if (inRange(p.accept)) acc.accepts += 1;

      return acc;
    },
    {
      newInterviews: 0,
      proposals: 0,
      recommendations: 0,
      interviewsScheduled: 0,
      interviewsHeld: 0,
      offers: 0,
      accepts: 0
    }
  );
}

export function buildCompanyKpiFromCandidates(candidates = [], { startDate, endDate } = {}) {
  const range = { startDate, endDate };
  const totals = countCompanyTotals(candidates, range);
  const prevRange = resolvePrevRange(range);
  const prevTotals = prevRange ? countCompanyTotals(candidates, prevRange) : null;

  const result = {
    ...totals,
    hires: totals.accepts,
    proposalRate: toRate(totals.proposals, totals.newInterviews),
    recommendationRate: toRate(totals.recommendations, totals.proposals),
    interviewScheduleRate: toRate(totals.interviewsScheduled, totals.recommendations),
    interviewHeldRate: toRate(totals.interviewsHeld, totals.interviewsScheduled),
    offerRate: toRate(totals.offers, totals.interviewsHeld),
    acceptRate: toRate(totals.accepts, totals.offers),
    hireRate: toRate(totals.accepts, totals.newInterviews),
    prevNewInterviews: 0,
    prevProposals: 0,
    prevRecommendations: 0,
    prevInterviewsScheduled: 0,
    prevInterviewsHeld: 0,
    prevOffers: 0,
    prevAccepts: 0,
    prevProposalRate: 0,
    prevRecommendationRate: 0,
    prevInterviewScheduleRate: 0,
    prevInterviewHeldRate: 0,
    prevOfferRate: 0,
    prevAcceptRate: 0,
    prevHireRate: 0,
    rows: []
  };

  if (prevTotals) {
    result.prevNewInterviews = prevTotals.newInterviews;
    result.prevProposals = prevTotals.proposals;
    result.prevRecommendations = prevTotals.recommendations;
    result.prevInterviewsScheduled = prevTotals.interviewsScheduled;
    result.prevInterviewsHeld = prevTotals.interviewsHeld;
    result.prevOffers = prevTotals.offers;
    result.prevAccepts = prevTotals.accepts;
    result.prevProposalRate = toRate(prevTotals.proposals, prevTotals.newInterviews);
    result.prevRecommendationRate = toRate(prevTotals.recommendations, prevTotals.proposals);
    result.prevInterviewScheduleRate = toRate(prevTotals.interviewsScheduled, prevTotals.recommendations);
    result.prevInterviewHeldRate = toRate(prevTotals.interviewsHeld, prevTotals.interviewsScheduled);
    result.prevOfferRate = toRate(prevTotals.offers, prevTotals.interviewsHeld);
    result.prevAcceptRate = toRate(prevTotals.accepts, prevTotals.offers);
    result.prevHireRate = toRate(prevTotals.accepts, prevTotals.newInterviews);
  }

  console.log('[yield] buildCompanyKpiFromCandidates', {
    startDate,
    endDate,
    prevRange,
    totals: {
      newInterviews: totals.newInterviews,
      proposals: totals.proposals,
      recommendations: totals.recommendations,
      interviewsScheduled: totals.interviewsScheduled,
      interviewsHeld: totals.interviewsHeld,
      offers: totals.offers,
      accepts: totals.accepts
    }
  });

  return result;
}

function countPersonalTotals(candidates, range = {}, advisorName = '') {
  const inRange = dateStr => {
    if (!dateStr) return false;
    if (range.startDate && dateStr < range.startDate) return false;
    if (range.endDate && dateStr > range.endDate) return false;
    return true;
  };
  return candidates.reduce(
    (acc, c) => {
      if (advisorName && c.advisorName !== advisorName) return acc;
      const p = c.phaseDates || {};

      if (inRange(p.newInterview)) acc.newInterviews += 1;
      if (inRange(p.proposal)) acc.proposals += 1;
      if (inRange(p.recommendation)) acc.recommendations += 1;
      if (inRange(p.interviewScheduled)) acc.interviewsScheduled += 1;
      if (inRange(p.interviewHeld)) acc.interviewsHeld += 1;
      if (inRange(p.offer)) acc.offers += 1;
      if (inRange(p.accept)) acc.accepts += 1;

      return acc;
    },
    {
      newInterviews: 0,
      proposals: 0,
      recommendations: 0,
      interviewsScheduled: 0,
      interviewsHeld: 0,
      offers: 0,
      accepts: 0
    }
  );
}

export function buildPersonalKpiFromCandidates(
  candidates = [],
  { startDate, endDate, advisorName = '' } = {}
) {
  const range = { startDate, endDate };
  const totals = countPersonalTotals(candidates, range, advisorName);
  const prevRange = resolvePrevRange(range);
  const prevTotals = prevRange ? countPersonalTotals(candidates, prevRange, advisorName) : null;

  const result = {
    achievementRate: 0,
    currentAmount: totals.accepts,
    targetAmount: totals.accepts * 2,
    today: { ...totals, hires: totals.accepts },
    monthly: {
      ...totals,
      hires: totals.accepts,
      proposalRate: toRate(totals.proposals, totals.newInterviews),
      recommendationRate: toRate(totals.recommendations, totals.proposals),
      interviewScheduleRate: toRate(totals.interviewsScheduled, totals.recommendations),
      interviewHeldRate: toRate(totals.interviewsHeld, totals.interviewsScheduled),
      offerRate: toRate(totals.offers, totals.interviewsHeld),
      acceptRate: toRate(totals.accepts, totals.offers),
      hireRate: toRate(totals.accepts, totals.newInterviews)
    },
    period: {
      ...totals,
      hires: totals.accepts,
      proposalRate: toRate(totals.proposals, totals.newInterviews),
      recommendationRate: toRate(totals.recommendations, totals.proposals),
      interviewScheduleRate: toRate(totals.interviewsScheduled, totals.recommendations),
      interviewHeldRate: toRate(totals.interviewsHeld, totals.interviewsScheduled),
      offerRate: toRate(totals.offers, totals.interviewsHeld),
      acceptRate: toRate(totals.accepts, totals.offers),
      hireRate: toRate(totals.accepts, totals.newInterviews)
    },
    rows: []
  };

  if (prevTotals) {
    result.period.prevNewInterviews = prevTotals.newInterviews;
    result.period.prevProposals = prevTotals.proposals;
    result.period.prevRecommendations = prevTotals.recommendations;
    result.period.prevInterviewsScheduled = prevTotals.interviewsScheduled;
    result.period.prevInterviewsHeld = prevTotals.interviewsHeld;
    result.period.prevOffers = prevTotals.offers;
    result.period.prevAccepts = prevTotals.accepts;
    result.period.prevProposalRate = toRate(prevTotals.proposals, prevTotals.newInterviews);
    result.period.prevRecommendationRate = toRate(prevTotals.recommendations, prevTotals.proposals);
    result.period.prevInterviewScheduleRate = toRate(prevTotals.interviewsScheduled, prevTotals.recommendations);
    result.period.prevInterviewHeldRate = toRate(prevTotals.interviewsHeld, prevTotals.interviewsScheduled);
    result.period.prevOfferRate = toRate(prevTotals.offers, prevTotals.interviewsHeld);
    result.period.prevAcceptRate = toRate(prevTotals.accepts, prevTotals.offers);
    result.period.prevHireRate = toRate(prevTotals.accepts, prevTotals.newInterviews);
  }

  // 月次ビューでも prev 系を参照できるようコピー
  result.monthly = { ...result.period };
  if (!prevTotals) {
    result.monthly.prevNewInterviews = 0;
    result.monthly.prevProposals = 0;
    result.monthly.prevRecommendations = 0;
    result.monthly.prevInterviewsScheduled = 0;
    result.monthly.prevInterviewsHeld = 0;
    result.monthly.prevOffers = 0;
    result.monthly.prevAccepts = 0;
    result.monthly.prevProposalRate = 0;
    result.monthly.prevRecommendationRate = 0;
    result.monthly.prevInterviewScheduleRate = 0;
    result.monthly.prevInterviewHeldRate = 0;
    result.monthly.prevOfferRate = 0;
    result.monthly.prevAcceptRate = 0;
    result.monthly.prevHireRate = 0;
  }

  return result;
}

/**
 * buildDailyMetricsFromCandidates
 * 候補者マスタ（phaseDates）から日別7KPIを集計
 */
export function buildDailyMetricsFromCandidates(
  candidates = [],
  { startDate, endDate, advisorName = null } = {}
) {
  const range = { startDate, endDate };
  const dates = enumerateDates(range.startDate, range.endDate);
  const daily = {};

  for (const d of dates) {
    daily[d] = {
      newInterviews: 0,
      proposals: 0,
      recommendations: 0,
      interviewsScheduled: 0,
      interviewsHeld: 0,
      offers: 0,
      accepts: 0
    };
  }

  const PHASE_TO_METRIC = [
    ['newInterview', 'newInterviews'],
    ['proposal', 'proposals'],
    ['recommendation', 'recommendations'],
    ['interviewScheduled', 'interviewsScheduled'],
    ['interviewHeld', 'interviewsHeld'],
    ['offer', 'offers'],
    ['accept', 'accepts']
  ];

  const inRange = dateStr => {
    if (!dateStr) return false;
    if (range.startDate && dateStr < range.startDate) return false;
    if (range.endDate && dateStr > range.endDate) return false;
    return true;
  };

  for (const c of candidates) {
    if (advisorName && c.advisorName !== advisorName) continue;
    const p = c.phaseDates || {};
    for (const [phaseKey, metricKey] of PHASE_TO_METRIC) {
      const dateStr = p[phaseKey];
      if (!inRange(dateStr)) continue;
      if (daily[dateStr]) daily[dateStr][metricKey] += 1;
    }
  }

  return daily;
}

function enumerateDates(startDate, endDate) {
  const result = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start) || Number.isNaN(end)) return result;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    result.push(d.toISOString().split('T')[0]);
  }
  return result;
}
