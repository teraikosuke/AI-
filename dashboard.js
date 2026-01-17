const DEBUG = false;

// 初期化フラグ
let initializationFlags = {
  legacyNavigation: false,
  kpiEventListeners: false,
  candidatesManagement: false,
  teleapoManagement: false,
  referralEventListeners: false
};

const sections = document.querySelectorAll(".page-section");
const navLinks = document.querySelectorAll(".nav-link");
const title = document.getElementById("pageTitle");
const subtitle = document.getElementById("pageSubtitle");

const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
if (sidebar && sidebarToggle) {
  const updateSidebarToggleLabel = () => {
    const iconSvg = sidebar.classList.contains("sidebar-collapsed")
      ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5" /></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m18.75 4.5-7.5 7.5 7.5 7.5m-6-15L5.25 12l7.5 7.5" /></svg>`;
    sidebarToggle.innerHTML = iconSvg;
  };
  sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("sidebar-collapsed");
    updateSidebarToggleLabel();
  });
  updateSidebarToggleLabel();
}

const pageMeta = {
  yield: {
    title: "歩留管理（総合）",
    subtitle: "歩留KPIとCA担当一覧をスプレッドシート形式で可視化し滞留を把握",
  },
  candidates: {
    title: "候補者管理",
    subtitle: "応募者の詳細情報と架電履歴を一元管理し、採用プロセスを効率化",
  },
  introduction: {
    title: "各企業の紹介実績管理",
    subtitle: "クライアント／案件別のステージ進捗と候補者タイムラインを整理",
  },
  "ad-performance": {
    title: "広告管理",
    subtitle: "媒体・求人別の主要指標と突合状況をモニタリングし、CSV取込を実行",
  },
  "tele-log": {
    title: "架電管理",
    subtitle: "架電ログと指標カードを一元管理し、CSV取込や手入力で更新",
  },
  teleapo: {
    title: "架電管理",
    subtitle: "架電ログと指標カードを一元管理し、CSV取込や手入力で更新",
  },
};

const jobCatalog = [
  {
    id: "JOB-001",
    title: "フロントエンドエンジニア",
    department: "開発",
  },
  { id: "JOB-002", title: "カスタマーサクセス", department: "CS" },
  { id: "JOB-003", title: "インサイドセールス", department: "営業" },
  {
    id: "JOB-004",
    title: "バックオフィススペシャリスト",
    department: "管理",
  },
];
const jobMap = jobCatalog.reduce((acc, job) => {
  acc[job.id] = job;
  return acc;
}, {});

const currencyRates = {
  JPY: 1,
  USD: 140,
};

const currencyFormatters = {
  JPY: new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }),
  USD: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

const percentFormatter = new Intl.NumberFormat("ja-JP", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const numberFormatter = new Intl.NumberFormat("ja-JP");

const parseDateValue = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const adState = {
  records: [],
  unmatched: [],
  importLog: [],
  filters: {
    from: null,
    to: null,
    media: "all",
    job: "all",
    department: "all",
    granularity: "monthly",
  },
  currency: "JPY",
  selectedJobDetail: "auto",
  latestFilteredRecords: [],
  latestMediaSummary: [],
};

const sampleAdRecords = [
  {
    media: "Indeed",
    job_id: "JOB-001",
    period_start: "2024-04-01",
    period_end: "2024-04-30",
    impressions: 85000,
    clicks: 3300,
    applications: 200,
    introductions: 110,
    hires: 9,
    cost: 210000,
    currency: "JPY",
  },
  {
    media: "Indeed",
    job_id: "JOB-001",
    period_start: "2024-05-01",
    period_end: "2024-05-31",
    impressions: 120000,
    clicks: 5500,
    applications: 420,
    introductions: 210,
    hires: 18,
    cost: 270000,
    currency: "JPY",
  },
  {
    media: "求人ボックス",
    job_id: "JOB-002",
    period_start: "2024-04-01",
    period_end: "2024-04-30",
    impressions: 42000,
    clicks: 1600,
    applications: 115,
    introductions: 60,
    hires: 5,
    cost: 95000,
    currency: "JPY",
  },
  {
    media: "求人ボックス",
    job_id: "JOB-002",
    period_start: "2024-05-01",
    period_end: "2024-05-31",
    impressions: 52000,
    clicks: 1980,
    applications: 156,
    introductions: 84,
    hires: 7,
    cost: 118000,
    currency: "JPY",
  },
  {
    media: "エンポケ",
    job_id: "JOB-003",
    period_start: "2024-04-01",
    period_end: "2024-04-30",
    impressions: 18000,
    clicks: 720,
    applications: 65,
    introductions: 30,
    hires: 3,
    cost: 60000,
    currency: "JPY",
  },
  {
    media: "Indeed",
    job_id: "JOB-003",
    period_start: "2024-05-01",
    period_end: "2024-05-31",
    impressions: 64000,
    clicks: 2400,
    applications: 150,
    introductions: 70,
    hires: 6,
    cost: 1200,
    currency: "USD",
  },
  {
    media: "エンポケ",
    job_id: "JOB-004",
    period_start: "2024-05-01",
    period_end: "2024-05-31",
    impressions: 15000,
    clicks: 640,
    applications: 58,
    introductions: 26,
    hires: 2,
    cost: 72000,
    currency: "JPY",
  },
  {
    media: "エンポケ",
    job_id: "JOB-999",
    period_start: "2024-05-01",
    period_end: "2024-05-31",
    impressions: 12000,
    clicks: 520,
    applications: 80,
    introductions: 40,
    hires: 4,
    cost: 90000,
    currency: "JPY",
  },
];

const currencySelect = document.getElementById("currencySelect");
const adFilterFromInput = document.getElementById("adFilterFrom");
const adFilterToInput = document.getElementById("adFilterTo");
const adFilterMediaSelect = document.getElementById("adFilterMedia");
const adFilterJobSelect = document.getElementById("adFilterJob");
const adFilterDepartmentSelect = document.getElementById("adFilterDepartment");
const adFilterGranularitySelect = document.getElementById(
  "adFilterGranularity"
);
const adFilterApplyBtn = document.getElementById("adFilterApply");
const adFilterResetBtn = document.getElementById("adFilterReset");
const exportMediaSummaryBtn = document.getElementById("exportMediaSummary");
const downloadCsvTemplateBtn = document.getElementById("downloadCsvTemplate");
const loadSampleDataBtn = document.getElementById("loadSampleData");
const adCsvInput = document.getElementById("adCsvInput");
const resolveUnmatchedBtn = document.getElementById("resolveUnmatched");
const clearUnmatchedSelectionsBtn = document.getElementById(
  "clearUnmatchedSelections"
);

const kpiTotalCostEl = document.getElementById("kpiTotalCost");
const kpiTotalCostNoteEl = document.getElementById("kpiTotalCostNote");
const kpiTotalApplicationsEl = document.getElementById("kpiTotalApplications");
const kpiTotalApplicationsNoteEl = document.getElementById(
  "kpiTotalApplicationsNote"
);
const kpiCostApplyEl = document.getElementById("kpiCostApply");
const kpiCostHireEl = document.getElementById("kpiCostHire");

const mediaSummaryTableBody = document.getElementById("mediaSummaryTableBody");
const jobDetailSelect = document.getElementById("jobDetailSelect");
const jobDetailChart = document.getElementById("jobDetailChart");
const jobDetailSummary = document.getElementById("jobDetailSummary");
const jobDetailTableBody = document.getElementById("jobDetailTableBody");

const unmatchedEmptyState = document.getElementById("unmatchedEmptyState");
const unmatchedTableWrapper = document.getElementById("unmatchedTableWrapper");
const unmatchedTableBody = document.getElementById("unmatchedTableBody");
const importLogBody = document.getElementById("importLogBody");

const convertBaseToCurrency = (baseValue, currency) => {
  if (!currencyRates[currency]) return null;
  return baseValue / currencyRates[currency];
};

const formatSelectedCurrency = (baseValue) => {
  if (baseValue === null || baseValue === undefined) return "—";
  const formatter = currencyFormatters[adState.currency];
  if (!formatter) return "—";
  const converted = convertBaseToCurrency(baseValue, adState.currency);
  if (!Number.isFinite(converted)) return "—";
  return formatter.format(converted);
};

const formatCostPer = (baseCost, denominator) => {
  if (!denominator) return "—";
  const perUnitBase = baseCost / denominator;
  if (!Number.isFinite(perUnitBase)) return "—";
  return formatSelectedCurrency(perUnitBase);
};

const formatPercent = (value) => {
  if (!Number.isFinite(value)) return "—";
  return `${percentFormatter.format(value)}%`;
};

const formatNumber = (value) => {
  if (value === null || value === undefined) return "—";
  return numberFormatter.format(value);
};

const getJobInfo = (jobId) => jobMap[jobId] || null;
const getJobDisplayName = (jobId) => {
  const info = getJobInfo(jobId);
  return info ? `${info.title}（${info.department}）` : jobId;
};

const normalizeEndDate = (date) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  );

const formatDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return "-";
  const start = `${startDate.getFullYear()}/${String(
    startDate.getMonth() + 1
  ).padStart(2, "0")}/${String(startDate.getDate()).padStart(2, "0")}`;
  const end = `${endDate.getFullYear()}/${String(
    endDate.getMonth() + 1
  ).padStart(2, "0")}/${String(endDate.getDate()).padStart(2, "0")}`;
  return `${start}〜${end}`;
};

const formatPeriodLabel = (date, granularity) => {
  if (!date) return "-";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (granularity === "daily") return `${year}/${month}/${day}`;
  if (granularity === "weekly") {
    const week = Math.ceil(date.getDate() / 7);
    return `${year}/${month} W${week}`;
  }
  return `${year}/${month}`;
};

const getPeriodKey = (date, granularity) => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  if (granularity === "daily") return `${y}-${m}-${d}`;
  if (granularity === "weekly") {
    const week = Math.ceil(date.getDate() / 7);
    return `${y}-${m}-W${week}`;
  }
  return `${y}-${m}`;
};

const buildRecordFromRaw = (raw, rowIndex, sourceLabel) => {
  const errors = [];
  const media = (raw.media || "").trim();
  const jobIdRaw = (raw.job_id || "").trim();
  const periodStart = parseDateValue(raw.period_start);
  const periodEnd = parseDateValue(raw.period_end);

  if (!media) errors.push("media が空です");
  if (!jobIdRaw) errors.push("job_id が空です");
  if (!periodStart || !periodEnd) errors.push("期間が不正です");

  const numericFields = [
    "impressions",
    "clicks",
    "applications",
    "introductions",
    "hires",
  ];
  const parsedNumbers = {};
  numericFields.forEach((field) => {
    const value = raw[field];
    const parsedValue =
      value === "" || value === null || value === undefined ? 0 : Number(value);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      errors.push(`${field} が不正です`);
    } else {
      parsedNumbers[field] = parsedValue;
    }
  });

  const costValue =
    raw.cost === "" || raw.cost === null || raw.cost === undefined
      ? 0
      : Number(raw.cost);
  if (!Number.isFinite(costValue) || costValue < 0) {
    errors.push("cost が不正です");
  }

  const currency = (raw.currency || "").trim().toUpperCase();
  if (!currencyRates[currency]) {
    errors.push(`currency (${currency || "-"}) が未対応です`);
  }

  if (
    parsedNumbers.impressions < parsedNumbers.clicks ||
    parsedNumbers.clicks < parsedNumbers.applications
  ) {
    errors.push(
      "impressions >= clicks >= applications の条件を満たしていません"
    );
  }
  if (parsedNumbers.introductions > parsedNumbers.applications) {
    errors.push("introductions は applications 以下である必要があります");
  }
  if (parsedNumbers.hires > parsedNumbers.introductions) {
    errors.push("hires は introductions 以下である必要があります");
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  const baseCost = costValue * currencyRates[currency];
  return {
    ok: true,
    record: {
      media,
      jobId: jobIdRaw,
      periodStart,
      periodEnd,
      impressions: parsedNumbers.impressions,
      clicks: parsedNumbers.clicks,
      applications: parsedNumbers.applications,
      introductions: parsedNumbers.introductions,
      hires: parsedNumbers.hires,
      cost: costValue,
      currency,
      baseCost,
      sourceRow: rowIndex,
      source: sourceLabel,
    },
  };
};

const ingestRecords = (rawRecords, options = {}) => {
  const { mode = "append", fileName = "CSV", sourceLabel = fileName } = options;
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    return {
      total: 0,
      success: 0,
      unmatched: 0,
      errors: ["レコードがありません"],
      fileName,
      timestamp: new Date(),
    };
  }

  if (mode === "replace") {
    adState.records = [];
    adState.unmatched = [];
  }

  const addedRecords = [];
  const newlyUnmatched = [];
  const errorMessages = [];

  rawRecords.forEach((raw, index) => {
    const result = buildRecordFromRaw(raw, index + 1, sourceLabel);
    if (!result.ok) {
      result.errors.forEach((err) =>
        errorMessages.push(`Row ${index + 1}: ${err}`)
      );
      return;
    }

    const normalized = result.record;
    const jobInfo = getJobInfo(normalized.jobId);
    if (!jobInfo) {
      newlyUnmatched.push({
        id: `${Date.now()}-${index}`,
        rawJobId: normalized.jobId,
        selectedJobId: "",
        record: { ...normalized, jobId: null },
      });
      return;
    }

    addedRecords.push(normalized);
  });

  adState.records.push(...addedRecords);
  adState.unmatched.push(...newlyUnmatched);

  const summary = {
    total: rawRecords.length,
    success: addedRecords.length,
    unmatched: newlyUnmatched.length,
    errors: errorMessages,
    fileName,
    timestamp: new Date(),
  };

  adState.importLog.unshift(summary);
  if (adState.importLog.length > 25) {
    adState.importLog.length = 25;
  }

  updateFilterOptions();
  renderImportLog();
  renderUnmatchedQueue();
  renderAdvertisingPerformance();
  return summary;
};

const parseCsvText = (text) => {
  const sanitized = text.replace(/\r\n/g, "\n").trim();
  if (!sanitized) return [];
  const rows = [];
  let current = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < sanitized.length; i += 1) {
    const char = sanitized[i];
    if (char === '"') {
      if (inQuotes && sanitized[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      current.push(field);
      field = "";
    } else if (char === "\n" && !inQuotes) {
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
    } else {
      field += char;
    }
  }
  current.push(field);
  rows.push(current);

  const nonEmptyRows = rows.filter((row) =>
    row.some((value) => value !== null && value !== undefined && value !== "")
  );
  if (!nonEmptyRows.length) return [];

  const header = nonEmptyRows[0].map((col) => col.trim());
  const dataRows = nonEmptyRows.slice(1);

  return dataRows.map((row) => {
    const record = {};
    header.forEach((col, idx) => {
      record[col] = row[idx] !== undefined ? row[idx].trim() : "";
    });
    return record;
  });
};

const updateFilterOptions = () => {
  const mediaValues = Array.from(
    new Set(adState.records.map((r) => r.media))
  ).sort();
  const departmentValues = Array.from(
    new Set(jobCatalog.map((job) => job.department))
  ).sort();

  const currentMedia = adState.filters.media;
  if (!adFilterMediaSelect) {
    console.warn('adFilterMediaSelect element not found, skipping media filter update');
  } else {
    adFilterMediaSelect.innerHTML = '<option value="all">すべて</option>';
    mediaValues.forEach((media) => {
      const option = document.createElement("option");
      option.value = media;
      option.textContent = media;
      adFilterMediaSelect.appendChild(option);
    });
    if (currentMedia && currentMedia !== "all") {
      adFilterMediaSelect.value = mediaValues.includes(currentMedia)
        ? currentMedia
        : "all";
      adState.filters.media = adFilterMediaSelect.value;
    }
  }

  const currentJob = adState.filters.job;
  if (!adFilterJobSelect) {
    console.warn('adFilterJobSelect element not found, skipping job filter update');
  } else {
    adFilterJobSelect.innerHTML = '<option value="all">すべて</option>';
    jobCatalog.forEach((job) => {
      const option = document.createElement("option");
      option.value = job.id;
      option.textContent = `${job.title}（${job.department}）`;
      adFilterJobSelect.appendChild(option);
    });
    if (currentJob && currentJob !== "all") {
      adFilterJobSelect.value = jobMap[currentJob] ? currentJob : "all";
      adState.filters.job = adFilterJobSelect.value;
    }
  }

  const currentDepartment = adState.filters.department;
  if (!adFilterDepartmentSelect) {
    console.warn('adFilterDepartmentSelect element not found, skipping department filter update');
  } else {
    adFilterDepartmentSelect.innerHTML = '<option value="all">すべて</option>';
    departmentValues.forEach((dept) => {
      const option = document.createElement("option");
      option.value = dept;
      option.textContent = dept;
      adFilterDepartmentSelect.appendChild(option);
    });
    if (currentDepartment && currentDepartment !== "all") {
      adFilterDepartmentSelect.value = departmentValues.includes(
        currentDepartment
      )
        ? currentDepartment
        : "all";
      adState.filters.department = adFilterDepartmentSelect.value;
    }
  }
};

const readAdFiltersFromInputs = () => {
  const fromDate = adFilterFromInput ? parseDateValue(adFilterFromInput.value) : null;
  const toDateRaw = adFilterToInput ? parseDateValue(adFilterToInput.value) : null;
  adState.filters = {
    from: fromDate,
    to: toDateRaw ? normalizeEndDate(toDateRaw) : null,
    media: adFilterMediaSelect ? adFilterMediaSelect.value || "all" : "all",
    job: adFilterJobSelect ? adFilterJobSelect.value || "all" : "all",
    department: adFilterDepartmentSelect ? adFilterDepartmentSelect.value || "all" : "all",
    granularity: adFilterGranularitySelect ? adFilterGranularitySelect.value || "monthly" : "monthly",
  };

  if (adState.filters.job !== "all" && jobDetailSelect) {
    adState.selectedJobDetail = adState.filters.job;
    jobDetailSelect.value = adState.filters.job;
  } else if (jobDetailSelect && jobDetailSelect.value !== "auto") {
    jobDetailSelect.value = "auto";
    adState.selectedJobDetail = "auto";
  }
};

const resetAdFilters = () => {
  if (adFilterFromInput) adFilterFromInput.value = "";
  if (adFilterToInput) adFilterToInput.value = "";
  if (adFilterMediaSelect) adFilterMediaSelect.value = "all";
  if (adFilterJobSelect) adFilterJobSelect.value = "all";
  if (adFilterDepartmentSelect) adFilterDepartmentSelect.value = "all";
  if (adFilterGranularitySelect) adFilterGranularitySelect.value = "monthly";
  adState.filters = {
    from: null,
    to: null,
    media: "all",
    job: "all",
    department: "all",
    granularity: "monthly",
  };
  adState.selectedJobDetail = "auto";
  if (jobDetailSelect) jobDetailSelect.value = "auto";
  renderAdvertisingPerformance();
};

const getFilteredAdRecords = () => {
  const { from, to, media, job, department } = adState.filters;
  return adState.records.filter((record) => {
    if (from && record.periodEnd < from) return false;
    if (to && record.periodStart > to) return false;
    if (media !== "all" && record.media !== media) return false;
    if (job !== "all" && record.jobId !== job) return false;
    if (department !== "all") {
      const info = getJobInfo(record.jobId);
      if (!info || info.department !== department) return false;
    }
    return true;
  });
};

const computeMediaSummary = (records) => {
  const mediaMap = new Map();
  records.forEach((record) => {
    if (!mediaMap.has(record.media)) {
      mediaMap.set(record.media, {
        media: record.media,
        baseCost: 0,
        impressions: 0,
        clicks: 0,
        applications: 0,
        introductions: 0,
        hires: 0,
      });
    }
    const bucket = mediaMap.get(record.media);
    bucket.baseCost += record.baseCost;
    bucket.impressions += record.impressions;
    bucket.clicks += record.clicks;
    bucket.applications += record.applications;
    bucket.introductions += record.introductions;
    bucket.hires += record.hires;
  });

  return Array.from(mediaMap.values()).sort((a, b) => b.baseCost - a.baseCost);
};

const updateKpis = (records) => {
  const totalCostBase = records.reduce(
    (sum, record) => sum + record.baseCost,
    0
  );
  const totalApplications = records.reduce(
    (sum, record) => sum + record.applications,
    0
  );
  const totalHires = records.reduce((sum, record) => sum + record.hires, 0);

  if (kpiTotalCostEl) {
    kpiTotalCostEl.textContent = formatSelectedCurrency(totalCostBase);
  }
  if (kpiTotalApplicationsEl) {
    kpiTotalApplicationsEl.textContent = formatNumber(totalApplications);
  }
  if (kpiCostApplyEl) {
    kpiCostApplyEl.textContent = formatCostPer(totalCostBase, totalApplications);
  }
  if (kpiCostHireEl) {
    kpiCostHireEl.textContent = formatCostPer(totalCostBase, totalHires);
  }
  if (kpiTotalCostNoteEl) {
    kpiTotalCostNoteEl.textContent = `データ件数: ${records.length}`;
  }
  if (kpiTotalApplicationsNoteEl) {
    kpiTotalApplicationsNoteEl.textContent =
      totalApplications === 0 ? "応募実績なし" : "媒体経由応募";
  }
};

const renderMediaSummary = (summary) => {
  if (!mediaSummaryTableBody) {
    console.warn('mediaSummaryTableBody element not found, skipping renderMediaSummary');
    return;
  }

  mediaSummaryTableBody.innerHTML = "";
  if (!summary.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 12;
    cell.className = "text-center text-slate-500 py-6";
    cell.textContent = "データがありません。";
    row.appendChild(cell);
    mediaSummaryTableBody.appendChild(row);
    return;
  }

  summary.forEach((item) => {
    const ctr = item.impressions
      ? (item.clicks / item.impressions) * 100
      : null;
    const cvr = item.clicks ? (item.applications / item.clicks) * 100 : null;

    const row = document.createElement("tr");
    row.innerHTML = `
            <td>${item.media}</td>
            <td>${formatSelectedCurrency(item.baseCost)}</td>
            <td>${formatNumber(item.impressions)}</td>
            <td>${formatNumber(item.clicks)}</td>
            <td>${formatNumber(item.applications)}</td>
            <td>${formatNumber(item.introductions)}</td>
            <td>${formatNumber(item.hires)}</td>
            <td>${formatPercent(ctr)}</td>
            <td>${formatPercent(cvr)}</td>
            <td>${formatCostPer(item.baseCost, item.applications)}</td>
            <td>${formatCostPer(item.baseCost, item.introductions)}</td>
            <td>${formatCostPer(item.baseCost, item.hires)}</td>
          `;
    mediaSummaryTableBody.appendChild(row);
  });
};

const aggregateJobTimeline = (records) => {
  const granularity = adState.filters.granularity;
  const bucketMap = new Map();
  records.forEach((record) => {
    const key = getPeriodKey(record.periodStart, granularity);
    if (!bucketMap.has(key)) {
      bucketMap.set(key, {
        periodKey: key,
        periodLabel: formatPeriodLabel(record.periodStart, granularity),
        baseCost: 0,
        impressions: 0,
        clicks: 0,
        applications: 0,
        introductions: 0,
        hires: 0,
      });
    }
    const bucket = bucketMap.get(key);
    bucket.baseCost += record.baseCost;
    bucket.impressions += record.impressions;
    bucket.clicks += record.clicks;
    bucket.applications += record.applications;
    bucket.introductions += record.introductions;
    bucket.hires += record.hires;
  });

  return Array.from(bucketMap.values()).sort((a, b) =>
    a.periodKey.localeCompare(b.periodKey)
  );
};

const drawJobDetailChart = (timeline) => {
  if (!jobDetailChart) {
    console.warn('jobDetailChart element not found, skipping chart rendering');
    return;
  }

  jobDetailChart.innerHTML = "";
  const width = 600;
  const height = 260;
  const padding = { top: 24, right: 32, bottom: 48, left: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  if (!timeline.length) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", width / 2);
    text.setAttribute("y", height / 2);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", "#94a3b8");
    text.textContent = "データがありません";
    jobDetailChart.appendChild(text);
    return;
  }

  const costValues = timeline.map((item) =>
    convertBaseToCurrency(item.baseCost, adState.currency)
  );
  const costMax = Math.max(...costValues, 0);
  const countMax = Math.max(
    ...timeline.map((item) =>
      Math.max(item.applications, item.introductions, item.hires)
    ),
    0
  );

  const xStep = timeline.length > 1 ? plotWidth / (timeline.length - 1) : 0;
  const toX = (index) => padding.left + xStep * index;
  const toY = (value, max) => {
    if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
      return padding.top + plotHeight;
    }
    const ratio = value / max;
    return padding.top + plotHeight * (1 - ratio);
  };

  const svgNS = "http://www.w3.org/2000/svg";

  const axes = document.createElementNS(svgNS, "g");
  axes.setAttribute("stroke", "#cbd5f5");
  axes.setAttribute("stroke-width", "1");
  axes.innerHTML = `
          <line x1="${padding.left}" y1="${padding.top + plotHeight}" x2="${padding.left + plotWidth
    }" y2="${padding.top + plotHeight}" />
          <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left
    }" y2="${padding.top + plotHeight}" />
          <line x1="${padding.left + plotWidth}" y1="${padding.top}" x2="${padding.left + plotWidth
    }" y2="${padding.top + plotHeight}" stroke-dasharray="4 4" />
        `;
  jobDetailChart.appendChild(axes);

  const buildPath = (values, max) => {
    if (!values.length) return "";
    return values
      .map((value, index) => {
        const x = toX(index);
        const y = toY(value, max);
        return `${index === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  };

  const costPath = document.createElementNS(svgNS, "path");
  costPath.setAttribute("d", buildPath(costValues, costMax || 1));
  costPath.setAttribute("fill", "none");
  costPath.setAttribute("stroke", "#6366f1");
  costPath.setAttribute("stroke-width", "2.5");
  jobDetailChart.appendChild(costPath);

  const applicationsPath = document.createElementNS(svgNS, "path");
  applicationsPath.setAttribute(
    "d",
    buildPath(
      timeline.map((item) => item.applications),
      countMax || 1
    )
  );
  applicationsPath.setAttribute("fill", "none");
  applicationsPath.setAttribute("stroke", "#10b981");
  applicationsPath.setAttribute("stroke-width", "2");
  jobDetailChart.appendChild(applicationsPath);

  const introductionsPath = document.createElementNS(svgNS, "path");
  introductionsPath.setAttribute(
    "d",
    buildPath(
      timeline.map((item) => item.introductions),
      countMax || 1
    )
  );
  introductionsPath.setAttribute("fill", "none");
  introductionsPath.setAttribute("stroke", "#0ea5e9");
  introductionsPath.setAttribute("stroke-width", "2");
  jobDetailChart.appendChild(introductionsPath);

  const hiresPath = document.createElementNS(svgNS, "path");
  hiresPath.setAttribute(
    "d",
    buildPath(
      timeline.map((item) => item.hires),
      countMax || 1
    )
  );
  hiresPath.setAttribute("fill", "none");
  hiresPath.setAttribute("stroke", "#f59e0b");
  hiresPath.setAttribute("stroke-width", "2");
  jobDetailChart.appendChild(hiresPath);

  timeline.forEach((item, index) => {
    const cx = toX(index);
    const costY = toY(costValues[index], costMax || 1);
    const costDot = document.createElementNS(svgNS, "circle");
    costDot.setAttribute("cx", cx);
    costDot.setAttribute("cy", costY);
    costDot.setAttribute("r", "3");
    costDot.setAttribute("fill", "#4f46e5");
    jobDetailChart.appendChild(costDot);
  });

  timeline.forEach((item, index) => {
    const x = toX(index);
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", x);
    label.setAttribute("y", padding.top + plotHeight + 24);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("fill", "#64748b");
    label.setAttribute("font-size", "12");
    label.textContent = item.periodLabel;
    jobDetailChart.appendChild(label);
  });

  const costAxisLabel = document.createElementNS(svgNS, "text");
  costAxisLabel.setAttribute("x", padding.left);
  costAxisLabel.setAttribute("y", padding.top - 8);
  costAxisLabel.setAttribute("text-anchor", "start");
  costAxisLabel.setAttribute("fill", "#475569");
  costAxisLabel.setAttribute("font-size", "12");
  costAxisLabel.textContent = `費用 (${adState.currency})`;
  jobDetailChart.appendChild(costAxisLabel);

  const countAxisLabel = document.createElementNS(svgNS, "text");
  countAxisLabel.setAttribute("x", width - padding.right);
  countAxisLabel.setAttribute("y", padding.top - 8);
  countAxisLabel.setAttribute("text-anchor", "end");
  countAxisLabel.setAttribute("fill", "#475569");
  countAxisLabel.setAttribute("font-size", "12");
  countAxisLabel.textContent = "件数";
  jobDetailChart.appendChild(countAxisLabel);
};

