// Referral page module
let currentPage = 1;
let pageSize = 50;
let filteredData = [];
let allData = [];
let currentSort = 'company-asc';
let selectedCompanyId = null;
let currentMatchResults = [];

const mockReferralData = [
  {
    id: 'cmp-c',
    company: 'イノベーション株式会社',
    jobTitle: 'プロジェクトマネージャー',
    highlightPosition: 'プロジェクトマネージャー',
    planHeadcount: 2,
    remaining: 0,
    proposal: 12,
    docScreen: 9,
    interview1: 6,
    interview2: 4,
    offer: 2,
    joined: 2,
    retention: '88%',
    prejoinDeclines: 0,
    location: '東京都新宿区',
    contact: '佐藤次郎',
    industry: 'コンサルティング',
    profile: 'デジタル変革支援に特化したコンサルティング会社です。',
    intro: '顧客折衝と社内調整をバランス良くこなすPMを強化。',
    refundAmount: 0,
    leadTime: 35,
    fee: 0.32,
    dropoutCount: 5,
    prejoinDeclineReason: '勤務地ミスマッチ',
    desiredTalent: {
      salaryRange: [900, 1200],
      mustQualifications: ['PMP'],
      niceQualifications: ['英語ビジネス'],
      locations: ['東京'],
      personality: ['リーダーシップ', '調整力'],
      experiences: ['PM3年以上', 'BPR']
    },
    currentCandidates: [
      { name: '山田太郎', stage: 'interview1', note: 'PM経験5年 / BPR', date: '2024-05-18' },
      { name: '鈴木花子', stage: 'docScreen', note: 'BPR・英語ビジネス', date: '2024-05-12' },
      { name: '李 健', stage: 'offer', note: '内定保留中', date: '2024-05-22' }
    ]
  },
  {
    id: 'cmp-b',
    company: 'チェックコーポレーション',
    jobTitle: 'バックエンドエンジニア',
    highlightPosition: 'バックエンドエンジニア',
    planHeadcount: 3,
    remaining: 1,
    proposal: 18,
    docScreen: 6,
    interview1: 4,
    interview2: 2,
    offer: 2,
    joined: 2,
    retention: '95%',
    prejoinDeclines: 0,
    location: '大阪府大阪市',
    contact: '伊藤遥',
    industry: 'IT・ソフトウェア',
    profile: 'エンタープライズ向け自社サービスの開発組織です。',
    intro: '堅実なアーキテクチャと安定運用が強みのバックエンド基盤。',
    refundAmount: 80000,
    leadTime: 28,
    fee: 0.25,
    dropoutCount: 3,
    prejoinDeclineReason: '他社オファー優先',
    desiredTalent: {
      salaryRange: [700, 1000],
      mustQualifications: ['情報処理安全確保支援士'],
      niceQualifications: ['AWS SAA', 'LPIC-2'],
      locations: ['大阪', 'リモート'],
      personality: ['探究心', 'チームワーク'],
      experiences: ['Java5年以上', 'マイクロサービス']
    },
    currentCandidates: [
      { name: '中村陽介', stage: 'interview2', note: 'Java8年 / マイクロサービス', date: '2024-05-20' },
      { name: 'Alex Chen', stage: 'interview1', note: 'LPIC-2 / SRE経験', date: '2024-05-15' }
    ]
  },
  {
    id: 'cmp-a',
    company: '株式会社サンプルA',
    jobTitle: 'フロントエンドエンジニア',
    highlightPosition: 'フロントエンドエンジニア',
    planHeadcount: 5,
    remaining: 2,
    proposal: 15,
    docScreen: 12,
    interview1: 8,
    interview2: 5,
    offer: 3,
    joined: 3,
    retention: '100%',
    prejoinDeclines: 0,
    location: '東京都千代田区',
    contact: '田中陽子',
    industry: 'IT・ソフトウェア',
    profile: 'AI・データ分析を軸にしたSaaSを展開するスタートアップです。',
    intro: 'SaaSプロダクトのUI/UXをリードできる人材を募集。',
    refundAmount: 120000,
    leadTime: 21,
    fee: 0.3,
    dropoutCount: 4,
    prejoinDeclineReason: '年収ミスマッチ',
    desiredTalent: {
      salaryRange: [600, 900],
      mustQualifications: ['基本情報技術者'],
      niceQualifications: ['AWS SAA'],
      locations: ['東京', 'リモート'],
      personality: ['柔軟', 'チーム志向'],
      experiences: ['React3年以上', 'B2B SaaS']
    },
    currentCandidates: [
      { name: '佐々木理央', stage: 'docScreen', note: 'React5年 / SaaS', date: '2024-05-10' },
      { name: '小林優', stage: 'proposal', note: 'Next.js / TS', date: '2024-05-08' }
    ]
  },
  {
    id: 'cmp-d',
    company: 'スカイリンクテクノロジーズ',
    jobTitle: 'データサイエンティスト',
    highlightPosition: 'データサイエンティスト',
    planHeadcount: 4,
    remaining: 3,
    proposal: 10,
    docScreen: 7,
    interview1: 5,
    interview2: 3,
    offer: 2,
    joined: 1,
    retention: '82%',
    prejoinDeclines: 1,
    location: '愛知県名古屋市',
    contact: '高橋紗季',
    industry: 'IT・AI',
    profile: '製造業向けの需要予測プロダクトを展開。',
    intro: 'MLOpsと需要予測モデル強化を目指す。',
    refundAmount: 50000,
    leadTime: 18,
    fee: 0.28,
    dropoutCount: 2,
    prejoinDeclineReason: '他社オファー優先',
    desiredTalent: {
      salaryRange: [700, 1100],
      mustQualifications: ['統計検定2級'],
      niceQualifications: ['G検定', 'AWS SAA'],
      locations: ['名古屋', 'リモート'],
      personality: ['分析志向', '協調性'],
      experiences: ['Python3年以上', '需要予測', 'MLOps']
    },
    currentCandidates: [
      { name: '松本涼', stage: 'docScreen', note: '需要予測 / G検定', date: '2024-05-14' },
      { name: '庄司慧', stage: 'proposal', note: 'Python / 製造データ', date: '2024-05-09' }
    ]
  },
  {
    id: 'cmp-e',
    company: 'グローバルリンク社',
    jobTitle: 'セールスマネージャー',
    highlightPosition: 'セールスマネージャー',
    planHeadcount: 2,
    remaining: 1,
    proposal: 9,
    docScreen: 6,
    interview1: 4,
    interview2: 3,
    offer: 2,
    joined: 1,
    retention: '76%',
    prejoinDeclines: 1,
    location: '福岡県福岡市',
    contact: '藤田直樹',
    industry: 'SaaS',
    profile: 'グローバルSaaSの日本展開をリード。',
    intro: 'エンタープライズ営業の仕組み化とKPI設計を強化。',
    refundAmount: 150000,
    leadTime: 40,
    fee: 0.35,
    dropoutCount: 3,
    prejoinDeclineReason: '他社オファー優先',
    desiredTalent: {
      salaryRange: [800, 1200],
      mustQualifications: ['英語ビジネス', '営業マネジメント経験'],
      niceQualifications: ['MBA'],
      locations: ['福岡', 'リモート'],
      personality: ['リーダーシップ', '結果志向'],
      experiences: ['SaaS営業5年以上', 'マネジメント3年以上']
    },
    currentCandidates: [
      { name: '木村真琴', stage: 'interview1', note: 'SaaS営業6年 / 英語◎', date: '2024-05-16' },
      { name: 'Sarah Lee', stage: 'offer', note: '外資SaaSマネージャー', date: '2024-05-21' }
    ]
  }
];

