// teleapo.js
console.log("🔥 teleapo.js 読み込み成功！");

// ===== 定数・グローバル状態 =====

const ROUTE_TEL = 'tel';
const ROUTE_OTHER = 'other';

// 社員の候補（UI用）
const TELEAPO_EMPLOYEES = ['佐藤', '田中', '山本', '鈴木'];

// ヒートマップ軸
const TELEAPO_HEATMAP_DAYS = ['月', '火', '水', '木', '金'];
const TELEAPO_HEATMAP_SLOTS = ['09-11', '11-13', '13-15', '15-17', '17-19'];
// ヒートマップの表示期間モード: '1w' | '1m' | '6m'
let teleapoHeatmapRange = '1m';  // デフォルト：過去1か月

// 表示スコープ（全体 or 社員）
let teleapoSummaryScope = {
  type: 'company',
  name: '全体'
};


// 選択期間（KPI・社員成績・ログフィルタに共通）
let teleapoGlobalStartDate = null;   // 'YYYY-MM-DD'
let teleapoGlobalEndDate = null;     // 'YYYY-MM-DD'

// 架電ログのソース・オブ・トゥルース
// { datetime, employee, route, target, tel, email, result, memo }
let teleapoLogData = [];

// 社員成績（期間フィルタ済み）のキャッシュ
let teleapoEmployeeMetrics = [];

// ヒートマップのセル選択状態
let teleapoHeatmapSelection = null;  // { day, slot } | null

// ===== 初期モックデータ（UI確認用：すべて電話ルート） =====

