// Candidates Page JavaScript Module (RDS integrated / full)

// =========================
// API設定（必要なら変更）
// =========================
const CANDIDATES_API_BASE = "";
// 例: "https://xxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/dev"
// 同一オリジンで /api が通るなら "" のままでOK

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
  "registration",
  "meeting",
  "applicant",
  "hearing",
  "selection",
  "afterAcceptance",
  "refund",
  "nextAction",
  "cs",
  "memo",
];

const employmentStatusOptions = ["未回答", "就業中", "離職中"];

const phaseOptions = ["初回面談設定", "一次面接調整", "内定承諾待ち", "入社準備", "クローズ"];

const detailEditState = detailSectionKeys.reduce((state, key) => {
  state[key] = false;
  return state;
}, {});

const detailTemplateState = { hearing: false };

const hearingTemplates = [
  {
    id: "initial-call",
    name: "初回ヒアリング",
    content: `転居:
希望エリア:
転職時期:
希望職種:
初回面談メモ:
現年収:
希望年収:
転職理由:
面接希望日:
他社選考状況:`,
  },
  {
    id: "recommendation",
    name: "推薦用メモ",
    content: `候補者概要:
志望動機:
懸念点:
補足:`,
  },
];

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
  candidate.meetingPlans = Array.isArray(candidate.meetingPlans) ? candidate.meetingPlans : [];
  candidate.resumeDocuments = Array.isArray(candidate.resumeDocuments) ? candidate.resumeDocuments : [];
  candidate.selectionProgress = Array.isArray(candidate.selectionProgress) ? candidate.selectionProgress : [];
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
      ? candidatesApi(`/api/candidates?${queryString}`)
      : candidatesApi(`/api/candidates`);

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
        <td colspan="22" class="text-center text-slate-500 py-6">条件に一致する候補者が見つかりません。</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = list.map((candidate) => buildTableRow(candidate)).join("");
  highlightSelectedRow();
}

function buildTableRow(candidate) {
  const age = candidate.age ?? calculateAge(candidate.birthday);
  return `
    <tr class="candidate-item" data-id="${escapeHtmlAttr(String(candidate.id))}">
      ${renderCheckboxCell(candidate, "validApplication", "有効応募")}
      ${renderCheckboxCell(candidate, "phoneConnected", "通電")}
      ${renderCheckboxCell(candidate, "smsSent", "SMS送信")}
      ${renderTextCell(candidate, "advisorName")}
      ${renderTextCell(candidate, "callerName")}
      ${renderTextCell(candidate, "phase", {
    allowHTML: true,
    format: (value) => `<span class="candidate-phase-pill">${escapeHtml(value || "-")}</span>`,
  })}
      ${renderTextCell(candidate, "registeredAt", {
    format: (value, row) => formatDateTimeJP(value || row.registeredDate),
  })}
      ${renderTextCell(candidate, "source")}
      ${renderTextCell(candidate, "companyName")}
      ${renderTextCell(candidate, "jobName")}
      ${renderTextCell(candidate, "candidateName", { strong: true })}
      ${renderTextCell(candidate, "phone")}
      ${renderTextCell(candidate, "birthday", { type: "date", format: formatDateJP })}
      <td>${age ? `${age}歳` : "-"}</td>
      ${renderTextCell(candidate, "memo", { input: "textarea" })}
      ${renderTextCell(candidate, "firstContactPlannedAt", { type: "date", format: formatDateJP })}
      ${renderTextCell(candidate, "firstContactAt", { type: "date", format: formatDateJP })}
      ${renderCheckboxCell(candidate, "attendanceConfirmed", "着座確認")}
      ${renderTextCell(candidate, "email")}
      ${renderTextCell(candidate, "callDate", { type: "date", format: formatDateJP })}
      ${renderTextCell(candidate, "scheduleConfirmedAt", { type: "date", format: formatDateJP })}
      ${renderTextCell(candidate, "resumeStatus")}
    </tr>
  `;
}