const renderJobDetailSummary = (records) => {
  if (!jobDetailSummary) {
    console.warn('jobDetailSummary element not found, skipping renderJobDetailSummary');
    return;
  }

  const fields = jobDetailSummary.querySelectorAll("dd");
  if (!records.length) {
    fields.forEach((field) => {
      field.textContent = "-";
    });
    return;
  }

  const totals = records.reduce(
    (acc, record) => {
      acc.baseCost += record.baseCost;
      acc.applications += record.applications;
      acc.introductions += record.introductions;
      acc.hires += record.hires;
      acc.impressions += record.impressions;
      acc.clicks += record.clicks;
      return acc;
    },
    {
      baseCost: 0,
      applications: 0,
      introductions: 0,
      hires: 0,
      impressions: 0,
      clicks: 0,
    }
  );

  const ctr = totals.impressions
    ? (totals.clicks / totals.impressions) * 100
    : null;
  const cvr = totals.clicks
    ? (totals.applications / totals.clicks) * 100
    : null;

  jobDetailSummary.querySelector('dd[data-field="cost"]').textContent =
    formatSelectedCurrency(totals.baseCost);
  jobDetailSummary.querySelector('dd[data-field="applications"]').textContent =
    formatNumber(totals.applications);
  jobDetailSummary.querySelector('dd[data-field="introductions"]').textContent =
    formatNumber(totals.introductions);
  jobDetailSummary.querySelector('dd[data-field="hires"]').textContent =
    formatNumber(totals.hires);
  jobDetailSummary.querySelector('dd[data-field="ctr"]').textContent =
    formatPercent(ctr);
  jobDetailSummary.querySelector('dd[data-field="cvr"]').textContent =
    formatPercent(cvr);
  jobDetailSummary.querySelector('dd[data-field="cpa"]').textContent =
    formatCostPer(totals.baseCost, totals.applications);
  jobDetailSummary.querySelector('dd[data-field="cph"]').textContent =
    formatCostPer(totals.baseCost, totals.hires);
};

const renderJobDetailTable = (records) => {
  if (!jobDetailTableBody) {
    console.warn('jobDetailTableBody element not found, skipping renderJobDetailTable');
    return;
  }

  jobDetailTableBody.innerHTML = "";
  if (!records.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 12;
    cell.className = "text-center text-slate-500 py-6";
    cell.textContent = "該当データがありません。";
    row.appendChild(cell);
    jobDetailTableBody.appendChild(row);
    return;
  }

  const granularity = adState.filters.granularity;
  const bucketMap = new Map();
  records.forEach((record) => {
    const periodKey = getPeriodKey(record.periodStart, granularity);
    const periodLabel = formatPeriodLabel(record.periodStart, granularity);

    const allKey = `${periodKey}::ALL`;
    if (!bucketMap.has(allKey)) {
      bucketMap.set(allKey, {
        periodKey,
        periodLabel,
        media: "合計",
        baseCost: 0,
        impressions: 0,
        clicks: 0,
        applications: 0,
        introductions: 0,
        hires: 0,
      });
    }
    const allBucket = bucketMap.get(allKey);
    allBucket.baseCost += record.baseCost;
    allBucket.impressions += record.impressions;
    allBucket.clicks += record.clicks;
    allBucket.applications += record.applications;
    allBucket.introductions += record.introductions;
    allBucket.hires += record.hires;

    const mediaKey = `${periodKey}::${record.media}`;
    if (!bucketMap.has(mediaKey)) {
      bucketMap.set(mediaKey, {
        periodKey,
        periodLabel,
        media: record.media,
        baseCost: 0,
        impressions: 0,
        clicks: 0,
        applications: 0,
        introductions: 0,
        hires: 0,
      });
    }
    const mediaBucket = bucketMap.get(mediaKey);
    mediaBucket.baseCost += record.baseCost;
    mediaBucket.impressions += record.impressions;
    mediaBucket.clicks += record.clicks;
    mediaBucket.applications += record.applications;
    mediaBucket.introductions += record.introductions;
    mediaBucket.hires += record.hires;
  });

  const rows = Array.from(bucketMap.values()).sort((a, b) => {
    if (a.periodKey === b.periodKey) {
      if (a.media === "合計") return -1;
      if (b.media === "合計") return 1;
      return a.media.localeCompare(b.media);
    }
    return b.periodKey.localeCompare(a.periodKey);
  });

  rows.forEach((row) => {
    const highlight =
      row.hires === 0 && row.introductions > 0
        ? "入社0件"
        : row.applications === 0
          ? "応募0件"
          : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>${row.periodLabel}</td>
            <td>${row.media}</td>
            <td>${formatSelectedCurrency(row.baseCost)}</td>
            <td>${formatNumber(row.impressions)}</td>
            <td>${formatNumber(row.clicks)}</td>
            <td>${formatNumber(row.applications)}</td>
            <td>${formatNumber(row.introductions)}</td>
            <td>${formatNumber(row.hires)}</td>
            <td>${formatCostPer(row.baseCost, row.applications)}</td>
            <td>${formatCostPer(row.baseCost, row.introductions)}</td>
            <td>${formatCostPer(row.baseCost, row.hires)}</td>
            <td class="${highlight ? "text-amber-600 font-semibold" : "text-slate-500"
      }">
              ${highlight || "—"}
            </td>
          `;
    jobDetailTableBody.appendChild(tr);
  });
};

const updateJobDetailSelectOptions = (jobIds) => {
  if (!jobDetailSelect) {
    console.warn('jobDetailSelect element not found, skipping job detail select update');
    return;
  }

  const existingValue = jobDetailSelect.value;
  jobDetailSelect.innerHTML =
    '<option value="auto">フィルター結果から自動選択</option>';
  jobIds.forEach((jobId) => {
    const option = document.createElement("option");
    option.value = jobId;
    option.textContent = getJobDisplayName(jobId);
    jobDetailSelect.appendChild(option);
  });

  if (
    existingValue &&
    existingValue !== "auto" &&
    jobIds.includes(existingValue)
  ) {
    jobDetailSelect.value = existingValue;
  } else {
    jobDetailSelect.value = "auto";
    adState.selectedJobDetail = "auto";
  }
};

const renderJobDetail = (records) => {
  const jobIds = Array.from(new Set(records.map((record) => record.jobId)));
  jobIds.sort();
  updateJobDetailSelectOptions(jobIds);

  let targetJobId =
    adState.selectedJobDetail === "auto"
      ? jobIds[0] || null
      : adState.selectedJobDetail;
  if (targetJobId && !jobIds.includes(targetJobId)) {
    targetJobId = jobIds[0] || null;
  }

  if (!targetJobId) {
    drawJobDetailChart([]);
    renderJobDetailSummary([]);
    renderJobDetailTable([]);
    return;
  }

  const jobRecords = records.filter((record) => record.jobId === targetJobId);
  const timeline = aggregateJobTimeline(jobRecords);
  drawJobDetailChart(timeline);
  renderJobDetailSummary(jobRecords);
  renderJobDetailTable(jobRecords);
};

const renderUnmatchedQueue = () => {
  if (!unmatchedTableBody) {
    console.warn('unmatchedTableBody element not found, skipping renderUnmatchedQueue');
    return;
  }

  unmatchedTableBody.innerHTML = "";
  if (!adState.unmatched.length) {
    unmatchedEmptyState.classList.remove("hidden");
    unmatchedTableWrapper.classList.add("hidden");
    return;
  }

  unmatchedEmptyState.classList.add("hidden");
  unmatchedTableWrapper.classList.remove("hidden");

  adState.unmatched.forEach((entry, index) => {
    const record = entry.record;
    const row = document.createElement("tr");
    row.innerHTML = `
            <td>${record.media}</td>
            <td>${entry.rawJobId}</td>
            <td>${formatDateRange(record.periodStart, record.periodEnd)}</td>
            <td>${formatSelectedCurrency(record.baseCost)}</td>
            <td>${formatNumber(record.applications)}</td>
            <td>${formatNumber(record.hires)}</td>
            <td></td>
          `;

    const selectCell = row.lastElementChild;
    const select = document.createElement("select");
    select.className =
      "bg-white border border-slate-300 rounded-md px-2 py-1 text-sm";
    select.dataset.index = index;
    select.innerHTML = '<option value="">求人を選択</option>';
    jobCatalog.forEach((job) => {
      const option = document.createElement("option");
      option.value = job.id;
      option.textContent = `${job.title}（${job.department}）`;
      select.appendChild(option);
    });
    select.value = entry.selectedJobId || "";
    select.addEventListener("change", (event) => {
      const idx = Number(event.target.dataset.index);
      if (!Number.isNaN(idx) && adState.unmatched[idx]) {
        adState.unmatched[idx].selectedJobId = event.target.value;
      }
    });
    selectCell.appendChild(select);

    unmatchedTableBody.appendChild(row);
  });
};

const renderImportLog = () => {
  if (!importLogBody) {
    console.warn('importLogBody element not found, skipping renderImportLog');
    return;
  }

  importLogBody.innerHTML = "";
  if (!adState.importLog.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.className = "text-center text-slate-500 py-4";
    cell.textContent = "取込履歴はまだありません。";
    row.appendChild(cell);
    importLogBody.appendChild(row);
    return;
  }

  adState.importLog.forEach((entry) => {
    const row = document.createElement("tr");
    const timestamp = `${entry.timestamp.getFullYear()}/${String(
      entry.timestamp.getMonth() + 1
    ).padStart(2, "0")}/${String(entry.timestamp.getDate()).padStart(
      2,
      "0"
    )} ${String(entry.timestamp.getHours()).padStart(2, "0")}:${String(
      entry.timestamp.getMinutes()
    ).padStart(2, "0")}`;
    const resultText =
      entry.errors && entry.errors.length
        ? `エラー ${entry.errors.length}件`
        : entry.unmatched
          ? `未突合 ${entry.unmatched}件`
          : "完了";
    const resultClass =
      entry.errors && entry.errors.length
        ? "text-rose-600 font-semibold"
        : entry.unmatched
          ? "text-amber-600 font-semibold"
          : "text-emerald-600 font-semibold";
    row.innerHTML = `
            <td>${timestamp}</td>
            <td>${entry.fileName}</td>
            <td>${entry.total}件</td>
            <td class="${resultClass}">${resultText}</td>
          `;
    importLogBody.appendChild(row);
  });
};

const renderAdvertisingPerformance = () => {
  const filteredRecords = getFilteredAdRecords();
  adState.latestFilteredRecords = filteredRecords;
  updateKpis(filteredRecords);
  const mediaSummary = computeMediaSummary(filteredRecords);
  adState.latestMediaSummary = mediaSummary;
  renderMediaSummary(mediaSummary);
  renderJobDetail(filteredRecords);
};

const loadSampleDataset = () => {
  ingestRecords(sampleAdRecords, {
    mode: "replace",
    fileName: "sample_ad_data.csv",
    sourceLabel: "sample",
  });
  resetAdFilters();
  renderAdvertisingPerformance();
};

const exportMediaSummary = () => {
  if (!adState.latestMediaSummary.length) {
    window.alert("媒体サマリーのデータがありません。");
    return;
  }
  const headers = [
    "media",
    "cost",
    "impressions",
    "clicks",
    "applications",
    "introductions",
    "hires",
    "ctr",
    "cvr",
    "cost_apply",
    "cost_intro",
    "cost_hire",
    `currency(${adState.currency})`,
  ];
  const rows = adState.latestMediaSummary.map((item) => {
    const cost = convertBaseToCurrency(item.baseCost, adState.currency);
    const ctr = item.impressions ? (item.clicks / item.impressions) * 100 : "";
    const cvr = item.clicks ? (item.applications / item.clicks) * 100 : "";
    const cpa = item.applications ? cost / item.applications : "";
    const cpi = item.introductions ? cost / item.introductions : "";
    const cph = item.hires ? cost / item.hires : "";
    return [
      `"${item.media}"`,
      cost !== "" ? cost.toFixed(2) : "",
      item.impressions,
      item.clicks,
      item.applications,
      item.introductions,
      item.hires,
      ctr !== "" ? ctr.toFixed(2) : "",
      cvr !== "" ? cvr.toFixed(2) : "",
      cpa !== "" ? cpa.toFixed(2) : "",
      cpi !== "" ? cpi.toFixed(2) : "",
      cph !== "" ? cph.toFixed(2) : "",
      adState.currency,
    ];
  });
  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
    "\n"
  );
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `media_summary_${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const downloadCsvTemplate = () => {
  const headers = [
    "media",
    "job_id",
    "period_start",
    "period_end",
    "impressions",
    "clicks",
    "applications",
    "introductions",
    "hires",
    "cost",
    "currency",
  ];
  const sampleRow = [
    "Indeed",
    "JOB-001",
    "2024-05-01",
    "2024-05-31",
    "10000",
    "320",
    "40",
    "18",
    "3",
    "75000",
    "JPY",
  ];
  const csv = [headers.join(","), sampleRow.join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ad_performance_template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const handleCsvUpload = (file) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = parseCsvText(event.target.result);
      ingestRecords(parsed, { fileName: file.name });
    } catch (error) {
      window.alert(`CSVの読み込みに失敗しました: ${error.message}`);
    }
  };
  reader.readAsText(file);
};

if (currencySelect) {
  currencySelect.addEventListener("change", (event) => {
    adState.currency = event.target.value;
    renderAdvertisingPerformance();
    renderUnmatchedQueue();
  });
}

if (adFilterApplyBtn) {
  adFilterApplyBtn.addEventListener("click", () => {
    readAdFiltersFromInputs();
    renderAdvertisingPerformance();
  });
}

if (adFilterResetBtn) {
  adFilterResetBtn.addEventListener("click", () => {
    resetAdFilters();
  });
}

if (jobDetailSelect) {
  jobDetailSelect.addEventListener("change", (event) => {
    adState.selectedJobDetail = event.target.value || "auto";
    renderJobDetail(adState.latestFilteredRecords);
  });
}

if (exportMediaSummaryBtn) {
  exportMediaSummaryBtn.addEventListener("click", () => {
    exportMediaSummary();
  });
}

if (downloadCsvTemplateBtn) {
  downloadCsvTemplateBtn.addEventListener("click", () => {
    downloadCsvTemplate();
  });
}

if (loadSampleDataBtn) {
  loadSampleDataBtn.addEventListener("click", () => {
    loadSampleDataset();
  });
}

if (adCsvInput) {
  adCsvInput.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    if (file) {
      handleCsvUpload(file);
    }
    event.target.value = "";
  });
}

