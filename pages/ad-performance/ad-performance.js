// Ad Performance Page JavaScript Module
export function mount() {
  console.log('Ad Performance page mounted');
  
  // ページがマウントされた後に実行する初期化処理
  initializeAdFilters();
  initializeAdTable();
  initializePagination();
  loadAdPerformanceData();
}

export function unmount() {
  console.log('Ad Performance page unmounted');
  
  // ページがアンマウントされる前のクリーンアップ処理
  cleanupAdEventListeners();
}

// フィルター初期化
function initializeAdFilters() {
  const mediaFilter = document.getElementById('adMediaFilter');
  const exportBtn = document.getElementById('exportAdManagement');
  
  if (mediaFilter) {
    mediaFilter.addEventListener('input', handleMediaFilter);
  }
  
  if (exportBtn) {
    exportBtn.addEventListener('click', handleExportCSV);
  }
}

// テーブル初期化
function initializeAdTable() {
  const sortableHeaders = document.querySelectorAll('.sortable');
  
  sortableHeaders.forEach(header => {
    header.addEventListener('click', handleAdSort);
  });
}

// ページネーション初期化
function initializePagination() {
  const prevBtn = document.getElementById('adManagementPrevBtn');
  const nextBtn = document.getElementById('adManagementNextBtn');
  const prevBtn2 = document.getElementById('adManagementPrevBtn2');
  const nextBtn2 = document.getElementById('adManagementNextBtn2');
  
  [prevBtn, prevBtn2].forEach(btn => {
    if (btn) btn.addEventListener('click', () => changePage(-1));
  });
  
  [nextBtn, nextBtn2].forEach(btn => {
    if (btn) btn.addEventListener('click', () => changePage(1));
  });
}

// 広告パフォーマンスデータの読み込み
async function loadAdPerformanceData() {
  try {
    // 実際のAPIコールはここで行う
    // const data = await fetch('/api/ad-performance').then(r => r.json());
    
    // モック広告データ
    const adData = [
      {
        id: 1,
        mediaName: 'Indeed',
        applications: 245,
        interviews: 89,
        offers: 34,
        hired: 23,
        retention: 87.5,
        refund: 156000,
        validApplications: 198
      },
      {
        id: 2,
        mediaName: '求人ボックス',
        applications: 189,
        interviews: 67,
        offers: 28,
        hired: 19,
        retention: 92.1,
        refund: 78000,
        validApplications: 156
      },
      {
        id: 3,
        mediaName: 'リクナビ',
        applications: 156,
        interviews: 78,
        offers: 31,
        hired: 25,
        retention: 89.2,
        refund: 45000,
        validApplications: 134
      },
      {
        id: 4,
        mediaName: 'マイナビ',
        applications: 134,
        interviews: 56,
        offers: 22,
        hired: 16,
        retention: 85.7,
        refund: 124000,
        validApplications: 112
      },
      {
        id: 5,
        mediaName: 'エン転職',
        applications: 98,
        interviews: 34,
        offers: 15,
        hired: 11,
        retention: 81.8,
        refund: 89000,
        validApplications: 87
      },
      {
        id: 6,
        mediaName: 'doda',
        applications: 87,
        interviews: 29,
        offers: 12,
        hired: 8,
        retention: 75.0,
        refund: 156000,
        validApplications: 76
      }
    ];
    
    window.adPerformanceData = adData;
    updateAdTable(adData);
    updateAdPagination(adData.length, 1, 50);
    
  } catch (error) {
    console.error('Failed to load ad performance data:', error);
    showAdError('データの読み込みに失敗しました。');
  }
}

