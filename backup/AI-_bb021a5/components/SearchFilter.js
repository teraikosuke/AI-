/**
 * Search & Filter Component
 * 検索・フィルタ機能の汎用コンポーネント
 */

export class SearchFilter {
  constructor(options = {}) {
    this.options = {
      searchId: options.searchId || 'search',
      searchPlaceholder: options.searchPlaceholder || '検索...',
      filters: options.filters || [], // {id, type, label, options, placeholder}
      sortOptions: options.sortOptions || [], // {value, label}
      className: options.className || 'search-filter',
      onSearch: options.onSearch || (() => {}),
      onFilter: options.onFilter || (() => {}),
      onSort: options.onSort || (() => {}),
      onReset: options.onReset || (() => {}),
      showCount: options.showCount !== false,
      showResetButton: options.showResetButton !== false
    };
    
    this.container = null;
    this.searchInput = null;
    this.filterElements = {};
    this.sortSelect = null;
    this.countDisplay = null;
    this.resetButton = null;
    this.currentCount = 0;
  }

  /**
   * コンポーネントのHTMLを生成
   * @returns {string} HTML文字列
   */
  render() {
    const filtersHTML = this.options.filters.map(filter => {
      switch (filter.type) {
        case 'select':
          return this.renderSelectFilter(filter);
        case 'date':
          return this.renderDateFilter(filter);
        case 'text':
        default:
          return this.renderTextFilter(filter);
      }
    }).join('');

    const sortHTML = this.options.sortOptions.length > 0 
      ? this.renderSortSelect() 
      : '';

    const resetHTML = this.options.showResetButton 
      ? `<button type="button" id="resetFilters" class="filter-reset-btn">条件をクリア</button>`
      : '';

    const countHTML = this.options.showCount 
      ? `<div id="filterCount" class="filter-count">0件</div>`
      : '';

    return `
      <div class="${this.options.className}">
        <div class="search-filter-header">
          <h4 class="search-filter-title">絞り込み条件</h4>
        </div>
        <div class="search-filter-content">
          <div class="search-filter-row">
            <div class="search-input-wrapper">
              <input 
                type="search" 
                id="${this.options.searchId}" 
                class="search-input" 
                placeholder="${this.options.searchPlaceholder}" 
              />
            </div>
            ${sortHTML}
          </div>
          ${filtersHTML ? `<div class="filter-row">${filtersHTML}</div>` : ''}
          <div class="search-filter-actions">
            ${resetHTML}
            ${countHTML}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * テキストフィルターを生成
   * @param {Object} filter
   * @returns {string}
   */
  renderTextFilter(filter) {
    return `
      <div class="filter-field">
        <label for="${filter.id}" class="filter-label">${filter.label}</label>
        <input 
          type="text" 
          id="${filter.id}" 
          class="filter-input" 
          placeholder="${filter.placeholder || ''}" 
        />
      </div>
    `;
  }

  /**
   * セレクトフィルターを生成
   * @param {Object} filter
   * @returns {string}
   */
  renderSelectFilter(filter) {
    const optionsHTML = filter.options.map(option => 
      `<option value="${option.value}">${option.label}</option>`
    ).join('');

    return `
      <div class="filter-field">
        <label for="${filter.id}" class="filter-label">${filter.label}</label>
        <select id="${filter.id}" class="filter-select">
          <option value="">全て</option>
          ${optionsHTML}
        </select>
      </div>
    `;
  }

  /**
   * 日付フィルターを生成
   * @param {Object} filter
   * @returns {string}
   */
  renderDateFilter(filter) {
    return `
      <div class="filter-field">
        <label for="${filter.id}" class="filter-label">${filter.label}</label>
        <input 
          type="date" 
          id="${filter.id}" 
          class="filter-date" 
        />
      </div>
    `;
  }

  /**
   * ソートセレクトを生成
   * @returns {string}
   */
  renderSortSelect() {
    const optionsHTML = this.options.sortOptions.map(option => 
      `<option value="${option.value}">${option.label}</option>`
    ).join('');

    return `
      <div class="sort-wrapper">
        <select id="sortSelect" class="sort-select">
          ${optionsHTML}
        </select>
      </div>
    `;
  }

  /**
   * 指定したコンテナにコンポーネントをマウント
   * @param {HTMLElement|string} container 
   */
  mount(container) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    
    if (!container) {
      throw new Error('Container element not found');
    }

    this.container = container;
    this.container.innerHTML = this.render();
    
    // 要素の参照を取得
    this.searchInput = document.getElementById(this.options.searchId);
    this.sortSelect = document.getElementById('sortSelect');
    this.resetButton = document.getElementById('resetFilters');
    this.countDisplay = document.getElementById('filterCount');

    // フィルター要素の参照を取得
    this.options.filters.forEach(filter => {
      this.filterElements[filter.id] = document.getElementById(filter.id);
    });
    
    // イベントリスナーを設定
    this.attachEventListeners();
  }

  /**
   * コンポーネントをアンマウント
   */
  unmount() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
      this.searchInput = null;
      this.filterElements = {};
      this.sortSelect = null;
      this.resetButton = null;
      this.countDisplay = null;
    }
  }

  /**
   * イベントリスナーを設定
   */
  attachEventListeners() {
    // 検索入力
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.handleSearch(e.target.value);
      });
    }

    // フィルター変更
    Object.keys(this.filterElements).forEach(id => {
      const element = this.filterElements[id];
      if (element) {
        element.addEventListener('change', () => {
          this.handleFilterChange();
        });
      }
    });

    // ソート変更
    if (this.sortSelect) {
      this.sortSelect.addEventListener('change', (e) => {
        this.handleSort(e.target.value);
      });
    }

    // リセットボタン
    if (this.resetButton) {
      this.resetButton.addEventListener('click', () => {
        this.handleReset();
      });
    }
  }

  /**
   * 検索を処理
   * @param {string} value
   */
  handleSearch(value) {
    this.options.onSearch(value);
  }

  /**
   * フィルター変更を処理
   */
  handleFilterChange() {
    const filters = {};
    Object.keys(this.filterElements).forEach(id => {
      const element = this.filterElements[id];
      if (element) {
        filters[id] = element.value;
      }
    });
    this.options.onFilter(filters);
  }

  /**
   * ソートを処理
   * @param {string} value
   */
  handleSort(value) {
    this.options.onSort(value);
  }

  /**
   * リセットを処理
   */
  handleReset() {
    // 検索をクリア
    if (this.searchInput) {
      this.searchInput.value = '';
    }

    // フィルターをクリア
    Object.values(this.filterElements).forEach(element => {
      if (element) {
        element.value = '';
      }
    });

    // ソートをリセット
    if (this.sortSelect && this.sortSelect.options.length > 0) {
      this.sortSelect.selectedIndex = 0;
    }

    this.options.onReset();
  }

  /**
   * 現在のフィルター値を取得
   * @returns {Object}
   */
  getValues() {
    const values = {
      search: this.searchInput?.value || '',
      sort: this.sortSelect?.value || '',
      filters: {}
    };

    Object.keys(this.filterElements).forEach(id => {
      const element = this.filterElements[id];
      if (element) {
        values.filters[id] = element.value;
      }
    });

    return values;
  }

  /**
   * フィルター値を設定
   * @param {Object} values
   */
  setValues(values) {
    if (this.searchInput && values.search !== undefined) {
      this.searchInput.value = values.search;
    }

    if (this.sortSelect && values.sort !== undefined) {
      this.sortSelect.value = values.sort;
    }

    if (values.filters) {
      Object.keys(values.filters).forEach(id => {
        const element = this.filterElements[id];
        if (element) {
          element.value = values.filters[id];
        }
      });
    }
  }

  /**
   * 件数を更新
   * @param {number} count
   */
  updateCount(count) {
    this.currentCount = count;
    if (this.countDisplay) {
      this.countDisplay.textContent = `${count}件`;
    }
  }

  /**
   * ローディング状態を設定
   * @param {boolean} loading
   */
  setLoading(loading) {
    if (this.countDisplay) {
      this.countDisplay.textContent = loading ? '検索中...' : `${this.currentCount}件`;
    }
  }
}

/**
 * ファクトリー関数: 標準的な検索フィルターを作成
 * @param {Object} options
 * @returns {SearchFilter}
 */
export function createSearchFilter(options = {}) {
  return new SearchFilter(options);
}

/**
 * ファクトリー関数: テーブル用検索フィルターを作成
 * @param {Object} options
 * @returns {SearchFilter}
 */
export function createTableSearchFilter(options = {}) {
  return new SearchFilter({
    className: 'table-search-filter',
    showCount: true,
    showResetButton: true,
    ...options
  });
}