const teleapoInitialMockLogs = [
  {
    datetime: "2025/11/18 10:30",
    employee: "佐藤",
    route: ROUTE_TEL,
    target: "ABC社 田中様",
    tel: "03-1234-5678",
    email: "tanaka@abc-corp.co.jp",
    result: "設定",
    memo: "一次面談→11/25 15:00設定"
  },
  {
    datetime: "2025/11/18 11:45",
    employee: "田中",
    route: ROUTE_TEL,
    target: "XYZ社 鈴木様",
    tel: "03-9876-5432",
    email: "suzuki@xyz-inc.co.jp",
    result: "通電",
    memo: "一次日程打診中"
  },
  {
    datetime: "2025/11/18 13:20",
    employee: "山本",
    route: ROUTE_TEL,
    target: "DEF社 佐々木様",
    tel: "03-5555-1111",
    email: "sasaki@def-ltd.co.jp",
    result: "不在",
    memo: "再架電予定 11/19"
  },
  {
    datetime: "2025/11/18 14:15",
    employee: "鈴木",
    route: ROUTE_TEL,
    target: "GHI株式会社 高橋様",
    tel: "03-2222-9999",
    email: "takahashi@ghi-group.com",
    result: "着座",
    memo: "面談完了、次回フォローアップ予定"
  },
  {
    datetime: "2025/11/18 15:30",
    employee: "佐藤",
    route: ROUTE_TEL,
    target: "JKL商事 山田様",
    tel: "03-7777-3333",
    email: "yamada@jkl-trading.jp",
    result: "コールバック",
    memo: "16:00に折り返し予定"
  },
  {
    datetime: "2025/11/19 10:00",
    employee: "佐藤",
    route: ROUTE_TEL,
    target: "MNO社 斎藤様",
    tel: "03-1111-2222",
    email: "saito@mno.co.jp",
    result: "通電",
    memo: "ニーズヒアリング済み"
  },
  {
    datetime: "2025/11/19 11:30",
    employee: "田中",
    route: ROUTE_TEL,
    target: "PQR社 中村様",
    tel: "03-4444-5555",
    email: "nakamura@pqr.jp",
    result: "設定",
    memo: "一次面談 11/27 10:00"
  },
  {
    datetime: "2025/11/19 16:10",
    employee: "山本",
    route: ROUTE_TEL,
    target: "STU社 佐藤様",
    tel: "03-6666-7777",
    email: "sato@stu.com",
    result: "着座",
    memo: "オンライン面談完了"
  },
  {
    datetime: "2025/11/10 09:50",
    employee: "鈴木",
    route: ROUTE_TEL,
    target: "VWXホールディングス 小林様",
    tel: "03-8888-9999",
    email: "kobayashi@vwx-hd.jp",
    result: "通電",
    memo: "次回提案資料送付予定"
  },
  {
    datetime: "2025/10/30 17:20",
    employee: "佐藤",
    route: ROUTE_TEL,
    target: "YZA社 高田様",
    tel: "03-0000-1111",
    email: "takada@yza.co.jp",
    result: "不在",
    memo: "11/1 午前に再架電"
  },
  {
    datetime: "2025/11/18 10:30",
    employee: "佐藤",
    route: ROUTE_TEL,
    target: "ABC社 田中様",
    tel: "03-1234-5678",
    email: "tanaka@abc-corp.co.jp",
    result: "設定",
    memo: "一次面談→11/25 15:00設定"
  },
  {
    datetime: "2025/11/18 11:45",
    employee: "田中",
    route: ROUTE_TEL,
    target: "XYZ社 鈴木様",
    tel: "03-9876-5432",
    email: "suzuki@xyz-inc.co.jp",
    result: "通電",
    memo: "一次日程打診中"
  },
  {
    datetime: "2025/11/18 13:20",
    employee: "山本",
    route: ROUTE_TEL,
    target: "DEF社 佐々木様",
    tel: "03-5555-1111",
    email: "sasaki@def-ltd.co.jp",
    result: "不在",
    memo: "再架電予定 11/19"
  },
  {
    datetime: "2025/11/18 14:15",
    employee: "鈴木",
    route: ROUTE_TEL,
    target: "GHI株式会社 高橋様",
    tel: "03-2222-9999",
    email: "takahashi@ghi-group.com",
    result: "着座",
    memo: "面談完了、次回フォローアップ予定"
  },
  {
    datetime: "2025/11/18 15:30",
    employee: "佐藤",
    route: ROUTE_TEL,
    target: "JKL商事 山田様",
    tel: "03-7777-3333",
    email: "yamada@jkl-trading.jp",
    result: "コールバック",
    memo: "16:00に折り返し予定"
  },
  {
    datetime: "2025/11/19 10:00",
    employee: "佐藤",
    route: ROUTE_TEL,
    target: "MNO社 斎藤様",
    tel: "03-1111-2222",
    email: "saito@mno.co.jp",
    result: "通電",
    memo: "ニーズヒアリング済み"
  },
  {
    datetime: "2025/11/19 11:30",
    employee: "田中",
    route: ROUTE_TEL,
    target: "PQR社 中村様",
    tel: "03-4444-5555",
    email: "nakamura@pqr.jp",
    result: "設定",
    memo: "一次面談 11/27 10:00"
  },
  {
    datetime: "2025/11/19 16:10",
    employee: "山本",
    route: ROUTE_TEL,
    target: "STU社 佐藤様",
    tel: "03-6666-7777",
    email: "sato@stu.com",
    result: "着座",
    memo: "オンライン面談完了"
  },
  {
    datetime: "2025/11/10 09:50",
    employee: "鈴木",
    route: ROUTE_TEL,
    target: "VWXホールディングス 小林様",
    tel: "03-8888-9999",
    email: "kobayashi@vwx-hd.jp",
    result: "通電",
    memo: "次回提案資料送付予定"
  },
  {
    datetime: "2025/10/30 17:20",
    employee: "佐藤",
    route: ROUTE_TEL,
    target: "YZA社 高田様",
    tel: "03-0000-1111",
    email: "takada@yza.co.jp",
    result: "不在",
    memo: "11/1 午前に再架電"
  },

  // ここから追加データ（電話＆その他 混在で30件ほど）

  // 11月第3週（通電ルート中心）
  {
    datetime: "2025/11/20 09:05",
    employee: "佐藤",
    route: ROUTE_TEL,
    target: "アクメ株式会社 伊藤様",
    tel: "03-1010-2020",
    email: "ito@acme.co.jp",
    result: "通電",
    memo: "サービス概要を説明"
  },
  {
    datetime: "2025/11/20 09:40",
    employee: "佐藤",
    route: ROUTE_TEL,
    target: "アクメ株式会社 伊藤様",
    tel: "03-1010-2020",
    email: "ito@acme.co.jp",
    result: "設定",
    memo: "12/1 13:00 一次面談設定"
  },
  {
    datetime: "2025/11/20 11:10",
    employee: "田中",
    route: ROUTE_TEL,
    target: "ビーンズ商事 近藤様",
    tel: "03-3030-4040",
    email: "kondo@beans-shoji.jp",
    result: "不在",
    memo: "代表電話にて折り返し依頼"
  },
  {
    datetime: "2025/11/20 13:25",
    employee: "田中",
    route: ROUTE_TEL,
    target: "ビーンズ商事 近藤様",
    tel: "03-3030-4040",
    email: "kondo@beans-shoji.jp",
    result: "通電",
    memo: "採用背景をヒアリング"
  },
  {
    datetime: "2025/11/20 16:05",
    employee: "山本",
    route: ROUTE_TEL,
    target: "クリエイト産業 大島様",
    tel: "03-5050-6060",
    email: "oshima@create.co.jp",
    result: "設定",
    memo: "12/3 10:00 オンライン面談設定"
  },
  {
    datetime: "2025/11/20 17:15",
    employee: "鈴木",
    route: ROUTE_TEL,
    target: "デルタシステムズ 川口様",
    tel: "03-7070-8080",
    email: "kawaguchi@delta-sys.jp",
    result: "通電",
    memo: "要件ヒアリング、資料送付予定"
  },

  // 11月第2週（通電ルート＋その他ルート）
  {
    datetime: "2025/11/14 10:10",
    employee: "佐藤",
    route: ROUTE_TEL,
    target: "ネクストリンクス 阿部様",
    tel: "03-1414-1616",
    email: "abe@nextlinks.jp",
    result: "通電",
    memo: "現行エージェントの課題をヒアリング"
  },
  {
    datetime: "2025/11/14 11:00",
    employee: "佐藤",
    route: ROUTE_OTHER,
    target: "ネクストリンクス 阿部様（フォーム経由）",
    tel: "",
    email: "abe@nextlinks.jp",
    result: "設定",
    memo: "フォームから面談希望 → 12/5 15:00に設定"
  },
  {
    datetime: "2025/11/14 14:20",
    employee: "田中",
    route: ROUTE_TEL,
    target: "オルタナ電機 佐々木様",
    tel: "03-2828-3838",
    email: "sasaki@alterna-denki.co.jp",
    result: "不在",
    memo: "代表から転送依頼のみ"
  },
  {
    datetime: "2025/11/14 16:10",
    employee: "田中",
    route: ROUTE_TEL,
    target: "オルタナ電機 佐々木様",
    tel: "03-2828-3838",
    email: "sasaki@alterna-denki.co.jp",
    result: "通電",
    memo: "条件すり合わせ"
  },
  {
    datetime: "2025/11/15 09:20",
    employee: "山本",
    route: ROUTE_TEL,
    target: "インサイトコンサル 山下様",
    tel: "03-1313-1515",
    email: "yamashita@insight-consulting.jp",
    result: "通電",
    memo: "案件条件のすり合わせ実施"
  },
  {
    datetime: "2025/11/15 11:05",
    employee: "山本",
    route: ROUTE_OTHER,
    target: "インサイトコンサル 山下様（メルマガ流入）",
    tel: "",
    email: "yamashita@insight-consulting.jp",
    result: "着座",
    memo: "ウェビナー後の面談で着座"
  },
  {
    datetime: "2025/11/15 15:30",
    employee: "鈴木",
    route: ROUTE_TEL,
    target: "ジョイント建設 工藤様",
    tel: "03-7575-9797",
    email: "kudo@joint-construction.co.jp",
    result: "設定",
    memo: "11/30 10:00 対面面談調整"
  },

  // 11月第1週（その他ルート強め）
  {
    datetime: "2025/11/08 09:35",
    employee: "佐藤",
    route: ROUTE_OTHER,
    target: "スマイル介護サービス 井上様（LP流入）",
    tel: "",
    email: "inoue@smile-kaigo.jp",
    result: "設定",
    memo: "LPからの問い合わせ→面談日程確定"
  },
  {
    datetime: "2025/11/08 10:15",
    employee: "佐藤",
    route: ROUTE_TEL,
    target: "スマイル介護サービス 井上様",
    tel: "03-1616-1818",
    email: "inoue@smile-kaigo.jp",
    result: "着座",
    memo: "電話フォロー経由で着座"
  },
  {
    datetime: "2025/11/08 11:10",
    employee: "田中",
    route: ROUTE_OTHER,
    target: "リード物流パートナーズ 池田様（メルマガ流入）",
    tel: "",
    email: "ikeda@lead-logi.co.jp",
    result: "着座",
    memo: "メルマガ経由の個別相談"
  },
  {
    datetime: "2025/11/05 09:55",
    employee: "山本",
    route: ROUTE_TEL,
    target: "ミライ設備工業 石井様",
    tel: "03-1919-2020",
    email: "ishii@mirai-setsubi.jp",
    result: "通電",
    memo: "採用状況をヒアリング"
  },
  {
    datetime: "2025/11/05 14:05",
    employee: "山本",
    route: ROUTE_TEL,
    target: "ミライ設備工業 石井様",
    tel: "03-1919-2020",
    email: "ishii@mirai-setsubi.jp",
    result: "コールバック",
    memo: "採用責任者から折り返し予定"
  },
  {
    datetime: "2025/11/02 10:20",
    employee: "鈴木",
    route: ROUTE_OTHER,
    target: "ライトアップ不動産サービス 大森様（紹介）",
    tel: "",
    email: "omori@lightup-fudosan.jp",
    result: "設定",
    memo: "紹介経由の面談設定"
  },
  {
    datetime: "2025/11/02 16:20",
    employee: "鈴木",
    route: ROUTE_TEL,
    target: "ライトアップ不動産サービス 大森様",
    tel: "03-4343-5656",
    email: "omori@lightup-fudosan.jp",
    result: "通電",
    memo: "要件整理のうえ、資料送付"
  },

  // 10月末〜11月頭の通電ルート
  {
    datetime: "2025/10/28 09:10",
    employee: "佐藤",
    route: ROUTE_TEL,
    target: "サンライズ不動産 木村様",
    tel: "03-2222-3333",
    email: "kimura@sunrise-f.jp",
    result: "通電",
    memo: "現行の採用手法を確認"
  },
  {
    datetime: "2025/10/28 11:40",
    employee: "田中",
    route: ROUTE_TEL,
    target: "ブリッジ企画 小泉様",
    tel: "03-4949-5959",
    email: "koizumi@bridge-kikaku.jp",
    result: "設定",
    memo: "11/10 14:00 オンライン面談設定"
  },
  {
    datetime: "2025/10/29 14:15",
    employee: "山本",
    route: ROUTE_TEL,
    target: "クローバー保育 松本様",
    tel: "03-8080-9090",
    email: "matsumoto@clover-hoiku.com",
    result: "通電",
    memo: "保育士採用の課題をヒアリング"
  },
  {
    datetime: "2025/10/29 16:30",
    employee: "山本",
    route: ROUTE_TEL,
    target: "クローバー保育 松本様",
    tel: "03-8080-9090",
    email: "matsumoto@clover-hoiku.com",
    result: "設定",
    memo: "11/12 16:00 打ち合わせ設定"
  },
  {
    datetime: "2025/10/30 10:05",
    employee: "鈴木",
    route: ROUTE_TEL,
    target: "ジョイフル物流 長野様",
    tel: "03-5656-7878",
    email: "nagano@joyful-logi.jp",
    result: "不在",
    memo: "次回午前中に再架電予定"
  },
  {
    datetime: "2025/10/31 09:50",
    employee: "佐藤",
    route: ROUTE_TEL,
    target: "ジョイフル物流 長野様",
    tel: "03-5656-7878",
    email: "nagano@joyful-logi.jp",
    result: "通電",
    memo: "ニーズヒアリング・提案検討中"
  }
];