let mockMatchingResults = [];

const mockCandidatesList = [
  {
    name: '佐藤優',
    title: 'データサイエンティスト',
    salary: 950,
    location: '名古屋',
    qualifications: ['統計検定2級', 'G検定'],
    experiences: ['需要予測', 'MLOps', 'Python3年以上'],
    personality: ['分析志向', '協調性'],
    note: '製造業データで需要予測モデル構築・MLOps導入'
  },
  {
    name: 'Alex Chen',
    title: 'バックエンド/SRE',
    salary: 900,
    location: 'リモート',
    qualifications: ['LPIC-2'],
    experiences: ['マイクロサービス', 'SRE', 'Java5年以上'],
    personality: ['探究心', 'チーム志向'],
    note: 'LPIC-2保持、マイクロサービス運用'
  },
  {
    name: '木村真琴',
    title: 'セールスマネージャー',
    salary: 1100,
    location: '福岡',
    qualifications: ['英語ビジネス'],
    experiences: ['SaaS営業5年以上', 'マネジメント3年以上'],
    personality: ['リーダーシップ', '結果志向'],
    note: '外資SaaSでエンタープライズ営業チームをリード'
  },
  {
    name: '李健',
    title: 'プロジェクトマネージャー',
    salary: 1050,
    location: '東京',
    qualifications: ['PMP'],
    experiences: ['PM3年以上', 'BPR'],
    personality: ['リーダーシップ', '調整力'],
    note: 'デジタル変革案件でPM経験豊富'
  },
  {
    name: '佐々木理央',
    title: 'フロントエンドエンジニア',
    salary: 800,
    location: 'リモート',
    qualifications: ['AWS SAA'],
    experiences: ['React3年以上', 'B2B SaaS'],
    personality: ['柔軟', 'チーム志向'],
    note: 'SaaSのUI/UX改善をリード'
  }
];

