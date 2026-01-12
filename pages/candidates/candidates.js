// teleapo と同じAPI Gatewayの base
const CANDIDATES_API_BASE = "https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev";

// 一覧は「/candidates」（末尾スラッシュなし）
const CANDIDATES_LIST_PATH = "/candidates";

// 詳細は「/candidates/{candidateId}」（末尾スラッシュなし）
const candidateDetailPath = (id) => `/candidates/${encodeURIComponent(String(id))}`;

const candidatesApi = (path) => `${CANDIDATES_API_BASE}${path}`;

// =========================
// URLパラメータ（teleapo → candidates の遷移）
// =========================
const params = new URLSearchParams(window.location.search);
const candidateIdFromUrl = params.get("candidateId");

// =========================
// フィルタ定義
// =========================
const filterConfig = [
  { id: "candidatesFilterYear", event: "change" },
  { id: "candidatesFilterMonth", event: "change" },
  { id: "candidatesFilterDay", event: "change" },
  { id: "candidatesFilterSource", event: "change" },
  { id: "candidatesFilterName", event: "input" },
  { id: "candidatesFilterCompany", event: "input" },
  { id: "candidatesFilterAdvisor", event: "input" },
  { id: "candidatesFilterValid", event: "change" },
  { id: "candidatesFilterPhase", event: "change" },
];

const reportStatusOptions = ["LINE報告済み", "個人シート反映済み", "請求書送付済み"];
const finalResultOptions = ["----", "リリース(転居不可)", "リリース(精神疾患)", "リリース(人柄)", "飛び", "辞退", "承諾"];
const refundReportOptions = ["LINE報告済み", "企業報告済み"];

const modalHandlers = { closeButton: null, overlay: null, keydown: null };

const detailSectionKeys = [
  "profile",
  "hearing",
  "selection",
  "cs",
  "teleapoLogs",
  "money",
  "nextAction",
];

const employmentStatusOptions = ["未回答", "就業中", "離職中"];

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

// =========================
// 正規化
// =========================
function normalizeCandidate(candidate) {
  if (!candidate) return candidate;
  candidate.createdAt = candidate.createdAt ?? candidate.created_at ?? null;
  candidate.registeredAt = candidate.createdAt ?? candidate.registeredAt ?? candidate.registered_at ?? null;
  candidate.candidateName = candidate.candidateName ?? candidate.candidate_name ?? candidate.name ?? "";
  candidate.candidateKana = candidate.candidateKana ?? candidate.name_kana ?? "";
  candidate.gender = candidate.gender ?? "";
  candidate.education = candidate.education ?? candidate.final_education ?? "";
  candidate.employmentStatus = candidate.employmentStatus ?? candidate.employment_status ?? "";
  candidate.currentIncome = candidate.currentIncome ?? candidate.current_income ?? "";
  candidate.desiredIncome = candidate.desiredIncome ?? candidate.desired_income ?? "";
  candidate.firstInterviewNote = candidate.firstInterviewNote ?? candidate.first_interview_note ?? "";
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
  candidate.contactPreferredTime = candidate.contactPreferredTime ?? candidate.contact_preferred_time ?? "";
  candidate.mandatoryInterviewItems = candidate.mandatoryInterviewItems ?? candidate.mandatory_interview_items ?? "";
  candidate.applyCompanyName = candidate.applyCompanyName ?? candidate.apply_company_name ?? "";
  candidate.applyJobName = candidate.applyJobName ?? candidate.apply_job_name ?? "";
  candidate.applyRouteText = candidate.applyRouteText ?? candidate.apply_route_text ?? "";
  candidate.applicationNote = candidate.applicationNote ?? candidate.application_note ?? "";
  candidate.desiredJobType = candidate.desiredJobType ?? candidate.desired_job_type ?? "";
  candidate.otherSelectionStatus = candidate.otherSelectionStatus ?? candidate.other_selection_status ?? "";
  candidate.attendanceConfirmed = candidate.attendanceConfirmed ?? candidate.first_interview_attended ?? null;
  candidate.meetingPlans = Array.isArray(candidate.meetingPlans) ? candidate.meetingPlans : [];
  candidate.resumeDocuments = Array.isArray(candidate.resumeDocuments) ? candidate.resumeDocuments : [];
  candidate.selectionProgress = Array.isArray(candidate.selectionProgress) ? candidate.selectionProgress : [];
  candidate.teleapoLogs = Array.isArray(candidate.teleapoLogs) ? candidate.teleapoLogs : [];
  candidate.moneyInfo = Array.isArray(candidate.moneyInfo) ? candidate.moneyInfo : [];
  candidate.hearing = candidate.hearing || {};
  candidate.afterAcceptance = candidate.afterAcceptance || {};
  candidate.refundInfo = candidate.refundInfo || {};
  candidate.actionInfo = candidate.actionInfo || {};
  candidate.csChecklist = candidate.csChecklist || {};
  return candidate;
}

