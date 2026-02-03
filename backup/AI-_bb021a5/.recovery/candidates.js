// teleapo と同じAPI Gatewayの base
const CANDIDATES_API_BASE = "/api";
const SETTINGS_API_BASE = "/api";
const SCREENING_RULES_ENDPOINT = `${SETTINGS_API_BASE}/settings/screening-rules`;

// 一覧は「/candidates」（末尾スラッシュなし）
const CANDIDATES_LIST_PATH = "/candidates";

// 詳細は「/candidates/{candidateId}」（末尾スラッシュなし）
const candidateDetailPath = (id) => `/candidates/${encodeURIComponent(String(id))}`;

const candidatesApi = (path) => `${CANDIDATES_API_BASE}${path}`;

// =========================
// URLパラメータ（teleapo → candidates の遷移）
// =========================
function getCandidateUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const candidateIdFromUrl = params.get("candidateId");
  const shouldAutoOpenDetail = ["1", "true", "yes"].includes(
    String(params.get("openDetail") || "").toLowerCase()
  );
  return { candidateIdFromUrl, shouldAutoOpenDetail };
}

// =========================
// フィルタ定義
// =========================
const filterConfig = [
  { id: "candidatesFilterStartDate", event: "change" },
  { id: "candidatesFilterEndDate", event: "change" },
  { id: "candidatesFilterSource", event: "change" },
  { id: "candidatesFilterName", event: "input" },
  { id: "candidatesFilterCompany", event: "change" },
  { id: "candidatesFilterAdvisor", event: "change" },
  { id: "candidatesFilterValid", event: "change" },
  { id: "candidatesFilterPhase", event: "change" },
];

const reportStatusOptions = ["LINE報告済み", "個人シート反映済み", "請求書送付済み"];
const finalResultOptions = ["----", "リリース(転居不可)", "リリース(精神疾患)", "リリース(人柄)", "飛び", "辞退", "承諾"];
const refundReportOptions = ["LINE報告済み", "企業報告済み"];

const modalHandlers = { closeButton: null, overlay: null, keydown: null };

const detailSectionKeys = [
  "nextAction",
  "selection",
  "profile",
  "assignees",
  "hearing",
  "cs",
  "teleapoLogs",
  "money",
  "documents",
];

const employmentStatusOptions = ["未回答", "就業中", "離職中"];
const PHASE_ORDER = [
  "未接触",
  "通電",
  "架電中",
  "SMS送信",
  "面談設定",
  "実施",
  "内定",
  "成約",
  "失注"
];
const CALENDAR_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

let currentSortKey = "nextAction";
let currentSortOrder = "asc";
let candidateDetailCurrentTab = "main";

const japaneseLevelOptions = [
  { value: "", label: "未設定" },
  "N1",
  "N2",
  "N3以下",
];

const detailEditState = detailSectionKeys.reduce((state, key) => {
  state[key] = false;
  return state;
}, {});

const detailContentHandlers = { click: null, input: null };

// =========================
// 状態
// =========================
let allCandidates = [];
let filteredCandidates = [];
let selectedCandidateId = null; // 常に String で扱う
let candidatesEditMode = false;
let currentDetailCandidateId = null;
let lastSyncedAt = null;
let pendingInlineUpdates = {};
let openedFromUrlOnce = false;
let masterClients = [];
let masterUsers = [];
let screeningRules = null;
let screeningRulesLoaded = false;
let screeningRulesLoading = false;
let detailAutoSaveTimer = null;
const nextActionCache = new Map();
const contactPreferredTimeCache = new Map();
const validApplicationDetailCache = new Map();
const validApplicationPrefetchCache = new Set();
let calendarViewDate = new Date();
calendarViewDate.setDate(1);
let candidateCloseWarningTimer = null;

function normalizeContactPreferredTime(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (["-", "ー", "未設定", "未入力", "未登録", "未指定"].includes(text)) return "";
  return text;
}

// =========================
// 正規化
// =========================
function normalizeCandidate(candidate, { source = "detail" } = {}) {
  if (!candidate) return candidate;

  // --- 既存のプロパティマッピング ---
  // ★追加: 媒体情報のマッピング
  candidate.source = candidate.source ?? candidate.applyRouteText ?? "";
  candidate.createdAt = candidate.createdAt ?? candidate.created_at ?? null;
  candidate.registeredAt = candidate.createdAt ?? candidate.registeredAt ?? candidate.registered_at ?? null;
  candidate.candidateName = candidate.candidateName ?? candidate.candidate_name ?? candidate.name ?? "";
  candidate.validApplication =
    candidate.validApplication ??
    candidate.valid_application ??
    candidate.is_effective_application ??
    candidate.active_flag ??
    candidate.valid ??
    null;
  candidate.candidateKana = candidate.candidateKana ?? candidate.name_kana ?? "";
  candidate.birthday = candidate.birthday ?? candidate.birth_date ?? candidate.birthDate ?? null;
  candidate.age = candidate.age ?? candidate.ageText ?? candidate.age_value ?? null;
  if (candidate.birthday) {
    const computedAge = calculateAge(candidate.birthday);
    if (computedAge !== null) {
      candidate.age = computedAge;
      candidate.ageText = computedAge;
      candidate.age_value = computedAge;
    }
  }
  candidate.gender = candidate.gender ?? "";
  candidate.nationality = candidate.nationality ?? candidate.nationality_text ?? candidate.nationality_code ?? "";
  candidate.japaneseLevel = candidate.japaneseLevel ?? candidate.japanese_level ?? candidate.jlpt_level ?? candidate.jlptLevel ?? "";
  candidate.education = candidate.education ?? candidate.final_education ?? "";
  candidate.employmentStatus = candidate.employmentStatus ?? candidate.employment_status ?? "";
  candidate.currentIncome = candidate.currentIncome ?? candidate.current_income ?? "";
  candidate.desiredIncome = candidate.desiredIncome ?? candidate.desired_income ?? "";
  candidate.firstInterviewNote =
    candidate.firstInterviewNote ??
    candidate.first_interview_note ??
    candidate.hearingMemo ??
    candidate.hearing?.memo ??
    candidate.memo ??
    "";
  candidate.careerMotivation = candidate.careerMotivation ?? candidate.career_motivation ?? "";
  candidate.careerReason = candidate.careerReason ?? candidate.career_reason ?? "";
  candidate.transferTiming = candidate.transferTiming ?? candidate.transfer_timing ?? "";
  candidate.otherProcessStatus = candidate.otherProcessStatus ?? candidate.desired_location ?? candidate.other_process_status ?? "";
  candidate.desiredLocation = candidate.desiredLocation ?? candidate.desired_location ?? candidate.otherProcessStatus ?? "";
  candidate.firstInterviewDate = candidate.firstInterviewDate ?? candidate.first_interview_date ?? null;
  candidate.interviewPreferredDate = candidate.interviewPreferredDate ?? candidate.interview_preferred_date ?? "";
  candidate.skills = candidate.skills ?? candidate.skills_text ?? "";
  candidate.personality = candidate.personality ?? candidate.personality_text ?? "";
  candidate.workExperience = candidate.workExperience ?? candidate.work_experience ?? candidate.work_experience_text ?? "";
  candidate.postalCode = candidate.postalCode ?? candidate.postal_code ?? "";
  candidate.addressPref = candidate.addressPref ?? candidate.address_pref ?? "";
  candidate.addressCity = candidate.addressCity ?? candidate.address_city ?? "";
  candidate.addressDetail = candidate.addressDetail ?? candidate.address_detail ?? "";
  candidate.address = candidate.address ?? [candidate.addressPref, candidate.addressCity, candidate.addressDetail]
    .filter(Boolean)
    .join("");
  candidate.contactPreferredTime = normalizeContactPreferredTime(
    candidate.contactPreferredTime ??
    candidate.contact_preferred_time ??
    candidate.contactTime ??
    candidate.contact_time
  );
  candidate.contactTime = candidate.contactPreferredTime;
  candidate.mandatoryInterviewItems = candidate.mandatoryInterviewItems ?? candidate.mandatory_interview_items ?? "";
  candidate.applyCompanyName = candidate.applyCompanyName ?? candidate.apply_company_name ?? "";
  candidate.companyName = candidate.companyName
    ?? candidate.company_name
    ?? candidate.clientName
    ?? candidate.client_name
    ?? candidate.company
    ?? candidate.applyCompany
    ?? "";
  candidate.applyJobName = candidate.applyJobName ?? candidate.apply_job_name ?? candidate.jobName ?? candidate.job_name ?? "";
  candidate.applyRouteText = candidate.applyRouteText ?? candidate.apply_route_text ?? candidate.source ?? "";
  candidate.jobName = candidate.jobName ?? candidate.job_name ?? candidate.applyJobName ?? "";
  candidate.applicationNote = candidate.applicationNote ?? candidate.application_note ?? candidate.remarks ?? "";
  candidate.remarks = candidate.remarks ?? candidate.applicationNote ?? candidate.application_note ?? "";
  candidate.desiredJobType = candidate.desiredJobType ?? candidate.desired_job_type ?? "";
  candidate.otherSelectionStatus = candidate.otherSelectionStatus ?? candidate.other_selection_status ?? "";
  candidate.attendanceConfirmed = candidate.attendanceConfirmed ?? candidate.first_interview_attended ?? null;
  candidate.advisorUserId = candidate.advisorUserId ?? candidate.advisor_user_id ?? null;
  candidate.partnerUserId = candidate.partnerUserId ?? candidate.partner_user_id ?? null;

  // サーバー側で advisorName = partner_name, csName = cs_name とマッピングされている
  candidate.advisorName = candidate.advisorName ?? candidate.partner_name ?? "";
  candidate.csName = candidate.csName ?? candidate.cs_name ?? "";
  candidate.partnerName = candidate.partnerName ?? candidate.partner_name ?? "";

  // リスト表示時のスワップロジックは、サーバー側で正しいマッピングを行っているため削除
  // advisorNameは server.js で partner_name カラムからマッピングされている
  /*
  if (source === "list") {
    const listAdvisorName = candidate.advisorName;
    const listPartnerName = candidate.partnerName;
    const listAdvisorUserId = candidate.advisorUserId;
    const listPartnerUserId = candidate.partnerUserId;

    candidate.advisorName = listPartnerName;
    candidate.partnerName = listAdvisorName;
    candidate.advisorUserId = listPartnerUserId;
    candidate.partnerUserId = listAdvisorUserId;
  }
  */

  candidate.meetingPlans = Array.isArray(candidate.meetingPlans) ? candidate.meetingPlans : [];
  candidate.resumeDocuments = Array.isArray(candidate.resumeDocuments) ? candidate.resumeDocuments : [];

  candidate.selectionProgress = Array.isArray(candidate.selectionProgress) ? candidate.selectionProgress : [];
  candidate.selectionProgress = candidate.selectionProgress.map((row = {}) => ({
    ...row,
    id: row.id ?? row.applicationId ?? row.application_id ?? null,
    clientId: row.clientId ?? row.client_id ?? null,
    companyName: row.companyName ?? row.company_name ?? "",
    route: row.route ?? row.applyRoute ?? row.apply_route ?? row.mediaName ?? row.media_name ?? "",
    proposalDate: row.proposalDate ?? row.proposal_date ?? null,
    recommendationDate: row.recommendationDate ?? row.recommended_at ?? null,
    firstInterviewDate: row.firstInterviewDate ?? row.first_interview_at ?? row.interviewDate ?? row.firstInterviewAt ?? null,
    secondInterviewDate: row.secondInterviewDate ?? row.second_interview_at ?? row.secondInterviewAt ?? null,
    finalInterviewDate: row.finalInterviewDate ?? row.final_interview_at ?? row.finalInterviewAt ?? null,
    offerDate: row.offerDate ?? row.offer_date ?? row.offerAt ?? null,
    acceptanceDate: row.acceptanceDate ?? row.offer_accept_date ?? row.offerAcceptedDate ?? row.offerAcceptedAt ?? null,
    onboardingDate: row.onboardingDate ?? row.join_date ?? row.joinDate ?? row.joinedAt ?? null,
    preJoinDeclineDate: row.preJoinDeclineDate ?? row.pre_join_withdraw_date ?? null,
    preJoinDeclineReason: row.preJoinDeclineReason ?? row.pre_join_withdraw_reason ?? "",
    postJoinQuitDate: row.postJoinQuitDate ?? row.post_join_quit_date ?? null,
    postJoinQuitReason: row.postJoinQuitReason ?? row.post_join_quit_reason ?? "",
    closeExpectedDate: row.closeExpectedDate ?? row.close_expected_at ?? row.closingForecastDate ?? row.closingForecastAt ?? null,
    feeAmount: row.feeAmount ?? row.fee_amount ?? "",
    selectionNote: row.selectionNote ?? row.selection_note ?? row.note ?? "",
    status: row.status ?? row.stage_current ?? "",
  }));

  if (!candidate.companyName && candidate.selectionProgress.length) {
    candidate.companyName = candidate.selectionProgress[0]?.companyName ?? "";
  }
  if (!candidate.applyCompanyName && candidate.companyName) {
    candidate.applyCompanyName = candidate.companyName;
  }
  if (!candidate.companyName && candidate.applyCompanyName) {
    candidate.companyName = candidate.applyCompanyName;
  }

  candidate.teleapoLogs = Array.isArray(candidate.teleapoLogs) ? candidate.teleapoLogs : [];

  candidate.moneyInfo = Array.isArray(candidate.moneyInfo) ? candidate.moneyInfo : [];
  candidate.moneyInfo = candidate.moneyInfo.map((row = {}) => ({
    ...row,
    applicationId: row.applicationId ?? row.application_id ?? null,
    clientId: row.clientId ?? row.client_id ?? null,
    companyName: row.companyName ?? row.company_name ?? "",
    feeAmount: row.feeAmount ?? row.fee_amount ?? "",
    refundAmount: row.refundAmount ?? row.refund_amount ?? "",
    orderDate: row.orderDate ?? row.order_date ?? null,
    withdrawDate: row.withdrawDate ?? row.withdraw_date ?? null,
    joinDate: row.joinDate ?? row.join_date ?? null,
    preJoinWithdrawDate: row.preJoinWithdrawDate ?? row.pre_join_withdraw_date ?? null,
    postJoinQuitDate: row.postJoinQuitDate ?? row.post_join_quit_date ?? null,
    orderReported: row.orderReported ?? row.order_reported ?? null,
    refundReported: row.refundReported ?? row.refund_reported ?? null,
  }));

  candidate.hearing = candidate.hearing || {};
  candidate.afterAcceptance = candidate.afterAcceptance || {};
  candidate.refundInfo = candidate.refundInfo || {};
  candidate.actionInfo = candidate.actionInfo || {};
  const explicitNextActionDate =
    candidate.nextActionDate ??
    candidate.next_action_date ??
    null;
  const explicitNextActionNote =
    candidate.nextActionNote ??
    candidate.next_action_note ??
    null;
  const legacyNextActionDate =
    candidate.nextActionDateLegacy ??
    candidate.newActionDate ??
    candidate.actionInfo?.nextActionDate ??
    candidate.actionInfo?.next_action_date ??
    null;
  const legacyNextActionNote =
    candidate.actionInfo?.nextActionNote ??
    candidate.actionInfo?.next_action_note ??
    candidate.newActionNote ??
    null;
  const nextActionFromDetail =
    candidate.detail?.actionInfo?.nextActionDate ??
    candidate.detail?.actionInfo?.next_action_date ??
    candidate.detail?.newActionDate ??
    candidate.detail?.new_action_date ??
    null;
<<<<<<< HEAD
  const nextActionNoteFromDetail =
    candidate.detail?.actionInfo?.nextActionNote ??
    candidate.detail?.actionInfo?.next_action_note ??
    candidate.detail?.nextActionNote ??
    candidate.detail?.next_action_note ??
=======
  candidate.nextActionNote =
    candidate.nextActionNote ??
    candidate.actionInfo?.nextActionNote ??
    candidate.detail?.actionInfo?.nextActionNote ??
    "";
  candidate.nextActionDate =
    candidate.nextActionDate ??
    candidate.next_action_date ??
    candidate.nextActionDateLegacy ??
    candidate.newActionDate ??
    candidate.actionInfo?.nextActionDate ??
    candidate.actionInfo?.next_action_date ??
    nextActionFromDetail ??
>>>>>>> udea
    null;

  let resolvedNextActionDate = explicitNextActionDate ?? null;
  let resolvedNextActionNote = explicitNextActionNote ?? null;
  let nextActionSource = explicitNextActionDate ? "explicit" : "";

  if (!resolvedNextActionDate && source !== "list") {
    resolvedNextActionDate = legacyNextActionDate ?? null;
    if (!nextActionSource && legacyNextActionDate) nextActionSource = "legacy";
    if (!resolvedNextActionNote && legacyNextActionNote) {
      resolvedNextActionNote = legacyNextActionNote;
    }
  }

  if (!resolvedNextActionDate) {
    resolvedNextActionDate = nextActionFromDetail ?? null;
    if (!nextActionSource && nextActionFromDetail) nextActionSource = "detail";
  }
  if (!resolvedNextActionNote && nextActionNoteFromDetail) {
    resolvedNextActionNote = nextActionNoteFromDetail;
  }

  candidate.nextActionDate = resolvedNextActionDate || null;
  candidate.nextActionNote = resolvedNextActionNote || "";
  candidate.nextActionSource = nextActionSource || "none";
  const nextActionCacheKey = candidate.id != null ? String(candidate.id) : "";
  if (nextActionCacheKey) {
    if (candidate.nextActionDate) {
      nextActionCache.set(nextActionCacheKey, candidate.nextActionDate);
    } else if (nextActionCache.has(nextActionCacheKey)) {
      const cached = nextActionCache.get(nextActionCacheKey);
      if (cached) candidate.nextActionDate = cached;
    }
  }
  if (candidate.nextActionDate && !candidate.actionInfo.nextActionDate) {
    candidate.actionInfo.nextActionDate = candidate.nextActionDate;
  }
  const contactTimeCacheKey = candidate.id != null ? String(candidate.id) : "";
  if (contactTimeCacheKey) {
    if (candidate.contactPreferredTime) {
      contactPreferredTimeCache.set(contactTimeCacheKey, candidate.contactPreferredTime);
    } else if (contactPreferredTimeCache.has(contactTimeCacheKey)) {
      const cached = contactPreferredTimeCache.get(contactTimeCacheKey);
      if (cached) {
        candidate.contactPreferredTime = cached;
        candidate.contactTime = cached;
      }
    }
  }
  candidate.csChecklist = candidate.csChecklist || {};

  // --- ★ここから追加したロジック（returnの前に行うこと！） ---

  // API (isConnected, smsSentFlag, callCount) -> UI (phoneConnected, smsSent, callCount)
  candidate.phoneConnected = candidate.phoneConnected ?? candidate.isConnected ?? false;
  candidate.smsSent = candidate.smsSent ?? candidate.smsSentFlag ?? false;
  candidate.callCount = candidate.callCount ?? 0;

  // フェーズ自動判定ロジック(resolvePhaseDisplay)が参照する csSummary を補完
  candidate.csSummary = candidate.csSummary || {};
  candidate.csSummary.hasConnected = candidate.csSummary.hasConnected ?? candidate.phoneConnected;
  candidate.csSummary.hasSms = candidate.csSummary.hasSms ?? candidate.smsSent;
  candidate.csSummary.callCount = candidate.csSummary.callCount ?? candidate.callCount;

  // --- ★ここまで ---

  return candidate;
}

function updateMastersFromDetail(detail) {
  const masters = detail?.masters;
  if (!masters) return;
  if (Array.isArray(masters.clients)) masterClients = masters.clients;
  if (Array.isArray(masters.users)) masterUsers = masters.users;
}

