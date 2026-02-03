/**
 * Components Entry Point
 * 全ての再利用可能コンポーネントのエクスポート
 */

// Date Range Picker
export { DateRangePicker, createDateRangePicker, createKpiDateRangePicker } from './DateRangePicker.js';

// Search Filter
export { SearchFilter, createSearchFilter, createTableSearchFilter } from './SearchFilter.js';

// Sortable Table
export { SortableTable, createSortableTable, createDataGrid } from './SortableTable.js';

// Pagination
export { Pagination, createPagination, createSimplePagination } from './Pagination.js';

/**
 * コンポーネント群のCSSを動的にロード
 */
export function loadComponentStyles() {
  const existingLink = document.querySelector('link[data-components-css]');
  if (!existingLink) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'components/components.css';
    link.dataset.componentsCss = 'true';
    document.head.appendChild(link);
  }
}

/**
 * 便利なファクトリー関数群
 */
export const ComponentFactory = {
  /**
   * KPI用日付範囲ピッカーを作成
   */
  createKpiDateRange: (options = {}) => createKpiDateRangePicker(options),
  
  /**
   * テーブル用検索フィルターを作成
   */
  createTableFilter: (options = {}) => createTableSearchFilter(options),
  
  /**
   * データグリッドを作成
   */
  createDataGrid: (options = {}) => createDataGrid(options),
  
  /**
   * ページネーション付きデータテーブルセットを作成
   */
  createDataTableSet: (options = {}) => {
    const {
      tableOptions = {},
      filterOptions = {},
      paginationOptions = {},
      container
    } = options;

    const table = createDataGrid(tableOptions);
    const filter = createTableSearchFilter(filterOptions);
    const pagination = createPagination(paginationOptions);

    return {
      table,
      filter,
      pagination,
      mount: (containerElement) => {
        const target = typeof containerElement === 'string' 
          ? document.querySelector(containerElement)
          : containerElement;
        
        if (!target) {
          throw new Error('Container element not found');
        }

        // CSSをロード
        loadComponentStyles();

        // 構造を作成
        target.innerHTML = `
          <div class="data-table-set">
            <div class="data-table-filter"></div>
            <div class="data-table-content"></div>
            <div class="data-table-pagination"></div>
          </div>
        `;

        // コンポーネントをマウント
        filter.mount(target.querySelector('.data-table-filter'));
        table.mount(target.querySelector('.data-table-content'));
        pagination.mount(target.querySelector('.data-table-pagination'));
      },
      unmount: () => {
        table.unmount();
        filter.unmount();
        pagination.unmount();
      }
    };
  }
};

/**
 * 自動でコンポーネントCSSをロードする初期化関数
 */
export function initializeComponents() {
  loadComponentStyles();
}

// 自動初期化（オプション）
if (typeof window !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeComponents);
} else if (typeof window !== 'undefined') {
  initializeComponents();
}