// teleapo.js (clean)
console.log('teleapo.js loaded');

const ROUTE_TEL = 'tel';
const ROUTE_OTHER = 'other';
const TELEAPO_EMPLOYEES = ['佐藤','鈴木','高橋','田中'];
const TELEAPO_HEATMAP_DAYS = ['月','火','水','木','金'];
const TELEAPO_HEATMAP_SLOTS = ['09-11','11-13','13-15','15-17','17-19'];

const RESULT_LABELS = {
  connect: '通電',
  set: '設定',
  show: '着座',
  callback: 'コールバック',
  no_answer: '不在'
};

let teleapoLogData = [];
let teleapoFilteredLogs = [];
let teleapoEmployeeMetrics = [];
let teleapoSummaryScope = { type: 'company', name: '全体' };
let teleapoHeatmapRange = '1m';
let teleapoLogSort = { key: 'datetime', dir: 'desc' };
let teleapoEmployeeSortState = { key: 'connectRate', dir: 'desc' };

const teleapoInitialMockLogs = [
  // 同じターゲットに複数回架電した例（1回目不在→2回目通電）
  { datetime: '2025/11/25 09:10', employee: '佐藤', route: ROUTE_TEL, target: 'ABC社 田中様', tel: '03-1111-1111', email: 'tanaka@abc.co.jp', resultCode: 'no_answer', memo: '1回目 不在' },
  { datetime: '2025/11/25 10:00', employee: '佐藤', route: ROUTE_TEL, target: 'ABC社 田中様', tel: '03-1111-1111', email: 'tanaka@abc.co.jp', resultCode: 'connect', memo: '提案内容を説明' },
  { datetime: '2025/11/25 11:30', employee: '鈴木', route: ROUTE_TEL, target: 'XYZ社 鈴木様', tel: '03-2222-2222', email: 'suzuki@xyz.co.jp', resultCode: 'set', memo: '12/2 15:00 商談設定' },
  { datetime: '2025/11/25 14:10', employee: '高橋', route: ROUTE_TEL, target: 'DEF社 佐々木様', tel: '03-3333-3333', email: 'sasaki@def.jp', resultCode: 'no_answer', memo: '再架電希望' },
  { datetime: '2025/11/25 15:45', employee: '田中', route: ROUTE_TEL, target: 'GHI社 高橋様', tel: '03-4444-4444', email: 'takahashi@ghi.jp', resultCode: 'show', memo: '来社確定' },
  { datetime: '2025/11/24 09:20', employee: '佐藤', route: ROUTE_TEL, target: 'JKL社 山田様', tel: '03-5555-5555', email: 'yamada@jkl.jp', resultCode: 'callback', memo: '午後折返し' },
  // 3回目で通電した例
  { datetime: '2025/11/24 12:00', employee: '高橋', route: ROUTE_TEL, target: 'PQR社 中村様', tel: '03-6666-6666', email: 'nakamura@pqr.jp', resultCode: 'no_answer', memo: '1回目 不在' },
  { datetime: '2025/11/24 13:20', employee: '高橋', route: ROUTE_TEL, target: 'PQR社 中村様', tel: '03-6666-6666', email: 'nakamura@pqr.jp', resultCode: 'callback', memo: '2回目 折返し待ち' },
  { datetime: '2025/11/24 13:50', employee: '高橋', route: ROUTE_TEL, target: 'PQR社 中村様', tel: '03-6666-6666', email: 'nakamura@pqr.jp', resultCode: 'connect', memo: '課題ヒアリング' },
  { datetime: '2025/11/24 16:30', employee: '田中', route: ROUTE_TEL, target: 'STU社 佐藤様', tel: '03-7777-7777', email: 'sato@stu.jp', resultCode: 'set', memo: '12/4 10:00 商談' },
  { datetime: '2025/11/23 10:40', employee: '佐藤', route: ROUTE_TEL, target: 'VWX社 小林様', tel: '03-8888-8888', email: 'kobayashi@vwx.jp', resultCode: 'connect', memo: '担当紹介' },
  { datetime: '2025/11/23 14:00', employee: '鈴木', route: ROUTE_OTHER, target: 'YZA社 高田様', tel: '', email: 'takada@yza.jp', resultCode: 'show', memo: 'オンライン面談' },
  { datetime: '2025/11/22 09:15', employee: '高橋', route: ROUTE_TEL, target: 'NEXT 山本様', tel: '03-9999-9999', email: 'abe@next.jp', resultCode: 'connect', memo: '資料送付' },
  { datetime: '2025/11/22 15:05', employee: '佐藤', route: ROUTE_TEL, target: 'INSIGHT 山下様', tel: '03-1212-1212', email: 'yamashita@insight.jp', resultCode: 'set', memo: '11/29 15:00 予定' },
  { datetime: '2025/11/21 10:50', employee: '鈴木', route: ROUTE_TEL, target: 'JOINT 工藤様', tel: '03-1313-1313', email: 'kudo@joint.jp', resultCode: 'show', memo: '来社済み' },
  { datetime: '2025/11/21 16:20', employee: '田中', route: ROUTE_TEL, target: 'LEAD 池田様', tel: '03-1414-1414', email: 'ikeda@lead.jp', resultCode: 'connect', memo: 'フォロー中' },
  // 10月以前のモック（期間広げてもグラフが埋まるように）
  { datetime: '2025/10/05 11:00', employee: '佐藤', route: ROUTE_TEL, target: 'OLD社 佐藤様', tel: '03-2020-2020', email: 'old1@example.jp', resultCode: 'no_answer', memo: '1回目 不在' },
  { datetime: '2025/10/06 14:00', employee: '佐藤', route: ROUTE_TEL, target: 'OLD社 佐藤様', tel: '03-2020-2020', email: 'old1@example.jp', resultCode: 'connect', memo: '2回目 通電' },
  { datetime: '2025/09/28 09:30', employee: '鈴木', route: ROUTE_TEL, target: 'LEGACY社 山口様', tel: '03-3030-3030', email: 'legacy@example.jp', resultCode: 'callback', memo: '1回目 折返し待ち' },
  { datetime: '2025/09/30 10:10', employee: '鈴木', route: ROUTE_TEL, target: 'LEGACY社 山口様', tel: '03-3030-3030', email: 'legacy@example.jp', resultCode: 'show', memo: '2回目 着座' }
];