function resolveUserName(userId) {
  if (!userId) return "";
  const found = (masterUsers || []).find((user) => String(user.id) === String(userId));
  return found?.name ?? "";
}

function resolveClientName(clientId) {
  if (!clientId) return "";
  const found = (masterClients || []).find((client) => String(client.id) === String(clientId));
  return found?.name ?? "";
}

function buildSelectOptions(list, selectedValue, { blankLabel = "選択" } = {}) {
  const base = Array.isArray(list) ? list : [];
  const options = [{ value: "", label: blankLabel }].concat(
    base.map((item) => ({
      value: item.id ?? item.value ?? "",
      label: item.name ?? item.label ?? "",
    }))
  );
  return options.map((option) => ({
    value: option.value,
    label: option.label,
    selected: String(option.value) === String(selectedValue ?? ""),
  }));
}

function buildClientOptions(selectedId, selectedName) {
  if (Array.isArray(masterClients) && masterClients.length > 0) {
    return buildSelectOptions(masterClients, selectedId, { blankLabel: "企業を選択" });
  }
  const fallback = selectedId ? [{ id: selectedId, name: selectedName || "-" }] : [];
  return buildSelectOptions(fallback, selectedId, { blankLabel: "企業を選択" });
}

function buildUserOptions(selectedId) {
  return buildSelectOptions(masterUsers || [], selectedId, { blankLabel: "担当者を選択" });
}

function buildBooleanOptions(value, { trueLabel = "報告済み", falseLabel = "未報告", blankLabel = "-" } = {}) {
  const options = [
    { value: "", label: blankLabel },
    { value: "true", label: trueLabel },
    { value: "false", label: falseLabel },
  ];
  return options.map((option) => ({
    ...option,
    selected: String(option.value) === String(value ?? ""),
  }));
}

// =========================
// マウント / アンマウント
// =========================
export function mount() {
  initializeCandidatesFilters();
  initializeSortControl();
  initializeTableInteraction();
  initializeCandidatesTabs();
  initializeDetailModal();
  initializeDetailContentListeners();

  openedFromUrlOnce = false;
  loadScreeningRulesForCandidates({ force: true });
  // まず一覧ロード
  loadCandidatesData();
}

export function unmount() {
  cleanupCandidatesEventListeners();
}

// =========================
// 初期化
// =========================
function initializeCandidatesFilters() {
  filterConfig.forEach(({ id, event }) => {
    const element = document.getElementById(id);
    if (element) element.addEventListener(event, handleFilterChange);
  });

  const resetButton = document.getElementById("candidatesFilterReset");
  if (resetButton) resetButton.addEventListener("click", handleFilterReset);

  // フェーズフィルターの初期化（固定値）
  setFilterSelectOptions("candidatesFilterPhase", PHASE_ORDER);
}

function initializeSortControl() {
  const sortSelect = document.getElementById("candidatesSortOrder");
  if (sortSelect) sortSelect.addEventListener("change", (e) => {
    // Dropdown change updates global order only if key matches or just resets
    currentSortOrder = e.target.value;
    currentSortKey = "registeredAt"; // Dropdown implies registered date
    handleFilterChange();
    updateHeaderSortStyles();
  });
}

function initializeTableInteraction() {
  const tableBody = document.getElementById("candidatesTableBody");
  if (tableBody) {
    tableBody.addEventListener("click", handleTableClick);
    tableBody.addEventListener("input", handleInlineEdit);
    tableBody.addEventListener("change", handleInlineEdit);
  }

  const tableHead = document.querySelector(".candidates-table-card thead");
  if (tableHead) {
    tableHead.addEventListener("click", (e) => {
      const th = e.target.closest("th[data-sort-key]");
      if (th) {
        handleHeaderSort(th.dataset.sortKey);
      }
    });
  }

  const toggleButton = document.getElementById("candidatesToggleEdit");
  if (toggleButton) toggleButton.addEventListener("click", toggleCandidatesEditMode);

  ensureNextActionColumnPriority();
}

function initializeCandidatesTabs() {
  const tabButtons = document.querySelectorAll("[data-candidates-tab]");
  tabButtons.forEach((button) => {
    button.addEventListener("click", handleCandidatesTabClick);
  });

  const calendarNavButtons = document.querySelectorAll("[data-calendar-nav]");
  calendarNavButtons.forEach((button) => {
    button.addEventListener("click", handleCalendarNavClick);
  });

  const calendarBody = document.getElementById("candidatesCalendarBody");
  if (calendarBody) {
    calendarBody.addEventListener("click", handleCalendarEventClick);
  }

  setCandidatesActiveTab("calendar");
}

// =========================
// 一覧取得（RDS連携）
// =========================
async function loadCandidatesData(filtersOverride = {}) {
  const filters = { ...collectFilters(), ...filtersOverride };
  const queryString = buildCandidatesQuery(filters);

  try {
    const url = queryString
      ? candidatesApi(`${CANDIDATES_LIST_PATH}?${queryString}`)   // /candidates/?...
      : candidatesApi(`${CANDIDATES_LIST_PATH}`);                // /candidates/

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();

    allCandidates = Array.isArray(result.items)
      ? result.items.map((item) => normalizeCandidate({ ...item, id: String(item.id) }, { source: "list" }))
      : [];

    if (screeningRules) {
      allCandidates.forEach((candidate) => {
        candidate.validApplicationComputed = computeValidApplication(candidate, screeningRules);
      });
      prefetchValidApplicationDetails(allCandidates);
    }
    updateFilterSelectOptions(allCandidates);
    filteredCandidates = applyLocalFilters(allCandidates, filters);
    // Apply current global sort state
    filteredCandidates = sortCandidates(filteredCandidates, currentSortKey, currentSortOrder);
    pendingInlineUpdates = {};

    renderCandidatesTable(filteredCandidates);
    updateHeaderSortStyles(); // Ensure headers reflect state
    updateCandidatesCount(filteredCandidates.length);
    prefetchNextActionDates(allCandidates);

    lastSyncedAt = result.lastSyncedAt || null;
    updateLastSyncedDisplay(lastSyncedAt);

    refreshSelectionState();

    const { candidateIdFromUrl, shouldAutoOpenDetail } = getCandidateUrlParams();
    // ★ teleapo → candidates で ?candidateId= が来ている場合の自動詳細は明示時のみ
    if (!openedFromUrlOnce && candidateIdFromUrl && shouldAutoOpenDetail) {
      openedFromUrlOnce = true;
      try {
        await openCandidateById(candidateIdFromUrl);
      } catch (e) {
        console.error("open by url failed:", e);
      }
    }
  } catch (error) {
    console.error("候補者データの取得に失敗しました。", error);
    allCandidates = [];
    filteredCandidates = [];
    renderCandidatesTable([]);
    updateCandidatesCount(0);
    updateLastSyncedDisplay(null);
  }
}

async function prefetchNextActionDates(candidates) {
  const targets = (candidates || []).filter((candidate) => {
    const id = String(candidate?.id ?? "");
    if (!id) return false;
    if (candidate.nextActionDate) return false;
    if (nextActionCache.has(id)) return false;
    return true;
  });
  if (targets.length === 0) return;

  const queue = targets.slice();
  const updates = [];
  const concurrency = Math.min(4, queue.length);

  const worker = async () => {
    while (queue.length) {
      const candidate = queue.shift();
      if (!candidate) return;
      const id = String(candidate.id);
      if (nextActionCache.has(id)) continue;
      try {
        const detail = await fetchCandidateDetailById(id, { includeMaster: false });
        if (!detail) continue;
        nextActionCache.set(id, detail.nextActionDate ?? null);
        if (detail.nextActionDate) updates.push(detail);
      } catch (error) {
        console.error("次回アクション日の事前取得に失敗しました。", error);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));

  if (updates.length > 0) {
    batchApplyCandidateUpdates(updates, { preserveDetailState: true, renderDetail: false });
  }
}

function handleFilterChange() {
  loadCandidatesData();
}

function collectFilters() {
  return {
    startDate: getElementValue("candidatesFilterStartDate"),
    endDate: getElementValue("candidatesFilterEndDate"),
    source: getElementValue("candidatesFilterSource"),
    name: getElementValue("candidatesFilterName"),
    company: getElementValue("candidatesFilterCompany"),
    advisor: getElementValue("candidatesFilterAdvisor"),
    valid: getElementValue("candidatesFilterValid"),
    phase: getElementValue("candidatesFilterPhase"),
    sortOrder: getElementValue("candidatesSortOrder") || "desc",
  };
}

function resolveCandidateDateValue(candidate) {
  return (
    candidate.registeredAt ??
    candidate.createdAt ??
    candidate.registeredDate ??
    candidate.created_date ??
    candidate.created_at ??
    null
  );
}

function parseCandidateDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const match = String(value).match(/(\d{4})\s*[\/-]\s*(\d{1,2})\s*[\/-]\s*(\d{1,2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveCandidateIdKey(candidate) {
  if (!candidate) return "";
  const raw = candidate.id ?? candidate.candidateId ?? candidate.candidate_id ?? candidate.candidateID;
  const text = String(raw ?? "").trim();
  return text ? text : "";
}

function applyValidApplicationDetailCache(candidate, { force = false } = {}) {
  if (!screeningRules || !candidate) return null;
  if (!hasValidApplicationInputs(candidate, screeningRules)) return null;
  const id = resolveCandidateIdKey(candidate);
  if (!id) return null;
  if (!force && validApplicationDetailCache.has(id)) {
    const cached = validApplicationDetailCache.get(id);
    candidate.validApplicationComputed = cached;
    return cached;
  }
  const computed = computeValidApplication(candidate, screeningRules);
  if (computed === true || computed === false) {
    validApplicationDetailCache.set(id, computed);
    candidate.validApplicationComputed = computed;
    return computed;
  }
  return null;
}

function resolveValidApplication(candidate) {
  // 詳細モーダルなどで再取得したオブジェクトでも判定ロジックを適用するため、
  // ルールがあれば計算を行う
  if (screeningRules && hasValidApplicationInputs(candidate, screeningRules)) {
    const computed = computeValidApplication(candidate, screeningRules);
    if (computed === true || computed === false) {
      const id = resolveCandidateIdKey(candidate);
      if (id) {
        validApplicationDetailCache.set(id, computed);
        candidate.validApplicationComputed = computed;
      }
      return computed;
    }
  }
  const id = resolveCandidateIdKey(candidate);
  if (id && validApplicationDetailCache.has(id)) {
    return validApplicationDetailCache.get(id);
  }
  const computed = candidate?.validApplicationComputed;
  if (computed === true || computed === false) return computed;
  const raw =
    candidate.validApplication ??
    candidate.valid_application ??
    candidate.is_effective_application ??
    candidate.active_flag ??
    candidate.valid;
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (["true", "1", "yes", "有効", "有効応募"].includes(normalized)) return true;
    if (["false", "0", "no", "無効", "無効応募"].includes(normalized)) return false;
  }
  if (raw === null || raw === undefined || raw === "") return null;
  return Boolean(raw);
}

function normalizeScreeningRulesPayload(payload) {
  const source = payload?.rules || payload?.item || payload?.data || payload || {};
  const minAge = parseRuleNumber(source.minAge ?? source.min_age);
  const maxAge = parseRuleNumber(source.maxAge ?? source.max_age);
  const nationalitiesRaw =
    source.targetNationalities ??
    source.target_nationalities ??
    source.allowedNationalities ??
    source.allowed_nationalities ??
    source.nationalities ??
    "";
  const allowedJlptRaw =
    source.allowedJlptLevels ??
    source.allowed_jlpt_levels ??
    source.allowed_japanese_levels ??
    [];
  return {
    minAge,
    maxAge,
    targetNationalities: normalizeCommaText(nationalitiesRaw),
    targetNationalitiesList: parseListValue(nationalitiesRaw),
    allowedJlptLevels: parseListValue(allowedJlptRaw),
  };
}

function parseRuleNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseListValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (value === null || value === undefined) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCommaText(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join(", ");
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

function isUnlimitedMinAge(value) {
  if (value === null || value === undefined || value === "") return true;
  return Number(value) <= 0;
}

function isUnlimitedMaxAge(value) {
  if (value === null || value === undefined || value === "") return true;
  return Number(value) >= 100;
}

function resolveCandidateAgeValue(candidate) {
  const computed = calculateAge(candidate.birthday);
  if (computed !== null) return computed;
  const direct = candidate.age ?? candidate.ageText ?? candidate.age_value;
  if (direct !== null && direct !== undefined && direct !== "") {
    const parsed = Number(direct);
    if (Number.isFinite(parsed)) return parsed;
    const match = String(direct).match(/\d+/);
    if (match) {
      const fromText = Number(match[0]);
      if (Number.isFinite(fromText)) return fromText;
    }
  }
  return null;
}

function normalizeNationality(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const normalized = text.toLowerCase();
  if (normalized === "japan" || normalized === "jpn" || normalized === "jp" || normalized === "japanese") {
    return "日本";
  }
  if (text === "日本国" || text === "日本国籍" || text === "日本人" || text === "日本国民") return "日本";
  return text;
}

function isJapaneseNationality(value) {
  return normalizeNationality(value) === "日本";
}

function hasValidApplicationInputs(candidate, rules) {
  if (!candidate || !rules) return false;
  const age = resolveCandidateAgeValue(candidate);
  if (age === null) return false;
  const nationality = normalizeNationality(candidate.nationality);
  if (!nationality) return false;
  if (isJapaneseNationality(nationality)) return true;
  const jlpt = String(candidate.japaneseLevel || "").trim();
  return Boolean(jlpt);
}

function computeValidApplication(candidate, rules) {
  if (!candidate || !rules) return null;
  const age = resolveCandidateAgeValue(candidate);
  if (age === null) return false;
  if (!isUnlimitedMinAge(rules.minAge) && rules.minAge !== null && age < rules.minAge) return false;
  if (!isUnlimitedMaxAge(rules.maxAge) && rules.maxAge !== null && age > rules.maxAge) return false;

  const nationality = normalizeNationality(candidate.nationality);
  const allowedNationalities = (rules.targetNationalitiesList || [])
    .map((value) => normalizeNationality(value))
    .filter((value) => value && !isJapaneseNationality(value));

  if (isJapaneseNationality(nationality)) return true;

  if (allowedNationalities.length > 0) {
    if (!nationality) return false;
    const matched = allowedNationalities.some((value) => value === nationality);
    if (!matched) return false;
  }

  const jlpt = String(candidate.japaneseLevel || "").trim();
  if (!jlpt) return false;
  const allowedJlptLevels = rules.allowedJlptLevels || [];
  if (!allowedJlptLevels.length) return false;
  return allowedJlptLevels.includes(jlpt);
}

function needsValidApplicationDetail(candidate, rules) {
  if (!candidate || !rules) return false;
  const age = resolveCandidateAgeValue(candidate);
  if (age === null) return true;
  const nationality = normalizeNationality(candidate.nationality);
  if (!nationality) return true;
  if (isJapaneseNationality(nationality)) return false;
  const jlpt = String(candidate.japaneseLevel || "").trim();
  return !jlpt;
}

async function prefetchValidApplicationDetails(candidates) {
  if (!screeningRules || !Array.isArray(candidates) || candidates.length === 0) return;
  const targets = candidates.filter((candidate) => {
    const id = resolveCandidateIdKey(candidate);
    if (!id) return false;
    if (validApplicationDetailCache.has(id)) return false;
    if (validApplicationPrefetchCache.has(id)) return false;
    return true;
  });
  if (!targets.length) return;

  const queue = targets.slice();
  const updates = [];
  const concurrency = Math.min(4, queue.length);

  const worker = async () => {
    while (queue.length) {
      const candidate = queue.shift();
      if (!candidate) return;
      const id = resolveCandidateIdKey(candidate);
      if (!id) continue;
      validApplicationPrefetchCache.add(id);
      try {
        const detail = await fetchCandidateDetailById(id, { includeMaster: false });
        if (!detail) continue;
        applyValidApplicationDetailCache(detail, { force: true });
        updates.push(detail);
      } catch (error) {
        console.error("有効応募判定の補完取得に失敗しました。", error);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));

  if (updates.length > 0) {
    batchApplyCandidateUpdates(updates, { preserveDetailState: true, renderDetail: true });
  }
}

function applyScreeningRulesToCandidates() {
  if (!screeningRules || !allCandidates.length) return;
  validApplicationPrefetchCache.clear();
  validApplicationDetailCache.clear();
  allCandidates.forEach((candidate) => {
    if (hasValidApplicationInputs(candidate, screeningRules)) {
      candidate.validApplicationComputed = computeValidApplication(candidate, screeningRules);
    } else {
      candidate.validApplicationComputed = null;
    }
  });
  const filters = collectFilters();
  filteredCandidates = applyLocalFilters(allCandidates, filters);
  filteredCandidates = sortCandidates(filteredCandidates, currentSortKey, currentSortOrder);
  renderCandidatesTable(filteredCandidates);
  updateHeaderSortStyles();
  updateCandidatesCount(filteredCandidates.length);
  const selected = getSelectedCandidate();
  if (selected && isCandidateModalOpen()) {
    renderCandidateDetail(selected, { preserveEditState: true });
  }
  prefetchValidApplicationDetails(allCandidates);
}

async function loadScreeningRulesForCandidates({ force = false } = {}) {
  if (screeningRulesLoading) return;
  if (!force && screeningRulesLoaded) return;
  screeningRulesLoading = true;
  try {
    const response = await fetch(SCREENING_RULES_ENDPOINT);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    screeningRules = normalizeScreeningRulesPayload(data);
  } catch (error) {
    console.error("有効応募判定ルールの取得に失敗しました。", error);
    screeningRules = null;
  } finally {
    screeningRulesLoading = false;
    screeningRulesLoaded = Boolean(screeningRules);
    applyScreeningRulesToCandidates();
  }
}

function resolvePhaseValues(candidate) {
  const raw = candidate?.phases ?? candidate?.phaseList ?? candidate?.phase ?? "";
  if (Array.isArray(raw)) return raw.map((value) => String(value).trim()).filter(Boolean);
  const text = String(raw || "");
  const split = text.split(/[,/、|]/).map((value) => value.trim()).filter(Boolean);
  return split.length ? split : [resolvePhaseDisplay(candidate)];
}

function applyLocalFilters(list, filters) {
  const baseList = applyCandidatesFilters(list, filters);
  const year = normalizeFilterText(filters.year);
  const month = normalizeFilterText(filters.month);
  const day = normalizeFilterText(filters.day);

  if (!year && !month && !day) return baseList;

  return baseList.filter((candidate) => {
    const registeredDate = parseCandidateDate(resolveCandidateDateValue(candidate));
    if (!registeredDate) return false;
    const yearValue = String(registeredDate.getFullYear());
    const monthValue = String(registeredDate.getMonth() + 1).padStart(2, "0");
    const dayValue = String(registeredDate.getDate()).padStart(2, "0");
    if (year && yearValue !== year) return false;
    if (month && monthValue !== month) return false;
    if (day && dayValue !== day) return false;
    return true;
  });
}

function sortCandidates(list, key, order) {
  const direction = order === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    let aVal, bVal;

    switch (key) {
      case "registeredAt":
        const aDate = parseCandidateDate(resolveCandidateDateValue(a));
        const bDate = parseCandidateDate(resolveCandidateDateValue(b));
        aVal = aDate ? aDate.getTime() : 0;
        bVal = bDate ? bDate.getTime() : 0;
        break;
      case "nextAction":
        const aNext = pickNextAction(a);
        const bNext = pickNextAction(b);
        const MAX_TS = 8640000000000000;
        if (order === "asc") {
          aVal = aNext ? aNext.date.getTime() : MAX_TS;
          bVal = bNext ? bNext.date.getTime() : MAX_TS;
        } else {
          aVal = aNext ? aNext.date.getTime() : 0;
          bVal = bNext ? bNext.date.getTime() : 0;
        }
        break;
      case "validApplication":
        aVal = resolveValidApplication(a) === true ? 1 : 0;
        bVal = resolveValidApplication(b) === true ? 1 : 0;
        break;
      case "candidateName":
      case "advisorName":
      case "partnerName":
      case "source":
      case "phase":
        aVal = String(a[key] || "");
        bVal = String(b[key] || "");
        break;
      default:
        aVal = a[key] || "";
        bVal = b[key] || "";
    }

    if (aVal === bVal) return 0;
    if (typeof aVal === "string" && typeof bVal === "string") {
      return direction * aVal.localeCompare(bVal, "ja");
    }
    return direction * (aVal - bVal);
  });
}

function handleHeaderSort(key) {
  if (currentSortKey === key) {
    currentSortOrder = currentSortOrder === "asc" ? "desc" : "asc";
  } else {
    currentSortKey = key;
    currentSortOrder = "desc";
  }

  // Update filteredCandidates directly and re-render
  filteredCandidates = sortCandidates(filteredCandidates, currentSortKey, currentSortOrder);
  renderCandidatesTable(filteredCandidates);
  updateHeaderSortStyles();
}

function updateHeaderSortStyles() {
  const headers = document.querySelectorAll(".candidates-table-card thead th[data-sort-key]");
  headers.forEach(th => {
    th.classList.remove("is-sorted", "bg-slate-100", "text-slate-900");
    th.removeAttribute("data-sort-dir");

    // Clean up text content if it has text arrows
    let label = th.textContent.replace(/[▲▼]/g, "").trim();
    th.textContent = label;

    const key = th.dataset.sortKey;
    if (key === currentSortKey) {
      th.classList.add("is-sorted");
      th.setAttribute("data-sort-dir", currentSortOrder);
    }
  });
}

function buildCandidatesQuery(filters) {
  const p = new URLSearchParams();
  if (filters.source) p.set("source", filters.source);
  if (filters.phase && filters.phase !== "未接触") p.set("phase", filters.phase);
  if (filters.advisor) p.set("advisor", filters.advisor);
  if (filters.name) p.set("name", filters.name);
  if (filters.company) p.set("company", filters.company);
  if (filters.valid) p.set("valid", filters.valid);
  p.set("sort", filters.sortOrder || "desc");
  p.set("limit", "200");
  return p.toString();
}

function hasActiveFilters(filters) {
  return Boolean(
    filters.startDate
    || filters.endDate
    || filters.source
    || filters.phase
    || filters.advisor
    || filters.name
    || filters.company
    || filters.valid
  );
}

function normalizeFilterText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function includesFilterText(value, query) {
  const normalizedQuery = normalizeFilterText(query);
  if (!normalizedQuery) return true;
  return normalizeFilterText(value).includes(normalizedQuery);
}

function matchesSelectValue(value, selectedValue) {
  if (!selectedValue) return true;
  return normalizeFilterText(value) === normalizeFilterText(selectedValue);
}

function getCandidateCompanyName(candidate) {
  return (
    candidate?.applyCompanyName
    || candidate?.companyName
    || candidate?.clientName
    || candidate?.client_name
    || candidate?.company
    || candidate?.selectionProgress?.[0]?.companyName
    || ""
  );
}

function getCandidateAdvisorName(candidate) {
  return candidate?.advisorName || resolveUserName(candidate?.advisorUserId) || "";
}

function getCandidateSourceName(candidate) {
  return candidate?.applyRouteText || candidate?.applyRoute || candidate?.source || candidate?.mediaName || "";
}

function getCandidateRegisteredDate(candidate) {
  const value = candidate?.createdAt || candidate?.registeredAt || candidate?.registeredDate || null;
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseFilterDate(value, { isEnd } = {}) {
  if (!value) return null;
  const suffix = isEnd ? "T23:59:59.999" : "T00:00:00";
  const date = new Date(`${value}${suffix}`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getCandidatePhaseList(candidate) {
  const list = resolvePhaseValues(candidate);
  const unique = Array.from(new Set(list.map((value) => String(value).trim()).filter(Boolean)));
  if (unique.length > 0) return unique;
  return [resolvePhaseDisplay(candidate)];
}

function applyCandidatesFilters(list, filters) {
  const startDate = parseFilterDate(filters.startDate, { isEnd: false });
  const endDate = parseFilterDate(filters.endDate, { isEnd: true });
  const validTarget = String(filters.valid || "");

  return list.filter((candidate) => {
    if (filters.name && !includesFilterText(candidate.candidateName, filters.name)) return false;
    if (filters.company && !matchesSelectValue(getCandidateCompanyName(candidate), filters.company)) return false;
    if (filters.advisor && !matchesSelectValue(getCandidateAdvisorName(candidate), filters.advisor)) return false;
    if (filters.source && !matchesSelectValue(getCandidateSourceName(candidate), filters.source)) return false;

    if (validTarget) {
      const resolved = resolveValidApplication(candidate);
      const isValid = resolved === true;
      if (validTarget === "true" && !isValid) return false;
      if (validTarget === "false" && isValid) return false;
    }

    if (filters.phase) {
      const phases = getCandidatePhaseList(candidate);
      if (!phases.some((phase) => String(phase) === String(filters.phase))) return false;
    }

    if (startDate || endDate) {
      const date = getCandidateRegisteredDate(candidate);
      if (!date) return false;
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
    }

    return true;
  });
}

function buildUniqueValues(values) {
  const map = new Map();
  values.forEach((value) => {
    const label = String(value ?? "").trim();
    if (!label) return;
    const key = normalizeFilterText(label);
    if (!map.has(key)) map.set(key, label);
  });
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "ja"));
}

function setFilterSelectOptions(selectId, values, { blankLabel = "すべて" } = {}) {
  const element = document.getElementById(selectId);
  if (!element) return;
  const currentValue = element.value;
  const options = [`<option value="">${blankLabel}</option>`]
    .concat(values.map((value) => `<option value="${escapeHtmlAttr(value)}">${escapeHtml(value)}</option>`))
    .join("");
  element.innerHTML = options;
  if (currentValue && values.includes(currentValue)) {
    element.value = currentValue;
  } else {
    element.value = "";
  }
}

function updateFilterSelectOptions(list) {
  const sources = [];
  const companies = [];
  const advisors = [];
  const phases = [];

  list.forEach((candidate) => {
    const source = getCandidateSourceName(candidate);
    const company = getCandidateCompanyName(candidate);
    const advisor = getCandidateAdvisorName(candidate);
    const phaseList = getCandidatePhaseList(candidate);

    if (source) sources.push(source);
    if (company) companies.push(company);
    if (advisor) advisors.push(advisor);
    if (Array.isArray(phaseList)) phases.push(...phaseList);
  });

  setFilterSelectOptions("candidatesFilterSource", buildUniqueValues(sources));
  setFilterSelectOptions("candidatesFilterCompany", buildUniqueValues(companies));
  setFilterSelectOptions("candidatesFilterAdvisor", buildUniqueValues(advisors));
}

function getElementValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function handleCandidatesTabClick(event) {
  const tabKey = event.currentTarget?.dataset?.candidatesTab;
  if (!tabKey) return;

  setCandidatesActiveTab(tabKey);
}

function setCandidatesActiveTab(tabKey) {
  document.querySelectorAll("[data-candidates-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.candidatesTab === tabKey);
  });

  document.querySelectorAll("[data-candidates-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.candidatesPanel === tabKey);
  });

  if (tabKey === "calendar") {
    renderNextActionCalendar(filteredCandidates);
  }
}

function handleCalendarNavClick(event) {
  const action = event.currentTarget?.dataset?.calendarNav;
  if (!action) return;

  const base = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), 1);
  if (action === "prev") {
    base.setMonth(base.getMonth() - 1);
  } else if (action === "next") {
    base.setMonth(base.getMonth() + 1);
  } else if (action === "today") {
    const today = new Date();
    base.setFullYear(today.getFullYear(), today.getMonth(), 1);
  }

  calendarViewDate = new Date(base.getFullYear(), base.getMonth(), 1);
  renderNextActionCalendar(filteredCandidates);
}

