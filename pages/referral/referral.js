// ==========================================
// 状態管理変数
// ==========================================
let currentPage = 1;
let pageSize = 50;
let filteredData = [];
let allData = [];
let currentSort = 'company-asc';
let selectedCompanyId = null;
let detailEditMode = false;
const CLIENTS_API_URL = 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev/kpi/clients';

// ★修正: 候補者にIDを追加（遷移用）
const mockAllCandidates = [
  { id: 'cand-001', name: '佐藤 健太', title: 'データサイエンティスト', age: 29, salary: 900, location: '東京', qualifications: ['統計検定2級', 'G検定'], skills: ['Python', '需要予測', 'SQL', 'AWS'], personality: ['分析志向', '論理的'], note: '製造業のデータ分析経験豊富' },
  { id: 'cand-002', name: '鈴木 美咲', title: 'PM / プロダクトマネージャー', age: 34, salary: 1000, location: '東京', qualifications: ['PMP'], skills: ['BPR', 'Jira', 'アジャイル開発', '要件定義'], personality: ['リーダーシップ', '調整力'], note: '大規模SIerでのPM経験あり' },
  { id: 'cand-003', name: '田中 翔', title: 'バックエンドエンジニア', age: 27, salary: 750, location: 'リモート', qualifications: ['AWS SAA'], skills: ['Java', 'Go', 'Microservices', 'Docker'], personality: ['探究心', 'チームワーク'], note: 'モダンな開発環境を希望' },
  { id: 'cand-004', name: '高橋 優子', title: 'セールスマネージャー', age: 31, salary: 850, location: '大阪', qualifications: [], skills: ['法人営業', 'チームマネジメント', 'SaaS営業', 'KPI管理'], personality: ['行動力', '達成意欲'], note: '関西エリアの新規開拓が得意' },
  { id: 'cand-005', name: '伊藤 健', title: 'フロントエンドエンジニア', age: 26, salary: 600, location: '福岡', qualifications: [], skills: ['React', 'TypeScript', 'Next.js', 'Figma'], personality: ['柔軟性', '協調性'], note: 'UI/UXデザインにも興味あり' },
  { id: 'cand-006', name: '渡辺 誠', title: 'SRE / インフラエンジニア', age: 30, salary: 950, location: '東京', qualifications: ['AWS SAP', 'LPIC-2'], skills: ['Terraform', 'Kubernetes', 'CI/CD', 'Python'], personality: ['慎重', '責任感'], note: '大規模トラフィックの運用経験' }
];

// ★追加: 候補者詳細ページへの遷移用関数（グローバルに公開）
window.navigateToCandidate = function (candidateId) {
  // 遷移先のページで開くべきIDをストレージに保存（簡易的なデータ渡し）
  sessionStorage.setItem('target_candidate_id', candidateId);

  // ルーターの仕様に合わせてハッシュを変更して遷移 (例: #candidates)
  // ※実際のルーターのパスに合わせて変更してください
  window.location.hash = 'candidates';

  console.log(`Navigating to candidate: ${candidateId}`);
};

// ==========================================
// 初期化・終了処理
// ==========================================
export function mount() {
  initializeFilters();
  initializePagination();
  initializeSort();
  initializeExport();
  initializeMatchingTabs();
  initializeMatching();

  // APIからデータをロード
  loadReferralData()
    .then(() => {
      renderCompanyDetail();
      updateFilterCount();
    })
    .catch((e) => {
      console.error('API取得失敗:', e);
      allData = [];
      filteredData = [];
      renderTable();
      renderCompanyDetail();
      updateFilterCount();
    });
}