// ===== ユーティリティ関数 =====

function parseDateTime(dateTimeStr) {
  if (!dateTimeStr) return null;
  const [datePart, timePart = '00:00'] = dateTimeStr.split(' ');
  const [y, m, d] = (datePart || '').split('/');
  const [hh = '00', mm = '00'] = (timePart || '').split(':');
  if (!y || !m || !d) return null;
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:00`);
}

// アポ結果 → 通電/設定/着座フラグ
function classifyTeleapoResult(resultText) {
  const text = (resultText || '').trim();
  const isConnect = ['通電', '設定', '着座', 'コールバック'].some(w => text.includes(w));
  const isSet = ['設定', '着座'].some(w => text.includes(w));
  const isShow = ['着座'].some(w => text.includes(w));
  return { isConnect, isSet, isShow };
}

// 時刻 → ヒートマップ時間帯スロット
function resolveTeleapoSlot(hour) {
  if (hour >= 9 && hour < 11) return '09-11';
  if (hour >= 11 && hour < 13) return '11-13';
  if (hour >= 13 && hour < 15) return '13-15';
  if (hour >= 15 && hour < 17) return '15-17';
  if (hour >= 17 && hour < 19) return '17-19';
  return null;
}

// 選択期間ラベル（YYYY/MM/DD〜YYYY/MM/DD）
function getTeleapoSelectedRangeLabel() {
  if (!teleapoGlobalStartDate || !teleapoGlobalEndDate) return '';
  const s = teleapoGlobalStartDate.replace(/-/g, '/');
  const e = teleapoGlobalEndDate.replace(/-/g, '/');
  if (s === e) return s;
  return `${s}〜${e}`;
}

function getCurrentRangeDates() {
  const start = teleapoGlobalStartDate
    ? new Date(teleapoGlobalStartDate + 'T00:00:00')
    : null;
  const end = teleapoGlobalEndDate
    ? new Date(teleapoGlobalEndDate + 'T23:59:59')
    : null;
  return { start, end };
}

function formatRate(rate) {
  if (rate == null || Number.isNaN(rate)) return '-';
  return `${rate.toFixed(1)}%`;
}

// ===== 日付ピッカー初期化 =====

function initializeTeleapoDatePickers() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const firstOfMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstOfMonthStr = firstOfMonthDate.toISOString().split('T')[0];

  const companyStart = document.getElementById('teleapoCompanyRangeStart');
  const companyEnd = document.getElementById('teleapoCompanyRangeEnd');
  const logStart = document.getElementById('teleapoLogRangeStart');
  const logEnd = document.getElementById('teleapoLogRangeEnd');

  if (companyStart) companyStart.value = firstOfMonthStr;
  if (companyEnd) companyEnd.value = todayStr;
  if (logStart) logStart.value = firstOfMonthStr;
  if (logEnd) logEnd.value = todayStr;

  teleapoGlobalStartDate = firstOfMonthStr;
  teleapoGlobalEndDate = todayStr;

  [companyStart, companyEnd, logStart, logEnd].forEach(el => {
    if (el) el.addEventListener('change', handleTeleapoDateRangeChange);
  });

  const presetButtons = document.querySelectorAll('.kpi-v2-range-presets .kpi-v2-range-btn');
  presetButtons.forEach(btn => btn.addEventListener('click', handleTeleapoPresetClick));

  updateTeleapoPeriodLabels();
}

// タブクリックで各セクションにスクロール
function initializeTeleapoTabs() {
  const buttons = document.querySelectorAll(".teleapo-tab-btn");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetSelector = btn.dataset.teleapoTabTarget;
      if (targetSelector) {
        const targetEl = document.querySelector(targetSelector);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }

      // アクティブ切り替え（スクロール連動まではやりすぎなのでクリック時のみ）
      buttons.forEach((b) => b.classList.remove("teleapo-tab-btn-active"));
      btn.classList.add("teleapo-tab-btn-active");
    });
  });
}

function clearTeleapoPresetButtonsActive() {
  const presetButtons = document.querySelectorAll('.kpi-v2-range-presets .kpi-v2-range-btn');
  presetButtons.forEach(btn => btn.classList.remove('kpi-v2-range-btn-active'));
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

function handleTeleapoPresetClick(event) {
  const btn = event.currentTarget;
  const preset = btn.dataset.preset;
  if (!preset) return;

  const group = btn.closest('.kpi-v2-range-presets');
  if (group) {
    group.querySelectorAll('.kpi-v2-range-btn').forEach(b =>
      b.classList.remove('kpi-v2-range-btn-active')
    );
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
  handleTeleapoLogDataChanged();
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

  clearTeleapoPresetButtonsActive();
  updateTeleapoPeriodLabels();
  handleTeleapoLogDataChanged();
}
function updateTeleapoPeriodLabels() {
  const companyStart = document.getElementById('teleapoCompanyRangeStart')?.value;
  const companyEnd = document.getElementById('teleapoCompanyRangeEnd')?.value;
  const label = document.getElementById('teleapoCompanyPeriodLabel');

  if (companyStart && companyEnd && label) {
    const s = companyStart.replace(/-/g, '/');
    const e = companyEnd.replace(/-/g, '/');
    label.textContent = `表示期間：${s} 〜 ${e}`;
  }

  // ヒートマップの期間ラベル（過去1週間／1か月／半年は teleapoHeatmapRange に応じて）
  const heatLabel = document.getElementById('teleapoHeatmapPeriodLabel');
  if (heatLabel) {
    let text = '';
    if (teleapoHeatmapRange === '1w') {
      text = '表示期間：過去1週間の通電率（時間帯・曜日別）';
    } else if (teleapoHeatmapRange === '6m') {
      text = '表示期間：過去半年間の通電率（時間帯・曜日別）';
    } else {
      text = '表示期間：過去1か月間の通電率（時間帯・曜日別）';
    }
    heatLabel.textContent = text;
  }
}


// ===== 上部KPI集計・表示 =====

// route 別集計（通電 / その他 / 総合）
function computeTeleapoCompanyKpi() {
  const { start, end } = getCurrentRangeDates();

  const tel = { attempts: 0, contacts: 0, sets: 0, shows: 0 };
  const other = { attempts: 0, contacts: 0, sets: 0, shows: 0 };

  teleapoLogData.forEach(log => {
    const dt = parseDateTime(log.datetime);
    if (!dt) return;
    if (start && dt < start) return;
    if (end && dt > end) return;

    const route = log.route === ROUTE_OTHER ? ROUTE_OTHER : ROUTE_TEL;
    const flags = classifyTeleapoResult(log.result);

    if (route === ROUTE_TEL) {
      tel.attempts += 1;
      if (flags.isConnect) tel.contacts += 1;
      if (flags.isSet) tel.sets += 1;
      if (flags.isShow) tel.shows += 1;
    } else {
      other.attempts += 1;
      if (flags.isConnect) other.contacts += 1;
      if (flags.isSet) other.sets += 1;
      if (flags.isShow) other.shows += 1;
    }
  });

  const total = {
    attempts: tel.attempts + other.attempts,
    contacts: tel.contacts + other.contacts,
    sets: tel.sets + other.sets,
    shows: tel.shows + other.shows
  };

  return { tel, other, total };
}

function computeRatesFromCounts(counts) {
  const contactRate = counts.attempts > 0
    ? (counts.contacts / counts.attempts) * 100
    : null;
  const setRate = counts.contacts > 0
    ? (counts.sets / counts.contacts) * 100
    : null;
  const showRate = counts.sets > 0
    ? (counts.shows / counts.sets) * 100
    : null;
  return { contactRate, setRate, showRate };
}

function renderTeleapoSummaryKpi(kpi, titleText, scopeLabelText) {
  const { tel, other, total } = kpi;

  const rangeLabel = getTeleapoSelectedRangeLabel();
  const titleEl = document.getElementById('teleapoSummaryTitle');
  const scopeEl = document.getElementById('teleapoSummaryScopeLabel');

  if (titleEl) {
    if (rangeLabel) {
      titleEl.textContent = `${rangeLabel} の${titleText}`;
    } else {
      titleEl.textContent = titleText;
    }
  }
  if (scopeEl) {
    scopeEl.textContent = scopeLabelText;
  }

  const telRates = computeRatesFromCounts(tel);
  const otherRates = computeRatesFromCounts(other);
  const totalRates = computeRatesFromCounts(total);

  // 率
  const idsRate = {
    contact: ['teleapoKpiContactRateTel', 'teleapoKpiContactRateOther', 'teleapoKpiContactRateTotal'],
    set: ['teleapoKpiSetRateTel', 'teleapoKpiSetRateOther', 'teleapoKpiSetRateTotal'],
    show: ['teleapoKpiShowRateTel', 'teleapoKpiShowRateOther', 'teleapoKpiShowRateTotal']
  };

  const rateTriples = [
    [telRates, otherRates, totalRates]
  ];

  const [rTel, rOther, rTotal] = rateTriples[0];

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatRate(value);
  };

  setText(idsRate.contact[0], rTel.contactRate);
  setText(idsRate.contact[1], rOther.contactRate);
  setText(idsRate.contact[2], rTotal.contactRate);

  setText(idsRate.set[0], rTel.setRate);
  setText(idsRate.set[1], rOther.setRate);
  setText(idsRate.set[2], rTotal.setRate);

  setText(idsRate.show[0], rTel.showRate);
  setText(idsRate.show[1], rOther.showRate);
  setText(idsRate.show[2], rTotal.showRate);

  // 件数
  const setNum = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = (value ?? 0).toLocaleString();
  };

  setNum('teleapoKpiDialsTel', tel.attempts);

  setNum('teleapoKpiContactsTel', tel.contacts);
  setNum('teleapoKpiContactsOther', other.contacts);
  setNum('teleapoKpiContactsTotal', total.contacts);

  setNum('teleapoKpiSetsTel', tel.sets);
  setNum('teleapoKpiSetsOther', other.sets);
  setNum('teleapoKpiSetsTotal', total.sets);

  setNum('teleapoKpiShowsTel', tel.shows);
  setNum('teleapoKpiShowsOther', other.shows);
  setNum('teleapoKpiShowsTotal', total.shows);
}

function updateTeleapoSummaryKpiForCompany() {
  const kpi = computeTeleapoCompanyKpi();
  renderTeleapoSummaryKpi(kpi, '全体KPI', '全体');
}

function updateTeleapoSummaryKpiForEmployee(empName, empMetrics) {
  const tel = {
    attempts: empMetrics.dials,
    contacts: empMetrics.connects,
    sets: empMetrics.sets,
    shows: empMetrics.shows
  };
  const zero = { attempts: 0, contacts: 0, sets: 0, shows: 0 };
  const total = { ...tel };

  const kpi = { tel, other: zero, total };
  renderTeleapoSummaryKpi(kpi, `${empName}さんのKPI`, empName);
}

// ===== 社員成績（通電ルートのみ） =====

function computeTeleapoEmployeeMetrics() {
  const { start, end } = getCurrentRangeDates();
  const map = new Map();  // name -> counts

  teleapoLogData.forEach(log => {
    const route = log.route === ROUTE_OTHER ? ROUTE_OTHER : ROUTE_TEL;
    if (route !== ROUTE_TEL) return; // 社員成績は通電ルートのみ

    const dt = parseDateTime(log.datetime);
    if (!dt) return;
    if (start && dt < start) return;
    if (end && dt > end) return;

    const name = log.employee || '未割当';
    const flags = classifyTeleapoResult(log.result);

    let rec = map.get(name);
    if (!rec) {
      rec = { dials: 0, connects: 0, sets: 0, shows: 0 };
    }
    rec.dials += 1;
    if (flags.isConnect) rec.connects += 1;
    if (flags.isSet) rec.sets += 1;
    if (flags.isShow) rec.shows += 1;

    map.set(name, rec);
  });

  const result = Array.from(map.entries()).map(([name, rec]) => {
    const connectRate = rec.dials > 0 ? (rec.connects / rec.dials) * 100 : 0;
    const setRate = rec.connects > 0 ? (rec.sets / rec.connects) * 100 : 0;
    const showRate = rec.sets > 0 ? (rec.shows / rec.sets) * 100 : 0;
    return {
      name,
      dials: rec.dials,
      connects: rec.connects,
      sets: rec.sets,
      shows: rec.shows,
      connectRate,
      setRate,
      showRate
    };
  });

  // 社員名の昇順で並べておく（ソートエントリを安定させるため）
  result.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  return result;
}

function updateTeleapoEmployeeDisplay(data) {
  const tbody = document.getElementById('teleapoEmployeeTableBody');
  if (!tbody) return;

  tbody.innerHTML = data.map(emp => `
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
  `).join('');

  attachTeleapoEmployeeRowHandlers();
}

function sortTeleapoEmployees(sortValue = 'showRate-desc') {
  const [key, dirStr] = sortValue.split('-');
  const dir = dirStr === 'asc' ? 1 : -1;

  const data = [...teleapoEmployeeMetrics];
  data.sort((a, b) => {
    if (key === 'name') {
      return dir * a.name.localeCompare(b.name, 'ja');
    }
    const av = a[key] ?? 0;
    const bv = b[key] ?? 0;
    return dir * (av - bv);
  });

  updateTeleapoEmployeeDisplay(data);

  const sortSelect = document.getElementById('teleapoEmployeeSortSelect');
  if (sortSelect) sortSelect.value = sortValue;
}

function initializeTeleapoEmployeeSortControls() {
  const sortSelect = document.getElementById('teleapoEmployeeSortSelect');
  if (!sortSelect) return;

  sortSelect.value = sortSelect.value || 'showRate-desc';
  sortSelect.addEventListener('change', e => {
    sortTeleapoEmployees(e.target.value);
  });
}

function filterTeleapoEmployeeTable(targetName) {
  const rows = document.querySelectorAll('.teleapo-employee-row');
  rows.forEach(row => {
    const name = row.dataset.employeeName;
    if (!targetName) {
      row.style.display = '';
      row.classList.remove('teleapo-employee-row-active');
    } else if (name === targetName) {
      row.style.display = '';
      row.classList.add('teleapo-employee-row-active');
    } else {
      row.style.display = 'none';
      row.classList.remove('teleapo-employee-row-active');
    }
  });
}

function attachTeleapoEmployeeRowHandlers() {
  const rows = document.querySelectorAll('.teleapo-employee-row');
  rows.forEach(row => {
    const name = row.dataset.employeeName;
    if (!name) return;

    row.onclick = () => {
      const isSame =
        teleapoSummaryScope.type === 'employee' &&
        teleapoSummaryScope.name === name;

      if (isSame) {
        // 再クリックで全体に戻す
        teleapoSummaryScope = { type: 'company', name: '全体' };
        filterTeleapoEmployeeTable(null);
        updateTeleapoSummaryKpiForCompany();

        const chartWrapper = document.getElementById('teleapoEmployeeChartWrapper');
        if (chartWrapper) chartWrapper.classList.add('hidden');
        return;
      }

      const emp = teleapoEmployeeMetrics.find(e => e.name === name);
      if (!emp) return;

      teleapoSummaryScope = { type: 'employee', name };
      filterTeleapoEmployeeTable(name);
      updateTeleapoSummaryKpiForEmployee(name, emp);
      renderTeleapoEmployeeTrendChart(name, emp);
    };
  });

  const resetBtn = document.getElementById('teleapoSummaryResetBtn');
  if (resetBtn) {
    resetBtn.onclick = () => {
      teleapoSummaryScope = { type: 'company', name: '全体' };
      filterTeleapoEmployeeTable(null);
      updateTeleapoSummaryKpiForCompany();

      const chartWrapper = document.getElementById('teleapoEmployeeChartWrapper');
      if (chartWrapper) chartWrapper.classList.add('hidden');
    };
  }
}

// 社員別トレンドポイント生成
// 選択期間に応じて粒度を切り替える：
//  - 1日以内      : 時間（○時）
//  - 7日以内      : 曜日（○曜）
//  - 31日以内     : 第1〜第5週
//  - 31日超       : 月（YYYY/MM）
function computeTeleapoEmployeeTrendPoints(empName, empMetricsFallback) {
  const { start, end } = getCurrentRangeDates();

  // 対象ログ：社員名一致 & 通電ルートのみ
  const logs = teleapoLogData.filter((log) => {
    const route = log.route === ROUTE_OTHER ? ROUTE_OTHER : ROUTE_TEL;
    if (route !== ROUTE_TEL) return false;
    if (log.employee !== empName) return false;

    const dt = parseDateTime(log.datetime);
    if (!dt) return false;
    if (start && dt < start) return false;
    if (end && dt > end) return false;
    return true;
  });

  // ログがない場合は fallback（全期間平均のフラットな5点）
  if (!logs.length) {
    if (!empMetricsFallback) return [];
    const base = {
      connectRate: empMetricsFallback.connectRate,
      setRate: empMetricsFallback.setRate,
      showRate: empMetricsFallback.showRate
    };
    return Array.from({ length: 5 }).map((_, i) => ({
      label: `${i + 1}`,
      connectRate: base.connectRate,
      setRate: base.setRate,
      showRate: base.showRate
    }));
  }

  // 期間の長さ（日数）を計算（両端含め）
  const firstDate = start ? new Date(start) : parseDateTime(logs[0].datetime);
  const lastDate = end ? new Date(end) : parseDateTime(logs[logs.length - 1].datetime);
  const startMid = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate());
  const endMid = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
  const oneDayMs = 24 * 60 * 60 * 1000;
  const inclusiveDays = Math.floor((endMid - startMid) / oneDayMs) + 1;

  // 共通：集計用ヘルパー
  const accMap = new Map(); // key -> { dials, connects, sets, shows }
  const touch = (key, flags) => {
    let rec = accMap.get(key);
    if (!rec) rec = { dials: 0, connects: 0, sets: 0, shows: 0 };
    rec.dials += 1;
    if (flags.isConnect) rec.connects += 1;
    if (flags.isSet) rec.sets += 1;
    if (flags.isShow) rec.shows += 1;
    accMap.set(key, rec);
  };

  // 粒度別に key と label を作る
  if (inclusiveDays <= 1) {
    // === 1日以内 → 時間（○時）
    logs.forEach(log => {
      const dt = parseDateTime(log.datetime);
      if (!dt) return;
      const hour = dt.getHours();
      const key = hour; // 0〜23
      const flags = classifyTeleapoResult(log.result);
      touch(key, flags);
    });

    const hours = Array.from(accMap.keys()).sort((a, b) => a - b);
    return hours.map(hour => {
      const rec = accMap.get(hour);
      const connectRate = rec.dials > 0 ? (rec.connects / rec.dials) * 100 : 0;
      const setRate = rec.connects > 0 ? (rec.sets / rec.connects) * 100 : 0;
      const showRate = rec.sets > 0 ? (rec.shows / rec.sets) * 100 : 0;
      return {
        label: `${hour}時`,
        connectRate,
        setRate,
        showRate
      };
    });
  } else if (inclusiveDays <= 7) {
    // === 7日以内 → 曜日（○曜）
    logs.forEach(log => {
      const dt = parseDateTime(log.datetime);
      if (!dt) return;
      const dow = dt.getDay(); // 0:日〜6:土
      const key = dow;
      const flags = classifyTeleapoResult(log.result);
      touch(key, flags);
    });

    const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
    const keys = Array.from(accMap.keys()).sort((a, b) => a - b);
    return keys.map(dow => {
      const rec = accMap.get(dow);
      const connectRate = rec.dials > 0 ? (rec.connects / rec.dials) * 100 : 0;
      const setRate = rec.connects > 0 ? (rec.sets / rec.connects) * 100 : 0;
      const showRate = rec.sets > 0 ? (rec.shows / rec.sets) * 100 : 0;
      return {
        label: `${DAY_LABELS[dow]}曜`,
        connectRate,
        setRate,
        showRate
      };
    });
  } else if (inclusiveDays <= 31) {
    // === 31日以内 → 第n週（開始日からの経過で1週を7日とみなす）
    logs.forEach(log => {
      const dt = parseDateTime(log.datetime);
      if (!dt) return;
      const offsetDays = Math.floor(
        (new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()) - startMid) / oneDayMs
      );
      const weekIndex = Math.floor(offsetDays / 7); // 0〜
      const key = weekIndex;
      const flags = classifyTeleapoResult(log.result);
      touch(key, flags);
    });

    const keys = Array.from(accMap.keys()).sort((a, b) => a - b);
    return keys.map(weekIndex => {
      const rec = accMap.get(weekIndex);
      const connectRate = rec.dials > 0 ? (rec.connects / rec.dials) * 100 : 0;
      const setRate = rec.connects > 0 ? (rec.sets / rec.connects) * 100 : 0;
      const showRate = rec.sets > 0 ? (rec.shows / rec.sets) * 100 : 0;
      return {
        label: `${weekIndex + 1}週目`,
        connectRate,
        setRate,
        showRate
      };
    });
  } else {
    // === 31日超 → 月単位（YYYY/MM）
    logs.forEach(log => {
      const dt = parseDateTime(log.datetime);
      if (!dt) return;
      const y = dt.getFullYear();
      const m = dt.getMonth() + 1;
      const key = `${y}-${String(m).padStart(2, "0")}`; // 例: "2025-11"
      const flags = classifyTeleapoResult(log.result);
      touch(key, flags);
    });

    const keys = Array.from(accMap.keys()).sort(); // "YYYY-MM" 昇順
    return keys.map(key => {
      const rec = accMap.get(key);
      const connectRate = rec.dials > 0 ? (rec.connects / rec.dials) * 100 : 0;
      const setRate = rec.connects > 0 ? (rec.sets / rec.connects) * 100 : 0;
      const showRate = rec.sets > 0 ? (rec.shows / rec.sets) * 100 : 0;
      const [y, m] = key.split("-");
      return {
        label: `${y}/${m}`,
        connectRate,
        setRate,
        showRate
      };
    });
  }
}

// 3本線（通電率・設定率・着座率）のSVGチャート描画
function drawTeleapoEmployeeRateLines(svg, points) {
  if (!svg) return;

  // 最大値（Y軸上限）をざっくり決める
  let maxRate = 0;
  points.forEach(p => {
    maxRate = Math.max(maxRate, p.connectRate || 0, p.setRate || 0, p.showRate || 0);
  });
  maxRate = Math.max(10, Math.ceil(maxRate / 10) * 10);

  const width = 800;
  const height = 260;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const usableWidth = width - paddingLeft - paddingRight;
  const usableHeight = height - paddingTop - paddingBottom;

  const n = points.length || 1;
  const xStep = n > 1 ? usableWidth / (n - 1) : usableWidth;

  const toX = i => paddingLeft + xStep * i;
  const toY = v => paddingTop + usableHeight * (1 - (v || 0) / maxRate);

  const pathFor = key =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p[key] || 0)}`)
      .join(" ");

  const connectPath = pathFor("connectRate");
  const setPath = pathFor("setRate");
  const showPath = pathFor("showRate");

  svg.innerHTML = `
    <style>
      .teleapo-axis-label { font-size: 10px; fill: #6b7280; }
      .teleapo-line-connect { fill: none; stroke: #3b82f6; stroke-width: 2; }
      .teleapo-line-set     { fill: none; stroke: #f59e0b; stroke-width: 2; }
      .teleapo-line-show    { fill: none; stroke: #10b981; stroke-width: 2; }
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
  }).join("")}
    <!-- 通電率 -->
    <path d="${connectPath}" class="teleapo-line-connect" />
    ${points.map((p, i) => `
      <circle class="teleapo-dot" cx="${toX(i)}" cy="${toY(p.connectRate)}" r="4" fill="#3b82f6" />
    `).join("")}
    <!-- 設定率 -->
    <path d="${setPath}" class="teleapo-line-set" />
    ${points.map((p, i) => `
      <circle class="teleapo-dot" cx="${toX(i)}" cy="${toY(p.setRate)}" r="4" fill="#f59e0b" />
    `).join("")}
    <!-- 着座率 -->
    <path d="${showPath}" class="teleapo-line-show" />
    ${points.map((p, i) => `
      <circle class="teleapo-dot" cx="${toX(i)}" cy="${toY(p.showRate)}" r="4" fill="#10b981" />
    `).join("")}
    <!-- X軸ラベル -->
    ${points.map((p, i) => `
      <text class="teleapo-axis-label" x="${toX(i)}" y="${height - paddingBottom + 16}" text-anchor="middle">
        ${p.label}
      </text>
    `).join("")}
    <!-- 凡例 -->
    <rect x="${paddingLeft}" y="${paddingTop}" width="12" height="12" fill="#3b82f6" />
    <text x="${paddingLeft + 18}" y="${paddingTop + 10}" class="teleapo-axis-label">通電率</text>
    <rect x="${paddingLeft + 90}" y="${paddingTop}" width="12" height="12" fill="#f59e0b" />
    <text x="${paddingLeft + 108}" y="${paddingTop + 10}" class="teleapo-axis-label">設定率</text>
    <rect x="${paddingLeft + 180}" y="${paddingTop}" width="12" height="12" fill="#10b981" />
    <text x="${paddingLeft + 198}" y="${paddingTop + 10}" class="teleapo-axis-label">着座率</text>
  `;
}

