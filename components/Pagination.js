/**
 * Pagination Component
 * ページネーション機能の汎用コンポーネント
 */

export class Pagination {
  constructor(options = {}) {
    this.options = {
      containerId: options.containerId || 'pagination',
      className: options.className || 'pagination',
      totalItems: options.totalItems || 0,
      itemsPerPage: options.itemsPerPage || 10,
      currentPage: options.currentPage || 1,
      maxVisiblePages: options.maxVisiblePages || 5,
      showPageSize: options.showPageSize !== false,
      pageSizeOptions: options.pageSizeOptions || [10, 25, 50, 100],
      showInfo: options.showInfo !== false,
      showFirstLast: options.showFirstLast !== false,
      labels: {
        first: '最初',
        previous: '前へ',
        next: '次へ',
        last: '最後',
        pageSize: '表示件数',
        info: '{{start}} - {{end}} 件 / {{total}} 件中',
        ...options.labels
      },
      onChange: options.onChange || (() => {}),
      onPageSizeChange: options.onPageSizeChange || (() => {})
    };
    
    this.container = null;
    this.currentPage = this.options.currentPage;
    this.itemsPerPage = this.options.itemsPerPage;
    this.totalItems = this.options.totalItems;
  }

  /**
   * 総ページ数を計算
   * @returns {number}
   */
  get totalPages() {
    return Math.ceil(this.totalItems / this.itemsPerPage) || 1;
  }

  /**
   * 開始アイテム番号
   * @returns {number}
   */
  get startItem() {
    return Math.min((this.currentPage - 1) * this.itemsPerPage + 1, this.totalItems);
  }

  /**
   * 終了アイテム番号
   * @returns {number}
   */
  get endItem() {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
  }

  /**
   * コンポーネントのHTMLを生成
   * @returns {string} HTML文字列
   */
  render() {
    const navHTML = this.renderNavigation();
    const pageSizeHTML = this.options.showPageSize ? this.renderPageSize() : '';
    const infoHTML = this.options.showInfo ? this.renderInfo() : '';

    return `
      <div class="${this.options.className}">
        <div class="pagination-navigation">
          ${navHTML}
        </div>
        <div class="pagination-controls">
          ${infoHTML}
          ${pageSizeHTML}
        </div>
      </div>
    `;
  }

  /**
   * ナビゲーションボタンを生成
   * @returns {string}
   */
  renderNavigation() {
    const buttons = [];

    // 最初のページボタン
    if (this.options.showFirstLast) {
      buttons.push(this.renderButton('first', this.options.labels.first, 1, this.currentPage === 1));
    }

    // 前のページボタン
    buttons.push(this.renderButton('prev', this.options.labels.previous, this.currentPage - 1, this.currentPage === 1));

    // ページ番号ボタン
    const pageNumbers = this.getVisiblePageNumbers();
    pageNumbers.forEach(page => {
      if (page === '...') {
        buttons.push('<span class="pagination-ellipsis">...</span>');
      } else {
        buttons.push(this.renderButton('page', page.toString(), page, false, page === this.currentPage));
      }
    });

    // 次のページボタン
    buttons.push(this.renderButton('next', this.options.labels.next, this.currentPage + 1, this.currentPage === this.totalPages));

    // 最後のページボタン
    if (this.options.showFirstLast) {
      buttons.push(this.renderButton('last', this.options.labels.last, this.totalPages, this.currentPage === this.totalPages));
    }

    return buttons.join('');
  }

  /**
   * ボタンを生成
   * @param {string} type - ボタンタイプ
   * @param {string} label - ボタンラベル
   * @param {number} page - ページ番号
   * @param {boolean} disabled - 無効状態
   * @param {boolean} active - アクティブ状態
   * @returns {string}
   */
  renderButton(type, label, page, disabled = false, active = false) {
    const classes = ['pagination-button', `pagination-${type}`];
    if (disabled) classes.push('disabled');
    if (active) classes.push('active');

    const disabledAttr = disabled ? 'disabled' : '';
    const dataPage = !disabled ? `data-page="${page}"` : '';

    return `
      <button 
        type="button" 
        class="${classes.join(' ')}" 
        ${disabledAttr} 
        ${dataPage}
      >
        ${label}
      </button>
    `;
  }

