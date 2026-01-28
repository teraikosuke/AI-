// ==========================================
import { goalSettingsService } from '../../scripts/services/goalSettings.js';


// 状態管理変数

// ==========================================

let currentPage = 1;

let pageSize = 50;

let filteredData = [];

let allData = [];

let currentSort = 'company-asc';

let selectedCompanyId = null;

let detailEditMode = false;
let referralRateTargets = {}; // 目標値キャッシュ

const CLIENTS_KPI_API_URL = 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev/kpi/clients';
const CLIENTS_PROFILE_API_URL = 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev/clients';
const CANDIDATES_API_BASE = 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev';
const CANDIDATES_LIST_PATH = '/candidates';
const CANDIDATES_LIST_LIMIT = 500;
const CANDIDATES_MATCH_FETCH_LIMIT = 20;
const CANDIDATES_DETAIL_CONCURRENCY = 4;
const candidateDetailPath = (id) => `/candidates/${encodeURIComponent(String(id))}`;
const candidatesApi = (path) => `${CANDIDATES_API_BASE}${path}`;

let candidateSummaries = [];
let candidateSummaryPromise = null;
let candidateSummaryError = null;
const candidateDetailCache = new Map();
const candidateDetailInFlight = new Map();
let recommendedRequestId = 0;
let referralRecommendedCandidates = [];
let selectedRecommendedCandidateId = '';
const flowCandidateCache = new Map();
const flowCandidateInFlight = new Map();


// ★追加: 候補者詳細ページへの遷移用関数（グローバルに公開）

window.navigateToCandidate = function (candidateId) {
  const resolvedId = String(candidateId ?? '').trim();
  if (!resolvedId) return;

  // URLオブジェクト構築: 現在のオリジン + パス (ハッシュなし)
  const baseUrl = window.location.origin + window.location.pathname;
  const url = new URL(baseUrl);

  // クエリパラメータ設定
  url.searchParams.set('candidateId', resolvedId);
  url.searchParams.set('openDetail', '1'); // candidates.js で自動オープンさせるフラグ

  // ハッシュ設定
  url.hash = '#/candidates';

  console.log(`Navigating to candidate: ${resolvedId}`, url.toString());
  window.location.href = url.toString();
};



// ==========================================

// 初期化・終了処理

// ==========================================

export function unmount() {

  const ids = [

    'referralCompanyFilter', 'referralDateStart', 'referralDateEnd', 'referralJobFilter', 'referralFilterReset',

    'referralSortSelect', 'referralPrevBtn', 'referralNextBtn', 'referralPageSize', 'referralExportBtn',

    'matchTabCandidate', 'matchTabCondition', 'matchFromCandidate', 'matchFromCondition', 'matchResultSort',

    'referralCreateCompany', 'referralCreateJobTitle', 'referralCreatePlanHeadcount', 'referralCreateIndustry',

    'referralCreateLocation', 'referralCreateFee', 'referralCreateSelectionNote', 'referralCreateToggle', 'referralCreateSubmit',

    'referralCreateReset', 'referralCandidateModal', 'referralCandidateClose'

  ];

  ids.forEach(id => {

    const el = document.getElementById(id);

    if (el) el.replaceWith(el.cloneNode(true));

  });



  currentPage = 1;

  filteredData = [];

  allData = [];

  currentSort = 'company-asc';

  selectedCompanyId = null;

  detailEditMode = false;

  candidateSummaries = [];

  candidateSummaryPromise = null;

  candidateSummaryError = null;

  candidateDetailCache.clear();

  candidateDetailInFlight.clear();

  recommendedRequestId = 0;
  referralRecommendedCandidates = [];
  selectedRecommendedCandidateId = '';
  flowCandidateCache.clear();
  flowCandidateInFlight.clear();
  closeReferralCandidateModal();

}



// ==========================================

// データ取得・正規化

// ==========================================

async function loadReferralData() {
  // 目標値をロード
  await loadReferralRateTargets();

  const from = document.getElementById('referralDateStart')?.value || '';

  const to = document.getElementById('referralDateEnd')?.value || '';

  const job = document.getElementById('referralJobFilter')?.value || '';



  const url = new URL(CLIENTS_KPI_API_URL);

  if (from) url.searchParams.set('from', from);

  if (to) url.searchParams.set('to', to);

  if (job) url.searchParams.set('job', job);



  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });

  if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);



  const json = await res.json();

  const items = Array.isArray(json?.items) ? json.items : (Array.isArray(json) ? json : []);



  allData = items.map((item, index) => normalizeReferralItem(item, index));

  // Don't auto-select any company
  selectedCompanyId = null;



  applyFilters();

}



function normalizeReferralItem(item = {}, index = 0) {

  const val = (keys, def = null) => {

    for (const k of keys) {

      if (item[k] !== undefined && item[k] !== null) return item[k];

      if (item.stats && item.stats[k] !== undefined && item.stats[k] !== null) return item.stats[k];

    }

    return def;

  };

  const num = (keys, def = 0) => {

    const v = val(keys);

    const n = Number(v);

    return Number.isFinite(n) ? n : def;

  };

  const str = (keys, def = '') => {

    const v = val(keys);

    return v ? String(v).trim() : def;

  };



  const id = str(['id', 'companyId'], `temp-${index}`);

  const company = str(['name', 'companyName', 'company'], '-');

  const industry = str(['industry'], '-');
  const contactName = str(['contactName', 'contact_name', 'contact', 'contactPerson', 'contact_person'], '');
  const contactEmail = str(['contactEmail', 'contact_email'], '');
  const contact = contactName || contactEmail || '-';
  const location = str(['location', 'workLocation'], '-');



  const planHeadcount = num(['plannedHiresCount', 'planHeadcount', 'plan_headcount']);

  const joined = num(['hiredCount', 'joined', 'count_joined']);



  let remaining = num(['remainingHiringCount', 'remaining', 'remaining_hiring_count'], -999);

  if (remaining === -999) remaining = Math.max(planHeadcount - joined, 0);



  const retentionRaw = val(['retentionRate', 'retention', 'retention_rate']);

  // 入社数が0の場合は定着率を'-'とする
  // 入社数が0の場合は定着率を'-'とする
  const retention = joined === 0 ? '-' : formatRetention(retentionRaw, 'referralRetentionRateTarget');

  const warrantyPeriodRaw = val(['warrantyPeriod', 'warranty_period'], null);
  const warrantyPeriod = warrantyPeriodRaw === null || warrantyPeriodRaw === '' ? null : warrantyPeriodRaw;
  const feeDetails = str(['feeDetails', 'fee_details', 'feeContract', 'fee_contract'], '');
  const contractNote = str(['contractNote', 'contract_note', 'contractNotes', 'contract_notes'], '');



  const refundAmount = num(['refundAmount', 'refund_amount']);

  const leadTime = num(['averageLeadTime', 'leadTime', 'avg_lead_time'], 0);

  const feeRaw = num(['feeAmount', 'fee', 'fee_amount']);

  const feeDisplay = formatFee(feeRaw);

  const feeValue = feeRaw;



  const proposal = num(['proposalCount', 'proposal', 'count_proposal']);

  const docScreen = num(['documentScreeningCount', 'docScreen', 'count_doc_screen']);

  const interview1 = num(['firstInterviewCount', 'interview1', 'count_interview_1']);

  const interview2 = num(['secondInterviewCount', 'interview2', 'count_interview_2']);

  const offer = num(['offerCount', 'offer', 'count_offer']);



  const jobCategories = str(['jobCategories', 'jobTitle', 'job_categories'], '-');
  const jobTitle = jobCategories || '-';

  const highlightPosition = str(['highlightPosition', 'highlight'], jobTitle);



  const prejoinDeclines = num(['preJoinDeclineCount', 'prejoinDeclines', 'pre_join_decline_count']);

  const prejoinDeclineReason = str(['preJoinDeclineReason', 'prejoinDeclineReason', 'pre_join_decline_reason'], '-');

  const dropoutCount = num(['droppedCount', 'dropoutCount', 'dropped_count']);



  const selectionNote = str(['selectionNote', 'selection_note', 'selectionMemo', 'selection_memo'], '');

  const desiredTalentSource = item.desiredTalent || item.talent || {

    salaryRange: val(['salaryRange', 'salary_range']),

    locations: val(['desiredLocations', 'desired_locations', 'locations']),

    mustQualifications: val(['mustQualifications', 'must_qualifications']),

    niceQualifications: val(['niceQualifications', 'nice_qualifications']),

    personality: val(['personalityTraits', 'personality_traits', 'personality']),

    experiences: val(['requiredExperience', 'required_experience', 'experiences'])

  };

  const desiredTalent = normalizeDesiredTalent(desiredTalentSource);

  const currentCandidates = normalizeCandidates(
    item.currentCandidates ||
    item.current_candidates ||
    item.candidates ||
    item.candidate_list ||
    []
  );


  return {

    id, company, industry, contact, contactName, contactEmail, location,

    planHeadcount, joined, remaining,

    retention, warrantyPeriod, feeDetails, feeContract: feeDetails, contractNote, contractNotes: contractNote, refundAmount, leadTime, feeDisplay, feeValue,

    proposal, docScreen, interview1, interview2, offer,

    jobTitle, jobCategories, highlightPosition,

    prejoinDeclines, prejoinDeclineReason, dropoutCount,

    desiredTalent, currentCandidates, selectionNote

  };

}



// ==========================================

// ヘルパー関数

// ==========================================

function formatRetention(val, targetKey) {
  if (val !== null && val !== undefined && val !== '') {
    const n = parseFloat(val);
    if (!isNaN(n)) {
      const display = n <= 1 ? `${Math.round(n * 100)}%` : `${n}%`;
      const badgeClass = getRateBadgeClass(n <= 1 ? n * 100 : n, 'clientRetentionRate');
      return `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badgeClass}">${display}</span>`;
    }
    if (typeof val === 'string' && val.includes('%')) return val;
  }
  return '-';
}