// 社員選択時の折れ線グラフ描画
function renderTeleapoEmployeeTrendChart(empName, empMetrics) {
  const wrapper = document.getElementById("teleapoEmployeeChartWrapper");
  const svg = document.getElementById("teleapoEmployeeTrendChart");
  const titleEl = document.getElementById("teleapoEmployeeChartTitle");
  if (!wrapper || !svg || !titleEl) return;

  const rangeLabel = getTeleapoSelectedRangeLabel();
  if (rangeLabel) {
    titleEl.textContent = `${rangeLabel} の ${empName} さんのKPI（通電率・設定率・着座率）`;
  } else {
    titleEl.textContent = `${empName} さんのKPI（通電率・設定率・着座率）`;
  }

  const points = computeTeleapoEmployeeTrendPoints(empName, empMetrics);
  if (!points.length) {
    wrapper.classList.add("hidden");
    return;
  }

  drawTeleapoEmployeeRateLines(svg, points);
  wrapper.classList.remove("hidden");
}


// ===== ヒートマップ（通電率 / 通電ルートのみ） =====

function initializeTeleapoHeatmapControls() {
  const empSelect = document.getElementById('teleapoHeatmapEmployeeFilter');
  if (empSelect) {
    empSelect.addEventListener('change', () => renderTeleapoHeatmap());
  }

  const rangeButtons = document.querySelectorAll('[data-heatmap-range]');
  rangeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const range = btn.dataset.heatmapRange;
      if (!range) return;

      teleapoHeatmapRange = range;

      // アクティブ状態の切り替え
      rangeButtons.forEach(b => b.classList.remove('kpi-v2-range-btn-active'));
      btn.classList.add('kpi-v2-range-btn-active');

      // ラベル更新＋再描画
      updateTeleapoPeriodLabels();
      renderTeleapoHeatmap();
    });
  });
}