if (resolveUnmatchedBtn) {
  resolveUnmatchedBtn.addEventListener("click", () => {
    const resolvedEntries = [];
    adState.unmatched = adState.unmatched.filter((entry) => {
      if (entry.selectedJobId) {
        const jobInfo = getJobInfo(entry.selectedJobId);
        if (!jobInfo) return true;
        const resolvedRecord = {
          ...entry.record,
          jobId: entry.selectedJobId,
        };
        adState.records.push(resolvedRecord);
        resolvedEntries.push(entry);
        return false;
      }
      return true;
    });
    if (!resolvedEntries.length) {
      window.alert("マッピングを選択してください。");
    } else {
      renderUnmatchedQueue();
      renderAdvertisingPerformance();
    }
  });
}

if (clearUnmatchedSelectionsBtn) {
  clearUnmatchedSelectionsBtn.addEventListener("click", () => {
    adState.unmatched.forEach((entry) => {
      entry.selectedJobId = "";
    });
    renderUnmatchedQueue();
  });
}

updateFilterOptions();
renderImportLog();
renderUnmatchedQueue();
renderAdvertisingPerformance();

const candidateTableBody = document.getElementById("candidateTableBody");
const candidateRows = Array.from(document.querySelectorAll(".candidate-row") || []);
const filterCandidateName = document.getElementById("filterCandidateName");
const filterCompany = document.getElementById("filterCompany");
const filterOwner = document.getElementById("filterOwner");
const filterInitialFrom = document.getElementById("filterInitialFrom");
const filterInitialTo = document.getElementById("filterInitialTo");
const phaseCheckboxes = Array.from(document.querySelectorAll(".phase-filter") || []);
const sortKeySelect = document.getElementById("sortKey");
const sortDirectionBtn = document.getElementById("sortDirection");
const filterApplyBtn = document.getElementById("filterApply");
const filterResetBtn = document.getElementById("filterReset");

const phaseOrder = [
  "新規面談",
  "紹介可能",
  "企業に紹介",
  "面接前",
  "面接後",
  "内定獲得",
  "内定承諾待ち",
  "内定承諾",
];
const phaseIndexMap = phaseOrder.reduce((acc, phase, index) => {
  acc[phase] = index;
  return acc;
}, {});
const getRowInitialDate = (row) =>
  parseDateValue(row.dataset.initialDatetime || row.dataset.initial);

const getSortValue = (row, key) => {
  if (key === "initial") {
    const date = getRowInitialDate(row);
    return date ? date.getTime() : null;
  }
  if (key === "stuck") {
    return Number(row.dataset.stuckDays || 0);
  }
  // default: phase
  const phase = row.dataset.phase || "";
  return phaseIndexMap.hasOwnProperty(phase) ? phaseIndexMap[phase] : -1;
};

const applyCandidateSort = () => {
  if (!candidateTableBody) return;
  const sortKey = sortKeySelect ? sortKeySelect.value : "phase";
  const order = sortDirectionBtn
    ? sortDirectionBtn.dataset.order || "desc"
    : "desc";
  const multiplier = order === "asc" ? 1 : -1;

  const rowsCopy = candidateRows.slice();
  rowsCopy.sort((a, b) => {
    const valueA = getSortValue(a, sortKey);
    const valueB = getSortValue(b, sortKey);

    const bothNull = valueA === null && valueB === null;
    if (!bothNull) {
      if (valueA === null || Number.isNaN(valueA)) return 1;
      if (valueB === null || Number.isNaN(valueB)) return -1;
      if (valueA !== valueB) {
        return valueA > valueB ? 1 * multiplier : -1 * multiplier;
      }
    }

    const nameA = (a.dataset.name || "").toLowerCase();
    const nameB = (b.dataset.name || "").toLowerCase();
    return nameA.localeCompare(nameB, "ja") * multiplier;
  });

  rowsCopy.forEach((row) => candidateTableBody.appendChild(row));
};

const applyCandidateFilters = () => {
  const nameQuery = filterCandidateName
    ? filterCandidateName.value.trim().toLowerCase()
    : "";
  const company = filterCompany ? filterCompany.value : "すべて";
  const owner = filterOwner ? filterOwner.value : "すべて";
  const fromDate = parseDateValue(
    filterInitialFrom ? filterInitialFrom.value : ""
  );
  const toDateRaw = parseDateValue(
    filterInitialTo ? filterInitialTo.value : ""
  );
  const toDate = toDateRaw
    ? new Date(
      toDateRaw.getFullYear(),
      toDateRaw.getMonth(),
      toDateRaw.getDate(),
      23,
      59,
      59,
      999
    )
    : null;
  const activePhases = new Set(
    phaseCheckboxes
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value)
  );

  candidateRows.forEach((row) => {
    let visible = true;

    if (visible && nameQuery) {
      const name = (row.dataset.name || "").toLowerCase();
      visible = name.includes(nameQuery);
    }

    if (visible && company && company !== "すべて") {
      visible = row.dataset.company === company;
    }

    if (visible && owner && owner !== "すべて") {
      visible = row.dataset.owner === owner;
    }

    if (visible && (fromDate || toDate)) {
      const rowDate = getRowInitialDate(row);
      if (!rowDate) {
        visible = false;
      } else {
        if (fromDate && rowDate < fromDate) {
          visible = false;
        }
        if (toDate && rowDate > toDate) {
          visible = false;
        }
      }
    }

    if (visible && activePhases.size > 0) {
      visible = activePhases.has(row.dataset.phase);
    }

    if (visible) {
      row.classList.remove('hidden');
    } else {
      row.classList.add('hidden');
    }
    row.dataset.visible = visible ? "true" : "false";
  });

  applyCandidateSort();
};

const resetCandidateFilters = () => {
  if (filterCandidateName) filterCandidateName.value = "";
  if (filterCompany) filterCompany.value = "すべて";
  if (filterOwner) filterOwner.value = "すべて";
  if (filterInitialFrom) filterInitialFrom.value = "";
  if (filterInitialTo) filterInitialTo.value = "";
  phaseCheckboxes.forEach((checkbox) => {
    checkbox.checked = true;
  });
  if (sortKeySelect) sortKeySelect.value = "phase";
  if (sortDirectionBtn) {
    sortDirectionBtn.dataset.order = "desc";
    sortDirectionBtn.textContent = "降順";
  }
  applyCandidateFilters();
};

if (filterApplyBtn) {
  filterApplyBtn.addEventListener("click", () => {
    applyCandidateFilters();
  });
}

if (filterResetBtn) {
  filterResetBtn.addEventListener("click", () => {
    resetCandidateFilters();
  });
}

if (filterCandidateName) {
  filterCandidateName.addEventListener("input", () => {
    applyCandidateFilters();
  });
}
if (filterCompany) {
  filterCompany.addEventListener("change", () => {
    applyCandidateFilters();
  });
}
if (filterOwner) {
  filterOwner.addEventListener("change", () => {
    applyCandidateFilters();
  });
}
if (filterInitialFrom) {
  filterInitialFrom.addEventListener("change", () => {
    applyCandidateFilters();
  });
}
if (filterInitialTo) {
  filterInitialTo.addEventListener("change", () => {
    applyCandidateFilters();
  });
}
phaseCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    applyCandidateFilters();
  });
});

if (sortKeySelect) {
  sortKeySelect.addEventListener("change", () => {
    applyCandidateSort();
  });
}

if (sortDirectionBtn) {
  sortDirectionBtn.addEventListener("click", () => {
    const current = sortDirectionBtn.dataset.order === "asc" ? "asc" : "desc";
    const next = current === "asc" ? "desc" : "asc";
    sortDirectionBtn.dataset.order = next;
    sortDirectionBtn.textContent = next === "asc" ? "昇順" : "降順";
    applyCandidateSort();
  });
}

const roleSelect = document.getElementById("roleSelect");
const drawer = document.getElementById("candidateDrawer");
const overlay = document.getElementById("drawerOverlay");
const drawerName = document.getElementById("drawerName");
const drawerCompany = document.getElementById("drawerCompany");
const drawerOwner = document.getElementById("drawerOwner");
const drawerPhase = document.getElementById("drawerPhase");
const drawerInitial = document.getElementById("drawerInitial");
const drawerStuck = document.getElementById("drawerStuck");
const drawerAddress = document.getElementById("drawerAddress");
const drawerPhone = document.getElementById("drawerPhone");
const drawerEmail = document.getElementById("drawerEmail");
const drawerTimeline = document.getElementById("drawerTimeline");
const drawerNextAction = document.getElementById("drawerNextAction");
const drawerMemo = document.getElementById("drawerMemo");
const drawerClose = document.getElementById("drawerClose");

let currentCandidateRow = null;

const updateContactMask = () => {
  if (!roleSelect) return;
  const isManager = roleSelect.value === "manager";
  document.querySelectorAll(".contact-field").forEach((field) => {
    field.textContent = isManager ? field.dataset.full : field.dataset.masked;
  });
  if (currentCandidateRow) {
    drawerPhone.textContent = isManager
      ? currentCandidateRow.dataset.phoneFull
      : currentCandidateRow.dataset.phoneMasked;
    drawerEmail.textContent = isManager
      ? currentCandidateRow.dataset.emailFull
      : currentCandidateRow.dataset.emailMasked;
  }
};

if (roleSelect) {
  roleSelect.addEventListener("change", updateContactMask);
}

const closeDrawer = () => {
  drawer.classList.remove("open");
  overlay.classList.remove("visible");
  currentCandidateRow = null;
};

const populateDrawer = (row) => {
  currentCandidateRow = row;
  const isManager = roleSelect && roleSelect.value === "manager";
  drawerName.textContent = row.dataset.name || "-";
  drawerCompany.textContent = row.dataset.company || "-";
  drawerOwner.textContent = row.dataset.owner || "-";
  drawerPhase.textContent = row.dataset.phase || "-";
  drawerInitial.textContent = row.dataset.initial
    ? `初回接点 ${row.dataset.initial}`
    : "初回接点 -";

  const stuckDays = Number(row.dataset.stuckDays || 0);
  drawerStuck.textContent = `滞留${stuckDays}日`;
  drawerStuck.classList.remove(
    "bg-rose-100",
    "text-rose-600",
    "bg-emerald-50",
    "text-emerald-700"
  );
  if (stuckDays >= 5) {
    drawerStuck.classList.add("bg-rose-100", "text-rose-600");
  } else if (stuckDays === 0) {
    drawerStuck.classList.add("bg-emerald-50", "text-emerald-700");
  }

  drawerAddress.textContent = row.dataset.address || "-";
  drawerPhone.textContent = isManager
    ? row.dataset.phoneFull || "-"
    : row.dataset.phoneMasked || "-";
  drawerEmail.textContent = isManager
    ? row.dataset.emailFull || "-"
    : row.dataset.emailMasked || "-";
  drawerNextAction.textContent = row.dataset.nextAction || "-";
  drawerMemo.textContent = row.dataset.memo || "-";

  if (!drawerTimeline) {
    console.warn('drawerTimeline element not found, skipping timeline rendering');
    return;
  }

  drawerTimeline.innerHTML = "";
  const timelineRaw = row.dataset.timeline || "";
  timelineRaw.split(";").forEach((entry) => {
    if (!entry) return;
    const [phase, date] = entry.split("|");
    const item = document.createElement("div");
    item.className = "timeline-item";
    item.innerHTML = `
            <p class="text-sm font-semibold text-slate-700">${phase || "-"}</p>
            <p class="text-xs text-slate-500">${date || "ー"}</p>
          `;
    drawerTimeline.appendChild(item);
  });
};

candidateRows.forEach((row) => {
  row.addEventListener("click", () => {
    populateDrawer(row);
    drawer.classList.add("open");
    overlay.classList.add("visible");
  });
});

if (drawerClose) {
  drawerClose.addEventListener("click", closeDrawer);
}
if (overlay) {
  overlay.addEventListener("click", closeDrawer);
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDrawer();
  }
});
applyCandidateFilters();
updateContactMask();

// ===== KPI v2: 個人成績・社内成績セクション =====
// デフォルト期間設定（今月1日〜12日）
const setDefaultKpiRanges = () => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const startDate = new Date(currentYear, currentMonth, 1);
  const endDate = new Date(currentYear, currentMonth, 12);

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 個人成績の期間設定
  const personalRangeStart = document.getElementById('personalRangeStart');
  const personalRangeEnd = document.getElementById('personalRangeEnd');
  if (personalRangeStart) personalRangeStart.value = formatDate(startDate);
  if (personalRangeEnd) personalRangeEnd.value = formatDate(endDate);

  // 社内成績の期間設定
  const companyRangeStart = document.getElementById('companyRangeStart');
  const companyRangeEnd = document.getElementById('companyRangeEnd');
  if (companyRangeStart) companyRangeStart.value = formatDate(startDate);
  if (companyRangeEnd) companyRangeEnd.value = formatDate(endDate);
};

// モックKPIデータ（ほどよくばらけた値）
const mockKpiData = {
  personal: {
    achievementRate: 33,
    currentAmount: 957000,
    targetAmount: 3000000,
    proposals: 14,
    recommendations: 27,
    interviewsScheduled: 39,
    interviewsHeld: 28,
    offers: 15,
    accepts: 9,
    newInterviews: 42 // 提案率計算用
  },
  company: {
    proposals: 127,
    recommendations: 89,
    interviewsScheduled: 156,
    interviewsHeld: 132,
    offers: 68,
    accepts: 41,
    newInterviews: 185 // 提案率計算用
  }
};

// 社員データ（10人分のモック）
const mockEmployeeData = [
  { name: '田中太郎', proposals: 18, recommendations: 12, interviewsScheduled: 22, interviewsHeld: 18, offers: 9, accepts: 6, newInterviews: 24 },
  { name: '佐藤花子', proposals: 15, recommendations: 19, interviewsScheduled: 28, interviewsHeld: 21, offers: 12, accepts: 7, newInterviews: 29 },
  { name: '鈴木一郎', proposals: 21, recommendations: 8, interviewsScheduled: 15, interviewsHeld: 12, offers: 6, accepts: 4, newInterviews: 32 },
  { name: '高橋美咲', proposals: 9, recommendations: 14, interviewsScheduled: 19, interviewsHeld: 16, offers: 8, accepts: 5, newInterviews: 18 },
  { name: '渡辺健司', proposals: 16, recommendations: 11, interviewsScheduled: 24, interviewsHeld: 19, offers: 10, accepts: 6, newInterviews: 28 },
  { name: '伊藤由美', proposals: 12, recommendations: 16, interviewsScheduled: 21, interviewsHeld: 17, offers: 7, accepts: 3, newInterviews: 25 },
  { name: '山田和子', proposals: 20, recommendations: 9, interviewsScheduled: 17, interviewsHeld: 14, offers: 8, accepts: 5, newInterviews: 31 },
  { name: '中村雅彦', proposals: 11, recommendations: 15, interviewsScheduled: 26, interviewsHeld: 20, offers: 11, accepts: 8, newInterviews: 22 },
  { name: '小林春香', proposals: 13, recommendations: 10, interviewsScheduled: 18, interviewsHeld: 15, offers: 6, accepts: 2, newInterviews: 26 },
  { name: '加藤直樹', proposals: 17, recommendations: 13, interviewsScheduled: 23, interviewsHeld: 19, offers: 9, accepts: 7, newInterviews: 27 }
];

// チャートの月次データ（6ヶ月分）
const generateMonthlyTrendData = () => {
  const months = [];
  const today = new Date();

  for (let i = 5; i >= 0; i--) {
    const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      month: monthStr,
      label: `${month.getMonth() + 1}月`,
      proposalRate: Math.floor(Math.random() * 30) + 50,      // 50-80%
      recommendationRate: Math.floor(Math.random() * 25) + 60, // 60-85%
      interviewScheduleRate: Math.floor(Math.random() * 40) + 40, // 40-80%
      interviewHeldRate: Math.floor(Math.random() * 20) + 75,  // 75-95%
      offerRate: Math.floor(Math.random() * 30) + 40,         // 40-70%
      acceptRate: Math.floor(Math.random() * 25) + 50         // 50-75%
    });
  }

  return months;
};

// 数値フォーマット関数
const formatKpiNumber = (num) => {
  if (typeof num !== 'number' || isNaN(num)) return '—';
  return new Intl.NumberFormat('ja-JP').format(num);
};

const formatCurrency = (amount) => {
  if (typeof amount !== 'number' || isNaN(amount)) return '—';
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0
  }).format(amount);
};

const formatPercentage = (rate) => {
  if (typeof rate !== 'number' || isNaN(rate)) return '—';
  return Math.round(rate) + '%';
};

// 率の計算
const calculateRates = (data) => {
  const { proposals, recommendations, interviewsScheduled, interviewsHeld, offers, accepts, newInterviews } = data;

  return {
    proposalRate: newInterviews > 0 ? (proposals / newInterviews) * 100 : 0,
    recommendationRate: proposals > 0 ? (recommendations / proposals) * 100 : 0,
    interviewScheduleRate: recommendations > 0 ? (interviewsScheduled / recommendations) * 100 : 0,
    interviewHeldRate: interviewsScheduled > 0 ? (interviewsHeld / interviewsScheduled) * 100 : 0,
    offerRate: interviewsHeld > 0 ? (offers / interviewsHeld) * 100 : 0,
    acceptRate: offers > 0 ? (accepts / offers) * 100 : 0
  };
};

// SVG折れ線グラフ描画
const drawTrendChart = () => {
  const chartEl = document.getElementById('personalTrendChart');
  const legendEl = document.getElementById('personalChartLegend');

  if (!chartEl || !legendEl) return;

  const data = generateMonthlyTrendData();
  const width = 800;
  const height = 300;
  const padding = { top: 40, right: 40, bottom: 60, left: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // チャートクリア
  chartEl.innerHTML = '';

  // 軸描画
  const axes = `
    <g stroke="#e5e7eb" stroke-width="1">
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + plotHeight}" />
      <line x1="${padding.left}" y1="${padding.top + plotHeight}" x2="${padding.left + plotWidth}" y2="${padding.top + plotHeight}" />
    </g>
  `;
  chartEl.insertAdjacentHTML('beforeend', axes);

  // Y軸グリッド（0-100%）
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (plotHeight * i / 4);
    const value = 100 - (i * 25);
    chartEl.insertAdjacentHTML('beforeend', `
      <line x1="${padding.left}" y1="${y}" x2="${padding.left + plotWidth}" y2="${y}" stroke="#f3f4f6" stroke-width="0.5" />
      <text x="${padding.left - 10}" y="${y + 3}" text-anchor="end" font-size="12" fill="#6b7280">${value}%</text>
    `);
  }

  // X軸ラベル
  data.forEach((item, index) => {
    const x = padding.left + (plotWidth * index / (data.length - 1));
    chartEl.insertAdjacentHTML('beforeend', `
      <text x="${x}" y="${padding.top + plotHeight + 20}" text-anchor="middle" font-size="12" fill="#6b7280">${item.label}</text>
    `);
  });

  // 線の色設定
  const lineColors = {
    proposalRate: '#6366f1',
    recommendationRate: '#10b981',
    interviewScheduleRate: '#f59e0b',
    interviewHeldRate: '#ef4444',
    offerRate: '#8b5cf6',
    acceptRate: '#06b6d4'
  };

  const lineLabels = {
    proposalRate: '提案率',
    recommendationRate: '推薦率',
    interviewScheduleRate: '面談設定率',
    interviewHeldRate: '面談実施率',
    offerRate: '内定率',
    acceptRate: '承諾率'
  };

  // 各系列の線を描画
  Object.keys(lineColors).forEach(key => {
    const points = data.map((item, index) => {
      const x = padding.left + (plotWidth * index / (data.length - 1));
      const y = padding.top + plotHeight - (plotHeight * item[key] / 100);
      return `${x},${y}`;
    }).join(' ');

    chartEl.insertAdjacentHTML('beforeend', `
      <polyline points="${points}" fill="none" stroke="${lineColors[key]}" stroke-width="2.5" stroke-linejoin="round" />
    `);

    // 点を描画
    data.forEach((item, index) => {
      const x = padding.left + (plotWidth * index / (data.length - 1));
      const y = padding.top + plotHeight - (plotHeight * item[key] / 100);
      chartEl.insertAdjacentHTML('beforeend', `
        <circle cx="${x}" cy="${y}" r="3" fill="${lineColors[key]}" />
      `);
    });
  });

  // 凡例生成
  legendEl.innerHTML = '';
  Object.keys(lineColors).forEach(key => {
    const legendItem = document.createElement('div');
    legendItem.className = 'kpi-v2-legend-item';
    legendItem.innerHTML = `
      <div class="kpi-v2-legend-color" style="background-color: ${lineColors[key]}"></div>
      <span>${lineLabels[key]}</span>
    `;
    legendEl.appendChild(legendItem);
  });
};