function renderCheckboxCell(candidate, field, label) {
  const checked = Boolean(candidate[field]);
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
  const url = candidatesApi(`/api/candidates/${encodeURIComponent(String(id))}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Candidate detail HTTP ${res.status}`);
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

  const detail = await fetchCandidateDetailById(idStr);

  // 一覧にも反映（あれば更新、無ければ詳細モーダルだけでも表示できる）
  applyCandidateUpdate(detail, { preserveDetailState: true });

  // 明示的に描画（applyCandidateUpdate 内でも描画されるが、安全に二重でOK）
  renderCandidateDetail(detail, { preserveEditState: false });
  openCandidateModal();
  highlightSelectedRow();
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
    resetTemplatePanelState();
  }
  currentDetailCandidateId = String(candidate.id);

  const header = `
    <div class="candidate-detail-header">
      <div>
        <span class="candidate-phase-pill">${escapeHtml(candidate.phase || "-")}</span>
        <h3>${escapeHtml(candidate.candidateName || "-")}</h3>
        <p>${escapeHtml(candidate.companyName || "-")} / ${escapeHtml(candidate.jobName || "-")}</p>
        <p class="candidate-contact-row">
          <span>${escapeHtml(candidate.phone || "-")}</span>
          <span>${escapeHtml(candidate.email || "-")}</span>
        </p>
      </div>
      <div class="candidate-detail-header-meta">
        <div><strong>担当</strong><span>${escapeHtml(candidate.advisorName || "-")}</span></div>
        <div><strong>登録日時</strong><span>${formatDateTimeJP(candidate.registeredAt || candidate.registeredDate)}</span></div>
        <div><strong>次回アクション</strong><span>${formatDateJP(candidate.actionInfo?.nextActionDate)}</span></div>
      </div>
    </div>
  `;

  const sections = [
    renderDetailSection("登録情報", renderRegistrationSection(candidate), "registration"),
    renderDetailSection("面談", renderMeetingSection(candidate), "meeting"),
    renderDetailSection("求職者情報", renderApplicantInfoSection(candidate), "applicant"),
    renderDetailSection("ヒアリング事項", renderHearingSection(candidate), "hearing"),
    renderDetailSection("選考進捗", renderSelectionProgressSection(candidate), "selection"),
    renderDetailSection("入社承諾後", renderAfterAcceptanceSection(candidate), "afterAcceptance"),
    renderDetailSection("返金・減額【自動入力】", renderRefundSection(candidate), "refund"),
    renderDetailSection("次回アクション日【対応可否】", renderNextActionSection(candidate), "nextAction"),
    renderDetailSection("CS項目", renderCsSection(candidate), "cs"),
    renderDetailSection("自由メモ記入欄", renderMemoSection(candidate), "memo"),
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
      <p class="text-xs text-slate-400">面談予定・書類リンク・選考進捗・CS項目などをまとめて確認できます。</p>
    </div>
  `;
}

function setCandidateDetailPlaceholder() {
  const container = document.getElementById("candidateDetailContent");
  if (container) container.innerHTML = getCandidateDetailPlaceholder();
  currentDetailCandidateId = null;
  resetDetailEditState();
  resetTemplatePanelState();
}

function renderDetailSection(title, body, key) {
  const editing = detailEditState[key];
  const templateToggle = key === "hearing" ? renderTemplateToggleButton(detailTemplateState.hearing) : "";
  return `
    <section class="candidate-detail-section" data-section="${key}">
      <header class="candidate-detail-section-header">
        <h4>${title}</h4>
        <div class="detail-section-actions">
          ${templateToggle}
          <button type="button" class="detail-edit-btn ${editing ? "is-active" : ""}" data-section-edit="${key}">
            ${editing ? "編集完了" : "編集"}
          </button>
        </div>
      </header>
      <div class="candidate-detail-section-body">
        ${body}
      </div>
    </section>
  `;
}

function renderTemplateToggleButton(isOpen) {
  return `
    <button type="button" class="detail-template-btn ${isOpen ? "is-active" : ""}" data-template-toggle="hearing">
      テンプレート${isOpen ? "を隠す" : "表示"}
    </button>
  `;
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

  const response = await fetch(candidatesApi(`/api/candidates/${encodeURIComponent(String(candidate.id))}`), {
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
function resetTemplatePanelState() {
  Object.keys(detailTemplateState).forEach((key) => (detailTemplateState[key] = false));
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
  const templateToggle = event.target.closest("[data-template-toggle]");
  if (templateToggle) {
    handleTemplateToggle(templateToggle.dataset.templateToggle);
    return;
  }

  const templateButton = event.target.closest("[data-template-id]");
  if (templateButton) {
    handleTemplateSelection(
      templateButton.dataset.templateId,
      templateButton.closest("[data-template-panel]")?.dataset.templatePanel
    );
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

function handleTemplateToggle(sectionKey) {
  if (!sectionKey || !(sectionKey in detailTemplateState)) return;
  detailTemplateState[sectionKey] = !detailTemplateState[sectionKey];
  const candidate = getSelectedCandidate();
  if (candidate) renderCandidateDetail(candidate, { preserveEditState: true });
}

function handleTemplateSelection(templateId, sectionKey) {
  if (!templateId || !sectionKey) return;
  if (sectionKey === "hearing") applyHearingTemplate(templateId);
}

function applyHearingTemplate(templateId) {
  if (!detailEditState.hearing) return;
  const template = hearingTemplates.find((item) => item.id === templateId);
  if (!template) return;

  const candidate = getSelectedCandidate();
  if (!candidate) return;

  candidate.hearing = candidate.hearing || {};

  const textarea = document.getElementById("hearingMemoTextarea");
  if (textarea) {
    textarea.value = template.content;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  } else {
    candidate.hearing.memo = template.content;
    renderCandidateDetail(candidate, { preserveEditState: true });
  }
}
// ====== /Detail Content Handlers ======
