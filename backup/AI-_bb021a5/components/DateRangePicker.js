/**
 * Date Range Picker Component
 * 日付範囲選択の汎用コンポーネント
 */

export class DateRangePicker {
  constructor(options = {}) {
    this.options = {
      startId: options.startId || 'dateStart',
      endId: options.endId || 'dateEnd',
      startLabel: options.startLabel || '開始日',
      endLabel: options.endLabel || '終了日',
      className: options.className || 'date-range-picker',
      onChange: options.onChange || (() => {}),
      defaultStart: options.defaultStart || '',
      defaultEnd: options.defaultEnd || ''
    };
    
    this.container = null;
    this.startInput = null;
    this.endInput = null;
  }

  /**
   * コンポーネントのHTMLを生成
   * @returns {string} HTML文字列
   */
  render() {
    return `
      <div class="${this.options.className}">
        <div class="date-range-field">
          <label for="${this.options.startId}" class="date-range-label">${this.options.startLabel}</label>
          <input type="date" id="${this.options.startId}" class="date-range-input" value="${this.options.defaultStart}" />
        </div>
        <span class="date-range-separator">〜</span>
        <div class="date-range-field">
          <label for="${this.options.endId}" class="date-range-label">${this.options.endLabel}</label>
          <input type="date" id="${this.options.endId}" class="date-range-input" value="${this.options.defaultEnd}" />
        </div>
      </div>
    `;
  }

  /**
   * 指定したコンテナにコンポーネントをマウント
   * @param {HTMLElement} container 
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
    this.startInput = document.getElementById(this.options.startId);
    this.endInput = document.getElementById(this.options.endId);
    
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
      this.startInput = null;
      this.endInput = null;
    }
  }

  /**
   * イベントリスナーを設定
   */
  attachEventListeners() {
    if (this.startInput) {
      this.startInput.addEventListener('change', (e) => {
        this.handleDateChange('start', e.target.value);
      });
    }

    if (this.endInput) {
      this.endInput.addEventListener('change', (e) => {
        this.handleDateChange('end', e.target.value);
      });
    }
  }

  /**
   * 日付変更を処理
   * @param {string} type - 'start' or 'end'
   * @param {string} value - 日付文字列
   */
  handleDateChange(type, value) {
    // 開始日が終了日より後の場合は調整
    if (type === 'start' && this.endInput.value && value > this.endInput.value) {
      this.endInput.value = value;
    }
    
    if (type === 'end' && this.startInput.value && value < this.startInput.value) {
      this.startInput.value = value;
    }

    // 変更を通知
    this.options.onChange({
      start: this.startInput?.value || '',
      end: this.endInput?.value || '',
      type
    });
  }

  /**
   * 現在の値を取得
   * @returns {{start: string, end: string}}
   */
  getValue() {
    return {
      start: this.startInput?.value || '',
      end: this.endInput?.value || ''
    };
  }

  /**
   * 値を設定
   * @param {Object} value
   * @param {string} value.start - 開始日
   * @param {string} value.end - 終了日
   */
  setValue(value) {
    if (this.startInput) {
      this.startInput.value = value.start || '';
    }
    if (this.endInput) {
      this.endInput.value = value.end || '';
    }
  }

  /**
   * 有効性をチェック
   * @returns {boolean}
   */
  isValid() {
    const { start, end } = this.getValue();
    return start && end && start <= end;
  }

  /**
   * バリデーションエラーメッセージを取得
   * @returns {string[]}
   */
  getValidationErrors() {
    const errors = [];
    const { start, end } = this.getValue();

    if (!start) {
      errors.push('開始日を選択してください');
    }

    if (!end) {
      errors.push('終了日を選択してください');
    }

    if (start && end && start > end) {
      errors.push('開始日は終了日より前の日付を選択してください');
    }

    return errors;
  }
}

/**
 * ファクトリー関数: 標準的な日付範囲ピッカーを作成
 * @param {Object} options
 * @returns {DateRangePicker}
 */
export function createDateRangePicker(options = {}) {
  return new DateRangePicker(options);
}

/**
 * ファクトリー関数: KPI用日付範囲ピッカーを作成
 * @param {Object} options
 * @returns {DateRangePicker}
 */
export function createKpiDateRangePicker(options = {}) {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  
  return new DateRangePicker({
    className: 'kpi-v2-range-picker',
    defaultStart: firstDay.toISOString().split('T')[0],
    defaultEnd: today.toISOString().split('T')[0],
    ...options
  });
}