export function unmount() {
  const ids = [
    'referralCompanyFilter', 'referralDateStart', 'referralDateEnd', 'referralJobFilter', 'referralFilterReset',
    'referralSortSelect', 'referralPrevBtn', 'referralNextBtn', 'referralPageSize', 'referralExportBtn',
    'matchTabCandidate', 'matchTabCondition', 'matchFromCandidate', 'matchFromCondition', 'matchResultSort'
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
}

// ==========================================
// データ取得・正規化
// ==========================================
async function loadReferralData() {
  const from = document.getElementById('referralDateStart')?.value || '';
  const to = document.getElementById('referralDateEnd')?.value || '';
  const job = document.getElementById('referralJobFilter')?.value || '';

  const url = new URL(CLIENTS_API_URL);
  if (from) url.searchParams.set('from', from);
  if (to) url.searchParams.set('to', to);
  if (job) url.searchParams.set('job', job);

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

  const json = await res.json();
  const items = Array.isArray(json?.items) ? json.items : (Array.isArray(json) ? json : []);

  allData = items.map((item, index) => normalizeReferralItem(item, index));

  if (allData.length > 0) {
    selectedCompanyId = allData[0].id;
  }

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
  const contact = str(['contactName', 'contact', 'contactPerson'], '-');
  const location = str(['location', 'workLocation'], '-');

  const planHeadcount = num(['plannedHiresCount', 'planHeadcount', 'plan_headcount']);
  const joined = num(['hiredCount', 'joined', 'count_joined']);

  let remaining = num(['remainingHiringCount', 'remaining', 'remaining_hiring_count'], -999);
  if (remaining === -999) remaining = Math.max(planHeadcount - joined, 0);

  const retentionRaw = val(['retentionRate', 'retention', 'retention_rate']);
  const retention = formatRetention(retentionRaw);

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

  const jobTitle = str(['jobCategories', 'jobTitle', 'job_categories'], '-');
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
  const currentCandidates = normalizeCandidates(item.currentCandidates || item.candidates || []);

  return {
    id, company, industry, contact, location,
    planHeadcount, joined, remaining,
    retention, refundAmount, leadTime, feeDisplay, feeValue,
    proposal, docScreen, interview1, interview2, offer,
    jobTitle, highlightPosition,
    prejoinDeclines, prejoinDeclineReason, dropoutCount,
    desiredTalent, currentCandidates, selectionNote
  };
}

// ==========================================
// ヘルパー関数
// ==========================================
function formatRetention(val) {
  if (val !== null && val !== undefined && val !== '') {
    const n = parseFloat(val);
    if (!isNaN(n)) return n <= 1 ? `${Math.round(n * 100)}%` : `${n}%`;
    if (typeof val === 'string' && val.includes('%')) return val;
  }
  return '-';
}

function formatFee(val) {
  if (!val) return '-';
  if (val > 100) return `¥${val.toLocaleString()}`;
  const rate = val <= 1 ? val * 100 : val;
  return `${Math.round(rate)}%`;
}

function formatCurrency(val) {
  return val == null ? '-' : `¥${Number(val).toLocaleString('ja-JP')}`;
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

// ヘルパー: 求める人材データの正規化（修正版）
function normalizeDesiredTalent(src) {
  // リスト項目（資格や勤務地など）を配列化するヘルパー
  const list = (k) => {
    if (Array.isArray(src[k])) return src[k];
    if (typeof src[k] === 'string') {
      // カンマ、読点、改行、スペース等で分割
      return src[k].split(/[,、\n\s]+/).filter(str => str.trim().length > 0);
    }
    return [];
  };

  // ★修正: 年収レンジ（文字列）を数値配列 [min, max] に変換する処理を追加
  let salaryRange = [0, 0];

  if (Array.isArray(src.salaryRange) && src.salaryRange.length >= 2) {
    // 既に配列の場合
    salaryRange = [Number(src.salaryRange[0]), Number(src.salaryRange[1])];
  } else if (typeof src.salaryRange === 'string') {
    // 文字列の場合 (例: "600万〜900万", "600-900")
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
  return list.map(c => ({
    name: c.name || c.candidateName || '-',
    stage: c.stage || c.status || '-',
    date: c.date || c.registeredAt || '-',
    note: c.note || c.memo || ''
  }));
}

function listToInputValue(list) {
  if (!Array.isArray(list)) return '';
  return list.filter(Boolean).join(', ');
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
  const must = dt.mustQualifications?.length ? dt.mustQualifications.join(' / ') : '';
  const nice = dt.niceQualifications?.length ? dt.niceQualifications.join(' / ') : '';
  const exp = dt.experiences?.length ? dt.experiences.join(' / ') : '';
  const salary = dt.salaryRange ? `${dt.salaryRange[0]}〜${dt.salaryRange[1]}万` : '年収レンジ未設定';
  const pos = company.highlightPosition || company.jobTitle || 'ポジション未設定';
  const parts = [must ? `必須「${must}」` : '', nice ? `歓迎「${nice}」` : '', exp ? `経験「${exp}」` : ''].filter(Boolean).join('・');
  const personalities = dt.personality?.length ? dt.personality.join(' / ') : '';
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

function retentionBadge(ret) {
  const num = parseFloat(ret);
  if (isNaN(num)) return `<span class="px-2 py-1 rounded-md text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-100">${ret || '-'}</span>`;
  let cls = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
  if (num < 80) cls = 'bg-red-50 text-red-700 border border-red-100';
  else if (num < 90) cls = 'bg-amber-50 text-amber-700 border border-amber-100';
  return `<span class="px-2 py-1 rounded-md text-xs font-semibold ${cls}">${ret}</span>`;
}

// ==========================================
// 企業に対する候補者マッチング計算機能
// ==========================================
function getRecommendedCandidates(company) {
  if (!mockAllCandidates || mockAllCandidates.length === 0) return [];

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

  const scored = mockAllCandidates.map(cand => {
    let score = 0;
    const reasons = [];

    // 年収
    if (minSal === 0 && maxSal === 0) {
      score += 10;
    } else if (cand.salary >= minSal && cand.salary <= maxSal) {
      score += 20;
      reasons.push('年収レンジ一致');
    } else if (maxSal && cand.salary <= maxSal + 100) {
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
    const candKeywords = [...cand.skills, ...cand.qualifications, ...cand.personality, cand.title].filter(Boolean);
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
        <td class="text-left">${retentionBadge(item.retention)}</td>
        <td>${item.jobTitle}</td>
        <td class="text-right">${item.proposal}件</td>
        <td class="text-right">${item.docScreen}件</td>
        <td class="text-right">${item.interview1}件</td>
        <td class="text-right">${item.interview2}件</td>
        <td class="text-right">${item.offer}件</td>
        <td class="text-right">${item.joined}件</td>
        <td class="text-right">${item.planHeadcount}名</td>
        <td class="text-right">${formatCurrency(item.refundAmount)}</td>
        <td class="text-right">${item.leadTime}日</td>
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
  const container = document.getElementById('referralCompanyDetail');
  if (!container) return;
  const company = filteredData.find(c => c.id === selectedCompanyId);
  if (!company) { container.innerHTML = '<div class="text-sm text-slate-500">企業が選択されていません</div>'; return; }

  const badge = (text, classes = '', size = 'px-3 py-1 text-xs') => `<span class="${size} rounded-lg font-semibold ${classes}">${text}</span>`;
  const retentionClass = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
  const leadClass = 'bg-amber-50 text-amber-700 border border-amber-100';
  const refundClass = Number(company.refundAmount) > 0 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-slate-50 text-slate-700 border border-slate-100';
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
    ? `${salaryMinValue || '-'}〜${salaryMaxValue || '-'} 万円`
    : '-';
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
          <span class="text-xs text-slate-400">〜</span>
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
      <div><span class="font-semibold text-slate-700">必須資格：</span>${desired.mustQualifications?.join(' / ') || '-'}</div>
      <div><span class="font-semibold text-slate-700">歓迎資格：</span>${desired.niceQualifications?.join(' / ') || '-'}</div>
      <div><span class="font-semibold text-slate-700">勤務地：</span>${desired.locations?.join(' / ') || '-'}</div>
      <div><span class="font-semibold text-slate-700">性格傾向：</span>${desired.personality?.join(' / ') || '-'}</div>
      <div><span class="font-semibold text-slate-700">経験：</span>${desired.experiences?.join(' / ') || '-'}</div>
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

  const stages = [

    { key: 'proposal', label: '提案', value: company.proposal, color: 'bg-indigo-500' },
    { key: 'docScreen', label: '書類', value: company.docScreen, color: 'bg-sky-500' },
    { key: 'interview1', label: '一次', value: company.interview1, color: 'bg-amber-500' },
    { key: 'interview2', label: '二次', value: company.interview2, color: 'bg-orange-500' },
    { key: 'offer', label: '内定', value: company.offer, color: 'bg-emerald-500' },
    { key: 'joined', label: '入社', value: company.joined, color: 'bg-teal-500' }
  ];

  const candidateBubble = (c) => `
    <div class="inline-flex items-center gap-2 px-2 py-1 bg-white border border-slate-200 rounded-full shadow-sm text-[11px] text-slate-700">
      <span class="inline-block w-2 h-2 rounded-full bg-indigo-500"></span>
      <div class="flex flex-col leading-tight">
        <span class="font-semibold text-[12px]">${c.name}</span>
        <span class="text-slate-500">${formatDateString(c.date)}</span>
      </div>
      ${c.note ? `<span class="text-slate-500">${c.note}</span>` : ''}
    </div>`;

  const flow = stages.map((s, idx) => {
    const stageCands = (company.currentCandidates || []).filter(c => c.stage === s.key);
    const bubbles = stageCands.length ? `<div class="flex flex-col gap-1 mt-2">${stageCands.map(candidateBubble).join('')}</div>` : '';
    return `
      <div class="flex flex-col items-center min-w-[90px]">
        <div class="flex items-center">
          <div class="w-12 h-12 rounded-full ${s.color} text-white flex items-center justify-center text-base font-semibold leading-tight">
            <span>${s.value ?? 0}</span><span class="text-[10px] ml-0.5">件</span>
          </div>
        </div>
        <span class="text-xs text-slate-700 mt-1">${s.label}</span>
        ${bubbles}
      </div>
      ${idx < stages.length - 1 ? '<div class="flex-1 flex items-center justify-center text-slate-400 text-2xl leading-none min-w-[60px] max-w-[80px]">➜</div>' : ''}
    `;
  }).join('');

  // ★修正: 候補者名をクリック可能にし、IDを渡して遷移
  const recommended = getRecommendedCandidates(company);
  const recommendedHtml = recommended.length > 0 ? recommended.map(c => `
    <div class="border border-indigo-100 rounded-lg p-3 bg-white shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-colors">
      <div>
        <div class="flex items-center justify-between mb-1">
          <button class="font-bold text-slate-800 hover:text-indigo-600 hover:underline text-left" 
                  onclick="window.navigateToCandidate('${c.id}')">
            ${c.name}
          </button>
          <span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-bold">${c.matchScore}点</span>
        </div>
        <div class="text-xs text-slate-500 mb-2">${c.title} / ${c.age}歳</div>
        <div class="text-xs text-slate-600 space-y-1">
          <div>📍 ${c.location} / 💰 ${c.salary}万</div>
          <div class="truncate text-slate-500" title="${c.skills.join(', ')}">🔧 ${c.skills.join(', ')}</div>
        </div>
        ${c.matchReasons && c.matchReasons.length
          ? `<div class="mt-2 flex flex-wrap gap-1 text-[10px]">${c.matchReasons.map(reason => `<span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full">${reason}</span>`).join('')}</div>`
          : '<div class="mt-2 text-[10px] text-slate-400">一致ポイントなし</div>'}
      </div>
      <div class="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
        ${c.note}
      </div>
    </div>
  `).join('') : '<div class="text-xs text-slate-400">マッチする候補者が見つかりませんでした</div>';

  container.innerHTML = `
    <div class="border border-slate-200 rounded-xl p-5 bg-white space-y-5 shadow-sm text-sm text-slate-800">
      <div class="flex flex-col lg:flex-row justify-between gap-4 relative">
        <div class="space-y-3 flex-1 min-w-0 w-full lg:pr-48">
          <div class="flex flex-wrap items-center gap-2">
            <div class="text-2xl font-bold text-slate-900">${company.company}</div>
            <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">担当 ${company.contact}</span>
          </div>
          <div class="flex flex-wrap items-center gap-3 text-sm text-slate-700">
            <span class="px-3 py-1 rounded-full bg-slate-100 border border-slate-200">${company.industry}</span>
            <span class="px-3 py-1 rounded-full bg-slate-100 border border-slate-200">${company.location}</span>
          </div>
          <div class="text-lg font-bold text-indigo-800">募集ポジション：${company.highlightPosition}</div>
        </div>
        <div class="text-right space-y-1 w-auto flex-none max-w-full lg:absolute lg:right-0 lg:top-0">
          <div class="text-sm whitespace-normal">
            ${badge(`定着率 ${company.retention}`, retentionClass, 'px-4 py-2 text-sm inline-block whitespace-nowrap')}
            ${badge(`リードタイム ${company.leadTime}日`, leadClass, 'px-4 py-2 text-sm inline-block whitespace-nowrap')}
            ${badge(`Fee ${company.feeDisplay}`, 'bg-indigo-50 text-indigo-700 border border-indigo-100', 'px-4 py-2 text-sm inline-block whitespace-nowrap')}
            ${badge(`返金額 ${formatCurrency(company.refundAmount)}`, refundClass, 'px-4 py-2 text-sm inline-block whitespace-nowrap')}
          </div>
        </div>
      </div>
      
      <div class="p-4 border border-slate-200 bg-slate-50 rounded-lg leading-6 w-full">
        <div class="font-semibold text-slate-900 text-sm mb-1">企業メモ</div>
        <div class="text-base text-slate-800 font-semibold w-full max-w-none">${buildAIInsight(company)}</div>
        <div class="text-slate-800 text-sm mt-2">${buildAgencyInsight(company)}</div>
      </div>

      <div class="space-y-3 pt-1">
        <div class="text-base font-bold text-slate-900 tracking-wide">募集・選考の進捗</div>
        <div class="flex flex-wrap lg:flex-nowrap items-start gap-4 justify-start lg:justify-between">
          ${flow}
        </div>
      </div>

      
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 text-center">
        <div class="p-4 border border-slate-200 rounded-lg bg-slate-50">
          <div class="text-xs text-slate-500">採用予定</div>
          <div class="text-2xl font-bold text-slate-900">${company.planHeadcount}名</div>
        </div>
        <div class="p-4 border border-slate-200 rounded-lg bg-indigo-50">
          <div class="text-xs text-indigo-600">内定 / 入社</div>
          <div class="text-2xl font-bold text-indigo-800">${company.offer} / ${company.joined}</div>
        </div>
        <div class="p-4 border border-slate-200 rounded-lg bg-emerald-50">
          <div class="text-xs text-emerald-700">残り人数</div>
          <div class="text-2xl font-bold text-emerald-800">${company.remaining}</div>
        </div>
      </div>

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="text-sm font-semibold text-slate-700">欲しい人材・選考メモ</div>
          ${editActions}
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
          <div class="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-[15px] leading-6">
            <div class="flex items-center justify-between">
              <div class="font-semibold text-slate-900 text-base">欲しい人材</div>
              ${editing ? '<span class="text-[11px] text-slate-400">カンマ区切り</span>' : ''}
            </div>
            ${desiredContent}
          </div>
          <div class="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-[15px] leading-6">
            <div class="font-semibold text-slate-900 text-base">選考メモ</div>
            ${memoContent}
          </div>
        </div>
      </div>

      <div class="bg-indigo-50/50 rounded-lg p-4 border border-indigo-100">
         <h4 class="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-3">AIマッチング候補者 (Top 3)</h4>
         <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
           ${recommendedHtml}
         </div>
      </div>
    </div>
  `;
  attachDetailEditHandlers(company);
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

async function saveReferralDetail(payload) {
  const res = await fetch(CLIENTS_API_URL, {
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
    await saveReferralDetail(payload);
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

function initializeSort() {
  const sortSelect = document.getElementById('referralSortSelect');
  sortSelect?.addEventListener('change', e => { currentSort = e.target.value; applySort(); renderTable(); });
  document.querySelectorAll('.sortable').forEach(header => {
    header.addEventListener('click', () => {
      const sortKey = header.dataset.sort;
      const isDesc = currentSort === `${sortKey}-asc`;
      currentSort = `${sortKey}-${isDesc ? 'desc' : 'asc'}`;
      if (sortSelect) { const opt = Array.from(sortSelect.options).find(o => o.value === currentSort); if (opt) sortSelect.value = currentSort; }
      applySort(); renderTable();
    });
  });
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
    else if (criteria.salaryMax >= cMin && criteria.salaryMin <= cMax) { score += 30; reasons.push('💰 年収レンジ合致'); }

    // 勤務地
    if (criteria.locations.some(l => dt.locations.some(cl => cl.includes(l))) || dt.locations.includes('リモート')) { score += 20; reasons.push('📍 勤務地合致'); }

    // キーワード
    const allReqs = [...dt.mustQualifications, ...dt.niceQualifications, ...dt.experiences, ...dt.personality];
    const userKw = [...criteria.qualifications, ...criteria.keywords];
    let hitCount = 0;
    userKw.forEach(k => { if (allReqs.some(req => normalizeText(req).includes(normalizeText(k)))) hitCount++; });
    if (hitCount > 0) { score += Math.min(hitCount * 15, 50); reasons.push(`🔑 キーワード${hitCount}件一致`); }

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