function handleCalendarEventClick(event) {
  const card = event.target.closest("[data-candidate-id]");
  if (!card) return;
  const id = card.dataset.candidateId;
  if (id) openCandidateById(id);
}

function toDateKey(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const date = parseDateValue(value);
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildNextActionMap(list) {
  const map = new Map();
  (list || []).forEach((candidate) => {
    const key = toDateKey(candidate?.nextActionDate);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({
      id: candidate.id,
      name: candidate.candidateName || "-",
      advisorName: candidate.advisorName || "-",
      partnerName: candidate.partnerName || "-",
      note: candidate.nextActionNote || "",
    });
  });

  map.forEach((items) => {
    items.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  });
  return map;
}

function renderNextActionCalendar(list) {
  const container = document.getElementById("candidatesCalendarBody");
  if (!container) return;

  const viewYear = calendarViewDate.getFullYear();
  const viewMonth = calendarViewDate.getMonth();
  const title = document.getElementById("candidatesCalendarTitle");
  if (title) title.textContent = `${viewYear}年${viewMonth + 1}月`;

  const eventsMap = buildNextActionMap(list);
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(viewYear, viewMonth, 1 - startOffset);
  const todayKey = toDateKey(new Date());

  const cells = [];
  CALENDAR_WEEKDAYS.forEach((label) => {
    cells.push(`<div class="candidates-calendar-weekday">${label}</div>`);
  });

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const key = toDateKey(date);
    const isOutside = date.getMonth() !== viewMonth;
    const isToday = key && key === todayKey;
    const dayNumber = date.getDate();
    const events = key ? (eventsMap.get(key) || []) : [];
    const visibleEvents = events.slice(0, 3);
    const overflow = events.length - visibleEvents.length;
    const eventsHtml = visibleEvents
      .map(
        (item) => `
          <button type="button" class="calendar-event" data-candidate-id="${escapeHtmlAttr(String(item.id))}">
            <span class="calendar-event-name">${escapeHtml(item.name)}</span>
            ${item.note ? `<div class="text-[10px] text-slate-500 truncate" title="${escapeHtml(item.note)}">${escapeHtml(item.note)}</div>` : ""}
            <span class="calendar-event-meta">CS: ${escapeHtml(item.partnerName)} / PT: ${escapeHtml(item.advisorName)}</span>
          </button>
        `
      )
      .join("");
    const overflowHtml =
      overflow > 0
        ? `<div class="calendar-event calendar-event--more">+${overflow}件</div>`
        : "";

    cells.push(`
      <div class="candidates-calendar-day${isOutside ? " is-outside" : ""}${isToday ? " is-today" : ""}">
        <div class="candidates-calendar-day-number">${dayNumber}</div>
        ${eventsHtml}
        ${overflowHtml}
      </div>
    `);
  }

  container.innerHTML = `<div class="candidates-calendar-grid">${cells.join("")}</div>`;
}

// =========================
// テーブル描画
// =========================
function renderCandidatesTable(list) {
  const tableBody = document.getElementById("candidatesTableBody");
  if (!tableBody) return;

  if (list.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-slate-500 py-6">条件に一致する候補者が見つかりません。</td>
      </tr>
    `;
    renderNextActionCalendar(list);
    return;
  }

  tableBody.innerHTML = list.map((candidate) => buildTableRow(candidate)).join("");
  highlightSelectedRow();
  renderNextActionCalendar(list);
}

function buildTableRow(candidate) {
  return `
    <tr class="candidate-item" data-id="${escapeHtmlAttr(String(candidate.id))}">
      ${renderTextCell(candidate, "registeredAt", {
    format: (value, row) => formatDateTimeJP(row.createdAt || value || row.registeredDate),
    readOnly: true,
  })}
      ${renderTextCell(candidate, "phase", {
    allowHTML: true,
    format: (_, row) => renderPhasePills(row),
    readOnly: true,
  })}
      
      ${renderTextCell(candidate, "source", { readOnly: true })}

      ${renderCheckboxCell(candidate, "validApplication", "有効応募")}
      ${renderTextCell(candidate, "candidateName", { strong: true, readOnly: true })}
      ${renderTextCell(candidate, "csName", { readOnly: true })}
      ${renderTextCell(candidate, "advisorName", { readOnly: true })}
      ${renderNextActionCell(candidate)}
    </tr>
  `;
}

function renderNextActionCell(candidate) {
  const nextAction = pickNextAction(candidate);
  if (!nextAction) {
    return '<td class="candidate-next-action-cell"><span class="candidate-next-action-empty">未設定</span></td>';
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const actionDate = new Date(nextAction.date.getFullYear(), nextAction.date.getMonth(), nextAction.date.getDate());
  const isExpired = actionDate < today;

  return `
    <td class="candidate-next-action-cell">
      <div class="candidate-next-action-stack">
        <span class="candidate-next-action-date ${isExpired ? "text-red-600 font-bold" : ""}">${isExpired ? "⚠️ " : ""}${escapeHtml(formatDateJP(nextAction.date))}</span>
        ${nextAction.note
      ? `<span class="candidate-next-action-label text-slate-600 font-medium" title="${escapeHtml(nextAction.note)}">${escapeHtml(nextAction.note)}</span>`
      : `<span class="candidate-next-action-label">${escapeHtml(nextAction.label)}</span>`
    }
      </div>
    </td>
  `;
}

function ensureNextActionColumnPriority() {
  const table = document.querySelector(".candidates-table-card table");
  if (!table) return;
  if (table.dataset.nextActionPriority === "true") return;

  const headRow = table.querySelector("thead tr");
  if (!headRow) return;

  const headers = Array.from(headRow.querySelectorAll("th"));
  const nextIndex = headers.findIndex((th) => th.dataset.sortKey === "nextAction");
  if (nextIndex === -1) return;

  const nextHeader = headers[nextIndex];
  nextHeader.classList.add("next-action-head");
  headRow.appendChild(nextHeader);

  const colgroup = table.querySelector("colgroup");
  if (colgroup) {
    const cols = Array.from(colgroup.querySelectorAll("col"));
    if (cols[nextIndex]) colgroup.appendChild(cols[nextIndex]);
  }

  table.dataset.nextActionPriority = "true";
}

function renderCheckboxCell(candidate, field, label) {
  const checked = field === "validApplication"
    ? resolveValidApplication(candidate) === true
    : Boolean(candidate[field]);
  if (!candidatesEditMode) {
    const badgeLabel = checked
      ? label
      : label.includes("有効")
        ? label.replace("有効", "無効")
        : `未${label}`;
    return `<td class="text-center">${renderStatusPill(badgeLabel, checked ? "success" : "muted")}</td>`;
  }
  const editable = candidatesEditMode ? "" : "disabled";
  const dataAttr = candidatesEditMode ? `data-field="${field}"` : "";
  return `
    <td>
      <label class="table-checkbox">
        <input type="checkbox" ${checked ? "checked" : ""} ${editable} ${dataAttr}>
        <span class="sr-only">${label}</span>
      </label>
    </td>
  `;
}

function renderTextCell(candidate, field, options = {}) {
  const raw = candidate[field] ?? "";
  if (!candidatesEditMode || options.readOnly) {
    const formatted = options.format ? options.format(raw, candidate) : formatDisplayValue(raw);
    const content = options.allowHTML ? formatted : escapeHtml(formatted);
    const wrapperStart = options.strong ? '<span class="font-semibold text-slate-900">' : "";
    const wrapperEnd = options.strong ? "</span>" : "";
    return `<td>${wrapperStart}${content}${wrapperEnd}</td>`;
  }

  if (options.input === "textarea") {
    return `<td><textarea class="table-inline-textarea" data-field="${field}">${escapeHtml(raw)}</textarea></td>`;
  }

  const type = options.type || "text";
  return `<td><input type="${type}" class="table-inline-input" data-field="${field}" value="${escapeHtmlAttr(raw)}"></td>`;
}

// =========================
// 編集モード（一覧インライン）
// =========================
async function toggleCandidatesEditMode() {
  const nextState = !candidatesEditMode;
  candidatesEditMode = nextState;

  const button = document.getElementById("candidatesToggleEdit");
  if (button) {
    button.textContent = candidatesEditMode ? "編集完了" : "編集";
    button.classList.toggle("is-active", candidatesEditMode);
  }

  renderCandidatesTable(filteredCandidates);

  if (!nextState) {
    await persistInlineEdits();
  }
}

function handleInlineEdit(event) {
  if (!candidatesEditMode) return;

  const control = event.target.closest("[data-field]");
  if (!control) return;

  const row = control.closest("tr[data-id]");
  if (!row) return;

  const candidate = allCandidates.find((item) => String(item.id) === String(row.dataset.id));
  if (!candidate) return;

  const field = control.dataset.field;
  candidate[field] = control.type === "checkbox" ? control.checked : control.value;

  if (field === "validApplication") {
    candidate.validApplicationComputed = candidate.validApplication;
  }

  markCandidateDirty(candidate.id);

  if (field === "birthday") candidate.age = calculateAge(candidate.birthday);
}

function markCandidateDirty(id) {
  if (!id) return;
  pendingInlineUpdates[String(id)] = true;
}

async function persistInlineEdits() {
  const dirtyIds = Object.keys(pendingInlineUpdates);
  if (dirtyIds.length === 0) return;

  const failures = {};
  for (const id of dirtyIds) {
    const candidate = allCandidates.find((item) => String(item.id) === String(id));
    if (!candidate) continue;
    try {
      await saveCandidateRecord(candidate);
      delete pendingInlineUpdates[id];
    } catch (e) {
      console.error("候補者の保存に失敗しました。", e);
      failures[id] = true;
    }
  }

  if (Object.keys(failures).length > 0) {
    pendingInlineUpdates = failures;
    alert("一部の候補者の保存に失敗しました。再度お試しください。");
  } else {
    pendingInlineUpdates = {};
  }
}

// =========================
// 件数 / 最終同期
// =========================
function updateCandidatesCount(count) {
  const element = document.getElementById("candidatesResultCount");
  if (element) element.textContent = `${count}件`;
}

function updateLastSyncedDisplay(ts) {
  const element = document.getElementById("candidatesLastSynced");
  if (!element) return;
  element.textContent = ts ? `最終同期: ${formatDateTimeJP(ts)}` : "最終同期: -";
}

// =========================
// 行クリック：必ず詳細APIを叩く（重要）
// =========================
async function fetchCandidateDetailById(id, { includeMaster = true } = {}) {
  const query = includeMaster ? "?includeMaster=true" : "";
  const url = candidatesApi(`${candidateDetailPath(id)}${query}`); // /candidates/{candidateId}
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Candidate detail HTTP ${res.status}: ${text}`);
  }
  const detail = normalizeCandidate(await res.json());
  if (includeMaster) {
    updateMastersFromDetail(detail);
  }
  if (detail?.masters) delete detail.masters;
  applyValidApplicationDetailCache(detail, { force: true });
  return detail;
}

function setCandidateDetailLoading(message = "読み込み中...") {
  const container = document.getElementById("candidateDetailContent");
  if (!container) return;
  container.innerHTML = `
    <div class="candidate-detail-empty">
      <p class="text-sm text-slate-500">${escapeHtml(message)}</p>
    </div>
  `;
}

function showCandidateCloseWarning(message) {
  const page = document.getElementById("candidatesPage");
  if (!page) return;
  let banner = document.getElementById("candidatesCloseWarning");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "candidatesCloseWarning";
    banner.className =
      "mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800";
    page.prepend(banner);
  }
  banner.textContent = message || "";
  if (candidateCloseWarningTimer) window.clearTimeout(candidateCloseWarningTimer);
  candidateCloseWarningTimer = window.setTimeout(() => {
    banner?.remove();
    candidateCloseWarningTimer = null;
  }, 4000);
}