function renderTeleapoHeatmap() {
  const empSelect = document.getElementById('teleapoHeatmapEmployeeFilter');
  const tbody = document.getElementById('teleapoHeatmapTableBody');
  if (!tbody) return;

  const employeeFilter = empSelect?.value || 'all';

  const now = new Date();
  const from = new Date(now);
  if (teleapoHeatmapRange === '1w') {
    from.setDate(now.getDate() - 7);
  } else if (teleapoHeatmapRange === '6m') {
    from.setDate(now.getDate() - 182); // 約半年
  } else {
    from.setDate(now.getDate() - 30);  // 約1か月
  }


  const buckets = {}; // day -> slot -> { dials, connects }

  TELEAPO_HEATMAP_DAYS.forEach(day => {
    buckets[day] = {};
    TELEAPO_HEATMAP_SLOTS.forEach(slot => {
      buckets[day][slot] = { dials: 0, connects: 0 };
    });
  });

  teleapoLogData.forEach(log => {
    const route = log.route === ROUTE_OTHER ? ROUTE_OTHER : ROUTE_TEL;
    if (route !== ROUTE_TEL) return;

    const dt = parseDateTime(log.datetime);
    if (!dt) return;
    if (dt < from || dt > now) return;

    if (employeeFilter !== 'all' && log.employee !== employeeFilter) return;

    const dow = dt.getDay();
    const dayLabel = ['日', '月', '火', '水', '木', '金', '土'][dow];
    if (!TELEAPO_HEATMAP_DAYS.includes(dayLabel)) return;

    const slot = resolveTeleapoSlot(dt.getHours());
    if (!slot) return;

    const flags = classifyTeleapoResult(log.result);
    const cell = buckets[dayLabel][slot];
    cell.dials += 1;
    if (flags.isConnect) cell.connects += 1;
  });

  // 通電率＋平均＋偏差で色付け
  const rateMap = {};
  let sumRate = 0;
  let countRate = 0;

  TELEAPO_HEATMAP_DAYS.forEach(day => {
    rateMap[day] = {};
    TELEAPO_HEATMAP_SLOTS.forEach(slot => {
      const cell = buckets[day][slot];
      if (cell.dials === 0) {
        rateMap[day][slot] = null;
      } else {
        const r = (cell.connects / cell.dials) * 100;
        rateMap[day][slot] = r;
        sumRate += r;
        countRate += 1;
      }
    });
  });

  const avgRate = countRate > 0 ? sumRate / countRate : 0;
  let maxAbsDiff = 0;

  TELEAPO_HEATMAP_DAYS.forEach(day => {
    TELEAPO_HEATMAP_SLOTS.forEach(slot => {
      const r = rateMap[day][slot];
      if (r == null) return;
      const diff = Math.abs(r - avgRate);
      if (diff > maxAbsDiff) maxAbsDiff = diff;
    });
  });
  if (maxAbsDiff === 0) maxAbsDiff = 1;

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
      const cellDiv = document.createElement('div');
      cellDiv.className = 'kpi-v2-heatmap-cell';
      cellDiv.dataset.day = day;
      cellDiv.dataset.slot = slot;

      if (rate == null) {
        cellDiv.textContent = '-';
        cellDiv.style.backgroundColor = 'rgba(248, 250, 252, 1)';
      } else {
        const diff = rate - avgRate;
        const t = Math.min(1, Math.abs(diff) / maxAbsDiff);

        cellDiv.dataset.rate = rate.toFixed(1);
        cellDiv.textContent = `${rate.toFixed(0)}%`;

        let bgColor;
        if (Math.abs(diff) < 1) {
          bgColor = 'rgba(248, 250, 252, 1)';
        } else if (diff > 0) {
          const alpha = 0.2 + 0.6 * t;
          bgColor = `rgba(37, 99, 235, ${alpha.toFixed(2)})`;
        } else {
          const alpha = 0.2 + 0.6 * t;
          bgColor = `rgba(239, 68, 68, ${alpha.toFixed(2)})`;
        }
        cellDiv.style.backgroundColor = bgColor;
      }

      cellDiv.addEventListener('click', () => {
        handleTeleapoHeatmapCellClick(day, slot);
      });

      td.appendChild(cellDiv);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  updateTeleapoHeatmapSelectionLabel();
}