  /**
   * 表示するページ番号を取得
   * @returns {Array<number|string>}
   */
  getVisiblePageNumbers() {
    const total = this.totalPages;
    const current = this.currentPage;
    const maxVisible = this.options.maxVisiblePages;

    if (total <= maxVisible) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages = [];
    const half = Math.floor(maxVisible / 2);

    if (current <= half + 1) {
      // 開始付近
      for (let i = 1; i <= maxVisible - 1; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
    } else if (current >= total - half) {
      // 終了付近
      pages.push(1);
      pages.push('...');
      for (let i = total - maxVisible + 2; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // 中央付近
      pages.push(1);
      pages.push('...');
      for (let i = current - half + 1; i <= current + half - 1; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
    }

    return pages;
  }

  /**
   * ページサイズセレクトを生成
   * @returns {string}
   */
  renderPageSize() {
    const options = this.options.pageSizeOptions.map(size => 
      `<option value="${size}" ${size === this.itemsPerPage ? 'selected' : ''}>${size}件</option>`
    ).join('');

    return `
      <div class="pagination-page-size">
        <label for="pageSize" class="pagination-page-size-label">${this.options.labels.pageSize}</label>
        <select id="pageSize" class="pagination-page-size-select">
          ${options}
        </select>
      </div>
    `;
  }

  /**
   * 情報表示を生成
   * @returns {string}
   */
  renderInfo() {
    const info = this.options.labels.info
      .replace('{{start}}', this.startItem.toLocaleString())
      .replace('{{end}}', this.endItem.toLocaleString())
      .replace('{{total}}', this.totalItems.toLocaleString());

    return `<div class="pagination-info">${info}</div>`;
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
    }
  }

  /**
   * イベントリスナーを設定
   */
  attachEventListeners() {
    // ページボタンクリック
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('pagination-button') && !e.target.disabled) {
        const page = parseInt(e.target.dataset.page);
        if (page && page !== this.currentPage) {
          this.goToPage(page);
        }
      }
    });

    // ページサイズ変更
    const pageSizeSelect = this.container.querySelector('#pageSize');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        const newSize = parseInt(e.target.value);
        this.setPageSize(newSize);
      });
    }
  }

  /**
   * 指定ページに移動
   * @param {number} page
   */
  goToPage(page) {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.update();
      this.options.onChange(page);
    }
  }

  /**
   * ページサイズを設定
   * @param {number} size
   */
  setPageSize(size) {
    if (size !== this.itemsPerPage) {
      this.itemsPerPage = size;
      // ページサイズ変更時は最初のページに戻る
      this.currentPage = 1;
      this.update();
      this.options.onPageSizeChange(size);
    }
  }

  /**
   * 総アイテム数を設定
   * @param {number} total
   */
  setTotalItems(total) {
    this.totalItems = total;
    // 現在のページが範囲外の場合は調整
    if (this.currentPage > this.totalPages) {
      this.currentPage = Math.max(1, this.totalPages);
    }
    this.update();
  }

  /**
   * 表示を更新
   */
  update() {
    if (this.container) {
      this.container.innerHTML = this.render();
      this.attachEventListeners();
    }
  }

  /**
   * 前のページに移動
   */
  previousPage() {
    this.goToPage(this.currentPage - 1);
  }

  /**
   * 次のページに移動
   */
  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  /**
   * 最初のページに移動
   */
  firstPage() {
    this.goToPage(1);
  }

  /**
   * 最後のページに移動
   */
  lastPage() {
    this.goToPage(this.totalPages);
  }

  /**
   * 現在の状態を取得
   * @returns {Object}
   */
  getState() {
    return {
      currentPage: this.currentPage,
      totalPages: this.totalPages,
      itemsPerPage: this.itemsPerPage,
      totalItems: this.totalItems,
      startItem: this.startItem,
      endItem: this.endItem
    };
  }
}

/**
 * ファクトリー関数: 標準的なページネーションを作成
 * @param {Object} options
 * @returns {Pagination}
 */
export function createPagination(options = {}) {
  return new Pagination(options);
}

/**
 * ファクトリー関数: シンプルなページネーションを作成
 * @param {Object} options
 * @returns {Pagination}
 */
export function createSimplePagination(options = {}) {
  return new Pagination({
    showPageSize: false,
    showFirstLast: false,
    maxVisiblePages: 3,
    ...options
  });
}