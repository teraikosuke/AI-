// teleapo.js
console.log("🔥 teleapo.js 読み込み成功！");

// 架電ログのソース・オブ・トゥルース
// { datetime: "YYYY/MM/DD HH:MM", employee, target, tel, email, result, memo } の配列
let teleapoLogData = [];

// === AI分析機能の有効／無効フラグ ===
const TELEAPO_AI_ANALYSIS_ENABLED = false;

// ======== グローバル状態 ========
// 日別のモックデータ（本番ではここをAPI/GASで取得）
let teleapoCompanyDailyData = [];          // [{ date: '2024-11-01', dials, connects, sets, shows }, ...]
let teleapoEmployeeDailyData = {};         // { '佐藤': [{date, dials,...}], '田中': [...], ... }
const teleapoEmployees = ['佐藤', '田中', '山本', '鈴木'];

let teleapoEmployeeData = [];
let teleapoCompanyKPIData = null;

let teleapoSummaryScope = {
  type: 'company', // 'company' | 'employee'
  name: '全体'
};

let teleapoGlobalStartDate = null; // 'yyyy-mm-dd'
let teleapoGlobalEndDate = null;   // 'yyyy-mm-dd'


// 選択中期間を "YYYY/MM/DD〜YYYY/MM/DD" 形式で返す（1日の場合は1日だけ）
function getTeleapoSelectedRangeLabel() {
  if (!teleapoGlobalStartDate || !teleapoGlobalEndDate) return '';
  const s = teleapoGlobalStartDate.replace(/-/g, '/');
  const e = teleapoGlobalEndDate.replace(/-/g, '/');
  if (s === e) return s;
  return `${s}〜${e}`;
}

// 社員別集計結果（teleapoEmployeeData）から全体KPIを再計算して、上部カードを更新する
function recalcTeleapoCompanyKPIFromEmployees() {
  if (!Array.isArray(teleapoEmployeeData) || teleapoEmployeeData.length === 0) {
    return;
  }

  let dialsSum = 0;
  let connectsSum = 0;
  let setsSum = 0;
  let showsSum = 0;

  teleapoEmployeeData.forEach(emp => {
    dialsSum += emp.dials || 0;
    connectsSum += emp.connects || 0;
    setsSum += emp.sets || 0;
    showsSum += emp.shows || 0;
  });

  const connectRate = dialsSum > 0 ? (connectsSum / dialsSum) * 100 : 0;
  const setRate = connectsSum > 0 ? (setsSum / connectsSum) * 100 : 0;
  const showRate = setsSum > 0 ? (showsSum / setsSum) * 100 : 0;

  // グローバルの会社KPIデータも更新しておく
  teleapoCompanyKPIData = {
    dials: dialsSum,
    connects: connectsSum,
    sets: setsSum,
    shows: showsSum,
    connectRate,
    setRate,
    showRate
  };

  // スコープが「全体」の場合だけ上部カードを更新
  if (teleapoSummaryScope.type === 'company') {
    updateTeleapoSummaryRateCards(teleapoCompanyKPIData, null);
  }
}

// 既存の #teleapoLogTableBody から teleapoLogData を構築する
function initializeTeleapoLogDataFromTable() {
  const tbody = document.getElementById('teleapoLogTableBody');
  if (!tbody) return;

  teleapoLogData = [];

  const rows = tbody.querySelectorAll('tr');
  rows.forEach(row => {
    const cells = row.children;
    if (!cells || cells.length < 7) return;

    const datetime = cells[0].textContent.trim();
    const employee = cells[1].textContent.trim();
    const target = cells[2].textContent.trim();
    const tel = cells[3].textContent.trim();
    const email = cells[4].textContent.trim();
    const result = cells[5].textContent.trim(); // バッジ内テキスト
    const memo = cells[6].textContent.trim();

    teleapoLogData.push({
      datetime,
      employee,
      target,
      tel,
      email,
      result,
      memo
    });
  });

  console.log('initializeTeleapoLogDataFromTable: rows =', teleapoLogData.length);
}


// アポ結果テキストを「通電/設定/着座」フラグに分類
function classifyTeleapoResult(resultText) {
  const text = (resultText || '').trim();
  const isConnect = ['通電', '設定', '着座', 'コールバック'].some(w => text.includes(w));
  const isSet = ['設定', '着座'].some(w => text.includes(w));
  const isShow = ['着座'].some(w => text.includes(w));
  return { isConnect, isSet, isShow };
}

// 時刻（hour）からヒートマップ用の時間帯スロットを決める
function resolveTeleapoSlot(hour) {
  if (hour >= 9 && hour < 11) return '09-11';
  if (hour >= 11 && hour < 13) return '11-13';
  if (hour >= 13 && hour < 15) return '13-15';
  if (hour >= 15 && hour < 17) return '15-17';
  if (hour >= 17 && hour < 19) return '17-19';
  return null; // ヒートマップ対象外
}

// ======== ヒートマップ（指標ごとに別データ） ========

// 軸定義
const TELEAPO_HEATMAP_DAYS = ['月', '火', '水', '木', '金'];
const TELEAPO_HEATMAP_SLOTS = ['09-11', '11-13', '13-15', '15-17', '17-19'];

// ヒートマップ用データ（ログから再計算して上書き）
let TELEAPO_HEATMAP_DATA = {};