// 社員成績表の描画
const renderEmployeeTable = (employees = mockEmployeeData) => {
  const tableBody = document.getElementById('employeeTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = '';

  employees.forEach(employee => {
    const rates = calculateRates(employee);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${employee.name}</td>
      <td>${formatKpiNumber(employee.proposals)}</td>
      <td>${formatKpiNumber(employee.recommendations)}</td>
      <td>${formatKpiNumber(employee.interviewsScheduled)}</td>
      <td>${formatKpiNumber(employee.interviewsHeld)}</td>
      <td>${formatKpiNumber(employee.offers)}</td>
      <td>${formatKpiNumber(employee.accepts)}</td>
      <td>${formatPercentage(rates.proposalRate)}</td>
      <td>${formatPercentage(rates.recommendationRate)}</td>
      <td>${formatPercentage(rates.interviewScheduleRate)}</td>
      <td>${formatPercentage(rates.interviewHeldRate)}</td>
      <td>${formatPercentage(rates.offerRate)}</td>
      <td>${formatPercentage(rates.acceptRate)}</td>
    `;
    tableBody.appendChild(row);
  });
};

// 社員カード表示の描画
const renderEmployeeCards = (employees = mockEmployeeData) => {
  const cardContainer = document.getElementById('employeeCardContainer');
  if (!cardContainer) return;

  cardContainer.innerHTML = '';

  employees.forEach(employee => {
    const rates = calculateRates(employee);
    const card = document.createElement('div');
    card.className = 'kpi-v2-employee-card';
    card.innerHTML = `
      <div class="kpi-v2-employee-name">${employee.name}</div>
      <div class="kpi-v2-employee-metrics">
        <div class="kpi-v2-metric-item">
          <span class="kpi-v2-metric-label">提案数</span>
          <span class="kpi-v2-metric-value">${formatKpiNumber(employee.proposals)}</span>
        </div>
        <div class="kpi-v2-metric-item">
          <span class="kpi-v2-metric-label">推薦数</span>
          <span class="kpi-v2-metric-value">${formatKpiNumber(employee.recommendations)}</span>
        </div>
        <div class="kpi-v2-metric-item">
          <span class="kpi-v2-metric-label">内定数</span>
          <span class="kpi-v2-metric-value">${formatKpiNumber(employee.offers)}</span>
        </div>
        <div class="kpi-v2-metric-item">
          <span class="kpi-v2-metric-label">承諾数</span>
          <span class="kpi-v2-metric-value">${formatKpiNumber(employee.accepts)}</span>
        </div>
        <div class="kpi-v2-metric-item">
          <span class="kpi-v2-metric-label">提案率</span>
          <span class="kpi-v2-metric-value">${formatPercentage(rates.proposalRate)}</span>
        </div>
        <div class="kpi-v2-metric-item">
          <span class="kpi-v2-metric-label">承諾率</span>
          <span class="kpi-v2-metric-value">${formatPercentage(rates.acceptRate)}</span>
        </div>
      </div>
    `;
    cardContainer.appendChild(card);
  });
};

// KPIデータの更新
const updateKpiDisplay = () => {
  // 個人成績の更新
  const personalData = mockKpiData.personal;
  const personalRates = calculateRates(personalData);

  // 売り上げ達成率と金額
  const achievementRateEl = document.getElementById('personalAchievementRate');
  const currentEl = document.getElementById('personalCurrent');
  const targetEl = document.getElementById('personalTarget');

  if (achievementRateEl) achievementRateEl.textContent = formatPercentage(personalData.achievementRate);
  if (currentEl) currentEl.textContent = formatCurrency(personalData.currentAmount);
  if (targetEl) targetEl.textContent = formatCurrency(personalData.targetAmount);

  // 個人成績の数値
  const personalCountFields = ['proposals', 'recommendations', 'interviewsScheduled', 'interviewsHeld', 'offers', 'accepts'];
  personalCountFields.forEach(field => {
    const el = document.getElementById(`personal${field.charAt(0).toUpperCase() + field.slice(1)}`);
    if (el) el.textContent = formatKpiNumber(personalData[field]);
  });

  // 個人成績の率
  const personalRateFields = ['proposalRate', 'recommendationRate', 'interviewScheduleRate', 'interviewHeldRate', 'offerRate', 'acceptRate'];
  personalRateFields.forEach(field => {
    const el = document.getElementById(`personal${field.charAt(0).toUpperCase() + field.slice(1)}`);
    if (el) el.textContent = formatPercentage(personalRates[field]);
  });

  // 社内成績の更新
  const companyData = mockKpiData.company;
  const companyRates = calculateRates(companyData);

  // 社内成績の数値
  const companyCountFields = ['proposals', 'recommendations', 'interviewsScheduled', 'interviewsHeld', 'offers', 'accepts'];
  companyCountFields.forEach(field => {
    const el = document.getElementById(`company${field.charAt(0).toUpperCase() + field.slice(1)}`);
    if (el) el.textContent = formatKpiNumber(companyData[field]);
  });

  // 社内成績の率
  const companyRateFields = ['proposalRate', 'recommendationRate', 'interviewScheduleRate', 'interviewHeldRate', 'offerRate', 'acceptRate'];
  companyRateFields.forEach(field => {
    const el = document.getElementById(`company${field.charAt(0).toUpperCase() + field.slice(1)}`);
    if (el) el.textContent = formatPercentage(companyRates[field]);
  });

  // グラフとテーブルの描画
  drawTrendChart();
  renderEmployeeTable();
  renderEmployeeCards();
};

// 社員成績の並び替え
const sortEmployees = (employees, sortKey) => {
  const [field, order] = sortKey.split('-');

  return employees.slice().sort((a, b) => {
    let valueA, valueB;

    if (field === 'name') {
      valueA = a.name;
      valueB = b.name;
    } else if (field.endsWith('Rate')) {
      const ratesA = calculateRates(a);
      const ratesB = calculateRates(b);
      valueA = ratesA[field] || 0;
      valueB = ratesB[field] || 0;
    } else {
      valueA = a[field] || 0;
      valueB = b[field] || 0;
    }

    if (order === 'desc') {
      return valueB > valueA ? 1 : -1;
    } else {
      return valueA > valueB ? 1 : -1;
    }
  });
};

// 社員成績の検索
const filterEmployees = (employees, searchTerm) => {
  if (!searchTerm.trim()) return employees;

  return employees.filter(employee =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
};

// 期間変更時のハンドラー（プレースホルダ実装）
const handleKpiRangeChange = (section) => {
  const startId = `${section}RangeStart`;
  const endId = `${section}RangeEnd`;
  const startEl = document.getElementById(startId);
  const endEl = document.getElementById(endId);

  if (!startEl || !endEl) return;

  const startDate = startEl.value;
  const endDate = endEl.value;

  if (startDate && endDate) {
    console.log(`${section} 期間変更:`, startDate, '〜', endDate);
    // TODO: ここで実際のデータ取得処理を呼び出し
    // 現在は何もせず、将来の実装のためのプレースホルダ
  }
};

// イベントリスナーの設定
const setupKpiEventListeners = () => {
  if (initializationFlags.kpiEventListeners) {
    if (DEBUG) console.log('KPI event listeners already initialized');
    return;
  }

  // 期間変更
  const personalRangeStart = document.getElementById('personalRangeStart');
  const personalRangeEnd = document.getElementById('personalRangeEnd');
  const companyRangeStart = document.getElementById('companyRangeStart');
  const companyRangeEnd = document.getElementById('companyRangeEnd');

  if (personalRangeStart) {
    personalRangeStart.addEventListener('change', () => handleKpiRangeChange('personal'));
  }
  if (personalRangeEnd) {
    personalRangeEnd.addEventListener('change', () => handleKpiRangeChange('personal'));
  }
  if (companyRangeStart) {
    companyRangeStart.addEventListener('change', () => handleKpiRangeChange('company'));
  }
  if (companyRangeEnd) {
    companyRangeEnd.addEventListener('change', () => handleKpiRangeChange('company'));
  }

  // 社員成績の検索
  const searchInput = document.getElementById('employeeSearchInput');
  const sortSelect = document.getElementById('employeeSortSelect');
  const viewToggle = document.getElementById('employeeViewToggle');
  const tableView = document.getElementById('employeeTableView');
  const cardView = document.getElementById('employeeCardView');

  let currentEmployees = mockEmployeeData;

  const updateEmployeeViews = () => {
    const searchTerm = searchInput ? searchInput.value : '';
    const sortKey = sortSelect ? sortSelect.value : 'name-asc';

    let filteredEmployees = filterEmployees(mockEmployeeData, searchTerm);
    let sortedEmployees = sortEmployees(filteredEmployees, sortKey);

    currentEmployees = sortedEmployees;
    renderEmployeeTable(currentEmployees);
    renderEmployeeCards(currentEmployees);
  };

  if (searchInput) {
    searchInput.addEventListener('input', updateEmployeeViews);
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', updateEmployeeViews);
  }

  // 表示切り替え
  if (viewToggle && tableView && cardView) {
    viewToggle.addEventListener('click', () => {
      const currentView = viewToggle.dataset.view;

      if (currentView === 'table') {
        tableView.classList.add('hidden');
        cardView.classList.remove('hidden');
        viewToggle.dataset.view = 'card';
        viewToggle.querySelector('.toggle-text').textContent = '表形式';
      } else {
        tableView.classList.remove('hidden');
        cardView.classList.add('hidden');
        viewToggle.dataset.view = 'table';
        viewToggle.querySelector('.toggle-text').textContent = 'カード表示';
      }
    });
  }

  initializationFlags.kpiEventListeners = true;
  if (DEBUG) console.log('KPI event listeners initialized');
};

// 初期化
const initializeKpiV2 = () => {
  // KPI v2は専用の初期化処理を持たない（全体初期化に統合）
};

// ===== 候補者管理 =====
// 候補者データ（20件のモック）
const mockCandidatesData = [
  {
    id: 'C001',
    appliedAt: '2024-11-10',
    source: 'Indeed',
    name: '田中太郎',
    phone: '090-1234-5678',
    email: 'tanaka.taro@example.com',
    jobTitle: 'フロントエンドエンジニア',
    companyName: 'ABC株式会社',
    address: '東京都港区南青山1-2-3',
    age: 28
  },
  {
    id: 'C002',
    appliedAt: '2024-11-09',
    source: '求人ボックス',
    name: '佐藤花子',
    phone: '080-2345-6789',
    email: 'sato.hanako@example.com',
    jobTitle: 'バックエンドエンジニア',
    companyName: 'XYZ技術',
    address: '神奈川県横浜市西区3-4-5',
    age: 32
  },
  {
    id: 'C003',
    appliedAt: '2024-11-09',
    source: 'リクナビ',
    name: '鈴木一郎',
    phone: '070-3456-7890',
    email: 'suzuki.ichiro@example.com',
    jobTitle: 'プロダクトマネージャー',
    companyName: 'DEF企画',
    address: '大阪府大阪市中央区6-7-8',
    age: 35
  },
  {
    id: 'C004',
    appliedAt: '2024-11-08',
    source: 'マイナビ',
    name: '高橋美咲',
    phone: '090-4567-8901',
    email: 'takahashi.misaki@example.com',
    jobTitle: 'UIUXデザイナー',
    companyName: 'GHI デザイン',
    address: '東京都渋谷区2-3-4',
    age: 26
  },
  {
    id: 'C005',
    appliedAt: '2024-11-08',
    source: 'Indeed',
    name: '渡辺健司',
    phone: '080-5678-9012',
    email: 'watanabe.kenji@example.com',
    jobTitle: 'データサイエンティスト',
    companyName: 'JKL アナリティクス',
    address: '東京都新宿区5-6-7',
    age: 30
  },
  {
    id: 'C006',
    appliedAt: '2024-11-07',
    source: '求人ボックス',
    name: '伊藤由美',
    phone: '070-6789-0123',
    email: 'ito.yumi@example.com',
    jobTitle: 'セールス',
    companyName: 'MNO商事',
    address: '愛知県名古屋市中区8-9-1',
    age: 29
  },
  {
    id: 'C007',
    appliedAt: '2024-11-07',
    source: 'リクナビ',
    name: '山田和子',
    phone: '090-7890-1234',
    email: 'yamada.kazuko@example.com',
    jobTitle: 'マーケティング',
    companyName: 'PQR マーケティング',
    address: '福岡県福岡市博多区1-2-3',
    age: 31
  },
  {
    id: 'C008',
    appliedAt: '2024-11-06',
    source: 'マイナビ',
    name: '中村雅彦',
    phone: '080-8901-2345',
    email: 'nakamura.masahiko@example.com',
    jobTitle: 'システムエンジニア',
    companyName: 'STU システム',
    address: '埼玉県さいたま市大宮区4-5-6',
    age: 33
  },
  {
    id: 'C009',
    appliedAt: '2024-11-06',
    source: 'Indeed',
    name: '小林春香',
    phone: '070-9012-3456',
    email: 'kobayashi.haruka@example.com',
    jobTitle: 'カスタマーサクセス',
    companyName: 'VWX サービス',
    address: '千葉県千葉市中央区7-8-9',
    age: 27
  },
  {
    id: 'C010',
    appliedAt: '2024-11-05',
    source: '求人ボックス',
    name: '加藤直樹',
    phone: '090-0123-4567',
    email: 'kato.naoki@example.com',
    jobTitle: 'QAエンジニア',
    companyName: 'YZ品質管理',
    address: '北海道札幌市中央区1-2-3',
    age: 34
  },
  {
    id: 'C011',
    appliedAt: '2024-11-05',
    source: 'リクナビ',
    name: '林美穂',
    phone: '080-1234-5678',
    email: 'hayashi.miho@example.com',
    jobTitle: 'インフラエンジニア',
    companyName: 'ABC株式会社',
    address: '東京都中央区銀座4-5-6',
    age: 29
  },
  {
    id: 'C012',
    appliedAt: '2024-11-04',
    source: 'マイナビ',
    name: '木村俊介',
    phone: '070-2345-6789',
    email: 'kimura.shunsuke@example.com',
    jobTitle: 'アプリケーションエンジニア',
    companyName: 'DEF企画',
    address: '神奈川県川崎市幸区7-8-9',
    age: 26
  },
  {
    id: 'C013',
    appliedAt: '2024-11-04',
    source: 'Indeed',
    name: '清水由香',
    phone: '090-3456-7890',
    email: 'shimizu.yuka@example.com',
    jobTitle: 'プロジェクトマネージャー',
    companyName: 'GHI デザイン',
    address: '大阪府大阪市北区1-2-3',
    age: 32
  },
  {
    id: 'C014',
    appliedAt: '2024-11-03',
    source: '求人ボックス',
    name: '森田健太',
    phone: '080-4567-8901',
    email: 'morita.kenta@example.com',
    jobTitle: 'セキュリティエンジニア',
    companyName: 'JKL アナリティクス',
    address: '東京都世田谷区4-5-6',
    age: 31
  },
  {
    id: 'C015',
    appliedAt: '2024-11-03',
    source: 'リクナビ',
    name: '池田麻衣',
    phone: '070-5678-9012',
    email: 'ikeda.mai@example.com',
    jobTitle: 'ビジネスアナリスト',
    companyName: 'MNO商事',
    address: '愛知県名古屋市東区7-8-9',
    age: 28
  },
  {
    id: 'C016',
    appliedAt: '2024-11-02',
    source: 'マイナビ',
    name: '橋本拓也',
    phone: '090-6789-0123',
    email: 'hashimoto.takuya@example.com',
    jobTitle: 'テクニカルライター',
    companyName: 'PQR マーケティング',
    address: '福岡県福岡市中央区1-2-3',
    age: 30
  },
  {
    id: 'C017',
    appliedAt: '2024-11-02',
    source: 'Indeed',
    name: '坂本理恵',
    phone: '080-7890-1234',
    email: 'sakamoto.rie@example.com',
    jobTitle: 'HR',
    companyName: 'STU システム',
    address: '埼玉県川口市5-6-7',
    age: 27
  },
  {
    id: 'C018',
    appliedAt: '2024-11-01',
    source: '求人ボックス',
    name: '藤田隆志',
    phone: '070-8901-2345',
    email: 'fujita.takashi@example.com',
    jobTitle: 'DevOpsエンジニア',
    companyName: 'VWX サービス',
    address: '千葉県柏市8-9-1',
    age: 33
  },
  {
    id: 'C019',
    appliedAt: '2024-11-01',
    source: 'リクナビ',
    name: '岡田智子',
    phone: '090-9012-3456',
    email: 'okada.tomoko@example.com',
    jobTitle: '経営企画',
    companyName: 'YZ品質管理',
    address: '北海道札幌市北区2-3-4',
    age: 35
  },
  {
    id: 'C020',
    appliedAt: '2024-10-31',
    source: 'マイナビ',
    name: '松本和也',
    phone: '080-0123-4567',
    email: 'matsumoto.kazuya@example.com',
    jobTitle: 'フルスタックエンジニア',
    companyName: 'ABC株式会社',
    address: '東京都品川区大崎3-4-5',
    age: 29
  }
];

// 架電ログデータ（候補者IDと紐づく）
const mockCallLogs = [
  {
    id: 'CL001',
    candidateId: 'C001',
    calledAt: '2024-11-11T10:30:00',
    owner: '佐藤（CA）',
    result: '通電',
    nextAction: '一次面接設定',
    nextActionDate: '2024-11-15',
    memo: '意欲的、スキルマッチ良好',
    appointmentStatus: 'scheduled'
  },
  {
    id: 'CL002',
    candidateId: 'C002',
    calledAt: '2024-11-10T14:15:00',
    owner: '田中（CA）',
    result: '不在',
    nextAction: '再架電',
    nextActionDate: '2024-11-12',
    memo: '留守電にメッセージ',
    appointmentStatus: 'pending'
  },
  {
    id: 'CL003',
    candidateId: 'C003',
    calledAt: '2024-11-09T16:45:00',
    owner: '山本（CS）',
    result: '通電',
    nextAction: 'フォロー架電',
    nextActionDate: '2024-11-14',
    memo: '条件面で要相談',
    appointmentStatus: 'pending'
  }
];

// 候補者管理の状態
const candidatesState = {
  allCandidates: mockCandidatesData,
  filteredCandidates: mockCandidatesData,
  currentSort: { field: 'appliedAt', order: 'desc' },
  filters: {
    dateFrom: '',
    dateTo: '',
    source: '',
    name: '',
    jobTitle: ''
  },
  searchDebounce: null
};

// 候補者テーブルの描画
const renderCandidatesTable = () => {
  const tableBody = document.getElementById('candidatesTableBody');
  const countEl = document.getElementById('candidatesFilterCount');

  if (!tableBody) return;

  tableBody.innerHTML = '';

  candidatesState.filteredCandidates.forEach(candidate => {
    const row = document.createElement('tr');
    row.className = 'candidates-row cursor-pointer hover:bg-indigo-50';
    row.dataset.candidateId = candidate.id;

    // 応募日をフォーマット
    const appliedDate = new Date(candidate.appliedAt);
    const formattedDate = `${appliedDate.getFullYear()}/${String(appliedDate.getMonth() + 1).padStart(2, '0')}/${String(appliedDate.getDate()).padStart(2, '0')}`;

    row.innerHTML = `
      <td>${formattedDate}</td>
      <td>${candidate.source}</td>
      <td class="text-indigo-700 font-semibold">${candidate.name}</td>
      <td>
        <a href="tel:${candidate.phone}" class="candidates-phone">${candidate.phone}</a>
      </td>
      <td>
        <a href="mailto:${candidate.email}" class="candidates-email">${candidate.email}</a>
      </td>
      <td>${candidate.jobTitle}</td>
      <td>${candidate.companyName}</td>
      <td class="whitespace-nowrap">${candidate.address}</td>
    `;

    // 行クリックでドロワー表示
    row.addEventListener('click', () => openCandidateDrawer(candidate));

    tableBody.appendChild(row);
  });

  // 件数更新
  if (countEl) {
    countEl.textContent = `${candidatesState.filteredCandidates.length}件`;
  }
};

// 候補者ドロワーの表示
const openCandidateDrawer = (candidate) => {
  const drawer = document.getElementById('candidateDrawer');
  const overlay = document.getElementById('drawerOverlay');

  if (!drawer || !overlay) return;

  // 基本情報の更新
  const drawerName = document.getElementById('drawerName');
  const drawerCompany = document.getElementById('drawerCompany');
  const drawerOwner = document.getElementById('drawerOwner');
  const drawerPhase = document.getElementById('drawerPhase');
  const drawerInitial = document.getElementById('drawerInitial');
  const drawerStuck = document.getElementById('drawerStuck');

  if (drawerName) drawerName.textContent = candidate.name;
  if (drawerCompany) drawerCompany.textContent = candidate.companyName;
  if (drawerOwner) drawerOwner.textContent = '候補者管理';
  if (drawerPhase) drawerPhase.textContent = '応募済み';
  if (drawerInitial) drawerInitial.textContent = `応募日 ${candidate.appliedAt}`;
  if (drawerStuck) drawerStuck.textContent = '新規';

  // 詳細情報の更新
  const drawerAddress = document.getElementById('drawerAddress');
  const drawerPhone = document.getElementById('drawerPhone');
  const drawerEmail = document.getElementById('drawerEmail');

  if (drawerAddress) drawerAddress.textContent = candidate.address;
  if (drawerPhone) drawerPhone.innerHTML = `<a href="tel:${candidate.phone}" class="candidates-phone">${candidate.phone}</a>`;
  if (drawerEmail) drawerEmail.innerHTML = `<a href="mailto:${candidate.email}" class="candidates-email">${candidate.email}</a>`;

  // 架電履歴の表示
  updateCallLogSection(candidate.id);

  // ドロワー表示
  drawer.classList.add('open');
  overlay.classList.add('visible');

  // 現在の候補者IDを保存
  drawer.dataset.currentCandidateId = candidate.id;
};

// 架電履歴セクションの更新
const updateCallLogSection = (candidateId) => {
  const drawerTimeline = document.getElementById('drawerTimeline');
  if (!drawerTimeline) return;

  // 既存の架電履歴セクションをクリア
  let callLogSection = document.querySelector('.call-log-section');
  if (callLogSection) {
    callLogSection.remove();
  }

  // 新しい架電履歴セクションを作成
  callLogSection = document.createElement('section');
  callLogSection.className = 'call-log-section';
  callLogSection.innerHTML = `
    <h4 class="text-sm font-semibold text-slate-700 mb-3">架電管理</h4>
    
    <!-- 架電履歴 -->
    <div class="mb-4">
      <h5 class="text-xs font-semibold text-slate-600 mb-2">架電履歴</h5>
      <div class="call-log-history" id="callLogHistory">
        <!-- JavaScriptで生成 -->
      </div>
    </div>
    
    <!-- 新規架電登録 -->
    <div class="mb-4">
      <h5 class="text-xs font-semibold text-slate-600 mb-2">新規架電登録</h5>
      <div class="call-log-form">
        <div class="form-grid">
          <label>
            <span>架電日時</span>
            <input type="datetime-local" id="newCallDateTime" />
          </label>
          <label>
            <span>担当者</span>
            <select id="newCallOwner">
              <option value="">選択してください</option>
              <option value="佐藤（CA）">佐藤（CA）</option>
              <option value="田中（CA）">田中（CA）</option>
              <option value="山本（CS）">山本（CS）</option>
            </select>
          </label>
          <label>
            <span>結果</span>
            <select id="newCallResult">
              <option value="">選択してください</option>
              <option value="通電">通電</option>
              <option value="不在">不在</option>
              <option value="折返し待ち">折返し待ち</option>
            </select>
          </label>
          <label>
            <span>次アクション期日</span>
            <input type="date" id="newCallNextActionDate" />
          </label>
          <label class="form-grid-full">
            <span>次アクション</span>
            <input type="text" id="newCallNextAction" placeholder="例: 一次面接設定" />
          </label>
          <label class="form-grid-full">
            <span>メモ</span>
            <textarea id="newCallMemo" placeholder="架電内容、印象など"></textarea>
          </label>
        </div>
        <div class="call-log-actions">
          <button type="button" class="px-3 py-2 text-sm border border-slate-300 rounded hover:bg-slate-50" onclick="clearCallLogForm()">
            クリア
          </button>
          <button type="button" class="px-3 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-500" onclick="saveCallLog()">
            保存
          </button>
        </div>
      </div>
    </div>
  `;

  // ドロワーの最後に追加
  const drawerContent = document.querySelector('#candidateDrawer .flex-1.overflow-y-auto');
  if (drawerContent) {
    drawerContent.appendChild(callLogSection);
  }

  // 該当候補者の架電履歴を表示
  const candidateCallLogs = mockCallLogs.filter(log => log.candidateId === candidateId);
  const callLogHistoryEl = document.getElementById('callLogHistory');

  if (callLogHistoryEl) {
    if (candidateCallLogs.length === 0) {
      callLogHistoryEl.innerHTML = '<div class="call-log-item text-center text-slate-500 text-sm">架電履歴はありません</div>';
    } else {
      callLogHistoryEl.innerHTML = candidateCallLogs
        .sort((a, b) => new Date(b.calledAt) - new Date(a.calledAt))
        .map(log => {
          const callDate = new Date(log.calledAt);
          const formattedDate = `${callDate.getFullYear()}/${String(callDate.getMonth() + 1).padStart(2, '0')}/${String(callDate.getDate()).padStart(2, '0')} ${String(callDate.getHours()).padStart(2, '0')}:${String(callDate.getMinutes()).padStart(2, '0')}`;

          return `
            <div class="call-log-item">
              <div class="call-log-date">${formattedDate} - ${log.owner}</div>
              <div class="call-log-content">
                <strong>${log.result}</strong> | 次アクション: ${log.nextAction || '未設定'}
                ${log.nextActionDate ? ` (${log.nextActionDate})` : ''}
                ${log.memo ? `<br><small class="text-slate-600">${log.memo}</small>` : ''}
              </div>
            </div>
          `;
        }).join('');
    }
  }

  // 現在時刻をデフォルトに設定
  const newCallDateTime = document.getElementById('newCallDateTime');
  if (newCallDateTime) {
    const now = new Date();
    const localISOTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    newCallDateTime.value = localISOTime;
  }
};

// 架電ログのフォームクリア
window.clearCallLogForm = () => {
  const form = document.querySelector('.call-log-form');
  if (form) {
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      if (input.type === 'datetime-local') {
        const now = new Date();
        const localISOTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        input.value = localISOTime;
      } else {
        input.value = '';
      }
    });
  }
};

// 架電ログの保存
window.saveCallLog = () => {
  const drawer = document.getElementById('candidateDrawer');
  const candidateId = drawer?.dataset.currentCandidateId;

  if (!candidateId) return;

  const newCallDateTime = document.getElementById('newCallDateTime')?.value;
  const newCallOwner = document.getElementById('newCallOwner')?.value;
  const newCallResult = document.getElementById('newCallResult')?.value;
  const newCallNextAction = document.getElementById('newCallNextAction')?.value;
  const newCallNextActionDate = document.getElementById('newCallNextActionDate')?.value;
  const newCallMemo = document.getElementById('newCallMemo')?.value;

  if (!newCallDateTime || !newCallOwner || !newCallResult) {
    alert('必須項目を入力してください。');
    return;
  }

  // 新しい架電ログを追加
  const newCallLog = {
    id: `CL${Date.now()}`,
    candidateId: candidateId,
    calledAt: newCallDateTime,
    owner: newCallOwner,
    result: newCallResult,
    nextAction: newCallNextAction,
    nextActionDate: newCallNextActionDate,
    memo: newCallMemo,
    appointmentStatus: newCallResult === '通電' && newCallNextAction.includes('面接') ? 'scheduled' : 'pending'
  };

  mockCallLogs.push(newCallLog);

  // TODO: ここで実際のAPIに保存
  console.log('架電ログ保存:', newCallLog);

  // フォームをクリア
  clearCallLogForm();

  // 履歴を更新
  updateCallLogSection(candidateId);

  alert('架電ログを保存しました。');
};

// 候補者フィルタリング
const filterCandidates = () => {
  const { dateFrom, dateTo, source, name, jobTitle } = candidatesState.filters;

  candidatesState.filteredCandidates = candidatesState.allCandidates.filter(candidate => {
    // 日付フィルタ
    if (dateFrom && candidate.appliedAt < dateFrom) return false;
    if (dateTo && candidate.appliedAt > dateTo) return false;

    // 媒体フィルタ
    if (source && candidate.source !== source) return false;

    // 名前フィルタ
    if (name && !candidate.name.toLowerCase().includes(name.toLowerCase())) return false;

    // 求人名フィルタ
    if (jobTitle && !candidate.jobTitle.toLowerCase().includes(jobTitle.toLowerCase())) return false;

    return true;
  });

  // ソートを適用
  applyCandidatesSort();

  // テーブルを再描画
  renderCandidatesTable();

  // URLクエリを更新
  updateCandidatesUrlQuery();
};

// 候補者ソート
const applyCandidatesSort = () => {
  const { field, order } = candidatesState.currentSort;

  candidatesState.filteredCandidates.sort((a, b) => {
    let valueA = a[field];
    let valueB = b[field];

    // 日付の場合は Date オブジェクトに変換
    if (field === 'appliedAt') {
      valueA = new Date(valueA);
      valueB = new Date(valueB);
    }

    // 文字列の場合は小文字で比較
    if (typeof valueA === 'string') {
      valueA = valueA.toLowerCase();
      valueB = valueB.toLowerCase();
    }

    let result = 0;
    if (valueA > valueB) result = 1;
    else if (valueA < valueB) result = -1;

    return order === 'desc' ? -result : result;
  });
};

// URLクエリの更新
const updateCandidatesUrlQuery = () => {
  const params = new URLSearchParams();

  Object.entries(candidatesState.filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
  window.history.replaceState({}, '', newUrl);
};

// URLクエリからフィルタを読み込み
const loadCandidatesFromUrlQuery = () => {
  const params = new URLSearchParams(window.location.search);

  Object.keys(candidatesState.filters).forEach(key => {
    const value = params.get(key);
    if (value) {
      candidatesState.filters[key] = value;
      const input = document.getElementById(`candidatesFilter${key.charAt(0).toUpperCase() + key.slice(1)}`);
      if (input) input.value = value;
    }
  });

  filterCandidates();
};

// 候補者管理のイベントリスナー設定
const setupCandidatesEventListeners = () => {
  // フィルタ入力要素
  const dateFromInput = document.getElementById('candidatesFilterDateFrom');
  const dateToInput = document.getElementById('candidatesFilterDateTo');
  const sourceSelect = document.getElementById('candidatesFilterSource');
  const nameInput = document.getElementById('candidatesFilterName');
  const jobTitleInput = document.getElementById('candidatesFilterJobTitle');
  const resetButton = document.getElementById('candidatesFilterReset');

  // 日付フィルタ
  if (dateFromInput) {
    dateFromInput.addEventListener('change', (e) => {
      candidatesState.filters.dateFrom = e.target.value;
      filterCandidates();
    });
  }

  if (dateToInput) {
    dateToInput.addEventListener('change', (e) => {
      candidatesState.filters.dateTo = e.target.value;
      filterCandidates();
    });
  }

  // 媒体フィルタ
  if (sourceSelect) {
    sourceSelect.addEventListener('change', (e) => {
      candidatesState.filters.source = e.target.value;
      filterCandidates();
    });
  }

  // 名前検索（デバウンス）
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      clearTimeout(candidatesState.searchDebounce);
      candidatesState.searchDebounce = setTimeout(() => {
        candidatesState.filters.name = e.target.value;
        filterCandidates();
      }, 300);
    });
  }

  // 求人名検索（デバウンス）
  if (jobTitleInput) {
    jobTitleInput.addEventListener('input', (e) => {
      clearTimeout(candidatesState.searchDebounce);
      candidatesState.searchDebounce = setTimeout(() => {
        candidatesState.filters.jobTitle = e.target.value;
        filterCandidates();
      }, 300);
    });
  }

  // リセットボタン
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      // フィルタをクリア
      candidatesState.filters = {
        dateFrom: '',
        dateTo: '',
        source: '',
        name: '',
        jobTitle: ''
      };

      // 入力要素をクリア
      if (dateFromInput) dateFromInput.value = '';
      if (dateToInput) dateToInput.value = '';
      if (sourceSelect) sourceSelect.value = '';
      if (nameInput) nameInput.value = '';
      if (jobTitleInput) jobTitleInput.value = '';

      // フィルタを適用
      filterCandidates();
    });
  }

  // ソートヘッダー
  const sortHeaders = document.querySelectorAll('[data-sort]');
  sortHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const field = header.dataset.sort;

      // 現在のソートと同じフィールドの場合は順序を反転
      if (candidatesState.currentSort.field === field) {
        candidatesState.currentSort.order = candidatesState.currentSort.order === 'asc' ? 'desc' : 'asc';
      } else {
        candidatesState.currentSort.field = field;
        candidatesState.currentSort.order = 'desc';
      }

      // ソートヘッダーのスタイル更新
      sortHeaders.forEach(h => h.classList.remove('active'));
      header.classList.add('active');

      // ソートアイコン更新
      const icon = header.querySelector('.sort-icon') || header.querySelector('span');
      if (icon) {
        icon.textContent = candidatesState.currentSort.order === 'asc' ? '↑' : '↓';
      }

      // ソートを適用
      applyCandidatesSort();
      renderCandidatesTable();
    });
  });
};

// 候補者管理の初期化
const initializeCandidatesManagement = () => {
  // URLクエリからフィルタを読み込み
  loadCandidatesFromUrlQuery();

  // 初期表示
  renderCandidatesTable();

  // イベントリスナー設定
  setupCandidatesEventListeners();
};

// ページ切り替え時に候補者管理を初期化
navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    const target = link.dataset.target;

    if (target === 'candidates') {
      // 候補者管理ページがアクティブになった時に初期化
      setTimeout(() => {
        initializeCandidatesManagement();
      }, 0);
    }

    if (target === 'tele-log' || target === 'teleapo') {
      // 架電管理ページがアクティブになった時に初期化
      setTimeout(() => {
        initializeTeleapoManagement();
      }, 0);
    }
  });
});

// =============================================================================
// 架電管理機能
// =============================================================================

// 架電管理のデータ構造
let teleapoData = {
  callLogs: [
    {
      id: 1,
      datetime: '2024-11-13T10:30:00',
      employee: '佐藤',
      target: 'ABC社 田中様',
      phone: '03-1234-5678',
      email: 'tanaka@abc-corp.co.jp',
      result: '設定',
      memo: '一次面談→11/20 15:00設定'
    },
    {
      id: 2,
      datetime: '2024-11-13T11:45:00',
      employee: '田中',
      target: 'XYZ社 鈴木様',
      phone: '03-9876-5432',
      email: 'suzuki@xyz-inc.co.jp',
      result: '通電',
      memo: '一次日程打診中'
    },
    {
      id: 3,
      datetime: '2024-11-13T13:20:00',
      employee: '山本',
      target: 'DEF社 佐々木様',
      phone: '03-5555-1111',
      email: 'sasaki@def-ltd.co.jp',
      result: '不在',
      memo: '再架電予定 11/14'
    },
    {
      id: 4,
      datetime: '2024-11-13T14:15:00',
      employee: '鈴木',
      target: 'GHI株式会社 高橋様',
      phone: '03-2222-9999',
      email: 'takahashi@ghi-group.com',
      result: '着座',
      memo: '面談完了、次回フォローアップ予定'
    },
    {
      id: 5,
      datetime: '2024-11-13T15:30:00',
      employee: '佐藤',
      target: 'JKL商事 山田様',
      phone: '03-7777-3333',
      email: 'yamada@jkl-trading.jp',
      result: 'コールバック',
      memo: '16:00に折り返し予定'
    }
  ],
  employees: ['佐藤', '田中', '山本', '鈴木'],
  personalKpis: {
    dials: 156,
    connects: 78,
    sets: 23,
    shows: 19
  },
  companyKpis: {
    dials: 1247,
    connects: 623,
    sets: 187,
    shows: 154
  }
};

// 架電管理のフィルタ状態
let teleapoFilters = {
  dateStart: '2024-11-01',
  dateEnd: '2024-11-13',
  employee: '',
  result: '',
  target: '',
  sortBy: 'datetime',
  sortOrder: 'desc',
  currentPage: 1,
  pageSize: 50
};

// 架電管理の初期化
const initializeTeleapoManagement = () => {
  console.log('initializeTeleapoManagement called'); // デバッグログ
  console.log('teleapoData:', teleapoData); // デバッグログ
  console.log('teleapoFilters:', teleapoFilters); // デバッグログ

  // tele-logページ内のteleapoセクションを表示
  const teleapoSection = document.querySelector('[data-page="teleapo"]');
  if (teleapoSection && teleapoSection.classList.contains('hidden')) {
    teleapoSection.classList.remove('hidden');
    console.log('Removed hidden class from teleapo section');
  }

  // URLクエリからフィルタを読み込み
  loadTeleapoFiltersFromUrl();

  console.log('After loadTeleapoFiltersFromUrl, filters:', teleapoFilters); // デバッグログ

  // 初期表示
  updateTeleapoKpis();
  renderTeleapoEmployeeList();
  renderTeleapoLogTable();
  renderTeleapoHeatmap();
  renderTeleapoPersonalChart();

  // イベントリスナー設定
  setupTeleapoEventListeners();

  console.log('Teleapo management initialization complete'); // デバッグログ
};

// 個人成績推移チャートを描画
const renderTeleapoPersonalChart = () => {
  const svg = document.getElementById('teleapoPersonalTrendChart');
  if (!svg) return;

  // チャートデータを生成（過去7日間のサンプルデータ）
  const chartData = generatePersonalTrendData();

  // SVG設定
  const width = 800;
  const height = 300;
  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // スケール設定
  const maxY = Math.max(...chartData.map(d => Math.max(d.dials, d.connects, d.sets, d.shows)));
  const scaleX = chartWidth / (chartData.length - 1);
  const scaleY = chartHeight / maxY;

  // SVGをクリア
  svg.innerHTML = '';

  // 背景グリッド
  const gridLines = [];
  for (let i = 0; i <= 4; i++) {
    const y = margin.top + (chartHeight * i / 4);
    gridLines.push(`<line x1="${margin.left}" y1="${y}" x2="${margin.left + chartWidth}" y2="${y}" stroke="#e2e8f0" stroke-width="1" />`);
  }
  svg.innerHTML += gridLines.join('');

  // Y軸ラベル
  for (let i = 0; i <= 4; i++) {
    const value = Math.round(maxY * (4 - i) / 4);
    const y = margin.top + (chartHeight * i / 4);
    svg.innerHTML += `<text x="${margin.left - 10}" y="${y + 5}" text-anchor="end" font-size="12" fill="#64748b">${value}</text>`;
  }

  // データライン描画
  const colors = {
    dials: '#3b82f6',
    connects: '#10b981',
    sets: '#f59e0b',
    shows: '#ef4444'
  };

  const metrics = ['dials', 'connects', 'sets', 'shows'];

  metrics.forEach(metric => {
    const points = chartData.map((d, i) => {
      const x = margin.left + (i * scaleX);
      const y = margin.top + chartHeight - (d[metric] * scaleY);
      return `${x},${y}`;
    }).join(' ');

    svg.innerHTML += `<polyline points="${points}" fill="none" stroke="${colors[metric]}" stroke-width="2" />`;

    // データポイント
    chartData.forEach((d, i) => {
      const x = margin.left + (i * scaleX);
      const y = margin.top + chartHeight - (d[metric] * scaleY);
      svg.innerHTML += `<circle cx="${x}" cy="${y}" r="4" fill="${colors[metric]}" />`;
    });
  });

  // X軸ラベル
  chartData.forEach((d, i) => {
    const x = margin.left + (i * scaleX);
    const y = margin.top + chartHeight + 20;
    svg.innerHTML += `<text x="${x}" y="${y}" text-anchor="middle" font-size="11" fill="#64748b">${d.date}</text>`;
  });

  // 凡例を更新
  const legend = document.getElementById('teleapoPersonalChartLegend');
  if (legend) {
    legend.innerHTML = `
      <div class="flex flex-wrap gap-4 text-xs text-slate-500 mt-3">
        <span class="inline-flex items-center gap-1">
          <div class="w-3 h-3 bg-blue-500 rounded"></div>
          架電数
        </span>
        <span class="inline-flex items-center gap-1">
          <div class="w-3 h-3 bg-emerald-500 rounded"></div>
          通電数
        </span>
        <span class="inline-flex items-center gap-1">
          <div class="w-3 h-3 bg-amber-500 rounded"></div>
          設定数
        </span>
        <span class="inline-flex items-center gap-1">
          <div class="w-3 h-3 bg-red-500 rounded"></div>
          着座数
        </span>
      </div>
    `;
  }
};

// 個人成績推移データを生成
const generatePersonalTrendData = () => {
  const data = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend) {
      // 週末は少なめ
      data.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        dials: Math.floor(Math.random() * 5) + 2,
        connects: Math.floor(Math.random() * 3) + 1,
        sets: Math.floor(Math.random() * 2),
        shows: Math.floor(Math.random() * 1)
      });
    } else {
      // 平日は通常
      const dials = Math.floor(Math.random() * 15) + 15;
      const connects = Math.floor(dials * (0.4 + Math.random() * 0.3));
      const sets = Math.floor(connects * (0.2 + Math.random() * 0.2));
      const shows = Math.floor(sets * (0.7 + Math.random() * 0.3));

      data.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        dials,
        connects,
        sets,
        shows
      });
    }
  }

  return data;
};

// URLクエリからフィルタを読み込み
const loadTeleapoFiltersFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get('teleapo_date_start')) {
    teleapoFilters.dateStart = urlParams.get('teleapo_date_start');
  }
  if (urlParams.get('teleapo_date_end')) {
    teleapoFilters.dateEnd = urlParams.get('teleapo_date_end');
  }
  if (urlParams.get('teleapo_employee')) {
    teleapoFilters.employee = urlParams.get('teleapo_employee');
  }
  if (urlParams.get('teleapo_result')) {
    teleapoFilters.result = urlParams.get('teleapo_result');
  }

  // 日付入力フィールドに値を設定
  const personalStartInput = document.getElementById('teleapoPersonalRangeStart');
  const personalEndInput = document.getElementById('teleapoPersonalRangeEnd');
  const companyStartInput = document.getElementById('teleapoCompanyRangeStart');
  const companyEndInput = document.getElementById('teleapoCompanyRangeEnd');
  const logStartInput = document.getElementById('teleapoLogRangeStart');
  const logEndInput = document.getElementById('teleapoLogRangeEnd');
  const analysisStartInput = document.getElementById('teleapoAnalysisRangeStart');
  const analysisEndInput = document.getElementById('teleapoAnalysisRangeEnd');

  if (personalStartInput) personalStartInput.value = teleapoFilters.dateStart;
  if (personalEndInput) personalEndInput.value = teleapoFilters.dateEnd;
  if (companyStartInput) companyStartInput.value = teleapoFilters.dateStart;
  if (companyEndInput) companyEndInput.value = teleapoFilters.dateEnd;
  if (logStartInput) logStartInput.value = teleapoFilters.dateStart;
  if (logEndInput) logEndInput.value = teleapoFilters.dateEnd;
  if (analysisStartInput) analysisStartInput.value = teleapoFilters.dateStart;
  if (analysisEndInput) analysisEndInput.value = teleapoFilters.dateEnd;

  // フィルタ入力フィールドに値を設定
  const employeeFilter = document.getElementById('teleapoLogEmployeeFilter');
  const resultFilter = document.getElementById('teleapoLogResultFilter');

  if (employeeFilter) employeeFilter.value = teleapoFilters.employee;
  if (resultFilter) resultFilter.value = teleapoFilters.result;
};

// フィルタをURLクエリに保存
const saveTeleapoFiltersToUrl = () => {
  const urlParams = new URLSearchParams(window.location.search);

  if (teleapoFilters.dateStart !== '2024-11-01') {
    urlParams.set('teleapo_date_start', teleapoFilters.dateStart);
  } else {
    urlParams.delete('teleapo_date_start');
  }

  if (teleapoFilters.dateEnd !== '2024-11-13') {
    urlParams.set('teleapo_date_end', teleapoFilters.dateEnd);
  } else {
    urlParams.delete('teleapo_date_end');
  }

  if (teleapoFilters.employee) {
    urlParams.set('teleapo_employee', teleapoFilters.employee);
  } else {
    urlParams.delete('teleapo_employee');
  }

  if (teleapoFilters.result) {
    urlParams.set('teleapo_result', teleapoFilters.result);
  } else {
    urlParams.delete('teleapo_result');
  }

  const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
  window.history.replaceState({}, '', newUrl);
};

// KPIを更新
const updateTeleapoKpis = () => {
  console.log('updateTeleapoKpis called'); // デバッグログ

  const filteredLogs = getFilteredTeleapoLogs();
  console.log('Filtered logs count:', filteredLogs.length); // デバッグログ

  // 個人成績KPIを更新
  const personalDials = filteredLogs.length;
  const personalConnects = filteredLogs.filter(log => ['通電', '設定', '着座'].includes(log.result)).length;
  const personalSets = filteredLogs.filter(log => ['設定', '着座'].includes(log.result)).length;
  const personalShows = filteredLogs.filter(log => log.result === '着座').length;

  const personalConnectRate = personalDials > 0 ? Math.round((personalConnects / personalDials) * 100) : 0;
  const personalSetRate = personalConnects > 0 ? Math.round((personalSets / personalConnects) * 100) : 0;
  const personalShowRate = personalSets > 0 ? Math.round((personalShows / personalSets) * 100) : 0;

  console.log('Personal KPIs:', { personalDials, personalConnects, personalSets, personalShows, personalConnectRate, personalSetRate, personalShowRate }); // デバッグログ

  updateElementText('teleapoPersonalDials', personalDials.toLocaleString());
  updateElementText('teleapoPersonalConnects', personalConnects.toLocaleString());
  updateElementText('teleapoPersonalSets', personalSets.toLocaleString());
  updateElementText('teleapoPersonalShows', personalShows.toLocaleString());
  updateElementText('teleapoPersonalConnectRate', `${personalConnectRate}%`);
  updateElementText('teleapoPersonalSetRate', `${personalSetRate}%`);
  updateElementText('teleapoPersonalShowRate', `${personalShowRate}%`);

  // メタ情報も更新
  const personalConnectRateCard = document.querySelector('#teleapoPersonalConnectRate').closest('.kpi-v2-card');
  if (personalConnectRateCard) {
    const metaElement = personalConnectRateCard.querySelector('.kpi-v2-meta');
    if (metaElement) {
      metaElement.textContent = `通電数 ${personalConnects} / 架電数 ${personalDials}`;
    }
  }

  const personalSetRateCard = document.querySelector('#teleapoPersonalSetRate').closest('.kpi-v2-card');
  if (personalSetRateCard) {
    const metaElement = personalSetRateCard.querySelector('.kpi-v2-meta');
    if (metaElement) {
      metaElement.textContent = `設定数 ${personalSets} / 通電数 ${personalConnects}`;
    }
  }

  const personalShowRateCard = document.querySelector('#teleapoPersonalShowRate').closest('.kpi-v2-card');
  if (personalShowRateCard) {
    const metaElement = personalShowRateCard.querySelector('.kpi-v2-meta');
    if (metaElement) {
      metaElement.textContent = `着座数 ${personalShows} / 設定数 ${personalSets}`;
    }
  }

  // 会社全体のKPIは既存データを使用
  updateElementText('teleapoCompanyDials', teleapoData.companyKpis.dials.toLocaleString());
  updateElementText('teleapoCompanyConnects', teleapoData.companyKpis.connects.toLocaleString());
  updateElementText('teleapoCompanySets', teleapoData.companyKpis.sets.toLocaleString());
  updateElementText('teleapoCompanyShows', teleapoData.companyKpis.shows.toLocaleString());

  const companyConnectRate = Math.round((teleapoData.companyKpis.connects / teleapoData.companyKpis.dials) * 100);
  const companySetRate = Math.round((teleapoData.companyKpis.sets / teleapoData.companyKpis.connects) * 100);
  const companyShowRate = Math.round((teleapoData.companyKpis.shows / teleapoData.companyKpis.sets) * 100);

  updateElementText('teleapoCompanyConnectRate', `${companyConnectRate}%`);
  updateElementText('teleapoCompanySetRate', `${companySetRate}%`);
  updateElementText('teleapoCompanyShowRate', `${companyShowRate}%`);
};

// フィルタリング済みのログを取得
const getFilteredTeleapoLogs = () => {
  console.log('getFilteredTeleapoLogs called');
  console.log('teleapoData.callLogs length:', teleapoData.callLogs ? teleapoData.callLogs.length : 'undefined');
  console.log('teleapoFilters:', teleapoFilters);

  if (!teleapoData.callLogs) {
    console.error('teleapoData.callLogs is undefined');
    return [];
  }

  return teleapoData.callLogs.filter(log => {
    const logDate = new Date(log.datetime);
    const startDate = new Date(teleapoFilters.dateStart);
    const endDate = new Date(teleapoFilters.dateEnd);
    endDate.setHours(23, 59, 59, 999); // 終了日の最後まで含める

    if (logDate < startDate || logDate > endDate) return false;
    if (teleapoFilters.employee && log.employee !== teleapoFilters.employee) return false;
    if (teleapoFilters.result && log.result !== teleapoFilters.result) return false;
    if (teleapoFilters.target && !log.target.toLowerCase().includes(teleapoFilters.target.toLowerCase())) return false;

    return true;
  });
};

// 社員成績テーブルを描画
const renderTeleapoEmployeeList = () => {
  const container = document.getElementById('teleapoEmployeeTableBody');
  if (!container) return;

  // 社員ごとの集計データを生成
  const employeeStats = teleapoData.employees.map(employee => {
    const employeeLogs = teleapoData.callLogs.filter(log => log.employee === employee);
    const dials = employeeLogs.length;
    const connects = employeeLogs.filter(log => ['通電', '設定', '着座'].includes(log.result)).length;
    const sets = employeeLogs.filter(log => ['設定', '着座'].includes(log.result)).length;
    const shows = employeeLogs.filter(log => log.result === '着座').length;

    const connectRate = dials > 0 ? Math.round((connects / dials) * 100) : 0;
    const setRate = connects > 0 ? Math.round((sets / connects) * 100) : 0;
    const showRate = sets > 0 ? Math.round((shows / sets) * 100) : 0;

    return { employee, dials, connects, sets, shows, connectRate, setRate, showRate };
  });

  // ソート
  const sortSelect = document.getElementById('teleapoEmployeeSortSelect');
  const sortValue = sortSelect ? sortSelect.value : 'name-asc';
  const [sortField, sortOrder] = sortValue.split('-');

  employeeStats.sort((a, b) => {
    let aVal = a[sortField === 'name' ? 'employee' : sortField];
    let bVal = b[sortField === 'name' ? 'employee' : sortField];

    if (typeof aVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  // テーブル行生成
  container.innerHTML = employeeStats.map(stat => `
    <tr>
      <td class="font-semibold">${stat.employee}</td>
      <td class="text-center">${stat.dials.toLocaleString()}</td>
      <td class="text-center">${stat.connects.toLocaleString()}</td>
      <td class="text-center">${stat.sets.toLocaleString()}</td>
      <td class="text-center">${stat.shows.toLocaleString()}</td>
      <td class="text-center font-semibold text-blue-600">${stat.connectRate}%</td>
      <td class="text-center font-semibold text-emerald-600">${stat.setRate}%</td>
      <td class="text-center font-semibold text-green-600">${stat.showRate}%</td>
    </tr>
  `).join('');
};

// 架電ログテーブルを描画
const renderTeleapoLogTable = () => {
  const tbody = document.getElementById('teleapoLogTableBody');
  if (!tbody) return;

  const filteredLogs = getFilteredTeleapoLogs();
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    if (teleapoFilters.sortBy === 'datetime') {
      const aDate = new Date(a.datetime);
      const bDate = new Date(b.datetime);
      return teleapoFilters.sortOrder === 'desc' ? bDate - aDate : aDate - bDate;
    }

    const aVal = a[teleapoFilters.sortBy];
    const bVal = b[teleapoFilters.sortBy];

    if (typeof aVal === 'string') {
      return teleapoFilters.sortOrder === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
    }

    return teleapoFilters.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  // ページネーション
  const startIndex = (teleapoFilters.currentPage - 1) * teleapoFilters.pageSize;
  const endIndex = startIndex + teleapoFilters.pageSize;
  const pagedLogs = sortedLogs.slice(startIndex, endIndex);

  // 結果のバッジスタイルマッピング
  const resultBadgeStyles = {
    '通電': 'bg-blue-100 text-blue-700',
    '設定': 'bg-emerald-100 text-emerald-700',
    '着座': 'bg-green-100 text-green-700',
    '不在': 'bg-slate-100 text-slate-600',
    'コールバック': 'bg-amber-100 text-amber-700'
  };

  tbody.innerHTML = pagedLogs.map(log => {
    const formattedDateTime = new Date(log.datetime).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const badgeClass = resultBadgeStyles[log.result] || 'bg-slate-100 text-slate-600';

    return `
      <tr>
        <td class="whitespace-nowrap">${formattedDateTime}</td>
        <td>${log.employee}</td>
        <td>${log.target}</td>
        <td>${log.phone || '-'}</td>
        <td>${log.email || '-'}</td>
        <td>
          <span class="px-2 py-1 ${badgeClass} rounded text-xs font-semibold">${log.result}</span>
        </td>
        <td>${log.memo}</td>
      </tr>
    `;
  }).join('');

  // ページネーション情報を更新
  const totalPages = Math.ceil(sortedLogs.length / teleapoFilters.pageSize);
  updateTeleapoLogPagination(totalPages, sortedLogs.length);
  updateFilterCount('teleapoLogFilterCount', sortedLogs.length);
};

// ページネーション情報を更新
const updateTeleapoLogPagination = (totalPages, totalCount) => {
  const prevBtn = document.getElementById('teleapoLogPrevBtn');
  const nextBtn = document.getElementById('teleapoLogNextBtn');
  const pageInfo = document.getElementById('teleapoLogPageInfo');

  if (prevBtn) prevBtn.disabled = teleapoFilters.currentPage <= 1;
  if (nextBtn) nextBtn.disabled = teleapoFilters.currentPage >= totalPages;
  if (pageInfo) pageInfo.textContent = `${teleapoFilters.currentPage} / ${totalPages}`;
};

// ヒートマップを描画
const renderTeleapoHeatmap = () => {
  const heatmapContainer = document.getElementById('teleapoAnalysisHeatmapContainer');
  if (!heatmapContainer) return;

  // 時間帯（9時から18時）
  const hours = Array.from({ length: 10 }, (_, i) => i + 9);
  const weekdays = ['月', '火', '水', '木', '金'];

  // ヒートマップデータを生成（架電数ベース）
  const heatmapData = generateHeatmapData(weekdays, hours);

  // 最大値を取得してスケール用に使用
  const maxValue = Math.max(...Object.values(heatmapData));

  // ヒートマップHTML生成
  const heatmapHtml = `
    <div class="teleapo-heatmap">
      <div class="teleapo-heatmap-header">
        <div class="teleapo-heatmap-corner"></div>
        ${hours.map(hour => `
          <div class="teleapo-heatmap-hour">${hour}時</div>
        `).join('')}
      </div>
      ${weekdays.map(weekday => `
        <div class="teleapo-heatmap-row">
          <div class="teleapo-heatmap-weekday">${weekday}</div>
          ${hours.map(hour => {
    const key = `${weekday}-${hour}`;
    const value = heatmapData[key] || 0;
    const intensity = maxValue > 0 ? value / maxValue : 0;
    const opacity = 0.1 + (intensity * 0.9);

    return `
              <div class="teleapo-heatmap-cell" 
                   data-weekday="${weekday}" 
                   data-hour="${hour}" 
                   data-value="${value}"
                   style="background-color: rgba(34, 197, 94, ${opacity})"
                   title="${weekday}曜日 ${hour}時: ${value}件">
                <span class="teleapo-heatmap-value">${value > 0 ? value : ''}</span>
              </div>
            `;
  }).join('')}
        </div>
      `).join('')}
    </div>
    <div class="teleapo-heatmap-legend">
      <span class="text-sm text-gray-600">少ない</span>
      <div class="teleapo-heatmap-scale">
        ${Array.from({ length: 5 }, (_, i) => {
    const opacity = 0.1 + (i * 0.225);
    return `<div class="teleapo-heatmap-scale-item" style="background-color: rgba(34, 197, 94, ${opacity})"></div>`;
  }).join('')}
      </div>
      <span class="text-sm text-gray-600">多い</span>
    </div>
  `;

  heatmapContainer.innerHTML = heatmapHtml;

  // セルのホバーイベント
  const cells = heatmapContainer.querySelectorAll('.teleapo-heatmap-cell');
  cells.forEach(cell => {
    cell.addEventListener('mouseenter', (e) => {
      const weekday = e.target.dataset.weekday;
      const hour = e.target.dataset.hour;
      const value = e.target.dataset.value;
      // ツールチップ表示（簡易版）
      console.log(`${weekday}曜日 ${hour}時: ${value}件`);
    });
  });
};

// ヒートマップデータを生成
const generateHeatmapData = (weekdays, hours) => {
  const data = {};

  // 現在の日付から過去の週の架電データをシミュレート
  const now = new Date();
  const currentWeekday = now.getDay(); // 0=日曜日, 1=月曜日, ...

  weekdays.forEach((weekday, weekIndex) => {
    hours.forEach(hour => {
      const key = `${weekday}-${hour}`;

      // 曜日と時間帯による架電数のパターン
      let baseCount = 0;

      // 時間帯による調整（朝と夕方は少なめ、昼間は多め）
      if (hour >= 10 && hour <= 16) {
        baseCount = Math.floor(Math.random() * 20) + 10; // 10-30件
      } else {
        baseCount = Math.floor(Math.random() * 10) + 2;  // 2-12件
      }

      // 曜日による調整（火-木は多め、月金は普通）
      if (weekIndex >= 1 && weekIndex <= 3) {
        baseCount = Math.floor(baseCount * 1.2);
      }

      data[key] = baseCount;
    });
  });

  return data;
};

// イベントリスナー設定
const setupTeleapoEventListeners = () => {
  // 期間レンジの変更イベント
  const rangePickers = [
    'teleapoPersonalRangeStart', 'teleapoPersonalRangeEnd',
    'teleapoCompanyRangeStart', 'teleapoCompanyRangeEnd',
    'teleapoLogRangeStart', 'teleapoLogRangeEnd',
    'teleapoAnalysisRangeStart', 'teleapoAnalysisRangeEnd'
  ];

  rangePickers.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', () => {
        const isStart = id.includes('Start');
        if (isStart) {
          teleapoFilters.dateStart = element.value;
          // 他のスタート日付も同期
          rangePickers.filter(pid => pid.includes('Start')).forEach(pid => {
            const el = document.getElementById(pid);
            if (el && el !== element) el.value = element.value;
          });
        } else {
          teleapoFilters.dateEnd = element.value;
          // 他のエンド日付も同期
          rangePickers.filter(pid => pid.includes('End')).forEach(pid => {
            const el = document.getElementById(pid);
            if (el && el !== element) el.value = element.value;
          });
        }

        saveTeleapoFiltersToUrl();
        updateTeleapoKpis();
        renderTeleapoLogTable();
        renderTeleapoHeatmap();
        renderTeleapoPersonalChart();
      });
    }
  });

  // フィルタの変更イベント
  const employeeFilter = document.getElementById('teleapoLogEmployeeFilter');
  if (employeeFilter) {
    employeeFilter.addEventListener('change', () => {
      teleapoFilters.employee = employeeFilter.value;
      teleapoFilters.currentPage = 1;
      saveTeleapoFiltersToUrl();
      updateTeleapoKpis();
      renderTeleapoLogTable();
    });
  }

  const resultFilter = document.getElementById('teleapoLogResultFilter');
  if (resultFilter) {
    resultFilter.addEventListener('change', () => {
      teleapoFilters.result = resultFilter.value;
      teleapoFilters.currentPage = 1;
      saveTeleapoFiltersToUrl();
      renderTeleapoLogTable();
    });
  }

  const targetSearch = document.getElementById('teleapoLogTargetSearch');
  if (targetSearch) {
    let searchTimeout;
    targetSearch.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        teleapoFilters.target = targetSearch.value;
        teleapoFilters.currentPage = 1;
        renderTeleapoLogTable();
      }, 300); // 300msデバウンス
    });
  }

  // フィルタリセット
  const resetBtn = document.getElementById('teleapoLogFilterReset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      teleapoFilters.employee = '';
      teleapoFilters.result = '';
      teleapoFilters.target = '';
      teleapoFilters.currentPage = 1;

      if (employeeFilter) employeeFilter.value = '';
      if (resultFilter) resultFilter.value = '';
      if (targetSearch) targetSearch.value = '';

      saveTeleapoFiltersToUrl();
      renderTeleapoLogTable();
    });
  }

  // ページネーション
  const prevBtn = document.getElementById('teleapoLogPrevBtn');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (teleapoFilters.currentPage > 1) {
        teleapoFilters.currentPage--;
        renderTeleapoLogTable();
      }
    });
  }

  const nextBtn = document.getElementById('teleapoLogNextBtn');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const filteredLogs = getFilteredTeleapoLogs();
      const totalPages = Math.ceil(filteredLogs.length / teleapoFilters.pageSize);
      if (teleapoFilters.currentPage < totalPages) {
        teleapoFilters.currentPage++;
        renderTeleapoLogTable();
      }
    });
  }

  const pageSizeSelect = document.getElementById('teleapoLogPageSize');
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', () => {
      teleapoFilters.pageSize = parseInt(pageSizeSelect.value);
      teleapoFilters.currentPage = 1;
      renderTeleapoLogTable();
    });
  }

  // ソート
  const sortableHeaders = document.querySelectorAll('#teleapoLogTable .sortable');
  sortableHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const sortField = header.dataset.sort;
      if (teleapoFilters.sortBy === sortField) {
        teleapoFilters.sortOrder = teleapoFilters.sortOrder === 'desc' ? 'asc' : 'desc';
      } else {
        teleapoFilters.sortBy = sortField;
        teleapoFilters.sortOrder = 'desc';
      }

      // ソートインジケーターを更新
      sortableHeaders.forEach(h => {
        const arrow = h.querySelector('span');
        if (arrow) arrow.textContent = '▼';
      });

      const currentArrow = header.querySelector('span');
      if (currentArrow) {
        currentArrow.textContent = teleapoFilters.sortOrder === 'desc' ? '▼' : '▲';
      }

      renderTeleapoLogTable();
    });
  });

  // 社員成績ソート
  const employeeSortSelect = document.getElementById('teleapoEmployeeSortSelect');
  if (employeeSortSelect) {
    employeeSortSelect.addEventListener('change', () => {
      renderTeleapoEmployeeList();
    });
  }

  // 手入力フォーム
  const manualSaveBtn = document.getElementById('teleapoManualSave');
  if (manualSaveBtn) {
    manualSaveBtn.addEventListener('click', () => {
      saveManualCallLog();
    });
  }

  const manualResetBtn = document.getElementById('teleapoManualReset');
  if (manualResetBtn) {
    manualResetBtn.addEventListener('click', () => {
      resetManualForm();
    });
  }
  // CSVインポート機能
  const csvInput = document.getElementById('teleapoCsvInput');
  const csvUploadBtn = document.getElementById('teleapoCsvUpload');

  if (csvUploadBtn) {
    csvUploadBtn.addEventListener('click', () => {
      if (csvInput) csvInput.click();
    });
  }

  if (csvInput) {
    csvInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        importCallLogsCsv(file);
      }
    });
  }
};

// CSVファイルをインポート
const importCallLogsCsv = (file) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const csv = e.target.result;
      const lines = csv.split('\n');

      // ヘッダー行をスキップ
      const dataLines = lines.slice(1).filter(line => line.trim());

      let importCount = 0;
      const errors = [];

      dataLines.forEach((line, index) => {
        try {
          const columns = parseCsvLine(line);

          if (columns.length < 5) {
            errors.push(`行${index + 2}: カラム数が不足しています`);
            return;
          }

          const [datetime, employee, target, phone, email, result, memo] = columns;

          // バリデーション
          if (!datetime || !employee || !target || !result) {
            errors.push(`行${index + 2}: 必須項目が不足しています`);
            return;
          }

          const newLog = {
            id: teleapoData.callLogs.length + importCount + 1,
            datetime: datetime,
            employee: employee.trim(),
            target: target.trim(),
            phone: phone ? phone.trim() : null,
            email: email ? email.trim() : null,
            result: result.trim(),
            memo: memo ? memo.trim() : ''
          };

          teleapoData.callLogs.unshift(newLog);
          importCount++;
        } catch (error) {
          errors.push(`行${index + 2}: ${error.message}`);
        }
      });

      // インポート結果を表示
      let message = `${importCount}件のログをインポートしました。`;
      if (errors.length > 0) {
        message += `\n\nエラー (${errors.length}件):\n${errors.slice(0, 5).join('\n')}`;
        if (errors.length > 5) {
          message += '\n...他に' + (errors.length - 5) + '件';
        }
      }

      alert(message);

      if (importCount > 0) {
        updateTeleapoKpis();
        renderTeleapoLogTable();
      }

    } catch (error) {
      alert('CSVファイルの読み込みに失敗しました: ' + error.message);
    }

    // ファイル入力をリセット
    csvInput.value = '';
  };

  reader.readAsText(file, 'UTF-8');
};

// CSV行をパース（簡単なCSVパーサー）
const parseCsvLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // エスケープされた引用符
        current += '"';
        i++;
      } else {
        // 引用符の開始/終了
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // カンマ区切り
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // 最後のカラム
  result.push(current);

  return result.map(item => item.trim());
};
const saveManualCallLog = () => {
  const datetime = document.getElementById('teleapoManualDatetime').value;
  const employee = document.getElementById('teleapoManualEmployee').value;
  const target = document.getElementById('teleapoManualTarget').value;
  const phone = document.getElementById('teleapoManualPhone').value;
  const email = document.getElementById('teleapoManualEmail').value;
  const result = document.getElementById('teleapoManualResult').value;
  const memo = document.getElementById('teleapoManualMemo').value;

  if (!datetime || !employee || !target || !result) {
    alert('必須項目を入力してください。');
    return;
  }

  const newLog = {
    id: teleapoData.callLogs.length + 1,
    datetime,
    employee,
    target,
    phone: phone || null,
    email: email || null,
    result,
    memo: memo || ''
  };

  teleapoData.callLogs.unshift(newLog); // 最新を先頭に追加

  updateTeleapoKpis();
  renderTeleapoLogTable();
  resetManualForm();

  alert('架電ログを保存しました。');
};

// 手入力フォームをリセット
const resetManualForm = () => {
  document.getElementById('teleapoManualForm').reset();
};

// ユーティリティ関数：要素のテキストを更新
const updateElementText = (id, text) => {
  const element = document.getElementById(id);
  console.log(`updateElementText: id=${id}, text=${text}, element found:`, !!element);
  if (element) {
    element.textContent = text;
    console.log(`Updated ${id} to: ${text}`);
  } else {
    console.error(`Element with id '${id}' not found`);
  }
};

// ユーティリティ関数：フィルタ件数を更新
const updateFilterCount = (id, count) => {
  const element = document.getElementById(id);
  if (element) element.textContent = `${count}件`;
};

// =============================================================================
// 紹介実績管理機能
// =============================================================================

// 紹介実績管理のデータ構造
let referralData = {
  companies: [
    {
      companyId: 1,
      companyName: 'テックイノベーション株式会社',
      jobs: [
        {
          jobTitle: 'フロントエンドエンジニア',
          planHeadcount: 3,
          hiredCount: 1,
          proposal: 15,
          docScreen: 8,
          interview1: 5,
          interview2: 3,
          offer: 2,
          joined: 1,
          retainedCount: 1,
          prejoinDeclines: 1,
          refundAmount: 0,
          fee: 800000,
          avgLeadTimeDays: 45
        },
        {
          jobTitle: 'バックエンドエンジニア',
          planHeadcount: 2,
          hiredCount: 2,
          proposal: 12,
          docScreen: 7,
          interview1: 4,
          interview2: 3,
          offer: 2,
          joined: 2,
          retainedCount: 2,
          prejoinDeclines: 0,
          refundAmount: 0,
          fee: 1600000,
          avgLeadTimeDays: 38
        }
      ],
      detail: {
        company: {
          name: 'テックイノベーション株式会社',
          profile: 'AI・機械学習技術を活用したSaaSプロダクトを開発するスタートアップ企業。',
          address: '東京都渋谷区神宮前1-1-1',
          contact: '田中 太郎（HR部長）',
          industry: 'IT・ソフトウェア',
          notes: '急成長中で優秀な技術者を積極採用中。リモートワーク制度充実。'
        },
        wants: {
          skills: 'React, TypeScript, Node.js, AWS',
          experience: '3年以上のWeb開発経験、アジャイル開発経験',
          traits: '自主性があり、チームワークを大切にする方',
          memo: '技術的な成長意欲が高く、新しい技術への興味がある方を求めています。'
        }
      }
    },
    {
      companyId: 2,
      companyName: 'グローバルコマース株式会社',
      jobs: [
        {
          jobTitle: '営業マネージャー',
          planHeadcount: 1,
          hiredCount: 0,
          proposal: 8,
          docScreen: 5,
          interview1: 3,
          interview2: 2,
          offer: 1,
          joined: 0,
          retainedCount: 0,
          prejoinDeclines: 1,
          refundAmount: 0,
          fee: 0,
          avgLeadTimeDays: 52
        }
      ],
      detail: {
        company: {
          name: 'グローバルコマース株式会社',
          profile: 'EC事業を中心とした総合商社。海外展開を積極的に推進中。',
          address: '東京都港区赤坂2-2-2',
          contact: '佐藤 花子（人事部）',
          industry: '商社・卸売',
          notes: 'グローバル展開に向けて営業力強化を図っている。'
        },
        wants: {
          skills: 'B2B営業経験、英語スキル（TOEIC700以上）',
          experience: '5年以上の営業経験、マネジメント経験',
          traits: 'リーダーシップがあり、積極的に行動できる方',
          memo: '海外市場開拓に意欲的で、チームをリードできる方を募集しています。'
        }
      }
    },
    {
      companyId: 3,
      companyName: 'デジタルマーケティングソリューションズ',
      jobs: [
        {
          jobTitle: 'データサイエンティスト',
          planHeadcount: 2,
          hiredCount: 1,
          proposal: 10,
          docScreen: 6,
          interview1: 4,
          interview2: 2,
          offer: 2,
          joined: 1,
          retainedCount: 1,
          prejoinDeclines: 0,
          refundAmount: 0,
          fee: 1000000,
          avgLeadTimeDays: 42
        },
        {
          jobTitle: 'マーケティングマネージャー',
          planHeadcount: 1,
          hiredCount: 1,
          proposal: 6,
          docScreen: 4,
          interview1: 2,
          interview2: 2,
          offer: 1,
          joined: 1,
          retainedCount: 1,
          prejoinDeclines: 0,
          refundAmount: 0,
          fee: 900000,
          avgLeadTimeDays: 35
        }
      ],
      detail: {
        company: {
          name: 'デジタルマーケティングソリューションズ',
          profile: 'データドリブンなマーケティングソリューションを提供する企業。',
          address: '東京都新宿区西新宿3-3-3',
          contact: '山田 次郎（採用担当）',
          industry: 'マーケティング・広告',
          notes: 'データ分析に強みを持ち、クライアントのマーケティング成果向上を支援。'
        },
        wants: {
          skills: 'Python, SQL, Google Analytics, 統計解析',
          experience: 'データ分析業務3年以上、マーケティング領域での経験',
          traits: '論理的思考力があり、課題解決に取り組める方',
          memo: 'データを活用してビジネス成果に貢献できる方を求めています。'
        }
      }
    }
  ]
};

// 紹介実績管理のフィルタ状態
let referralFilters = {
  dateStart: '2024-01-01',
  dateEnd: '2024-12-31',
  company: '',
  jobTitle: '',
  sortBy: 'company',
  sortOrder: 'asc',
  currentPage: 1,
  pageSize: 50
};

// 選択された企業
let selectedCompany = null;

// 紹介実績管理の初期化
const initializeReferralManagement = () => {
  console.log('initializeReferralManagement called'); // デバッグログ
  // 初期表示
  renderReferralTable();

  // イベントリスナー設定
  setupReferralEventListeners();
  setupMatchingEventListeners();
  console.log('Referral management initialization complete'); // デバッグログ
};

// 紹介実績テーブルを描画
const renderReferralTable = () => {
  console.log('renderReferralTable called'); // デバッグログ
  const tbody = document.getElementById('referralTableBody');
  if (!tbody) {
    console.error('referralTableBody not found'); // デバッグログ
    return;
  }

  const tableRows = [];
  console.log('Companies data:', referralData.companies); // デバッグログ

  referralData.companies.forEach(company => {
    // 各職種の行を追加
    company.jobs.forEach(job => {
      const remaining = job.planHeadcount - job.hiredCount;
      const retentionRate = job.joined > 0 ? Math.round((job.retainedCount / job.joined) * 100) : 0;

      // 残り人数の色分けクラス
      let remainingClass = 'remaining-excess';
      if (remaining > 5) remainingClass = 'remaining-critical';
      else if (remaining >= 1) remainingClass = 'remaining-warning';
      else if (remaining === 0) remainingClass = 'remaining-ok';

      tableRows.push(`
        <tr class="company-row" data-company-id="${company.companyId}">
          <td class="sticky left-0 bg-white z-10">${company.companyName}</td>
          <td>${job.jobTitle}</td>
          <td class="text-center">${job.planHeadcount.toLocaleString()}</td>
          <td class="text-center ${remainingClass}">${remaining}</td>
          <td class="text-center">${job.proposal.toLocaleString()}</td>
          <td class="text-center">${job.docScreen.toLocaleString()}</td>
          <td class="text-center">${job.interview1.toLocaleString()}</td>
          <td class="text-center">${job.interview2.toLocaleString()}</td>
          <td class="text-center">${job.offer.toLocaleString()}</td>
          <td class="text-center">${job.joined.toLocaleString()}</td>
          <td class="text-center">${retentionRate}%</td>
          <td class="text-center">${job.prejoinDeclines.toLocaleString()}</td>
        </tr>
      `);
    });

    // 企業合計行を追加
    const totalPlanHeadcount = company.jobs.reduce((sum, job) => sum + job.planHeadcount, 0);
    const totalHiredCount = company.jobs.reduce((sum, job) => sum + job.hiredCount, 0);
    const totalProposal = company.jobs.reduce((sum, job) => sum + job.proposal, 0);
    const totalDocScreen = company.jobs.reduce((sum, job) => sum + job.docScreen, 0);
    const totalInterview1 = company.jobs.reduce((sum, job) => sum + job.interview1, 0);
    const totalInterview2 = company.jobs.reduce((sum, job) => sum + job.interview2, 0);
    const totalOffer = company.jobs.reduce((sum, job) => sum + job.offer, 0);
    const totalJoined = company.jobs.reduce((sum, job) => sum + job.joined, 0);
    const totalRetained = company.jobs.reduce((sum, job) => sum + job.retainedCount, 0);
    const totalPrejoinDeclines = company.jobs.reduce((sum, job) => sum + job.prejoinDeclines, 0);
    const totalRemaining = totalPlanHeadcount - totalHiredCount;
    const totalRetentionRate = totalJoined > 0 ? Math.round((totalRetained / totalJoined) * 100) : 0;

    let totalRemainingClass = 'remaining-excess';
    if (totalRemaining > 5) totalRemainingClass = 'remaining-critical';
    else if (totalRemaining >= 1) totalRemainingClass = 'remaining-warning';
    else if (totalRemaining === 0) totalRemainingClass = 'remaining-ok';

    tableRows.push(`
      <tr class="company-total-row" data-company-id="${company.companyId}">
        <td class="sticky left-0 bg-slate-50 z-10">${company.companyName} 合計</td>
        <td>—</td>
        <td class="text-center">${totalPlanHeadcount.toLocaleString()}</td>
        <td class="text-center ${totalRemainingClass}">${totalRemaining}</td>
        <td class="text-center">${totalProposal.toLocaleString()}</td>
        <td class="text-center">${totalDocScreen.toLocaleString()}</td>
        <td class="text-center">${totalInterview1.toLocaleString()}</td>
        <td class="text-center">${totalInterview2.toLocaleString()}</td>
        <td class="text-center">${totalOffer.toLocaleString()}</td>
        <td class="text-center">${totalJoined.toLocaleString()}</td>
        <td class="text-center">${totalRetentionRate}%</td>
        <td class="text-center">${totalPrejoinDeclines.toLocaleString()}</td>
      </tr>
    `);
  });

  tbody.innerHTML = tableRows.join('');

  // フィルタ件数を更新
  updateFilterCount('referralFilterCount', referralData.companies.length);
};

// 企業詳細ドロワーを表示
const showCompanyDrawer = (companyId) => {
  console.log('showCompanyDrawer called with ID:', companyId); // デバッグログ
  const company = referralData.companies.find(c => c.companyId === companyId);
  if (!company) {
    console.error('Company not found for ID:', companyId); // デバッグログ
    return;
  }

  console.log('Company found:', company.companyName); // デバッグログ
  selectedCompany = company;

  // 企業情報を設定
  document.getElementById('companyDrawerName').textContent = company.detail.company.name;
  document.getElementById('companyDrawerLocation').textContent = company.detail.company.address;
  document.getElementById('companyInfo_name').textContent = company.detail.company.name;
  document.getElementById('companyInfo_address').textContent = company.detail.company.address;
  document.getElementById('companyInfo_contact').textContent = company.detail.company.contact;
  document.getElementById('companyInfo_industry').textContent = company.detail.company.industry;
  document.getElementById('companyInfo_profile').textContent = company.detail.company.profile;

  // 指標サマリーを計算・設定
  const totalProposal = company.jobs.reduce((sum, job) => sum + job.proposal, 0);
  const totalHired = company.jobs.reduce((sum, job) => sum + job.hiredCount, 0);
  const totalRetained = company.jobs.reduce((sum, job) => sum + job.retainedCount, 0);
  const totalFee = company.jobs.reduce((sum, job) => sum + job.fee, 0);
  const avgLeadTime = company.jobs.length > 0
    ? Math.round(company.jobs.reduce((sum, job) => sum + job.avgLeadTimeDays, 0) / company.jobs.length)
    : 0;
  const totalPrejoinDeclines = company.jobs.reduce((sum, job) => sum + job.prejoinDeclines, 0);
  const retentionRate = totalHired > 0 ? Math.round((totalRetained / totalHired) * 100) : 0;

  document.getElementById('summary_proposal').textContent = totalProposal.toLocaleString();
  document.getElementById('summary_hired').textContent = totalHired.toLocaleString();
  document.getElementById('summary_retention').textContent = `${retentionRate}%`;
  document.getElementById('summary_fee').textContent = `¥${totalFee.toLocaleString()}`;
  document.getElementById('summary_leadtime').textContent = `${avgLeadTime}日`;
  document.getElementById('summary_prejoinDeclines').textContent = totalPrejoinDeclines.toLocaleString();

  // 欲しい人材情報を設定
  document.getElementById('wants_skills').textContent = company.detail.wants.skills;
  document.getElementById('wants_experience').textContent = company.detail.wants.experience;
  document.getElementById('wants_traits').textContent = company.detail.wants.traits;

  // ドロワー要素の存在確認
  const overlay = document.getElementById('companyDrawerOverlay');
  const drawer = document.getElementById('companyDrawer');

  console.log('Overlay element:', overlay); // デバッグログ
  console.log('Drawer element:', drawer); // デバッグログ

  if (!overlay) {
    console.error('companyDrawerOverlay element not found!');
    return;
  }

  if (!drawer) {
    console.error('companyDrawer element not found!');
    return;
  }

  // ドロワーを表示
  if (DEBUG) console.log('Showing drawer...');
  overlay.classList.remove('hidden');
  overlay.classList.add('visible');
  drawer.classList.remove('hidden');
  drawer.classList.add('open');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(15, 23, 42, 0.6)';
  overlay.style.zIndex = '40';

  drawer.style.position = 'fixed';
  drawer.style.top = '0';
  drawer.style.right = '0';
  drawer.style.width = '480px';
  drawer.style.maxWidth = '90vw';
  drawer.style.height = '100vh';
  drawer.style.background = '#ffffff';
  drawer.style.boxShadow = '-8px 0 25px rgba(15, 23, 42, 0.15)';
  drawer.style.zIndex = '50';
  drawer.style.overflowY = 'auto';
  drawer.style.borderLeft = '1px solid #e2e8f0';

  console.log('Overlay classes after show:', overlay.classList.toString()); // デバッグログ
  console.log('Drawer classes after show:', drawer.classList.toString()); // デバッグログ
  console.log('Overlay computed style display:', window.getComputedStyle(overlay).display); // デバッグログ
  console.log('Drawer computed style right:', window.getComputedStyle(drawer).right); // デバッグログ
  console.log('Drawer computed style background:', window.getComputedStyle(drawer).backgroundColor); // デバッグログ
  console.log('Drawer computed style width:', window.getComputedStyle(drawer).width); // デバッグログ
  console.log('Drawer computed style z-index:', window.getComputedStyle(drawer).zIndex); // デバッグログ

  // フォーカストラップ設定
  drawer.focus();
};

// 企業詳細ドロワーを閉じる
const hideCompanyDrawer = () => {
  const overlay = document.getElementById('companyDrawerOverlay');
  const drawer = document.getElementById('companyDrawer');

  if (overlay) {
    overlay.classList.add('hidden');
    overlay.classList.remove('visible');
  }

  if (drawer) {
    drawer.classList.add('hidden');
    drawer.classList.remove('open'); // CSS用のクラス削除
    // インラインスタイルをクリア
    drawer.style.right = '-500px';
  }

  selectedCompany = null;
};

// マッチング実行（モック実装）
const executeMatching = (query) => {
  // モックのマッチング結果
  const mockResults = [
    {
      companyName: 'テックイノベーション株式会社',
      jobTitle: 'フロントエンドエンジニア',
      score: 92,
      reason: 'React, TypeScriptのスキルが合致。3年以上の経験要件もクリア。',
      location: '東京都渋谷区',
      salaryRange: '600-900万円'
    },
    {
      companyName: 'デジタルマーケティングソリューションズ',
      jobTitle: 'データサイエンティスト',
      score: 78,
      reason: 'Python, SQLスキルが活用可能。データ分析経験が評価ポイント。',
      location: '東京都新宿区',
      salaryRange: '700-1000万円'
    },
    {
      companyName: 'グローバルコマース株式会社',
      jobTitle: '営業マネージャー',
      score: 65,
      reason: 'マネジメント経験とコミュニケーション能力が期待される。',
      location: '東京都港区',
      salaryRange: '800-1200万円'
    }
  ];

  // スコアに基づいて結果をソート
  mockResults.sort((a, b) => b.score - a.score);

  return mockResults;
};

// マッチング結果を表示
const displayMatchResults = (results) => {
  const container = document.getElementById('matchResults');
  if (!container) return;

  if (results.length === 0) {
    container.innerHTML = `
      <div class="text-center text-slate-500 text-sm py-8">
        マッチする企業が見つかりませんでした
      </div>
    `;
    return;
  }

  const resultsHtml = results.map(result => {
    let scoreClass = 'low';
    if (result.score >= 80) scoreClass = 'high';
    else if (result.score >= 60) scoreClass = 'medium';

    return `
      <div class="match-result-item">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="font-semibold text-slate-900">${result.companyName}</div>
            <div class="text-sm text-slate-600 mt-1">${result.jobTitle}</div>
            <div class="text-xs text-slate-500 mt-2">${result.reason}</div>
            <div class="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <span>📍 ${result.location}</span>
              <span>💰 ${result.salaryRange}</span>
            </div>
          </div>
          <div class="ml-4 text-center">
            <div class="match-score ${scoreClass}">${result.score}</div>
            <div class="text-xs text-slate-500">スコア</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = resultsHtml;
};

// イベントリスナー設定
// イベントリスナー設定（重複防止）
let referralEventListenersInitialized = false;

const setupReferralEventListeners = () => {
  // 既に初期化済みの場合はスキップ
  if (referralEventListenersInitialized) return;

  // テーブル行クリック（イベント委譲）
  document.addEventListener('click', (e) => {
    // 紹介実績ページでのみ動作
    const referralSection = document.querySelector('[data-page="referral"]:not(.hidden)');
    if (!referralSection) return;

    const row = e.target.closest('.company-row, .company-total-row');
    if (row) {
      console.log('Row clicked:', row.dataset.companyId); // デバッグログ
      const companyId = parseInt(row.dataset.companyId);
      if (!isNaN(companyId)) {
        showCompanyDrawer(companyId);
      }
    }
  });

  // ドロワーを閉じる
  const closeBtn = document.getElementById('companyDrawerClose');
  const overlay = document.getElementById('companyDrawerOverlay');

  if (closeBtn) {
    closeBtn.addEventListener('click', hideCompanyDrawer);
  }

  if (overlay) {
    overlay.addEventListener('click', hideCompanyDrawer);
  }

  // Escキーでドロワーを閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selectedCompany) {
      hideCompanyDrawer();
    }
  });

  referralEventListenersInitialized = true;
  console.log('Referral event listeners initialized'); // デバッグログ
};