function handleTeleapoHeatmapCellClick(day, slot) {
  if (teleapoHeatmapSelection &&
    teleapoHeatmapSelection.day === day &&
    teleapoHeatmapSelection.slot === slot) {
    teleapoHeatmapSelection = null;
  } else {
    teleapoHeatmapSelection = { day, slot };
  }
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

// ===== 架電ログ：テーブル・フィルタ・ソート =====

function renderTeleapoLogTable() {
  const tbody = document.getElementById('teleapoLogTableBody');
  if (!tbody) return;

  tbody.innerHTML = teleapoLogData.map(row => {
    const routeLabel = row.route === ROUTE_OTHER ? 'その他' : '電話';
    const badgeClass =
      row.result.includes('設定') ? 'bg-emerald-100 text-emerald-700' :
        row.result.includes('着座') ? 'bg-green-100 text-green-700' :
          row.result.includes('通電') ? 'bg-blue-100 text-blue-700' :
            row.result.includes('コールバック') ? 'bg-amber-100 text-amber-700' :
              row.result.includes('不在') ? 'bg-slate-100 text-slate-600' :
                'bg-slate-100 text-slate-600';

    return `
      <tr>
        <td class="whitespace-nowrap">${row.datetime}</td>
        <td>${row.employee || ''}</td>
        <td>${routeLabel}</td>
        <td>${row.target || ''}</td>
        <td>${row.tel || ''}</td>
        <td>${row.email || ''}</td>
        <td>
          <span class="px-2 py-1 ${badgeClass} rounded text-xs font-semibold">
            ${row.result || ''}
          </span>
        </td>
        <td>${row.memo || ''}</td>
      </tr>
    `;
  }).join('');

  filterTeleapoLogRows();
}

function updateTeleapoLogCount(count) {
  const el = document.getElementById('teleapoLogFilterCount');
  if (el) el.textContent = `${count}件`;
}

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
    teleapoHeatmapSelection = null;
    updateTeleapoHeatmapSelectionLabel();
    filterTeleapoLogRows();
  });

  const sortable = document.querySelectorAll('#teleapoLogTable .sortable');
  sortable.forEach(h => h.addEventListener('click', handleTeleapoLogSort));
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
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll('tr'));

  rows.sort((a, b) => {
    const ca = a.children;
    const cb = b.children;
    let av = '', bv = '';

    if (field === 'datetime') {
      av = ca[0]?.textContent || '';
      bv = cb[0]?.textContent || '';
    } else if (field === 'employee') {
      av = ca[1]?.textContent || '';
      bv = cb[1]?.textContent || '';
    } else if (field === 'route') {
      av = ca[2]?.textContent || '';
      bv = cb[2]?.textContent || '';
    } else if (field === 'target') {
      av = ca[3]?.textContent || '';
      bv = cb[3]?.textContent || '';
    } else if (field === 'result') {
      av = ca[6]?.textContent || '';
      bv = cb[6]?.textContent || '';
    } else {
      return 0;
    }

    const cmp = av.localeCompare(bv, 'ja');
    return dir === 'asc' ? cmp : -cmp;
  });

  tbody.innerHTML = '';
  rows.forEach(r => tbody.appendChild(r));
}