export function mount() {
  loadReferralData();
  initializeFilters();
  initializePagination();
  initializeSort();
  initializeExport();
  initializeMatchingTabs();
  initializeMatching();
  renderCompanyDetail();
  updateFilterCount();
}

export function unmount() {
  const elements = [
    'referralCompanyFilter', 'referralDateStart', 'referralDateEnd', 'referralJobFilter', 'referralFilterReset',
    'referralSortSelect', 'referralPrevBtn', 'referralNextBtn', 'referralPageSize', 'referralExportBtn',
    'matchTabCandidate', 'matchTabCondition', 'matchFromCandidate', 'matchFromCondition', 'matchResultSort'
  ];
  elements.forEach(id => { const el = document.getElementById(id); if (el) el.replaceWith(el.cloneNode(true)); });
  currentPage = 1; filteredData = []; allData = []; currentSort = 'company-asc'; selectedCompanyId = null; currentMatchResults = [];
}

function loadReferralData() { allData = [...mockReferralData]; selectedCompanyId = allData[0]?.id || null; applyFilters(); }

function initializeFilters() {
  document.getElementById('referralCompanyFilter')?.addEventListener('input', applyFilters);
  document.getElementById('referralDateStart')?.addEventListener('change', applyFilters);
  document.getElementById('referralDateEnd')?.addEventListener('change', applyFilters);
  document.getElementById('referralJobFilter')?.addEventListener('change', applyFilters);
  document.getElementById('referralFilterReset')?.addEventListener('click', resetFilters);
}

function initializePagination() {
  document.getElementById('referralPrevBtn')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable(); updatePaginationInfo(); } });
  document.getElementById('referralNextBtn')?.addEventListener('click', () => { const totalPages = Math.ceil(filteredData.length / pageSize); if (currentPage < totalPages) { currentPage++; renderTable(); updatePaginationInfo(); } });
  document.getElementById('referralPageSize')?.addEventListener('change', (e) => { pageSize = Number(e.target.value) || 50; currentPage = 1; applyFilters(); });
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

function initializeExport() { document.getElementById('referralExportBtn')?.addEventListener('click', exportToCSV); }

function initializeMatchingTabs() {
  const cTab = document.getElementById('matchTabCandidate');
  const kTab = document.getElementById('matchTabCondition');
  const cPanel = document.getElementById('matchCandidatePanel');
  const kPanel = document.getElementById('matchConditionPanel');
  cTab?.addEventListener('click', () => { cTab.className = 'py-2 px-1 border-b-2 border-indigo-500 text-indigo-600 text-sm font-medium'; kTab.className = 'py-2 px-1 border-b-2 border-transparent text-slate-500 hover:text-slate-700 text-sm font-medium'; cPanel?.classList.remove('hidden'); kPanel?.classList.add('hidden'); });
  kTab?.addEventListener('click', () => { kTab.className = 'py-2 px-1 border-b-2 border-indigo-500 text-indigo-600 text-sm font-medium'; cTab.className = 'py-2 px-1 border-b-2 border-transparent text-slate-500 hover:text-slate-700 text-sm font-medium'; kPanel?.classList.remove('hidden'); cPanel?.classList.add('hidden'); });
}

