// Referral page module
let currentPage = 1;
const pageSize = 50;
let filteredData = [];
let allData = [];
let currentSort = 'company-asc';

// Mock data for referral companies
const mockReferralData = [
  {
    company: "株式会社サンプルA",
    jobTitle: "フロントエンドエンジニア",
    planHeadcount: 5,
    remaining: 2,
    proposal: 15,
    docScreen: 12,
    interview1: 8,
    interview2: 5,
    offer: 3,
    joined: 3,
    retention: "100%",
    prejoinDeclines: 0,
    location: "東京都渋谷区",
    contact: "田中太郎",
    industry: "IT・ソフトウェア",
    profile: "AI・機械学習領域のSaaSを展開するスタートアップです。"
  },
  {
    company: "テックコーポレーション",
    jobTitle: "バックエンドエンジニア", 
    planHeadcount: 3,
    remaining: 1,
    proposal: 8,
    docScreen: 6,
    interview1: 4,
    interview2: 2,
    offer: 2,
    joined: 2,
    retention: "100%",
    prejoinDeclines: 0,
    location: "東京都港区",
    contact: "山田花子",
    industry: "IT・ソフトウェア",
    profile: "エンタープライズ向けソリューションを提供する企業です。"
  },
  {
    company: "イノベーション株式会社",
    jobTitle: "マネージャー",
    planHeadcount: 2,
    remaining: 0,
    proposal: 12,
    docScreen: 9,
    interview1: 6,
    interview2: 4,
    offer: 2,
    joined: 2,
    retention: "100%",
    prejoinDeclines: 0,
    location: "東京都新宿区",
    contact: "佐藤次郎",
    industry: "コンサルティング",
    profile: "デジタル変革支援に特化したコンサルティング会社です。"
  }
];

// Mock AI matching results
const mockMatchingResults = [
  {
    company: "株式会社サンプルA",
    score: 95,
    reason: "React/TypeScript経験、スタートアップ志向が高くマッチ"
  },
  {
    company: "テックコーポレーション",
    score: 87,
    reason: "バックエンド経験、チーム開発スキルが適合"
  },
  {
    company: "イノベーション株式会社",
    score: 72,
    reason: "マネジメント経験があり、リーダーシップ素質を評価"
  }
];

export function mount() {
  console.log('Mounting referral page...');
  
  loadReferralData();
  initializeFilters();
  initializePagination();
  initializeSort();
  initializeExport();
  initializeMatchingTabs();
  initializeMatching();
  
  // Set default filter count
  updateFilterCount();
}

export function unmount() {
  console.log('Unmounting referral page...');
  
  // Clean up event listeners
  const elements = [
    'referralCompanyFilter',
    'referralDateStart', 
    'referralDateEnd',
    'referralJobFilter',
    'referralFilterReset',
    'referralSortSelect',
    'referralPrevBtn',
    'referralNextBtn',
    'referralPageSize',
    'referralExportBtn',
    'matchTabCandidate',
    'matchTabCondition',
    'matchFromCandidate',
    'matchFromCondition',
    'matchResultSort'
  ];
  
  elements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.replaceWith(element.cloneNode(true));
    }
  });
  
  // Reset state
  currentPage = 1;
  filteredData = [];
  allData = [];
  currentSort = 'company-asc';
}

function loadReferralData() {
  allData = [...mockReferralData];
  applyFilters();
}

function initializeFilters() {
  const companyFilter = document.getElementById('referralCompanyFilter');
  const dateStart = document.getElementById('referralDateStart');
  const dateEnd = document.getElementById('referralDateEnd');
  const jobFilter = document.getElementById('referralJobFilter');
  const resetBtn = document.getElementById('referralFilterReset');
  
  if (companyFilter) {
    companyFilter.addEventListener('input', applyFilters);
  }
  
  if (dateStart) {
    dateStart.addEventListener('change', applyFilters);
  }
  
  if (dateEnd) {
    dateEnd.addEventListener('change', applyFilters);
  }
  
  if (jobFilter) {
    jobFilter.addEventListener('change', applyFilters);
  }
  
  if (resetBtn) {
    resetBtn.addEventListener('click', resetFilters);
  }
}

function initializePagination() {
  const prevBtn = document.getElementById('referralPrevBtn');
  const nextBtn = document.getElementById('referralNextBtn');
  const pageSizeSelect = document.getElementById('referralPageSize');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
        updatePaginationInfo();
      }
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(filteredData.length / pageSize);
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        updatePaginationInfo();
      }
    });
  }
  
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', () => {
      currentPage = 1;
      applyFilters();
    });
  }
}