function parseDateTime(dateTimeStr) {
  if (!dateTimeStr) return null;
  const [datePart, timePart = '00:00'] = dateTimeStr.split(' ');
  const [y, m, d] = (datePart || '').split('/');
  const [hh = '00', mm = '00'] = (timePart || '').split(':');
  if (!y || !m || !d) return null;
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:00`);
}

function normalizeResultCode(raw) {
  const t = (raw || '').toString().toLowerCase();
  if (t.includes('show') || t.includes('着座')) return 'show';
  if (t.includes('set') || t.includes('設定')) return 'set';
  if (t.includes('callback') || t.includes('コールバック')) return 'callback';
  if (t.includes('no_answer') || t.includes('不在')) return 'no_answer';
  if (t.includes('connect') || t.includes('通電')) return 'connect';
  return t || '';
}

function normalizeLog(log) {
  const resultCode = normalizeResultCode(log.resultCode || log.result);
  return {
    ...log,
    route: log.route === ROUTE_OTHER ? ROUTE_OTHER : ROUTE_TEL,
    resultCode,
    result: RESULT_LABELS[resultCode] || log.result || ''
  };
}

function classifyTeleapoResult(log) {
  const code = normalizeResultCode(log.resultCode || log.result);
  return {
    isConnect: ['connect', 'set', 'show', 'callback'].includes(code),
    isSet: ['set', 'show'].includes(code),
    isShow: code === 'show',
    code
  };
}

function getCallKey(log) {
  return log.target || log.tel || log.email || '不明';
}

function annotateCallAttempts(logs) {
  const sorted = [...logs].sort((a, b) => (parseDateTime(a.datetime)?.getTime() || 0) - (parseDateTime(b.datetime)?.getTime() || 0));
  const counters = new Map();
  sorted.forEach(log => {
    const key = getCallKey(log);
    const next = (counters.get(key) || 0) + 1;
    counters.set(key, next);
    log.callAttempt = next;
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatRate(rate) {
  if (rate == null || Number.isNaN(rate)) return '-';
  return `${rate.toFixed(1)}%`;
}

function formatRangeLabel(startStr, endStr) {
  if (!startStr && !endStr) return '';
  if (startStr && endStr) return `${startStr.replace(/-/g,'/')} 〜 ${endStr.replace(/-/g,'/')}`;
  if (startStr) return `${startStr.replace(/-/g,'/')} 〜`;
  return `〜 ${endStr.replace(/-/g,'/')}`;
}

function rateClass(rate) {
  if (rate >= 70) return 'text-green-700';
  if (rate >= 40) return 'text-amber-600';
  return 'text-red-600';
}

function computeKpi(logs) {
  const tel = { attempts: 0, contacts: 0, sets: 0, shows: 0 };
  const other = { attempts: 0, contacts: 0, sets: 0, shows: 0 };

  logs.forEach(log => {
    const bucket = log.route === ROUTE_OTHER ? other : tel;
    const flags = classifyTeleapoResult(log);
    bucket.attempts += 1;
    if (flags.isConnect) bucket.contacts += 1;
    if (flags.isSet) bucket.sets += 1;
    if (flags.isShow) bucket.shows += 1;
  });

  const total = {
    attempts: tel.attempts + other.attempts,
    contacts: tel.contacts + other.contacts,
    sets: tel.sets + other.sets,
    shows: tel.shows + other.shows
  };

  return { tel, other, total };
}

function computeRates(counts) {
  const contactRate = counts.attempts > 0 ? (counts.contacts / counts.attempts) * 100 : null;
  const setRate = counts.contacts > 0 ? (counts.sets / counts.contacts) * 100 : null;
  const showRate = counts.sets > 0 ? (counts.shows / counts.sets) * 100 : null;
  return { contactRate, setRate, showRate };
}

function renderSummary(logs, titleText, scopeLabelText) {
  const kpi = computeKpi(logs);
  const telRates = computeRates(kpi.tel);
  const otherRates = computeRates(kpi.other);
  const totalRates = computeRates(kpi.total);

  setText('teleapoSummaryTitle', titleText || '全体KPI');
  setText('teleapoSummaryScopeLabel', scopeLabelText || '全体');

  setText('teleapoKpiContactRateTel', formatRate(telRates.contactRate));
  setText('teleapoKpiContactRateOther', formatRate(otherRates.contactRate));
  setText('teleapoKpiContactRateTotal', formatRate(totalRates.contactRate));

  setText('teleapoKpiSetRateTel', formatRate(telRates.setRate));
  setText('teleapoKpiSetRateOther', formatRate(otherRates.setRate));
  setText('teleapoKpiSetRateTotal', formatRate(totalRates.setRate));

  setText('teleapoKpiShowRateTel', formatRate(telRates.showRate));
  setText('teleapoKpiShowRateOther', formatRate(otherRates.showRate));
  setText('teleapoKpiShowRateTotal', formatRate(totalRates.showRate));

  setText('teleapoKpiDialsTel', kpi.tel.attempts.toLocaleString());
  setText('teleapoKpiContactsTel', kpi.tel.contacts.toLocaleString());
  setText('teleapoKpiContactsOther', kpi.other.contacts.toLocaleString());
  setText('teleapoKpiContactsTotal', kpi.total.contacts.toLocaleString());
  setText('teleapoKpiSetsTel', kpi.tel.sets.toLocaleString());
  setText('teleapoKpiSetsOther', kpi.other.sets.toLocaleString());
  setText('teleapoKpiSetsTotal', kpi.total.sets.toLocaleString());
  setText('teleapoKpiShowsTel', kpi.tel.shows.toLocaleString());
  setText('teleapoKpiShowsOther', kpi.other.shows.toLocaleString());
  setText('teleapoKpiShowsTotal', kpi.total.shows.toLocaleString());
}

function computeEmployeeMetrics(logs) {
  const telLogs = logs.filter(l => l.route === ROUTE_TEL);
  const map = new Map();
  telLogs.forEach(log => {
    const name = log.employee || '未設定';
    const flags = classifyTeleapoResult(log);
    if (!map.has(name)) map.set(name, { dials: 0, connects: 0, sets: 0, shows: 0 });
    const rec = map.get(name);
    rec.dials += 1;
    if (flags.isConnect) rec.connects += 1;
    if (flags.isSet) rec.sets += 1;
    if (flags.isShow) rec.shows += 1;
  });

  return Array.from(map.entries()).map(([name, rec]) => {
    const connectRate = rec.dials > 0 ? (rec.connects / rec.dials) * 100 : 0;
    const setRate = rec.connects > 0 ? (rec.sets / rec.connects) * 100 : 0;
    const showRate = rec.sets > 0 ? (rec.shows / rec.sets) * 100 : 0;
    return { name, ...rec, connectRate, setRate, showRate };
  });
}

function renderEmployeeTable(metrics) {
  const tbody = document.getElementById('teleapoEmployeeTableBody');
  if (!tbody) return;

  const sortedMetrics = sortEmployeeMetrics(metrics, `${teleapoEmployeeSortState.key}-${teleapoEmployeeSortState.dir}`);

  tbody.innerHTML = sortedMetrics.map(emp => {
    const connectClass = rateClass(emp.connectRate);
    const setClass = rateClass(emp.setRate);
    const showClass = rateClass(emp.showRate);
    return `
      <tr class="teleapo-employee-row hover:bg-slate-50 cursor-pointer" data-employee-name="${emp.name}">
        <td class="font-medium text-slate-800">${emp.name}</td>
        <td class="text-right">${emp.dials}</td>
        <td class="text-right">${emp.connects}</td>
        <td class="text-right">${emp.sets}</td>
        <td class="text-right">${emp.shows}</td>
        <td class="text-right font-semibold ${connectClass}">${emp.connectRate.toFixed(1)}%</td>
        <td class="text-right font-semibold ${setClass}">${emp.setRate.toFixed(1)}%</td>
        <td class="text-right font-semibold ${showClass}">${emp.showRate.toFixed(1)}%</td>
      </tr>
    `;
  }).join('');

  updateEmployeeSortIndicators();
  attachEmployeeRowHandlers();
}

function attachEmployeeRowHandlers() {
  const rows = document.querySelectorAll('.teleapo-employee-row');
  rows.forEach(row => {
    const name = row.dataset.employeeName;
    row.onclick = () => {
      const isCurrent = teleapoSummaryScope.type === "employee" && teleapoSummaryScope.name === name;
      teleapoSummaryScope = isCurrent ? { type: "company", name: "全体" } : { type: "employee", name };
      applyFilters();
    };
  });
  const resetBtn = document.getElementById('teleapoSummaryResetBtn');
  if (resetBtn) resetBtn.onclick = () => {
    teleapoSummaryScope = { type: "company", name: "全体" };
    clearDateFilters();
    applyFilters();
  };
}
function sortEmployeeMetrics(metrics, sortValue) {
  const [key, dir] = sortValue.split('-');
  const factor = dir === 'asc' ? 1 : -1;
  const data = [...metrics];
  data.sort((a, b) => {
    if (key === 'name') return factor * a.name.localeCompare(b.name, 'ja');
    return factor * ((a[key] || 0) - (b[key] || 0));
  });
  return data;
}

function initEmployeeSortHeaders() {
  const headers = document.querySelectorAll('#teleapoEmployeeTableWrapper th[data-sort]');
  headers.forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (!key) return;
      if (teleapoEmployeeSortState.key === key) {
        teleapoEmployeeSortState.dir = teleapoEmployeeSortState.dir === 'asc' ? 'desc' : 'asc';
      } else {
        teleapoEmployeeSortState = { key, dir: 'asc' };
      }
      renderEmployeeTable(teleapoEmployeeMetrics);
    });
  });
  updateEmployeeSortIndicators();
}

function updateEmployeeSortIndicators() {
  const headers = document.querySelectorAll('#teleapoEmployeeTableWrapper th[data-sort]');
  headers.forEach(th => {
    const base = (th.textContent || '').replace(/[▲▼]/g, '').trim();
    if (teleapoEmployeeSortState.key === th.dataset.sort) {
      const arrow = teleapoEmployeeSortState.dir === 'asc' ? '▲' : '▼';
      th.textContent = `${base} ${arrow}`;
    } else {
      th.textContent = base;
    }
  });
}

function renderHeatmap(logs) {
  const tbody = document.getElementById('teleapoHeatmapTableBody');
  const periodLabel = document.getElementById('teleapoHeatmapPeriodLabel');
  if (!tbody) return;

  const now = new Date();
  const from = new Date(now);
  if (teleapoHeatmapRange === '1w') from.setDate(now.getDate() - 7);
  else if (teleapoHeatmapRange === '6m') from.setDate(now.getDate() - 182);
  else from.setDate(now.getDate() - 30);

  if (periodLabel) periodLabel.textContent = `集計期間: ${from.toISOString().slice(0,10)} 〜 ${now.toISOString().slice(0,10)}`;

  const buckets = {};
  TELEAPO_HEATMAP_DAYS.forEach(day => {
    buckets[day] = {};
    TELEAPO_HEATMAP_SLOTS.forEach(slot => { buckets[day][slot] = { dials: 0, connects: 0 }; });
  });

  logs.filter(l => l.route === ROUTE_TEL).forEach(log => {
    const dt = parseDateTime(log.datetime);
    if (!dt || dt < from || dt > now) return;
    const day = '日月火水木金土'[dt.getDay()];
    if (!buckets[day]) return;
    const hour = dt.getHours();
    const slot = hour < 11 ? '09-11' : hour < 13 ? '11-13' : hour < 15 ? '13-15' : hour < 17 ? '15-17' : hour < 19 ? '17-19' : null;
    if (!slot) return;
    const flags = classifyTeleapoResult(log);
    const cell = buckets[day][slot];
    cell.dials += 1;
    if (flags.isConnect) cell.connects += 1;
  });

  tbody.innerHTML = TELEAPO_HEATMAP_SLOTS.map(slot => {
    const cells = TELEAPO_HEATMAP_DAYS.map(day => {
      const c = buckets[day][slot];
      const rate = c.dials ? (c.connects / c.dials) * 100 : null;
      const intensity = rate == null ? 'bg-white' : rate >= 70 ? 'bg-green-100' : rate >= 40 ? 'bg-amber-50' : 'bg-rose-50';
      const text = rate == null ? '-' : `${rate.toFixed(0)}%`;
      return `<td class="px-2 py-2 border border-slate-200 text-center ${intensity}">${text}</td>`;
    }).join('');
    return `<tr><th class="px-3 py-2 border border-slate-200 text-left bg-slate-50">${slot}帯</th>${cells}</tr>`;
  }).join('');
}

function renderLogTable() {
  const tbody = document.getElementById('teleapoLogTableBody');
  if (!tbody) return;

  const sorted = [...teleapoFilteredLogs].sort((a, b) => {
    if (teleapoLogSort.key === 'datetime') {
      const ad = parseDateTime(a.datetime) || 0;
      const bd = parseDateTime(b.datetime) || 0;
      return teleapoLogSort.dir === 'asc' ? ad - bd : bd - ad;
    }
    const valA = a[teleapoLogSort.key] || '';
    const valB = b[teleapoLogSort.key] || '';
    return teleapoLogSort.dir === 'asc' ? `${valA}`.localeCompare(`${valB}`) : `${valB}`.localeCompare(`${valA}`);
  });

  tbody.innerHTML = sorted.map(row => {
    const flags = classifyTeleapoResult(row);
    const badgeClass = flags.code === 'show' ? 'bg-green-100 text-green-700' : flags.code === 'set' ? 'bg-emerald-100 text-emerald-700' : flags.code === 'connect' ? 'bg-blue-100 text-blue-700' : flags.code === 'callback' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700';
    const routeLabel = row.route === ROUTE_OTHER ? 'その他' : '架電';
    return `
      <tr>
        <td class="whitespace-nowrap">${row.datetime}</td>
        <td>${row.employee || ''}</td>
        <td>${routeLabel}</td>
        <td>${row.target || ''}</td>
        <td>${row.tel || ''}</td>
        <td>${row.email || ''}</td>
        <td><span class="px-2 py-1 rounded text-xs font-semibold ${badgeClass}">${RESULT_LABELS[flags.code] || row.result || ''}</span></td>
        <td>${row.memo || ''}</td>
      </tr>
    `;
  }).join('');

  const countEl = document.getElementById('teleapoLogFilterCount');
  if (countEl) countEl.textContent = `${teleapoFilteredLogs.length}件`;
}

function computeAttemptDistribution(logs) {
  const sorted = [...logs]
    .filter(l => l.route === ROUTE_TEL)
    .sort((a, b) => (parseDateTime(a.datetime) - parseDateTime(b.datetime)));

  // targetごとに最終試行回数と、通電した試行回数を記録
  const perTarget = new Map();
  sorted.forEach(log => {
    const key = getCallKey(log);
    let rec = perTarget.get(key);
    if (!rec) rec = { attempts: 0, connectAt: null };
    rec.attempts += 1;
    if (rec.connectAt == null && classifyTeleapoResult(log).isConnect) {
      rec.connectAt = rec.attempts;
    }
    perTarget.set(key, rec);
  });

  const targets = Array.from(perTarget.values());
  const maxAttempt = targets.reduce((m, t) => Math.max(m, t.attempts), 0);

  const buckets = [];
  for (let n = 1; n <= maxAttempt; n++) {
    const reached = targets.filter(t => t.attempts >= n).length;
    const connectedAtN = targets.filter(t => t.connectAt === n).length;
    const rate = reached ? (connectedAtN / reached) * 100 : null;
    buckets.push({ attempt: n, reached, connected: connectedAtN, rate });
  }

  const connects = targets.filter(t => t.connectAt != null).map(t => t.connectAt);
  const average = connects.length ? connects.reduce((s, v) => s + v, 0) / connects.length : 0;
  return { buckets, average, sample: connects.length };
}

function renderAttemptChart(logs) {
  const wrapper = document.getElementById('teleapoAttemptChartWrapper');
  const svg = document.getElementById('teleapoAttemptChart');
  const note = document.getElementById('teleapoAttemptChartNote');
  if (!wrapper || !svg) return;

  const { buckets, average, sample } = computeAttemptDistribution(logs);
  if (!buckets.length) {
    wrapper.classList.add('hidden');
    return;
  }
  wrapper.classList.remove('hidden');
  if (note) note.textContent = `平均 ${average.toFixed(1)} 回目で通電（サンプル${sample}件）`;

  const width = 800;
  // ヒートマップの表の下端と揃うよう、少し余白を増やす
  const height = 240;
  const padding = { top: 20, right: 20, bottom: 50, left: 50 };
  const maxRate = Math.max(...buckets.map(b => b.rate ?? 0), 100);
  const barWidth = (width - padding.left - padding.right) / Math.max(buckets.length, 1) - 10;

  const bars = buckets.map((b, i) => {
    const rateVal = b.rate == null ? 0 : b.rate;
    const x = padding.left + i * (barWidth + 10);
    const h = (rateVal / maxRate) * (height - padding.top - padding.bottom);
    const y = height - padding.bottom - h;
    const label = b.rate == null ? '-' : `${rateVal.toFixed(0)}%`;
    return `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="6" class="fill-indigo-400 opacity-90" />
      <text x="${x + barWidth / 2}" y="${height - padding.bottom + 16}" text-anchor="middle" class="text-[10px] fill-slate-700">${b.attempt}回目</text>
      <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" class="text-[11px] fill-slate-800 font-semibold">${label}</text>
    `;
  }).join('');

  const yAxis = `
    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="rgb(148 163 184)" stroke-width="1" />
    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="rgb(148 163 184)" stroke-width="1" />
    <text x="${padding.left - 10}" y="${padding.top}" text-anchor="end" class="text-[10px] fill-slate-700">100%</text>
    <text x="${padding.left - 10}" y="${height - padding.bottom}" text-anchor="end" class="text-[10px] fill-slate-700">0%</text>
  `;

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.innerHTML = `${yAxis}${bars}`;
}

function renderEmployeeTrendChart(empName, logs) {
  const wrapper = document.getElementById('teleapoEmployeeChartWrapper');
  const svg = document.getElementById('teleapoEmployeeTrendChart');
  const titleEl = document.getElementById('teleapoEmployeeChartTitle');
  if (!wrapper || !svg || !titleEl) return;

  const empLogs = logs.filter(l => l.route === ROUTE_TEL && l.employee === empName);
  if (!empLogs.length) { wrapper.classList.add('hidden'); return; }

  titleEl.textContent = `${empName} さんのKPI推移（架電のみ）`;

  const byDate = new Map();
  empLogs.forEach(log => {
    const date = (log.datetime || '').split(' ')[0];
    const flags = classifyTeleapoResult(log);
    if (!byDate.has(date)) byDate.set(date, { dials: 0, connects: 0, sets: 0, shows: 0 });
    const rec = byDate.get(date);
    rec.dials += 1;
    if (flags.isConnect) rec.connects += 1;
    if (flags.isSet) rec.sets += 1;
    if (flags.isShow) rec.shows += 1;
  });

  const points = Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, rec]) => {
    const connectRate = rec.dials ? (rec.connects / rec.dials) * 100 : 0;
    const setRate = rec.connects ? (rec.sets / rec.connects) * 100 : 0;
    const showRate = rec.sets ? (rec.shows / rec.sets) * 100 : 0;
    return { label: date.slice(5), connectRate, setRate, showRate };
  });

  const width = 800;
  const height = 260;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const maxY = Math.max(...points.map(p => Math.max(p.connectRate, p.setRate, p.showRate)), 100);
  const toX = (i) => padding.left + (i / Math.max(points.length - 1, 1)) * (width - padding.left - padding.right);
  const toY = (v) => height - padding.bottom - (v / Math.max(maxY, 1)) * (height - padding.top - padding.bottom);

  const line = (vals, color) => {
    const d = vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ');
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" />`;
  };

  const connectPath = line(points.map(p => p.connectRate), '#2563eb');
  const setPath = line(points.map(p => p.setRate), '#f59e0b');
  const showPath = line(points.map(p => p.showRate), '#10b981');

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.innerHTML = `
    ${connectPath}
    ${setPath}
    ${showPath}
    ${points.map((p,i)=>`<circle cx="${toX(i)}" cy="${toY(p.connectRate)}" r="4" fill="#2563eb" />`).join('')}
    ${points.map((p,i)=>`<circle cx="${toX(i)}" cy="${toY(p.setRate)}" r="4" fill="#f59e0b" />`).join('')}
    ${points.map((p,i)=>`<circle cx="${toX(i)}" cy="${toY(p.showRate)}" r="4" fill="#10b981" />`).join('')}
    ${points.map((p,i)=>`<text x="${toX(i)}" y="${height - padding.bottom + 16}" text-anchor="middle" class="text-[10px] fill-slate-700">${p.label}</text>`).join('')}
  `;

  wrapper.classList.remove('hidden');
}