// マッチング機能のイベントリスナー設定
const setupMatchingEventListeners = () => {
  // タブ切替
  const candidateTab = document.getElementById('matchTabCandidate');
  const conditionTab = document.getElementById('matchTabCondition');
  const candidatePanel = document.getElementById('matchCandidatePanel');
  const conditionPanel = document.getElementById('matchConditionPanel');

  if (candidateTab && conditionTab && candidatePanel && conditionPanel) {
    candidateTab.addEventListener('click', () => {
      candidateTab.classList.add('border-indigo-500', 'text-indigo-600');
      candidateTab.classList.remove('border-transparent', 'text-slate-500');
      conditionTab.classList.remove('border-indigo-500', 'text-indigo-600');
      conditionTab.classList.add('border-transparent', 'text-slate-500');

      candidatePanel.classList.remove('hidden');
      conditionPanel.classList.add('hidden');
    });

    conditionTab.addEventListener('click', () => {
      conditionTab.classList.add('border-indigo-500', 'text-indigo-600');
      conditionTab.classList.remove('border-transparent', 'text-slate-500');
      candidateTab.classList.remove('border-indigo-500', 'text-indigo-600');
      candidateTab.classList.add('border-transparent', 'text-slate-500');

      conditionPanel.classList.remove('hidden');
      candidatePanel.classList.add('hidden');
    });
  }

  // マッチング実行ボタン
  const matchFromCandidateBtn = document.getElementById('matchFromCandidate');
  const matchFromConditionBtn = document.getElementById('matchFromCondition');

  if (matchFromCandidateBtn) {
    matchFromCandidateBtn.addEventListener('click', () => {
      const candidateText = document.getElementById('candidateText').value;
      if (!candidateText.trim()) {
        alert('候補者プロフィールを入力してください。');
        return;
      }

      const results = executeMatching({ candidateText });
      displayMatchResults(results);
    });
  }

  if (matchFromConditionBtn) {
    matchFromConditionBtn.addEventListener('click', () => {
      const salaryMin = document.getElementById('conditionSalaryMin').value;
      const salaryMax = document.getElementById('conditionSalaryMax').value;
      const location = document.getElementById('conditionLocation').value;
      const skills = document.getElementById('conditionSkills').value;

      const query = {
        req: {
          salary: salaryMin && salaryMax ? `${salaryMin}-${salaryMax}万円` : null,
          location: location || null,
          skills: skills || null
        }
      };

      const results = executeMatching(query);
      displayMatchResults(results);
    });
  }
};