function initializeSort() {
  const sortSelect = document.getElementById('referralSortSelect');
  
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      applySort();
      renderTable();
    });
  }
  
  // Table header sorting
  const sortableHeaders = document.querySelectorAll('.sortable');
  sortableHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const sortKey = header.dataset.sort;
      const isDesc = currentSort === `${sortKey}-asc`;
      currentSort = `${sortKey}-${isDesc ? 'desc' : 'asc'}`;
      
      // Update select to match
      if (sortSelect) {
        const option = Array.from(sortSelect.options).find(opt => opt.value === currentSort);
        if (option) {
          sortSelect.value = currentSort;
        }
      }
      
      applySort();
      renderTable();
    });
  });
}

function initializeExport() {
  const exportBtn = document.getElementById('referralExportBtn');
  
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToCSV);
  }
}

function initializeMatchingTabs() {
  const candidateTab = document.getElementById('matchTabCandidate');
  const conditionTab = document.getElementById('matchTabCondition');
  const candidatePanel = document.getElementById('matchCandidatePanel');
  const conditionPanel = document.getElementById('matchConditionPanel');
  
  if (candidateTab) {
    candidateTab.addEventListener('click', () => {
      // Switch to candidate tab
      candidateTab.className = 'py-2 px-1 border-b-2 border-indigo-500 text-indigo-600 text-sm font-medium';
      conditionTab.className = 'py-2 px-1 border-b-2 border-transparent text-slate-500 hover:text-slate-700 text-sm font-medium';
      
      if (candidatePanel) candidatePanel.classList.remove('hidden');
      if (conditionPanel) conditionPanel.classList.add('hidden');
    });
  }
  
  if (conditionTab) {
    conditionTab.addEventListener('click', () => {
      // Switch to condition tab  
      conditionTab.className = 'py-2 px-1 border-b-2 border-indigo-500 text-indigo-600 text-sm font-medium';
      candidateTab.className = 'py-2 px-1 border-b-2 border-transparent text-slate-500 hover:text-slate-700 text-sm font-medium';
      
      if (conditionPanel) conditionPanel.classList.remove('hidden');
      if (candidatePanel) candidatePanel.classList.add('hidden');
    });
  }
}

function initializeMatching() {
  const matchFromCandidateBtn = document.getElementById('matchFromCandidate');
  const matchFromConditionBtn = document.getElementById('matchFromCondition');
  const matchResultSort = document.getElementById('matchResultSort');
  
  if (matchFromCandidateBtn) {
    matchFromCandidateBtn.addEventListener('click', performCandidateMatching);
  }
  
  if (matchFromConditionBtn) {
    matchFromConditionBtn.addEventListener('click', performConditionMatching);
  }
  
  if (matchResultSort) {
    matchResultSort.addEventListener('change', sortMatchResults);
  }
}

function applyFilters() {
  const companyFilter = document.getElementById('referralCompanyFilter')?.value.toLowerCase() || '';
  const dateStart = document.getElementById('referralDateStart')?.value || '';
  const dateEnd = document.getElementById('referralDateEnd')?.value || '';
  const jobFilter = document.getElementById('referralJobFilter')?.value || '';
  
  filteredData = allData.filter(item => {
    const matchesCompany = !companyFilter || item.company.toLowerCase().includes(companyFilter);
    const matchesJob = !jobFilter || item.jobTitle.includes(jobFilter);
    
    // For date filtering, we would normally check against actual dates
    // For now, just return true for date filtering
    const matchesDate = true;
    
    return matchesCompany && matchesJob && matchesDate;
  });
  
  currentPage = 1;
  applySort();
  renderTable();
  updatePaginationInfo();
  updateFilterCount();
}

function applySort() {
  const [sortKey, direction] = currentSort.split('-');
  const isAsc = direction === 'asc';
  
  filteredData.sort((a, b) => {
    let aVal = a[sortKey];
    let bVal = b[sortKey];
    
    // Handle numeric values
    if (typeof aVal === 'string' && aVal.includes('%')) {
      aVal = parseFloat(aVal);
      bVal = parseFloat(bVal);
    } else if (!isNaN(aVal) && !isNaN(bVal)) {
      aVal = Number(aVal);
      bVal = Number(bVal);
    }
    
    if (aVal < bVal) return isAsc ? -1 : 1;
    if (aVal > bVal) return isAsc ? 1 : -1;
    return 0;
  });
}