function initializeMatching() {
  document.getElementById('matchFromCandidate')?.addEventListener('click', performCandidateMatching);
  document.getElementById('matchFromCondition')?.addEventListener('click', performConditionMatching);
  const sortSel = document.getElementById('matchResultSort');
  if (sortSel) sortSel.value = 'score-desc';
  sortSel?.addEventListener('change', sortMatchResults);
  document.getElementById('matchResults')?.addEventListener('click', (e) => {
    const target = e.target.closest('[data-company-id]');
    if (!target) return;
    selectedCompanyId = target.dataset.companyId;
    renderTable();
    renderCompanyDetail();
    document.getElementById('referralCompanyDetail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function applyFilters() {
  const companyFilter = document.getElementById('referralCompanyFilter')?.value.toLowerCase() || '';
  const jobFilter = document.getElementById('referralJobFilter')?.value || '';
  filteredData = allData.filter(item => {
    const matchesCompany = !companyFilter || item.company.toLowerCase().includes(companyFilter);
    const matchesJob = !jobFilter || item.jobTitle.includes(jobFilter);
    return matchesCompany && matchesJob;
  });
  if (filteredData.length && !filteredData.some(c => c.id === selectedCompanyId)) selectedCompanyId = filteredData[0].id;
  currentPage = 1;
  applySort();
  renderTable();
  renderCompanyDetail();
  updatePaginationInfo();
  updateFilterCount();
}

function applySort() {
  const [sortKey, direction] = currentSort.split('-');
  const isAsc = direction === 'asc';
  filteredData.sort((a, b) => {
    let aVal = a[sortKey]; let bVal = b[sortKey];
    if (typeof aVal === 'string' && aVal.endsWith('%')) { aVal = parseFloat(aVal); bVal = parseFloat(bVal); }
    else if (!isNaN(aVal) && !isNaN(bVal)) { aVal = Number(aVal); bVal = Number(bVal); }
    if (aVal < bVal) return isAsc ? -1 : 1;
    if (aVal > bVal) return isAsc ? 1 : -1;
    return 0;
  });
  updateSortIndicators();
}

function formatCurrency(val) { return val == null ? '-' : `¥${Number(val).toLocaleString('ja-JP')}`; }

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
  return `<span class="px-2 py-1 rounded-md text-xs font-semibold ${cls}">${num}%</span>`;
}

function normalizeText(str) {
  if (!str) return '';
  const nk = str.normalize('NFKC').toLowerCase();
  // カタカナ→ひらがな
  const hira = nk.replace(/[\u30a1-\u30f6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  return hira;
}

function formatDateString(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

function _buildAIInsightDeprecated(company) {
  const dt = company.desiredTalent || {};
  const must = dt.mustQualifications?.length ? dt.mustQualifications.join(' / ') : '';
  const nice = dt.niceQualifications?.length ? dt.niceQualifications.join(' / ') : '';
  const exp = dt.experiences?.length ? dt.experiences.join(' / ') : '';
  const salary = dt.salaryRange ? `${dt.salaryRange[0]}〜${dt.salaryRange[1]}万円` : '年収レンジ未設定';
  const pos = company.highlightPosition || company.jobTitle || 'ポジション未設定';

  const mustPart = must ? `必須「${must}」` : '';
  const nicePart = nice ? `歓迎「${nice}」` : '';
  const expPart = exp ? `経験「${exp}」` : '';
  const parts = [mustPart, nicePart, expPart].filter(Boolean).join('・');

  return `${pos}で${salary}、${parts || '条件に柔軟な'}リーダー人材を求む。`;
}

function buildAgencyInsight(company) {
  const retention = parseFloat(company.retention) || 0;
  const lead = company.leadTime ?? '-';
  const fee = company.fee != null ? `${Math.round(company.fee * 100)}%` : '-';
  const refund = Number(company.refundAmount) || 0;
  const retTone = retention >= 90
    ? `定着率${retention}%で安心感高め`
    : retention >= 80
      ? `定着率${retention}%で安定域`
      : `定着率${retention}%で要ケア`;
  const leadTone = lead !== '-' ? `LT${lead}日で決着早め` : 'LT情報なし';
  const feeTone = fee !== '-' ? `Fee${fee}で収益性◯` : 'Fee未設定';
  const refundTone = refund > 0 ? `返金リスクあり（${formatCurrency(refund)}）` : '返金リスク低め';
  return `${retTone}、${leadTone}。${feeTone}、${refundTone}。`;
}

// 上書き版: 求める性格傾向を一言に反映
function buildAIInsight(company) {
  const dt = company.desiredTalent || {};
  const must = dt.mustQualifications?.length ? dt.mustQualifications.join(' / ') : '';
  const nice = dt.niceQualifications?.length ? dt.niceQualifications.join(' / ') : '';
  const exp = dt.experiences?.length ? dt.experiences.join(' / ') : '';
  const salary = dt.salaryRange ? `${dt.salaryRange[0]}〜${dt.salaryRange[1]}万` : '年収レンジ未設定';
  const pos = company.highlightPosition || company.jobTitle || 'ポジション未設定';

  const mustPart = must ? `必須「${must}」` : '';
  const nicePart = nice ? `歓迎「${nice}」` : '';
  const expPart = exp ? `経験「${exp}」` : '';
  const parts = [mustPart, nicePart, expPart].filter(Boolean).join('・');

  const personalities = dt.personality?.length ? dt.personality.join(' / ') : '';
  const tone = personalities ? `求める気質は「${personalities}」。` : '';

  return `${pos}を${salary}、${parts || '柔軟に検討'}で採用強化。${tone}`;
}

function renderTable() {
  const tableBody = document.getElementById('referralTableBody');
  if (!tableBody) return;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageData = filteredData.slice(startIndex, endIndex);
  const prioritized = [...pageData];
  const selIdx = prioritized.findIndex(p => p.id === selectedCompanyId);
  if (selIdx > 0) {
    const [sel] = prioritized.splice(selIdx, 1);
    prioritized.unshift(sel);
  }
  tableBody.innerHTML = prioritized.map(item => `
    <tr class="hover:bg-slate-50 ${item.id === selectedCompanyId ? 'selected-row border-l-4 border-indigo-400' : ''}" data-company-id="${item.id}">
      <td class="sticky-col font-semibold text-left" style="position:sticky;left:0;z-index:30;">${item.company}</td>
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
      <td class="text-right">${item.leadTime ?? '-'}日</td>
      <td class="text-right">${item.fee != null ? Math.round(item.fee * 100) + '%' : '-'}</td>
      <td class="text-left text-xs">${item.prejoinDeclineReason || '-'}</td>
      <td class="text-right">${item.prejoinDeclines ?? 0}件</td>
      <td class="text-right">${item.dropoutCount ?? 0}件</td>
    </tr>
  `).join('');
  attachRowClickHandlers();
  updateSortIndicators();
}

function attachRowClickHandlers() {
  document.querySelectorAll('#referralTableBody tr').forEach(row => {
    row.addEventListener('click', () => {
      const companyId = row.dataset.companyId;
      if (!companyId) return;
      selectedCompanyId = companyId;
      renderTable();
      renderCompanyDetail();
      document.getElementById('referralCompanyDetail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function renderCompanyDetail() {
  const container = document.getElementById('referralCompanyDetail');
  if (!container) return;
  const company = filteredData.find(c => c.id === selectedCompanyId);
  if (!company) { container.innerHTML = '<div class="text-sm text-slate-500">企業が選択されていません</div>'; return; }

  const badge = (text, classes = '', size = 'px-3 py-1 text-xs') => `<span class="${size} rounded-lg font-semibold ${classes}">${text}</span>`;
  const feeText = company.fee != null ? `${Math.round(company.fee * 100)}%` : '-';
  const retentionClass = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
  const leadClass = 'bg-amber-50 text-amber-700 border border-amber-100';
  const refundClass = Number(company.refundAmount) > 0 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-slate-50 text-slate-700 border border-slate-100';

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
    const bubbles = stageCands.length
      ? `<div class="flex flex-col gap-1 mt-2">${stageCands.map(candidateBubble).join('')}</div>`
      : '';
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
          <div class="text-lg font-bold text-indigo-800">募集ポジション：${company.highlightPosition || company.jobTitle}</div>
        </div>
        <div class="text-right space-y-1 w-auto flex-none max-w-full lg:absolute lg:right-0 lg:top-0">
          <div class="text-sm whitespace-normal">
            ${badge(`定着率 ${company.retention}`, retentionClass, 'px-4 py-2 text-sm inline-block whitespace-nowrap')}
            ${badge(`リードタイム ${company.leadTime ?? '-'}日`, leadClass, 'px-4 py-2 text-sm inline-block whitespace-nowrap')}
            ${badge(`Fee ${feeText}`, 'bg-indigo-50 text-indigo-700 border border-indigo-100', 'px-4 py-2 text-sm inline-block whitespace-nowrap')}
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
        <div class="text-base font-bold text-slate-900 tracking-wide">募集・選考の進捗（進行中の候補者を表示）</div>
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

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
        <div class="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-[15px] leading-6">
          <div class="font-semibold text-slate-900 text-base">欲しい人材</div>
          <div><span class="font-semibold text-slate-700">年収レンジ：</span>${company.desiredTalent?.salaryRange ? `${company.desiredTalent.salaryRange[0]}〜${company.desiredTalent.salaryRange[1]} 万円` : '-'}</div>
          <div><span class="font-semibold text-slate-700">必須資格：</span>${company.desiredTalent?.mustQualifications?.length ? company.desiredTalent.mustQualifications.join(' / ') : '-'}</div>
          <div><span class="font-semibold text-slate-700">歓迎資格：</span>${company.desiredTalent?.niceQualifications?.length ? company.desiredTalent.niceQualifications.join(' / ') : '-'}</div>
          <div><span class="font-semibold text-slate-700">勤務地：</span>${company.desiredTalent?.locations?.length ? company.desiredTalent.locations.join(' / ') : '-'}</div>
          <div><span class="font-semibold text-slate-700">性格傾向：</span>${company.desiredTalent?.personality?.length ? company.desiredTalent.personality.join(' / ') : '-'}</div>
          <div><span class="font-semibold text-slate-700">経験：</span>${company.desiredTalent?.experiences?.length ? company.desiredTalent.experiences.join(' / ') : '-'}</div>
        </div>
        <div class="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-[15px] leading-6">
          <div class="font-semibold text-slate-900 text-base">選考メモ</div>
          <div><span class="font-semibold text-slate-700">入社前辞退：</span>${company.prejoinDeclines ?? 0}名 (${company.prejoinDeclineReason || '理由未登録'})</div>
          <div><span class="font-semibold text-slate-700">選考脱落者：</span>${company.dropoutCount ?? 0}名</div>
        </div>
      </div>

      <div class="space-y-2">
        <div class="font-semibold text-slate-900 text-base">合致度の高い候補者（モック）</div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          ${getTopMockCandidates(company).map(c => `
            <div class="border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
              <div class="flex items-center justify-between">
                <div class="font-semibold text-slate-900">${c.name}</div>
                <span class="px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-xs font-semibold">${Math.round(c.matchScore)}点</span>
              </div>
              <div class="text-xs text-slate-600">${c.title}</div>
              <div class="text-xs text-slate-600 mt-1">年収目安: ${c.salary}万 / 勤務地: ${c.location}</div>
              <div class="text-xs text-slate-700 mt-1">資格: ${c.qualifications.join(' / ') || '-'}</div>
              <div class="text-xs text-slate-700 mt-1">経験: ${c.experiences.join(' / ') || '-'}</div>
              <div class="text-xs text-slate-700 mt-1">性格: ${c.personality.join(' / ') || '-'}</div>
              <div class="text-xs text-slate-500 mt-1">${c.note || ''}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function updateSortIndicators() {
  const [sortKey, direction] = currentSort.split('-');
  const arrowCurrent = direction === 'asc' ? '▲' : '▼';
  const arrowNeutral = '⇅';
  document.querySelectorAll('.sortable').forEach(header => {
    const baseLabel = header.dataset.label || header.textContent.trim();
    header.dataset.label = baseLabel;
    const isCurrent = header.dataset.sort === sortKey;
    const arrow = isCurrent ? arrowCurrent : arrowNeutral;
    header.innerHTML = `<span class="inline-flex items-center gap-1">${baseLabel}<span class="text-[11px] align-middle">${arrow}</span></span>`;
  });
}

function updatePaginationInfo() {
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const pageInfo = document.getElementById('referralPageInfo');
  const prevBtn = document.getElementById('referralPrevBtn');
  const nextBtn = document.getElementById('referralNextBtn');
  if (pageInfo) pageInfo.textContent = `${currentPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

function updateFilterCount() {
  const el = document.getElementById('referralFilterCount');
  if (el) el.textContent = `${filteredData.length}社`;
}

function resetFilters() {
  const companyInput = document.getElementById('referralCompanyFilter');
  const startInput = document.getElementById('referralDateStart');
  const endInput = document.getElementById('referralDateEnd');
  const jobSelect = document.getElementById('referralJobFilter');
  if (companyInput) companyInput.value = '';
  if (startInput) startInput.value = '2024-01-01';
  if (endInput) endInput.value = '2024-12-31';
  if (jobSelect) jobSelect.value = '';
  applyFilters();
}

function exportToCSV() {
  const headers = ['企業名', '残り人数', '定着率', '募集職種', '提案件数', '書類選考', '一次面接', '二次面接', '内定', '入社', '採用予定人数', '返金額', '平均リードタイム(日)', 'Fee', '入社前辞退理由', '入社辞退人数', '選考脱落者人数'];
  const csvContent = [
    headers.join(','),
    ...filteredData.map(item => [
      item.company,
      item.remaining,
      item.retention,
      item.jobTitle,
      item.proposal,
      item.docScreen,
      item.interview1,
      item.interview2,
      item.offer,
      item.joined,
      item.planHeadcount,
      item.refundAmount,
      item.leadTime,
      item.fee,
      item.prejoinDeclineReason,
      item.prejoinDeclines,
      item.dropoutCount
    ].join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'referral_data.csv';
  link.click();
}

function performCandidateMatching() {
  const txt = document.getElementById('candidateText')?.value || '';
  if (!txt.trim()) { alert('候補者のプロフィールを入力してください'); return; }
  const criteria = buildCriteriaFromProfile(txt);
  const results = filteredData.map(c => calculateMatchScore(c, criteria)).sort((a, b) => b.score - a.score);
  currentMatchResults = results;
  const sortSel = document.getElementById('matchResultSort');
  if (sortSel) sortSel.value = 'score-desc';
  displayMatchResults(results);
}

function performConditionMatching() {
  const skills = document.getElementById('conditionSkills')?.value || '';
  const mustQ = document.getElementById('conditionMustQualifications')?.value || '';
  const niceQ = document.getElementById('conditionNiceQualifications')?.value || '';
  const expText = document.getElementById('conditionExperiences')?.value || '';
  const personalityText = document.getElementById('conditionPersonality')?.value || '';
  const jobTitleText = document.getElementById('conditionJobTitle')?.value || '';
  const clampSalary = (v) => {
    const n = Number(v);
    if (isNaN(n)) return null;
    return Math.max(0, n);
  };
  const criteria = {
    salaryMin: clampSalary(document.getElementById('conditionSalaryMin')?.value),
    salaryMax: clampSalary(document.getElementById('conditionSalaryMax')?.value),
    location: (document.getElementById('conditionLocation')?.value || '').split(/[,、\/]/).map(v => v.trim()).filter(Boolean).join(' '),
    skillsText: [jobTitleText, skills, mustQ, niceQ, expText, personalityText].join(' '),
    rawTextLower: [jobTitleText, skills, mustQ, niceQ, expText, personalityText].join(' ').toLowerCase(),
    qualifications: mustQ.split(/[,、\/]/).map(v => v.trim()).filter(Boolean),
    personalities: personalityText.split(/[,、\/]/).map(v => v.trim()).filter(Boolean),
    experiences: expText.split(/[,、\/]/).map(v => v.trim()).filter(Boolean)
  };
  if (!criteria.salaryMin && !criteria.salaryMax && !criteria.location && !skills.trim()) {
    alert('最低でも1つは条件を入力してください');
    return;
  }
  if (criteria.salaryMin != null && criteria.salaryMax != null && criteria.salaryMax < criteria.salaryMin) {
    alert('年収上限は年収下限以上の値を入力してください');
    return;
  }
  const results = filteredData.map(c => calculateMatchScore(c, criteria)).sort((a, b) => b.score - a.score);
  currentMatchResults = results;
  const sortSel = document.getElementById('matchResultSort');
  if (sortSel) sortSel.value = 'score-desc';
  displayMatchResults(results);
}

function buildCriteriaFromProfile(text) {
  const lower = text.toLowerCase();
  const norm = normalizeText(text);
  const qualifications = [];
  if (text.includes('基本情報')) qualifications.push('基本情報技術者');
  if (text.includes('情報処理') || text.includes('安全確保')) qualifications.push('情報処理安全確保支援士');
  if (text.includes('pmp') || text.includes('PMP')) qualifications.push('PMP');
  if (text.includes('aws')) qualifications.push('AWS SAA');
  if (text.includes('lpic')) qualifications.push('LPIC-2');
  const experiences = [];
  if (lower.includes('react')) experiences.push('React3年以上');
  if (lower.includes('java')) experiences.push('Java5年以上');
  if (lower.includes('pm') || lower.includes('project')) experiences.push('PM3年以上');
  if (lower.includes('bpr')) experiences.push('BPR');
  if (lower.includes('マイクロサービス')) experiences.push('マイクロサービス');
  const personalities = [];
  if (text.includes('リーダーシップ')) personalities.push('リーダーシップ');
  if (text.includes('調整力') || text.includes('協調性')) personalities.push('調整力', '協調性');
  if (text.includes('探究心')) personalities.push('探究心');
  if (text.includes('結果志向')) personalities.push('結果志向');
  if (text.includes('柔軟')) personalities.push('柔軟');
  if (text.includes('チーム')) personalities.push('チーム志向');
  const locCandidates = ['東京', '名古屋', '大阪', '福岡', 'リモート', 'とうきょう', 'なごや', 'おおさか', 'ふくおか', 'りもーと'];
  const detectedLoc = locCandidates.find(l => text.includes(l) || norm.includes(l)) || '';
  return {
    salaryMin: null,
    salaryMax: null,
    location: detectedLoc,
    skillsText: text,
    rawTextLower: lower,
    rawTextNorm: norm,
    qualifications,
    personalities: personalities.filter((v, i, a) => v && a.indexOf(v) === i),
    experiences
  };
}

function calculateMatchScore(company, criteria) {
  let score = 50;
  const reasons = [];
  const cautions = [];
  const desired = company.desiredTalent || {};
  const textBlob = normalizeText(criteria.rawTextNorm || criteria.rawTextLower || criteria.skillsText || '');
  const includesTerm = (term) => {
    if (!term) return false;
    const t = normalizeText(term);
    return textBlob.includes(t);
  };

  if (criteria.salaryMin || criteria.salaryMax) {
    if (desired.salaryRange) {
      if (criteria.salaryMin && criteria.salaryMin > desired.salaryRange[1]) {
        score -= 15; cautions.push('希望年収が上限を超過');
      } else if (criteria.salaryMax && criteria.salaryMax < desired.salaryRange[0]) {
        score -= 10; cautions.push('希望年収が下限未満');
      } else {
        score += 5; reasons.push('年収レンジが概ね合致');
      }
    }
  }

  const must = desired.mustQualifications || [];
  const nice = desired.niceQualifications || [];
  const hitsMustDict = must.filter(m => criteria.qualifications.includes(m));
  const hitsNiceDict = nice.filter(n => criteria.qualifications.includes(n));

  // 動的テキストマッチ（新規企業でも辞書登録不要で拾う）
  const dynMust = must.filter(m => includesTerm(m));
  const dynNice = nice.filter(n => includesTerm(n));
  const dynExp = (desired.experiences || []).filter(e => includesTerm(e));

  // 必須は辞書＋動的の両方でヒット判定し、0のときだけ減点
  const hitsMustTotal = Array.from(new Set([...hitsMustDict, ...dynMust]));
  if (must.length && hitsMustTotal.length === 0) { score -= 20; cautions.push('必須資格が不足'); }
  if (hitsMustTotal.length) reasons.push(`必須資格: ${hitsMustTotal.join(' / ')}`);

  // 歓迎は辞書＋動的を合算で加点（重複排除）
  const hitsNiceTotal = Array.from(new Set([...hitsNiceDict, ...dynNice]));
  if (hitsNiceTotal.length) reasons.push(`歓迎資格: ${hitsNiceTotal.join(' / ')}`);

  // 必須・歓迎の加点（辞書＋動的）
  score += hitsMustTotal.length * 10;
  score += hitsNiceTotal.length * 5;
  if (dynExp.length) { score += dynExp.length * 4; reasons.push(`テキスト一致(経験): ${dynExp.join(' / ')}`); }

  if (criteria.location && desired.locations) {
    if (desired.locations.some(loc => criteria.location.includes(loc))) { score += 8; reasons.push('勤務地が一致'); }
    else { score -= 5; cautions.push('勤務地が想定外'); }
  }

  if (criteria.experiences?.length && desired.experiences?.length) {
    const hitExp = criteria.experiences.filter(e => desired.experiences.some(d => d.includes(e)));
    if (hitExp.length) { score += hitExp.length * 6; reasons.push(`経験: ${hitExp.join(' / ')}`); }
  }

  // 性格（パーソナリティ）
  if (criteria.personalities?.length && desired.personality?.length) {
    const hitPerson = criteria.personalities.filter(p => desired.personality.some(d => d.includes(p)));
    if (hitPerson.length) { score += hitPerson.length * 4; reasons.push(`性格: ${hitPerson.join(' / ')}`); }
    else score -= 3;
  }

  if (criteria.skillsText) {
    const txt = criteria.skillsText.toLowerCase();
    if (txt.includes(company.jobTitle.toLowerCase())) reasons.push('希望職種が合致');
  }

  score = Math.max(0, Math.min(100, score));
  return { company: company.company, companyId: company.id, score, reasons, cautions };
}

function getTopMockCandidates(company) {
  const desired = company.desiredTalent || {};
  const salaryRange = desired.salaryRange || [];
  const locs = desired.locations || [];
  const must = desired.mustQualifications || [];
  const nice = desired.niceQualifications || [];
  const exps = desired.experiences || [];
  const pers = desired.personality || [];

  const scoreCandidate = (cand) => {
    let sc = 0;
    // salary
    if (salaryRange.length === 2) {
      const [min, max] = salaryRange;
      if (cand.salary >= min && cand.salary <= max) sc += 12;
      else if (cand.salary >= min - 100 && cand.salary <= max + 100) sc += 6;
    }
    // location
    if (locs.length && locs.some(l => cand.location.includes(l))) sc += 8;
    // qualifications
    const qHits = cand.qualifications.filter(q => must.includes(q) || nice.includes(q));
    sc += qHits.length * 8;
    // experiences
    const eHits = cand.experiences.filter(e => exps.some(x => x.includes(e)));
    sc += eHits.length * 6;
    // personality
    const pHits = cand.personality.filter(p => pers.some(x => x.includes(p)));
    sc += pHits.length * 4;
    return sc;
  };

  return mockCandidatesList
    .map(c => ({ ...c, matchScore: scoreCandidate(c) }))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);
}

function displayMatchResults(results) {
  const container = document.getElementById('matchResults');
  if (!container) return;
  if (results.length === 0) {
    container.innerHTML = '<div class="text-center text-slate-500 text-sm py-8">マッチング結果がまだありません</div>';
    return;
  }
  container.innerHTML = results.map(r => {
    const positives = r.reasons?.length ? r.reasons.map(x => `<li class="text-emerald-700">・${x}</li>`).join('') : '<li class="text-slate-500">強み情報なし</li>';
    const negatives = r.cautions?.length ? r.cautions.map(x => `<li class="text-amber-700">・${x}</li>`).join('') : '<li class="text-slate-500">懸念なし</li>';
    return `
      <div class="border border-slate-200 rounded-lg p-3 bg-white">
        <div class="flex itemscenter justify-between mb-2">
          <button class="text-left font-semibold text-sm text-indigo-700 hover:underline" data-company-id="${r.companyId}">${r.company}</button>
          <span class="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold">${r.score}%マッチ</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div><div class="font-semibold text-emerald-700 mb-1">合っている点</div><ul class="space-y-1">${positives}</ul></div>
          <div><div class="font-semibold text-amber-700 mb-1">注意点</div><ul class="space-y-1">${negatives}</ul></div>
        </div>
      </div>
    `;
  }).join('');
}

function sortMatchResults() {
  const sortedResults = [...currentMatchResults].sort((a, b) => b.score - a.score);
  displayMatchResults(sortedResults);
}
