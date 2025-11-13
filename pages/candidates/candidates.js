// Candidates Page JavaScript Module
export function mount() {
  console.log('Candidates page mounted');
  
  // ページがマウントされた後に実行する初期化処理
  initializeCandidatesFilters();
  initializeCandidatesTable();
  loadCandidatesData();
}

export function unmount() {
  console.log('Candidates page unmounted');
  
  // ページがアンマウントされる前のクリーンアップ処理
  cleanupCandidatesEventListeners();
}

// フィルターの初期化
function initializeCandidatesFilters() {
  const dateFrom = document.getElementById('candidatesFilterDateFrom');
  const dateTo = document.getElementById('candidatesFilterDateTo');
  const source = document.getElementById('candidatesFilterSource');
  const name = document.getElementById('candidatesFilterName');
  const jobTitle = document.getElementById('candidatesFilterJobTitle');
  const resetBtn = document.getElementById('candidatesFilterReset');
  
  // 初期日付設定（過去30日）
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  if (dateFrom) dateFrom.value = thirtyDaysAgo;
  if (dateTo) dateTo.value = today;
  
  // フィルターイベントリスナー
  [dateFrom, dateTo, source, name, jobTitle].forEach(element => {
    if (element) {
      element.addEventListener('change', applyCandidatesFilter);
      element.addEventListener('input', applyCandidatesFilter);
    }
  });
  
  if (resetBtn) {
    resetBtn.addEventListener('click', resetCandidatesFilters);
  }
}

// テーブルの初期化
function initializeCandidatesTable() {
  const tableHeaders = document.querySelectorAll('[data-sort]');
  
  tableHeaders.forEach(header => {
    header.addEventListener('click', handleCandidatesSort);
  });
}

// 候補者データの読み込み
async function loadCandidatesData() {
  try {
    // 実際のAPIコールはここで行う
    // const data = await fetch('/api/candidates').then(r => r.json());
    
    // モック候補者データ
    const candidatesData = [
      {
        id: 1,
        appliedAt: '2024-11-01',
        source: 'Indeed',
        name: '田中太郎',
        phone: '090-1234-5678',
        email: 'tanaka@example.com',
        jobTitle: '営業職（正社員）',
        companyName: 'ABC株式会社',
        address: '東京都港区1-2-3'
      },
      {
        id: 2,
        appliedAt: '2024-11-02',
        source: '求人ボックス',
        name: '佐藤花子',
        phone: '080-2345-6789',
        email: 'sato@example.com',
        jobTitle: 'エンジニア職（正社員）',
        companyName: 'XYZ株式会社',
        address: '大阪府大阪市北区4-5-6'
      },
      {
        id: 3,
        appliedAt: '2024-11-03',
        source: 'リクナビ',
        name: '山田次郎',
        phone: '070-3456-7890',
        email: 'yamada@example.com',
        jobTitle: 'マーケティング職（正社員）',
        companyName: 'DEF株式会社',
        address: '愛知県名古屋市中区7-8-9'
      },
      {
        id: 4,
        appliedAt: '2024-11-04',
        source: 'マイナビ',
        name: '鈴木美咲',
        phone: '050-4567-8901',
        email: 'suzuki@example.com',
        jobTitle: '事務職（正社員）',
        companyName: 'GHI株式会社',
        address: '福岡県福岡市博多区10-11-12'
      },
      {
        id: 5,
        appliedAt: '2024-11-05',
        source: 'Indeed',
        name: '伊藤健一',
        phone: '090-5678-9012',
        email: 'ito@example.com',
        jobTitle: '人事職（正社員）',
        companyName: 'JKL株式会社',
        address: '神奈川県横浜市中区13-14-15'
      }
    ];
    
    updateCandidatesTable(candidatesData);
    updateCandidatesCount(candidatesData.length);
    
  } catch (error) {
    console.error('Failed to load candidates data:', error);
  }
}