function renderTable() {
  const tableBody = document.getElementById('referralTableBody');
  if (!tableBody) return;
  
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageData = filteredData.slice(startIndex, endIndex);
  
  tableBody.innerHTML = pageData.map(item => `
    <tr class="hover:bg-slate-50">
      <td class="sticky left-0 bg-white z-10">${item.company}</td>
      <td>${item.jobTitle}</td>
      <td class="text-right">${item.planHeadcount}名</td>
      <td class="text-right">${item.remaining}名</td>
      <td class="text-right">${item.proposal}件</td>
      <td class="text-right">${item.docScreen}件</td>
      <td class="text-right">${item.interview1}件</td>
      <td class="text-right">${item.interview2}件</td>
      <td class="text-right">${item.offer}件</td>
      <td class="text-right">${item.joined}名</td>
      <td class="text-right">${item.retention}</td>
      <td class="text-right">${item.prejoinDeclines}件</td>
    </tr>
  `).join('');
}

function updatePaginationInfo() {
  const pageInfo = document.getElementById('referralPageInfo');
  const prevBtn = document.getElementById('referralPrevBtn');
  const nextBtn = document.getElementById('referralNextBtn');
  
  const totalPages = Math.ceil(filteredData.length / pageSize);
  
  if (pageInfo) {
    pageInfo.textContent = `${currentPage} / ${totalPages}`;
  }
  
  if (prevBtn) {
    prevBtn.disabled = currentPage <= 1;
  }
  
  if (nextBtn) {
    nextBtn.disabled = currentPage >= totalPages;
  }
}

function updateFilterCount() {
  const filterCount = document.getElementById('referralFilterCount');
  if (filterCount) {
    filterCount.textContent = `${filteredData.length}件`;
  }
}

function resetFilters() {
  document.getElementById('referralCompanyFilter').value = '';
  document.getElementById('referralDateStart').value = '2024-01-01';
  document.getElementById('referralDateEnd').value = '2024-12-31';
  document.getElementById('referralJobFilter').value = '';
  
  applyFilters();
}

function exportToCSV() {
  const headers = [
    '企業名', '募集職種', '採用予定人数', '残り人数', '提案件数',
    '書類選考', '一次面接', '二次面接', '内定', '入社', '定着率', '入社前辞退数'
  ];
  
  const csvContent = [
    headers.join(','),
    ...filteredData.map(item => [
      item.company,
      item.jobTitle,
      item.planHeadcount,
      item.remaining,
      item.proposal,
      item.docScreen,
      item.interview1,
      item.interview2,
      item.offer,
      item.joined,
      item.retention,
      item.prejoinDeclines
    ].join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'referral_data.csv';
  link.click();
}

function performCandidateMatching() {
  const candidateText = document.getElementById('candidateText')?.value;
  
  if (!candidateText?.trim()) {
    alert('候補者プロフィールを入力してください');
    return;
  }
  
  // Simulate AI matching based on candidate profile
  displayMatchResults(mockMatchingResults);
}

function performConditionMatching() {
  const salaryMin = document.getElementById('conditionSalaryMin')?.value;
  const salaryMax = document.getElementById('conditionSalaryMax')?.value;
  const location = document.getElementById('conditionLocation')?.value;
  const skills = document.getElementById('conditionSkills')?.value;
  
  if (!skills?.trim()) {
    alert('必要スキル・経験を入力してください');
    return;
  }
  
  // Simulate AI matching based on conditions
  displayMatchResults(mockMatchingResults);
}

function displayMatchResults(results) {
  const matchResultsContainer = document.getElementById('matchResults');
  if (!matchResultsContainer) return;
  
  if (results.length === 0) {
    matchResultsContainer.innerHTML = `
      <div class="text-center text-slate-500 text-sm py-8">
        マッチする案件が見つかりませんでした
      </div>
    `;
    return;
  }
  
  matchResultsContainer.innerHTML = results.map(result => `
    <div class="border border-slate-200 rounded-lg p-3">
      <div class="flex items-center justify-between mb-2">
        <h5 class="font-semibold text-sm text-slate-800">${result.company}</h5>
        <span class="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold">
          ${result.score}%マッチ
        </span>
      </div>
      <p class="text-xs text-slate-600">${result.reason}</p>
    </div>
  `).join('');
}

function sortMatchResults() {
  const sortValue = document.getElementById('matchResultSort')?.value;
  
  let sortedResults = [...mockMatchingResults];
  
  if (sortValue === 'score-desc') {
    sortedResults.sort((a, b) => b.score - a.score);
  } else if (sortValue === 'company-asc') {
    sortedResults.sort((a, b) => a.company.localeCompare(b.company));
  }
  
  displayMatchResults(sortedResults);
}