// teleapoLogData から日次データ & ヒートマップ用データを再構築する
function rebuildTeleapoAggregatesFromLogs() {
  const companyMap = new Map();  // key: 'yyyy-mm-dd' -> { date, dials, connects, sets, shows }
  const employeeMap = {};        // name -> Map(dateStr -> { ... })

  // ヒートマップ用（過去30日分のみ）
  const now = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(now.getDate() - 30);

  const heatmapBase = {};        // empKey('all' or name) -> { dials:{day:{slot}}, connects:{...}, sets:{...}, shows:{...} }

  function ensureHeatmapEmp(empKey) {
    if (!heatmapBase[empKey]) {
      heatmapBase[empKey] = {
        dials: {},
        connects: {},
        sets: {},
        shows: {}
      };
    }
    return heatmapBase[empKey];
  }

  function ensureHeatmapCell(metricObj, day, slot) {
    if (!metricObj[day]) metricObj[day] = {};
    if (!metricObj[day][slot]) metricObj[day][slot] = 0;
  }

  teleapoLogData.forEach(log => {
    const dtStr = log.datetime || '';
    if (!dtStr) return;

    // "YYYY/MM/DD HH:MM" を分解
    const [datePart, timePart] = dtStr.split(' ');
    if (!datePart) return;
    const [y, m, d] = datePart.split('/');
    if (!y || !m || !d) return;

    const isoDateStr = `${y}-${m}-${d}`;
    const dateObj = new Date(`${isoDateStr}T00:00:00`);

    // --- 日次（会社全体） ---
    let compRow = companyMap.get(isoDateStr);
    if (!compRow) {
      compRow = { date: isoDateStr, dials: 0, connects: 0, sets: 0, shows: 0 };
    }
    compRow.dials += 1;

    const { isConnect, isSet, isShow } = classifyTeleapoResult(log.result);
    if (isConnect) compRow.connects += 1;
    if (isSet) compRow.sets += 1;
    if (isShow) compRow.shows += 1;
    companyMap.set(isoDateStr, compRow);

    // --- 日次（社員別） ---
    const empName = log.employee || '';
    if (!employeeMap[empName]) {
      employeeMap[empName] = new Map();
    }
    const empMap = employeeMap[empName];
    let empRow = empMap.get(isoDateStr);
    if (!empRow) {
      empRow = { date: isoDateStr, dials: 0, connects: 0, sets: 0, shows: 0 };
    }
    empRow.dials += 1;
    if (isConnect) empRow.connects += 1;
    if (isSet) empRow.sets += 1;
    if (isShow) empRow.shows += 1;
    empMap.set(isoDateStr, empRow);

    // --- ヒートマップ（過去30日分のみ） ---
    if (dateObj < oneMonthAgo) return;

    const dayIdx = dateObj.getDay(); // 0:日〜6:土
    const dayLabel = ['日', '月', '火', '水', '木', '金', '土'][dayIdx];
    if (!['月', '火', '水', '木', '金'].includes(dayLabel)) return;

    let hour = 0;
    if (timePart) {
      const [hh] = timePart.split(':');
      hour = parseInt(hh, 10);
    }
    const slot = resolveTeleapoSlot(hour);
    if (!slot) return;

    const empKeys = ['all', empName];
    empKeys.forEach(key => {
      const buckets = ensureHeatmapEmp(key);
      ensureHeatmapCell(buckets.dials, dayLabel, slot);
      buckets.dials[dayLabel][slot] += 1;

      if (isConnect) {
        ensureHeatmapCell(buckets.connects, dayLabel, slot);
        buckets.connects[dayLabel][slot] += 1;
      }
      if (isSet) {
        ensureHeatmapCell(buckets.sets, dayLabel, slot);
        buckets.sets[dayLabel][slot] += 1;
      }
      if (isShow) {
        ensureHeatmapCell(buckets.shows, dayLabel, slot);
        buckets.shows[dayLabel][slot] += 1;
      }
    });
  });

  // Map → 配列に変換してグローバルに反映
  teleapoCompanyDailyData = Array.from(companyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  teleapoEmployeeDailyData = {};
  Object.keys(employeeMap).forEach(name => {
    teleapoEmployeeDailyData[name] = Array.from(employeeMap[name].values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  });

  // ヒートマップデータも更新
  TELEAPO_HEATMAP_DATA = heatmapBase;

  console.log('rebuildTeleapoAggregatesFromLogs: companyDaily =', teleapoCompanyDailyData.length);
}

let teleapoHeatmapSelection = null;

function initializeTeleapoHeatmapControls() {
  const empSelect = document.getElementById('teleapoHeatmapEmployeeFilter');
  const metricSelect = document.getElementById('teleapoHeatmapMetricFilter');

  if (metricSelect) {
    metricSelect.value = 'connectRate'; // 初期は「通電率」
  }

  if (empSelect) {
    empSelect.addEventListener('change', () => {
      renderTeleapoHeatmap();
    });
  }
  if (metricSelect) {
    metricSelect.addEventListener('change', () => {
      renderTeleapoHeatmap();
    });
  }
}
// ヒートマップ描画（通電率 / 設定率 を平均との差で青／赤グラデーション）
// 記録なし（架電/通電/設定すべて0）の時間帯は無色（ニュートラル）で表示
function renderTeleapoHeatmap() {
  const empSelect = document.getElementById('teleapoHeatmapEmployeeFilter');
  const metricSelect = document.getElementById('teleapoHeatmapMetricFilter');
  const tbody = document.getElementById('teleapoHeatmapTableBody');
  if (!tbody) return;

  const employeeKey = empSelect?.value || 'all';
  const metricKey = metricSelect?.value || 'connectRate';

  // ログがまだない場合でも落ちないように保険を入れる
  const empCounts = TELEAPO_HEATMAP_DATA[employeeKey]
    || TELEAPO_HEATMAP_DATA.all
    || { dials: {}, connects: {}, sets: {}, shows: {} };

  const dialsData = empCounts.dials || {};
  const connectsData = empCounts.connects || {};
  const setsData = empCounts.sets || {};


  const rateMap = {}; // day -> slot -> rate (0〜100 or null)
  const hasData = {}; // day -> slot -> boolean（記録があるか）
  let sumRate = 0;
  let cellCount = 0;

  // ログが追加・変更されたときに、KPI・社員成績・ヒートマップ・テーブルを再描画
  function handleTeleapoLogDataChanged() {
    // 1. ログから集計を再構築
    rebuildTeleapoAggregatesFromLogs();

    // 2. KPI / 社員成績（選択期間に応じて）
    loadTeleapoCompanyKPIData();
    loadTeleapoEmployeeData();

    // 3. ヒートマップ再描画
    renderTeleapoHeatmap();

    // 4. ログテーブル再描画（フィルタと件数も更新）
    renderTeleapoLogTable();
  }


  function initializeTeleapoLogInputForm() {
    const addBtn = document.getElementById('teleapoLogInputAddBtn');
    if (!addBtn) return;

    addBtn.addEventListener('click', () => {
      const dtInput = document.getElementById('teleapoLogInputDatetime');
      const empInput = document.getElementById('teleapoLogInputEmployee');
      const resInput = document.getElementById('teleapoLogInputResult');
      const targetInput = document.getElementById('teleapoLogInputTarget');
      const telInput = document.getElementById('teleapoLogInputTel');
      const emailInput = document.getElementById('teleapoLogInputEmail');
      const memoInput = document.getElementById('teleapoLogInputMemo');

      const dtValue = dtInput?.value || '';
      const employee = empInput?.value || '';
      const result = resInput?.value || '';
      const target = targetInput?.value || '';
      const tel = telInput?.value || '';
      const email = emailInput?.value || '';
      const memo = memoInput?.value || '';

      if (!dtValue || !employee || !result) {
        alert('日時・担当者・アポ結果は必須です。');
        return;
      }

      const dt = new Date(dtValue);
      if (Number.isNaN(dt.getTime())) {
        alert('日時の形式が不正です。');
        return;
      }
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      const hh = String(dt.getHours()).padStart(2, '0');
      const mm = String(dt.getMinutes()).padStart(2, '0');

      const datetimeStr = `${y}/${m}/${d} ${hh}:${mm}`;

      teleapoLogData.push({
        datetime: datetimeStr,
        employee,
        target,
        tel,
        email,
        result,
        memo
      });

      // ログ追加後の再計算
      handleTeleapoLogDataChanged();

      // 入力欄の一部をクリア（日時・担当者は残してもよければ残す）
      targetInput.value = '';
      telInput.value = '';
      emailInput.value = '';
      memoInput.value = '';
    });
  }

  // 1. 各セルの率を計算（記録なしセルは平均計算から除外）
  TELEAPO_HEATMAP_DAYS.forEach(day => {
    rateMap[day] = {};
    hasData[day] = {};
    TELEAPO_HEATMAP_SLOTS.forEach(slot => {
      const dials = dialsData[day]?.[slot] ?? 0;
      const connects = connectsData[day]?.[slot] ?? 0;
      const sets = setsData[day]?.[slot] ?? 0;

      // 「記録なし」条件：架電・通電・設定がすべて 0
      const noRecord = dials === 0 && connects === 0 && sets === 0;

      if (noRecord) {
        rateMap[day][slot] = null;
        hasData[day][slot] = false;
        return;
      }

      let rate = 0;
      if (metricKey === 'connectRate') {
        // 通電率 = 通電数 / 架電数
        rate = dials > 0 ? (connects / dials) * 100 : 0;
      } else if (metricKey === 'setRate') {
        // 設定率 = 設定数 / 通電数
        rate = connects > 0 ? (sets / connects) * 100 : 0;
      }

      rateMap[day][slot] = rate;
      hasData[day][slot] = true;
      sumRate += rate;
      cellCount += 1;
    });
  });

  const avgRate = cellCount > 0 ? sumRate / cellCount : 0;

  // 2. 平均との差の最大絶対値を計算（記録ありセルのみ対象）
  let maxAbsDiff = 0;
  TELEAPO_HEATMAP_DAYS.forEach(day => {
    TELEAPO_HEATMAP_SLOTS.forEach(slot => {
      if (!hasData[day][slot]) return;
      const diff = rateMap[day][slot] - avgRate;
      const abs = Math.abs(diff);
      if (abs > maxAbsDiff) maxAbsDiff = abs;
    });
  });
  if (maxAbsDiff === 0) maxAbsDiff = 1; // 全セル同じレートのときのゼロ除算防止

  // 3. テーブル描画
  tbody.innerHTML = '';

  TELEAPO_HEATMAP_SLOTS.forEach(slot => {
    const tr = document.createElement('tr');

    const th = document.createElement('th');
    th.textContent = `${slot}時`;
    th.className = 'px-3 py-2 border border-slate-200 text-left bg-slate-50';
    tr.appendChild(th);

    TELEAPO_HEATMAP_DAYS.forEach(day => {
      const td = document.createElement('td');
      td.className = 'px-1 py-1 border border-slate-200 text-center';

      const rate = rateMap[day][slot];
      const has = hasData[day][slot];

      const cell = document.createElement('div');
      cell.className = 'kpi-v2-heatmap-cell';

      if (!has) {
        // ★ 記録なし：ハイフン＋ほぼ無色
        cell.textContent = '-';
        cell.style.backgroundColor = 'rgba(248, 250, 252, 1)'; // #f8fafc（ごく薄いグレー）
      } else {
        const diff = rate - avgRate;                      // 平均との差（pt）
        const t = Math.min(1, Math.abs(diff) / maxAbsDiff);  // 0〜1 正規化

        cell.dataset.count = rate.toFixed(1);
        cell.textContent = `${rate.toFixed(0)}%`;

        let bgColor;
        if (Math.abs(diff) < 1) {
          // 平均±1pt以内 → ニュートラル
          bgColor = 'rgba(248, 250, 252, 1)';
        } else if (diff > 0) {
          // 平均より高い → 青系 (#2563eb)
          const alpha = 0.2 + 0.6 * t; // 0.2〜0.8
          bgColor = `rgba(37, 99, 235, ${alpha.toFixed(2)})`;
        } else {
          // 平均より低い → 赤系 (#ef4444)
          const alpha = 0.2 + 0.6 * t;
          bgColor = `rgba(239, 68, 68, ${alpha.toFixed(2)})`;
        }

        cell.style.backgroundColor = bgColor;
      }

      td.appendChild(cell);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}



//（必要なら）セルクリック用の関数もそのまま再利用
function handleTeleapoHeatmapCellClick(day, slot) {
  if (teleapoHeatmapSelection &&
    teleapoHeatmapSelection.day === day &&
    teleapoHeatmapSelection.slot === slot) {
    teleapoHeatmapSelection = null;
  } else {
    teleapoHeatmapSelection = { day, slot };
  }
  renderTeleapoHeatmap();
  updateTeleapoHeatmapSelectionLabel();
  filterTeleapoLogRows();
}

function updateTeleapoHeatmapSelectionLabel() {
  const labelEl = document.getElementById('teleapoHeatmapSelectionLabel');
  if (!labelEl) return;
  if (!teleapoHeatmapSelection) {
    labelEl.textContent = '※セルをクリックすると、その曜日・時間帯のログだけを下のテーブルに表示します（もう一度クリックで解除）。';
  } else {
    labelEl.textContent = `選択中：${teleapoHeatmapSelection.day}曜 ${teleapoHeatmapSelection.slot}時 のログを表示中`;
  }
}

let teleapoEmployeeSortInitialized = false;

function initializeTeleapoEmployeeSortControls() {
  const sortSelect = document.getElementById('teleapoEmployeeSortSelect');
  if (!sortSelect) return;

  // 初期値は着座率（高い順）
  sortSelect.value = 'showRate-desc';

  sortSelect.onchange = (event) => {
    const sortKey = event.target.value; // 例: 'connectRate-desc'
    sortTeleapoEmployees(sortKey);
  };
}

// 新規架電ログ入力フォームの初期化
function initializeTeleapoLogInputForm() {
  const addBtn = document.getElementById('teleapoLogInputAddBtn');
  if (!addBtn) {
    console.warn('teleapoLogInputAddBtn が見つかりません（入力フォームのHTMLが未追加かもしれません）');
    return;
  }

  addBtn.addEventListener('click', () => {
    const dtInput = document.getElementById('teleapoLogInputDatetime');
    const empInput = document.getElementById('teleapoLogInputEmployee');
    const resInput = document.getElementById('teleapoLogInputResult');
    const targetInput = document.getElementById('teleapoLogInputTarget');
    const telInput = document.getElementById('teleapoLogInputTel');
    const emailInput = document.getElementById('teleapoLogInputEmail');
    const memoInput = document.getElementById('teleapoLogInputMemo');

    const dtValue = dtInput?.value || '';
    const employee = empInput?.value || '';
    const result = resInput?.value || '';
    const target = targetInput?.value || '';
    const tel = telInput?.value || '';
    const email = emailInput?.value || '';
    const memo = memoInput?.value || '';

    // 必須項目チェック
    if (!dtValue || !employee || !result) {
      alert('日時・担当者・アポ結果は必須です。');
      return;
    }

    // datetime-local → "YYYY/MM/DD HH:MM" に変換
    const dt = new Date(dtValue);
    if (Number.isNaN(dt.getTime())) {
      alert('日時の形式が不正です。');
      return;
    }
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    const datetimeStr = `${y}/${m}/${d} ${hh}:${mm}`;

    // ここで teleapoLogData に追加（まだ導入していなければ、とりあえず配列がある前提）
    if (!Array.isArray(teleapoLogData)) {
      window.teleapoLogData = window.teleapoLogData || [];
    }
    teleapoLogData.push({
      datetime: datetimeStr,
      employee,
      target,
      tel,
      email,
      result,
      memo
    });

    // 追加後の再計算（handleTeleapoLogDataChanged を導入済みの場合）
    if (typeof handleTeleapoLogDataChanged === 'function') {
      handleTeleapoLogDataChanged();
    }

    // 入力欄の一部をクリア（必要に応じて調整）
    if (targetInput) targetInput.value = '';
    if (telInput) telInput.value = '';
    if (emailInput) emailInput.value = '';
    if (memoInput) memoInput.value = '';
  });
}

export function mount() {
  console.log('Teleapo page mounted');

  initializeTeleapoDatePickers();

  initializeTeleapoLogInputForm();
  initializeTeleapoLogFilters();

  initializeTeleapoLogDataFromTable();

  rebuildTeleapoAggregatesFromLogs();
  loadTeleapoCompanyKPIData();
  loadTeleapoEmployeeData();
  initializeTeleapoEmployeeSortControls();

  initializeTeleapoHeatmapControls();
  renderTeleapoHeatmap();

  renderTeleapoLogTable();
}




export function unmount() {
  console.log('Teleapo page unmounted');
  cleanupTeleapoEventListeners();
}

// ======== 日付・期間指定 ========
function initializeTeleapoDatePickers() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const firstOfMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstOfMonthStr = firstOfMonthDate.toISOString().split('T')[0];

  const companyStart = document.getElementById('teleapoCompanyRangeStart');
  const companyEnd = document.getElementById('teleapoCompanyRangeEnd');
  const logStart = document.getElementById('teleapoLogRangeStart');
  const logEnd = document.getElementById('teleapoLogRangeEnd');

  // 初期値：当月1日〜今日
  [companyStart, logStart].forEach(el => el && (el.value = firstOfMonthStr));
  [companyEnd, logEnd].forEach(el => el && (el.value = todayStr));

  teleapoGlobalStartDate = firstOfMonthStr;
  teleapoGlobalEndDate = todayStr;

  [companyStart, companyEnd, logStart, logEnd].forEach(el => {
    if (el) el.addEventListener('change', handleTeleapoDateRangeChange);
  });

  // プリセットボタン
  const presetButtons = document.querySelectorAll('.kpi-v2-range-presets .kpi-v2-range-btn');
  presetButtons.forEach(btn => btn.addEventListener('click', handleTeleapoPresetClick));

  updateTeleapoPeriodLabels();
}

// 「今日/今週/今月」プリセットの選択状態をクリア
function clearTeleapoPresetButtonsActive() {
  const presetButtons = document.querySelectorAll('.kpi-v2-range-presets .kpi-v2-range-btn');
  presetButtons.forEach(btn => {
    btn.classList.remove('kpi-v2-range-btn-active');
  });
}

function handleTeleapoPresetClick(event) {
  const btn = event.currentTarget;
  const preset = btn.dataset.preset; // 'today' | 'thisWeek' | 'thisMonth'
  if (!preset) return;

  // ボタングループ内のアクティブ切り替え
  const group = btn.closest('.kpi-v2-range-presets');
  if (group) {
    group.querySelectorAll('.kpi-v2-range-btn').forEach(b => b.classList.remove('kpi-v2-range-btn-active'));
    btn.classList.add('kpi-v2-range-btn-active');
  }

  const { startStr, endStr } = getDateRangeByPreset(preset);
  if (!startStr || !endStr) return;

  const companyStart = document.getElementById('teleapoCompanyRangeStart');
  const companyEnd = document.getElementById('teleapoCompanyRangeEnd');
  const logStart = document.getElementById('teleapoLogRangeStart');
  const logEnd = document.getElementById('teleapoLogRangeEnd');

  if (companyStart) companyStart.value = startStr;
  if (companyEnd) companyEnd.value = endStr;
  if (logStart) logStart.value = startStr;
  if (logEnd) logEnd.value = endStr;

  teleapoGlobalStartDate = startStr;
  teleapoGlobalEndDate = endStr;

  updateTeleapoPeriodLabels();
  loadTeleapoData();
  filterTeleapoLogRows();
}

function getDateRangeByPreset(preset) {
  const today = new Date();
  let startDate = new Date(today);
  let endDate = new Date(today);

  if (preset === 'today') {
    // そのまま
  } else if (preset === 'thisWeek') {
    const day = today.getDay(); // 0:日〜6:土
    const diffToMonday = (day + 6) % 7;
    startDate = new Date(today);
    startDate.setDate(today.getDate() - diffToMonday);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
  } else if (preset === 'thisMonth') {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  }

  const toStr = d => d.toISOString().split('T')[0];
  return { startStr: toStr(startDate), endStr: toStr(endDate) };
}
function handleTeleapoDateRangeChange(event) {
  const id = event.target.id || '';

  const companyStart = document.getElementById('teleapoCompanyRangeStart');
  const companyEnd = document.getElementById('teleapoCompanyRangeEnd');
  const logStart = document.getElementById('teleapoLogRangeStart');
  const logEnd = document.getElementById('teleapoLogRangeEnd');

  if (id === 'teleapoCompanyRangeStart' || id === 'teleapoCompanyRangeEnd') {
    const startStr = companyStart?.value || '';
    const endStr = companyEnd?.value || '';
    if (logStart && startStr) logStart.value = startStr;
    if (logEnd && endStr) logEnd.value = endStr;
    teleapoGlobalStartDate = startStr || null;
    teleapoGlobalEndDate = endStr || null;
  }

  if (id === 'teleapoLogRangeStart' || id === 'teleapoLogRangeEnd') {
    const startStr = logStart?.value || '';
    const endStr = logEnd?.value || '';
    if (companyStart && startStr) companyStart.value = startStr;
    if (companyEnd && endStr) companyEnd.value = endStr;
    teleapoGlobalStartDate = startStr || null;
    teleapoGlobalEndDate = endStr || null;
  }

  // ★ 日付が手動で変えられたので、プリセットの active は解除する
  clearTeleapoPresetButtonsActive();

  updateTeleapoPeriodLabels();
  loadTeleapoData();
  filterTeleapoLogRows();
}

function updateTeleapoPeriodLabels() {
  const companyStart = document.getElementById('teleapoCompanyRangeStart')?.value;
  const companyEnd = document.getElementById('teleapoCompanyRangeEnd')?.value;
  const label = document.getElementById('teleapoCompanyPeriodLabel');

  if (label && companyStart && companyEnd) {
    label.textContent = `選択期間：${companyStart.replace(/-/g, '/')} 〜 ${companyEnd.replace(/-/g, '/')}`;
  }

  // ★ ヒートマップ用ラベルも更新
  updateTeleapoHeatmapPeriodLabel();
}

// ヒートマップ対象期間ラベル更新
// ★ ヒートマップは常に「過去1ヶ月固定」として扱う
function updateTeleapoHeatmapPeriodLabel() {
  const label = document.getElementById('teleapoHeatmapPeriodLabel');
  if (!label) return;

  // 好きな文言に変更可能
  label.textContent = '過去1ヶ月間の曜日・時間帯分析表';
}



function getTeleapoRangeDays() {
  if (!teleapoGlobalStartDate || !teleapoGlobalEndDate) return 30;
  const start = new Date(teleapoGlobalStartDate + 'T00:00:00');
  const end = new Date(teleapoGlobalEndDate + 'T23:59:59');
  const diffMs = end - start;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(days, 1);
}

// ======== データ読み込み（モック） ========
// Teleapo データ全体の読み込み
// Teleapo データ全体の読み込み（必ずログまで到達するようにする）
function loadTeleapoData() {
  console.log('loadTeleapoData: start');

  try {
    if (typeof loadTeleapoPersonalKPIData === 'function') {
      loadFileTimePersonalKPI();
    }
  } catch (e) {
    console.error('loadTeleapoPersonalKPIData でエラー:', e);
  }

  try {
    if (typeof loadTeleapoCompanyKPIData === 'function') {
      loadTeleapoCompanyKPIDisplayFromEmployees?.();
      // もし上の関数を使っていない場合は、元の loadTeleapoCompanyKPIData を呼んでもOKです
      loadTeleapoCompanyKPIData();
    }
  } catch (e) {
    console.error('loadTeleapoCompanyKPIData でエラー:', e);
  }

  try {
    if (typeof loadTeleapoEmployeeData === 'function') {
      loadTeleapoEmployeeData();
    }
  } catch (e) {
    console.error('loadTeleapoEmployeeData でエラー:', e);
  }

  // ---- ここが一番大事：ログを必ず描画する ----
  try {
    if (typeof loadTeleapoLogData === 'function') {
      loadTeleapoLogData();
    } else {
      console.warn('loadTeleapoData: loadTeleapoLogData が見つかりません');
    }
  } catch (e) {
    console.error('loadTeleapoLogData でエラー:', e);
  }

  try {
    if (typeof loadTeleapoHeatmapData === 'function') {
      loadTeleapoHeatmapData();
    }
  } catch (e) {
    console.error('loadTeleapoHeatmapData でエラー:', e);
  }

  console.log('loadTeleapoData: end');
}



// 全体KPI（期間に応じてスケール）
async function loadTeleapoCompanyKPIData() {
  if (!teleapoCompanyDailyData.length) {
    console.warn('teleapoCompanyDailyData is empty');
    return;
  }

  const start = teleapoGlobalStartDate
    ? new Date(teleapoGlobalStartDate + 'T00:00:00')
    : new Date(teleapoCompanyDailyData[0].date + 'T00:00:00');
  const end = teleapoGlobalEndDate
    ? new Date(teleapoGlobalEndDate + 'T23:59:59')
    : new Date(teleapoCompanyDailyData[teleapoCompanyDailyData.length - 1].date + 'T23:59:59');

  let dialsSum = 0;
  let connectsSum = 0;
  let setsSum = 0;
  let showsSum = 0;

  teleapoCompanyDailyData.forEach(row => {
    const d = new Date(row.date + 'T12:00:00');
    if (d < start || d > end) return;
    dialsSum += row.dials;
    connectsSum += row.connects;
    setsSum += row.sets;
    showsSum += row.shows;
  });

  if (dialsSum === 0) {
    // データがない期間（週末だけ選んだ、とか）の保険
    teleapoCompanyKPIData = {
      dials: 0,
      connects: 0,
      sets: 0,
      shows: 0,
      connectRate: 0,
      setRate: 0,
      showRate: 0
    };
  } else {
    teleapoCompanyKPIData = {
      dials: dialsSum,
      connects: connectsSum,
      sets: setsSum,
      shows: showsSum,
      connectRate: (connectsSum / dialsSum) * 100,
      setRate: connectsSum > 0 ? (setsSum / connectsSum) * 100 : 0,
      showRate: setsSum > 0 ? (showsSum / setsSum) * 100 : 0
    };
  }

  // スコープに応じて上部カード更新
  if (teleapoSummaryScope.type === 'company') {
    updateTeleapoSummaryRateCards(teleapoCompanyKPIData, null);
  }
}


// 社員成績（期間に応じてスケール）
async function loadTeleapoEmployeeData() {
  const start = teleapoGlobalStartDate
    ? new Date(teleapoGlobalStartDate + 'T00:00:00')
    : null;
  const end = teleapoGlobalEndDate
    ? new Date(teleapoGlobalEndDate + 'T23:59:59')
    : null;

  const employeeData = teleapoEmployees.map(name => {
    const daily = teleapoEmployeeDailyData[name] || [];
    let dialsSum = 0;
    let connectsSum = 0;
    let setsSum = 0;
    let showsSum = 0;

    daily.forEach(row => {
      const d = new Date(row.date + 'T12:00:00');
      if (start && d < start) return;
      if (end && d > end) return;
      dialsSum += row.dials;
      connectsSum += row.connects;
      setsSum += row.sets;
      showsSum += row.shows;
    });

    const connectRate = dialsSum > 0 ? (connectsSum / dialsSum) * 100 : 0;
    const setRate = connectsSum > 0 ? (setsSum / connectsSum) * 100 : 0;
    const showRate = setsSum > 0 ? (showsSum / setsSum) * 100 : 0;

    return {
      name,
      dials: dialsSum,
      connects: connectsSum,
      sets: setsSum,
      shows: showsSum,
      connectRate,
      setRate,
      showRate
    };
  });

  teleapoEmployeeData = employeeData;

  // ★ 初期表示は「着座率（高い順）」で並び替え＆表示
  sortTeleapoEmployees('showRate-desc');

  // ★ テーブルができた後で、ソートセレクトにイベントをつける
  initializeTeleapoEmployeeSortControls();

  // ★ 社員スコープだった場合の処理（既存のものをそのまま下に残す）
  if (teleapoSummaryScope.type === 'employee') {
    const currentName = teleapoSummaryScope.name;
    const emp = teleapoEmployeeData.find(e => e.name === currentName);
    if (emp) {
      updateTeleapoSummaryRateCards(emp, currentName);
      filterTeleapoEmployeeTable(currentName);
      renderTeleapoEmployeeTrendChart(emp, currentName);
      const chartWrapper = document.getElementById('teleapoEmployeeChartWrapper');
      if (chartWrapper) chartWrapper.classList.remove('hidden');
    }
  }
  teleapoEmployeeData = employeeData;

  // ▼ ここで全体KPIも社員データから再計算しておく（スコープが company の場合のみ画面反映）
  recalcTeleapoCompanyKPIFromEmployees();

  // ★ 初期表示は「着座率（高い順）」で並び替え＆表示
  sortTeleapoEmployees('showRate-desc');

  // ★ テーブルができた後で、ソートセレクトにイベントをつける
  initializeTeleapoEmployeeSortControls();

  // ★ 社員スコープだった場合の処理（既存のものをそのまま下に残す）
  if (teleapoSummaryScope.type === 'employee') {
    const currentName = teleapoSummaryScope.name;
    const emp = teleapoEmployeeData.find(e => e.name === currentName);
    if (emp) {
      updateTeleapoSummaryRateCards(emp, currentName);
      filterTeleapoEmployeeTable(currentName);
      renderTeleapoEmployeeTrendChart(emp, currentName);
      const chartWrapper = document.getElementById('teleapoEmployeeChartWrapper');
      if (chartWrapper) chartWrapper.classList.remove('hidden');
    }
  }

}


// 社員テーブル表示
function updateTeleapoEmployeeDisplay(data) {
  const tbody = document.getElementById('teleapoEmployeeTableBody');
  if (!tbody) return;

  tbody.innerHTML = data
    .map(
      emp => `
    <tr class="teleapo-employee-row hover:bg-slate-50 cursor-pointer" data-employee-name="${emp.name}">
      <td class="font-medium text-slate-800">${emp.name}</td>
      <td class="text-right">${emp.dials}</td>
      <td class="text-right">${emp.connects}</td>
      <td class="text-right">${emp.sets}</td>
      <td class="text-right font-semibold text-green-700">${emp.shows}</td>
      <td class="text-right">${emp.connectRate.toFixed(1)}%</td>
      <td class="text-right">${emp.setRate.toFixed(1)}%</td>
      <td class="text-right">${emp.showRate.toFixed(1)}%</td>
    </tr>
  `
    )
    .join('');

  attachTeleapoEmployeeRowHandlers();
}

function sortTeleapoEmployees(sortValue = 'showRate-desc') {
  if (!teleapoEmployeeData || !teleapoEmployeeData.length) return;

  const [key, dirStr] = sortValue.split('-'); // 例: 'connectRate-desc'
  const dir = dirStr === 'asc' ? 1 : -1;

  // ★ 元データからコピーしてソート（安全のため）
  const sorted = [...teleapoEmployeeData].sort((a, b) => {
    if (key === 'name') {
      return dir * a.name.localeCompare(b.name, 'ja');
    }
    const av = a[key] ?? 0;
    const bv = b[key] ?? 0;
    return dir * (av - bv);
  });

  // ★ ソート済みデータでテーブルを再描画
  updateTeleapoEmployeeDisplay(sorted);

  // セレクトの表示を現在のソートに合わせる
  const sortSelect = document.getElementById('teleapoEmployeeSortSelect');
  if (sortSelect) {
    sortSelect.value = sortValue;
  }
}

function attachTeleapoEmployeeRowHandlers() {
  const rows = document.querySelectorAll('.teleapo-employee-row');
  const chartWrapper = document.getElementById('teleapoEmployeeChartWrapper');

  rows.forEach(row => {
    const name = row.dataset.employeeName;
    if (!name) return;

    row.onclick = () => {
      const isSameSelected =
        teleapoSummaryScope.type === 'employee' &&
        teleapoSummaryScope.name === name;

      // すでに同じ社員が選択されている場合 → 全体表示に戻す
      if (isSameSelected) {
        teleapoSummaryScope = { type: 'company', name: '全体' };

        // アクティブ行のハイライト解除
        document.querySelectorAll('.teleapo-employee-row-active').forEach(r =>
          r.classList.remove('teleapo-employee-row-active')
        );

        // 社員テーブルを全員表示に戻す
        filterTeleapoEmployeeTable(null);

        // 全体KPIを再表示
        if (teleapoCompanyKPIData) {
          updateTeleapoSummaryRateCards(teleapoCompanyKPIData, null);
        } else {
          // 念のため（初回など）集計がなければ再計算
          loadTeleapoCompanyKPIData();
        }

        // 個人グラフを非表示
        if (chartWrapper) chartWrapper.classList.add('hidden');

        return;
      }

      // 新しく社員を選択する場合
      const emp = teleapoEmployeeData.find(e => e.name === name);
      if (!emp) return;

      // アクティブ行の付け替え
      document.querySelectorAll('.teleapo-employee-row-active').forEach(r =>
        r.classList.remove('teleapo-employee-row-active')
      );
      row.classList.add('teleapo-employee-row-active');

      // スコープを社員に切り替え
      teleapoSummaryScope = { type: 'employee', name };
      updateTeleapoSummaryRateCards(emp, name);
      filterTeleapoEmployeeTable(name);
      renderTeleapoEmployeeTrendChart(emp, name);
      if (chartWrapper) chartWrapper.classList.remove('hidden');

      // AI分析（オプション）
      if (TELEAPO_AI_ANALYSIS_ENABLED && typeof requestTeleapoEmployeeAnalysis === 'function') {
        requestTeleapoEmployeeAnalysis(emp, name);
      }
    };
  });

  // 「全体に戻す」ボタン
  const resetBtn = document.getElementById('teleapoSummaryResetBtn');
  if (resetBtn) {
    resetBtn.onclick = () => {
      teleapoSummaryScope = { type: 'company', name: '全体' };

      document.querySelectorAll('.teleapo-employee-row-active').forEach(r =>
        r.classList.remove('teleapo-employee-row-active')
      );

      filterTeleapoEmployeeTable(null);

      if (teleapoCompanyKPIData) {
        updateTeleapoSummaryRateCards(teleapoCompanyKPIData, null);
      } else {
        loadTeleapoCompanyKPIData();
      }

      const chartWrapper = document.getElementById('teleapoEmployeeChartWrapper');
      if (chartWrapper) chartWrapper.classList.add('hidden');
    };
  }
}

async function requestTeleapoEmployeeAnalysis(emp, name) {
  const statusEl = document.getElementById('teleapoEmployeeAnalysisStatus');
  const textEl = document.getElementById('teleapoEmployeeAnalysisText');
  if (!statusEl || !textEl) return;

  statusEl.textContent = 'AI分析中...';
  textEl.textContent = '';

  try {
    const payload = {
      employeeName: name,
      period: {
        start: teleapoGlobalStartDate,
        end: teleapoGlobalEndDate
      },
      kpiSummary: {
        dials: emp.dials,
        connects: emp.connects,
        sets: emp.sets,
        shows: emp.shows,
        connectRate: emp.connectRate,
        setRate: emp.setRate,
        showRate: emp.showRate
      }
    };

    const res = await fetch('/api/teleapo/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error('AI analysis API error: ' + res.status);
    }

    const data = await res.json();
    textEl.textContent = data.analysisText || '分析結果を取得できませんでした。';
    statusEl.textContent = '最新の分析結果';
  } catch (err) {
    console.error('AI analysis failed:', err);
    statusEl.textContent = '分析エラー';
    textEl.textContent = 'AI分析の取得に失敗しました（バックエンド未実装の可能性があります）。';
  }
}


function filterTeleapoEmployeeTable(targetName) {
  const rows = document.querySelectorAll('.teleapo-employee-row');
  rows.forEach(row => {
    const name = row.dataset.employeeName;
    if (!targetName) {
      row.style.display = '';
    } else {
      row.style.display = name === targetName ? '' : 'none';
    }
  });
}

// 上部サマリーカード更新（全体 or 社員）
function updateTeleapoSummaryRateCards(data, employeeName = null) {
  const titleEl = document.getElementById('teleapoSummaryTitle');
  const scopeLabelEl = document.getElementById('teleapoSummaryScopeLabel');

  const connectEl = document.getElementById('teleapoSummaryConnectRate');
  const setEl = document.getElementById('teleapoSummarySetRate');
  const showEl = document.getElementById('teleapoSummaryShowRate');

  const connectMetaEl = document.getElementById('teleapoSummaryConnectMeta');
  const setMetaEl = document.getElementById('teleapoSummarySetMeta');
  const showMetaEl = document.getElementById('teleapoSummaryShowMeta');

  const dialsEl = document.getElementById('teleapoSummaryDials');
  const connectsEl = document.getElementById('teleapoSummaryConnects');
  const setsEl = document.getElementById('teleapoSummarySets');
  const showsEl = document.getElementById('teleapoSummaryShows');

  if (!connectEl || !setEl || !showEl) return;

  const isCompany = !employeeName;
  const rangeLabel = getTeleapoSelectedRangeLabel();

  // タイトル（期間入り）
  if (titleEl) {
    if (rangeLabel) {
      titleEl.textContent = isCompany
        ? `${rangeLabel} の全体KPI（率）`
        : `${rangeLabel} の${employeeName}さんのKPI（率）`;
    } else {
      titleEl.textContent = isCompany
        ? '全体KPI（率）'
        : `${employeeName}さんのKPI（率）`;
    }
  }

  // スコープラベル（全体 or 社員名）
  if (scopeLabelEl) {
    scopeLabelEl.textContent = isCompany ? '全体' : employeeName;
  }

  // 率
  const connectText = data.connectRate.toFixed(1) + '%';
  const setText = data.setRate.toFixed(1) + '%';
  const showText = data.showRate.toFixed(1) + '%';

  connectEl.textContent = connectText;
  setEl.textContent = setText;
  showEl.textContent = showText;

  // メタ
  const metaText = isCompany ? '選択期間・全社員' : '選択期間・個人';
  if (connectMetaEl) connectMetaEl.textContent = metaText;
  if (setMetaEl) setMetaEl.textContent = metaText;
  if (showMetaEl) showMetaEl.textContent = metaText;

  // 件数
  const fmt = v => (typeof v === 'number' ? v.toLocaleString() : v ?? '-');

  if (dialsEl) dialsEl.textContent = fmt(data.dials);
  if (connectsEl) connectsEl.textContent = fmt(data.connects);
  if (setsEl) setsEl.textContent = fmt(data.sets);
  if (showsEl) showsEl.textContent = fmt(data.shows);
}
// 社員別 時系列グラフ（期間に応じて X 軸粒度を切り替え）
function renderTeleapoEmployeeTrendChart(emp, name) {
  const svg = document.getElementById('teleapoEmployeeTrendChart');
  const titleEl = document.getElementById('teleapoEmployeeChartTitle');
  if (!svg) return;

  // タイトル（期間入り）
  const rangeLabel = getTeleapoSelectedRangeLabel();
  if (titleEl) {
    if (rangeLabel) {
      titleEl.textContent = `${rangeLabel} の ${name} さんのKPI（通電率・設定率・着座率）`;
    } else {
      titleEl.textContent = `${name} さんのKPI（通電率・設定率・着座率）`;
    }
  }

  // 1. 日別データを取得して期間内に絞る
  const dailyAll = teleapoEmployeeDailyData[name] || [];

  let startDate = teleapoGlobalStartDate
    ? new Date(teleapoGlobalStartDate + 'T00:00:00')
    : null;
  let endDate = teleapoGlobalEndDate
    ? new Date(teleapoGlobalEndDate + 'T23:59:59')
    : null;

  if (!startDate && dailyAll.length) {
    startDate = new Date(dailyAll[0].date + 'T00:00:00');
  }
  if (!endDate && dailyAll.length) {
    endDate = new Date(dailyAll[dailyAll.length - 1].date + 'T23:59:59');
  }

  const daily = dailyAll.filter(row => {
    const d = new Date(row.date + 'T12:00:00');
    return (!startDate || d >= startDate) && (!endDate || d <= endDate);
  });

  if (!daily.length) {
    // データがない場合は全期間の平均レートをフラットに表示
    const flatPoints = Array.from({ length: 5 }).map((_, i) => ({
      label: `${i + 1}`,
      connectRate: emp.connectRate || 0,
      setRate: emp.setRate || 0,
      showRate: emp.showRate || 0
    }));
    drawTeleapoEmployeeRateLines(svg, flatPoints);
    return;
  }

  // 2. 期間の長さ（日数）を算出
  const startMid = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );
  const endMid = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );
  const oneDayMs = 24 * 60 * 60 * 1000;
  const inclusiveDays = Math.floor((endMid - startMid) / oneDayMs) + 1;

  let points = [];

  // 3. 粒度ごとに points を生成
  if (inclusiveDays <= 1) {
    // === 1日 → 時間帯（〜時）
    const bucket = { dials: 0, connects: 0, sets: 0, shows: 0 };
    daily.forEach(row => {
      bucket.dials += row.dials;
      bucket.connects += row.connects;
      bucket.sets += row.sets;
      bucket.shows += row.shows;
    });
    const connectRate = bucket.dials > 0 ? (bucket.connects / bucket.dials) * 100 : 0;
    const setRate = bucket.connects > 0 ? (bucket.sets / bucket.connects) * 100 : 0;
    const showRate = bucket.sets > 0 ? (bucket.shows / bucket.sets) * 100 : 0;

    const hourLabels = ['9時', '11時', '13時', '15時', '17時'];
    points = hourLabels.map(label => ({
      label,
      connectRate,
      setRate,
      showRate
    }));
  } else if (inclusiveDays <= 7) {
    // === 〜7日 → 曜日（〜曜）
    const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

    const sorted = [...daily].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    points = sorted.map(row => {
      const d = new Date(row.date + 'T00:00:00');
      const label = DAY_LABELS[d.getDay()] + '曜';
      const connectRate = row.dials > 0 ? (row.connects / row.dials) * 100 : 0;
      const setRate = row.connects > 0 ? (row.sets / row.connects) * 100 : 0;
      const showRate = row.sets > 0 ? (row.shows / row.sets) * 100 : 0;
      return { label, connectRate, setRate, showRate };
    });
  } else if (inclusiveDays <= 31) {
    // === 〜31日 → 週ごとの推移（1〜5週目）
    const firstDate = new Date(daily[0].date + 'T00:00:00');
    const lastDate = new Date(daily[daily.length - 1].date + 'T23:59:59');
    const diffMs = lastDate - firstDate;
    const totalDays = Math.max(1, Math.floor(diffMs / oneDayMs) + 1);
    const numWeeks = 5;
    const segmentSize = Math.max(1, Math.ceil(totalDays / numWeeks));

    const weekBuckets = Array.from({ length: numWeeks }).map(() => ({
      dials: 0,
      connects: 0,
      sets: 0,
      shows: 0
    }));

    daily.forEach(row => {
      const d = new Date(row.date + 'T00:00:00');
      const offsetDays = Math.floor((d - firstDate) / oneDayMs);
      const idx = Math.min(numWeeks - 1, Math.floor(offsetDays / segmentSize));
      weekBuckets[idx].dials += row.dials;
      weekBuckets[idx].connects += row.connects;
      weekBuckets[idx].sets += row.sets;
      weekBuckets[idx].shows += row.shows;
    });

    points = weekBuckets.map((w, i) => {
      const connectRate = w.dials > 0 ? (w.connects / w.dials) * 100 : 0;
      const setRate = w.connects > 0 ? (w.sets / w.connects) * 100 : 0;
      const showRate = w.sets > 0 ? (w.shows / w.sets) * 100 : 0;
      return {
        label: `${i + 1}週目`,
        connectRate,
        setRate,
        showRate
      };
    });
  } else {
    // === 31日超 → 月単位（YYYY/MM）
    const monthBuckets = {};

    daily.forEach(row => {
      const d = new Date(row.date + 'T00:00:00');
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${y}-${String(m).padStart(2, '0')}`;
      if (!monthBuckets[key]) {
        monthBuckets[key] = { dials: 0, connects: 0, sets: 0, shows: 0 };
      }
      monthBuckets[key].dials += row.dials;
      monthBuckets[key].connects += row.connects;
      monthBuckets[key].sets += row.sets;
      monthBuckets[key].shows += row.shows;
    });

    const sortedKeys = Object.keys(monthBuckets).sort();

    points = sortedKeys.map(key => {
      const w = monthBuckets[key];
      const connectRate = w.dials > 0 ? (w.connects / w.dials) * 100 : 0;
      const setRate = w.connects > 0 ? (w.sets / w.connects) * 100 : 0;
      const showRate = w.sets > 0 ? (w.shows / w.sets) * 100 : 0;

      const [y, m] = key.split('-');
      const label = `${y}/${m}`;

      return {
        label,
        connectRate,
        setRate,
        showRate
      };
    });
  }

  drawTeleapoEmployeeRateLines(svg, points);
}


// 週次の通電率・設定率・着座率の3本線を描画（points: {label, connectRate, setRate, showRate}[])
function drawTeleapoEmployeeRateLines(svg, points) {
  if (!svg) return;

  // 最大値をざっくり決める（0〜100%が基本）
  let maxRate = 0;
  points.forEach(p => {
    maxRate = Math.max(maxRate, p.connectRate || 0, p.setRate || 0, p.showRate || 0);
  });
  maxRate = Math.max(10, Math.ceil(maxRate / 10) * 10); // 10刻みで切り上げ

  const width = 800;
  const height = 260;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const usableWidth = width - paddingLeft - paddingRight;
  const usableHeight = height - paddingTop - paddingBottom;

  const n = points.length;
  const xStep = n > 1 ? usableWidth / (n - 1) : usableWidth;

  const toX = i => paddingLeft + xStep * i;
  const toY = v => paddingTop + usableHeight * (1 - v / maxRate);

  // 各線のパスを作成
  const connectPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.connectRate || 0)}`)
    .join(' ');
  const setPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.setRate || 0)}`)
    .join(' ');
  const showPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.showRate || 0)}`)
    .join(' ');

  svg.innerHTML = `
    <style>
      .teleapo-axis-label { font-size: 10px; fill: #6b7280; }
      .teleapo-line-connect { fill: none; stroke: #3b82f6; stroke-width: 2; } /* 青：通電率 */
      .teleapo-line-set     { fill: none; stroke: #f59e0b; stroke-width: 2; } /* オレンジ：設定率 */
      .teleapo-line-show    { fill: none; stroke: #10b981; stroke-width: 2; } /* 緑：着座率 */
      .teleapo-dot { stroke: #ffffff; stroke-width: 1.5; }
      .teleapo-grid { stroke: #e5e7eb; stroke-width: 1; }
    </style>
    <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
    ${[0, 0.25, 0.5, 0.75, 1].map(r => {
    const y = paddingTop + usableHeight * r;
    const val = Math.round(maxRate * (1 - r));
    return `
        <line class="teleapo-grid" x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" />
        <text class="teleapo-axis-label" x="${paddingLeft - 8}" y="${y + 3}" text-anchor="end">${val}%</text>
      `;
  }).join('')}
    <!-- 通電率 -->
    <path d="${connectPath}" class="teleapo-line-connect" />
    ${points.map((p, i) => `
      <circle class="teleapo-dot" cx="${toX(i)}" cy="${toY(p.connectRate || 0)}" r="4" fill="#3b82f6" />
    `).join('')}
    <!-- 設定率 -->
    <path d="${setPath}" class="teleapo-line-set" />
    ${points.map((p, i) => `
      <circle class="teleapo-dot" cx="${toX(i)}" cy="${toY(p.setRate || 0)}" r="4" fill="#f59e0b" />
    `).join('')}
    <!-- 着座率 -->
    <path d="${showPath}" class="teleapo-line-show" />
    ${points.map((p, i) => `
      <circle class="teleapo-dot" cx="${toX(i)}" cy="${toY(p.showRate || 0)}" r="4" fill="#10b981" />
    `).join('')}
    <!-- X軸ラベル -->
    ${points.map((p, i) => `
      <text class="teleapo-axis-label" x="${toX(i)}" y="${height - paddingBottom + 16}" text-anchor="middle">
        ${p.label}
      </text>
    `).join('')}
    <!-- 凡例 -->
    <rect x="${paddingLeft}" y="${paddingTop}" width="12" height="12" fill="#3b82f6" />
    <text x="${paddingLeft + 18}" y="${paddingTop + 10}" class="teleapo-axis-label">通電率</text>
    <rect x="${paddingLeft + 90}" y="${paddingTop}" width="12" height="12" fill="#f59e0b" />
    <text x="${paddingLeft + 108}" y="${paddingTop + 10}" class="teleapo-axis-label">設定率</text>
    <rect x="${paddingLeft + 180}" y="${paddingTop}" width="12" height="12" fill="#10b981" />
    <text x="${paddingLeft + 198}" y="${paddingTop + 10}" class="teleapo-axis-label">着座率</text>
  `;
}


// ======== ヒートマップ ========



function teleapoSlotDisplay(slot) {
  switch (slot) {
    case '09-11': return '09-11時';
    case '11-13': return '11-13時';
    case '13-15': return '13-15時';
    case '15-17': return '15-17時';
    case '17-19': return '17-19時';
    default: return slot;
  }
}


// ======== 架電ログ（フィルタ＋件数） ========
function initializeTeleapoLogFilters() {
  const empFilter = document.getElementById('teleapoLogEmployeeFilter');
  const resultFilter = document.getElementById('teleapoLogResultFilter');
  const targetSearch = document.getElementById('teleapoLogTargetSearch');
  const resetBtn = document.getElementById('teleapoLogFilterReset');

  if (empFilter) empFilter.addEventListener('change', filterTeleapoLogRows);
  if (resultFilter) resultFilter.addEventListener('change', filterTeleapoLogRows);
  if (targetSearch) targetSearch.addEventListener('input', filterTeleapoLogRows);
  if (resetBtn) resetBtn.addEventListener('click', () => {
    if (empFilter) empFilter.value = '';
    if (resultFilter) resultFilter.value = '';
    if (targetSearch) targetSearch.value = '';
    filterTeleapoLogRows();
  });

  const sortable = document.querySelectorAll('#teleapoLogTable .sortable');
  sortable.forEach(h => h.addEventListener('click', handleTeleapoLogSort));
}

// 架電ログデータの読み込み
// 架電ログデータの読み込み（期間内モックを生成）
// 架電ログデータの読み込み（まずは必ず表示されるモック）
// 架電ログデータの読み込み（まずはモックを必ず表示する）
// 架電ログデータの読み込み（モックを必ず表示）
async function loadTeleapoLogData() {
  const tbody = document.getElementById('teleapoLogTableBody');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('tr');
  updateTeleapoLogCount(rows.length);

  // 初期状態はフィルタなしで全件表示
  rows.forEach(row => row.style.display = '');
}



function updateTeleapoLogCount(count) {
  const el = document.getElementById('teleapoLogFilterCount');
  if (el) el.textContent = `${count}件`;
}

function handleTeleapoLogSort(event) {
  const header = event.currentTarget;
  const sortField = header.dataset.sort;
  const currentDir = header.dataset.direction || 'asc';
  const newDir = currentDir === 'asc' ? 'desc' : 'asc';

  document.querySelectorAll('#teleapoLogTable .sortable').forEach(h => {
    h.dataset.direction = '';
    const ind = h.querySelector('.ml-1');
    if (ind) ind.textContent = '↕';
  });

  header.dataset.direction = newDir;
  const indicator = header.querySelector('.ml-1');
  if (indicator) indicator.textContent = newDir === 'asc' ? '▲' : '▼';

  sortTeleapoLogTable(sortField, newDir);
}

function sortTeleapoLogTable(field, dir) {
  const tbody = document.getElementById('teleapoLogTableBody');
  const rows = Array.from(tbody.querySelectorAll('tr'));

  rows.sort((a, b) => {
    let av, bv;
    if (field === 'datetime') {
      av = a.children[0].textContent;
      bv = b.children[0].textContent;
    } else if (field === 'employee') {
      av = a.children[1].textContent;
      bv = b.children[1].textContent;
    } else if (field === 'target') {
      av = a.children[2].textContent;
      bv = b.children[2].textContent;
    } else if (field === 'result') {
      av = a.children[5].textContent;
      bv = b.children[5].textContent;
    } else {
      return 0;
    }
    const cmp = av.localeCompare(bv, 'ja');
    return dir === 'asc' ? cmp : -cmp;
  });

  tbody.innerHTML = '';
  rows.forEach(r => tbody.appendChild(r));
}

function applyTeleapoLogFilter() {
  filterTeleapoLogRows();
}

// シンプルなログフィルタ（担当者 / 結果 / 相手名 だけ見る）
function filterTeleapoLogRows() {
  const emp = document.getElementById('teleapoLogEmployeeFilter')?.value || '';
  const result = document.getElementById('teleapoLogResultFilter')?.value || '';
  const target = document.getElementById('teleapoLogTargetSearch')?.value || '';

  const rows = document.querySelectorAll('#teleapoLogTableBody tr');
  let visible = 0;

  rows.forEach(row => {
    let show = true;
    const cells = row.children;

    // 担当者
    const empName = cells[1] ? cells[1].textContent.trim() : '';
    if (emp && empName !== emp) {
      show = false;
    }

    // アポ結果（バッジ内テキスト）
    const resultText = cells[5] ? cells[5].textContent.trim() : '';
    if (result && !resultText.includes(result)) {
      show = false;
    }

    // 相手名に含まれるか
    const targetText = cells[2] ? cells[2].textContent.toLowerCase() : '';
    if (target && !targetText.includes(target.toLowerCase())) {
      show = false;
    }

    row.style.display = show ? '' : 'none';
    if (show) {
      visible += 1;
    }
  });

  updateTeleapoLogCount(visible);
}

// teleapoLogData からログテーブルを再描画する
function renderTeleapoLogTable() {
  const tbody = document.getElementById('teleapoLogTableBody');
  if (!tbody) return;

  tbody.innerHTML = teleapoLogData.map(row => `
    <tr>
      <td class="whitespace-nowrap">${row.datetime}</td>
      <td>${row.employee}</td>
      <td>${row.target}</td>
      <td>${row.tel}</td>
      <td>${row.email}</td>
      <td>
        <span class="px-2 py-1 rounded text-xs font-semibold ${row.result.includes('設定') ? 'bg-emerald-100 text-emerald-700'
      : row.result.includes('着座') ? 'bg-green-100 text-green-700'
        : row.result.includes('通電') ? 'bg-blue-100 text-blue-700'
          : row.result.includes('不在') ? 'bg-slate-100 text-slate-600'
            : row.result.includes('コールバック') ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-600'
    }">
          ${row.result}
        </span>
      </td>
      <td>${row.memo || ''}</td>
    </tr>
  `).join('');

  // 既存のフィルタ・件数表示を再適用
  filterTeleapoLogRows();
}


// アポ結果文字列から、通電/設定/着座フラグを判定
function classifyTeleapoResult(resultText) {
  const text = (resultText || '').trim();
  const isConnect = ['通電', '設定', '着座', 'コールバック'].some(word => text.includes(word));
  const isSet = ['設定', '着座'].some(word => text.includes(word));
  const isShow = ['着座'].some(word => text.includes(word));
  return { isConnect, isSet, isShow };
}

// 時間帯（時）→ スロット
function resolveTeleapoSlot(hour) {
  if (hour >= 9 && hour < 11) return '09-11';
  if (hour >= 11 && hour < 13) return '11-13';
  if (hour >= 13 && hour < 15) return '13-15';
  if (hour >= 15 && hour < 17) return '15-17';
  if (hour >= 17 && hour < 19) return '17-19';
  return null;
}


// ======== クリーンアップ ========
function cleanupTeleapoEventListeners() {
  const ids = [
    'teleapoCompanyRangeStart',
    'teleapoCompanyRangeEnd',
    'teleapoLogRangeStart',
    'teleapoLogRangeEnd',
    'teleapoHeatmapEmployeeFilter',
    'teleapoHeatmapMetricFilter',
    'teleapoLogEmployeeFilter',
    'teleapoLogResultFilter',
    'teleapoLogTargetSearch',
    'teleapoLogFilterReset',
    'teleapoSummaryResetBtn'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.parentNode) {
      const clone = el.cloneNode(true);
      el.parentNode.replaceChild(clone, el);
    }
  });
}