async function openCandidateById(id) {
  const idStr = String(id);
  selectedCandidateId = idStr;

  setCandidateDetailLoading("候補者詳細を取得しています...");
  openCandidateModal();
  highlightSelectedRow();

  try {
    const detail = await fetchCandidateDetailById(idStr, { includeMaster: true });

    // 一覧にも反映（あれば更新、無ければ詳細モーダルだけでも表示できる）
    applyCandidateUpdate(detail, { preserveDetailState: true });

    // 明示的に描画（applyCandidateUpdate 内でも描画されるが、安全に二重でOK）
    renderCandidateDetail(detail, { preserveEditState: false });
    openCandidateModal();
    highlightSelectedRow();
  } catch (e) {
    console.error("candidate detail fetch error", e);
    const fallback = filteredCandidates.find((c) => String(c.id) === idStr)
      || allCandidates.find((c) => String(c.id) === idStr);
    if (fallback) {
      renderCandidateDetail(fallback, { preserveEditState: false });
      openCandidateModal();
      highlightSelectedRow();
    } else {
      setCandidateDetailLoading("詳細の取得に失敗しました。ネットワーク状態を確認してください。");
      openCandidateModal();
    }
  }
}

async function handleTableClick(event) {
  if (event.target.closest("[data-field]")) return;

  const row = event.target.closest("tr[data-id]");
  if (!row) return;

  const id = row.dataset.id;
  if (!id) return;

  try {
    await openCandidateById(id);
  } catch (e) {
    console.error(e);
    setCandidateDetailLoading("詳細の取得に失敗しました。ネットワーク状態を確認してください。");
    openCandidateModal();
  }
}

// =========================
// フィルタリセット
// =========================
function handleFilterReset() {
  filterConfig.forEach(({ id }) => {
    const element = document.getElementById(id);
    if (element) element.value = "";
  });

  const sortSelect = document.getElementById("candidatesSortOrder");
  if (sortSelect) sortSelect.value = "desc";

  selectedCandidateId = null;
  closeCandidateModal({ clearSelection: false });
  handleFilterChange();
}



// クライアント一覧（オートコンプリート用）
let clientList = [];

// =========================
// 初期化
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([
    fetchCandidates(),
    fetchClients(), // クライアント一覧取得
  ]);

  // URLパラメータのチェック (id指定があれば詳細を開く)
  const urlParams = new URLSearchParams(window.location.search);
  const detailId = urlParams.get("id");
  if (detailId) {
    await openCandidateById(detailId);
  }
});

async function fetchClients() {
  try {
    const res = await fetch("/api/clients");
    if (!res.ok) throw new Error("Failed to fetch clients");
    clientList = await res.json();
  } catch (err) {
    console.error(err);
  }
}

// =========================
// 選択状態の復元
// =========================
function refreshSelectionState() {
  if (!selectedCandidateId) {
    highlightSelectedRow();
    return;
  }

  const candidate = filteredCandidates.find((item) => String(item.id) === String(selectedCandidateId));
  if (!candidate) {
    // 候補者が一覧にいなくても、モーダルを勝手に閉じない（deep link対応）
    highlightSelectedRow();
    return;
  }

  if (isCandidateModalOpen()) {
    renderCandidateDetail(candidate, { preserveEditState: true });
  }
  highlightSelectedRow();
}

function highlightSelectedRow() {
  const rows = document.querySelectorAll("#candidatesTableBody .candidate-item");
  const modalOpen = isCandidateModalOpen();
  rows.forEach((row) => {
    const active = modalOpen && selectedCandidateId && String(row.dataset.id) === String(selectedCandidateId);
    row.classList.toggle("is-active", Boolean(active));
  });
}

// =========================
// 詳細モーダル描画
// =========================
function renderCandidateDetail(candidate, { preserveEditState = false } = {}) {
  const container = document.getElementById("candidateDetailContent");
  if (!container) return;

  if (!candidate) {
    currentDetailCandidateId = null;
    resetDetailEditState();
    container.innerHTML = getCandidateDetailPlaceholder();
    return;
  }

  const contactTimeCacheKey = candidate.id != null ? String(candidate.id) : "";
  let resolvedContactTime = normalizeContactPreferredTime(
    candidate.contactPreferredTime ??
    candidate.contact_preferred_time ??
    candidate.contactTime ??
    candidate.contact_time
  );
  if (!resolvedContactTime && contactTimeCacheKey) {
    const cached = contactPreferredTimeCache.get(contactTimeCacheKey);
    if (cached) resolvedContactTime = cached;
  }
  if (resolvedContactTime !== undefined) {
    candidate.contactPreferredTime = resolvedContactTime;
    candidate.contactTime = resolvedContactTime;
  }
  if (contactTimeCacheKey && resolvedContactTime) {
    contactPreferredTimeCache.set(contactTimeCacheKey, resolvedContactTime);
  }

  if (!preserveEditState && String(candidate.id) !== String(currentDetailCandidateId)) {
    resetDetailEditState();
    candidateDetailCurrentTab = "main"; // 新しい候補者ではメインタブにリセット
  }
  currentDetailCandidateId = String(candidate.id);

  const resolvedValid = resolveValidApplication(candidate);
  const validBadge = renderStatusPill(
    resolvedValid ? "有効応募" : "無効応募",
    resolvedValid ? "success" : "muted"
  );

  const header = `
    <div class="candidate-detail-header bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="candidate-detail-header-left space-y-2">
        <div class="candidate-header-title-row flex flex-wrap items-center gap-3">
          <h3 class="candidate-detail-title text-2xl font-bold text-slate-900">${escapeHtml(candidate.candidateName || "-")}</h3>
          <div class="candidate-header-badges flex flex-wrap items-center gap-2">
            ${renderPhasePills(candidate)}
            ${validBadge}
          </div>
        </div>
        <div class="candidate-header-meta text-xs text-slate-500">
          <span>登録日</span>
          <strong class="text-slate-900">${formatDateTimeJP(candidate.createdAt || candidate.registeredAt || candidate.registeredDate)}</strong>
        </div>
      </div>
      <div class="candidate-detail-header-right flex items-start gap-3">
        <div class="candidate-header-card bg-slate-50 border border-slate-100 shadow-sm rounded-lg px-4 py-3 text-xs">
          <div><span>担当CS</span><strong>${escapeHtml(candidate.csName || "-")}</strong></div>
          <div><span>担当パートナー</span><strong>${escapeHtml(candidate.advisorName || "-")}</strong></div>
        </div>
      </div>
    </div>
  `;

  // タブナビゲーション
  const tabs = [
    { key: "main", label: "🏠 メイン", icon: "" },
    { key: "profile", label: "👤 基本情報", icon: "" },
    { key: "hearing", label: "📝 面談メモ", icon: "" },
    { key: "teleapo", label: "📞 架電結果", icon: "" },
    { key: "money", label: "💰 売上・返金", icon: "" },
    { key: "documents", label: "📄 書類作成", icon: "" },
  ];

  const tabNav = `
    <div class="candidate-detail-tabs flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg mt-4 mb-4">
      ${tabs.map(tab => `
        <button type="button" 
          class="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${candidateDetailCurrentTab === tab.key
      ? 'bg-white text-indigo-700 shadow-sm'
      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}"
          data-detail-tab="${tab.key}">
          ${tab.label}
        </button>
      `).join('')}
    </div>
  `;

  // 面談実施日・着座確認のコンパクト表示（メインタブ用）
  const attendanceValue = candidate.attendanceConfirmed ?? false;
  const meetingConfirmHtml = `
    <div class="bg-white rounded-lg border border-slate-200 p-4 mb-4">
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-2">
          <span class="text-sm text-slate-600">面談実施日:</span>
          <strong class="text-sm text-slate-900">${escapeHtml(formatDateJP(candidate.firstInterviewDate) || "-")}</strong>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-slate-600">着座確認:</span>
          <span class="px-2 py-0.5 text-xs font-medium rounded-full ${attendanceValue ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}">
            ${attendanceValue ? "✓ 確認済" : "未確認"}
          </span>
        </div>
      </div>
    </div>
  `;

  // タブ別コンテンツ
  let tabContent = "";

  switch (candidateDetailCurrentTab) {
    case "main":
      tabContent = `
        ${meetingConfirmHtml}
        ${renderDetailSection("次回アクション", renderNextActionSection(candidate), "nextAction")}
        ${renderDetailSection("選考進捗", renderSelectionProgressSection(candidate), "selection")}
      `;
      break;
    case "profile":
      tabContent = `
        ${renderDetailSection("求職者情報", renderApplicantInfoSection(candidate), "profile")}
        ${renderDetailSection("担当者", renderAssigneeSection(candidate), "assignees")}
      `;
      break;
    case "hearing":
      tabContent = `
        ${renderDetailSection("共有面談", renderHearingSection(candidate), "hearing")}
      `;
      break;
    case "teleapo":
      tabContent = `
        ${renderDetailSection("CS項目", renderCsSection(candidate), "cs")}
        ${renderDetailSection("テレアポログ一覧", renderTeleapoLogsSection(candidate), "teleapoLogs", { editable: false })}
      `;
      break;
    case "money":
      tabContent = `
        ${renderDetailSection("売上・返金", renderMoneySection(candidate), "money")}
      `;
      break;
    case "documents":
      tabContent = `
        ${renderDetailSection("書類作成", renderDocumentsSection(candidate), "documents")}
      `;
      break;
    default:
      tabContent = `
        ${meetingConfirmHtml}
        ${renderDetailSection("次回アクション", renderNextActionSection(candidate), "nextAction")}
        ${renderDetailSection("選考進捗", renderSelectionProgressSection(candidate), "selection")}
      `;
  }

  container.innerHTML = `
    ${header}
    ${tabNav}
    <div class="candidate-detail-sections">
      ${tabContent}
    </div>
  `;

  initializeDetailContentListeners();
}

function getCandidateDetailPlaceholder() {
  return `
    <div class="candidate-detail-empty">
      <p class="text-sm text-slate-500">候補者行をクリックすると詳細が表示されます。</p>
      <p class="text-xs text-slate-400">求職者情報・共有面談・選考進捗・CS項目をまとめて確認できます。</p>
    </div>
    `;
}

function setCandidateDetailPlaceholder() {
  const container = document.getElementById("candidateDetailContent");
  if (container) container.innerHTML = getCandidateDetailPlaceholder();
  currentDetailCandidateId = null;
  resetDetailEditState();
}

function renderDetailSection(title, body, key, options = {}) {
  const editing = detailEditState[key];
  const editable = options.editable !== false;

  // 状態に応じたスタイル定義
  const sectionBase = "candidate-detail-section rounded-xl shadow-sm border transition-all duration-200";
  const sectionColor = editing
    ? "bg-indigo-50/30 border-indigo-400 ring-2 ring-indigo-100"
    : "bg-white border-slate-100";

  const headerBase = "candidate-detail-section-header px-4 py-3 flex items-center justify-between rounded-t-xl transition-colors duration-200";
  const headerColor = editing
    ? "bg-indigo-100/50 border-b border-indigo-200"
    : "bg-slate-50 border-b border-slate-100"; // 元のbg-slate-50を維持

  const actions = editable
    ? `
    <button type="button" class="detail-edit-btn ${editing ? "is-active bg-indigo-600 text-white border-transparent hover:bg-indigo-700 shadow-sm" : ""}" data-section-edit="${key}">
      ${editing ? "完了して保存" : "編集"}
    </button>
    `
    : "";

  const editingBadge = editing
    ? `<span class="ml-2 px-2 py-0.5 text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full border border-indigo-200">編集中</span>`
    : "";

  return `
    <section class="${sectionBase} ${sectionColor}" data-section="${key}">
      <header class="${headerBase} ${headerColor}">
        <div class="flex items-center">
          <h4 class="font-semibold text-slate-800 ${editing ? 'text-indigo-900' : ''}">${title}</h4>
          ${editingBadge}
        </div>
        <div class="detail-section-actions">
          ${actions}
        </div>
      </header>
      <div class="candidate-detail-section-body">
        ${body}
      </div>
    </section>
    `;
}

function renderDetailSubsection(title, body) {
  return `
    <div class="detail-subsection bg-slate-50 rounded-lg p-4">
      <div class="detail-subsection-header">
        <h5>${escapeHtml(title)}</h5>
      </div>
      <div class="detail-subsection-body">
        ${body}
      </div>
    </div>
    `;
}

function renderStatusPill(label, variant = "muted") {
  return `<span class="status-pill status-pill--${variant}">${escapeHtml(label)}</span>`;
}

function renderBooleanPill(value, { trueLabel = "はい", falseLabel = "いいえ" } = {}) {
  if (value === null || value === undefined) return renderStatusPill("-", "muted");
  return value
    ? renderStatusPill(trueLabel, "success")
    : renderStatusPill(falseLabel, "muted");
}

function resolveSelectionStatusVariant(status) {
  const value = String(status || "");
  if (!value) return "muted";
  if (value.includes("辞退") || value.includes("退社") || value.includes("クローズ")) return "muted";
  if (value.includes("内定") || value.includes("入社") || value.includes("承諾")) return "success";
  return "warning";
}

function resolveSelectionStageValue(row = {}) {
  if (row.postJoinQuitDate) return "入社後辞退";
  if (row.preJoinDeclineDate) return "内定後辞退";
  if (row.closeExpectedDate) return "クロージング";
  if (row.onboardingDate) return "入社";
  if (row.acceptanceDate) return "承諾";
  if (row.offerDate) return "内定";
  if (row.finalInterviewDate) return "最終面接";
  if (row.secondInterviewDate) return "二次面接";
  if (row.firstInterviewDate) return "一次面接";
  if (row.recommendationDate) return "推薦";
  if (row.proposalDate) return "提案";
  return "";
}

function updateSelectionStatusCell(index, status) {
  const row = document.querySelector(`[data-selection-row="${index}"]`);
  if (!row) return;
  const cell = row.querySelector("[data-selection-status]");
  if (!cell) return;
  cell.innerHTML = renderStatusPill(status || "-", resolveSelectionStatusVariant(status));
}

// -----------------------
// 必須：保存APIのURLを統一
// -----------------------


// -----------------------
// フェーズ表示ロジック
// -----------------------
function resolveCurrentPhases(candidate) {
  let phases = Array.isArray(candidate.phaseList) ? candidate.phaseList : (candidate.phase ? [candidate.phase] : []);

  // 通電等の接触履歴がある場合は「未接触」を除外する
  const hasContact = candidate.hasConnected || candidate.hasSms || (candidate.callCount > 0);
  if (hasContact) {
    phases = phases.filter(p => p !== "未接触");
  }
  return phases;
}

function resolvePhaseDisplay(candidate) {
  const phases = resolveCurrentPhases(candidate);
  return phases.length > 0 ? phases[0] : "-";
}

function renderPhasePills(candidate) {
  const phases = resolveCurrentPhases(candidate);
  if (phases.length === 0) return "-";
  return `<div class="candidate-phase-list">
    ${phases.map(phase => `<span class="candidate-phase-pill">${escapeHtml(phase)}</span>`).join("")}
  </div>`;
}