// テーブル表示の更新
function updateCandidatesTable(candidates) {
  const tableBody = document.getElementById('candidatesTableBody');
  if (!tableBody) return;
  
  if (candidates.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-slate-500 py-8">
          条件に一致する候補者が見つかりません
        </td>
      </tr>
    `;
    return;
  }
  
  tableBody.innerHTML = candidates.map(candidate => `
    <tr class="candidate-item hover:bg-slate-50" data-candidate-id="${candidate.id}">
      <td>${formatDate(candidate.appliedAt)}</td>
      <td>
        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSourceBadgeClass(candidate.source)}">
          ${candidate.source}
        </span>
      </td>
      <td class="font-medium text-slate-900">${candidate.name}</td>
      <td>
        <span class="contact-field cursor-pointer text-blue-600 hover:text-blue-800" 
              data-type="phone" 
              data-full="${candidate.phone}" 
              data-masked="${maskPhone(candidate.phone)}">
          ${maskPhone(candidate.phone)}
        </span>
      </td>
      <td>
        <span class="contact-field cursor-pointer text-blue-600 hover:text-blue-800" 
              data-type="email" 
              data-full="${candidate.email}" 
              data-masked="${maskEmail(candidate.email)}">
          ${maskEmail(candidate.email)}
        </span>
      </td>
      <td class="text-sm">${candidate.jobTitle}</td>
      <td class="font-medium">${candidate.companyName}</td>
      <td class="text-sm text-slate-600">${candidate.address}</td>
    </tr>
  `).join('');
  
  // 連絡先クリックイベントを再バインド
  bindContactFieldEvents();
}

// 件数表示の更新
function updateCandidatesCount(count) {
  const countElement = document.getElementById('candidatesFilterCount');
  if (countElement) {
    countElement.textContent = `${count}件`;
  }
}

// フィルター適用
function applyCandidatesFilter() {
  const dateFrom = document.getElementById('candidatesFilterDateFrom')?.value || '';
  const dateTo = document.getElementById('candidatesFilterDateTo')?.value || '';
  const source = document.getElementById('candidatesFilterSource')?.value || '';
  const name = document.getElementById('candidatesFilterName')?.value || '';
  const jobTitle = document.getElementById('candidatesFilterJobTitle')?.value || '';
  
  const rows = document.querySelectorAll('.candidate-item');
  let visibleCount = 0;
  
  rows.forEach(row => {
    let show = true;
    const candidate = getCandidateFromRow(row);
    
    if (dateFrom && candidate.appliedAt < dateFrom) show = false;
    if (dateTo && candidate.appliedAt > dateTo) show = false;
    if (source && candidate.source !== source) show = false;
    if (name && !candidate.name.toLowerCase().includes(name.toLowerCase())) show = false;
    if (jobTitle && !candidate.jobTitle.toLowerCase().includes(jobTitle.toLowerCase())) show = false;
    
    row.style.display = show ? '' : 'none';
    if (show) visibleCount++;
  });
  
  updateCandidatesCount(visibleCount);
}

// フィルターリセット
function resetCandidatesFilters() {
  // 日付以外をクリア
  document.getElementById('candidatesFilterSource').value = '';
  document.getElementById('candidatesFilterName').value = '';
  document.getElementById('candidatesFilterJobTitle').value = '';
  
  // すべての行を表示
  const rows = document.querySelectorAll('.candidate-item');
  rows.forEach(row => row.style.display = '');
  
  updateCandidatesCount(rows.length);
}

// ソート処理
function handleCandidatesSort(event) {
  const header = event.currentTarget;
  const sortField = header.dataset.sort;
  const currentDirection = header.dataset.direction || 'asc';
  const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
  
  // すべてのソートインジケーターをリセット
  document.querySelectorAll('[data-sort]').forEach(h => {
    h.dataset.direction = '';
    const indicator = h.querySelector('.ml-1');
    if (indicator) indicator.textContent = '↕';
  });
  
  // 現在の列のソート方向を更新
  header.dataset.direction = newDirection;
  const indicator = header.querySelector('.ml-1');
  if (indicator) {
    indicator.textContent = newDirection === 'asc' ? '↑' : '↓';
  }
  
  sortCandidatesTable(sortField, newDirection);
}

// テーブルソート実行
function sortCandidatesTable(field, direction) {
  const tableBody = document.getElementById('candidatesTableBody');
  const rows = Array.from(tableBody.querySelectorAll('.candidate-item'));
  
  rows.sort((a, b) => {
    let aValue, bValue;
    
    switch (field) {
      case 'appliedAt':
        aValue = a.children[0].textContent;
        bValue = b.children[0].textContent;
        break;
      case 'name':
        aValue = a.children[2].textContent;
        bValue = b.children[2].textContent;
        break;
      case 'companyName':
        aValue = a.children[6].textContent;
        bValue = b.children[6].textContent;
        break;
      default:
        return 0;
    }
    
    const comparison = aValue.localeCompare(bValue, 'ja');
    return direction === 'asc' ? comparison : -comparison;
  });
  
  // ソート済み行を再描画
  tableBody.innerHTML = '';
  rows.forEach(row => tableBody.appendChild(row));
}

// 連絡先フィールドイベント
function bindContactFieldEvents() {
  const contactFields = document.querySelectorAll('.contact-field');
  contactFields.forEach(field => {
    field.addEventListener('click', handleContactFieldClick);
  });
}

function handleContactFieldClick(event) {
  const field = event.target;
  const type = field.dataset.type;
  const fullValue = field.dataset.full;
  const maskedValue = field.dataset.masked;
  
  // 権限チェック（実際の実装では認証システムと連携）
  const hasPermission = checkContactPermission();
  
  if (hasPermission) {
    field.textContent = field.textContent === fullValue ? maskedValue : fullValue;
  } else {
    alert('連絡先情報を表示する権限がありません。');
  }
}

// ユーティリティ関数
function getCandidateFromRow(row) {
  const cells = row.children;
  return {
    appliedAt: parseDate(cells[0].textContent),
    source: cells[1].textContent.trim(),
    name: cells[2].textContent,
    jobTitle: cells[5].textContent
  };
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP');
}

function parseDate(displayDate) {
  // "2024/11/1" -> "2024-11-01"
  const parts = displayDate.split('/');
  return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
}

function getSourceBadgeClass(source) {
  const classes = {
    'Indeed': 'bg-blue-100 text-blue-700',
    '求人ボックス': 'bg-green-100 text-green-700',
    'リクナビ': 'bg-orange-100 text-orange-700',
    'マイナビ': 'bg-purple-100 text-purple-700'
  };
  return classes[source] || 'bg-gray-100 text-gray-700';
}

function maskPhone(phone) {
  // "090-1234-5678" -> "090-****-5678"
  const parts = phone.split('-');
  if (parts.length === 3) {
    return `${parts[0]}-****-${parts[2]}`;
  }
  return '***-****-****';
}

function maskEmail(email) {
  // "tanaka@example.com" -> "tan***@example.com"
  const [local, domain] = email.split('@');
  if (local.length > 3) {
    return `${local.substring(0, 3)}***@${domain}`;
  }
  return `***@${domain}`;
}

function checkContactPermission() {
  // 実際の権限チェックロジック
  // 今はダミーでtrueを返す
  return true;
}

function cleanupCandidatesEventListeners() {
  console.log('Cleaning up candidates page event listeners');
  
  // 特定のイベントリスナーを削除
  const elements = [
    'candidatesFilterDateFrom',
    'candidatesFilterDateTo', 
    'candidatesFilterSource',
    'candidatesFilterName',
    'candidatesFilterJobTitle',
    'candidatesFilterReset'
  ];
  
  elements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.removeEventListener('change', applyCandidatesFilter);
      element.removeEventListener('input', applyCandidatesFilter);
      element.removeEventListener('click', resetCandidatesFilters);
    }
  });
}