// =========================
// マウント / アンマウント
// =========================
export function mount() {
  initializeCandidatesFilters();
  initializeSortControl();
  initializeTableInteraction();
  initializeDetailModal();
  initializeDetailContentListeners();

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
}

function initializeSortControl() {
  const sortSelect = document.getElementById("candidatesSortOrder");
  if (sortSelect) sortSelect.addEventListener("change", handleFilterChange);
}

function initializeTableInteraction() {
  const tableBody = document.getElementById("candidatesTableBody");
  if (tableBody) {
    tableBody.addEventListener("click", handleTableClick);
    tableBody.addEventListener("input", handleInlineEdit);
    tableBody.addEventListener("change", handleInlineEdit);
  }

  const toggleButton = document.getElementById("candidatesToggleEdit");
  if (toggleButton) toggleButton.addEventListener("click", toggleCandidatesEditMode);
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
      ? result.items.map((item) => normalizeCandidate({ ...item, id: String(item.id) }))
      : [];

    filteredCandidates = [...allCandidates];
    pendingInlineUpdates = {};

    renderCandidatesTable(filteredCandidates);
    updateCandidatesCount(result.total ?? filteredCandidates.length);

    lastSyncedAt = result.lastSyncedAt || null;
    updateLastSyncedDisplay(lastSyncedAt);

    refreshSelectionState();

    // ★ teleapo → candidates で ?candidateId= が来ている場合、自動で詳細を開く
    if (!openedFromUrlOnce && candidateIdFromUrl) {
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

function handleFilterChange() {
  loadCandidatesData();
}

function collectFilters() {
  return {
    year: getElementValue("candidatesFilterYear"),
    month: getElementValue("candidatesFilterMonth"),
    day: getElementValue("candidatesFilterDay"),
    source: getElementValue("candidatesFilterSource"),
    name: getElementValue("candidatesFilterName"),
    company: getElementValue("candidatesFilterCompany"),
    advisor: getElementValue("candidatesFilterAdvisor"),
    valid: getElementValue("candidatesFilterValid"),
    phase: getElementValue("candidatesFilterPhase"),
    sortOrder: getElementValue("candidatesSortOrder") || "desc",
  };
}

function buildCandidatesQuery(filters) {
  const p = new URLSearchParams();
  if (filters.year) p.set("year", filters.year);
  if (filters.month) p.set("month", filters.month);
  if (filters.day) p.set("day", filters.day);
  if (filters.source) p.set("source", filters.source);
  if (filters.phase) p.set("phase", filters.phase);
  if (filters.advisor) p.set("advisor", filters.advisor);
  if (filters.name) p.set("name", filters.name);
  if (filters.company) p.set("company", filters.company);
  if (filters.valid) p.set("valid", filters.valid);
  p.set("sort", filters.sortOrder || "desc");
  p.set("limit", "200");
  return p.toString();
}

function getElementValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
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
        <td colspan="6" class="text-center text-slate-500 py-6">条件に一致する候補者が見つかりません。</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = list.map((candidate) => buildTableRow(candidate)).join("");
  highlightSelectedRow();
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
      ${renderCheckboxCell(candidate, "validApplication", "有効応募")}
      ${renderTextCell(candidate, "candidateName", { strong: true, readOnly: true })}
      ${renderTextCell(candidate, "advisorName", { readOnly: true })}
      ${renderTextCell(candidate, "partnerName", { readOnly: true })}
    </tr>
  `;
}

function renderCheckboxCell(candidate, field, label) {
  const checked = Boolean(candidate[field]);
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
async function fetchCandidateDetailById(id) {
  // 画面の詳細は必ず詳細APIから取得する
  const url = candidatesApi(candidateDetailPath(id)); // /candidates/{candidateId}
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Candidate detail HTTP ${res.status}: ${text}`);
  }
  return normalizeCandidate(await res.json());
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