async function saveCandidateRecord(candidate, { preserveDetailState = true, includeDetail = false } = {}) {
  if (!candidate || !candidate.id) throw new Error("保存対象の候補者が見つかりません。");

  // ---------------------------------------------------------
  // DOMからの強制同期処理 (全入力フィールド)
  // Inputイベント漏れを防ぐため、保存直前に画面の値を正として取り込む
  // ---------------------------------------------------------
  const detailContainer = document.getElementById("candidateDetailContent");
  if (detailContainer) {
    // 1. 一般フィールド (data-detail-fieldを持つもの)
    const inputs = detailContainer.querySelectorAll("[data-detail-field]");
    inputs.forEach((input) => {
      // 選考進捗テーブル内のフィールドは後続の処理で扱うためスキップ(二重処理防止)
      if (input.closest("[data-selection-row]")) return;

      const path = input.dataset.detailField;
      if (!path) return;

      let value;
      if (input.type === "checkbox") {
        value = input.checked;
      } else {
        value = input.value;
      }

      // 値の型変換 (handleDetailFieldChangeと同等の簡易処理)
      if (input.dataset.valueType === "number") {
        value = value === "" ? "" : Number(value);
      } else if (input.dataset.valueType === "boolean") {
        value = value === "true" || value === true;
      }

      updateCandidateFieldValue(candidate, path, value);

      // 特殊フィールドの同期
      if (path === "nextActionDate") {
        candidate.nextActionDate = value;
        if (!candidate.actionInfo) candidate.actionInfo = {};
        candidate.actionInfo.nextActionDate = value;
      }
      if (path === "nextActionNote") {
        candidate.nextActionNote = value;
      }
    });
  }

  // ---------------------------------------------------------
  // 選考進捗の実DOMからの強制同期 (Card Layout)
  // ---------------------------------------------------------
  // Card Layoutの場合、data-detail-fieldを持つinputは上記の「一般フィールド」処理で
  // 既に candidate.selectionProgress[i].xxxx に同期されています。
  // 古い Table Layout 用の処理 (tr[data-selection-row]) は不要なため削除しました。

  normalizeCandidate(candidate);

  const payload = includeDetail
    ? buildCandidateDetailPayload(candidate)
    : { id: candidate.id, validApplication: resolveValidApplication(candidate) };

  // ★ Lambdaが必須とするフラグ
  if (includeDetail) {
    payload.detailMode = true;
    payload.selection_progress = candidate.selectionProgress;
  }

  // ★ Lambdaが必須とするフラグを確実にセット
  if (includeDetail) {
    payload.detailMode = true;
  }

  if (payload?.masters) delete payload.masters;

  console.log("Saving payload:", payload); // Debug log

  const response = await fetch(candidatesApi(candidateDetailPath(candidate.id)), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} ${response.statusText} - ${text.slice(0, 200)} `);
  }

  const updated = normalizeCandidate(await response.json());
  applyValidApplicationDetailCache(updated, { force: true });
  delete pendingInlineUpdates[String(candidate.id)];
  applyCandidateUpdate(updated, { preserveDetailState });
  return updated;
}

function buildCandidateDetailPayload(candidate) {
  const address =
    candidate.address ||
    [candidate.addressPref, candidate.addressCity, candidate.addressDetail]
      .filter(Boolean)
      .join("");
  const contactTime = candidate.contactPreferredTime || candidate.contactTime || "";
  const companyName = candidate.applyCompanyName || candidate.companyName || "";
  const jobName = candidate.applyJobName || candidate.jobName || "";
  const source = candidate.applyRouteText || candidate.source || "";
  const remarks = candidate.applicationNote || candidate.remarks || "";
  const hearingMemo =
    candidate.firstInterviewNote || candidate.hearing?.memo || candidate.hearingMemo || "";
  const hearing = {
    ...(candidate.hearing || {}),
    memo: hearingMemo,
    mandatoryInterviewItems: candidate.mandatoryInterviewItems,
    desiredLocation: candidate.desiredLocation,
    desiredJobType: candidate.desiredJobType,
    currentIncome: candidate.currentIncome,
    desiredIncome: candidate.desiredIncome,
    employmentStatus: candidate.employmentStatus,
    careerReason: candidate.careerReason,
    careerMotivation: candidate.careerMotivation,
    transferTiming: candidate.transferTiming,
    skills: candidate.skills,
    personality: candidate.personality,
    workExperience: candidate.workExperience,
    otherSelectionStatus: candidate.otherSelectionStatus,
    desiredInterviewDates: candidate.desiredInterviewDates,
    recommendationText: candidate.recommendationText,
    jobChangeAxis: candidate.jobChangeAxis,
    jobChangeTiming: candidate.jobChangeTiming,
    futureVision: candidate.futureVision,
    mandatoryInterviewItems: candidate.mandatoryInterviewItems,
    sharedInterviewDate: candidate.sharedInterviewDate,
  };
  const actionInfo = {
    ...(candidate.actionInfo || {}),
    nextActionDate: candidate.nextActionDate || candidate.actionInfo?.nextActionDate || null,
  };

  const payload = {
    id: candidate.id,
    detailMode: true,
    validApplication: resolveValidApplication(candidate),

    // 基本情報
    candidateName: candidate.candidateName,
    candidateKana: candidate.candidateKana,
    gender: candidate.gender,
    birthDate: candidate.birthday, // Lambda expects birthDate equivalent
    phone: candidate.phone,
    email: candidate.email,
    postalCode: candidate.postalCode,
    addressPref: candidate.addressPref,
    addressCity: candidate.addressCity,
    addressDetail: candidate.addressDetail,
    education: candidate.education, // finalEducation mapped to education

    // 詳細
    nationality: candidate.nationality,
    japaneseLevel: candidate.japaneseLevel,
    contactPreferredTime: candidate.contactPreferredTime || contactTime,
    nextActionDate: candidate.nextActionDate || actionInfo.nextActionDate || null,
    nextActionNote: candidate.nextActionNote || null,
    contactTime,
    firstContactPlannedAt: candidate.firstContactPlannedAt,
    scheduleConfirmedAt: candidate.scheduleConfirmedAt,
    firstInterviewDate: candidate.firstInterviewDate,
    attendanceConfirmed: candidate.attendanceConfirmed,
    desiredLocation: candidate.desiredLocation,
    desiredJobType: candidate.desiredJobType,
    skills: candidate.skills,
    personality: candidate.personality,
    workExperience: candidate.workExperience,
    employmentStatus: candidate.employmentStatus,
    currentIncome: candidate.currentIncome,
    desiredIncome: candidate.desiredIncome,
    careerMotivation: candidate.careerMotivation,
    careerReason: candidate.careerReason,
    transferTiming: candidate.transferTiming,
    otherSelectionStatus: candidate.otherSelectionStatus,
    interviewPreferredDate: candidate.interviewPreferredDate,
    mandatoryInterviewItems: candidate.mandatoryInterviewItems,
    applyCompanyName: candidate.applyCompanyName || companyName,
    applyJobName: candidate.applyJobName || jobName,
    applyRouteText: candidate.applyRouteText || source,
    applicationNote: candidate.applicationNote || remarks,
    firstInterviewNote: candidate.firstInterviewNote || hearingMemo,
    firstInterviewNote: candidate.firstInterviewNote || hearingMemo,
    recommendationText: candidate.recommendationText,
    jobChangeAxis: candidate.jobChangeAxis,
    jobChangeTiming: candidate.jobChangeTiming,
    futureVision: candidate.futureVision,
    otherSelectionStatus: candidate.otherSelectionStatus,
    desiredInterviewDates: candidate.desiredInterviewDates,
    mandatoryInterviewItems: candidate.mandatoryInterviewItems,
    sharedInterviewDate: candidate.sharedInterviewDate,
    advisorUserId: candidate.advisorUserId,
    partnerUserId: candidate.partnerUserId,

    // その他（後方互換性のため残すものもあるが、Lambdaが使うものだけで良い）
    advisorName: candidate.advisorName,
    partnerName: candidate.partnerName,
    companyName,
    jobName,
    source,
    remarks,
    address,
    memoDetail: candidate.memoDetail,
    hearing,
    hearingMemo,
    meetingPlans: candidate.meetingPlans,
    resumeDocuments: candidate.resumeDocuments,
    selectionProgress: candidate.selectionProgress,
    afterAcceptance: candidate.afterAcceptance,
    refundInfo: candidate.refundInfo,
    moneyInfo: candidate.moneyInfo,
    actionInfo,
    csChecklist: candidate.csChecklist,
  };

  payload.advisor_user_id = candidate.advisorUserId;
  payload.partner_user_id = candidate.partnerUserId;
  payload.japanese_level = candidate.japaneseLevel;
  payload.next_action_date = payload.nextActionDate;

  return payload;
}

// -----------------------
// applyCandidateUpdate
// -----------------------
function mergeCandidateUpdate(updated) {
  if (!updated || !updated.id) return null;

  const mergeIntoList = (list) => {
    const index = list.findIndex((item) => String(item.id) === String(updated.id));
    if (index !== -1) {
      Object.assign(list[index], updated);
      return list[index];
    }
    return null;
  };

  return mergeIntoList(allCandidates) || mergeIntoList(filteredCandidates) || updated;
}

function applyCandidateUpdate(updated, { preserveDetailState = true } = {}) {
  const mergedCandidate = mergeCandidateUpdate(updated);
  if (!mergedCandidate) return;

  renderCandidatesTable(filteredCandidates);

  if (selectedCandidateId && String(selectedCandidateId) === String(mergedCandidate.id)) {
    renderCandidateDetail(mergedCandidate, { preserveEditState: preserveDetailState });
  }
  highlightSelectedRow();
}

function batchApplyCandidateUpdates(
  updates,
  { preserveDetailState = true, renderDetail = true } = {}
) {
  if (!Array.isArray(updates) || updates.length === 0) return;
  updates.forEach((updated) => mergeCandidateUpdate(updated));
  renderCandidatesTable(filteredCandidates);
  if (renderDetail && selectedCandidateId) {
    const selected = getSelectedCandidate();
    if (selected) {
      renderCandidateDetail(selected, { preserveEditState: preserveDetailState });
    }
  }
  highlightSelectedRow();
}

// =========================
// イベントハンドラ等
// =========================
function initializeDetailContentListeners() {
  const container = document.getElementById("candidateDetailContent");
  if (!container) return;

  if (detailContentHandlers.click) {
    container.removeEventListener("click", detailContentHandlers.click);
  }
  if (detailContentHandlers.input) {
    container.removeEventListener("input", detailContentHandlers.input);
    container.removeEventListener("change", detailContentHandlers.input);
  }

  detailContentHandlers.click = handleDetailContentClick;
  detailContentHandlers.input = handleDetailFieldChange;

  container.addEventListener("click", detailContentHandlers.click);
  container.addEventListener("input", detailContentHandlers.input);
  container.addEventListener("change", detailContentHandlers.input);

  // console.log('[candidates] Detail listeners attached');
}
function escapeHtmlAttr(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function formatDateJP(dateLike) {
  if (!dateLike) return "-";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return dateLike;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year} /${month}/${day} `;
}
function formatDateTimeJP(dateTimeLike) {
  if (!dateTimeLike) return "-";
  const date = new Date(dateTimeLike);
  if (Number.isNaN(date.getTime())) return dateTimeLike;
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDateJP(dateTimeLike)} ${hours}:${minutes} `;
}
function formatDisplayValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  return value;
}

function formatMoneyToMan(value) {
  if (value === null || value === undefined || value === "") return "-";
  const text = String(value).trim();
  if (!text) return "-";
  const hasMan = text.includes("万");
  const nums = text.match(/-?\d[\d,]*/g);
  if (!nums || !nums.length) return text;

  const toMan = (raw) => {
    const cleaned = String(raw).replace(/,/g, "");
    const num = Number(cleaned);
    if (!Number.isFinite(num)) return null;
    if (hasMan) return Math.round(num);
    if (num >= 10000) return Math.floor(num / 10000);
    return Math.round(num);
  };

  if (nums.length >= 2 && /[~\\-ー]/.test(text)) {
    const min = toMan(nums[0]);
    const max = toMan(nums[1]);
    if (min === null || max === null) return text;
    return `${min} -${max} 万円`;
  }

  const single = toMan(nums[0]);
  if (single === null) return text;
  return `${single} 万円`;
}
function calculateAge(birthday) {
  if (!birthday) return null;
  const birthDate = parseCandidateDate(birthday);
  if (!birthDate || Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

// -----------------------
// モーダル
// -----------------------
function warnOnMissingNextAction(candidate) {
  if (!candidate) return;
  const hasIncompleteTasks = candidate.tasks && candidate.tasks.some((t) => !t.isCompleted);
  const hasNextActionDate = Boolean(candidate.nextActionDate || candidate.actionInfo?.nextActionDate);
  if (!hasIncompleteTasks && !hasNextActionDate) {
    showCandidateCloseWarning(
      "次回アクションが未設定です。選考継続中なら新規アクションを追加し、選考終了なら「選考完了」を押してください。"
    );
  }
}

function requestCandidateModalClose({ clearSelection = true } = {}) {
  warnOnMissingNextAction(getSelectedCandidate());
  closeCandidateModal({ clearSelection, force: true });
}

function initializeDetailModal() {
  const modal = document.getElementById("candidateDetailModal");
  const closeButton = document.getElementById("candidateDetailClose");

  if (modal) {
    modalHandlers.overlay = (event) => {
      if (event.target === modal) requestCandidateModalClose();
    };
    modal.addEventListener("click", modalHandlers.overlay);
  }

  if (closeButton) {
    modalHandlers.closeButton = () => requestCandidateModalClose();
    closeButton.addEventListener("click", modalHandlers.closeButton);
  }

  modalHandlers.keydown = (event) => {
    if (event.key === "Escape" && isCandidateModalOpen()) requestCandidateModalClose();
  };
  document.addEventListener("keydown", modalHandlers.keydown);
}
function openCandidateModal() {
  const modal = document.getElementById("candidateDetailModal");
  if (!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-modal-open");
}
function closeCandidateModal({ clearSelection = true, force = false } = {}) {
  const modal = document.getElementById("candidateDetailModal");
  if (!modal) return;

  // バリデーション（強制クローズでない場合）
  if (!force) {
    const candidate = getSelectedCandidate();
    if (candidate) {
      const hasIncompleteTasks = candidate.tasks && candidate.tasks.some(t => !t.isCompleted);
<<<<<<< HEAD
      const hasNextActionDate = Boolean(candidate.nextActionDate || candidate.actionInfo?.nextActionDate);
      if (!hasIncompleteTasks && !hasNextActionDate) {
        showCandidateCloseWarning(
          "次回アクションが未設定です。選考継続中なら新規アクションを追加し、選考終了なら「選考完了」を押してください。"
        );
=======
      const hasNextActionDate = !!candidate.nextActionDate; // Check direct field

      if (!hasIncompleteTasks && !hasNextActionDate) {
        alert("⚠️ 次回アクションが未設定のため画面を閉じられません。\n\n・選考継続中：新規アクションを追加して保存してください。\n・選考終了：「選考完了」ボタンを押してください。");
        return;
>>>>>>> udea
      }
    }
  }

  const wasOpen = modal.classList.contains("is-open");
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  if (wasOpen) setCandidateDetailPlaceholder();
  document.body.classList.remove("has-modal-open");
  if (clearSelection) selectedCandidateId = null;
  highlightSelectedRow();
}
function isCandidateModalOpen() {
  const modal = document.getElementById("candidateDetailModal");
  return modal ? modal.classList.contains("is-open") : false;
}

function resetDetailEditState() {
  detailSectionKeys.forEach((key) => (detailEditState[key] = false));
}

// -----------------------
// 後片付け
// -----------------------
function cleanupCandidatesEventListeners() {
  closeCandidateModal({ clearSelection: false, force: true });

  filterConfig.forEach(({ id, event }) => {
    const element = document.getElementById(id);
    if (element) element.removeEventListener(event, handleFilterChange);
  });


  const resetButton = document.getElementById("candidatesFilterReset");
  if (resetButton) resetButton.removeEventListener("click", handleFilterReset);

  const sortSelect = document.getElementById("candidatesSortOrder");
  if (sortSelect) sortSelect.removeEventListener("change", handleFilterChange);

  const tableBody = document.getElementById("candidatesTableBody");
  if (tableBody) {
    tableBody.removeEventListener("click", handleTableClick);
    tableBody.removeEventListener("input", handleInlineEdit);
    tableBody.removeEventListener("change", handleInlineEdit);
  }

  const toggleButton = document.getElementById("candidatesToggleEdit");
  if (toggleButton) toggleButton.removeEventListener("click", toggleCandidatesEditMode);

  const tabButtons = document.querySelectorAll("[data-candidates-tab]");
  tabButtons.forEach((button) => {
    button.removeEventListener("click", handleCandidatesTabClick);
  });
  const calendarNavButtons = document.querySelectorAll("[data-calendar-nav]");
  calendarNavButtons.forEach((button) => {
    button.removeEventListener("click", handleCalendarNavClick);
  });
  const calendarBody = document.getElementById("candidatesCalendarBody");
  if (calendarBody) calendarBody.removeEventListener("click", handleCalendarEventClick);

  const modal = document.getElementById("candidateDetailModal");
  const closeButton = document.getElementById("candidateDetailClose");

  if (modal && modalHandlers.overlay) {
    modal.removeEventListener("click", modalHandlers.overlay);
    modalHandlers.overlay = null;
  }
  if (closeButton && modalHandlers.closeButton) {
    closeButton.removeEventListener("click", modalHandlers.closeButton);
    modalHandlers.closeButton = null;
  }
  if (modalHandlers.keydown) {
    document.removeEventListener("keydown", modalHandlers.keydown);
    modalHandlers.keydown = null;
  }

  const detailContent = document.getElementById("candidateDetailContent");
  if (detailContent) {
    if (detailContentHandlers.click) detailContent.removeEventListener("click", detailContentHandlers.click);
    if (detailContentHandlers.input) {
      detailContent.removeEventListener("input", detailContentHandlers.input);
      detailContent.removeEventListener("change", detailContentHandlers.input);
    }
  }
  detailContentHandlers.click = null;
  detailContentHandlers.input = null;
}

// ====== Detail Content Handlers ======

function handleDetailContentClick(event) {
  // タブ切り替え
  const tabBtn = event.target.closest("[data-detail-tab]");
  if (tabBtn) {
    const newTab = tabBtn.dataset.detailTab;
    if (newTab && newTab !== candidateDetailCurrentTab) {
      candidateDetailCurrentTab = newTab;
      const candidate = getSelectedCandidate();
      if (candidate) renderCandidateDetail(candidate, { preserveEditState: true });
    }
    return;
  }

  const editBtn = event.target.closest("[data-section-edit]");
  if (editBtn) {
    toggleDetailSectionEdit(editBtn.dataset.sectionEdit);
    return;
  }

  const addBtn = event.target.closest("[data-add-row]");
  if (addBtn) {
    handleDetailAddRow(addBtn.dataset.addRow);
    return;
  }

  const removeBtn = event.target.closest("[data-remove-row]");
  if (removeBtn) {
    handleDetailRemoveRow(
      removeBtn.dataset.removeRow,
      Number(removeBtn.dataset.index)
    );
    return;
  }

  // 完了登録ボタン（新しいtaskId方式）
  const completeBtn = event.target.closest("[data-complete-task-id]");
  if (completeBtn) {
    const taskId = Number(completeBtn.dataset.completeTaskId);
    handleCompleteTask(taskId);
    return;
  }

  // 選考完了ボタン（強制クローズ）
  const selectionCompleteBtn = event.target.closest("[data-selection-complete]");
  if (selectionCompleteBtn) {
    if (confirm("選考を完了として画面を閉じますか？")) {
      closeCandidateModal({ force: true });
    }
    return;
  }

  // PDF ダウンロードボタン
  const resumeBtn = event.target.closest("[data-download-resume]");
  if (resumeBtn) {
    const candidate = getSelectedCandidate();
    if (candidate && candidate.id) {
      window.open(`/api/candidates/${candidate.id}/resume.pdf`, "_blank");
    }
    return;
  }

  const cvBtn = event.target.closest("[data-download-cv]");
  if (cvBtn) {
    const candidate = getSelectedCandidate();
    if (candidate && candidate.id) {
      window.open(`/api/candidates/${candidate.id}/cv.pdf`, "_blank");
    }
    return;
  }
}

function syncDetailSectionInputs(sectionKey) {
  if (!sectionKey) return;
  const section = document.querySelector(`.candidate-detail-section[data-section="${sectionKey}"]`);
  if (!section) {
    console.error(`[candidates] syncDetailSectionInputs: Section not found for key "${sectionKey}". Please reload.`);
    alert("画面の状態が古いため保存できませんでした。ページをリロードしてください。");
    return;
  }
  const inputs = section.querySelectorAll("[data-detail-field], [data-array-field]");
  if (inputs.length === 0) {
    console.warn(`[candidates] syncDetailSectionInputs: No inputs found in section "${sectionKey}"`);
  }
  inputs.forEach((input) => {
    handleDetailFieldChange({ target: input });
  });
}

async function toggleDetailSectionEdit(sectionKey) {
  try {
    console.log("[toggleDetailSectionEdit] called for:", sectionKey);
    if (!sectionKey || !(sectionKey in detailEditState)) return;

    const wasEditing = detailEditState[sectionKey];
    // 切り替え後の状態
    const nextState = !wasEditing;

    const candidate = getSelectedCandidate();
    if (!candidate) return;

    if (wasEditing) {
      // 編集モード終了時 (保存処理)

      // 1. まず同期 (これでcandidateオブジェクトが更新される)
      try {
        syncDetailSectionInputs(sectionKey);
      } catch (syncError) {
        console.error("Sync inputs error:", syncError);
        // エラーでも続行し、下のsaveCandidateRecord内のDOMスクレイピングに賭ける
      }

      // 2. 保存実行 (DOMがまだ編集モードの状態で呼ぶ！これによりスクレイピングが機能する)
      // 状態は保存成功までとりあえず変えないでおく、あるいは保存成功後に変える
      // ここでは一時的に状態を変えず、保存に成功したら nextState (false) にする

      try {
        // 保存時はまだ編集モードのDOMが必要
        const updated = await saveCandidateRecord(candidate, { preserveDetailState: false, includeDetail: true });

        // 3. 成功したら状態を閲覧モードへ
        detailEditState[sectionKey] = false;

        renderCandidatesTable(filteredCandidates);
        highlightSelectedRow();
        renderCandidateDetail(updated, { preserveEditState: false });

      } catch (error) {
        console.error("詳細の保存に失敗しました。", error);
        alert(`保存に失敗しました。ネットワーク状態を確認してください。\n${error.message}`);
        // 保存失敗時は編集モードのままにする (DOMは残っているので何もしなくてよい)
        // ただし状態変数は戻す必要なし(まだ変えていないから)

        // もし sync で中途半端に更新されていたら？
        // DOMが残っているのでユーザーは再試行できる。
      }

    } else {
      // 編集モード開始時
      detailEditState[sectionKey] = true;
      renderCandidateDetail(candidate, { preserveEditState: true });
    }

  } catch (e) {
    console.error("toggleDetailSectionEdit unexpected error:", e);
    alert(`予期せぬエラーが発生しました: ${e.message}`);
  }
}

function handleDetailAddRow(type) {
  const candidate = getSelectedCandidate();
  if (!candidate) return;

  switch (type) {
    case "meetingPlans": {
      candidate.meetingPlans = candidate.meetingPlans || [];
      const list = candidate.meetingPlans;
      const nextSequence = list.length + 2;
      list.push({ sequence: nextSequence, plannedDate: "", attendance: false });
      break;
    }
    case "resumeDocuments": {
      candidate.resumeDocuments = candidate.resumeDocuments || [];
      const docs = candidate.resumeDocuments;
      docs.push({ label: `経歴書${docs.length + 1} `, value: "" });
      break;
    }
    case "selectionProgress": {
      candidate.selectionProgress = candidate.selectionProgress || [];
      candidate.selectionProgress.push({});
      break;
    }
    default:
      break;
  }

  const current = getSelectedCandidate();
  if (current) renderCandidateDetail(current, { preserveEditState: true });
}

function handleDetailRemoveRow(type, index) {
  const candidate = getSelectedCandidate();
  if (!candidate || Number.isNaN(index)) return;

  switch (type) {
    case "meetingPlans": {
      const list = candidate.meetingPlans || [];
      list.splice(index, 1);
      list.forEach((plan, idx) => (plan.sequence = idx + 2));
      candidate.meetingPlans = list;
      break;
    }
    case "resumeDocuments": {
      const docs = candidate.resumeDocuments || [];
      docs.splice(index, 1);
      candidate.resumeDocuments = docs;
      break;
    }
    case "selectionProgress": {
      const rows = candidate.selectionProgress || [];
      rows.splice(index, 1);
      candidate.selectionProgress = rows;
      break;
    }
    default:
      break;
  }

  const current = getSelectedCandidate();
  if (current) renderCandidateDetail(current, { preserveEditState: true });
}

async function handleCompleteTask(taskId) {
  const candidate = getSelectedCandidate();
  if (!candidate || !taskId) return;

  if (!confirm('このタスクを完了としてマークしますか？')) {
    return;
  }

  try {
    // completeTaskIdをpayloadに含めて保存
    const payload = {
      id: candidate.id,
      detailMode: true,
      completeTaskId: taskId,
    };

    const response = await fetch(candidatesApi(candidateDetailPath(candidate.id)), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status} ${response.statusText} - ${text.slice(0, 200)}`);
    }

    const updated = normalizeCandidate(await response.json());
    applyCandidateUpdate(updated, { preserveDetailState: true });

  } catch (error) {
    console.error('タスク完了登録に失敗しました:', error);
    alert(`タスク完了登録に失敗しました。\n${error.message}`);
  }
}