function applyFilters() {
  annotateCallAttempts(teleapoLogData);

  const empFilter = document.getElementById('teleapoLogEmployeeFilter')?.value || '';
  const resultFilter = document.getElementById('teleapoLogResultFilter')?.value || '';
  const targetSearch = (document.getElementById('teleapoLogTargetSearch')?.value || '').toLowerCase();
  const startStr = document.getElementById('teleapoLogRangeStart')?.value || document.getElementById('teleapoCompanyRangeStart')?.value || '';
  const endStr = document.getElementById('teleapoLogRangeEnd')?.value || document.getElementById('teleapoCompanyRangeEnd')?.value || '';
  const start = startStr ? new Date(startStr + 'T00:00:00') : null;
  const end = endStr ? new Date(endStr + 'T23:59:59') : null;
  const rangeLabel = formatRangeLabel(startStr, endStr);

  teleapoFilteredLogs = teleapoLogData.filter(log => {
    const dt = parseDateTime(log.datetime);
    if (start && dt && dt < start) return false;
    if (end && dt && dt > end) return false;
    if (empFilter && log.employee !== empFilter) return false;
    if (resultFilter && !(log.result || '').includes(resultFilter) && !(log.resultCode || '').includes(resultFilter)) return false;
    if (targetSearch && !(`${log.target || ''}`.toLowerCase().includes(targetSearch))) return false;
    return true;
  });

  const scopeLogs = teleapoSummaryScope.type === 'employee'
    ? teleapoFilteredLogs.filter(l => l.employee === teleapoSummaryScope.name && l.route === ROUTE_TEL)
    : teleapoFilteredLogs;

  renderSummary(scopeLogs, teleapoSummaryScope.type === 'employee' ? `${teleapoSummaryScope.name}さんのKPI` : '全体KPI', rangeLabel ? `${teleapoSummaryScope.name} / ${rangeLabel}` : teleapoSummaryScope.name);

  teleapoEmployeeMetrics = computeEmployeeMetrics(teleapoFilteredLogs);
  renderEmployeeTable(teleapoEmployeeMetrics);

  if (teleapoSummaryScope.type === 'employee') {
    renderEmployeeTrendChart(teleapoSummaryScope.name, teleapoFilteredLogs);
  } else {
    const wrapper = document.getElementById('teleapoEmployeeChartWrapper');
    if (wrapper) wrapper.classList.add('hidden');
  }

  renderHeatmap(teleapoFilteredLogs);
  renderAttemptChart(teleapoFilteredLogs);
  renderLogTable();
}