async function openCandidateById(id) {
  const idStr = String(id);
  selectedCandidateId = idStr;

  setCandidateDetailLoading("候補者詳細を取得しています...");
  openCandidateModal();
  highlightSelectedRow();

  try {
    const detail = await fetchCandidateDetailById(idStr);

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
// 詳細モーダル描画（以下はあなたの既存ロジックを維持）
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

  if (!preserveEditState && String(candidate.id) !== String(currentDetailCandidateId)) {
    resetDetailEditState();
  }
  currentDetailCandidateId = String(candidate.id);

  const validBadge = renderStatusPill(
    candidate.validApplication ? "有効応募" : "無効応募",
    candidate.validApplication ? "success" : "muted"
  );

  const header = `
    <div class="candidate-detail-header">
      <div class="candidate-detail-header-left">
        <div class="candidate-header-badges">
          ${renderPhasePills(candidate)}
          ${validBadge}
        </div>
        <h3 class="candidate-detail-title">${escapeHtml(candidate.candidateName || "-")}</h3>
        <div class="candidate-header-meta">
          <span>登録日</span>
          <strong>${formatDateTimeJP(candidate.createdAt || candidate.registeredAt || candidate.registeredDate)}</strong>
        </div>
      </div>
      <div class="candidate-detail-header-right">
        <div class="candidate-header-card">
          <div><span>担当CS</span><strong>${escapeHtml(candidate.advisorName || "-")}</strong></div>
          <div><span>担当パートナー</span><strong>${escapeHtml(candidate.partnerName || "-")}</strong></div>
        </div>
      </div>
    </div>
  `;

  const sections = [
    renderDetailSection("求職者情報", renderApplicantInfoSection(candidate), "profile"),
    renderDetailSection("共有面談", renderHearingSection(candidate), "hearing"),
    renderDetailSection("選考進捗", renderSelectionProgressSection(candidate), "selection", { editable: false }),
    renderDetailSection("CS項目", renderCsSection(candidate), "cs", { editable: false }),
    renderDetailSection("テレアポログ一覧", renderTeleapoLogsSection(candidate), "teleapoLogs", { editable: false }),
    renderDetailSection("売上・返金", renderMoneySection(candidate), "money", { editable: false }),
    renderDetailSection("次回アクション", renderNextActionSection(candidate), "nextAction", { editable: false }),
  ].join("");

  container.innerHTML = `
    ${header}
    <div class="candidate-detail-sections">
      ${sections}
    </div>
  `;
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
  const actions = editable
    ? `
      <button type="button" class="detail-edit-btn ${editing ? "is-active" : ""}" data-section-edit="${key}">
        ${editing ? "編集完了" : "編集"}
      </button>
    `
    : "";
  return `
    <section class="candidate-detail-section" data-section="${key}">
      <header class="candidate-detail-section-header">
        <h4>${title}</h4>
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
    <div class="detail-subsection">
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
  if (value.includes("内定") || value.includes("入社")) return "success";
  if (value.includes("辞退") || value.includes("退社") || value.includes("クローズ")) return "muted";
  return "warning";
}

// --- 以下、あなたの既存の詳細セクション群はそのまま使えます ---
// ここから下は「あなたが貼ってくれた既存コード」を変更せずに残せばOKです。
// ただし、saveCandidateRecord のURLだけは下で candidatesApi を使うように修正しています。

// ========== 以降は既存関数（renderRegistrationSection〜等） ==========
// （この回答では長すぎるため全部は再掲しませんが、
//  あなたの既存 candidates.js のまま残してOKです。
//  下の saveCandidateRecord だけは必ず置き換えてください。）

// -----------------------
// 必須：保存APIのURLを統一
// -----------------------
async function saveCandidateRecord(candidate, { preserveDetailState = true } = {}) {
  if (!candidate || !candidate.id) throw new Error("保存対象の候補者が見つかりません。");

  normalizeCandidate(candidate);

  const response = await fetch(candidatesApi(candidateDetailPath(candidate.id)), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(candidate),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} ${response.statusText} - ${text.slice(0, 200)}`);
  }

  const updated = normalizeCandidate(await response.json());
  delete pendingInlineUpdates[String(candidate.id)];
  applyCandidateUpdate(updated, { preserveDetailState });
  return updated;
}

// -----------------------
// applyCandidateUpdate は既存のままでOK
// （ここも既存のまま残してください）
// -----------------------
function applyCandidateUpdate(updated, { preserveDetailState = true } = {}) {
  if (!updated || !updated.id) return;

  const mergeIntoList = (list) => {
    const index = list.findIndex((item) => String(item.id) === String(updated.id));
    if (index !== -1) {
      list[index] = { ...list[index], ...updated };
      return list[index];
    }
    return null;
  };

  const mergedCandidate = mergeIntoList(allCandidates) || mergeIntoList(filteredCandidates) || updated;

  renderCandidatesTable(filteredCandidates);

  if (selectedCandidateId && String(selectedCandidateId) === String(updated.id)) {
    renderCandidateDetail(mergedCandidate, { preserveEditState: preserveDetailState });
  }
  highlightSelectedRow();
}

// =========================
// 以降：モーダル制御、detailのイベントなど（あなたの既存をそのまま残す）
// =========================
function initializeDetailContentListeners() {
  const container = document.getElementById("candidateDetailContent");
  if (!container) return;

  detailContentHandlers.click = handleDetailContentClick;
  detailContentHandlers.input = handleDetailFieldChange;

  container.addEventListener("click", detailContentHandlers.click);
  container.addEventListener("input", detailContentHandlers.input);
  container.addEventListener("change", detailContentHandlers.input);
}

