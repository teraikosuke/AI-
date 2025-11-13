/**
 * Sortable Table Component
 * ソート可能なテーブルの汎用コンポーネント
 */

export class SortableTable {
  constructor(options = {}) {
    this.options = {
      tableId: options.tableId || 'sortableTable',
      columns: options.columns || [], // {key, label, sortable, render, align}
      className: options.className || 'sortable-table',
      stickyHeader: options.stickyHeader !== false,
      stickyFirstColumn: options.stickyFirstColumn === true,
      minWidth: options.minWidth || 'auto',
      onSort: options.onSort || (() => {}),
      onRowClick: options.onRowClick || null,
      sortIcon: options.sortIcon !== false,
      striped: options.striped !== false,
      hover: options.hover !== false
    };
    
    this.container = null;
    this.table = null;
    this.thead = null;
    this.tbody = null;
    this.currentSort = { key: null, direction: 'asc' };
    this.data = [];
  }

  /**
   * コンポーネントのHTMLを生成
   * @returns {string} HTML文字列
   */
  render() {
    const tableClasses = [
      this.options.className,
      'table-grid'
    ].filter(Boolean).join(' ');

    const tableStyle = this.options.minWidth !== 'auto' 
      ? `style="min-width: ${this.options.minWidth}"` 
      : '';

    const headerHTML = this.renderHeader();
    const bodyHTML = this.renderBody();

    return `
      <div class="table-wrapper">
        <table id="${this.options.tableId}" class="${tableClasses}" ${tableStyle}>
          ${headerHTML}
          ${bodyHTML}
        </table>
      </div>
    `;
  }

  /**
   * ヘッダーを生成
   * @returns {string}
   */
  renderHeader() {
    const headerCells = this.options.columns.map((column, index) => {
      const classes = [];
      if (this.options.stickyFirstColumn && index === 0) {
        classes.push('sticky', 'left-0', 'bg-white', 'z-10');
      }
      if (column.sortable) {
        classes.push('sortable', 'cursor-pointer', 'hover:bg-slate-100');
      }

      const classAttr = classes.length > 0 ? `class="${classes.join(' ')}"` : '';
      const dataSort = column.sortable ? `data-sort="${column.key}"` : '';
      const sortIcon = column.sortable && this.options.sortIcon 
        ? '<span class="sort-icon ml-1"></span>' 
        : '';

      return `
        <th ${classAttr} ${dataSort} style="text-align: ${column.align || 'left'}">
          ${column.label}${sortIcon}
        </th>
      `;
    }).join('');

    return `
      <thead>
        <tr>
          ${headerCells}
        </tr>
      </thead>
    `;
  }

  /**
   * ボディを生成
   * @returns {string}
   */
  renderBody() {
    return `
      <tbody id="${this.options.tableId}Body">
        ${this.renderRows()}
      </tbody>
    `;
  }