function handleDetailFieldChange(event) {
  const target = event.target;
  if (!target) return;
  const candidate = getSelectedCandidate();
  if (!candidate) return;

  // checkbox群（配列に入れるタイプ）
  const arrayField = target.dataset.arrayField;
  if (arrayField) {
    updateCandidateArrayField(
      candidate,
      arrayField,
      target.dataset.arrayValue,
      target.checked
    );
    return;
  }

  const fieldPath = target.dataset.detailField;
  if (!fieldPath) return;

  let value;
  if (target.type === "checkbox") {
    value = target.checked;
  } else {
    value = target.value;
  }

  const valueType = target.dataset.valueType;
  if (valueType === "number") {
    if (value === "") {
      value = "";
    } else {
      const parsed = Number(value);
      value = Number.isFinite(parsed) ? parsed : "";
    }
  }
  if (valueType === "boolean") {
    if (value === "" || value === null || value === undefined) {
      value = null;
    } else {
      value = value === true || value === "true";
    }
  }

  updateCandidateFieldValue(candidate, fieldPath, value);

  if (fieldPath === "attendanceConfirmed") {
    scheduleDetailAutoSave(candidate);
  }

  if (fieldPath === "birthday") {
    candidate.age = calculateAge(candidate.birthday);
  }

  if (fieldPath === "advisorUserId") {
    candidate.advisorName = resolveUserName(candidate.advisorUserId);
  }
  if (fieldPath === "partnerUserId") {
    candidate.partnerName = resolveUserName(candidate.partnerUserId);
  }
  if (fieldPath === "contactPreferredTime") {
    const normalized = normalizeContactPreferredTime(value);
    candidate.contactPreferredTime = normalized;
    candidate.contactTime = normalized;
    if (candidate.id != null) {
      const cacheKey = String(candidate.id);
      if (normalized) contactPreferredTimeCache.set(cacheKey, normalized);
      else contactPreferredTimeCache.delete(cacheKey);
    }
  }
  if (fieldPath === "applyCompanyName") {
    candidate.companyName = value;
  }
  if (fieldPath === "applyJobName") {
    candidate.jobName = value;
  }
  if (fieldPath === "applyRouteText") {
    candidate.source = value;
  }
  if (fieldPath === "applicationNote") {
    candidate.remarks = value;
  }
  if (fieldPath === "nextActionDate") {
    candidate.actionInfo = candidate.actionInfo || {};
    candidate.actionInfo.nextActionDate = value;
  }
  if (fieldPath === "firstInterviewNote") {
    candidate.hearing = candidate.hearing || {};
    candidate.hearing.memo = value;
    candidate.hearingMemo = value;
  }

  const selectionMatch = fieldPath.match(/^selectionProgress\.(\d+)\./);
  if (selectionMatch) {
    const index = Number(selectionMatch[1]);
    const row = candidate.selectionProgress?.[index];
    if (row) {
      if (fieldPath.endsWith(".clientId")) {
        row.companyName = resolveClientName(row.clientId);
      }
      const status = resolveSelectionStageValue(row);
      row.status = status;
      updateSelectionStatusCell(index, status);
    }
  }
}

function scheduleDetailAutoSave(candidate) {
  if (!candidate) return;
  if (detailAutoSaveTimer) window.clearTimeout(detailAutoSaveTimer);
  detailAutoSaveTimer = window.setTimeout(async () => {
    try {
      await saveCandidateRecord(candidate, { preserveDetailState: true, includeDetail: true });
      renderCandidatesTable(filteredCandidates);
      highlightSelectedRow();
    } catch (error) {
      console.error("詳細の保存に失敗しました。", error);
    }
  }, 200);
}

function updateCandidateArrayField(candidate, fieldPath, optionValue, checked) {
  if (!optionValue) return;
  const { container, key } = getFieldContainer(candidate, fieldPath);
  if (!container) return;

  if (!Array.isArray(container[key])) container[key] = [];
  const list = container[key];

  const exists = list.includes(optionValue);
  if (checked && !exists) list.push(optionValue);
  if (!checked && exists) list.splice(list.indexOf(optionValue), 1);
}

function updateCandidateFieldValue(candidate, fieldPath, value) {
  const { container, key } = getFieldContainer(candidate, fieldPath);
  if (!container) return;

  if (Array.isArray(container)) {
    const index = Number(key);
    container[index] = value;
  } else {
    container[key] = value;
  }
}

// "a.b.0.c" のようなパスを辿って、代入先の container と key を返す
function getFieldContainer(target, path) {
  const segments = path.split(".");
  let current = target;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    const nextKey = segments[i + 1];
    const nextIsIndex = /^\d+$/.test(nextKey);

    if (Array.isArray(current)) {
      const idx = Number(key);
      if (!current[idx]) current[idx] = nextIsIndex ? [] : {};
      current = current[idx];
      continue;
    }

    if (current[key] === undefined || current[key] === null) {
      current[key] = nextIsIndex ? [] : {};
    }
    current = current[key];
  }

  return { container: current, key: segments[segments.length - 1] };
}

function getSelectedCandidate() {
  if (!selectedCandidateId) return null;
  return (
    allCandidates.find((item) => String(item.id) === String(selectedCandidateId)) ||
    filteredCandidates.find((item) => String(item.id) === String(selectedCandidateId)) ||
    null
  );
}

// ====== /Detail Content Handlers ======

// -----------------------
// 詳細セクション
// -----------------------
function renderRegistrationSection(candidate) {
  const resolvedValid = resolveValidApplication(candidate);
  const fields = [
    { label: "登録日時", value: candidate.createdAt || candidate.registeredAt || candidate.registeredDate, type: "datetime", displayFormatter: formatDateTimeJP },
    { label: "担当者", value: candidate.advisorName },
    { label: "担当パートナー", value: candidate.partnerName },
    { label: "有効応募", value: resolvedValid, displayFormatter: (v) => (v ? "有効" : "無効") },
  ];
  return renderDetailGridFields(fields, "registration");
}

function renderMeetingSection(candidate) {
  return renderCsSection(candidate);
}

function renderAssigneeSection(candidate) {
  const fields = [
    {
      label: "担当CS",
      value: candidate.csName,
      input: "text",
      path: "csName",
      span: 3,
    },
    {
      label: "担当パートナー",
      value: candidate.advisorName,
      input: "text",
      path: "advisorName",
      span: 3,
    },
  ];
  return renderDetailGridFields(fields, "assignees");
}

function renderApplicantInfoSection(candidate) {
  const age = calculateAge(candidate.birthday);
  const ageDisplay = age !== null ? `${age} 歳` : candidate.age ? `${candidate.age} 歳` : "-";
  const address = candidate.address || [candidate.addressPref, candidate.addressCity, candidate.addressDetail].filter(Boolean).join("");
  const basicFields = [
    { label: "求職者名", value: candidate.candidateName, path: "candidateName", span: 3 },
    { label: "ヨミガナ", value: candidate.candidateKana, path: "candidateKana", span: 3 },
    { label: "性別", value: candidate.gender, input: "select", options: ["男性", "女性", "未回答"], path: "gender", span: 1 },
    { label: "国籍", value: candidate.nationality, path: "nationality", span: 1 },
    { label: "言語レベル", value: candidate.japaneseLevel, input: "select", options: japaneseLevelOptions, path: "japaneseLevel", span: 1 },
    { label: "生年月日", value: candidate.birthday, type: "date", path: "birthday", displayFormatter: formatDateJP, span: 1 },
    { label: "年齢", value: ageDisplay, editable: false, span: 1 },
    { label: "郵便番号", value: candidate.postalCode, path: "postalCode", span: 1 },
    { label: "都道府県", value: candidate.addressPref, path: "addressPref", span: 1 },
    { label: "市区町村", value: candidate.addressCity, path: "addressCity", span: 1 },
    { label: "番地・建物", value: candidate.addressDetail, path: "addressDetail", span: "full" },
    { label: "最終学歴", value: candidate.education, path: "education", span: "full" },
  ];
  const contactFields = [
    { label: "電話番号", value: candidate.phone, type: "tel", path: "phone", span: 2 },
    { label: "メール", value: candidate.email, type: "email", path: "email", span: 2 },
    { label: "連絡希望時間帯", value: candidate.contactPreferredTime, path: "contactPreferredTime", span: 2 },
  ];
  const applicationFields = [
    { label: "応募企業名", value: candidate.applyCompanyName, path: "applyCompanyName", span: 2 },
    { label: "応募求人名", value: candidate.applyJobName, path: "applyJobName", span: 2 },
    { label: "応募経路", value: candidate.applyRouteText, path: "applyRouteText", span: 2 },
    { label: "備考", value: candidate.applicationNote, input: "textarea", path: "applicationNote", span: "full" },
  ];
  return [
    renderDetailSubsection("基本情報", renderDetailGridFields(basicFields, "profile")),
    renderDetailSubsection("連絡情報", renderDetailGridFields(contactFields, "profile")),
    renderDetailSubsection("応募情報・その他", renderDetailGridFields(applicationFields, "profile")),
  ].join("");
}

function renderHearingSection(candidate) {
  const attendanceValue = candidate.attendanceConfirmed ?? false;
  const confirmationFields = [
    {
      label: "共有面談実施日",
      value: candidate.sharedInterviewDate,
      type: "date",
      path: "sharedInterviewDate",
      displayFormatter: formatDateJP,
      span: 1,
    },
    {
      label: "着座確認",
      value: attendanceValue,
      input: "checkbox",
      checkboxLabel: "確認済",
      path: "attendanceConfirmed",
      displayFormatter: (v) => (v ? "確認済" : "未"),
      span: 1,
    },
  ];

  const hearingFields = [
    { label: "新規面談マスト項目", value: candidate.mandatoryInterviewItems, input: "textarea", path: "mandatoryInterviewItems", span: "full" },
    { label: "希望エリア", value: candidate.desiredLocation, path: "desiredLocation", span: 2 },
    { label: "希望職種", value: candidate.desiredJobType, path: "desiredJobType", span: 2 },
    { label: "現年収", value: candidate.currentIncome, path: "currentIncome", span: 1, displayFormatter: formatMoneyToMan },
    { label: "希望年収", value: candidate.desiredIncome, path: "desiredIncome", span: 1, displayFormatter: formatMoneyToMan },
    { label: "就業ステータス", value: candidate.employmentStatus, input: "select", options: employmentStatusOptions, path: "employmentStatus", span: 2 },
    { label: "転職理由", value: candidate.careerReason, input: "textarea", path: "careerReason", span: "full" },
    { label: "転職軸", value: candidate.jobChangeAxis, input: "textarea", path: "jobChangeAxis", span: "full" },
    { label: "転職時期", value: candidate.jobChangeTiming, path: "jobChangeTiming", span: 2 },
    { label: "将来のビジョン・叶えたいこと", value: candidate.futureVision, input: "textarea", path: "futureVision", span: "full" },
    { label: "資格・スキル", value: candidate.skills, input: "textarea", path: "skills", span: "full" },
    { label: "人物像・性格", value: candidate.personality, input: "textarea", path: "personality", span: "full" },
    { label: "実務経験", value: candidate.workExperience, input: "textarea", path: "workExperience", span: "full" },
    { label: "推薦文", value: candidate.recommendationText, input: "textarea", path: "recommendationText", span: "full" },
    { label: "他社選考状態", value: candidate.otherSelectionStatus, input: "textarea", path: "otherSelectionStatus", span: "full" },
    {
      label: "面談メモ",
      value: candidate.firstInterviewNote || candidate.memo || "",
      input: "textarea",
      path: "firstInterviewNote",
      span: "full",
    },
    { label: "面接希望日", value: candidate.desiredInterviewDates, input: "textarea", path: "desiredInterviewDates", span: "full" },
  ];

  return [
    renderDetailSubsection("面談実施確認", renderDetailGridFields(confirmationFields, "hearing")),
    renderDetailSubsection("ヒアリング項目", renderDetailGridFields(hearingFields, "hearing")),
  ].join("");
}