function filterTeleapoLogRows() {
  const emp = document.getElementById('teleapoLogEmployeeFilter')?.value || '';
  const result = document.getElementById('teleapoLogResultFilter')?.value || '';
  const target = document.getElementById('teleapoLogTargetSearch')?.value || '';

  const logStart = document.getElementById('teleapoLogRangeStart')?.value || '';
  const logEnd = document.getElementById('teleapoLogRangeEnd')?.value || '';

  const rows = document.querySelectorAll('#teleapoLogTableBody tr');
  let visible = 0;

  const startDate = logStart ? new Date(logStart + 'T00:00:00') : null;
  const endDate = logEnd ? new Date(logEnd + 'T23:59:59') : null;

  rows.forEach(row => {
    let show = true;
    const cells = row.children;

    const dtStr = cells[0]?.textContent.trim() || '';
    if (dtStr && (startDate || endDate)) {
      const dt = parseDateTime(dtStr);
      if (dt) {
        if (startDate && dt < startDate) show = false;
        if (endDate && dt > endDate) show = false;

        if (show && teleapoHeatmapSelection) {
          const dayIdx = dt.getDay();
          const dayLabel = ['日', '月', '火', '水', '木', '金', '土'][dayIdx];
          const hour = dt.getHours();
          const slot = resolveTeleapoSlot(hour);
          if (
            dayLabel !== teleapoHeatmapSelection.day ||
            slot !== teleapoHeatmapSelection.slot
          ) {
            show = false;
          }
        }
      }
    }

    const empName = cells[1]?.textContent.trim() || '';
    if (show && emp && empName !== emp) {
      show = false;
    }

    const resultText = cells[6]?.textContent.trim() || '';
    if (show && result && !resultText.includes(result)) {
      show = false;
    }

    const targetText = (cells[3]?.textContent || '').toLowerCase();
    if (show && target && !targetText.includes(target.toLowerCase())) {
      show = false;
    }

    row.style.display = show ? '' : 'none';
    if (show) visible += 1;
  });

  updateTeleapoLogCount(visible);
}