// =============================================================================
// ページ初期化と設定
// =============================================================================

// 古いdata-target方式のナビゲーション処理
const setupLegacyNavigation = () => {
  if (initializationFlags.legacyNavigation) {
    if (DEBUG) console.log('Legacy navigation already initialized');
    return;
  }

  document.querySelectorAll('[data-target]').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const targetPage = button.getAttribute('data-target');
      if (DEBUG) console.log('Legacy navigation clicked, target:', targetPage);

      // 全てのページを隠す
      document.querySelectorAll('[data-page]').forEach(page => {
        page.classList.add('hidden');
      });

      // 対象ページを表示
      const pageElement = document.querySelector(`[data-page="${targetPage}"]`);
      if (DEBUG) console.log('Legacy navigation page element found:', !!pageElement, 'for target:', targetPage);

      if (pageElement) {
        pageElement.classList.remove('hidden');
        if (DEBUG) console.log('Legacy navigation page displayed:', targetPage);
        if (DEBUG) console.log('Page classes:', pageElement.className);
      } else {
        console.error('Legacy navigation page not found:', targetPage);
      }

      // ナビゲーション状態を更新
      updateLegacyNavigationState(targetPage);

      // ページ固有の初期化
      initializeTargetPage(targetPage);
    });
  });

  initializationFlags.legacyNavigation = true;
  if (DEBUG) console.log('Legacy navigation initialized');
};