function renderSelectionProgressSection(candidate) {
  const rows = candidate.selectionProgress || [];
  const editing = detailEditState.selection;
  const addButton = editing
    ? `<button type="button" class="repeatable-add-btn" data-add-row="selectionProgress"> 追加</button>`
    : "";
  const emptyHtml = `
    <div class="candidate-detail-empty p-8 text-center bg-slate-50 rounded-lg border border-slate-100">
      <p class="text-slate-500">企業の進捗は登録されていません。</p>
    </div>
  `;

  const cardsHtml = rows
    .map((row, index) => renderSelectionFlowCard(row, { editing, index }))
    .join("");

  if (editing) {
    return `
      <div class="repeatable-header">
        <h5>企業ごとの進捗 (編集モード)</h5>
        ${addButton}
      </div>
      <div class="selection-flow-container space-y-6">
        ${rows.length ? cardsHtml : emptyHtml}
      </div>
    `;
  }

<<<<<<< HEAD
  return `
    <div class="selection-flow-container space-y-6">
      ${rows.length ? cardsHtml : emptyHtml}
=======
  // ---------------------------------------------------------
  // 編集モード (Table Input)
  // ---------------------------------------------------------
  // ---------------------------------------------------------
  // 編集モード (Card Layout)
  // ---------------------------------------------------------
  const cardsHtml = rows.map((row, index) => {
    const pathPrefix = `selectionProgress.${ index } `;
    const r = normalizeSelectionRow(row);
    const deleteBtn = `< button type = "button" class="text-red-600 hover:text-red-800 text-sm font-medium" data - remove - row="selectionProgress" data - index="${index}" > 削除</button > `;

    return `
    < div class="selection-card bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-4 relative" >
        <div class="flex justify-between items-start mb-4 border-b border-slate-100 pb-2">
          <h4 class="text-sm font-bold text-slate-700 flex items-center gap-2">
            <span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs">申込 ${index + 1}</span>
            ${escapeHtml(r.companyName || "企業未設定")}
          </h4>
          ${deleteBtn}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
          <!-- 基本情報 (3 cols) -->
          <div class="lg:col-span-3 space-y-3">
            <div class="form-group">
              <label class="block text-xs font-medium text-slate-500 mb-1">企業名</label>
              ${renderTableInput(r.companyName, `${pathPrefix}.companyName`, "text", "selection", null, "client-list")}
            </div>
            <div class="form-group">
              <label class="block text-xs font-medium text-slate-500 mb-1">応募経路</label>
              ${renderTableInput(r.route, `${pathPrefix}.route`, "text", "selection")}
            </div>
            <div class="form-group">
              <label class="block text-xs font-medium text-slate-500 mb-1">選考状況</label>
              <div class="flex items-center gap-2">
                 ${renderTableInput(row.status, `${pathPrefix}.status`, "text", "selection")}
                 <!-- Note: Status might be better as select, but keeping text to match existing input type behavior (or maybe it was free text?) -->
                 <!-- Original used row.status, normalizing function uses row.status as well. -->
              </div>
            </div>
          </div>

          <!-- スケジュール (7 cols) -->
          <div class="lg:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded">
             <div class="col-span-2 md:col-span-1">
                <label class="block text-xs font-medium text-slate-500 mb-1">推薦日</label>
                ${renderTableInput(r.recommendationDate, `${pathPrefix}.recommendationDate`, "date", "selection")}
             </div>
             <div class="col-span-2 md:col-span-1"></div> <!-- Spacer -->
             <div class="col-span-2 md:col-span-1"></div> <!-- Spacer -->
             <div class="col-span-2 md:col-span-1"></div> <!-- Spacer -->

             <!-- 1次 -->
             <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">一次面接調整日時</label>
                ${renderTableInput(r.firstInterviewAdjustDate, `${pathPrefix}.firstInterviewAdjustDate`, "date", "selection")}
             </div>
             <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">一次面接日時</label>
                ${renderTableInput(r.firstInterviewDate, `${pathPrefix}.firstInterviewDate`, "date", "selection")}
             </div>

             <!-- 2次 -->
             <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">二次面接調整日時</label>
                ${renderTableInput(r.secondInterviewAdjustDate, `${pathPrefix}.secondInterviewAdjustDate`, "date", "selection")}
             </div>
             <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">二次面接日時</label>
                ${renderTableInput(r.secondInterviewDate, `${pathPrefix}.secondInterviewDate`, "date", "selection")}
             </div>

             <!-- 最終 -->
             <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">最終面接調整日時</label>
                ${renderTableInput(r.finalInterviewAdjustDate, `${pathPrefix}.finalInterviewAdjustDate`, "date", "selection")}
             </div>
             <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">最終面接日時</label>
                ${renderTableInput(r.finalInterviewDate, `${pathPrefix}.finalInterviewDate`, "date", "selection")}
             </div>
             <div class="col-span-2"></div>
          </div>

          <!-- 成果 (2 cols) -->
          <div class="lg:col-span-2 space-y-3">
             <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">FEE (万円)</label>
                <div class="relative">
                  ${renderTableInput(r.fee, `${pathPrefix}.fee`, "number", "selection")}
                  <span class="absolute right-2 top-1.5 text-xs text-slate-400">万</span>
                </div>
             </div>
             <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">Closing予定</label>
                ${renderTableInput(r.closingForecastDate, `${pathPrefix}.closingForecastDate`, "date", "selection")}
             </div>
          </div>
          
          <!-- Outcome Row (Full Width in Grid) -->
          <div class="lg:col-span-12 grid grid-cols-2 md:grid-cols-6 gap-3 border-t border-slate-100 pt-3 mt-1">
             <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">内定</label>
                ${renderTableInput(r.offerDate, `${pathPrefix}.offerDate`, "date", "selection")}
             </div>
             <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">承諾</label>
                ${renderTableInput(r.offerAcceptedDate, `${pathPrefix}.offerAcceptedDate`, "date", "selection")}
             </div>
             <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">入社</label>
                ${renderTableInput(r.joinedDate, `${pathPrefix}.joinedDate`, "date", "selection")}
             </div>
             <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">辞退日</label>
                ${renderTableInput(r.declinedDate, `${pathPrefix}.declinedDate`, "date", "selection")}
             </div>
             <div class="md:col-span-2">
                <label class="block text-xs font-medium text-slate-500 mb-1">辞退理由</label>
                ${renderTableInput(r.declinedReason, `${pathPrefix}.declinedReason`, "text", "selection")}
             </div>
          </div>

           <!-- Turnover -->
          <div class="lg:col-span-12 grid grid-cols-2 md:grid-cols-6 gap-3 border-t border-slate-100 pt-3">
             <div>
                <label class="block text-xs font-medium text-red-400 mb-1">短期離職</label>
                ${renderTableInput(r.earlyTurnoverDate, `${pathPrefix}.earlyTurnoverDate`, "date", "selection")}
             </div>
             <div class="md:col-span-2">
                <label class="block text-xs font-medium text-red-400 mb-1">離職理由</label>
                ${renderTableInput(r.earlyTurnoverReason, `${pathPrefix}.earlyTurnoverReason`, "text", "selection")}
             </div>
             <div class="md:col-span-3">
                <label class="block text-xs font-medium text-slate-500 mb-1">備考</label>
                ${renderTableTextarea(r.note, `${pathPrefix}.note`, "selection")}
             </div>
          </div>
        </div>
      </div >
    `;
  }).join("");

  return `
    < div class="repeatable-header flex justify-between items-center mb-4" >
      <h5 class="text-lg font-bold text-slate-800">企業ごとの進捗 (編集モード)</h5>
      ${ addButton }
    </div >
    <div class="selection-card-container">
      <datalist id="client-list">
        ${clientList.map(c => `<option value="${escapeHtml(c.name)}"></option>`).join("")}
      </datalist>
      ${cardsHtml || `<div class="p-8 text-center text-slate-400 bg-slate-50 rounded border border-dashed border-slate-300">企業進捗が登録されていません。<br>「追加」ボタンから登録してください。</div>`}
>>>>>>> udea
    </div>
  `;
}

// ---------------------------------------------------------
// Helper: Selection Flow Card & Chart
// ---------------------------------------------------------

function normalizeSelectionRow(row) {
  return {
    companyName: row.companyName,
    route: row.route ?? row.source,
    status: resolveSelectionStageValue(row) || row.status, // Pill表示用
    proposalDate: row.proposalDate ?? row.proposal_date,
    recommendationDate: row.recommendationDate ?? row.recommendedAt ?? row.recommended_at,
    firstInterviewDate: row.firstInterviewDate ?? row.firstInterviewAt ?? row.interviewDate ?? row.first_interview_at,
    secondInterviewDate: row.secondInterviewDate ?? row.secondInterviewAt ?? row.second_interview_at,
    finalInterviewDate: row.finalInterviewDate ?? row.finalInterviewAt ?? row.final_interview_at,
    offerDate: row.offerDate ?? row.offerAt ?? row.offer_date,
    offerAcceptedDate: row.offerAcceptedDate ?? row.offerAcceptedAt ?? row.offerAcceptDate ?? row.offer_accept_date ?? row.acceptanceDate,
    joinedDate: row.joinedDate ?? row.joinedAt ?? row.joinDate ?? row.join_date ?? row.onboardingDate,
    preJoinDeclineDate: row.preJoinDeclineDate ?? row.pre_join_withdraw_date,
    preJoinDeclineReason: row.preJoinDeclineReason ?? row.pre_join_withdraw_reason,
    postJoinQuitDate: row.postJoinQuitDate ?? row.post_join_quit_date,
    postJoinQuitReason: row.postJoinQuitReason ?? row.post_join_quit_reason,
    closeExpectedDate: row.closeExpectedDate ?? row.close_expected_at ?? row.closingForecastDate ?? row.closingForecastAt,
    fee: row.fee ?? row.feeAmount,
    note: row.note ?? row.selectionNote ?? row.selection_note,
  };
}

function renderSelectionNodeDate(value, path, editing) {
  if (!editing) {
    const dateStr = formatDateJP(value);
    const className = value ? "text-indigo-700 font-bold" : "text-slate-300";
    return `< div class="text-[10px] ${className} mt-1" > ${ escapeHtml(dateStr) }</div > `;
  }
  const dataset = path ? `data - detail - field="${path}" data - detail - section="selection"` : "";
  const inputValue = value === 0 ? "0" : formatInputValue(value, "date");
  return `< input type = "date" class="detail-inline-input selection-node-input" value = "${escapeHtmlAttr(inputValue)}" ${ dataset }> `;
}

function renderSelectionNodeText(value, path, editing, placeholder = "") {
  if (!editing) {
    return `< div class="text-[10px] text-slate-500 mt-1" > ${ escapeHtml(value || "-") }</div > `;
  }
  const dataset = path ? `data - detail - field="${path}" data - detail - section="selection"` : "";
  return `< input type = "text" class="detail-inline-input selection-node-input selection-node-reason" value = "${escapeHtmlAttr(value || "")}" placeholder = "${escapeHtmlAttr(placeholder)}" ${ dataset }> `;
}

function renderSelectionFlowCard(rawRow, { editing = false, index = 0 } = {}) {
  const r = normalizeSelectionRow(rawRow);
  const statusVariant = resolveSelectionStatusVariant(r.status);
  const statusLabel = r.status || "未設定";
  const pathPrefix = `selectionProgress.${ index } `;

  // Flow Steps Definition
  const steps = [
    { key: "proposalDate", label: "提案", date: r.proposalDate },
    { key: "recommendationDate", label: "推薦", date: r.recommendationDate },
    { key: "firstInterviewDate", label: "一次面接", date: r.firstInterviewDate },
    { key: "secondInterviewDate", label: "二次面接", date: r.secondInterviewDate },
    { key: "finalInterviewDate", label: "最終面接", date: r.finalInterviewDate },
    { key: "offerDate", label: "内定", date: r.offerDate },
    { key: "acceptanceDate", label: "承諾", date: r.offerAcceptedDate },
    { key: "onboardingDate", label: "入社", date: r.joinedDate },
    { key: "closeExpectedDate", label: "クロージング", date: r.closeExpectedDate },
  ];

  // Determine current active step index based on dates
  // Find the last step that has a confirmed date
  let lastCompletedIndex = -1;
  steps.forEach((step, idx) => {
    if (step.date) lastCompletedIndex = idx;
  });

  const flowHtml = steps.map((step, idx) => {
    const isCompleted = idx <= lastCompletedIndex;
    const isCurrent = idx === lastCompletedIndex;
    const hasDate = Boolean(step.date);

    // Circle Color
    let circleClass = "bg-slate-200 text-slate-400"; // default
    if (isCompleted) circleClass = "bg-indigo-600 text-white ring-2 ring-indigo-100";
    if (isCurrent) circleClass = "bg-indigo-600 text-white ring-4 ring-indigo-200 scale-110";

    // Bar Color (Connector to next)
    let barClass = "bg-slate-200";
    if (idx < steps.length - 1) {
      if (idx < lastCompletedIndex) barClass = "bg-indigo-600";
    }

    const dateHtml = renderSelectionNodeDate(step.date, `${ pathPrefix }.${ step.key } `, editing);

    return `
    < div class="flex-1 relative group" >
        < !--Connector Bar-- >
    ${ idx < steps.length - 1 ? `<div class="absolute top-3 left-1/2 w-full h-0.5 ${barClass} -z-0"></div>` : "" }

  <div class="relative z-10 flex flex-col items-center">
    <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${circleClass}">
      ${idx + 1}
    </div>
    <div class="mt-2 text-xs font-medium text-slate-700 group-hover:text-indigo-800 transition-colors">${idx + 1}${step.label}</div>
    ${dateHtml}
  </div>
      </div >
    `;
  }).join("");

  const details = [];
  if (r.route) details.push({ label: "経由", value: r.route });
  if (r.fee) details.push({ label: "FEE", value: formatMoneyToMan(r.fee) });

  // 備考エリア
  const noteHtml = editing
    ? `
    < div class="mt-3" >
      <div class="text-xs text-slate-400 mb-1">備考</div>
        ${ renderTableTextarea(r.note, `${pathPrefix}.selectionNote`, "selection") }
      </div >
    `
    : r.note
      ? `< div class="mt-3 text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 whitespace-pre-wrap" > <span class="font-bold text-slate-500 mr-1">備考:</span>${ escapeHtml(r.note) }</div > `
      : "";

  const declineNodes = [
    {
      label: "内定後辞退",
      date: r.preJoinDeclineDate,
      reason: r.preJoinDeclineReason,
      datePath: `${ pathPrefix }.preJoinDeclineDate`,
      reasonPath: `${ pathPrefix }.preJoinDeclineReason`,
    },
    {
      label: "入社後辞退",
      date: r.postJoinQuitDate,
      reason: r.postJoinQuitReason,
      datePath: `${ pathPrefix }.postJoinQuitDate`,
      reasonPath: `${ pathPrefix }.postJoinQuitReason`,
    },
  ];
  const declineHtml = declineNodes
    .map((node) => `
    < div class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2" >
      <div class="text-xs font-semibold text-slate-700">${node.label}</div>
        ${ renderSelectionNodeDate(node.date, node.datePath, editing) }
        ${ renderSelectionNodeText(node.reason, node.reasonPath, editing, "辞退理由") }
      </div >
    `)
    .join("");

  const headerLeft = editing
    ? `
    < div class="flex flex-wrap items-start gap-3" >
        <div class="min-w-[180px]">
          <div class="text-[10px] text-slate-400 mb-1">企業名</div>
          ${renderTableSelect(buildClientOptions(rawRow.clientId, r.companyName), `${pathPrefix}.clientId`, "selection")}
        </div>
        <div class="min-w-[140px]">
          <div class="text-[10px] text-slate-400 mb-1">応募経路</div>
          ${renderTableInput(r.route, `${pathPrefix}.route`, "text", "selection")}
        </div>
        <div class="flex items-center gap-2 pt-4" data-selection-status>
          ${renderStatusPill(statusLabel, statusVariant)}
        </div>
      </div >
    `
    : `
    < div class="flex items-center gap-3" >
        <h4 class="text-lg font-bold text-slate-800">${escapeHtml(r.companyName || "企業名未設定")}</h4>
        <div data-selection-status>${renderStatusPill(statusLabel, statusVariant)}</div>
      </div >
    `;

  const headerRight = editing
    ? `< button type = "button" class="repeatable-remove-btn" data - remove - row="selectionProgress" data - index="${index}" > 削除</button > `
    : `
    < div class="flex gap-4 text-xs text-slate-500" >
      ${ details.map(d => `<div><span class="text-slate-400 mr-1">${d.label}:</span><span class="font-semibold text-slate-700">${escapeHtml(formatDisplayValue(d.value))}</span></div>`).join("") }
      </div >
    `;

  const rowAttr = editing ? `data - selection - row="${index}"` : "";
  return `
    < div class="selection-card bg-white rounded-lg border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow" ${ rowAttr }>
      <div class="flex items-center justify-between mb-4">
        ${headerLeft}
        ${headerRight}
      </div>
      
      <!--Flow Chart-- >
      <div class="flex flex-col lg:flex-row lg:items-start gap-4">
        <div class="flex-1 flex justify-between items-start w-full px-2 mb-2">
          ${flowHtml}
        </div>
        <div class="flex flex-col gap-3 min-w-[160px]">
          ${declineHtml}
        </div>
      </div>

      <!--Alerts & Notes-- >
    ${ noteHtml }
    </div >
    `;
}

function renderTeleapoLogsSection(candidate) {
  const rows = candidate.teleapoLogs || [];
  if (rows.length === 0) {
    return `
    < div class="detail-table-wrapper" >
      <table class="detail-table">
        <thead>
          <tr><th>架電回数</th><th>担当者</th><th>メモ</th><th>日時</th></tr>
        </thead>
        <tbody>
          <tr><td colspan="4" class="detail-empty-row text-center py-3">テレアポログはありません。</td></tr>
        </tbody>
      </table>
      </div >
    `;
  }

  const bodyHtml = rows
    .map((row) => {
      const cells = [
        row.callNo,
        row.callerName,
        row.memo,
        formatDateTimeJP(row.calledAt),
      ]
        .map((v) => `< td > <span class="detail-value">${escapeHtml(formatDisplayValue(v))}</span></td > `)
        .join("");
      return `< tr > ${ cells }</tr > `;
    })
    .join("");

  return `
    < div class="detail-table-wrapper" >
      <table class="detail-table">
        <thead>
          <tr><th>架電回数</th><th>担当者</th><th>メモ</th><th>日時</th></tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div >
    `;
}

function renderMoneySection(candidate) {
  const rows = candidate.moneyInfo || [];
  const hasRows = rows.length > 0;
  const editing = detailEditState.money;

  const orderBody = hasRows
    ? rows
      .map((row, index) => {
        const canEdit = editing && row.joinDate;
        const feeCell = canEdit
          ? renderTableInput(row.feeAmount, `moneyInfo.${ index }.feeAmount`, "number", "money", "number")
          : `< span class="detail-value" > ${ escapeHtml(formatMoneyToMan(row.feeAmount)) }</span > `;
        const orderDateCell = canEdit
          ? renderTableInput(row.orderDate, `moneyInfo.${ index }.orderDate`, "date", "money")
          : `< span class="detail-value" > ${ escapeHtml(formatDisplayValue(formatDateJP(row.orderDate))) }</span > `;
        const reportCell = canEdit
          ? renderTableSelect(buildBooleanOptions(row.orderReported), `moneyInfo.${ index }.orderReported`, "money", "boolean")
          : renderBooleanPill(row.orderReported);
        return `
    < tr >
            <td><span class="detail-value">${escapeHtml(formatDisplayValue(row.companyName))}</span></td>
            <td>${feeCell}</td>
            <td>${orderDateCell}</td>
            <td class="text-center">${reportCell}</td>
          </tr >
    `;
      })
      .join("")
    : `< tr > <td colspan="4" class="detail-empty-row text-center py-3">受注情報はありません。</td></tr > `;

  const refundBody = hasRows
    ? rows
      .map((row, index) => {
        const retirementDate = row.preJoinWithdrawDate || row.postJoinQuitDate || "";
        const refundType = row.preJoinWithdrawDate
          ? "内定後辞退"
          : row.postJoinQuitDate
            ? "入社後辞退"
            : row.joinDate
              ? "入社"
              : "-";
        const canEdit = editing && (row.preJoinWithdrawDate || row.postJoinQuitDate);
        const refundAmountCell = canEdit
          ? renderTableInput(row.refundAmount, `moneyInfo.${ index }.refundAmount`, "number", "money", "number")
          : `< span class="detail-value" > ${ escapeHtml(formatMoneyToMan(row.refundAmount)) }</span > `;
        const withdrawDateCell = canEdit
          ? renderTableInput(row.withdrawDate, `moneyInfo.${ index }.withdrawDate`, "date", "money")
          : `< span class="detail-value" > ${ escapeHtml(formatDisplayValue(formatDateJP(row.withdrawDate))) }</span > `;
        const refundReportCell = canEdit
          ? renderTableSelect(buildBooleanOptions(row.refundReported), `moneyInfo.${ index }.refundReported`, "money", "boolean")
          : renderBooleanPill(row.refundReported);
        return `
    < tr >
            <td><span class="detail-value">${escapeHtml(formatDisplayValue(row.companyName))}</span></td>
            <td>${refundAmountCell}</td>
            <td>${withdrawDateCell}</td>
            <td><span class="detail-value">${escapeHtml(formatDisplayValue(formatDateJP(retirementDate)))}</span></td>
            <td><span class="detail-value">${escapeHtml(formatDisplayValue(refundType))}</span></td>
            <td class="text-center">${refundReportCell}</td>
          </tr >
    `;
      })
      .join("")
    : `< tr > <td colspan="6" class="detail-empty-row text-center py-3">返金情報はありません。</td></tr > `;

  const orderTable = `
    < div class="detail-table-wrapper" >
      <table class="detail-table">
        <thead>
          <tr><th>企業名</th><th>受注金額（税抜）</th><th>受注日</th><th>受注報告</th></tr>
        </thead>
        <tbody>${orderBody}</tbody>
      </table>
    </div >
    `;

  const refundTable = `
    < div class="detail-table-wrapper" >
      <table class="detail-table">
        <thead>
          <tr><th>企業名</th><th>返金・減額（税抜）</th><th>辞退日</th><th>退職日</th><th>返金区分</th><th>返金報告</th></tr>
        </thead>
        <tbody>${refundBody}</tbody>
      </table>
    </div >
    `;

  return [
    renderDetailSubsection("入社承諾後", orderTable),
    renderDetailSubsection("返金・減額", refundTable),
  ].join("");
}

function renderAfterAcceptanceSection(candidate) {
  const data = candidate.afterAcceptance || {};
  const fields = [
    { label: "受注金額（税抜）", value: data.amount, span: 3, displayFormatter: formatMoneyToMan },
    { label: "職種", value: data.jobCategory, span: 3 },
  ];
  const reportStatuses =
    (data.reportStatuses || [])
      .map((s) => `< span class="cs-pill is-active" > ${ escapeHtml(s) }</span > `)
      .join("") || "-";
  return `
    ${ renderDetailGridFields(fields, "afterAcceptance") }
  <div class="detail-pill-list">${reportStatuses}</div>
  `;
}

function renderRefundSection(candidate) {
  const listFromCandidate =
    Array.isArray(candidate.refundInfoList) && candidate.refundInfoList.length > 0
      ? candidate.refundInfoList
      : null;
  const fallbackInfo = candidate.refundInfo || {};
  const fallbackList =
    !listFromCandidate &&
      (fallbackInfo.resignationDate || fallbackInfo.refundAmount || fallbackInfo.reportStatus)
      ? [
        {
          companyName: "",
          resignationDate: fallbackInfo.resignationDate,
          refundAmount: fallbackInfo.refundAmount,
          reportStatus: fallbackInfo.reportStatus,
        },
      ]
      : [];
  const items = listFromCandidate || fallbackList;

  if (!items.length) {
    return `
    < div class="detail-table-wrapper" >
      <table class="detail-table">
        <thead>
          <tr><th>企業名</th><th>退職日</th><th>返金・減額（税抜）</th><th>返金報告</th></tr>
        </thead>
        <tbody>
          <tr><td colspan="4" class="detail-empty-row text-center py-3">返金情報はありません。</td></tr>
        </tbody>
      </table>
      </div >
    `;
  }

  const bodyHtml = items
    .map((item) => {
      const cells = [
        item.companyName || "-",
        formatDateJP(item.resignationDate),
        formatMoneyToMan(item.refundAmount),
        item.reportStatus || "-",
      ]
        .map((v) => `< td > <span class="detail-value">${escapeHtml(formatDisplayValue(v))}</span></td > `)
        .join("");
      return `< tr > ${ cells }</tr > `;
    })
    .join("");

  return `
    < div class="detail-table-wrapper" >
      <table class="detail-table">
        <thead>
          <tr><th>企業名</th><th>退職日</th><th>返金・減額（税抜）</th><th>返金報告</th></tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div >
    `;
}

function renderNextActionSection(candidate) {
  // タスクリストを取得（未完了/完了で分ける）
  const allTasks = candidate.tasks || [];
  const incompleteTasks = allTasks.filter(t => !t.isCompleted);
  const completedTasks = allTasks.filter(t => t.isCompleted);

  // 現在の次回アクション（未完了の最初のタスク）
  const currentTask = incompleteTasks.length > 0 ? incompleteTasks[0] : null;

  // サマリー表示
  let displayTask = currentTask;
  if (!displayTask && candidate.nextActionDate) {
    displayTask = {
      actionDate: candidate.nextActionDate,
      actionNote: candidate.nextActionContent || candidate.nextActionNote || "（内容未設定）",
      id: null // 仮想タスク
    };
  }

  const summaryHtml = displayTask
    ? `
    < div class="next-action-card bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-4 mb-4" >
      <div class="flex items-center justify-between">
        <div>
          <span class="next-action-date text-lg font-bold text-indigo-900">次回アクション: ${escapeHtml(formatDateJP(displayTask.actionDate))}</span>
        </div>
        ${displayTask.id ? `
        <button type="button" class="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 font-medium shadow-sm transition-colors" data-complete-task-id="${displayTask.id}">
          ✓ 完了登録
        </button>
        ` : ''}
      </div>
      <div class="mt-2 text-sm text-slate-700">${escapeHtml(displayTask.actionNote || '-')}</div>
    </div >
    `
    : `
    < div class="next-action-card bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4" >
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="text-amber-600 text-lg">⚠️</span>
            <span class="text-amber-900 font-bold">次回アクションが未設定です</span>
          </div>
          <p class="text-xs text-amber-800">次回アクションを設定するか、選考終了の場合は「選考完了」を押してください。</p>
        </div>
        <button type="button" class="px-3 py-1.5 bg-slate-600 text-white rounded-md text-sm hover:bg-slate-700 font-medium shadow-sm transition-colors whitespace-nowrap" data-selection-complete="true">
          🏁 選考完了
        </button>
      </div>
    </div >
    `;

  // 新規アクション追加エリア
  const addTaskHtml = `
    < div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4" >
      <p class="text-xs text-blue-800 mb-2">💡 新しいアクションを追加するには、以下を入力して「編集」→「完了して保存」してください。</p>
    </div >
    `;

  const fields = [
    { label: "次回アクション日", value: candidate.nextActionDate || "", path: "nextActionDate", type: "date", displayFormatter: formatDateJP, span: 3 },
    { label: "次回アクション内容", value: candidate.nextActionNote || "", path: "nextActionNote", span: 3 },
  ];

  // 未完了タスク一覧（現在のもの以外）
  const remainingTasks = incompleteTasks.slice(1);
  const remainingTasksHtml = remainingTasks.length > 0
    ? `
    < div class="mt-4" >
      <h5 class="text-sm font-semibold text-slate-700 mb-2">📋 予定中のアクション</h5>
      <div class="space-y-2">
        ${remainingTasks.map((task) => `
          <div class="bg-white border border-slate-200 rounded-lg p-3" data-task-id="${task.id}">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-medium text-slate-900">${escapeHtml(formatDateJP(task.actionDate))}</span>
              <span class="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">予定</span>
            </div>
            <div class="text-sm text-slate-700">${escapeHtml(task.actionNote || '-')}</div>
          </div>
        `).join('')}
      </div>
    </div >
    `
    : '';

  // 完了済みタスク履歴
  const completedTasksHtml = completedTasks.length > 0
    ? `
    < div class="mt-6" >
      <h5 class="text-sm font-semibold text-slate-700 mb-3">✅ 完了したアクション (${completedTasks.length}件)</h5>
      <div class="space-y-2">
        ${completedTasks.map((task) => `
          <div class="bg-white border border-slate-200 rounded-lg p-3 opacity-75" data-task-id="${task.id}">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-medium text-slate-900">${escapeHtml(formatDateJP(task.actionDate))}</span>
              <span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">完了</span>
            </div>
            <div class="text-sm text-slate-700">${escapeHtml(task.actionNote || '-')}</div>
            <div class="text-xs text-slate-400 mt-1">完了日時: ${escapeHtml(formatDateTimeJP(task.completedAt))}</div>
          </div>
        `).join('')}
      </div>
    </div >
    `
    : '';

  return `
    ${ summaryHtml }
    ${ addTaskHtml }
    ${ renderDetailGridFields(fields, "nextAction") }
    ${ remainingTasksHtml }
    ${ completedTasksHtml }
  `;
}

function renderCsSection(candidate) {
  const csSummary = candidate.csSummary || {};
  const hasSms = Boolean(candidate.smsSent ?? candidate.smsConfirmed ?? csSummary.hasSms);
  const hasConnected = Boolean(candidate.phoneConnected ?? csSummary.hasConnected);
  const callCount = csSummary.callCount ?? candidate.callCount ?? 0;
  const lastConnectedAt = candidate.callDate ?? csSummary.lastConnectedAt ?? null;
  const editing = detailEditState.cs;

  const items = [
    { label: "SMS送信", html: renderBooleanPill(hasSms, { trueLabel: "送信済", falseLabel: "未送信" }) },
    { label: "架電回数", value: Number(callCount) > 0 ? `${ callCount } 回` : "-" },
    { label: "通電", html: renderBooleanPill(hasConnected, { trueLabel: "通電済", falseLabel: "未通電" }) },
    { label: "通電日", value: formatDateJP(lastConnectedAt) },
    { label: "設定日", value: candidate.scheduleConfirmedAt, path: "scheduleConfirmedAt", type: "date" },
    { label: "新規接触予定日", value: candidate.firstContactPlannedAt, path: "firstContactPlannedAt", type: "date" },

  ];

  return `
    < div class="cs-summary-grid" >
      ${
        items
          .map(
            (item) => `
            <div class="cs-summary-item">
              <span class="cs-summary-label">${escapeHtml(item.label)}</span>
              <div class="cs-summary-value">
                ${editing && item.path
                ? renderDetailFieldInput({ path: item.path, type: item.type }, item.value, "cs")
                : item.html || (item.type === "date" ? formatDateJP(item.value) : escapeHtml(formatDisplayValue(item.value)))
              }
              </div>
            </div>
          `
          )
        .join("")
  }
    </div >
    `;
}

// ========== 書類作成セクション ==========
function renderDocumentsSection(candidate) {
  const editing = detailEditState.documents;
  const educations = candidate.educations || [];
  const workHistories = candidate.workHistories || [];

  const renderEducationRow = (edu, index) => {
    if (editing) {
      return `
    < div class="education-row grid grid-cols-6 gap-2 mb-2 p-3 bg-slate-50 rounded border border-slate-200" data - education - index="${index}" >
          <div class="col-span-2">
            <label class="block text-xs text-slate-500 mb-1">学校名</label>
            <input type="text" class="w-full px-2 py-1 border rounded text-sm" data-edu-field="schoolName" value="${escapeHtml(edu.schoolName || edu.school_name || '')}">
          </div>
          <div class="col-span-2">
            <label class="block text-xs text-slate-500 mb-1">学部・学科</label>
            <input type="text" class="w-full px-2 py-1 border rounded text-sm" data-edu-field="department" value="${escapeHtml(edu.department || '')}">
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">入学年月</label>
            <input type="month" class="w-full px-2 py-1 border rounded text-sm" data-edu-field="admissionDate" value="${formatMonthValue(edu.admissionDate || edu.admission_date)}">
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">卒業年月</label>
            <input type="month" class="w-full px-2 py-1 border rounded text-sm" data-edu-field="graduationDate" value="${formatMonthValue(edu.graduationDate || edu.graduation_date)}">
          </div>
          <button type="button" class="col-span-6 text-right text-red-500 text-xs hover:underline" data-remove-education="${index}">削除</button>
        </div >
    `;
    }
    return `
    < tr >
        <td class="px-3 py-2 text-sm">${escapeHtml(edu.schoolName || edu.school_name || '-')}</td>
        <td class="px-3 py-2 text-sm">${escapeHtml(edu.department || '-')}</td>
        <td class="px-3 py-2 text-sm">${formatMonthJP(edu.admissionDate || edu.admission_date)}</td>
        <td class="px-3 py-2 text-sm">${formatMonthJP(edu.graduationDate || edu.graduation_date)}</td>
      </tr >
    `;
  };

  const renderWorkRow = (work, index) => {
    if (editing) {
      return `
    < div class="work-row grid grid-cols-6 gap-2 mb-2 p-3 bg-slate-50 rounded border border-slate-200" data - work - index="${index}" >
          <div class="col-span-2">
            <label class="block text-xs text-slate-500 mb-1">会社名</label>
            <input type="text" class="w-full px-2 py-1 border rounded text-sm" data-work-field="companyName" value="${escapeHtml(work.companyName || work.company_name || '')}">
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">部署・職種</label>
            <input type="text" class="w-full px-2 py-1 border rounded text-sm" data-work-field="department" value="${escapeHtml(work.department || '')}">
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">役職</label>
            <input type="text" class="w-full px-2 py-1 border rounded text-sm" data-work-field="position" value="${escapeHtml(work.position || '')}">
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">入社年月</label>
            <input type="month" class="w-full px-2 py-1 border rounded text-sm" data-work-field="joinDate" value="${formatMonthValue(work.joinDate || work.join_date)}">
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">退職年月</label>
            <input type="month" class="w-full px-2 py-1 border rounded text-sm" data-work-field="leaveDate" value="${formatMonthValue(work.leaveDate || work.leave_date)}">
          </div>
          <div class="col-span-6">
            <label class="block text-xs text-slate-500 mb-1">業務内容</label>
            <textarea class="w-full px-2 py-1 border rounded text-sm" rows="2" data-work-field="jobDescription">${escapeHtml(work.jobDescription || work.job_description || '')}</textarea>
          </div>
          <button type="button" class="col-span-6 text-right text-red-500 text-xs hover:underline" data-remove-work="${index}">削除</button>
        </div >
    `;
    }
    return `
    < tr >
        <td class="px-3 py-2 text-sm">${escapeHtml(work.companyName || work.company_name || '-')}</td>
        <td class="px-3 py-2 text-sm">${escapeHtml(work.department || '-')}</td>
        <td class="px-3 py-2 text-sm">${escapeHtml(work.position || '-')}</td>
        <td class="px-3 py-2 text-sm">${formatMonthJP(work.joinDate || work.join_date)}</td>
        <td class="px-3 py-2 text-sm">${formatMonthJP(work.leaveDate || work.leave_date) || '現職'}</td>
      </tr >
    `;
  };

  const educationHtml = editing
    ? `< div id = "educationRepeater" > ${ educations.map((e, i) => renderEducationRow(e, i)).join('') }</div >
    <button type="button" class="mt-2 px-3 py-1 text-sm text-indigo-600 border border-indigo-300 rounded hover:bg-indigo-50" data-add-education>+ 学歴を追加</button>`
    : `< table class="w-full text-left border-collapse" >
         <thead><tr class="bg-slate-100"><th class="px-3 py-2 text-xs font-medium">学校名</th><th class="px-3 py-2 text-xs font-medium">学部・学科</th><th class="px-3 py-2 text-xs font-medium">入学</th><th class="px-3 py-2 text-xs font-medium">卒業</th></tr></thead>
         <tbody>${educations.length ? educations.map((e, i) => renderEducationRow(e, i)).join('') : '<tr><td colspan="4" class="px-3 py-4 text-center text-slate-400">登録なし</td></tr>'}</tbody>
       </table > `;

  const workHtml = editing
    ? `< div id = "workRepeater" > ${ workHistories.map((w, i) => renderWorkRow(w, i)).join('') }</div >
    <button type="button" class="mt-2 px-3 py-1 text-sm text-indigo-600 border border-indigo-300 rounded hover:bg-indigo-50" data-add-work>+ 職歴を追加</button>`
    : `< table class="w-full text-left border-collapse" >
         <thead><tr class="bg-slate-100"><th class="px-3 py-2 text-xs font-medium">会社名</th><th class="px-3 py-2 text-xs font-medium">部署</th><th class="px-3 py-2 text-xs font-medium">役職</th><th class="px-3 py-2 text-xs font-medium">入社</th><th class="px-3 py-2 text-xs font-medium">退職</th></tr></thead>
         <tbody>${workHistories.length ? workHistories.map((w, i) => renderWorkRow(w, i)).join('') : '<tr><td colspan="5" class="px-3 py-4 text-center text-slate-400">登録なし</td></tr>'}</tbody>
       </table > `;

  return `
    < div class="space-y-6" >
      <div>
        <h5 class="text-md font-semibold text-slate-700 mb-3">📚 学歴</h5>
        ${educationHtml}
      </div>
      <div>
        <h5 class="text-md font-semibold text-slate-700 mb-3">💼 職歴</h5>
        ${workHtml}
      </div>
      <div class="flex gap-3 pt-4 border-t border-slate-200">
        <button type="button" class="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-500" data-download-resume>📄 履歴書をダウンロード</button>
        <button type="button" class="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-500" data-download-cv>📝 職務経歴書をダウンロード</button>
      </div>
    </div >
    `;
}

function formatMonthValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${ d.getFullYear() } -${ String(d.getMonth() + 1).padStart(2, '0') } `;
}