function getRateBadgeClass(actualRate, targetKey) {
  if (!targetKey || !referralRateTargets[targetKey]) return 'bg-slate-100 text-slate-700'; // 目標未設定
  const targetRate = Number(referralRateTargets[targetKey]);
  if (!Number.isFinite(targetRate) || targetRate <= 0) return 'bg-slate-100 text-slate-700';

  const percentage = (actualRate / targetRate) * 100;
  if (percentage >= 100) return 'bg-green-100 text-green-700';
  if (percentage >= 80) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

async function loadReferralRateTargets() {
  try {
    await goalSettingsService.load();
    const periods = goalSettingsService.getEvaluationPeriods();
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    const currentPeriod = goalSettingsService.getPeriodByDate(todayStr, periods);
    if (currentPeriod?.id) {
      referralRateTargets = await goalSettingsService.loadPageRateTargets(currentPeriod.id) || {};
    }
  } catch (error) {
    console.warn('[referral] failed to load rate targets', error);
    referralRateTargets = {};
  }
}



function formatFee(val) {

  if (!val) return '-';

  if (val > 100) return `${val.toLocaleString()}`;
  const rate = val <= 1 ? val * 100 : val;

  return `${Math.round(rate)}%`;

}



function formatCurrency(val) {

  return val == null ? '-' : `${Number(val).toLocaleString('ja-JP')}`;
}



function formatDateString(dateStr) {

  if (!dateStr) return '-';

  const d = new Date(dateStr);

  if (isNaN(d)) return dateStr;

  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

}



function normalizeText(str) {

  if (!str) return '';

  return str.normalize('NFKC').toLowerCase().replace(/[\u30a1-\u30f6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));

}



function normalizeCompanyName(value) {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  return normalized
    .replace(/[()\[\]【】（）]/g, '')
    .replace(/(株式会社|\(株\)|（株）|㈱|有限会社|\(有\)|（有）|合同会社|合名会社|合資会社|inc\.?|ltd\.?|co\.?|company|corp\.?|corporation|limited)/gi, '')
    .replace(/[・･\s　.,\-_/]/g, '')
    .trim();
}

function normalizeListToken(token) {
  let value = String(token ?? '').trim();

  if (!value) return '';

  const lower = value.toLowerCase();

  if (lower === 'null' || lower === 'undefined') return '';

  value = value.replace(/^[\[{"']+/, '').replace(/[\]}"']+$/, '');

  if (!value) return '';

  if (!value.replace(/[\s\[\]\{\}"'\\]+/g, '')) return '';

  return value;

}







function sanitizeList(list) {

  if (!Array.isArray(list)) return [];

  return list.map(normalizeListToken).filter(Boolean);

}



function parsePostgresArray(raw) {

  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();

  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;

  const inner = trimmed.slice(1, -1);

  if (!inner) return [];

  const items = [];

  let current = '';

  let inQuotes = false;

  let escape = false;



  for (let i = 0; i < inner.length; i += 1) {

    const ch = inner[i];

    if (escape) {

      current += ch;

      escape = false;

      continue;

    }

    if (ch === '\\') {

      escape = true;

      continue;

    }

    if (ch === '"') {

      inQuotes = !inQuotes;

      continue;

    }

    if (ch === ',' && !inQuotes) {

      items.push(current);

      current = '';

      continue;

    }

    current += ch;

  }

  items.push(current);

  return items.map((item) => item.trim()).filter((item) => item !== '');

}





// ヘルパー: 求める人材データの正規化（修正版）

function normalizeDesiredTalent(src) {

  // リスト項目（資格や勤務地など）を配列化するヘルパー

  const list = (k) => {

    const raw = src[k];

    if (Array.isArray(raw)) return sanitizeList(raw);

    if (typeof raw === 'string') {

      const trimmed = raw.trim();

      if (!trimmed) return [];

      const lower = trimmed.toLowerCase();

      if (lower === 'null' || lower === 'undefined' || trimmed === '{}' || trimmed === '[]') return [];

      if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {

        try {

          const parsed = JSON.parse(trimmed);

          if (Array.isArray(parsed)) return sanitizeList(parsed);

          return [];

        } catch (e) {

          // fall through

        }

      }

      const pgArray = parsePostgresArray(trimmed);

      if (pgArray !== null) return sanitizeList(pgArray);

      return sanitizeList(trimmed.split(/[,\u3001\n\s]+/));

    }

    return [];

  };



  // ★修正: 年収レンジ（文字列）を数値配列 [min, max] に変換する処理を追加

  let salaryRange = [0, 0];



  if (Array.isArray(src.salaryRange) && src.salaryRange.length >= 2) {

    // 既に配列の場合

    salaryRange = [Number(src.salaryRange[0]), Number(src.salaryRange[1])];

  } else if (typeof src.salaryRange === 'string') {

    // 文字列の場合 (例: "600万?900万", "600-900")

    // 数字だけを抜き出して配列にする

    const nums = src.salaryRange.match(/\d+/g);

    if (nums && nums.length >= 2) {

      salaryRange = [parseInt(nums[0], 10), parseInt(nums[1], 10)];

    } else if (nums && nums.length === 1) {

      // 数字が1つしかない場合 (例: "500万以上") -> [500, 0] とする

      salaryRange = [parseInt(nums[0], 10), 0];

    }

  }



  return {

    salaryRange: salaryRange,

    locations: list('locations'), // DBカラム: desired_locations

    mustQualifications: list('mustQualifications'),

    niceQualifications: list('niceQualifications'),

    personality: list('personality'), // DBカラム: personality_traits (マッピング注意)

    experiences: list('experiences')  // DBカラム: required_experience

  };

}



function normalizeCandidates(list) {
  if (!Array.isArray(list)) return [];
  return list.map(c => {
    const rawStage = c.stage || c.status || c.stageCurrent || c.stage_current || c.phase || c.step || c.progress;
    const stageKey = normalizeCandidateStageKey(rawStage);
    const stageLabel = rawStage ? String(rawStage).trim() : '';
    return {
      id: c.id || c.candidateId || c.candidate_id || '',
      name: c.name || c.candidateName || c.candidate_name || '-',
      stage: stageKey || stageLabel || '-',
      stageKey,
      stageLabel,
      date: c.date || c.registeredAt || c.recommendedAt || c.createdAt || '-',
      note: c.note || c.memo || ''
    };
  });
}

const PHASE_FLOW_ORDER = [
  '推薦',
  '書類',
  '一次',
  '二次',
  '内定',
  '入社'
];

const PHASE_FLOW_COLORS = [
  'bg-slate-400',
  'bg-sky-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-orange-500',
  'bg-rose-500',
  'bg-fuchsia-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-green-600',
  'bg-red-500',
  'bg-slate-500'
];

const PHASE_FLOW_INDEX = PHASE_FLOW_ORDER.reduce((acc, key, idx) => {
  acc[key] = idx;
  return acc;
}, {});

function normalizeCandidateStageKey(stage) {
  if (!stage && stage !== 0) return '';
  const text = String(stage).trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  const includesAny = (patterns) => patterns.some((pattern) => {
    const target = String(pattern);
    return lower.includes(target.toLowerCase()) || text.includes(target);
  });

  if (PHASE_FLOW_INDEX[text] !== undefined) return text;

  if (includesAny(['入社', '入社済', '入社予定', '採用', '就業', 'joined', 'hire', 'hired'])) return '入社';
  if (includesAny(['内定', '内諾', '内定承諾', '内定承諾待ち', 'オファー', 'offer', '承諾', 'accept'])) return '内定';
  if (includesAny(['二次', '2次', 'second', '2nd'])) return '二次';
  if (includesAny(['一次', '1次', 'first', '1st', '面接', '面談', '初回', '面接設定', '一次面接調整', '初回面談設定', 'interview'])) return '一次';
  if (includesAny(['書類選考', '書類通過', '書類', 'document', 'doc', 'docscreen', 'doc_screen', 'document_screening'])) return '書類';
  if (includesAny(['推薦', '推薦済', '提案', '提案済', '応募', '応募済', 'エントリー', 'proposal', 'recommend', 'entry', 'apply', 'application', 'new', '未接触', '架電', 'sms', '通電'])) return '推薦';

  return '';
}

function resolveCandidatePhaseForFlow(candidate) {
  const tokens = [];
  const addTokens = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => addTokens(entry));
      return;
    }
    String(value).split(/[\/／]/).forEach((part) => {
      const trimmed = String(part).trim();
      if (trimmed) tokens.push(trimmed);
    });
  };

  addTokens(candidate?.phases);
  addTokens(candidate?.phase);
  addTokens(candidate?.stage);
  addTokens(candidate?.status);

  let bestKey = '';
  let bestLabel = '';
  let bestIndex = -1;

  tokens.forEach((token) => {
    const key = normalizeCandidateStageKey(token);
    if (!key) return;
    const idx = PHASE_FLOW_INDEX[key] ?? -1;
    if (idx > bestIndex) {
      bestIndex = idx;
      bestKey = key;
      bestLabel = token;
    }
  });

  if (!bestKey && tokens.length) {
    const fallback = tokens[0];
    return { stageKey: normalizeCandidateStageKey(fallback), stageLabel: fallback };
  }

  return { stageKey: bestKey, stageLabel: bestLabel };
}

function resolveCandidatePhaseForCompany(candidate, companyName) {
  if (!candidate) return { stageKey: '', stageLabel: '' };
  const base = resolveCandidatePhaseForFlow(candidate);
  const selectionProgress = Array.isArray(candidate?.selectionProgress) ? candidate.selectionProgress : [];
  if (!selectionProgress.length || !companyName) return base;

  const targetRaw = normalizeText(companyName);
  const targetKey = normalizeCompanyName(companyName);
  if (!targetRaw && !targetKey) return base;

  const tokens = [];
  selectionProgress.forEach((row) => {
    const rowName = row?.companyName ?? row?.clientName ?? row?.company_name ?? row?.client_name ?? '';
    if (!rowName) return;
    const rowRaw = normalizeText(rowName);
    const rowKey = normalizeCompanyName(rowName);
    const match = (targetKey && rowKey && (rowKey === targetKey || rowKey.includes(targetKey) || targetKey.includes(rowKey)))
      || (targetRaw && rowRaw && (rowRaw === targetRaw || rowRaw.includes(targetRaw) || targetRaw.includes(rowRaw)));
    if (!match) return;
    const status = row?.status ?? row?.stage_current ?? row?.stage ?? '';
    if (status) tokens.push(status);
  });

  if (!tokens.length) return base;
  return resolveCandidatePhaseForFlow({ phases: tokens });
}

function buildFlowCandidatesFromSummaries(company, summaries = candidateSummaries) {
  if (!Array.isArray(summaries) || !summaries.length) return [];
  const companyName = company?.company || company?.companyName || '';
  const targetRaw = normalizeText(companyName);
  const targetKey = normalizeCompanyName(companyName);
  if (!targetRaw && !targetKey) return [];

  return summaries
    .filter((candidate) => {
      const candName = candidate?.companyName || '';
      const candRaw = normalizeText(candName);
      const candKey = normalizeCompanyName(candName);
      if (!candRaw && !candKey) return false;
      if (targetKey && candKey && (candKey === targetKey || candKey.includes(targetKey) || targetKey.includes(candKey))) return true;
      if (targetRaw && candRaw && (candRaw === targetRaw || candRaw.includes(targetRaw) || targetRaw.includes(candRaw))) return true;
      return false;
    })
    .map((candidate) => {
      const phaseInfo = resolveCandidatePhaseForCompany(candidate, companyName);
      const stageLabel = phaseInfo.stageLabel || candidate?.phase || '';
      return {
        id: candidate?.id || '',
        name: candidate?.name || '-',
        stage: phaseInfo.stageKey || stageLabel || '-',
        stageKey: phaseInfo.stageKey,
        stageLabel: stageLabel,
        date: candidate?.registeredAt || candidate?.date || '-',
        note: candidate?.note || ''
      };
    })
    .filter((candidate) => candidate.stageKey || candidate.stageLabel);
}

async function fetchFlowCandidatesForCompany(company) {
  const rawName = company?.company || company?.companyName || '';
  const companyName = rawName && String(rawName).trim() !== '-' ? String(rawName).trim() : '';
  if (!companyName) return [];
  const key = normalizeCompanyName(companyName) || normalizeText(companyName);
  if (!key) return [];
  if (flowCandidateCache.has(key)) return flowCandidateCache.get(key);
  if (flowCandidateInFlight.has(key)) return flowCandidateInFlight.get(key);

  const request = (async () => {
    try {
      const url = new URL(candidatesApi(CANDIDATES_LIST_PATH));
      if (companyName) url.searchParams.set('company', companyName);
      url.searchParams.set('limit', String(CANDIDATES_LIST_LIMIT));
      const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const items = Array.isArray(json?.items) ? json.items : [];
      const normalized = items.map(normalizeCandidateSummaryForMatch);
      flowCandidateCache.set(key, normalized);
      return normalized;
    } catch (err) {
      console.error('company flow candidate fetch failed:', err);
      flowCandidateCache.set(key, []);
      return [];
    } finally {
      flowCandidateInFlight.delete(key);
    }
  })();

  flowCandidateInFlight.set(key, request);
  request.then(() => {
    const companyId = company?.id ?? company?.companyId ?? '';
    if (companyId && String(selectedCompanyId) === String(companyId)) {
      renderCompanyDetail();
    }
  });
  return request;
}

function getFlowCandidates(company) {
  const direct = Array.isArray(company?.currentCandidates) ? company.currentCandidates : [];
  if (direct.length) return direct;

  const fromSummaries = buildFlowCandidatesFromSummaries(company);
  if (fromSummaries.length) return fromSummaries;

  const rawName = company?.company || company?.companyName || '';
  const companyName = rawName && String(rawName).trim() !== '-' ? String(rawName).trim() : '';
  const key = normalizeCompanyName(companyName) || normalizeText(companyName);
  if (!key) return fromSummaries;

  if (flowCandidateCache.has(key)) {
    return buildFlowCandidatesFromSummaries(company, flowCandidateCache.get(key));
  }

  if (!flowCandidateInFlight.has(key)) {
    fetchFlowCandidatesForCompany(company);
  }
  return fromSummaries;
}

// ==========================================
// 候補者データ取得・マッチング用正規化
// ==========================================
function splitCandidateList(value) {
  if (Array.isArray(value)) return sanitizeList(value);
  if (!value) return [];
  return sanitizeList(String(value).split(/[,\u3001\n/]+/));
}

function uniqueList(...lists) {
  const set = new Set();
  lists.flat().forEach((item) => {
    const token = normalizeListToken(item);
    if (token) set.add(token);
  });
  return Array.from(set);
}

function parseSalaryValue(value) {
  if (value === null || value === undefined) return 0;
  const normalizeToMan = (num, raw) => {
    if (!Number.isFinite(num) || num <= 0) return 0;
    const rawText = String(raw ?? '');
    if (rawText.includes('万')) return Math.round(num);
    if (num >= 10000) return Math.floor(num / 10000);
    return Math.round(num);
  };
  if (Array.isArray(value)) {
    const nums = value
      .map(v => String(v).match(/\d+/g))
      .flat()
      .filter(Boolean)
      .map(n => Number(n))
      .filter(Number.isFinite);
    if (!nums.length) return 0;
    const avg = Math.round(nums.reduce((sum, num) => sum + num, 0) / nums.length);
    return normalizeToMan(avg, value);
  }
  const nums = String(value).match(/\d+/g);
  if (!nums || !nums.length) return 0;
  const base = nums.length >= 2
    ? Math.round((Number(nums[0]) + Number(nums[1])) / 2)
    : Number(nums[0]);
  return normalizeToMan(base, value);
}

function calculateAgeFromDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date)) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age -= 1;
  return age;
}

function formatCandidateField(value, fallback = '-') {
  const text = String(value ?? '').trim();
  return text ? text : fallback;
}

function formatCandidateAgeText(value) {
  const num = Number(value);
  return Number.isFinite(num) ? `${num}\u6b73` : '-';
}

function formatCandidateSalaryText(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '-';
  return `${num.toLocaleString('ja-JP')}\u4e07\u5186`;
}

function formatCandidateListText(list) {
  const items = Array.isArray(list) ? sanitizeList(list) : splitCandidateList(list);
  return items.length ? items.join(' / ') : '-';
}

function resolveCandidatePhaseText(candidate) {
  const phases = Array.isArray(candidate?.phases) ? candidate.phases : splitCandidateList(candidate?.phases ?? candidate?.phase ?? candidate?.status ?? '');
  if (phases.length) return phases.join(' / ');
  const phaseInfo = resolveCandidatePhaseForFlow(candidate || {});
  return phaseInfo.stageLabel || candidate?.phase || '-';
}

function normalizeCandidateSummaryForMatch(candidate) {
  const id = candidate?.id ?? candidate?.candidate_id ?? candidate?.candidateId ?? '';
  const name = candidate?.candidateName ?? candidate?.candidate_name ?? candidate?.name ?? '-';
  const title = candidate?.jobName ?? candidate?.job_name ?? candidate?.applyJobName ?? candidate?.apply_job_name ?? '-';
  const address = candidate?.address ?? [candidate?.addressPref, candidate?.addressCity, candidate?.addressDetail].filter(Boolean).join('');
  const note = candidate?.memo ?? candidate?.note ?? '';
  const companyName = candidate?.companyName ?? candidate?.company_name ?? candidate?.applyCompanyName ?? candidate?.apply_company_name ?? candidate?.clientName ?? candidate?.client_name ?? '';
  const phase = candidate?.phase ?? candidate?.phase_current ?? candidate?.status ?? candidate?.stage_current ?? candidate?.stageCurrent ?? candidate?.new_status ?? '';
  const phasesRaw = candidate?.phases ?? candidate?.phaseList ?? candidate?.phase_list ?? '';
  const phases = Array.isArray(phasesRaw) ? phasesRaw : splitCandidateList(phasesRaw);
  const registeredAt = candidate?.registeredAt ?? candidate?.created_at ?? candidate?.createdAt ?? '';
  const selectionProgress = Array.isArray(candidate?.selectionProgress ?? candidate?.selection_progress)
    ? (candidate?.selectionProgress ?? candidate?.selection_progress)
    : [];

  return {
    id: id ? String(id) : '',
    name: name || '-',
    title: title || '-',
    age: '-',
    salary: 0,
    location: address || '-',
    qualifications: [],
    skills: [],
    personality: [],
    note: note || '',
    companyName,
    phase,
    phases,
    registeredAt,
    selectionProgress
  };
}

function normalizeCandidateDetailForMatch(candidate) {
  const summary = normalizeCandidateSummaryForMatch(candidate);
  const title = candidate?.desiredJobType ?? candidate?.desired_job_type ?? candidate?.applyJobName ?? candidate?.apply_job_name ?? candidate?.jobName ?? candidate?.job_name ?? summary.title;
  const location = candidate?.desiredLocation ?? candidate?.desired_location ?? candidate?.address ?? summary.location;
  const ageValue = Number(candidate?.age);
  const birthday = candidate?.birthday ?? candidate?.birth_date ?? candidate?.birthDate ?? candidate?.birthdate ?? '';
  const age = Number.isFinite(ageValue) ? ageValue : calculateAgeFromDate(birthday);
  const salary = parseSalaryValue(candidate?.desiredIncome ?? candidate?.desired_income ?? candidate?.currentIncome ?? candidate?.current_income ?? candidate?.salary);
  const skills = splitCandidateList(candidate?.skills ?? candidate?.skills_text ?? '');
  const personality = splitCandidateList(candidate?.personality ?? candidate?.personality_text ?? '');
  const experiences = splitCandidateList(candidate?.workExperience ?? candidate?.work_experience ?? candidate?.work_experience_text ?? '');
  const qualifications = splitCandidateList(candidate?.mandatoryInterviewItems ?? candidate?.mandatory_interview_items ?? '');
  const note = candidate?.applicationNote ?? candidate?.application_note ?? candidate?.memo ?? candidate?.note ?? summary.note;
  const phase = candidate?.phase ?? candidate?.phase_current ?? candidate?.status ?? summary.phase ?? '';
  const phases = Array.isArray(candidate?.phases) ? candidate.phases : summary.phases ?? [];
  const registeredAt = candidate?.registeredAt ?? candidate?.created_at ?? candidate?.createdAt ?? candidate?.registered_at ?? summary.registeredAt ?? '';
  const applyCompanyName = candidate?.applyCompanyName ?? candidate?.apply_company_name ?? candidate?.companyName ?? candidate?.company_name ?? summary.companyName ?? '';
  const applyJobName = candidate?.applyJobName ?? candidate?.apply_job_name ?? candidate?.jobName ?? candidate?.job_name ?? summary.title ?? '';
  const applyRouteText = candidate?.applyRouteText ?? candidate?.apply_route_text ?? candidate?.source ?? '';
  const validApplication = candidate?.validApplication ?? candidate?.valid_application ?? candidate?.is_effective_application ?? candidate?.active_flag ?? null;
  const phone = candidate?.phone ?? candidate?.phone_number ?? candidate?.tel ?? '';
  const email = candidate?.email ?? candidate?.email_address ?? '';
  const selectionProgress = Array.isArray(candidate?.selectionProgress ?? candidate?.selection_progress)
    ? (candidate?.selectionProgress ?? candidate?.selection_progress)
    : [];

  return {
    id: summary.id,
    name: summary.name,
    title: title || '-',
    age: age ?? '-',
    salary: Number.isFinite(salary) ? salary : 0,
    location: location || '-',
    qualifications,
    skills: uniqueList(skills, experiences),
    personality,
    note: note || '',
    phase,
    phases,
    registeredAt,
    applyCompanyName,
    applyJobName,
    applyRouteText,
    validApplication,
    phone,
    email,
    selectionProgress
  };
}

async function loadCandidateSummaries() {
  if (candidateSummaryPromise) return candidateSummaryPromise;

  candidateSummaryPromise = (async () => {
    try {
      candidateSummaryError = null;
      const url = new URL(candidatesApi(CANDIDATES_LIST_PATH));
      url.searchParams.set('limit', String(CANDIDATES_LIST_LIMIT));
      const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const items = Array.isArray(json?.items) ? json.items : [];
      candidateSummaries = items.map(normalizeCandidateSummaryForMatch);
      return candidateSummaries;
    } catch (err) {
      console.error('候補者一覧の取得に失敗しました:', err);
      candidateSummaryError = err;
      candidateSummaries = [];
      candidateSummaryPromise = null;
      return [];
    }
  })();

  return candidateSummaryPromise;
}

async function fetchCandidateDetailForMatch(candidateId, fallback) {
  const id = String(candidateId || '').trim();
  if (!id) return fallback || null;
  if (candidateDetailCache.has(id)) return candidateDetailCache.get(id);
  if (candidateDetailInFlight.has(id)) return candidateDetailInFlight.get(id);

  const request = (async () => {
    try {
      const res = await fetch(candidatesApi(candidateDetailPath(id)), { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const normalized = normalizeCandidateDetailForMatch(data);
      candidateDetailCache.set(id, normalized);
      return normalized;
    } catch (err) {
      console.error(`候補者詳細の取得に失敗しました: ${id}`, err);
      if (fallback) {
        candidateDetailCache.set(id, fallback);
        return fallback;
      }
      return null;
    } finally {
      candidateDetailInFlight.delete(id);
    }
  })();

  candidateDetailInFlight.set(id, request);
  return request;
}

async function fetchCandidateDetailsWithLimit(candidates, limit) {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const results = new Array(candidates.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < candidates.length) {
      const index = cursor;
      cursor += 1;
      const candidate = candidates[index];
      if (!candidate?.id) {
        results[index] = candidate || null;
        continue;
      }
      results[index] = await fetchCandidateDetailForMatch(candidate.id, candidate);
    }
  };

  const workers = Array.from(
    { length: Math.min(limit, candidates.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results.filter(Boolean);
}

function computeRoughCandidateScore(company, candidate) {
  let score = 0;
  const jobTitle = String(company?.jobTitle || company?.highlightPosition || '');
  const candTitle = String(candidate?.title || '');
  if (jobTitle && candTitle) {
    const normJob = normalizeText(jobTitle);
    const normCand = normalizeText(candTitle);
    if (normCand.includes(normJob) || normJob.includes(normCand)) score += 30;
  }
  const desiredLocations = sanitizeList(company?.desiredTalent?.locations);
  if (desiredLocations.length) {
    const candLocation = normalizeText(candidate?.location || '');
    if (desiredLocations.some((loc) => candLocation.includes(normalizeText(loc)))) score += 15;
  }
  return score;
}

function buildRecommendedCandidatesHtml(recommended) {
  if (!recommended.length) {
    return '<div class="text-xs text-slate-400">\u30de\u30c3\u30c1\u3059\u308b\u5019\u88dc\u8005\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3067\u3057\u305f</div>';
  }
  return recommended.map(c => {
    const ageText = formatCandidateAgeText(c.age);
    const salaryText = formatCandidateSalaryText(c.salary);
    const skillText = formatCandidateListText(c.skills);
    const isActive = selectedRecommendedCandidateId && String(c.id) === String(selectedRecommendedCandidateId);
    const activeClass = isActive ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-indigo-100';
    return `
      <div class="border ${activeClass} rounded-lg p-3 bg-white shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-colors cursor-pointer"
           data-action="select-recommended-candidate"
           data-candidate-id="${c.id}"
           data-candidate-card="true">
        <div>
          <div class="flex items-center justify-between mb-1">
            <div class="font-bold text-slate-800 text-left">${c.name}</div>
            <span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-bold">${c.matchScore}\u70b9</span>
          </div>
          <div class="text-xs text-slate-500 mb-2">${c.title} / ${ageText}</div>
          <div class="text-xs text-slate-600 space-y-1">
            <div>
              <span class="text-[10px] text-slate-400 font-semibold">\u52e4\u52d9\u5730</span>
              <span class="ml-1">${formatCandidateField(c.location)}</span>
              <span class="mx-1 text-slate-300">/</span>
              <span class="text-[10px] text-slate-400 font-semibold">\u5e74\u53ce</span>
              <span class="ml-1">${salaryText}</span>
            </div>
            <div class="truncate text-slate-500" title="${skillText}">
              <span class="text-[10px] text-slate-400 font-semibold">\u30b9\u30ad\u30eb</span>
              <span class="ml-1">${skillText}</span>
            </div>
          </div>
          ${c.matchReasons && c.matchReasons.length
        ? `<div class="mt-2 flex flex-wrap gap-1 text-[10px]">${c.matchReasons.map(reason => `<span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full">${reason}</span>`).join('')}</div>`
        : '<div class="mt-2 text-[10px] text-slate-400">\u4e00\u81f4\u30dd\u30a4\u30f3\u30c8\u306a\u3057</div>'}
        </div>
        <div class="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
          ${c.note || ''}
        </div>
      </div>
    `;
  }).join('');
}

function buildReferralCandidateQuickViewHtml(candidate, state = {}) {
  if (state.loading) {
    return `<div class="text-xs text-slate-500">\u5019\u88dc\u8005\u60c5\u5831\u3092\u53d6\u5f97\u4e2d...</div>`;
  }
  if (state.error) {
    return `<div class="text-xs text-rose-600">\u5019\u88dc\u8005\u60c5\u5831\u306e\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f</div>`;
  }
  if (!candidate) {
    return `<div class="text-xs text-slate-500">\u5019\u88dc\u8005\u3092\u9078\u629e\u3059\u308b\u3068\u8a73\u7d30\u304c\u8868\u793a\u3055\u308c\u307e\u3059</div>`;
  }

  const phaseText = resolveCandidatePhaseText(candidate);
  const ageText = formatCandidateAgeText(candidate.age);
  const salaryText = formatCandidateSalaryText(candidate.salary);
  const locationText = formatCandidateField(candidate.location);
  const titleText = formatCandidateField(candidate.title);
  const registeredAtText = formatDateString(candidate.registeredAt);
  const skills = formatCandidateListText(candidate.skills);
  const qualifications = formatCandidateListText(candidate.qualifications);
  const personality = formatCandidateListText(candidate.personality);
  const noteText = formatCandidateField(candidate.note);
  const selection = Array.isArray(candidate.selectionProgress) && candidate.selectionProgress.length
    ? candidate.selectionProgress[0]
    : null;
  const selectionCompany = formatCandidateField(selection?.companyName ?? candidate.applyCompanyName);
  const selectionJob = formatCandidateField(selection?.jobTitle ?? candidate.applyJobName);
  const selectionRoute = formatCandidateField(selection?.route ?? candidate.applyRouteText);
  const selectionStatus = formatCandidateField(selection?.status ?? candidate.phase);
  const selectionDate = selection?.recommendationDate ?? selection?.recommendedAt ?? selection?.recommendation_date ?? selection?.createdAt ?? selection?.created_at ?? '';
  const selectionDateText = selectionDate ? formatDateString(selectionDate) : '-';

  return `
    <div class="bg-white rounded-lg overflow-hidden h-full flex flex-col">
      <!-- Header -->
      <div class="p-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <h3 class="text-lg font-bold text-slate-800">${formatCandidateField(candidate.name)}</h3>
            <span class="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium">${ageText}</span>
          </div>
          <div class="text-xs text-slate-500 flex items-center gap-2">
            <span>${titleText}</span>
            <span class="text-slate-300">|</span>
            <span>ID: ${candidate.id}</span>
          </div>
        </div>
        <button 
          onclick="navigateToCandidate('${candidate.id}')" 
          class="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-bold hover:bg-indigo-700 shadow-sm transition-colors cursor-pointer ml-4">
          <span>詳細画面へ</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
        </button>
      </div>

      <!-- Scrollable Body -->
      <div class="flex-1 overflow-y-auto p-4 space-y-6">
        
        <!-- Status Grid -->
        <div class="grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">フェーズ</div>
            <div class="text-sm font-medium text-slate-700 bg-slate-50 px-2 py-1 rounded inline-block border border-slate-200">${phaseText}</div>
          </div>
          <div>
            <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">登録日</div>
            <div class="text-sm font-medium text-slate-700">${registeredAtText}</div>
          </div>
          <div>
            <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">希望年収</div>
            <div class="text-sm font-medium text-slate-700">${salaryText}</div>
          </div>
          <div>
            <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">希望勤務地</div>
            <div class="text-sm font-medium text-slate-700">${locationText}</div>
          </div>
        </div>

        <!-- Selection Info -->
        ${selection ? `
        <div class="border-t border-slate-100 pt-4">
          <h4 class="text-xs font-bold text-slate-500 mb-3 flex items-center gap-2">
            <span class="w-1 h-4 bg-indigo-500 rounded-full"></span>
            現在の選考状況
          </h4>
          <div class="bg-indigo-50/50 rounded-lg p-3 border border-indigo-100 space-y-2">
            <div class="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
              <span class="text-xs text-indigo-400 font-medium whitespace-nowrap">企業</span>
              <span class="text-slate-700 font-medium">${selectionCompany}</span>
              
              <span class="text-xs text-indigo-400 font-medium whitespace-nowrap">職種</span>
              <span class="text-slate-700">${selectionJob}</span>
              
              <span class="text-xs text-indigo-400 font-medium whitespace-nowrap">ステータス</span>
              <span class="text-slate-700">${selectionStatus}</span>
              
              <span class="text-xs text-indigo-400 font-medium whitespace-nowrap">開始日</span>
              <span class="text-slate-700">${selectionDateText}</span>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- Skills & Note -->
        <div class="space-y-4 border-t border-slate-100 pt-4">
          <div>
            <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">スキル</div>
            <div class="text-sm text-slate-700 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100">${skills}</div>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
             <div>
              <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">資格</div>
              <div class="text-sm text-slate-700 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100 h-full">${qualifications}</div>
            </div>
            <div>
              <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">性格・特徴</div>
              <div class="text-sm text-slate-700 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100 h-full">${personality}</div>
            </div>
          </div>

          <div>
            <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">メモ</div>
            <div class="text-sm text-slate-600 whitespace-pre-wrap bg-yellow-50/50 p-3 rounded border border-yellow-100">${noteText}</div>
          </div>
        </div>

      </div>
    </div>
  `;
}

function openReferralCandidateModal() {
  const modal = document.getElementById('referralCandidateModal');
  if (!modal) return;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('referral-candidate-open');
}

function closeReferralCandidateModal() {
  const modal = document.getElementById('referralCandidateModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('referral-candidate-open');
}

function initReferralCandidateModal() {
  const modal = document.getElementById('referralCandidateModal');
  const closeBtn = document.getElementById('referralCandidateClose');
  if (!modal || modal.dataset.bound === 'true') return;
  modal.dataset.bound = 'true';
  closeBtn?.addEventListener('click', () => closeReferralCandidateModal());
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeReferralCandidateModal();
  });
}

function renderReferralCandidateQuickView(candidate, state = {}) {
  const container = document.getElementById('referralCandidateModalBody');
  if (!container) return;
  container.innerHTML = buildReferralCandidateQuickViewHtml(candidate, state);
  const titleEl = document.getElementById('referralCandidateModalTitle');
  if (titleEl) {
    const name = candidate?.name ? String(candidate.name).trim() : '';
    titleEl.textContent = name ? `${name}\u306e\u8a73\u7d30` : '\u5019\u88dc\u8005\u8a73\u7d30';
  }
}

function selectReferralCandidate(candidateId) {
  const id = String(candidateId ?? '').trim();
  if (!id) {
    selectedRecommendedCandidateId = '';
    renderReferralCandidateQuickView(null);
    closeReferralCandidateModal();
    return;
  }
  selectedRecommendedCandidateId = id;
  const matched = referralRecommendedCandidates.find(item => String(item.id) === id);
  if (matched) {
    renderReferralCandidateQuickView(matched);
    openReferralCandidateModal();
    return;
  }
  renderReferralCandidateQuickView(null, { loading: true });
  openReferralCandidateModal();
  fetchCandidateDetailForMatch(id)
    .then(candidate => {
      if (String(selectedRecommendedCandidateId) !== id) return;
      renderReferralCandidateQuickView(candidate);
    })
    .catch(() => {
      if (String(selectedRecommendedCandidateId) !== id) return;
      renderReferralCandidateQuickView(null, { error: true });
    });
}

function bindRecommendedCandidateActions() {
  const container = document.getElementById('referralRecommendedCandidates');
  if (!container || container.dataset.bound === 'true') return;
  container.dataset.bound = 'true';
  container.addEventListener('click', (event) => {
    const card = event.target.closest('[data-action="select-recommended-candidate"]');
    if (!card) return;
    event.preventDefault();
    const candidateId = card.dataset.candidateId;
    if (!candidateId) return;
    selectReferralCandidate(candidateId);
    const cards = container.querySelectorAll('[data-candidate-card]');
    cards.forEach((node) => {
      node.classList.remove('border-indigo-400', 'ring-2', 'ring-indigo-200');
      if (!node.classList.contains('border-indigo-100')) {
        node.classList.add('border-indigo-100');
      }
    });
    card.classList.add('border-indigo-400', 'ring-2', 'ring-indigo-200');
  });
}

function scoreCandidatesForCompany(company, candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  const dt = company.desiredTalent || {};
  const salaryRange = Array.isArray(dt.salaryRange) ? dt.salaryRange : [0, 0];
  const minSal = Number(salaryRange[0] || 0);
  const maxSal = Number(salaryRange[1] || 0);
  const locations = Array.isArray(dt.locations) ? dt.locations : [];
  const mustQualifications = Array.isArray(dt.mustQualifications) ? dt.mustQualifications : [];
  const niceQualifications = Array.isArray(dt.niceQualifications) ? dt.niceQualifications : [];
  const experiences = Array.isArray(dt.experiences) ? dt.experiences : [];
  const personalities = Array.isArray(dt.personality) ? dt.personality : [];

  const matchTerms = (terms, keywords) => {
    const matched = new Set();
    terms.forEach((term) => {
      const normalizedTerm = normalizeText(term);
      if (!normalizedTerm) return;
      keywords.forEach((keyword) => {
        const normalizedKeyword = normalizeText(keyword);
        if (!normalizedKeyword) return;
        if (normalizedKeyword.includes(normalizedTerm) || normalizedTerm.includes(normalizedKeyword)) {
          matched.add(term);
        }
      });
    });
    return Array.from(matched);
  };

  const scored = candidates.map(cand => {
    let score = 0;
    const reasons = [];
    const salary = Number(cand.salary) || 0;

    // 年収
    if (minSal === 0 && maxSal === 0) {
      score += 10;
    } else if (salary >= minSal && salary <= maxSal) {
      score += 20;
      reasons.push('年収レンジ一致');
    } else if (maxSal && salary <= maxSal + 100) {
      score += 10;
      reasons.push('年収レンジ近い');
    }

    // 勤務地
    const normalizedLocation = normalizeText(cand.location);
    const locationHit = locations.find((loc) => {
      const normalizedLoc = normalizeText(loc);
      return normalizedLoc && normalizedLocation.includes(normalizedLoc);
    });
    const wantsRemote = locations.some((loc) => normalizeText(loc).includes('りもーと'));
    if (locationHit || (wantsRemote && normalizedLocation.includes('りもーと'))) {
      score += 15;
      reasons.push(locationHit ? `勤務地一致: ${locationHit}` : '勤務地一致');
    }

    // キーワードマッチ
    const candSkills = Array.isArray(cand.skills) ? cand.skills : splitCandidateList(cand.skills);
    const candQualifications = Array.isArray(cand.qualifications) ? cand.qualifications : splitCandidateList(cand.qualifications);
    const candPersonality = Array.isArray(cand.personality) ? cand.personality : splitCandidateList(cand.personality);
    const candKeywords = [...candSkills, ...candQualifications, ...candPersonality, cand.title].filter(Boolean);
    const matchedMust = matchTerms(mustQualifications, candKeywords);
    const matchedNice = matchTerms(niceQualifications, candKeywords);
    const matchedExperiences = matchTerms(experiences, candKeywords);
    const matchedPersonalities = matchTerms(personalities, candKeywords);
    const hitCount = matchedMust.length + matchedNice.length + matchedExperiences.length + matchedPersonalities.length;
    if (hitCount > 0) {
      score += Math.min(hitCount * 10, 50);
    }
    if (matchedMust.length) reasons.push(`必須資格: ${matchedMust.join(' / ')}`);
    if (matchedNice.length) reasons.push(`歓迎資格: ${matchedNice.join(' / ')}`);
    if (matchedExperiences.length) reasons.push(`経験一致: ${matchedExperiences.join(' / ')}`);
    if (matchedPersonalities.length) reasons.push(`性格傾向: ${matchedPersonalities.join(' / ')}`);

    // 職種マッチ
    const jobTitle = company.jobTitle || '';
    if (jobTitle && jobTitle !== '-' && (normalizeText(cand.title).includes(normalizeText(jobTitle)) || normalizeText(jobTitle).includes(normalizeText(cand.title)))) {
      score += 15;
      reasons.push('職種一致');
    }

    return { ...cand, matchScore: Math.min(score, 100), matchReasons: reasons };
  });

  return scored.sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);
}

async function getRecommendedCandidatesAsync(company) {
  const summaries = await loadCandidateSummaries();

  const candidates = summaries.filter(cand => cand.id);

  if (!candidates.length) return [];

  const rough = candidates.map((cand) => ({
    candidate: cand,
    score: computeRoughCandidateScore(company, cand)
  }));
  rough.sort((a, b) => b.score - a.score);
  const pick = rough.slice(0, Math.min(CANDIDATES_MATCH_FETCH_LIMIT, rough.length)).map(item => item.candidate);
  const detailed = await fetchCandidateDetailsWithLimit(pick, CANDIDATES_DETAIL_CONCURRENCY);
  return scoreCandidatesForCompany(company, detailed);
}

async function renderRecommendedCandidates(company) {
  const container = document.getElementById('referralRecommendedCandidates');
  if (!container) return;
  const requestId = ++recommendedRequestId;
  referralRecommendedCandidates = [];
  container.innerHTML = '<div class="text-xs text-slate-400">\u5019\u88dc\u8005\u60c5\u5831\u3092\u53d6\u5f97\u4e2d...</div>';
  renderReferralCandidateQuickView(null, { loading: true });

  const recommended = await getRecommendedCandidatesAsync(company);
  if (requestId !== recommendedRequestId) return;

  if (candidateSummaryError) {
    container.innerHTML = '<div class="text-xs text-rose-600">\u5019\u88dc\u8005\u30c7\u30fc\u30bf\u306e\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f</div>';
    referralRecommendedCandidates = [];
    renderReferralCandidateQuickView(null, { error: true });
    return;
  }

  referralRecommendedCandidates = recommended;
  container.innerHTML = buildRecommendedCandidatesHtml(recommended);
  bindRecommendedCandidateActions();
  const selected = selectedRecommendedCandidateId
    ? recommended.find(c => String(c.id) === String(selectedRecommendedCandidateId))
    : null;
  if (selected) {
    renderReferralCandidateQuickView(selected);
  } else {
    renderReferralCandidateQuickView(null);
  }
}

function listToInputValue(list) {

  if (!Array.isArray(list)) return '';

  return sanitizeList(list).join(', ');

}



function parseListValue(value) {

  if (!value) return [];

  return String(value)

    .split(/[,、/]/)

    .map(v => v.trim())

    .filter(Boolean);

}



function readInputValue(id) {

  const el = document.getElementById(id);

  return el ? el.value.trim() : '';

}



function readNumberValue(id, fallback = 0) {

  const raw = readInputValue(id);

  if (!raw) return fallback;

  const num = Number(raw);

  return Number.isFinite(num) ? num : fallback;

}



function readOptionalNumberValue(id) {

  const raw = readInputValue(id);

  if (raw === '') return null;

  const num = Number(raw);

  return Number.isFinite(num) ? num : null;

}



function buildAIInsight(company) {

  const dt = company.desiredTalent || {};

  const mustList = sanitizeList(dt.mustQualifications);

  const niceList = sanitizeList(dt.niceQualifications);

  const expList = sanitizeList(dt.experiences);

  const must = mustList.length ? mustList.join(' / ') : '';

  const nice = niceList.length ? niceList.join(' / ') : '';

  const exp = expList.length ? expList.join(' / ') : '';

  const salary = dt.salaryRange ? `${dt.salaryRange[0]}\u301c${dt.salaryRange[1]}万円` : '年収レンジ未設定';
  const pos = company.highlightPosition || company.jobTitle || 'ポジション未設定';

  const parts = [must ? `必須「${must}」` : '', nice ? `歓迎「${nice}」` : '', exp ? `経験「${exp}」` : ''].filter(Boolean).join('・');

  const personalitiesList = sanitizeList(dt.personality);

  const personalities = personalitiesList.length ? personalitiesList.join(' / ') : '';

  return `${pos}を${salary}、${parts || '柔軟に検討'}で採用強化。${personalities ? `求める気質は「${personalities}」。` : ''}`;

}



function buildAgencyInsight(company) {

  const retention = parseFloat(company.retention) || 0;

  const lead = company.leadTime || '-';

  const fee = company.feeDisplay;

  const refund = Number(company.refundAmount) || 0;

  const retTone = retention >= 90 ? `定着率${retention}%で安心感高め` : retention >= 80 ? `定着率${retention}%で安定域` : `定着率${retention}%で要ケア`;

  const leadTone = lead !== '-' ? `LT${lead}日で決着早め` : 'LT情報なし';

  const refundTone = refund > 0 ? `返金リスクあり（${formatCurrency(refund)}）` : '返金リスク低め';

  return `${retTone}、${leadTone}。Fee${fee}、${refundTone}。`;

}



function remainingBadge(remaining) {

  const num = Number(remaining) ?? 0;

  let cls = 'bg-emerald-50 text-emerald-700 border border-emerald-100';

  if (num >= 3) cls = 'bg-red-50 text-red-700 border border-red-100';

  else if (num >= 1) cls = 'bg-amber-50 text-amber-700 border border-amber-100';

  return `<span class="px-2 py-1 rounded-md text-xs font-semibold ${cls}">${num}名</span>`;

}



function retentionBadge(ret, warrantyPeriod) {

  const num = parseFloat(ret);

  const period = Number.isFinite(Number(warrantyPeriod)) && Number(warrantyPeriod) > 0
    ? Number(warrantyPeriod)
    : null;
  const periodTitle = period ? ` title="保証期間: ${period}日"` : '';
  const periodText = period
    ? `<span class="ml-1 text-[10px] text-slate-400">(期間:${period}日)</span>`
    : '';

  if (isNaN(num)) {
    return `<span class="px-2 py-1 rounded-md text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-100"${periodTitle}>${ret || '-'}</span>${periodText}`;
  }

  let cls = 'bg-emerald-50 text-emerald-700 border border-emerald-100';

  if (num < 80) cls = 'bg-red-50 text-red-700 border border-red-100';

  else if (num < 90) cls = 'bg-amber-50 text-amber-700 border border-amber-100';

  return `<span class="px-2 py-1 rounded-md text-xs font-semibold ${cls}"${periodTitle}>${ret}</span>${periodText}`;

}



// ==========================================

// フィルタ・ソート・描画

// ==========================================

function applyFilters() {

  const companyFilter = document.getElementById('referralCompanyFilter')?.value.toLowerCase() || '';

  const jobFilter = document.getElementById('referralJobFilter')?.value || '';



  if (!allData.length) {

    filteredData = [];

  } else {

    filteredData = allData.filter(item => {

      const matchCompany = !companyFilter || item.company.toLowerCase().includes(companyFilter);

      const matchJob = !jobFilter || item.jobTitle.includes(jobFilter);

      return matchCompany && matchJob;

    });

  }



  if (filteredData.length > 0) {

    const exists = filteredData.some(c => c.id === selectedCompanyId);

    if (!exists) selectedCompanyId = filteredData[0].id;

  } else {

    selectedCompanyId = null;

  }



  currentPage = 1;

  detailEditMode = false;

  applySort();

  renderTable();

  renderCompanyDetail();

  updatePaginationInfo();

  updateFilterCount();

}



function applySort() {

  if (!currentSort) return;

  const [key, dir] = currentSort.split('-');

  const isAsc = dir === 'asc';



  filteredData.sort((a, b) => {

    let valA = a[key];

    let valB = b[key];

    if (key === 'retention') { valA = parseFloat(valA) || 0; valB = parseFloat(valB) || 0; }

    else if (key === 'fee') { valA = a.feeValue || 0; valB = b.feeValue || 0; }

    if (valA == null) valA = 0; if (valB == null) valB = 0;

    if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }

    if (valA < valB) return isAsc ? -1 : 1;

    if (valA > valB) return isAsc ? 1 : -1;

    return 0;

  });

}



function renderTable() {

  const tbody = document.getElementById('referralTableBody');

  if (!tbody) return;



  if (filteredData.length === 0) {

    tbody.innerHTML = `<tr><td colspan="17" class="p-8 text-center text-slate-500">データがありません</td></tr>`;

    return;

  }



  const start = (currentPage - 1) * pageSize;

  const end = start + pageSize;

  const pageData = filteredData.slice(start, end);



  const prioritized = [...pageData];

  const selIdx = prioritized.findIndex(p => p.id === selectedCompanyId);

  if (selIdx > 0) {

    const [sel] = prioritized.splice(selIdx, 1);

    prioritized.unshift(sel);

  }



  tbody.innerHTML = prioritized.map(item => {

    const isSelected = item.id === selectedCompanyId;

    const rowClass = isSelected ? 'selected-row border-l-4 border-indigo-400' : '';



    return `

      <tr class="hover:bg-slate-50 cursor-pointer ${rowClass}" data-company-id="${item.id}">

        <td class="sticky-col font-semibold text-left" style="position:sticky;left:0;z-index:30;background:${isSelected ? '#eef2ff' : '#fff'};">${item.company}</td>

        <td class="text-left">${remainingBadge(item.remaining)}</td>

        <td>${item.jobTitle}</td>

        <td class="text-right">${item.planHeadcount}名</td>

        <td class="text-right">${item.proposal}件</td>

        <td class="text-right">${item.docScreen}件</td>

        <td class="text-right">${item.interview1}件</td>

        <td class="text-right">${item.interview2}件</td>

        <td class="text-right">${item.offer}件</td>

        <td class="text-right">${item.joined}件</td>

        <td class="text-right">${formatCurrency(item.refundAmount)}</td>

        <td class="text-right">${item.leadTime}日</td>

        <td class="text-left">${retentionBadge(item.retention, item.warrantyPeriod)}</td>

        <td class="text-right">${item.feeDisplay}</td>

        <td class="text-left text-xs">${item.prejoinDeclineReason}</td>

        <td class="text-right">${item.prejoinDeclines}件</td>

        <td class="text-right">${item.dropoutCount}件</td>

      </tr>

    `;

  }).join('');



  attachRowClickHandlers();

}



function attachRowClickHandlers() {

  document.querySelectorAll('#referralTableBody tr').forEach(row => {

    row.addEventListener('click', () => {

      const companyId = row.dataset.companyId;

      if (!companyId) return;

      detailEditMode = false;

      selectedCompanyId = companyId;

      renderTable();

      renderCompanyDetail();

      document.getElementById('referralCompanyDetail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    });

  });

}



function renderCompanyDetail() {
  if (!selectedCompanyId) return;

  const company = filteredData.find(c => c.id === selectedCompanyId);
  if (!company) return;

  const badge = (text, classes = '', size = 'px-3 py-1 text-xs') =>
    `<span class="${size} rounded-full ${classes} font-semibold inline-flex items-center justify-center">${text}</span>`;

  const detail = document.getElementById('referralCompanyDetail');
  if (!detail) return;
  // Show detail section
  detail.classList.remove('hidden');

  const retentionClass = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
  const leadClass = 'bg-amber-50 text-amber-700 border border-amber-100';
  const refundClass = Number(company.refundAmount) > 0 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-slate-50 text-slate-700 border border-slate-100';
  const contactNameDisplay = company.contactName || company.contact || '-';
  const contactEmailDisplay = company.contactEmail || '-';
  const contactEmailHtml = contactEmailDisplay && contactEmailDisplay !== '-'
    ? `<a href="mailto:${contactEmailDisplay}" class="text-indigo-600 hover:text-indigo-800 underline">${contactEmailDisplay}</a>`
    : `<span class="text-slate-400">-</span>`;
  const feeDetailsDisplay = company.feeDetails || company.feeContract || '';
  const contractNoteDisplay = company.contractNote || company.contractNotes || '';
  const editing = detailEditMode;
  const desired = company.desiredTalent || {
    salaryRange: [0, 0],
    locations: [],
    mustQualifications: [],
    niceQualifications: [],
    personality: [],
    experiences: []
  };
  const salaryRange = Array.isArray(desired.salaryRange) ? desired.salaryRange : [0, 0];
  const salaryMinValue = Number(salaryRange[0] || 0);
  const salaryMaxValue = Number(salaryRange[1] || 0);
  const salaryMinInput = salaryMinValue > 0 ? salaryMinValue : '';
  const salaryMaxInput = salaryMaxValue > 0 ? salaryMaxValue : '';
  const salaryLabel = (salaryMinValue || salaryMaxValue)
    ? `${salaryMinValue || '-'}\u301c${salaryMaxValue || '-'} 万円`
    : '-';
  const mustDisplay = sanitizeList(desired.mustQualifications).join(' / ') || '-';
  const niceDisplay = sanitizeList(desired.niceQualifications).join(' / ') || '-';
  const locationDisplay = sanitizeList(desired.locations).join(' / ') || '-';
  const personalityDisplay = sanitizeList(desired.personality).join(' / ') || '-';
  const experienceDisplay = sanitizeList(desired.experiences).join(' / ') || '-';
  const selectionNoteText = company.selectionNote || '';
  const editActions = editing
    ? `
      <div class="flex items-center gap-2">
        <button type="button" id="referralDetailSaveBtn" class="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-500">保存</button>
        <button type="button" id="referralDetailCancelBtn" class="px-3 py-1.5 border border-slate-300 rounded-md text-xs text-slate-600 hover:bg-slate-100">キャンセル</button>
      </div>
    `
    : `<button type="button" id="referralDetailEditBtn" class="px-3 py-1.5 border border-slate-300 rounded-md text-xs text-slate-600 hover:bg-slate-100">編集</button>`;

  const desiredContent = editing
    ? `
      <label class="flex flex-col gap-1">
        <span class="text-xs font-semibold text-slate-600">年収レンジ（万円）</span>
        <div class="flex items-center gap-2">
          <input type="number" min="0" id="referralDesiredSalaryMin" class="bg-white border border-slate-300 rounded-md px-3 py-2 text-sm w-full" placeholder="600" value="${salaryMinInput}">
          <span class="text-xs text-slate-400">&#x301c;</span>
          <input type="number" min="0" id="referralDesiredSalaryMax" class="bg-white border border-slate-300 rounded-md px-3 py-2 text-sm w-full" placeholder="900" value="${salaryMaxInput}">
        </div>
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs font-semibold text-slate-600">必須資格</span>
        <input type="text" id="referralDesiredMust" class="bg-white border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="カンマ区切り" value="${listToInputValue(desired.mustQualifications)}">
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs font-semibold text-slate-600">歓迎資格</span>
        <input type="text" id="referralDesiredNice" class="bg-white border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="カンマ区切り" value="${listToInputValue(desired.niceQualifications)}">
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs font-semibold text-slate-600">勤務地</span>
        <input type="text" id="referralDesiredLocations" class="bg-white border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="カンマ区切り" value="${listToInputValue(desired.locations)}">
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs font-semibold text-slate-600">性格傾向</span>
        <input type="text" id="referralDesiredPersonality" class="bg-white border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="カンマ区切り" value="${listToInputValue(desired.personality)}">
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs font-semibold text-slate-600">経験</span>
        <textarea rows="2" id="referralDesiredExperiences" class="bg-white border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="カンマ区切り">${listToInputValue(desired.experiences)}</textarea>
      </label>
    `
    : `
      <div><span class="font-semibold text-slate-700">年収レンジ：</span>${salaryLabel}</div>
      <div><span class="font-semibold text-slate-700">必須資格：</span>${mustDisplay}</div>
      <div><span class="font-semibold text-slate-700">歓迎資格：</span>${niceDisplay}</div>
      <div><span class="font-semibold text-slate-700">勤務地：</span>${locationDisplay}</div>
      <div><span class="font-semibold text-slate-700">性格傾向：</span>${personalityDisplay}</div>
      <div><span class="font-semibold text-slate-700">経験：</span>${experienceDisplay}</div>
    `;

  const memoContent = editing
    ? `
      <label class="flex flex-col gap-1">
        <span class="text-xs font-semibold text-slate-600">メモ内容</span>
        <textarea rows="6" id="referralSelectionNote" class="bg-white border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="選考メモを入力">${selectionNoteText}</textarea>
      </label>
      <div class="text-xs text-slate-500">入社前辞退：${company.prejoinDeclines ?? 0}名 (${company.prejoinDeclineReason || '理由未登録'}) / 選考脱落者：${company.dropoutCount ?? 0}名</div>
    `
    : `
      <div class="whitespace-pre-wrap text-slate-700">${selectionNoteText || 'メモがありません'}</div>
      <div class="text-xs text-slate-500">入社前辞退：${company.prejoinDeclines ?? 0}名 (${company.prejoinDeclineReason || '理由未登録'}) / 選考脱落者：${company.dropoutCount ?? 0}名</div>
    `;

  const flowCandidates = getFlowCandidates(company);
  const normalizedFlowCandidates = (flowCandidates || []).map(candidate => {
    if (!candidate) return null;
    const phaseInfo = resolveCandidatePhaseForFlow(candidate);
    const stageKey = candidate.stageKey || phaseInfo.stageKey || '';
    const stageLabel = candidate.stageLabel || phaseInfo.stageLabel || candidate.stage || candidate.phase || '';
    return {
      ...candidate,
      stageKey,
      stageLabel,
      stage: stageKey || stageLabel || candidate.stage || '-'
    };
  }).filter(Boolean);
  const toCount = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };
  const stageValueMap = {
    '推薦': company.proposal,
    '書類': company.docScreen,
    '一次': company.interview1,
    '二次': company.interview2,
    '内定': company.offer,
    '入社': company.joined
  };
  const stages = PHASE_FLOW_ORDER.map((label, idx) => ({
    key: label,
    label,
    value: toCount(stageValueMap[label]),
    color: PHASE_FLOW_COLORS[idx % PHASE_FLOW_COLORS.length]
  }));



  const candidateBubble = (c) => `
    <div class="inline-flex items-center gap-2 px-2 py-1 bg-white border border-slate-200 rounded-full shadow-sm text-[11px] text-slate-700 max-w-[160px] sm:max-w-[220px]">
      <span class="inline-block w-2 h-2 rounded-full bg-indigo-500"></span>
      <div class="flex flex-col leading-tight min-w-0">
        <span class="font-semibold text-[12px] truncate">${c.name}</span>
        <span class="text-slate-500 truncate">${formatDateString(c.date)}</span>
      </div>
      ${c.note ? `<span class="text-slate-500 truncate max-w-[80px] sm:max-w-[120px]">${c.note}</span>` : ''}
    </div>`;

  const flow = stages.map((s, idx) => {
    const stageCands = normalizedFlowCandidates.filter(c => (c.stageKey || c.stage) === s.key);
    const remaining = stageCands.length - 2;
    const displayCount = Number.isFinite(s.value) ? s.value : 0;
    const namesHtml = stageCands.length > 0
      ? `<div class="flex flex-col items-center w-full mt-0.5 overflow-hidden">
           ${stageCands.slice(0, 2).map(c =>
        `<button onclick="event.stopPropagation(); window.navigateToCandidate('${c.id}')"
                      class="text-[9px] sm:text-[10px] leading-tight text-white hover:underline truncate w-full text-center px-1 block mb-0.5">
                ${c.name}
              </button>`
      ).join('')}
           ${remaining > 0 ? `<span class="text-[8px] sm:text-[9px] text-white/80 leading-none">+${remaining}名</span>` : ''}
         </div>`
      : '';
    return `
      <div class="flex flex-col items-center min-w-[70px] sm:min-w-[100px] lg:min-w-[120px] flex-shrink-0">
        <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-full ${s.color} text-white flex flex-col items-center justify-center p-1 shadow-md transition-transform hover:scale-105">
           <div class="flex items-baseline gap-0.5 ${stageCands.length > 0 ? 'mb-0' : ''}">
             <span class="text-lg sm:text-xl font-bold leading-none">${displayCount}</span>
             <span class="text-[10px] sm:text-xs opacity-90">件</span>
           </div>
           ${namesHtml}
        </div>
        <span class="text-[11px] sm:text-xs lg:text-sm text-slate-700 mt-2 font-medium">${s.label}</span>
      </div>
      ${idx < stages.length - 1 ? '<div class="flex items-center justify-center text-slate-300 w-4 sm:w-8 lg:w-10 flex-shrink-0 mb-6" aria-hidden="true"><svg viewBox="0 0 24 24" class="w-4 h-4 sm:w-6 sm:h-6 lg:w-7 lg:h-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></div>' : ''}
    `;
  }).join('');



  const recommendedHtml = '<div class="text-xs text-slate-400">\u5019\u88dc\u8005\u60c5\u5831\u3092\u53d6\u5f97\u4e2d...</div>';

  detail.innerHTML = `
    <div class="border border-indigo-200 border-l-4 border-l-indigo-500 rounded-xl p-4 bg-gradient-to-br from-indigo-50 via-white to-blue-50 space-y-4 shadow-lg text-sm text-slate-800">

      <!-- ヘッダー：会社名と闉じるボタン -->
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <h2 class="text-2xl font-bold text-indigo-900">${company.company}</h2>
          <div class="mt-1 text-xs text-slate-500">
            担当者: <span class="font-semibold text-slate-600">${contactNameDisplay}</span>
            <span class="mx-1 text-slate-300">/</span>
            ${contactEmailHtml}
          </div>
        </div>
        <button
          id="closeCompanyDetail"
          class="flex-shrink-0 p-2 hover:bg-indigo-100 rounded-lg transition text-indigo-700 hover:text-indigo-900"
          title="闉じる">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- 基本情報 -->
      <div class="space-y-2">
        <!-- 業種・所在地 -->
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-semibold text-xs">🏢 ${company.industry}</span>
          <span class="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700 border border-cyan-200 font-semibold text-xs">📍 ${company.location}</span>
        </div>
      </div>

      <!-- 募集ポジション -->
      <div class="bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg px-3 py-2 border border-slate-300 shadow-sm">
        <div class="flex items-center gap-1.5 mb-1">
          <span class="text-lg">💼</span>
          <span class="text-xs font-semibold text-slate-700 uppercase tracking-wide">募集ポジション</span>
        </div>
        <div class="text-lg font-bold text-slate-900">${company.highlightPosition}</div>
      </div>

      <!-- 各種指標 -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div class="${retentionClass} px-3 py-2 text-center shadow-sm rounded-lg">
          <div class="text-[10px] mb-0.5 opacity-80">
            📊 定着率<span class="ml-1 text-[9px] font-normal text-slate-500">（返金発生期間）</span>
          </div>
          <div class="text-base font-bold">${company.retention}</div>
        </div>
        <div class="${leadClass} px-3 py-2 text-center shadow-sm rounded-lg">
          <div class="text-[10px] mb-0.5 opacity-80">
            ⏱️ リードタイム<span class="ml-1 text-[9px] font-normal text-slate-500">（推薦から入社までの期間）</span>
          </div>
          <div class="text-base font-bold">${company.leadTime}日</div>
        </div>
        <div class="bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-800 border border-indigo-200 px-3 py-2 text-center shadow-sm rounded-lg">
          <div class="text-[10px] mb-0.5 opacity-80">💰 合計Fee</div>
          <div class="text-base font-bold">${company.feeDisplay}</div>
        </div>
        <div class="${refundClass} px-3 py-2 text-center shadow-sm rounded-lg">
          <div class="text-[10px] mb-0.5 opacity-80">${Number(company.refundAmount) > 0 ? '❌' : '✅'} 返金</div>
          <div class="text-base font-bold">${formatCurrency(company.refundAmount)}</div>
        </div>
      </div>
      

      

      <div class="p-3 border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-cyan-50 rounded-lg leading-relaxed w-full shadow-sm">

        <div class="font-bold text-blue-900 text-sm mb-1.5 flex items-center gap-1.5">
          <span class="text-base">📝</span>
          <span>企業メモ</span>
        </div>

        <div class="text-sm text-slate-800 font-semibold w-full max-w-none">${buildAIInsight(company)}</div>

        <div class="text-slate-800 text-xs mt-1.5">${buildAgencyInsight(company)}</div>

      </div>



      <div class="space-y-2 pt-1">

        <div class="text-sm font-bold text-slate-900 tracking-wide flex items-center gap-1.5">
          <span class="text-lg">📈</span>
          <span>募集・選考の進捗</span>
        </div>

        <div class="flex flex-nowrap items-start gap-2 sm:gap-3 lg:gap-4 justify-start lg:justify-between overflow-x-auto pb-2 w-full max-w-full bg-white/60 rounded-lg p-3 border border-slate-200">

          ${flow}

        </div>

      </div>



      

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-2.5 text-center">

        <div class="p-3 border border-slate-300 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 shadow-sm hover:shadow-md transition">

          <div class="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">採用予定</div>

          <div class="text-2xl font-bold text-slate-900 mt-1">${company.planHeadcount}<span class="text-sm text-slate-600">名</span></div>

        </div>

        <div class="p-3 border border-blue-300 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 shadow-sm hover:shadow-md transition">

          <div class="text-[10px] font-semibold text-blue-700 uppercase tracking-wide">内定 / 入社</div>

          <div class="text-2xl font-bold text-blue-900 mt-1">${company.offer} <span class="text-blue-600">/</span> ${company.joined}</div>

        </div>

        <div class="p-3 border border-slate-300 rounded-lg bg-gradient-to-br from-slate-50 to-blue-50 shadow-sm hover:shadow-md transition">

          <div class="text-[10px] font-semibold text-slate-700 uppercase tracking-wide">残り人数</div>

          <div class="text-2xl font-bold text-slate-900 mt-1">${company.remaining}<span class="text-sm text-slate-600">名</span></div>

        </div>
      </div>
      <!-- 求人情報 -->
      <div class="bg-white/50 rounded-xl p-4 border border-slate-200">
        <div class="flex items-center justify-between mb-3">
          <div class="text-base font-bold text-slate-800 flex items-center gap-2">
            <span class="text-xl">🎯</span>
            <span>求人情報</span>
          </div>
          ${editActions}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm">
          <!-- 欲しい人材 -->
          <div class="p-3 bg-gradient-to-br from-blue-50 to-white rounded-lg border border-blue-200 shadow-sm">
            <div class="flex items-center justify-between mb-2">
              <div class="font-bold text-blue-900 text-sm flex items-center gap-1.5">
                <span>👥</span>
                <span>欲しい人材</span>
              </div>
              ${editing ? '<span class="text-[10px] text-slate-500">カンマ区切り</span>' : ''}
            </div>
            ${desiredContent}
          </div>

          <!-- 選考メモ -->
          <div class="p-3 bg-gradient-to-br from-slate-50 to-white rounded-lg border border-slate-300 shadow-sm">
            <div class="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-2">
              <span>📋</span>
              <span>選考メモ</span>
            </div>
            ${memoContent}
          </div>
        </div>
      </div>

      <!-- 契約情報 -->
      <!-- 担当者情報 -->
      <div class="bg-white/80 rounded-xl p-4 border border-slate-300 shadow-md">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-base font-bold text-slate-800 flex items-center gap-2">
            <span class="text-xl">👤</span>
            <span>担当者情報</span>
          </h3>
          <button
            id="contactInfoEditBtn"
            class="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition">
            編集
          </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="p-3 bg-white rounded-lg border border-slate-300 shadow-sm">
            <div class="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
              <span>👤</span>
              <span>担当者名</span>
            </div>
            <div id="contactNameDisplay" class="text-sm text-slate-800 min-h-[36px] leading-relaxed">
              ${contactNameDisplay}
            </div>
            <input
              id="contactNameInput"
              class="hidden w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="担当者名を入力"
              value="${company.contactName || ''}">
          </div>
          <div class="p-3 bg-white rounded-lg border border-slate-300 shadow-sm">
            <div class="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
              <span>✉️</span>
              <span>メールアドレス</span>
            </div>
            <div id="contactEmailDisplay" class="text-sm text-slate-800 min-h-[36px] leading-relaxed">
              ${contactEmailHtml}
            </div>
            <input
              id="contactEmailInput"
              type="email"
              class="hidden w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="example@company.com"
              value="${company.contactEmail || ''}">
          </div>
        </div>
        <div id="contactInfoEditActions" class="hidden mt-3 flex gap-2 justify-end">
          <button
            id="contactInfoCancelBtn"
            class="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition">
            キャンセル
          </button>
          <button
            id="contactInfoSaveBtn"
            class="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 border border-blue-700 rounded-lg transition">
            保存
          </button>
        </div>
      </div>

      <div class="bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 rounded-xl p-4 border border-slate-300 shadow-md">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-base font-bold text-slate-800 flex items-center gap-2">
            <span class="text-xl">📝</span>
            <span>契約情報（人材会社 ⇔ 顧客企業間）</span>
          </h3>
          <button 
            id="contractInfoEditBtn" 
            class="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition">
            📝 編集
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <!-- 返金保証期間 -->
          <div class="p-3 bg-white rounded-lg border border-slate-300 shadow-sm">
            <div class="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
              <span>⏰</span>
              <span>返金保証期間</span>
            </div>
            <div id="warrantyPeriodDisplay" class="text-sm text-slate-800 min-h-[60px] leading-relaxed">
              ${company.warrantyPeriod ? `${company.warrantyPeriod}日` : '-'}
            </div>
            <textarea 
              id="warrantyPeriodInput" 
              class="hidden w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[60px]" 
              placeholder="例: 90日、3ヶ月など">${company.warrantyPeriod || ''}</textarea>
          </div>

          <!-- Fee契約内容 -->
          <div class="p-3 bg-white rounded-lg border border-slate-300 shadow-sm">
            <div class="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
              <span>💰</span>
              <span>Fee契約内容</span>
            </div>
            <div id="feeContractDisplay" class="text-sm text-slate-800 whitespace-pre-wrap min-h-[60px] leading-relaxed">
              ${feeDetailsDisplay || '-'}
            </div>
            <textarea 
              id="feeContractInput" 
              class="hidden w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[60px]" 
              placeholder="Fee契約の詳細を入力">${company.feeDetails || company.feeContract || ''}</textarea>
          </div>

          <!-- その他契約メモ -->
          <div class="p-3 bg-white rounded-lg border border-slate-300 shadow-sm">
            <div class="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
              <span>📌</span>
              <span>その他</span>
            </div>
            <div id="contractNotesDisplay" class="text-sm text-slate-800 whitespace-pre-wrap min-h-[60px] leading-relaxed">
              ${contractNoteDisplay || '-'}
            </div>
            <textarea 
              id="contractNotesInput" 
              class="hidden w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[60px]" 
              placeholder="その他の契約に関するメモ">${company.contractNote || company.contractNotes || ''}</textarea>
          </div>
        </div>

        <!-- 編集時の保存/キャンセルボタン -->
        <div id="contractInfoEditActions" class="hidden mt-3 flex gap-2 justify-end">
          <button 
            id="contractInfoCancelBtn" 
            class="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition">
            キャンセル
          </button>
          <button 
            id="contractInfoSaveBtn" 
            class="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 border border-blue-700 rounded-lg transition">
            保存
          </button>
        </div>
      </div>



      <div class="bg-gradient-to-br from-slate-100 via-blue-50 to-slate-50 rounded-lg p-3 border border-slate-300 shadow-sm">

         <h4 class="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
           <span class="text-base">🤖</span>
           <span>AIマッチング候補者 (Top 3)</span>
         </h4>

         <div class="grid grid-cols-1 md:grid-cols-3 gap-2" id="referralRecommendedCandidates">

           ${recommendedHtml}

         </div>

      </div>

    </div>

  `;

  renderRecommendedCandidates(company);

  attachDetailEditHandlers(company);

  // Add close button handler
  const closeBtn = document.getElementById('closeCompanyDetail');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const detail = document.getElementById('referralCompanyDetail');
      if (detail) {
        detail.classList.add('hidden');
      }
      selectedCompanyId = null;
      renderTable();
    });
  }

}



function attachDetailEditHandlers(company) {

  const editBtn = document.getElementById('referralDetailEditBtn');

  if (editBtn) {

    editBtn.addEventListener('click', () => {

      detailEditMode = true;

      renderCompanyDetail();

    });

  }



  const cancelBtn = document.getElementById('referralDetailCancelBtn');

  if (cancelBtn) {

    cancelBtn.addEventListener('click', () => {

      detailEditMode = false;

      renderCompanyDetail();

    });

  }



  const saveBtn = document.getElementById('referralDetailSaveBtn');

  if (saveBtn) {

    saveBtn.addEventListener('click', () => {

      handleDetailSave(company);

    });

  }

  // Contract information edit handlers
  attachContractInfoEditHandlers(company);
  attachContactInfoEditHandlers(company);

}



function attachContractInfoEditHandlers(company) {
  const editBtn = document.getElementById('contractInfoEditBtn');
  const cancelBtn = document.getElementById('contractInfoCancelBtn');
  const saveBtn = document.getElementById('contractInfoSaveBtn');
  const editActions = document.getElementById('contractInfoEditActions');

  if (!editBtn) return;

  editBtn.addEventListener('click', () => {
    // Show edit mode
    document.getElementById('warrantyPeriodDisplay').classList.add('hidden');
    document.getElementById('warrantyPeriodInput').classList.remove('hidden');
    document.getElementById('feeContractDisplay').classList.add('hidden');
    document.getElementById('feeContractInput').classList.remove('hidden');
    document.getElementById('contractNotesDisplay').classList.add('hidden');
    document.getElementById('contractNotesInput').classList.remove('hidden');

    editBtn.classList.add('hidden');
    editActions.classList.remove('hidden');
  });

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      // Cancel edit mode
      document.getElementById('warrantyPeriodDisplay').classList.remove('hidden');
      document.getElementById('warrantyPeriodInput').classList.add('hidden');
      document.getElementById('feeContractDisplay').classList.remove('hidden');
      document.getElementById('feeContractInput').classList.add('hidden');
      document.getElementById('contractNotesDisplay').classList.remove('hidden');
      document.getElementById('contractNotesInput').classList.add('hidden');

      editBtn.classList.remove('hidden');
      editActions.classList.add('hidden');

      // Reset values
      renderCompanyDetail();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const warrantyPeriod = document.getElementById('warrantyPeriodInput').value.trim();
      const feeDetails = document.getElementById('feeContractInput').value.trim();
      const contractNote = document.getElementById('contractNotesInput').value.trim();

      const payload = buildContractUpdatePayload(company, {
        warrantyPeriod: warrantyPeriod || null,
        feeDetails: feeDetails || null,
        contractNote: contractNote || null
      });

      try {
        await saveContractInfo(payload);
        applyClientProfileEdits(company.id, {
          warrantyPeriod: warrantyPeriod || null,
          feeDetails: feeDetails || null,
          contractNote: contractNote || null,
          feeContract: feeDetails || null,
          contractNotes: contractNote || null
        });

        // Exit edit mode and refresh display
        document.getElementById('warrantyPeriodDisplay').classList.remove('hidden');
        document.getElementById('warrantyPeriodInput').classList.add('hidden');
        document.getElementById('feeContractDisplay').classList.remove('hidden');
        document.getElementById('feeContractInput').classList.add('hidden');
        document.getElementById('contractNotesDisplay').classList.remove('hidden');
        document.getElementById('contractNotesInput').classList.add('hidden');

        editBtn.classList.remove('hidden');
        editActions.classList.add('hidden');

        // Refresh the detail view
        renderCompanyDetail();
        renderTable();

        alert('契約情報を保存しました');
      } catch (error) {
        console.error('Failed to save contract info:', error);
        alert('保存に失敗しました');
      }
    });
  }
}

function attachContactInfoEditHandlers(company) {
  const editBtn = document.getElementById('contactInfoEditBtn');
  const cancelBtn = document.getElementById('contactInfoCancelBtn');
  const saveBtn = document.getElementById('contactInfoSaveBtn');
  const editActions = document.getElementById('contactInfoEditActions');

  if (!editBtn) return;

  editBtn.addEventListener('click', () => {
    document.getElementById('contactNameDisplay').classList.add('hidden');
    document.getElementById('contactNameInput').classList.remove('hidden');
    document.getElementById('contactEmailDisplay').classList.add('hidden');
    document.getElementById('contactEmailInput').classList.remove('hidden');

    editBtn.classList.add('hidden');
    editActions.classList.remove('hidden');
  });

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      document.getElementById('contactNameDisplay').classList.remove('hidden');
      document.getElementById('contactNameInput').classList.add('hidden');
      document.getElementById('contactEmailDisplay').classList.remove('hidden');
      document.getElementById('contactEmailInput').classList.add('hidden');

      editBtn.classList.remove('hidden');
      editActions.classList.add('hidden');

      renderCompanyDetail();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const contactName = document.getElementById('contactNameInput').value.trim();
      const contactEmail = document.getElementById('contactEmailInput').value.trim();

      const payload = buildContactUpdatePayload(company, {
        contactName: contactName || null,
        contactEmail: contactEmail || null
      });

      try {
        await saveContactInfo(payload);
        applyClientProfileEdits(company.id, {
          contactName: contactName || null,
          contactEmail: contactEmail || null,
          contact: contactName || contactEmail || '-'
        });

        document.getElementById('contactNameDisplay').classList.remove('hidden');
        document.getElementById('contactNameInput').classList.add('hidden');
        document.getElementById('contactEmailDisplay').classList.remove('hidden');
        document.getElementById('contactEmailInput').classList.add('hidden');

        editBtn.classList.remove('hidden');
        editActions.classList.add('hidden');

        renderCompanyDetail();
        renderTable();

        alert('担当者情報を保存しました');
      } catch (error) {
        console.error('Failed to save contact info:', error);
        alert('保存に失敗しました');
      }
    });
  }
}



function collectDetailEdits() {

  const salaryMin = readOptionalNumberValue('referralDesiredSalaryMin');

  const salaryMax = readOptionalNumberValue('referralDesiredSalaryMax');



  const desiredTalent = {

    salaryRange: [salaryMin || 0, salaryMax || 0],

    mustQualifications: parseListValue(readInputValue('referralDesiredMust')),

    niceQualifications: parseListValue(readInputValue('referralDesiredNice')),

    locations: parseListValue(readInputValue('referralDesiredLocations')),

    personality: parseListValue(readInputValue('referralDesiredPersonality')),

    experiences: parseListValue(readInputValue('referralDesiredExperiences'))

  };



  const selectionNote = document.getElementById('referralSelectionNote')?.value ?? '';



  return {

    desiredTalent,

    selectionNote,

    salaryMin,

    salaryMax

  };

}



function buildDetailUpdatePayload(companyId, edits) {

  const hasSalary = edits.salaryMin !== null || edits.salaryMax !== null;



  return {

    id: companyId,

    salaryRange: hasSalary ? edits.desiredTalent.salaryRange : null,

    mustQualifications: edits.desiredTalent.mustQualifications,

    niceQualifications: edits.desiredTalent.niceQualifications,

    desiredLocations: edits.desiredTalent.locations,

    personalityTraits: edits.desiredTalent.personality,

    requiredExperience: edits.desiredTalent.experiences,

    selectionNote: edits.selectionNote || null

  };

}



async function saveCompanyDetail(payload) {

  const res = await fetch(CLIENTS_PROFILE_API_URL, {

    method: 'PUT',

    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },

    body: JSON.stringify(payload)

  });



  if (!res.ok) {

    const errorBody = await res.text().catch(() => '');

    throw new Error(`HTTP Error: ${res.status} ${errorBody}`);

  }



  return res.json().catch(() => ({}));

}

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text || text === '-' || text === 'ー') return null;
  return text;
}

function buildContactUpdatePayload(company, updates = {}) {
  return {
    id: company?.id,
    contactName: normalizeOptionalText(updates.contactName),
    contactEmail: normalizeOptionalText(updates.contactEmail)
  };
}

function buildContractUpdatePayload(company, updates = {}) {
  return {
    id: company?.id,
    warrantyPeriod: updates.warrantyPeriod ?? null,
    feeDetails: normalizeOptionalText(updates.feeDetails),
    contractNote: normalizeOptionalText(updates.contractNote)
  };
}

async function saveContactInfo(payload) {
  return saveClientUpdate(payload);
}

async function saveContractInfo(payload) {
  return saveClientUpdate(payload);
}

async function saveClientUpdate(payload) {
  const res = await fetch(CLIENTS_PROFILE_API_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`HTTP Error: ${res.status} ${errorBody}`);
  }

  return res.json().catch(() => ({}));
}

function applyClientProfileEdits(companyId, updates = {}) {
  const applyTo = (list) => {
    const index = list.findIndex((item) => item.id === companyId);
    if (index !== -1) Object.assign(list[index], updates);
  };

  applyTo(allData);
  applyTo(filteredData);
}



async function handleDetailSave(company) {

  if (!company) return;



  const saveBtn = document.getElementById('referralDetailSaveBtn');

  const cancelBtn = document.getElementById('referralDetailCancelBtn');

  if (saveBtn) {

    saveBtn.disabled = true;

    saveBtn.textContent = '保存中...';

  }

  if (cancelBtn) cancelBtn.disabled = true;



  const edits = collectDetailEdits();

  const payload = buildDetailUpdatePayload(company.id, edits);



  try {

    await saveCompanyDetail(payload);

    applyDetailEdits(company, edits);

    detailEditMode = false;

    renderCompanyDetail();

    renderTable();

  } catch (err) {

    console.error('紹介実績更新失敗:', err);

    alert('紹介実績の保存に失敗しました。時間をおいて再度お試しください。');

  } finally {

    if (saveBtn) {

      saveBtn.disabled = false;

      saveBtn.textContent = '保存';

    }

    if (cancelBtn) cancelBtn.disabled = false;

  }

}



function applyDetailEdits(company, edits) {

  if (!company) return;



  company.desiredTalent = edits.desiredTalent;

  company.selectionNote = edits.selectionNote || '';

}



// ==========================================

// 新規紹介先企業の登録

// ==========================================

function initializeCreateForm() {

  const toggleBtn = document.getElementById('referralCreateToggle');

  const panel = document.getElementById('referralCreateFormPanel');

  const openLabel = '新規紹介先企業登録';

  const closeLabel = '入力画面を閉じる';



  const setOpen = (open) => {

    if (!toggleBtn || !panel) return;

    panel.classList.toggle('hidden', !open);

    toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');

    toggleBtn.textContent = open ? closeLabel : openLabel;

  };



  if (toggleBtn && panel) {

    setOpen(false);

    toggleBtn.addEventListener('click', () => {

      const isOpen = !panel.classList.contains('hidden');

      setOpen(!isOpen);

    });

  }



  document.getElementById('referralCreateSubmit')?.addEventListener('click', handleCreateSubmit);

  document.getElementById('referralCreateReset')?.addEventListener('click', () => resetCreateForm(true));

}

function updateUI() {
  renderTable();
  renderCompanyDetail();
  updatePaginationInfo();
  updateFilterCount();
  updateReferralSortIndicators();
}





function setCreateStatus(message, variant = 'info') {

  const el = document.getElementById('referralCreateStatus');

  if (!el) return;

  el.textContent = message || '';

  el.classList.remove('text-slate-500', 'text-rose-600', 'text-emerald-600', 'text-indigo-600');
  if (variant === 'error') el.classList.add('text-rose-600');
  else if (variant === 'success') el.classList.add('text-emerald-600');
  else el.classList.add('text-indigo-600');
}



function resetCreateForm(clearStatus = false) {

  const ids = [

    'referralCreateCompany', 'referralCreateJobTitle', 'referralCreatePlanHeadcount',

    'referralCreateIndustry', 'referralCreateLocation', 'referralCreateFee',
    'referralCreateContactName', 'referralCreateContactEmail',

    'referralCreateSalaryMin', 'referralCreateSalaryMax',

    'referralCreateMust', 'referralCreateNice', 'referralCreateLocations',

    'referralCreatePersonality', 'referralCreateExperiences',
    'referralCreateWarrantyPeriod', 'referralCreateFeeContract', 'referralCreateContractNotes',

    'referralCreateSelectionNote'

  ];

  ids.forEach(id => {

    const el = document.getElementById(id);

    if (el) el.value = '';

  });

  if (clearStatus) setCreateStatus('');

}



function collectCreateFormData() {

  const company = readInputValue('referralCreateCompany');

  const jobTitle = readInputValue('referralCreateJobTitle');

  const industry = readInputValue('referralCreateIndustry');

  const location = readInputValue('referralCreateLocation');
  const contactName = readInputValue('referralCreateContactName');
  const contactEmail = readInputValue('referralCreateContactEmail');

  const planHeadcount = readOptionalNumberValue('referralCreatePlanHeadcount');

  const feeAmount = readOptionalNumberValue('referralCreateFee');

  const selectionNote = readInputValue('referralCreateSelectionNote');

  const salaryMin = readOptionalNumberValue('referralCreateSalaryMin');

  const salaryMax = readOptionalNumberValue('referralCreateSalaryMax');

  const mustQualifications = parseListValue(readInputValue('referralCreateMust'));

  const niceQualifications = parseListValue(readInputValue('referralCreateNice'));

  const desiredLocations = parseListValue(readInputValue('referralCreateLocations'));

  const personality = parseListValue(readInputValue('referralCreatePersonality'));

  const experiences = parseListValue(readInputValue('referralCreateExperiences'));
  const warrantyPeriod = readInputValue('referralCreateWarrantyPeriod');
  const feeDetails = readInputValue('referralCreateFeeContract');
  const contractNote = readInputValue('referralCreateContractNotes');



  if (!company && !jobTitle) {

    return { error: '企業名と募集職種を入力してください' };

  }

  if (!company) {

    return { error: '企業名を入力してください' };

  }

  if (!jobTitle) {

    return { error: '募集職種を入力してください' };

  }



  return {

    company,

    jobTitle,

    industry,

    location,

    planHeadcount,

    feeAmount,

    selectionNote,

    salaryMin,

    salaryMax,

    mustQualifications,

    niceQualifications,

    desiredLocations,

    personality,

    experiences,
    contactName,
    contactEmail,
    warrantyPeriod,
    feeDetails,
    contractNote

  };

}



function buildCreatePayload(data) {

  const hasSalary = data.salaryMin !== null || data.salaryMax !== null;

  const salaryRange = hasSalary ? [data.salaryMin || 0, data.salaryMax || 0] : null;



  return {

    name: data.company,

    companyName: data.company,

    industry: data.industry || null,

    location: data.location || null,

    jobCategories: data.jobTitle || null,

    plannedHiresCount: data.planHeadcount ?? null,

    feeAmount: data.feeAmount ?? null,

    contactName: data.contactName || null,
    contactEmail: data.contactEmail || null,

    warrantyPeriod: data.warrantyPeriod || null,
    feeDetails: data.feeDetails || null,
    contractNote: data.contractNote || null,

    salaryRange,

    mustQualifications: data.mustQualifications ?? [],

    niceQualifications: data.niceQualifications ?? [],

    desiredLocations: data.desiredLocations ?? [],

    personalityTraits: data.personality ?? [],

    requiredExperience: data.experiences ?? [],

    selectionNote: data.selectionNote || null

  };

}



async function createReferralCompany(payload) {

  const res = await fetch(CLIENTS_PROFILE_API_URL, {

    method: 'POST',

    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },

    body: JSON.stringify(payload)

  });



  if (!res.ok) {

    const errorBody = await res.text().catch(() => '');

    throw new Error(`HTTP Error: ${res.status} ${errorBody}`);

  }



  return res.json().catch(() => ({}));

}



function buildCreatedCompany(payload, result) {

  const source = result?.item || result?.data || result?.client || result || {};

  const merged = {

    ...payload,

    ...source,

    name: source.name || payload.name,

    companyName: source.companyName || payload.companyName || payload.name,

    jobCategories: source.jobCategories || payload.jobCategories,

    plannedHiresCount: source.plannedHiresCount ?? payload.plannedHiresCount,

    feeAmount: source.feeAmount ?? payload.feeAmount,

    selectionNote: source.selectionNote ?? payload.selectionNote

  };



  return normalizeReferralItem(merged, allData.length);

}



async function handleCreateSubmit() {

  const submitBtn = document.getElementById('referralCreateSubmit');

  const resetBtn = document.getElementById('referralCreateReset');

  const data = collectCreateFormData();



  if (data.error) {

    setCreateStatus(data.error, 'error');

    return;

  }



  if (submitBtn) {

    submitBtn.disabled = true;

    submitBtn.textContent = '\u767B\u9332\u4E2D...';

  }

  if (resetBtn) resetBtn.disabled = true;

  setCreateStatus('\u767B\u9332\u4E2D...', 'info');



  try {

    const payload = buildCreatePayload(data);

    const result = await createReferralCompany(payload);

    const created = buildCreatedCompany(payload, result);

    allData = [created, ...allData];

    selectedCompanyId = created.id;

    detailEditMode = false;

    applyFilters();

    resetCreateForm(false);

    setCreateStatus('\u767B\u9332\u3057\u307E\u3057\u305F', 'success');

  } catch (err) {

    console.error('new company create failed:', err);

    setCreateStatus('\u767B\u9332\u306B\u5931\u6557\u3057\u307E\u3057\u305F', 'error');

  } finally {

    if (submitBtn) {

      submitBtn.disabled = false;

      submitBtn.textContent = '\u767B\u9332';

    }

    if (resetBtn) resetBtn.disabled = false;

  }

}



// ==========================================

// UI イベント処理

// ==========================================

function initializeFilters() {

  document.getElementById('referralCompanyFilter')?.addEventListener('input', applyFilters);

  document.getElementById('referralDateStart')?.addEventListener('change', applyFilters);

  document.getElementById('referralDateEnd')?.addEventListener('change', applyFilters);

  document.getElementById('referralJobFilter')?.addEventListener('change', applyFilters);

  document.getElementById('referralFilterReset')?.addEventListener('click', () => {

    document.getElementById('referralCompanyFilter').value = '';

    document.getElementById('referralDateStart').value = '2024-01-01';

    document.getElementById('referralDateEnd').value = '2025-12-31';

    document.getElementById('referralJobFilter').value = '';

    applyFilters();

  });

}



function updateReferralSortIndicators() {

  const [key, dir] = String(currentSort || '').split('-');

  const headers = document.querySelectorAll('#referralTable th[data-sort]');

  headers.forEach(th => {

    const isActive = key && th.dataset.sort === key;

    th.classList.toggle('is-sorted', isActive);

    if (isActive && (dir === 'asc' || dir === 'desc')) {

      th.dataset.sortDir = dir;

      th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');

    } else {

      th.removeAttribute('data-sort-dir');

      th.setAttribute('aria-sort', 'none');

    }

  });

}



function initializeSort() {

  const sortSelect = document.getElementById('referralSortSelect');

  sortSelect?.addEventListener('change', e => {

    currentSort = e.target.value;

    applySort();

    renderTable();

    updateReferralSortIndicators();

  });

  document.querySelectorAll('.sortable').forEach(header => {

    header.addEventListener('click', () => {

      const sortKey = header.dataset.sort;

      const isDesc = currentSort === `${sortKey}-asc`;

      currentSort = `${sortKey}-${isDesc ? 'desc' : 'asc'}`;

      if (sortSelect) { const opt = Array.from(sortSelect.options).find(o => o.value === currentSort); if (opt) sortSelect.value = currentSort; }

      applySort();

      renderTable();

      updateReferralSortIndicators();

    });

  });

  updateReferralSortIndicators();

}



function initializePagination() {

  const update = () => { renderTable(); updatePaginationInfo(); };

  document.getElementById('referralPrevBtn')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; update(); } });

  document.getElementById('referralNextBtn')?.addEventListener('click', () => { if (currentPage < Math.ceil(filteredData.length / pageSize)) { currentPage++; update(); } });

  document.getElementById('referralPageSize')?.addEventListener('change', (e) => { pageSize = Number(e.target.value) || 50; currentPage = 1; applyFilters(); });

}



function updatePaginationInfo() {

  const total = Math.ceil(filteredData.length / pageSize) || 1;

  document.getElementById('referralPageInfo').textContent = `${currentPage} / ${total}`;

}



function updateFilterCount() {

  document.getElementById('referralFilterCount').textContent = `${filteredData.length}社`;

}



function initializeExport() {

  document.getElementById('referralExportBtn')?.addEventListener('click', () => {

    if (!filteredData.length) return;

    const header = ['ID', '企業名', '残り人数', '定着率', '職種', '提案', '書類', '一次', '二次', '内定', '入社', '採用予定', '返金額', 'Fee', 'LT', '辞退理由', '辞退人数', '脱落人数'];

    const rows = filteredData.map(d => [d.id, d.company, d.remaining, d.retention, d.jobTitle, d.proposal, d.docScreen, d.interview1, d.interview2, d.offer, d.joined, d.planHeadcount, d.refundAmount, d.feeDisplay, d.leadTime, d.prejoinDeclineReason, d.prejoinDeclines, d.dropoutCount].map(v => `"${v}"`).join(','));

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), [header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');

    link.href = URL.createObjectURL(blob);

    link.download = `referral_data.csv`;

    link.click();

  });

}



// ==========================================

// AIマッチング機能（サイドパネル用）

// ==========================================

function initializeMatchingTabs() {

  const cTab = document.getElementById('matchTabCandidate'), kTab = document.getElementById('matchTabCondition');

  const cPanel = document.getElementById('matchCandidatePanel'), kPanel = document.getElementById('matchConditionPanel');

  const switchTab = (isCand) => {

    cTab.className = isCand ? 'py-2 px-1 border-b-2 border-indigo-500 text-indigo-600 text-sm font-medium' : 'py-2 px-1 border-b-2 border-transparent text-slate-500 hover:text-slate-700 text-sm font-medium';

    kTab.className = !isCand ? 'py-2 px-1 border-b-2 border-indigo-500 text-indigo-600 text-sm font-medium' : 'py-2 px-1 border-b-2 border-transparent text-slate-500 hover:text-slate-700 text-sm font-medium';

    if (isCand) { cPanel.classList.remove('hidden'); kPanel.classList.add('hidden'); } else { cPanel.classList.add('hidden'); kPanel.classList.remove('hidden'); }

  };

  cTab?.addEventListener('click', () => switchTab(true));

  kTab?.addEventListener('click', () => switchTab(false));

}



function initializeMatching() {

  document.getElementById('matchFromCandidate')?.addEventListener('click', () => {

    const text = document.getElementById('candidateText').value;

    if (!text.trim()) return alert('プロフィールを入力してください');

    executeMatching(parseProfileText(text));

  });

  document.getElementById('matchFromCondition')?.addEventListener('click', () => {

    executeMatching({

      salaryMin: parseFloat(document.getElementById('conditionSalaryMin').value) || 0,

      salaryMax: parseFloat(document.getElementById('conditionSalaryMax').value) || 9999,

      jobTitle: document.getElementById('conditionJobTitle').value || '',

      locations: splitInput('conditionLocation'),

      qualifications: [...splitInput('conditionMustQualifications'), ...splitInput('conditionNiceQualifications')],

      keywords: [...splitInput('conditionPersonality'), ...splitInput('conditionExperiences'), ...splitInput('conditionSkills')]

    });

  });

}



function splitInput(id) { return (document.getElementById(id)?.value || '').split(/[,、\s]+/).filter(Boolean); }



function parseProfileText(text) {

  const t = normalizeText(text);

  const criteria = { salaryMin: 0, salaryMax: 9999, locations: [], qualifications: [], jobTitle: '', keywords: [] };

  ['東京', '大阪', '名古屋', '福岡', 'リモート'].forEach(l => { if (t.includes(l)) criteria.locations.push(l); });

  if (t.includes('java')) criteria.keywords.push('Java');

  if (t.includes('python')) criteria.keywords.push('Python');

  if (t.includes('aws')) criteria.qualifications.push('AWS');

  if (t.includes('pm') || t.includes('マネージャー')) criteria.jobTitle = 'マネージャー';

  else if (t.includes('営業') || t.includes('セールス')) criteria.jobTitle = 'セールス';

  else criteria.jobTitle = 'エンジニア';

  return criteria;

}



function executeMatching(criteria) {

  const scored = filteredData.map(company => {

    let score = 0, reasons = [];

    const dt = company.desiredTalent;



    // 年収

    const [cMin, cMax] = dt.salaryRange;

    if (cMin === 0 && cMax === 0) score += 10;

    else if (criteria.salaryMax >= cMin && criteria.salaryMin <= cMax) { score += 30; reasons.push('年収レンジ合致'); }


    // 勤務地

    if (criteria.locations.some(l => dt.locations.some(cl => cl.includes(l))) || dt.locations.includes('リモート')) { score += 20; reasons.push('勤務地合致'); }


    // キーワード

    const allReqs = [...dt.mustQualifications, ...dt.niceQualifications, ...dt.experiences, ...dt.personality];

    const userKw = [...criteria.qualifications, ...criteria.keywords];

    let hitCount = 0;

    userKw.forEach(k => { if (allReqs.some(req => normalizeText(req).includes(normalizeText(k)))) hitCount++; });

    if (hitCount > 0) { score += Math.min(hitCount * 15, 50); reasons.push(`キーワード${hitCount}件一致`); }


    // 職種

    if (company.jobTitle.includes(criteria.jobTitle)) score += 10;



    return { company, score: Math.min(score, 100), reasons };

  });



  scored.sort((a, b) => b.score - a.score);

  renderMatchResults(scored.slice(0, 10));

}



function renderMatchResults(results) {

  const container = document.getElementById('matchResults');

  if (!results.length || results[0].score === 0) return container.innerHTML = '<div class="text-center text-slate-500 py-8">条件に合う企業が見つかりませんでした</div>';

  container.innerHTML = results.map(r => `

    <div class="flex items-start justify-between border-b border-slate-100 pb-3 last:border-0 hover:bg-slate-50 p-2 rounded transition">

      <div>

        <div class="flex items-center gap-2">

          <span class="font-bold text-slate-800 text-sm cursor-pointer hover:underline hover:text-indigo-600"

                onclick="document.querySelector('tr[data-company-id=\\'${r.company.id}\\']').click();document.getElementById('referralCompanyDetail').scrollIntoView({behavior:'smooth'})">

            ${r.company.company}

          </span>

          <span class="text-xs text-slate-500 bg-slate-100 px-1.5 rounded">${r.company.jobTitle}</span>

        </div>

        <div class="text-xs text-slate-500 mt-1 flex gap-2 flex-wrap">${r.reasons.map(reason => `<span class="text-indigo-600 bg-indigo-50 px-1 rounded">${reason}</span>`).join('')}</div>

      </div>

      <div class="flex flex-col items-end"><span class="text-lg font-bold text-indigo-600">${r.score}%</span><span class="text-[10px] text-slate-400">マッチ度</span></div>

    </div>

  `).join('');

}



export async function mount(appElement) {

  try {

    initializeCreateForm();

    initReferralCandidateModal();

    await loadReferralData();

    await loadCandidateSummaries();

    updateUI();

    attachFilters();

    attachPagination();

    attachRowClickHandlers();

    attachExport();

    attachMatchingHandlers();

    const detail = document.getElementById('referralCompanyDetail');
    if (detail) {
      detail.classList.add('hidden');
    }

  } catch (e) {

    console.error('[referral] mount error:', e);

  }

}