  /**
   * 行を生成
   * @returns {string}
   */
  renderRows() {
    if (!this.data || this.data.length === 0) {
      return `
        <tr>
          <td colspan="${this.options.columns.length}" class="text-center text-slate-500 py-8">
            データがありません
          </td>
        </tr>
      `;
    }

    return this.data.map((row, rowIndex) => {
      const rowClasses = [];
      if (this.options.hover) rowClasses.push('hover:bg-slate-50');
      if (this.options.onRowClick) rowClasses.push('cursor-pointer');

      const cells = this.options.columns.map((column, colIndex) => {
        const classes = [];
        if (this.options.stickyFirstColumn && colIndex === 0) {
          classes.push('sticky', 'left-0', 'bg-white', 'z-10');
        }

        const classAttr = classes.length > 0 ? `class="${classes.join(' ')}"` : '';
        const style = `style="text-align: ${column.align || 'left'}"`;
        const value = column.render ? column.render(row[column.key], row) : row[column.key];

        return `<td ${classAttr} ${style}>${value}</td>`;
      }).join('');

      const rowClassAttr = rowClasses.length > 0 ? `class="${rowClasses.join(' ')}"` : '';
      const rowClickAttr = this.options.onRowClick ? `data-row-index="${rowIndex}"` : '';

      return `<tr ${rowClassAttr} ${rowClickAttr}>${cells}</tr>`;
    }).join('');
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
    this.table = document.getElementById(this.options.tableId);
    this.thead = this.table.querySelector('thead');
    this.tbody = this.table.querySelector('tbody');
    
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
      this.table = null;
      this.thead = null;
      this.tbody = null;
    }
  }

  /**
   * イベントリスナーを設定
   */
  attachEventListeners() {
    // ソートヘッダークリック
    if (this.thead) {
      this.thead.addEventListener('click', (e) => {
        const th = e.target.closest('th[data-sort]');
        if (th) {
          const sortKey = th.dataset.sort;
          this.handleSort(sortKey);
        }
      });
    }

    // 行クリック
    if (this.tbody && this.options.onRowClick) {
      this.tbody.addEventListener('click', (e) => {
        const tr = e.target.closest('tr[data-row-index]');
        if (tr) {
          const rowIndex = parseInt(tr.dataset.rowIndex);
          const rowData = this.data[rowIndex];
          if (rowData) {
            this.options.onRowClick(rowData, rowIndex, e);
          }
        }
      });
    }
  }

  /**
   * ソートを処理
   * @param {string} sortKey
   */
  handleSort(sortKey) {
    // ソート方向の決定
    let direction = 'asc';
    if (this.currentSort.key === sortKey && this.currentSort.direction === 'asc') {
      direction = 'desc';
    }

    this.currentSort = { key: sortKey, direction };

    // ソートアイコンの更新
    this.updateSortIcons();

    // ソートイベントを発火
    this.options.onSort(sortKey, direction);
  }

  /**
   * ソートアイコンを更新
   */
  updateSortIcons() {
    // 全てのソートアイコンをクリア
    this.thead.querySelectorAll('.sort-icon').forEach(icon => {
      icon.className = 'sort-icon ml-1';
    });

    // アクティブなソートアイコンを更新
    const activeHeader = this.thead.querySelector(`th[data-sort="${this.currentSort.key}"] .sort-icon`);
    if (activeHeader) {
      activeHeader.className = `sort-icon ml-1 sort-${this.currentSort.direction}`;
    }
  }

  /**
   * データを設定
   * @param {Array} data
   */
  setData(data) {
    this.data = data || [];
    if (this.tbody) {
      this.tbody.innerHTML = this.renderRows();
    }
  }

  /**
   * データを取得
   * @returns {Array}
   */
  getData() {
    return this.data;
  }

  /**
   * 行を追加
   * @param {Object} rowData
   */
  addRow(rowData) {
    this.data.push(rowData);
    if (this.tbody) {
      this.tbody.innerHTML = this.renderRows();
    }
  }

  /**
   * 行を更新
   * @param {number} index
   * @param {Object} rowData
   */
  updateRow(index, rowData) {
    if (index >= 0 && index < this.data.length) {
      this.data[index] = rowData;
      if (this.tbody) {
        this.tbody.innerHTML = this.renderRows();
      }
    }
  }

  /**
   * 行を削除
   * @param {number} index
   */
  removeRow(index) {
    if (index >= 0 && index < this.data.length) {
      this.data.splice(index, 1);
      if (this.tbody) {
        this.tbody.innerHTML = this.renderRows();
      }
    }
  }

  /**
   * テーブルをクリア
   */
  clear() {
    this.setData([]);
  }

  /**
   * ローディング状態を表示
   * @param {boolean} loading
   */
  setLoading(loading) {
    if (this.tbody) {
      if (loading) {
        this.tbody.innerHTML = `
          <tr>
            <td colspan="${this.options.columns.length}" class="text-center text-slate-500 py-8">
              <div class="flex items-center justify-center gap-2">
                <div class="animate-spin w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full"></div>
                読み込み中...
              </div>
            </td>
          </tr>
        `;
      } else {
        this.tbody.innerHTML = this.renderRows();
      }
    }
  }
}

/**
 * ファクトリー関数: 標準的なソート可能テーブルを作成
 * @param {Object} options
 * @returns {SortableTable}
 */
export function createSortableTable(options = {}) {
  return new SortableTable(options);
}

/**
 * ファクトリー関数: データグリッドテーブルを作成
 * @param {Object} options
 * @returns {SortableTable}
 */
export function createDataGrid(options = {}) {
  return new SortableTable({
    className: 'data-grid table-grid',
    stickyHeader: true,
    stickyFirstColumn: false,
    striped: true,
    hover: true,
    sortIcon: true,
    ...options
  });
}