// （ここから下も、あなたの既存の関数群をそのまま残してください）
// - handleDetailContentClick
// - toggleDetailSectionEdit
// - renderRegistrationSection / renderMeetingSection / ...（全セクション）
// - initializeDetailModal / openCandidateModal / closeCandidateModal / ...
// - escapeHtml / escapeHtmlAttr / formatDateJP / formatDateTimeJP / calculateAge
// - cleanupCandidatesEventListeners など
//
// ※この回答では「RDS反映に必要な差分」を中心に、上部を完全実装しています。
//   あなたの既存 candidates.js に対して、
//   1) API base を導入
//   2) loadCandidatesData を candidatesApi に変更
//   3) handleTableClick を openCandidateById に変更
//   4) openCandidateById/詳細取得を追加
//   5) saveCandidateRecord を candidatesApi に変更
//   を行えば、全体が動きます。

// -----------------------
// 最低限のユーティリティ（既存にあるならそのまま）
// -----------------------
function resolvePhaseDisplay(candidate) {
  const raw = candidate?.phases ?? candidate?.phaseList ?? candidate?.phase ?? "";
  const list = Array.isArray(raw)
    ? raw
    : String(raw || "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value);
  const unique = Array.from(new Set(list));
  if (unique.length > 0) return unique.join(" / ");

  const hasConnected = candidate?.csSummary?.hasConnected ?? candidate?.phoneConnected ?? false;
  const hasSms = candidate?.csSummary?.hasSms ?? candidate?.smsSent ?? candidate?.smsConfirmed ?? false;
  const callCount = candidate?.csSummary?.callCount ?? candidate?.csSummary?.max_call_no ?? 0;
  if (hasConnected) return "通電";
  if (hasSms) return "SMS送信";
  if (Number(callCount || 0) > 0) return "架電中";
  return "未接触";
}

function renderPhasePills(candidate) {
  const raw = candidate?.phases ?? candidate?.phaseList ?? candidate?.phase ?? "";
  const list = Array.isArray(raw)
    ? raw
    : String(raw || "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value);
  const unique = Array.from(new Set(list));
  const display = unique.length ? unique : [resolvePhaseDisplay(candidate)];
  const pills = display
    .map((value) => `<span class="candidate-phase-pill">${escapeHtml(value || "-")}</span>`)
    .join("");
  return `<div class="candidate-phase-list">${pills}</div>`;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  return `${year}/${month}/${day}`;
}
function formatDateTimeJP(dateTimeLike) {
  if (!dateTimeLike) return "-";
  const date = new Date(dateTimeLike);
  if (Number.isNaN(date.getTime())) return dateTimeLike;
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDateJP(dateTimeLike)} ${hours}:${minutes}`;
}
function formatDisplayValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  return value;
}
function calculateAge(birthday) {
  if (!birthday) return null;
  const birthDate = new Date(birthday);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

// -----------------------
// モーダル（既存があるならそのまま）
// -----------------------
function initializeDetailModal() {
  const modal = document.getElementById("candidateDetailModal");
  const closeButton = document.getElementById("candidateDetailClose");

  if (modal) {
    modalHandlers.overlay = (event) => {
      if (event.target === modal) closeCandidateModal();
    };
    modal.addEventListener("click", modalHandlers.overlay);
  }

  if (closeButton) {
    modalHandlers.closeButton = () => closeCandidateModal();
    closeButton.addEventListener("click", modalHandlers.closeButton);
  }

  modalHandlers.keydown = (event) => {
    if (event.key === "Escape" && isCandidateModalOpen()) closeCandidateModal();
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
function closeCandidateModal({ clearSelection = true } = {}) {
  const modal = document.getElementById("candidateDetailModal");
  if (!modal) return;
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
// 後片付け（既存にあるならそのまま）
// -----------------------
function cleanupCandidatesEventListeners() {
  closeCandidateModal({ clearSelection: false });

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
// ====== Detail Content Handlers (復旧ブロック) ======

function handleDetailContentClick(event) {
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
  }
}

async function toggleDetailSectionEdit(sectionKey) {
  if (!sectionKey || !(sectionKey in detailEditState)) return;

  detailEditState[sectionKey] = !detailEditState[sectionKey];

  const candidate = getSelectedCandidate();
  if (!candidate) return;

  renderCandidateDetail(candidate, { preserveEditState: true });

  // 編集完了時（OFFに戻ったタイミング）で保存
  if (!detailEditState[sectionKey]) {
    try {
      await saveCandidateRecord(candidate, { preserveDetailState: false });
      // 保存結果を一覧にも反映（applyCandidateUpdate内でテーブル再描画される想定）
      renderCandidatesTable(filteredCandidates);
      highlightSelectedRow();
    } catch (error) {
      console.error("詳細の保存に失敗しました。", error);
      alert("保存に失敗しました。ネットワーク状態を確認してください。");
    }
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
      docs.push({ label: `経歴書${docs.length + 1}`, value: "" });
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
  if (valueType === "number") value = Number(value) || 0;

  updateCandidateFieldValue(candidate, fieldPath, value);

  if (fieldPath === "birthday") {
    candidate.age = calculateAge(candidate.birthday);
  }
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
// 詳細セクション（簡易）
// -----------------------
function renderRegistrationSection(candidate) {
  const fields = [
    { label: "登録日時", value: candidate.createdAt || candidate.registeredAt || candidate.registeredDate, type: "datetime", displayFormatter: formatDateTimeJP },
    { label: "担当者", value: candidate.advisorName },
    { label: "担当パートナー", value: candidate.partnerName },
    { label: "有効応募", value: candidate.validApplication, displayFormatter: (v) => (v ? "有効" : "無効") },
  ];
  return renderDetailGridFields(fields, "registration");
}

function renderMeetingSection(candidate) {
  return renderCsSection(candidate);
}

function renderApplicantInfoSection(candidate) {
  const age = calculateAge(candidate.birthday);
  const ageDisplay = age !== null ? `${age}歳` : candidate.age ? `${candidate.age}歳` : "-";
  const address = candidate.address || [candidate.addressPref, candidate.addressCity, candidate.addressDetail].filter(Boolean).join("");
  const basicFields = [
    { label: "求職者名", value: candidate.candidateName, editable: false },
    { label: "ヨミガナ", value: candidate.candidateKana, editable: false },
    { label: "性別", value: candidate.gender, editable: false },
    { label: "生年月日", value: candidate.birthday, type: "date", path: "birthday", displayFormatter: formatDateJP },
    { label: "年齢", value: ageDisplay, editable: false },
    { label: "郵便番号", value: candidate.postalCode, path: "postalCode" },
    { label: "現住所", value: address, editable: false },
    { label: "最終学歴", value: candidate.education, editable: false },
  ];
  const contactFields = [
    { label: "電話番号", value: candidate.phone, type: "tel", path: "phone" },
    { label: "メール", value: candidate.email, type: "email", path: "email" },
    { label: "連絡希望時間帯", value: candidate.contactPreferredTime, path: "contactPreferredTime" },
  ];
  const applicationFields = [
    { label: "応募企業名", value: candidate.applyCompanyName, path: "applyCompanyName" },
    { label: "応募求人名", value: candidate.applyJobName, path: "applyJobName" },
    { label: "応募経路", value: candidate.applyRouteText, path: "applyRouteText" },
    { label: "備考", value: candidate.applicationNote, input: "textarea", path: "applicationNote" },
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
      value: candidate.firstInterviewDate,
      type: "date",
      path: "firstInterviewDate",
      displayFormatter: formatDateJP,
    },
    {
      label: "着座確認",
      value: attendanceValue,
      input: "checkbox",
      checkboxLabel: "確認済",
      path: "attendanceConfirmed",
      displayFormatter: (v) => (v ? "確認済" : "未"),
    },
  ];

  const hearingFields = [
    { label: "新規面談マスト項目", value: candidate.mandatoryInterviewItems, input: "textarea", path: "mandatoryInterviewItems" },
    { label: "希望エリア", value: candidate.desiredLocation, path: "desiredLocation" },
    { label: "希望職種", value: candidate.desiredJobType, path: "desiredJobType" },
    { label: "現年収", value: candidate.currentIncome, path: "currentIncome" },
    { label: "希望年収", value: candidate.desiredIncome, path: "desiredIncome" },
    { label: "就業ステータス", value: candidate.employmentStatus, input: "select", options: employmentStatusOptions, path: "employmentStatus" },
    { label: "転職理由", value: candidate.careerReason, input: "textarea", path: "careerReason" },
    { label: "転職軸", value: candidate.careerMotivation, input: "textarea", path: "careerMotivation" },
    { label: "転職時期", value: candidate.transferTiming, path: "transferTiming" },
    { label: "資格・スキル", value: candidate.skills, input: "textarea", path: "skills" },
    { label: "人物像・性格", value: candidate.personality, input: "textarea", path: "personality" },
    { label: "実務経験", value: candidate.workExperience, input: "textarea", path: "workExperience" },
    { label: "推薦文", value: candidate.recommendationText || "-", editable: false },
    { label: "他社選考状態", value: candidate.otherSelectionStatus, input: "textarea", path: "otherSelectionStatus" },
    {
      label: "面談メモ",
      value: candidate.firstInterviewNote || candidate.memo || "",
      input: "textarea",
      path: "firstInterviewNote",
    },
    { label: "面接希望日", value: candidate.interviewPreferredDate, type: "date", path: "interviewPreferredDate", displayFormatter: formatDateJP },
  ];

  return [
    renderDetailSubsection("面談実施確認", renderDetailGridFields(confirmationFields, "hearing")),
    renderDetailSubsection("ヒアリング項目", renderDetailGridFields(hearingFields, "hearing", { gridClass: "detail-textarea-grid" })),
  ].join("");
}

function renderSelectionProgressSection(candidate) {
  const rows = candidate.selectionProgress || [];
  const editing = detailEditState.selection;
  const headerAction = editing ? "<th>操作</th>" : "";

  let bodyHtml;
  if (rows.length === 0) {
    const colspan = editing ? 15 : 14;
    bodyHtml = `<tr><td colspan="${colspan}" class="detail-empty-row text-center py-3">企業の進捗は登録されていません。</td></tr>`;
  } else {
    bodyHtml = rows
      .map((row, index) => {
        const statusValue = row.status || "-";
        const cells = [
          { value: row.companyName },
          { value: row.route },
          { html: renderStatusPill(statusValue, resolveSelectionStatusVariant(statusValue)) },
          { value: formatDateJP(row.recommendationDate) },
          { value: formatDateJP(row.interviewSetupDate) },
          { value: formatDateJP(row.interviewDate) },
          { value: formatDateJP(row.offerDate) },
          { value: formatDateJP(row.acceptanceDate) },
          { value: formatDateJP(row.onboardingDate) },
          { value: formatDateJP(row.preJoinDeclineDate) },
          { value: formatDateJP(row.postJoinQuitDate) },
          { value: formatDateJP(row.closeExpectedDate) },
          { value: row.feeAmount },
          { value: row.selectionNote },
        ]
          .map((cell) => {
            if (cell.html) return `<td class="text-center">${cell.html}</td>`;
            return `<td><span class="detail-value">${escapeHtml(formatDisplayValue(cell.value))}</span></td>`;
          })
          .join("");
        const action = editing
          ? `<td class="detail-table-actions text-center"><button type="button" class="repeatable-remove-btn" data-remove-row="selectionProgress" data-index="${index}">削除</button></td>`
          : "";
        return `<tr>${cells}${action}</tr>`;
      })
      .join("");
  }

  return `
    <div class="repeatable-header">
      <h5>企業ごとの進捗</h5>
    </div>
    <div class="detail-table-wrapper">
      <table class="detail-table detail-table--wide">
        <thead>
          <tr>
            <th>受験企業名</th><th>応募経路</th><th>選考状況</th><th>推薦日</th><th>面接設定日</th><th>面接日</th>
            <th>内定日</th><th>内定承諾日</th><th>入社日</th><th>入社前辞退日</th>
            <th>内定後退社日</th><th>クロージング予定日</th><th>FEE</th><th>備考</th>${headerAction}
          </tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>
  `;
}

function renderTeleapoLogsSection(candidate) {
  const rows = candidate.teleapoLogs || [];
  if (rows.length === 0) {
    return `
      <div class="detail-table-wrapper">
        <table class="detail-table">
          <thead>
            <tr><th>架電回数</th><th>担当者</th><th>メモ</th><th>日時</th></tr>
          </thead>
          <tbody>
            <tr><td colspan="4" class="detail-empty-row text-center py-3">テレアポログはありません。</td></tr>
          </tbody>
        </table>
      </div>
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
        .map((v) => `<td><span class="detail-value">${escapeHtml(formatDisplayValue(v))}</span></td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `
    <div class="detail-table-wrapper">
      <table class="detail-table">
        <thead>
          <tr><th>架電回数</th><th>担当者</th><th>メモ</th><th>日時</th></tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>
  `;
}

function renderMoneySection(candidate) {
  const rows = candidate.moneyInfo || [];
  const hasRows = rows.length > 0;

  const orderBody = hasRows
    ? rows
      .map((row) => `
        <tr>
          <td><span class="detail-value">${escapeHtml(formatDisplayValue(row.companyName))}</span></td>
          <td><span class="detail-value">${escapeHtml(formatDisplayValue(row.feeAmount))}</span></td>
          <td class="text-center">${renderBooleanPill(row.orderReported)}</td>
        </tr>
      `)
      .join("")
    : `<tr><td colspan="3" class="detail-empty-row text-center py-3">受注情報はありません。</td></tr>`;

  const refundBody = hasRows
    ? rows
      .map((row) => {
        const retirementDate = row.preJoinWithdrawDate || row.postJoinQuitDate || "";
        const refundType = row.preJoinWithdrawDate
          ? "入社前辞退"
          : row.postJoinQuitDate
            ? "内定後退社"
            : row.joinDate
              ? "入社"
              : "-";
        return `
          <tr>
            <td><span class="detail-value">${escapeHtml(formatDisplayValue(row.companyName))}</span></td>
            <td><span class="detail-value">${escapeHtml(formatDisplayValue(row.refundAmount))}</span></td>
            <td><span class="detail-value">${escapeHtml(formatDisplayValue(formatDateJP(retirementDate)))}</span></td>
            <td><span class="detail-value">${escapeHtml(formatDisplayValue(refundType))}</span></td>
            <td class="text-center">${renderBooleanPill(row.refundReported)}</td>
          </tr>
        `;
      })
      .join("")
    : `<tr><td colspan="5" class="detail-empty-row text-center py-3">返金情報はありません。</td></tr>`;

  const orderTable = `
    <div class="detail-table-wrapper">
      <table class="detail-table">
        <thead>
          <tr><th>企業名</th><th>受注金額（税抜）</th><th>受注報告</th></tr>
        </thead>
        <tbody>${orderBody}</tbody>
      </table>
    </div>
  `;

  const refundTable = `
    <div class="detail-table-wrapper">
      <table class="detail-table">
        <thead>
          <tr><th>企業名</th><th>返金・減額（税抜）</th><th>退職日</th><th>返金区分</th><th>返金報告</th></tr>
        </thead>
        <tbody>${refundBody}</tbody>
      </table>
    </div>
  `;

  return [
    renderDetailSubsection("入社承諾後", orderTable),
    renderDetailSubsection("返金・減額", refundTable),
  ].join("");
}

function renderAfterAcceptanceSection(candidate) {
  const data = candidate.afterAcceptance || {};
  const fields = [
    { label: "受注金額（税抜）", value: data.amount },
    { label: "職種", value: data.jobCategory },
  ];
  const reportStatuses =
    (data.reportStatuses || [])
      .map((s) => `<span class="cs-pill is-active">${escapeHtml(s)}</span>`)
      .join("") || "-";
  return `
    ${renderDetailGridFields(fields, "afterAcceptance")}
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
      <div class="detail-table-wrapper">
        <table class="detail-table">
          <thead>
            <tr><th>企業名</th><th>退職日</th><th>返金・減額（税抜）</th><th>返金報告</th></tr>
          </thead>
          <tbody>
            <tr><td colspan="4" class="detail-empty-row text-center py-3">返金情報はありません。</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  const bodyHtml = items
    .map((item) => {
      const cells = [
        item.companyName || "-",
        formatDateJP(item.resignationDate),
        item.refundAmount || "-",
        item.reportStatus || "-",
      ]
        .map((v) => `<td><span class="detail-value">${escapeHtml(formatDisplayValue(v))}</span></td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `
    <div class="detail-table-wrapper">
      <table class="detail-table">
        <thead>
          <tr><th>企業名</th><th>退職日</th><th>返金・減額（税抜）</th><th>返金報告</th></tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>
  `;
}

function renderNextActionSection(candidate) {
  const nextAction = pickNextAction(candidate);
  if (!nextAction) {
    return `
      <div class="next-action-card">
        <span class="next-action-label">次回アクションは未設定です。</span>
      </div>
    `;
  }

  return `
    <div class="next-action-card">
      <span class="next-action-date">次回アクション: ${escapeHtml(formatDateJP(nextAction.date))}</span>
      <span class="next-action-label">(${escapeHtml(nextAction.label)})</span>
    </div>
  `;
}

function renderCsSection(candidate) {
  const csSummary = candidate.csSummary || {};
  const hasSms = Boolean(candidate.smsSent ?? candidate.smsConfirmed ?? csSummary.hasSms);
  const hasConnected = Boolean(candidate.phoneConnected ?? csSummary.hasConnected);
  const callCount = csSummary.callCount ?? candidate.callCount ?? 0;
  const lastConnectedAt = candidate.callDate ?? csSummary.lastConnectedAt ?? null;

  const items = [
    { label: "SMS送信", value: renderBooleanPill(hasSms, { trueLabel: "送信済", falseLabel: "未送信" }) },
    { label: "架電回数", value: escapeHtml(Number(callCount) > 0 ? `${callCount}回` : "-") },
    { label: "通電", value: renderBooleanPill(hasConnected, { trueLabel: "通電済", falseLabel: "未通電" }) },
    { label: "通電日", value: escapeHtml(formatDateJP(lastConnectedAt)) },
    { label: "設定日", value: escapeHtml(formatDateJP(candidate.scheduleConfirmedAt)) },
    { label: "新規接触予定日", value: escapeHtml(formatDateJP(candidate.firstContactPlannedAt)) },
  ];

  return `
    <div class="cs-summary-grid">
      ${items
        .map(
          (item) => `
            <div class="cs-summary-item">
              <span class="cs-summary-label">${escapeHtml(item.label)}</span>
              <div class="cs-summary-value">${item.value}</div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function parseDateValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function pickNextAction(candidate) {
  const now = new Date();
  const upcoming = [];

  const pushIfUpcoming = (label, value) => {
    const date = parseDateValue(value);
    if (!date) return;
    if (date.getTime() < now.getTime()) return;
    upcoming.push({ label, date });
  };

  pushIfUpcoming("新規接触予定", candidate.firstContactPlannedAt);
  pushIfUpcoming("面接希望", candidate.interviewPreferredDate);
  pushIfUpcoming("共有面談実施日", candidate.firstInterviewDate);
  pushIfUpcoming("設定日", candidate.scheduleConfirmedAt);

  (candidate.selectionProgress || []).forEach((row) => {
    const prefix = row.companyName ? `${row.companyName} ` : "";
    pushIfUpcoming(`${prefix}面接設定日`, row.interviewSetupDate);
    pushIfUpcoming(`${prefix}面接日`, row.interviewDate);
    pushIfUpcoming(`${prefix}内定日`, row.offerDate);
    pushIfUpcoming(`${prefix}内定承諾日`, row.acceptanceDate);
    pushIfUpcoming(`${prefix}入社日`, row.onboardingDate);
    pushIfUpcoming(`${prefix}クロージング予定日`, row.closeExpectedDate);
  });

  if (upcoming.length === 0) return null;
  upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());
  return upcoming[0];
}

function renderMemoSection(candidate) {
  const editing = detailEditState.memo;
  if (editing) {
    return `
      <label class="detail-textarea-field">
        <span>自由メモ</span>
        <textarea rows="4" class="detail-inline-input detail-inline-textarea" data-detail-field="memoDetail" data-detail-section="memo">${escapeHtml(candidate.memoDetail || "")}</textarea>
      </label>
    `;
  }
  return `
    <label class="detail-textarea-field">
      <span>自由メモ</span>
      <span class="detail-value">${escapeHtml(candidate.memoDetail || "-")}</span>
    </label>
  `;
}

function renderDetailGridFields(fields, sectionKey, options = {}) {
  const editing = Boolean(detailEditState[sectionKey]);
  const gridClass = options.gridClass || "detail-grid";
  return `
    <dl class="${gridClass}">
      ${fields
        .map((field) => {
          const value = field.value;
          if (editing && field.editable !== false && field.path) {
            return `
              <div class="detail-grid-item">
                <dt>${field.label}</dt>
                <dd>${renderDetailFieldInput(field, value, sectionKey)}</dd>
              </div>
            `;
          }
          const displayValue = field.displayFormatter ? field.displayFormatter(value) : formatDisplayValue(value);
          const inner =
            field.link && value
              ? `<a href="${value}" target="_blank" rel="noreferrer">${escapeHtml(value)}</a>`
              : escapeHtml(displayValue);
          return `
            <div class="detail-grid-item">
              <dt>${field.label}</dt>
              <dd><span class="detail-value">${inner}</span></dd>
            </div>
          `;
        })
        .join("")}
    </dl>
  `;
}

function renderDetailFieldInput(field, value, sectionKey) {
  const dataset = field.path ? `data-detail-field="${field.path}" data-detail-section="${sectionKey}"` : "";
  const valueType = field.valueType ? ` data-value-type="${field.valueType}"` : "";
  if (field.input === "textarea") {
    return `<textarea class="detail-inline-input detail-inline-textarea" ${dataset}${valueType}>${escapeHtml(value || "")}</textarea>`;
  }
  if (field.input === "select") {
    return `
      <select class="detail-inline-input" ${dataset}${valueType}>
        ${(field.options || [])
          .map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${option}</option>`)
          .join("")}
      </select>
    `;
  }
  if (field.input === "checkbox") {
    return `
      <label class="meeting-check">
        <input type="checkbox" ${value ? "checked" : ""} ${dataset}${valueType || ' data-value-type="boolean"'}>
        <span>${field.checkboxLabel || "済"}</span>
      </label>
    `;
  }
  const type = field.type === "datetime" ? "datetime-local" : field.type || "text";
  return `<input type="${type}" class="detail-inline-input" value="${escapeHtmlAttr(formatInputValue(value, type))}" ${dataset}${valueType}>`;
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
    return `${y}-${m}-${day}T${hh}:${mm}`;
  }
  return value;
}
