const sections = document.querySelectorAll(".page-section");
const navLinks = document.querySelectorAll(".nav-link");
const title = document.getElementById("pageTitle");
const subtitle = document.getElementById("pageSubtitle");

const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
if (sidebar && sidebarToggle) {
  const updateSidebarToggleLabel = () => {
    sidebarToggle.textContent = sidebar.classList.contains("sidebar-collapsed")
      ? "⪢"
      : "⪡";
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
  "ad-spend": {
    title: "広告費管理",
    subtitle:
      "媒体×CA/CSの成果を日/週/月単位で把握し、滞留や次アクションを管理",
  },
  introduction: {
    title: "各企業の紹介実績管理",
    subtitle: "クライアント／案件別のステージ進捗と候補者タイムラインを整理",
  },
  "tele-ops": {
    title: "テレアポ実績管理",
    subtitle:
      "入社後フォロー・返金・辞退理由を表形式でトラッキングし、TATを分析",
  },
  "ad-performance": {
    title: "広告管理",
    subtitle: "媒体・求人別の主要指標と突合状況をモニタリングし、CSV取込を実行",
  },
  "tele-log": {
    title: "テレアポ管理",
    subtitle: "架電ログと指標カードを一元管理し、CSV取込や手入力で更新",
  },
};

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    const target = link.dataset.target;

    sections.forEach((section) => {
      if (section.dataset.page === target) {
        section.classList.remove("hidden");
      } else {
        section.classList.add("hidden");
      }
    });

    navLinks.forEach((btn) => {
      btn.classList.remove("bg-slate-800", "text-white");
    });
    link.classList.add("bg-slate-800", "text-white");

    if (pageMeta[target]) {
      title.textContent = pageMeta[target].title;
      subtitle.textContent = pageMeta[target].subtitle;
    }
  });
});

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

  const currentJob = adState.filters.job;
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

  const currentDepartment = adState.filters.department;
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
};

const readAdFiltersFromInputs = () => {
  const fromDate = parseDateValue(adFilterFromInput.value);
  const toDateRaw = parseDateValue(adFilterToInput.value);
  adState.filters = {
    from: fromDate,
    to: toDateRaw ? normalizeEndDate(toDateRaw) : null,
    media: adFilterMediaSelect.value || "all",
    job: adFilterJobSelect.value || "all",
    department: adFilterDepartmentSelect.value || "all",
    granularity: adFilterGranularitySelect.value || "monthly",
  };

  if (adState.filters.job !== "all") {
    adState.selectedJobDetail = adState.filters.job;
    jobDetailSelect.value = adState.filters.job;
  } else if (jobDetailSelect.value !== "auto") {
    jobDetailSelect.value = "auto";
    adState.selectedJobDetail = "auto";
  }
};

const resetAdFilters = () => {
  adFilterFromInput.value = "";
  adFilterToInput.value = "";
  adFilterMediaSelect.value = "all";
  adFilterJobSelect.value = "all";
  adFilterDepartmentSelect.value = "all";
  adFilterGranularitySelect.value = "monthly";
  adState.filters = {
    from: null,
    to: null,
    media: "all",
    job: "all",
    department: "all",
    granularity: "monthly",
  };
  adState.selectedJobDetail = "auto";
  jobDetailSelect.value = "auto";
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

  kpiTotalCostEl.textContent = formatSelectedCurrency(totalCostBase);
  kpiTotalApplicationsEl.textContent = formatNumber(totalApplications);
  kpiCostApplyEl.textContent = formatCostPer(totalCostBase, totalApplications);
  kpiCostHireEl.textContent = formatCostPer(totalCostBase, totalHires);
  kpiTotalCostNoteEl.textContent = `データ件数: ${records.length}`;
  kpiTotalApplicationsNoteEl.textContent =
    totalApplications === 0 ? "応募実績なし" : "媒体経由応募";
};

const renderMediaSummary = (summary) => {
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
          <line x1="${padding.left}" y1="${padding.top + plotHeight}" x2="${
    padding.left + plotWidth
  }" y2="${padding.top + plotHeight}" />
          <line x1="${padding.left}" y1="${padding.top}" x2="${
    padding.left
  }" y2="${padding.top + plotHeight}" />
          <line x1="${padding.left + plotWidth}" y1="${padding.top}" x2="${
    padding.left + plotWidth
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
            <td class="${
              highlight ? "text-amber-600 font-semibold" : "text-slate-500"
            }">
              ${highlight || "—"}
            </td>
          `;
    jobDetailTableBody.appendChild(tr);
  });
};

const updateJobDetailSelectOptions = (jobIds) => {
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
const candidateRows = Array.from(document.querySelectorAll(".candidate-row"));
const filterCandidateName = document.getElementById("filterCandidateName");
const filterCompany = document.getElementById("filterCompany");
const filterOwner = document.getElementById("filterOwner");
const filterInitialFrom = document.getElementById("filterInitialFrom");
const filterInitialTo = document.getElementById("filterInitialTo");
const phaseCheckboxes = Array.from(document.querySelectorAll(".phase-filter"));
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

    row.style.display = visible ? "" : "none";
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