// レガシーナビゲーション状態を更新
const updateLegacyNavigationState = (currentTarget) => {
  document.querySelectorAll('[data-target]').forEach(button => {
    const target = button.getAttribute('data-target');
    if (target === currentTarget) {
      button.classList.add('bg-slate-800', 'text-white');
      button.classList.remove('text-slate-300');
    } else {
      button.classList.remove('bg-slate-800', 'text-white');
      button.classList.add('text-slate-300');
    }
  });
};

// 対象ページの初期化
const initializeTargetPage = (target) => {
  console.log('initializeTargetPage called with target:', target); // デバッグログ

  // 少し遅延して初期化を実行
  setTimeout(() => {
    if (target === 'tele-log') {
      console.log('Initializing telemarketing management...'); // デバッグログ
      initializeTeleapoManagement(); // 正しい関数名に修正
    } else if (target === 'referral') {
      console.log('Initializing referral management...'); // デバッグログ
      initializeReferralManagement();
    } else if (target === 'ad-performance') {
      console.log('Initializing ad management...'); // デバッグログ
      initializeAdManagement();
    } else if (target === 'yield') {
      setDefaultKpiRanges();
      updateKpiDisplay();
      setupKpiEventListeners();
    }
  }, 100); // 100ms遅延
};

// ページルーティング
const showPage = (pageName) => {
  console.log('showPage called with:', pageName);

  // すべてのページを非表示
  document.querySelectorAll('[data-page]').forEach(page => {
    page.classList.add('hidden');
    console.log('Hidden page:', page.dataset.page);
  });

  // 指定されたページを表示
  const targetPage = document.querySelector(`[data-page="${pageName}"]`);
  console.log('Target page found:', !!targetPage, 'for page:', pageName);

  if (targetPage) {
    targetPage.classList.remove('hidden');
    console.log('Page displayed:', pageName);
    console.log('Target page classes after show:', targetPage.className);
  } else {
    console.error('Page not found:', pageName);
  }

  // 現在表示されているページを確認
  const visiblePages = document.querySelectorAll('[data-page]:not(.hidden)');
  console.log('Currently visible pages:', Array.from(visiblePages).map(p => p.dataset.page));

  // ナビゲーション更新
  updateNavigationState(pageName);

  // ページ固有の初期化
  initializeCurrentPage(pageName);
};