// テーブル表示更新
function updateAdTable(data) {
  const tableBody = document.getElementById('adManagementTableBody');
  if (!tableBody) return;
  
  if (data.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-slate-500 py-6">
          条件に一致する広告データが見つかりません
        </td>
      </tr>
    `;
    return;
  }
  
  tableBody.innerHTML = data.map(ad => `
    <tr class="ad-item hover:bg-slate-50" data-ad-id="${ad.id}">
      <td class="font-medium text-slate-900 fixed-col bg-indigo-50">${ad.mediaName}</td>
      <td class="text-right font-semibold">${ad.applications.toLocaleString()}</td>
      <td class="text-right">${ad.interviews.toLocaleString()}</td>
      <td class="text-right">${ad.offers.toLocaleString()}</td>
      <td class="text-right font-semibold text-green-700">${ad.hired.toLocaleString()}</td>
      <td class="text-right">
        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRetentionBadgeClass(ad.retention)}">
          ${ad.retention.toFixed(1)}%
        </span>
      </td>
      <td class="text-right font-semibold ${ad.refund > 100000 ? 'text-red-700' : 'text-slate-600'}">
        ¥${ad.refund.toLocaleString()}
      </td>
      <td class="text-right">${ad.validApplications.toLocaleString()}</td>
    </tr>
  `).join('');
}

// ページネーション表示更新
function updateAdPagination(totalItems, currentPage, itemsPerPage) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  
  // 情報表示更新
  const infoElement = document.getElementById('adManagementInfo');
  if (infoElement) {
    infoElement.textContent = `${totalItems}件中 ${startItem}-${endItem}件表示`;
  }
  
  // ページ情報更新
  const pageInfos = ['adManagementPageInfo', 'adManagementPageInfo2'];
  pageInfos.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = `${currentPage} / ${totalPages}`;
    }
  });
  
  // ボタンの有効/無効切り替え
  const prevBtns = ['adManagementPrevBtn', 'adManagementPrevBtn2'];
  const nextBtns = ['adManagementNextBtn', 'adManagementNextBtn2'];
  
  prevBtns.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.disabled = currentPage <= 1;
    }
  });
  
  nextBtns.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.disabled = currentPage >= totalPages;
    }
  });
}

// 媒体フィルター処理
function handleMediaFilter(event) {
  const filterText = event.target.value.toLowerCase();
  const rows = document.querySelectorAll('.ad-item');
  let visibleCount = 0;
  
  rows.forEach(row => {
    const mediaName = row.children[0].textContent.toLowerCase();
    const show = mediaName.includes(filterText);
    row.style.display = show ? '' : 'none';
    if (show) visibleCount++;
  });
  
  // フィルター後のページネーション更新
  updateAdPagination(visibleCount, 1, 50);
}

// ソート処理
function handleAdSort(event) {
  const header = event.currentTarget;
  const sortField = header.dataset.sort;
  const currentDirection = header.dataset.direction || 'asc';
  const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
  
  // すべてのソートインジケーターをリセット
  document.querySelectorAll('.sortable').forEach(h => {
    h.dataset.direction = '';
    const indicator = h.querySelector('.sort-indicator');
    if (indicator) indicator.textContent = '↕';
  });
  
  // 現在の列のソート方向を更新
  header.dataset.direction = newDirection;
  const indicator = header.querySelector('.sort-indicator');
  if (indicator) {
    indicator.textContent = newDirection === 'asc' ? '↑' : '↓';
  }
  
  sortAdTable(sortField, newDirection);
}

// テーブルソート実行
function sortAdTable(field, direction) {
  if (!window.adPerformanceData) return;
  
  const sortedData = [...window.adPerformanceData].sort((a, b) => {
    let aValue, bValue;
    
    switch (field) {
      case 'applications':
        aValue = a.applications;
        bValue = b.applications;
        break;
      case 'hired':
        aValue = a.hired;
        bValue = b.hired;
        break;
      case 'retention':
        aValue = a.retention;
        bValue = b.retention;
        break;
      case 'refund':
        aValue = a.refund;
        bValue = b.refund;
        break;
      default:
        return 0;
    }
    
    const comparison = aValue - bValue;
    return direction === 'asc' ? comparison : -comparison;
  });
  
  updateAdTable(sortedData);
}

// ページ変更
function changePage(direction) {
  // 実際のページング実装はここに
  console.log('Page change:', direction);
}

// CSVエクスポート
function handleExportCSV() {
  if (!window.adPerformanceData) return;
  
  const headers = ['媒体名', '応募者数', '面接設定', '内定', '入社', '定着率(30日)', '返金額(税込)', '有効応募者数'];
  const csvContent = [
    headers.join(','),
    ...window.adPerformanceData.map(ad => [
      ad.mediaName,
      ad.applications,
      ad.interviews,
      ad.offers,
      ad.hired,
      ad.retention.toFixed(1) + '%',
      ad.refund,
      ad.validApplications
    ].join(','))
  ].join('\n');
  
  // UTF-8 BOM付きでダウンロード
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `広告管理_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// エラー表示
function showAdError(message) {
  const tableBody = document.getElementById('adManagementTableBody');
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-red-500 py-6">
          <div class="flex items-center justify-center gap-2">
            <span>⚠</span>
            <span>${message}</span>
          </div>
        </td>
      </tr>
    `;
  }
}

// ユーティリティ関数
function getRetentionBadgeClass(retention) {
  if (retention >= 90) return 'bg-green-100 text-green-700';
  if (retention >= 80) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

// クリーンアップ
function cleanupAdEventListeners() {
  console.log('Cleaning up ad performance page event listeners');
  
  const elements = [
    'adMediaFilter',
    'exportAdManagement',
    'adManagementPrevBtn',
    'adManagementNextBtn',
    'adManagementPrevBtn2',
    'adManagementNextBtn2'
  ];
  
  elements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      const clonedElement = element.cloneNode(true);
      element.parentNode.replaceChild(clonedElement, element);
    }
  });
}