function setRangePreset(preset) {
  const today = new Date();
  let start = new Date(today);
  let end = new Date(today);

  if (preset === 'today') {
    // start/end already today
  } else if (preset === 'thisWeek') {
    start.setDate(today.getDate() - 6);
  } else if (preset === 'thisMonth') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (preset === 'last30') {
    start.setDate(today.getDate() - 30);
  } else {
    start.setDate(today.getDate() - 30);
  }

  const startStr = start.toISOString().slice(0,10);
  const endStr = end.toISOString().slice(0,10);

  ['teleapoLogRangeStart','teleapoCompanyRangeStart'].forEach(id => { const el = document.getElementById(id); if (el) el.value = startStr; });
  ['teleapoLogRangeEnd','teleapoCompanyRangeEnd'].forEach(id => { const el = document.getElementById(id); if (el) el.value = endStr; });
}

function clearDateFilters() {
  ['teleapoLogRangeStart','teleapoCompanyRangeStart','teleapoLogRangeEnd','teleapoCompanyRangeEnd']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const companyPreset = document.querySelector('[data-scope=\"company\"]');
  if (companyPreset) companyPreset.querySelectorAll('.kpi-v2-range-btn').forEach(b => b.classList.remove('kpi-v2-range-btn-active'));
}

function initDateInputs() {
  // デフォルトは直近30日でモックデータが含まれるようにする
  setRangePreset('last30');
}