function formatMonthJP(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return `${ d.getFullYear() }年${ d.getMonth() + 1 } 月`;
}

function parseDateValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function pickNextAction(candidate) {
  const tasks = Array.isArray(candidate.tasks) ? candidate.tasks : [];
  const incompleteTasks = tasks.filter((task) => !task?.isCompleted);
  if (incompleteTasks.length > 0) {
    const sorted = [...incompleteTasks].sort((a, b) => {
      const aDate = parseDateValue(a?.actionDate)?.getTime() ?? Number.POSITIVE_INFINITY;
      const bDate = parseDateValue(b?.actionDate)?.getTime() ?? Number.POSITIVE_INFINITY;
      return aDate - bDate;
    });
    const nextTask = sorted[0];
    const taskDate = parseDateValue(nextTask?.actionDate);
    if (taskDate) {
      return {
        label: "次回アクション",
        date: taskDate,
        note: nextTask?.actionNote || null
      };
    }
  }

  const explicitNextAction = parseDateValue(candidate.nextActionDate);
  if (explicitNextAction) {
    return {
      label: "次回アクション",
      date: explicitNextAction,
      note: candidate.nextActionNote || null
    };
  }

  return null;
}

function renderMemoSection(candidate) {
  const editing = detailEditState.memo;
  if (editing) {
    return `
    < label class="detail-textarea-field" >
      <span>自由メモ</span>
      ${ renderTableTextarea(candidate.memoDetail, "memoDetail", "memo") }
    </label >
    `;
  }
  return `
    < label class="detail-textarea-field" >
      <span>自由メモ</span>
      <span class="detail-value">${escapeHtml(candidate.memoDetail || "-")}</span>
    </label >
    `;
}

function resolveDetailGridSpanClass(field) {
  const span = field.span || (field.input === "textarea" ? "full" : null);
  if (span === "full") return "col-span-full";
  if (typeof span === "number") {
    const smSpan = Math.min(span, 2);
    return `col - span - full sm: col - span - ${ smSpan } lg: col - span - ${ span } `;
  }
  return "col-span-full sm:col-span-2 lg:col-span-2";
}

function renderDetailGridFields(fields, sectionKey, options = {}) {
  const editing = Boolean(detailEditState[sectionKey]);
  const gridClass = [
    "detail-grid",
    "grid",
    "grid-cols-1",
    "sm:grid-cols-2",
    "lg:grid-cols-6",
    "gap-x-6",
    "gap-y-4",
    options.gridClass,
  ]
    .filter(Boolean)
    .join(" ");
  return `
    < dl class="${gridClass}" >
      ${
        fields
          .map((field) => {
            const value = field.value;
            const spanClass = resolveDetailGridSpanClass(field);

            // 編集モードで編集可能なフィールド
            if (editing && field.path) {
              return `
              <div class="detail-grid-item ${spanClass}">
                <dt>${field.label}</dt>
                <dd>${renderDetailFieldInput(field, value, sectionKey)}</dd>
              </div>
            `;
            }

            // 閲覧モード
            const displayValue = field.displayFormatter ? field.displayFormatter(value) : formatDisplayValue(value);
            const inner =
              field.link && value
                ? `<a href="${value}" target="_blank" rel="noreferrer">${escapeHtml(value)}</a>`
                : escapeHtml(displayValue);

            return `
            <div class="detail-grid-item ${spanClass}">
              <dt>${field.label}</dt>
              <dd>
                <div class="group relative cursor-pointer hover:bg-slate-100 -mx-2 px-2 py-1 rounded transition-colors" data-section-edit="${sectionKey}" title="クリックして編集">
                  <span class="detail-value">${inner}</span>
                  <span class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 opacity-0 group-hover:opacity-100 text-xs">✎</span>
                </div>
              </dd>
            </div>
          `;
          })
        .join("")
  }
    </dl >
    `;
}

function renderDetailFieldInput(field, value, sectionKey) {
  const dataset = field.path ? `data - detail - field="${field.path}" data - detail - section="${sectionKey}"` : "";
  const valueType = field.valueType ? ` data - value - type="${field.valueType}"` : "";
  if (field.input === "textarea") {
    return `< textarea class="detail-inline-input detail-inline-textarea" ${ dataset }${ valueType }> ${ escapeHtml(value || "") }</textarea > `;
  }
  if (field.input === "select") {
    return `
    < select class="detail-inline-input" ${ dataset }${ valueType }>
      ${
        (field.options || [])
        .map((option) => {
          const isObject = option && typeof option === "object";
          const optValue = isObject ? option.value : option;
          const optLabel = isObject ? option.label : option;
          const isSelected = isObject && "selected" in option
            ? option.selected
            : String(optValue ?? "") === String(value ?? "");
          return `<option value="${escapeHtmlAttr(optValue ?? "")}" ${isSelected ? "selected" : ""}>${escapeHtml(optLabel ?? "")}</option>`;
        })
        .join("")
  }
      </select >
    `;
  }
  if (field.input === "checkbox") {
    return `
    < label class="meeting-check" >
      <input type="checkbox" ${value ? "checked" : ""} ${dataset} ${valueType || 'data-value-type="boolean"'}>
        <span>${field.checkboxLabel || "済"}</span>
      </label>
  `;
  }
  const type = field.type === "datetime" ? "datetime-local" : field.type || "text";
  return `< input type = "${type}" class="detail-inline-input" value = "${escapeHtmlAttr(formatInputValue(value, type))}" ${ dataset }${ valueType }> `;
}

function renderTableInput(value, path, type = "text", sectionKey, valueType, listId) {
  const dataset = path ? `data - detail - field="${path}" data - detail - section="${sectionKey}"` : "";
  const valueTypeAttr = valueType ? ` data - value - type="${valueType}"` : "";
  const listAttr = listId ? ` list = "${listId}"` : "";
  const inputType = type === "datetime" ? "datetime-local" : type;
  const inputValue = value === 0 ? "0" : formatInputValue(value, inputType);
  return `< input type = "${inputType}" class="detail-table-input" value = "${escapeHtmlAttr(inputValue)}" ${ dataset }${ valueTypeAttr }${ listAttr }> `;
}

function renderTableTextarea(value, path, sectionKey) {
  const dataset = path ? `data - detail - field="${path}" data - detail - section="${sectionKey}"` : "";
  return `< textarea class="detail-table-input" ${ dataset }> ${ escapeHtml(value || "") }</textarea > `;
}

function renderTableSelect(options, path, sectionKey, valueType) {
  const dataset = path ? `data - detail - field="${path}" data - detail - section="${sectionKey}"` : "";
  const valueTypeAttr = valueType ? ` data - value - type="${valueType}"` : "";
  const selectedValue = (options || []).find((option) => option && typeof option === "object" && option.selected)?.value;
  const html = (options || [])
    .map((option) => {
      const isObject = option && typeof option === "object";
      const optValue = isObject ? option.value : option;
      const optLabel = isObject ? option.label : option;
      const isSelected = isObject && "selected" in option
        ? option.selected
        : String(optValue ?? "") === String(selectedValue ?? "");
      return `< option value = "${escapeHtmlAttr(optValue ?? "")}" ${ isSelected ? "selected" : "" }> ${ escapeHtml(optLabel ?? "") }</option > `;
    })
    .join("");
  return `< select class="detail-table-input" ${ dataset }${ valueTypeAttr }> ${ html }</select > `;
}

function formatInputValue(value, type) {
  if (!value) return "";
  if (type === "date") return String(value).slice(0, 10);
  if (type === "datetime-local" || type === "datetime") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${ y } -${ m } -${ day }T${ hh }:${ mm } `;
  }
  return value;
}

// Utility functions for escaping HTML
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