// 現在のページを取得
const getCurrentPage = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('page') || 'kpi';
};

// ナビゲーション状態を更新
const updateNavigationState = (currentPage) => {
  document.querySelectorAll('#pageNav a').forEach(link => {
    const pageName = new URL(link.href).searchParams.get('page') || 'kpi';
    if (pageName === currentPage) {
      link.classList.add('bg-indigo-50', 'text-indigo-700');
      link.classList.remove('text-slate-600', 'hover:text-slate-900');
    } else {
      link.classList.remove('bg-indigo-50', 'text-indigo-700');
      link.classList.add('text-slate-600', 'hover:text-slate-900');
    }
  });
};

// 現在のページの初期化
const initializeCurrentPage = (pageName) => {
  if (pageName === 'telemarketing' || pageName === 'tele-log') {
    console.log('Initializing teleapo management for page:', pageName); // デバッグログ
    initializeTeleapoManagement(); // 正しい関数名に修正
  } else if (pageName === 'referral') {
    initializeReferralManagement();
  } else if (pageName === 'ad-performance') {
    initializeAdManagement();
  } else if (pageName === 'kpi' || pageName === 'yield') {
    setDefaultKpiRanges();
    updateKpiDisplay();
    setupKpiEventListeners();
  }
};

// 全体の初期化
const initializeDashboard = () => {
  console.log("Initializing dashboard...");

  // レガシーナビゲーション設定
  setupLegacyNavigation();

  // 初期ページ表示（yieldページ）
  const initialPage = 'yield';
  document.querySelectorAll('[data-page]').forEach(page => {
    page.classList.add('hidden');
  });
  const yieldPage = document.querySelector(`[data-page="${initialPage}"]`);
  if (yieldPage) {
    yieldPage.classList.remove('hidden');
  }

  // 初期ナビゲーション状態設定
  updateLegacyNavigationState(initialPage);

  // 初期ページ初期化
  initializeTargetPage(initialPage);
};

// ========================
// 広告管理機能
// ========================

// 広告管理データ
let adManagementData = {
  mediaData: [
    {
      id: 1,
      mediaName: 'Indeed',
      applications: 245,
      interviews: 89,
      offers: 34,
      hired: 28,
      retained: 24,
      refundAmount: 150000,
      validApplications: 220
    },
    {
      id: 2,
      mediaName: 'リクナビNEXT',
      applications: 189,
      interviews: 67,
      offers: 23,
      hired: 19,
      retained: 17,
      refundAmount: 95000,
      validApplications: 175
    },
    {
      id: 3,
      mediaName: 'doda',
      applications: 312,
      interviews: 124,
      offers: 48,
      hired: 41,
      retained: 38,
      refundAmount: 180000,
      validApplications: 298
    },
    {
      id: 4,
      mediaName: 'マイナビ転職',
      applications: 156,
      interviews: 45,
      offers: 18,
      hired: 15,
      retained: 13,
      refundAmount: 75000,
      validApplications: 142
    },
    {
      id: 5,
      mediaName: 'エン転職',
      applications: 203,
      interviews: 78,
      offers: 29,
      hired: 24,
      retained: 21,
      refundAmount: 120000,
      validApplications: 188
    },
    {
      id: 6,
      mediaName: 'ビズリーチ',
      applications: 127,
      interviews: 52,
      offers: 21,
      hired: 18,
      retained: 16,
      refundAmount: 85000,
      validApplications: 115
    },
    {
      id: 7,
      mediaName: 'Green',
      applications: 98,
      interviews: 38,
      offers: 15,
      hired: 12,
      retained: 11,
      refundAmount: 60000,
      validApplications: 89
    },
    {
      id: 8,
      mediaName: 'Wantedly',
      applications: 167,
      interviews: 61,
      offers: 22,
      hired: 18,
      retained: 15,
      refundAmount: 90000,
      validApplications: 152
    },
    {
      id: 9,
      mediaName: 'type',
      applications: 134,
      interviews: 49,
      offers: 19,
      hired: 16,
      retained: 14,
      refundAmount: 70000,
      validApplications: 125
    },
    {
      id: 10,
      mediaName: 'キャリアインデックス',
      applications: 89,
      interviews: 32,
      offers: 12,
      hired: 10,
      retained: 9,
      refundAmount: 45000,
      validApplications: 81
    },
    {
      id: 11,
      mediaName: '@type',
      applications: 112,
      interviews: 41,
      offers: 16,
      hired: 13,
      retained: 12,
      refundAmount: 65000,
      validApplications: 102
    },
    {
      id: 12,
      mediaName: 'イーキャリア',
      applications: 76,
      interviews: 28,
      offers: 11,
      hired: 9,
      retained: 8,
      refundAmount: 40000,
      validApplications: 69
    },
    {
      id: 13,
      mediaName: 'Find Job!',
      applications: 93,
      interviews: 35,
      offers: 14,
      hired: 11,
      retained: 10,
      refundAmount: 55000,
      validApplications: 85
    },
    {
      id: 14,
      mediaName: 'はたらこねっと',
      applications: 145,
      interviews: 54,
      offers: 20,
      hired: 17,
      retained: 15,
      refundAmount: 80000,
      validApplications: 132
    },
    {
      id: 15,
      mediaName: 'バイトル',
      applications: 178,
      interviews: 66,
      offers: 25,
      hired: 21,
      retained: 19,
      refundAmount: 105000,
      validApplications: 163
    },
    {
      id: 16,
      mediaName: 'タウンワーク',
      applications: 156,
      interviews: 58,
      offers: 22,
      hired: 19,
      retained: 17,
      refundAmount: 95000,
      validApplications: 142
    },
    {
      id: 17,
      mediaName: 'アルバイトEX',
      applications: 87,
      interviews: 32,
      offers: 13,
      hired: 11,
      retained: 10,
      refundAmount: 50000,
      validApplications: 79
    },
    {
      id: 18,
      mediaName: 'ジョブメドレー',
      applications: 134,
      interviews: 49,
      offers: 19,
      hired: 16,
      retained: 14,
      refundAmount: 75000,
      validApplications: 123
    },
    {
      id: 19,
      mediaName: 'コメディカルドットコム',
      applications: 98,
      interviews: 36,
      offers: 14,
      hired: 12,
      retained: 11,
      refundAmount: 60000,
      validApplications: 89
    },
    {
      id: 20,
      mediaName: 'カイゴジョブ',
      applications: 167,
      interviews: 62,
      offers: 24,
      hired: 20,
      retained: 18,
      refundAmount: 100000,
      validApplications: 152
    }
  ]
};

// 広告管理フィルタ
let adManagementFilters = {
  mediaName: '',
  sortBy: '',
  sortOrder: 'desc',
  currentPage: 1,
  pageSize: 50
};

// URLクエリから広告管理フィルタを読み込み
const loadAdManagementFiltersFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get('ad_media')) {
    adManagementFilters.mediaName = urlParams.get('ad_media');
  }

  if (urlParams.get('ad_sort')) {
    adManagementFilters.sortBy = urlParams.get('ad_sort');
  }

  if (urlParams.get('ad_order')) {
    adManagementFilters.sortOrder = urlParams.get('ad_order');
  }

  if (urlParams.get('ad_page')) {
    adManagementFilters.currentPage = parseInt(urlParams.get('ad_page')) || 1;
  }
};

// 広告管理フィルタをURLに保存
const saveAdManagementFiltersToUrl = () => {
  const url = new URL(window.location);

  if (adManagementFilters.mediaName) {
    url.searchParams.set('ad_media', adManagementFilters.mediaName);
  } else {
    url.searchParams.delete('ad_media');
  }

  if (adManagementFilters.sortBy) {
    url.searchParams.set('ad_sort', adManagementFilters.sortBy);
    url.searchParams.set('ad_order', adManagementFilters.sortOrder);
  } else {
    url.searchParams.delete('ad_sort');
    url.searchParams.delete('ad_order');
  }

  if (adManagementFilters.currentPage > 1) {
    url.searchParams.set('ad_page', adManagementFilters.currentPage);
  } else {
    url.searchParams.delete('ad_page');
  }

  window.history.replaceState({}, '', url);
};

// フィルタ済み広告データを取得
const getFilteredAdManagementData = () => {
  let filteredData = adManagementData.mediaData.slice();

  // 媒体名フィルタ
  if (adManagementFilters.mediaName) {
    filteredData = filteredData.filter(item =>
      item.mediaName.toLowerCase().includes(adManagementFilters.mediaName.toLowerCase())
    );
  }

  // ソート
  if (adManagementFilters.sortBy) {
    filteredData.sort((a, b) => {
      let aVal, bVal;

      switch (adManagementFilters.sortBy) {
        case 'applications':
          aVal = a.applications;
          bVal = b.applications;
          break;
        case 'hired':
          aVal = a.hired;
          bVal = b.hired;
          break;
        case 'retention':
          aVal = a.hired > 0 ? (a.retained / a.hired) * 100 : 0;
          bVal = b.hired > 0 ? (b.retained / b.hired) * 100 : 0;
          break;
        case 'refund':
          aVal = a.refundAmount;
          bVal = b.refundAmount;
          break;
        default:
          return 0;
      }

      return adManagementFilters.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }

  return filteredData;
};

// 広告管理テーブルを描画
const renderAdManagementTable = () => {
  const filteredData = getFilteredAdManagementData();
  const tableBody = document.getElementById('adManagementTableBody');

  if (!tableBody) return;

  // ページネーション計算
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / adManagementFilters.pageSize);
  const startIndex = (adManagementFilters.currentPage - 1) * adManagementFilters.pageSize;
  const endIndex = Math.min(startIndex + adManagementFilters.pageSize, totalItems);
  const pageData = filteredData.slice(startIndex, endIndex);

  // テーブル描画
  if (pageData.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-slate-500 py-6">
          該当するデータがありません
        </td>
      </tr>
    `;
  } else {
    tableBody.innerHTML = pageData.map(item => {
      const retentionRate = item.hired > 0 ? Math.round((item.retained / item.hired) * 100) : 0;

      return `
        <tr class="hover:bg-slate-50">
          <td class="fixed-col font-medium">${item.mediaName}</td>
          <td class="text-right">${item.applications.toLocaleString()}</td>
          <td class="text-right">${item.interviews.toLocaleString()}</td>
          <td class="text-right">${item.offers.toLocaleString()}</td>
          <td class="text-right">${item.hired.toLocaleString()}</td>
          <td class="text-right">${retentionRate}%</td>
          <td class="text-right">¥${item.refundAmount.toLocaleString()}</td>
          <td class="text-right">${item.validApplications.toLocaleString()}</td>
        </tr>
      `;
    }).join('');
  }

  // ページ情報更新
  updateAdManagementPageInfo(totalItems, startIndex + 1, endIndex, totalPages);

  // ページネーションボタン状態更新
  updateAdManagementPaginationButtons(totalPages);
};

// ページ情報を更新
const updateAdManagementPageInfo = (total, start, end, totalPages) => {
  const infoElements = ['adManagementInfo'];
  const pageElements = ['adManagementPageInfo', 'adManagementPageInfo2'];

  infoElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = `${total}件中 ${start}-${end}件表示`;
    }
  });

  pageElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = `${adManagementFilters.currentPage} / ${totalPages}`;
    }
  });
};

// ページネーションボタン状態を更新
const updateAdManagementPaginationButtons = (totalPages) => {
  const prevButtons = ['adManagementPrevBtn', 'adManagementPrevBtn2'];
  const nextButtons = ['adManagementNextBtn', 'adManagementNextBtn2'];

  prevButtons.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.disabled = adManagementFilters.currentPage <= 1;
    }
  });

  nextButtons.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.disabled = adManagementFilters.currentPage >= totalPages;
    }
  });
};

// ソート表示を更新
const updateAdManagementSortIndicators = () => {
  document.querySelectorAll('[data-page="ad-performance"] .sort-indicator').forEach(indicator => {
    indicator.textContent = '↕';
  });

  if (adManagementFilters.sortBy) {
    const activeHeader = document.querySelector(`[data-page="ad-performance"] [data-sort="${adManagementFilters.sortBy}"] .sort-indicator`);
    if (activeHeader) {
      activeHeader.textContent = adManagementFilters.sortOrder === 'desc' ? '↓' : '↑';
    }
  }
};

// 広告管理イベントリスナーを設定
const setupAdManagementEventListeners = () => {
  // 媒体名フィルタ
  const mediaFilter = document.getElementById('adMediaFilter');
  if (mediaFilter) {
    mediaFilter.addEventListener('input', (e) => {
      adManagementFilters.mediaName = e.target.value;
      adManagementFilters.currentPage = 1;
      renderAdManagementTable();
      saveAdManagementFiltersToUrl();
    });

    // 初期値設定
    mediaFilter.value = adManagementFilters.mediaName;
  }

  // ソートヘッダー
  document.querySelectorAll('[data-page="ad-performance"] .sortable').forEach(header => {
    header.addEventListener('click', () => {
      const sortBy = header.dataset.sort;

      if (adManagementFilters.sortBy === sortBy) {
        adManagementFilters.sortOrder = adManagementFilters.sortOrder === 'desc' ? 'asc' : 'desc';
      } else {
        adManagementFilters.sortBy = sortBy;
        adManagementFilters.sortOrder = 'desc';
      }

      adManagementFilters.currentPage = 1;
      renderAdManagementTable();
      updateAdManagementSortIndicators();
      saveAdManagementFiltersToUrl();
    });
  });

  // ページネーションボタン
  const setupPaginationButton = (id, action) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => {
        if (action === 'prev' && adManagementFilters.currentPage > 1) {
          adManagementFilters.currentPage--;
        } else if (action === 'next') {
          adManagementFilters.currentPage++;
        }
        renderAdManagementTable();
        saveAdManagementFiltersToUrl();
      });
    }
  };

  setupPaginationButton('adManagementPrevBtn', 'prev');
  setupPaginationButton('adManagementPrevBtn2', 'prev');
  setupPaginationButton('adManagementNextBtn', 'next');
  setupPaginationButton('adManagementNextBtn2', 'next');
};

// 広告管理の初期化
const initializeAdManagement = () => {
  console.log('Initializing ad management...');

  loadAdManagementFiltersFromUrl();
  setupAdManagementEventListeners();
  renderAdManagementTable();
  updateAdManagementSortIndicators();

  console.log('Ad management initialization complete');
};

// DOMContentLoaded後に実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
  initializeDashboard();
}