function initFilters() {
  ['teleapoLogEmployeeFilter','teleapoLogResultFilter','teleapoLogTargetSearch','teleapoLogRangeStart','teleapoLogRangeEnd','teleapoCompanyRangeStart','teleapoCompanyRangeEnd'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(id.includes('TargetSearch') ? 'input' : 'change', applyFilters);
  });
  const resetBtn = document.getElementById('teleapoLogFilterReset');
  if (resetBtn) resetBtn.onclick = () => { initDateInputs(); applyFilters(); };
}

function initHeatmapControls() {
  const rangeButtons = document.querySelectorAll('[data-heatmap-range]');
  rangeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      teleapoHeatmapRange = btn.dataset.heatmapRange || '1m';
      rangeButtons.forEach(b => b.classList.remove('kpi-v2-range-btn-active'));
      btn.classList.add('kpi-v2-range-btn-active');
      renderHeatmap(teleapoFilteredLogs);
    });
  });
}

function initEmployeeSort() {
  const select = document.getElementById('teleapoEmployeeSortSelect');
  if (!select) return;
  select.addEventListener('change', () => applyFilters());
}

function initCompanyRangePresets() {
  const presetWrapper = document.querySelector('[data-scope="company"]');
  if (!presetWrapper) return;
  const buttons = presetWrapper.querySelectorAll('.kpi-v2-range-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset || 'thisMonth';
      const isActive = btn.classList.contains('kpi-v2-range-btn-active');
      buttons.forEach(b => b.classList.remove('kpi-v2-range-btn-active'));
      if (isActive) {
        // 同じボタンを再クリック→プリセット解除＆日付クリアで全期間表示
        clearDateFilters();
        applyFilters();
        return;
      }
      setRangePreset(preset);
      btn.classList.add('kpi-v2-range-btn-active');
      applyFilters();
    });
  });
}