// ===== 新規ログ入力フォーム =====

function initializeTeleapoLogInputForm() {
  const addBtn = document.getElementById('teleapoLogInputAddBtn');
  const statusEl = document.getElementById('teleapoLogInputStatus');

  if (!addBtn) return;

  const setStatus = (message, type) => {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.classList.remove('text-red-600', 'text-emerald-600', 'text-slate-500');
    if (type === 'error') {
      statusEl.classList.add('text-red-600');
    } else if (type === 'success') {
      statusEl.classList.add('text-emerald-600');
    } else {
      statusEl.classList.add('text-slate-500');
    }
  };

  addBtn.addEventListener('click', () => {
    try {
      const dtInput = document.getElementById('teleapoLogInputDatetime');
      const empInput = document.getElementById('teleapoLogInputEmployee');
      const routeInput = document.getElementById('teleapoLogInputRoute');
      const resInput = document.getElementById('teleapoLogInputResult');
      const targetInput = document.getElementById('teleapoLogInputTarget');
      const telInput = document.getElementById('teleapoLogInputTel');
      const emailInput = document.getElementById('teleapoLogInputEmail');
      const memoInput = document.getElementById('teleapoLogInputMemo');

      const dtValue = dtInput?.value || '';
      const employee = empInput?.value || '';
      const route = routeInput?.value || ROUTE_TEL;
      const result = resInput?.value || '';
      const target = targetInput?.value || '';
      const tel = telInput?.value || '';
      const email = emailInput?.value || '';
      const memo = memoInput?.value || '';

      if (!dtValue || !employee || !result) {
        setStatus('日時・担当者・アポ結果は必須です。', 'error');
        return;
      }

      const dt = new Date(dtValue);
      if (Number.isNaN(dt.getTime())) {
        setStatus('日時の形式が不正です。', 'error');
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
        route,
        target,
        tel,
        email,
        result,
        memo
      });

      handleTeleapoLogDataChanged();

      if (targetInput) targetInput.value = '';
      if (telInput) telInput.value = '';
      if (emailInput) emailInput.value = '';
      if (memoInput) memoInput.value = '';

      setStatus('追加しました。', 'success');
    } catch (e) {
      console.error('新規架電ログ追加中にエラー:', e);
      setStatus('追加に失敗しました。ページを更新してやり直してください。', 'error');
    }
  });
}
function handleTeleapoLogDataChanged() {
  // 1. 社員成績再計算
  teleapoEmployeeMetrics = computeTeleapoEmployeeMetrics();
  const sortSelect = document.getElementById("teleapoEmployeeSortSelect");
  const sortValue = sortSelect?.value || "showRate-desc";
  sortTeleapoEmployees(sortValue);

  // 2. 上部KPI＆グラフ更新
  const chartWrapper = document.getElementById("teleapoEmployeeChartWrapper");

  if (teleapoSummaryScope.type === "company") {
    updateTeleapoSummaryKpiForCompany();
    if (chartWrapper) chartWrapper.classList.add("hidden");
  } else {
    const emp = teleapoEmployeeMetrics.find(
      (e) => e.name === teleapoSummaryScope.name
    );
    if (emp) {
      updateTeleapoSummaryKpiForEmployee(emp.name, emp);
      renderTeleapoEmployeeTrendChart(emp.name, emp);
    } else {
      teleapoSummaryScope = { type: "company", name: "全体" };
      updateTeleapoSummaryKpiForCompany();
      if (chartWrapper) chartWrapper.classList.add("hidden");
    }
  }

  // 3. ヒートマップ更新
  renderTeleapoHeatmap();

  // 4. ログテーブル更新
  renderTeleapoLogTable();
}

// ===== ライフサイクル =====
export function mount() {
  console.log("Teleapo page mounted");

  teleapoLogData = [...teleapoInitialMockLogs];

  initializeTeleapoTabs();          // ★ タブ初期化
  initializeTeleapoDatePickers();
  initializeTeleapoLogInputForm();
  initializeTeleapoLogFilters();
  initializeTeleapoHeatmapControls();
  initializeTeleapoEmployeeSortControls();

  handleTeleapoLogDataChanged();
}

export function unmount() {
  console.log('Teleapo page unmounted');
  // 必要ならイベントリスナーのクリーンアップを追加
}