function initLogTableSort() {
  const headers = document.querySelectorAll('#teleapoLogTable th.sortable');
  headers.forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (!key) return;
      if (teleapoLogSort.key === key) {
        teleapoLogSort.dir = teleapoLogSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        teleapoLogSort = { key, dir: 'asc' };
      }
      renderLogTable();
    });
  });
}

function initLogForm() {
  const addBtn = document.getElementById('teleapoLogInputAddBtn');
  const statusEl = document.getElementById('teleapoLogInputStatus');
  if (!addBtn) return;

  const setStatus = (msg, type = 'info') => {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.className = type === 'error' ? 'text-red-600' : type === 'success' ? 'text-emerald-600' : 'text-slate-500';
  };

  addBtn.addEventListener('click', () => {
    try {
      const datetime = document.getElementById('teleapoLogInputDatetime')?.value || '';
      const employee = document.getElementById('teleapoLogInputEmployee')?.value || '';
      const route = document.getElementById('teleapoLogInputRoute')?.value || ROUTE_TEL;
      const resultRaw = document.getElementById('teleapoLogInputResult')?.value || '';
      const target = document.getElementById('teleapoLogInputTarget')?.value || '';
      const tel = document.getElementById('teleapoLogInputTel')?.value || '';
      const email = document.getElementById('teleapoLogInputEmail')?.value || '';
      const memo = document.getElementById('teleapoLogInputMemo')?.value || '';

      if (!datetime || !employee || !resultRaw) {
        setStatus('日時・担当・結果は必須です', 'error');
        return;
      }

      const resultCode = normalizeResultCode(resultRaw);
      const newLog = normalizeLog({ datetime: datetime.replace('T', ' '), employee, route, target, tel, email, resultCode, memo });
      const callKey = getCallKey(newLog);
      const attempt = teleapoLogData.filter(l => getCallKey(l) === callKey).length + 1;
      newLog.callAttempt = attempt;

      teleapoLogData.push(newLog);
      applyFilters();
      setStatus('追加しました', 'success');

      ['teleapoLogInputTarget','teleapoLogInputTel','teleapoLogInputEmail','teleapoLogInputMemo'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    } catch (e) {
      console.error(e);
      setStatus('追加に失敗しました', 'error');
    }
  });
}

function initializeData() {
  teleapoLogData = teleapoInitialMockLogs.map(normalizeLog);
  annotateCallAttempts(teleapoLogData);
}

export function mount() {
  initializeData();
  initDateInputs();
  initFilters();
  initCompanyRangePresets();
  initHeatmapControls();
  initEmployeeSort();
  initEmployeeSortHeaders();
  initLogTableSort();
  initLogForm();
  applyFilters();
}

export function unmount() {
  // cleanup if needed
}

// 単独HTMLで読み込まれた場合も初期化できるようにする（ルーターがあれば二重実行を避ける）
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const pageEl = document.querySelector('[data-page="teleapo"]');
    if (!pageEl) return;
    if (window.__teleapoMounted) return;
    window.__teleapoMounted = true;
    mount();
  });
}
