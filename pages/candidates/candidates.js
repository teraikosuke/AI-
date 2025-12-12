// Candidates Page JavaScript Module
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

const reportStatusOptions = [
  "LINE報告済み",
  "個人シート反映済み",
  "請求書送付済み",
];
const finalResultOptions = [
  "----",
  "リリース(転居不可)",
  "リリース(精神疾患)",
  "リリース(人柄)",
  "飛び",
  "辞退",
  "承諾",
];
const refundReportOptions = ["LINE報告済み", "企業報告済み"];
const modalHandlers = {
  closeButton: null,
  overlay: null,
  keydown: null,
};
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
const phaseOptions = [
  "初回面談設定",
  "一次面接調整",
  "内定承諾待ち",
  "入社準備",
  "クローズ",
];
const detailEditState = detailSectionKeys.reduce((state, key) => {
  state[key] = false;
  return state;
}, {});
const detailTemplateState = {
  hearing: false,
};
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
const detailContentHandlers = {
  click: null,
  input: null,
};

let allCandidates = [];
let filteredCandidates = [];
let selectedCandidateId = null;
let candidatesEditMode = false;
let currentDetailCandidateId = null;
let lastSyncedAt = null;
let pendingInlineUpdates = {};

function normalizeCandidate(candidate) {
  if (!candidate) return candidate;
  candidate.meetingPlans = Array.isArray(candidate.meetingPlans)
    ? candidate.meetingPlans
    : [];
  candidate.resumeDocuments = Array.isArray(candidate.resumeDocuments)
    ? candidate.resumeDocuments
    : [];
  candidate.selectionProgress = Array.isArray(candidate.selectionProgress)
    ? candidate.selectionProgress
    : [];
  candidate.hearing = candidate.hearing || {};
  candidate.afterAcceptance = candidate.afterAcceptance || {};
  candidate.refundInfo = candidate.refundInfo || {};
  candidate.actionInfo = candidate.actionInfo || {};
  candidate.csChecklist = candidate.csChecklist || {};
  return candidate;
}

export function mount() {
  initializeCandidatesFilters();
  initializeSortControl();
  initializeTableInteraction();
  initializeDetailModal();
  initializeDetailContentListeners();
  loadCandidatesData();
}

export function unmount() {
  cleanupCandidatesEventListeners();
}

function initializeCandidatesFilters() {
  filterConfig.forEach(({ id, event }) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener(event, handleFilterChange);
    }
  });

  const resetButton = document.getElementById("candidatesFilterReset");
  if (resetButton) {
    resetButton.addEventListener("click", handleFilterReset);
  }
}

function initializeSortControl() {
  const sortSelect = document.getElementById("candidatesSortOrder");
  if (sortSelect) {
    sortSelect.addEventListener("change", handleFilterChange);
  }
}

function initializeTableInteraction() {
  const tableBody = document.getElementById("candidatesTableBody");
  if (tableBody) {
    tableBody.addEventListener("click", handleTableClick);
    tableBody.addEventListener("input", handleInlineEdit);
    tableBody.addEventListener("change", handleInlineEdit);
  }

  const toggleButton = document.getElementById("candidatesToggleEdit");
  if (toggleButton) {
    toggleButton.addEventListener("click", toggleCandidatesEditMode);
  }
}

async function loadCandidatesData(filtersOverride = {}) {
  const filters = { ...collectFilters(), ...filtersOverride };
  const queryString = buildCandidatesQuery(filters);

  try {
    const response = await fetch(
      queryString ? `/api/candidates?${queryString}` : "/api/candidates"
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const result = await response.json();
    allCandidates = Array.isArray(result.items)
      ? result.items.map((item) => normalizeCandidate({ ...item }))
      : [];
    filteredCandidates = [...allCandidates];
    pendingInlineUpdates = {};
    renderCandidatesTable(filteredCandidates);
    updateCandidatesCount(result.total ?? filteredCandidates.length);
    lastSyncedAt = result.lastSyncedAt || null;
    updateLastSyncedDisplay(lastSyncedAt);
    refreshSelectionState();
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
  const params = new URLSearchParams();
  if (filters.year) params.set("year", filters.year);
  if (filters.month) params.set("month", filters.month);
  if (filters.day) params.set("day", filters.day);
  if (filters.source) params.set("source", filters.source);
  if (filters.phase) params.set("phase", filters.phase);
  if (filters.advisor) params.set("advisor", filters.advisor);
  if (filters.name) params.set("name", filters.name);
  if (filters.company) params.set("company", filters.company);
  if (filters.valid) params.set("valid", filters.valid);
  params.set("sort", filters.sortOrder || "desc");
  params.set("limit", "200");
  return params.toString();
}

function getElementValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

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

  tableBody.innerHTML = list
    .map((candidate) => buildTableRow(candidate))
    .join("");
  highlightSelectedRow();
}

function buildTableRow(candidate) {
  const age = candidate.age ?? calculateAge(candidate.birthday);
  return `
    <tr class="candidate-item" data-id="${candidate.id}">
      ${renderCheckboxCell(candidate, "validApplication", "有効応募")}
      ${renderCheckboxCell(candidate, "phoneConnected", "通電")}
      ${renderCheckboxCell(candidate, "smsSent", "SMS送信")}
      ${renderTextCell(candidate, "advisorName")}
      ${renderTextCell(candidate, "callerName")}
      ${renderTextCell(candidate, "phase", {
        allowHTML: true,
        format: (value) =>
          `<span class="candidate-phase-pill">${escapeHtml(
            value || "-"
          )}</span>`,
      })}
      ${renderTextCell(candidate, "registeredAt", {
        format: (value, row) => formatDateTimeJP(value || row.registeredDate),
        allowHTML: false,
      })}
      ${renderTextCell(candidate, "source")}
      ${renderTextCell(candidate, "companyName")}
      ${renderTextCell(candidate, "jobName")}
      ${renderTextCell(candidate, "candidateName", { strong: true })}
      ${renderTextCell(candidate, "phone")}
      ${renderTextCell(candidate, "birthday", {
        type: "date",
        format: formatDateJP,
      })}
      <td>${age ? `${age}歳` : "-"}</td>
      ${renderTextCell(candidate, "memo", { input: "textarea" })}
      ${renderTextCell(candidate, "firstContactPlannedAt", {
        type: "date",
        format: formatDateJP,
      })}
      ${renderTextCell(candidate, "firstContactAt", {
        type: "date",
        format: formatDateJP,
      })}
      ${renderCheckboxCell(candidate, "attendanceConfirmed", "着座確認")}
      ${renderTextCell(candidate, "email")}
      ${renderTextCell(candidate, "callDate", {
        type: "date",
        format: formatDateJP,
      })}
      ${renderTextCell(candidate, "scheduleConfirmedAt", {
        type: "date",
        format: formatDateJP,
      })}
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
        <input type="checkbox" ${
          checked ? "checked" : ""
        } ${editable} ${dataAttr}>
        <span class="sr-only">${label}</span>
      </label>
    </td>
  `;
}

function renderTextCell(candidate, field, options = {}) {
  const raw = candidate[field] ?? "";
  if (!candidatesEditMode || options.readOnly) {
    const formatted = options.format
      ? options.format(raw, candidate)
      : formatDisplayValue(raw);
    const content = options.allowHTML ? formatted : escapeHtml(formatted);
    const wrapperStart = options.strong
      ? '<span class="font-semibold text-slate-900">'
      : "";
    const wrapperEnd = options.strong ? "</span>" : "";
    return `<td>${wrapperStart}${content}${wrapperEnd}</td>`;
  }

  if (options.input === "textarea") {
    return `<td><textarea class="table-inline-textarea" data-field="${field}">${escapeHtml(
      raw
    )}</textarea></td>`;
  }

  const type = options.type || "text";
  return `<td><input type="${type}" class="table-inline-input" data-field="${field}" value="${escapeHtmlAttr(
    raw
  )}"></td>`;
}

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
  const candidate = allCandidates.find(
    (item) => String(item.id) === row.dataset.id
  );
  if (!candidate) return;

  const field = control.dataset.field;
  if (control.type === "checkbox") {
    candidate[field] = control.checked;
  } else {
    candidate[field] = control.value;
  }
  markCandidateDirty(candidate.id);

  if (field === "birthday") {
    candidate.age = calculateAge(candidate.birthday);
  }
}

function markCandidateDirty(candidateId) {
  if (!candidateId) return;
  pendingInlineUpdates[String(candidateId)] = true;
}

async function persistInlineEdits() {
  const dirtyIds = Object.keys(pendingInlineUpdates);
  if (dirtyIds.length === 0) return;
  const failures = {};
  for (const id of dirtyIds) {
    const candidate = allCandidates.find((item) => String(item.id) === id);
    if (!candidate) continue;
    try {
      await saveCandidateRecord(candidate);
      delete pendingInlineUpdates[id];
    } catch (error) {
      console.error("候補者の保存に失敗しました。", error);
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

function updateCandidatesCount(count) {
  const element = document.getElementById("candidatesResultCount");
  if (element) {
    element.textContent = `${count}件`;
  }
}

function updateLastSyncedDisplay(timestamp) {
  const element = document.getElementById("candidatesLastSynced");
  if (!element) return;
  if (!timestamp) {
    element.textContent = "最終同期: -";
    return;
  }
  element.textContent = `最終同期: ${formatDateTimeJP(timestamp)}`;
}

function refreshSelectionState() {
  if (!selectedCandidateId) {
    highlightSelectedRow();
    return;
  }

  const candidate = filteredCandidates.find(
    (item) => item.id === selectedCandidateId
  );
  if (!candidate) {
    closeCandidateModal();
    return;
  }

  if (isCandidateModalOpen()) {
    renderCandidateDetail(candidate, { preserveEditState: true });
  }
  highlightSelectedRow();
}

function highlightSelectedRow() {
  const rows = document.querySelectorAll(
    "#candidatesTableBody .candidate-item"
  );
  const modalOpen = isCandidateModalOpen();
  rows.forEach((row) => {
    const active =
      modalOpen &&
      selectedCandidateId &&
      row.dataset.id === selectedCandidateId;
    row.classList.toggle("is-active", Boolean(active));
  });
}

function handleTableClick(event) {
  if (event.target.closest("[data-field]")) {
    return;
  }
  const row = event.target.closest("tr[data-id]");
  if (!row) return;
  const candidate = filteredCandidates.find(
    (item) => item.id === row.dataset.id
  );
  if (!candidate) return;
  selectedCandidateId = candidate.id;
  renderCandidateDetail(candidate);
  openCandidateModal();
  highlightSelectedRow();
}

function handleFilterReset() {
  filterConfig.forEach(({ id }) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.value = "";
  });

  const sortSelect = document.getElementById("candidatesSortOrder");
  if (sortSelect) {
    sortSelect.value = "desc";
  }

  selectedCandidateId = null;
  closeCandidateModal({ clearSelection: false });
  handleFilterChange();
}

function renderCandidateDetail(candidate, { preserveEditState = false } = {}) {
  const container = document.getElementById("candidateDetailContent");
  if (!container) return;

  if (!candidate) {
    currentDetailCandidateId = null;
    resetDetailEditState();
    container.innerHTML = getCandidateDetailPlaceholder();
    return;
  }

  if (!preserveEditState && candidate.id !== currentDetailCandidateId) {
    resetDetailEditState();
    resetTemplatePanelState();
  }
  currentDetailCandidateId = candidate.id;

  const header = `
    <div class="candidate-detail-header">
      <div>
        <span class="candidate-phase-pill">${escapeHtml(
          candidate.phase || "-"
        )}</span>
        <h3>${escapeHtml(candidate.candidateName || "-")}</h3>
        <p>${escapeHtml(candidate.companyName || "-")} / ${escapeHtml(
    candidate.jobName || "-"
  )}</p>
        <p class="candidate-contact-row">
          <span>${escapeHtml(candidate.phone || "-")}</span>
          <span>${escapeHtml(candidate.email || "-")}</span>
        </p>
      </div>
      <div class="candidate-detail-header-meta">
        <div><strong>担当</strong><span>${escapeHtml(
          candidate.advisorName || "-"
        )}</span></div>
        <div><strong>登録日時</strong><span>${formatDateTimeJP(
          candidate.registeredAt || candidate.registeredDate
        )}</span></div>
        <div><strong>次回アクション</strong><span>${formatDateJP(
          candidate.actionInfo?.nextActionDate
        )}</span></div>
      </div>
    </div>
  `;

  const sections = [
    renderDetailSection(
      "登録情報",
      renderRegistrationSection(candidate),
      "registration"
    ),
    renderDetailSection("面談", renderMeetingSection(candidate), "meeting"),
    renderDetailSection(
      "求職者情報",
      renderApplicantInfoSection(candidate),
      "applicant"
    ),
    renderDetailSection(
      "ヒアリング事項",
      renderHearingSection(candidate),
      "hearing"
    ),
    renderDetailSection(
      "選考進捗",
      renderSelectionProgressSection(candidate),
      "selection"
    ),
    renderDetailSection(
      "入社承諾後",
      renderAfterAcceptanceSection(candidate),
      "afterAcceptance"
    ),
    renderDetailSection(
      "返金・減額【自動入力】",
      renderRefundSection(candidate),
      "refund"
    ),
    renderDetailSection(
      "次回アクション日【対応可否】",
      renderNextActionSection(candidate),
      "nextAction"
    ),
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
  if (container) {
    container.innerHTML = getCandidateDetailPlaceholder();
  }
  currentDetailCandidateId = null;
  resetDetailEditState();
  resetTemplatePanelState();
}

function renderDetailSection(title, body, key) {
  const editing = detailEditState[key];
  const templateToggle =
    key === "hearing"
      ? renderTemplateToggleButton(detailTemplateState.hearing)
      : "";
  return `
    <section class="candidate-detail-section" data-section="${key}">
      <header class="candidate-detail-section-header">
        <h4>${title}</h4>
        <div class="detail-section-actions">
          ${templateToggle}
          <button type="button" class="detail-edit-btn ${
            editing ? "is-active" : ""
          }" data-section-edit="${key}">
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
    <button type="button" class="detail-template-btn ${
      isOpen ? "is-active" : ""
    }" data-template-toggle="hearing">
      テンプレート${isOpen ? "を隠す" : "表示"}
    </button>
  `;
}

function renderRegistrationSection(candidate) {
  const fields = [
    {
      label: "登録日時",
      path: "registeredAt",
      value: candidate.registeredAt || candidate.registeredDate,
      type: "datetime-local",
      displayFormatter: formatDateTimeJP,
    },
    {
      label: "更新日時",
      path: "updatedAt",
      value: candidate.updatedAt,
      type: "datetime-local",
      displayFormatter: formatDateTimeJP,
    },
    {
      label: "媒体登録日",
      path: "mediaRegisteredAt",
      value: candidate.mediaRegisteredAt,
      type: "date",
      displayFormatter: formatDateJP,
    },
    { label: "担当者", path: "advisorName", value: candidate.advisorName },
    { label: "通電実施者", path: "callerName", value: candidate.callerName },
    {
      label: "担当パートナー",
      path: "partnerName",
      value: candidate.partnerName,
    },
    {
      label: "紹介可能性",
      path: "introductionChance",
      value: candidate.introductionChance,
    },
    { label: "流入媒体", path: "source", value: candidate.source },
  ];
  return renderDetailGridFields(fields, "registration");
}

function renderMeetingSection(candidate) {
  const fields = [
    {
      label: "SMS送信確認",
      path: "smsConfirmed",
      value: candidate.smsConfirmed,
      input: "checkbox",
      valueType: "boolean",
      displayFormatter: (value) => (value ? "済" : "未"),
    },
    {
      label: "フェーズ",
      path: "phase",
      value: candidate.phase,
      input: "select",
      options: phaseOptions,
    },
    {
      label: "通電日",
      path: "callDate",
      value: candidate.callDate,
      type: "date",
      displayFormatter: formatDateJP,
    },
    {
      label: "日程確定日",
      path: "scheduleConfirmedAt",
      value: candidate.scheduleConfirmedAt,
      type: "date",
      displayFormatter: formatDateJP,
    },
    {
      label: "新規接触予定日",
      path: "firstContactPlannedAt",
      value: candidate.firstContactPlannedAt,
      type: "date",
      displayFormatter: formatDateJP,
    },
    {
      label: "新規接触日",
      path: "firstContactAt",
      value: candidate.firstContactAt,
      type: "date",
      displayFormatter: formatDateJP,
    },
    {
      label: "着座確認",
      path: "attendanceConfirmed",
      value: candidate.attendanceConfirmed,
      input: "checkbox",
      valueType: "boolean",
      displayFormatter: (value) => (value ? "確認済" : "未"),
    },
    {
      label: "企業への推薦日",
      path: "recommendationDate",
      value: candidate.recommendationDate,
      type: "date",
      displayFormatter: formatDateJP,
    },
  ];

  const meetings = candidate.meetingPlans || [];
  const editing = detailEditState.meeting;
  const listContent =
    meetings.length > 0
      ? meetings
          .map((plan, index) => renderMeetingPlanRow(plan, index, editing))
          .join("")
      : `<p class="detail-empty-row">面談予定は未登録です。</p>`;

  const addButton = editing
    ? `<button type="button" class="repeatable-add-btn" data-add-row="meetingPlans">＋ 面談予定を追加</button>`
    : "";

  return `
    ${renderDetailGridFields(fields, "meeting")}
    <div class="repeatable-block">
      <div class="repeatable-header">
        <h5>2回目以降の面談予定</h5>
        ${addButton}
      </div>
      <div class="repeatable-list">
        ${listContent}
      </div>
    </div>
  `;
}

function renderMeetingPlanRow(plan, index, editing) {
  const label = `${plan.sequence || index + 2}回目面談予定日`;
  if (!editing) {
    return `
      <div class="repeatable-row meeting-row">
        <label>${label}</label>
        <span class="detail-value detail-value-inline">${formatDateJP(
          plan.plannedDate
        )}</span>
        <span class="detail-value detail-value-inline">${
          plan.attendance ? "着座確認済" : "未確認"
        }</span>
      </div>
    `;
  }

  return `
    <div class="repeatable-row meeting-row">
      <label>${label}</label>
      <input type="date" class="repeatable-input" value="${formatInputValue(
        plan.plannedDate,
        "date"
      )}" data-detail-field="meetingPlans.${index}.plannedDate" data-detail-section="meeting">
      <label class="meeting-check">
        <input type="checkbox" ${
          plan.attendance ? "checked" : ""
        } data-detail-field="meetingPlans.${index}.attendance" data-detail-section="meeting" data-value-type="boolean">
        着座確認
      </label>
      <button type="button" class="repeatable-remove-btn" data-remove-row="meetingPlans" data-index="${index}">削除</button>
    </div>
  `;
}

function renderApplicantInfoSection(candidate) {
  const fields = [
    {
      label: "求職者コード",
      path: "candidateCode",
      value: candidate.candidateCode,
    },
    {
      label: "求職者名",
      path: "candidateName",
      value: candidate.candidateName,
    },
    {
      label: "求職者名（ヨミガナ）",
      path: "candidateKana",
      value: candidate.candidateKana,
    },
    { label: "応募企業名", path: "companyName", value: candidate.companyName },
    { label: "応募求人名", path: "jobName", value: candidate.jobName },
    { label: "勤務地", path: "workLocation", value: candidate.workLocation },
    {
      label: "面談動画リンク",
      path: "meetingVideoLink",
      value: candidate.meetingVideoLink,
      type: "url",
      link: true,
    },
    {
      label: "履歴書（送付用）",
      path: "resumeForSend",
      value: candidate.resumeForSend,
      type: "url",
      link: true,
    },
    {
      label: "職務経歴書（送付用）",
      path: "workHistoryForSend",
      value: candidate.workHistoryForSend,
      type: "url",
      link: true,
    },
    {
      label: "生年月日",
      path: "birthday",
      value: candidate.birthday,
      type: "date",
      displayFormatter: formatDateJP,
    },
    {
      label: "年齢",
      value: candidate.age ? `${candidate.age}歳` : "-",
      editable: false,
    },
    { label: "性別", path: "gender", value: candidate.gender },
    { label: "最終学歴", path: "education", value: candidate.education },
    { label: "電話番号", path: "phone", value: candidate.phone },
    {
      label: "メールアドレス",
      path: "email",
      value: candidate.email,
      type: "email",
    },
    { label: "郵便番号", path: "postalCode", value: candidate.postalCode },
    { label: "現住所", path: "address", value: candidate.address },
    { label: "市区町村", path: "city", value: candidate.city },
    {
      label: "連絡希望時間帯",
      path: "contactTime",
      value: candidate.contactTime,
    },
    {
      label: "備考",
      path: "remarks",
      value: candidate.remarks || candidate.memo,
      input: "textarea",
    },
  ];

  const editing = detailEditState.applicant;
  const resumes = candidate.resumeDocuments || [];
  const resumeContent =
    resumes.length > 0
      ? resumes
          .map((doc, index) => renderResumeRow(doc, index, editing))
          .join("")
      : `<p class="detail-empty-row">登録された経歴書はありません。</p>`;
  const addButton = editing
    ? `<button type="button" class="repeatable-add-btn" data-add-row="resumeDocuments">＋ 経歴書を追加</button>`
    : "";

  return `
    ${renderDetailGridFields(fields, "applicant")}
    <div class="repeatable-block">
      <div class="repeatable-header">
        <h5>経歴書</h5>
        ${addButton}
      </div>
      <div class="repeatable-list">
        ${resumeContent}
      </div>
    </div>
  `;
}

function renderResumeRow(doc, index, editing) {
  if (!editing) {
    return `
      <div class="repeatable-row">
        <label>${doc.label}</label>
        <span class="detail-value">${escapeHtml(doc.value || "-")}</span>
      </div>
    `;
  }

  return `
    <div class="repeatable-row">
      <label>${doc.label}</label>
      <input type="text" class="repeatable-input" value="${escapeHtmlAttr(
        doc.value || ""
      )}" placeholder="リンクまたはメモを入力" data-detail-field="resumeDocuments.${index}.value" data-detail-section="applicant">
      <button type="button" class="repeatable-remove-btn" data-remove-row="resumeDocuments" data-index="${index}">削除</button>
    </div>
  `;
}

function renderHearingSection(candidate) {
  const hearing = candidate.hearing || {};
  const editing = detailEditState.hearing;
  const memoValue = buildHearingMemoValue(hearing);
  const templatePanel = detailTemplateState.hearing
    ? renderHearingTemplatePanel(editing)
    : "";

  if (editing) {
    return `
      ${templatePanel}
      <label class="detail-textarea-field">
        <span>ヒアリングメモ</span>
        <textarea rows="6" id="hearingMemoTextarea" class="detail-inline-input detail-inline-textarea" data-detail-field="hearing.memo" data-detail-section="hearing">${escapeHtml(
          memoValue || ""
        )}</textarea>
      </label>
    `;
  }

  return `
    ${templatePanel}
    <label class="detail-textarea-field">
      <span>ヒアリングメモ</span>
      <span class="detail-value">${escapeHtml(memoValue || "-")}</span>
    </label>
  `;
}

function renderHearingTemplatePanel(editing) {
  const infoText = editing
    ? "テンプレートを選択するとメモに差し込まれます。"
    : "テンプレートを確認できます。編集モードで差し込み可能です。";
  return `
    <div class="hearing-template-panel ${
      editing ? "" : "is-readonly"
    }" data-template-panel="hearing">
      <div class="hearing-template-panel-header">
        <span>${infoText}</span>
        <button type="button" class="detail-template-close" data-template-toggle="hearing">閉じる</button>
      </div>
      <div class="hearing-template-list">
        ${hearingTemplates
          .map((template) => {
            const disabledAttr = editing ? "" : "disabled";
            return `<button type="button" class="template-pill" data-template-id="${template.id}" ${disabledAttr}>${template.name}</button>`;
          })
          .join("")}
      </div>
    </div>
  `;
}

function buildHearingMemoValue(hearing) {
  if (!hearing) return "";
  if (hearing.memo) return hearing.memo;
  const legacyFields = [
    { key: "relocation", label: "転居" },
    { key: "desiredArea", label: "希望エリア" },
    { key: "timing", label: "転職時期" },
    { key: "desiredJob", label: "希望職種" },
    { key: "firstInterviewMemo", label: "初回面談メモ" },
    { key: "currentIncome", label: "現年収" },
    { key: "desiredIncome", label: "希望年収" },
    { key: "reason", label: "転職理由・転職軸" },
    { key: "interviewPreference", label: "面接希望日" },
    { key: "recommendationText", label: "推薦文" },
    { key: "otherSelections", label: "他社選考状況" },
  ];
  return legacyFields
    .map(({ key, label }) => {
      if (!hearing[key]) return "";
      return `${label}: ${hearing[key]}`;
    })
    .filter(Boolean)
    .join("\n");
}

function renderSelectionProgressSection(candidate) {
  const rows = candidate.selectionProgress || [];
  const editing = detailEditState.selection;
  const addButton = editing
    ? `<button type="button" class="repeatable-add-btn" data-add-row="selectionProgress">＋ 企業を追加</button>`
    : "";
  const headerAction = editing ? "<th>操作</th>" : "";

  return `
    <div class="repeatable-header">
      <h5>企業ごとの進捗</h5>
      ${addButton}
    </div>
    <div class="detail-table-wrapper">
      <table class="detail-table min-w-[1000px]">
        <thead>
          <tr>
            <th>受験企業名</th>
            <th>応募経路</th>
            <th>推薦日</th>
            <th>面接設定日</th>
            <th>面接日</th>
            <th>内定日</th>
            <th>クロージング予定日</th>
            <th>内定承諾日</th>
            <th>入社日</th>
            <th>入社前辞退日</th>
            <th>紹介FEE</th>
            <th>選考状況</th>
            <th>備考</th>
            ${headerAction}
          </tr>
        </thead>
        <tbody>
          ${
            rows.length > 0
              ? rows
                  .map((row, index) => renderSelectionRow(row, index, editing))
                  .join("")
              : `<tr><td colspan="${
                  editing ? 14 : 13
                }" class="detail-empty-row text-center py-3">企業の進捗は登録されていません。</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderSelectionRow(row = {}, index, editing) {
  const fields = [
    { path: `selectionProgress.${index}.companyName`, value: row.companyName },
    { path: `selectionProgress.${index}.route`, value: row.route },
    {
      path: `selectionProgress.${index}.recommendationDate`,
      value: row.recommendationDate,
      type: "date",
      displayFormatter: formatDateJP,
    },
    {
      path: `selectionProgress.${index}.interviewSetupDate`,
      value: row.interviewSetupDate,
      type: "date",
      displayFormatter: formatDateJP,
    },
    {
      path: `selectionProgress.${index}.interviewDate`,
      value: row.interviewDate,
      type: "date",
      displayFormatter: formatDateJP,
    },
    {
      path: `selectionProgress.${index}.offerDate`,
      value: row.offerDate,
      type: "date",
      displayFormatter: formatDateJP,
    },
    {
      path: `selectionProgress.${index}.closingDate`,
      value: row.closingDate,
      type: "date",
      displayFormatter: formatDateJP,
    },
    {
      path: `selectionProgress.${index}.acceptanceDate`,
      value: row.acceptanceDate,
      type: "date",
      displayFormatter: formatDateJP,
    },
    {
      path: `selectionProgress.${index}.onboardingDate`,
      value: row.onboardingDate,
      type: "date",
      displayFormatter: formatDateJP,
    },
    {
      path: `selectionProgress.${index}.preJoinDeclineDate`,
      value: row.preJoinDeclineDate,
      type: "date",
      displayFormatter: formatDateJP,
    },
    { path: `selectionProgress.${index}.fee`, value: row.fee },
    { path: `selectionProgress.${index}.status`, value: row.status },
    { path: `selectionProgress.${index}.notes`, value: row.notes },
  ];

  const cells = fields
    .map((field) => {
      if (editing) {
        const type = field.type || "text";
        return `<td><input type="${type}" class="detail-table-input" value="${escapeHtmlAttr(
          formatInputValue(field.value, type)
        )}" data-detail-field="${
          field.path
        }" data-detail-section="selection"></td>`;
      }
      const displayValue = field.displayFormatter
        ? field.displayFormatter(field.value)
        : formatDisplayValue(field.value);
      return `<td><span class="detail-value">${escapeHtml(
        displayValue
      )}</span></td>`;
    })
    .join("");

  const actionCell = editing
    ? `<td class="detail-table-actions text-center"><button type="button" class="repeatable-remove-btn" data-remove-row="selectionProgress" data-index="${index}">削除</button></td>`
    : "";

  return `<tr>${cells}${actionCell}</tr>`;
}

function renderAfterAcceptanceSection(candidate) {
  const data = candidate.afterAcceptance || {};
  const editing = detailEditState.afterAcceptance;
  const fields = [
    {
      label: "受注金額（税抜）",
      path: "afterAcceptance.amount",
      value: data.amount,
    },
    {
      label: "職種",
      path: "afterAcceptance.jobCategory",
      value: data.jobCategory,
    },
  ];

  const checkboxArea = editing
    ? `
      <div class="detail-checkbox-row">
        ${reportStatusOptions
          .map((option) => {
            const checked = data.reportStatuses?.includes(option);
            return `
              <label class="cs-checkbox">
                <input type="checkbox" ${
                  checked ? "checked" : ""
                } data-array-field="afterAcceptance.reportStatuses" data-array-value="${option}">
                <span>${option}</span>
              </label>
            `;
          })
          .join("")}
      </div>
    `
    : `
      <div class="detail-pill-list">
        ${
          (data.reportStatuses || []).length === 0
            ? '<span class="detail-value detail-value-inline">-</span>'
            : data.reportStatuses
                .map(
                  (status) => `<span class="cs-pill is-active">${status}</span>`
                )
                .join("")
        }
      </div>
    `;

  return `
    ${renderDetailGridFields(fields, "afterAcceptance")}
    ${checkboxArea}
  `;
}

function renderRefundSection(candidate) {
  const info = candidate.refundInfo || {};
  const fields = [
    {
      label: "退職日",
      path: "refundInfo.resignationDate",
      value: info.resignationDate,
      type: "date",
      displayFormatter: formatDateJP,
    },
    {
      label: "返金・減額（税抜）",
      path: "refundInfo.refundAmount",
      value: info.refundAmount,
    },
  ];
  const editing = detailEditState.refund;
  const select = editing
    ? `
      <label class="detail-textarea-field">
        <span>返金報告</span>
        <select class="detail-inline-input" data-detail-field="refundInfo.reportStatus" data-detail-section="refund">
          <option value="">選択してください</option>
          ${refundReportOptions
            .map(
              (option) =>
                `<option value="${option}" ${
                  option === info.reportStatus ? "selected" : ""
                }>${option}</option>`
            )
            .join("")}
        </select>
      </label>
    `
    : `
      <label class="detail-textarea-field">
        <span>返金報告</span>
        <span class="detail-value">${escapeHtml(
          info.reportStatus || "-"
        )}</span>
      </label>
    `;

  return `
    ${renderDetailGridFields(fields, "refund")}
    ${select}
  `;
}

function renderNextActionSection(candidate) {
  const action = candidate.actionInfo || {};
  const fields = [
    {
      label: "次回アクション日",
      path: "actionInfo.nextActionDate",
      value: action.nextActionDate,
      type: "date",
      displayFormatter: formatDateJP,
    },
    {
      label: "最終結果",
      path: "actionInfo.finalResult",
      value: action.finalResult,
      input: "select",
      options: finalResultOptions,
    },
  ];
  return renderDetailGridFields(fields, "nextAction");
}

function renderCsSection(candidate) {
  const checklist = candidate.csChecklist || {};
  const editing = detailEditState.cs;
  const csItems = [
    { key: "validConfirmed", label: "有効応募確認" },
    { key: "connectConfirmed", label: "通電確認" },
    { key: "dial1", label: "1回目架電" },
    { key: "dial2", label: "2回目架電" },
    { key: "dial3", label: "3回目架電" },
    { key: "dial4", label: "4回目架電" },
    { key: "dial5", label: "5回目架電" },
    { key: "dial6", label: "6回目架電" },
    { key: "dial7", label: "7回目架電" },
    { key: "dial8", label: "8回目架電" },
    { key: "dial9", label: "9回目架電" },
    { key: "dial10", label: "10回目架電" },
  ];

  if (editing) {
    return `
      <div class="cs-checkbox-grid">
        ${csItems
          .map((item) => {
            const checked = checklist[item.key];
            return `
              <label class="cs-checkbox">
                <input type="checkbox" ${
                  checked ? "checked" : ""
                } data-detail-field="csChecklist.${
              item.key
            }" data-detail-section="cs" data-value-type="boolean">
                <span>${item.label}</span>
              </label>
            `;
          })
          .join("")}
      </div>
    `;
  }

  return `
    <div class="detail-pill-list">
      ${csItems
        .map(
          (item) =>
            `<span class="cs-pill ${checklist[item.key] ? "is-active" : ""}">${
              item.label
            }</span>`
        )
        .join("")}
    </div>
  `;
}

function renderMemoSection(candidate) {
  const editing = detailEditState.memo;
  if (editing) {
    return `
      <label class="detail-textarea-field">
        <span>自由メモ</span>
        <textarea rows="4" class="detail-inline-input detail-inline-textarea" data-detail-field="memoDetail" data-detail-section="memo">${escapeHtml(
          candidate.memoDetail || ""
        )}</textarea>
      </label>
    `;
  }

  return `
    <label class="detail-textarea-field">
      <span>自由メモ</span>
      <span class="detail-value">${escapeHtml(
        candidate.memoDetail || "-"
      )}</span>
    </label>
  `;
}

function renderDetailGridFields(fields, sectionKey) {
  const editing = Boolean(detailEditState[sectionKey]);
  return `
    <dl class="detail-grid">
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
          const displayValue = field.displayFormatter
            ? field.displayFormatter(value)
            : formatDisplayValue(value);
          const inner =
            field.link && value
              ? `<a href="${value}" target="_blank" rel="noreferrer">${escapeHtml(
                  value
                )}</a>`
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
  const dataset = field.path
    ? `data-detail-field="${field.path}" data-detail-section="${sectionKey}"`
    : "";
  const valueType = field.valueType
    ? ` data-value-type="${field.valueType}"`
    : "";
  if (field.input === "textarea") {
    return `<textarea class="detail-inline-input detail-inline-textarea" ${dataset}${valueType}>${escapeHtml(
      value || ""
    )}</textarea>`;
  }
  if (field.input === "select") {
    return `
      <select class="detail-inline-input" ${dataset}${valueType}>
        ${(field.options || [])
          .map(
            (option) =>
              `<option value="${option}" ${
                option === value ? "selected" : ""
              }>${option}</option>`
          )
          .join("")}
      </select>
    `;
  }
  if (field.input === "checkbox") {
    const wrapperClass = field.checkboxClass || "meeting-check";
    return `
      <label class="${wrapperClass}">
        <input type="checkbox" ${value ? "checked" : ""} ${dataset}${
      valueType || ' data-value-type="boolean"'
    }>
        <span>${field.checkboxLabel || "済"}</span>
      </label>
    `;
  }
  const type = field.type || "text";
  return `<input type="${type}" class="detail-inline-input" value="${escapeHtmlAttr(
    formatInputValue(value, type)
  )}" ${dataset}${valueType}>`;
}

function formatInputValue(value, type) {
  if (!value) return "";
  if (type === "date") {
    return String(value).slice(0, 10);
  }
  if (type === "datetime-local") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
  return value;
}

function initializeDetailContentListeners() {
  const container = document.getElementById("candidateDetailContent");
  if (!container) return;

  detailContentHandlers.click = handleDetailContentClick;
  detailContentHandlers.input = handleDetailFieldChange;

  container.addEventListener("click", detailContentHandlers.click);
  container.addEventListener("input", detailContentHandlers.input);
  container.addEventListener("change", detailContentHandlers.input);
}

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
  if (!detailEditState[sectionKey]) {
    renderCandidatesTable(filteredCandidates);
    highlightSelectedRow();
    try {
      await saveCandidateRecord(candidate, { preserveDetailState: false });
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
      const rows = candidate.selectionProgress;
      rows.push({});
      break;
    }
    default:
      break;
  }

  const current = getSelectedCandidate();
  if (current) {
    renderCandidateDetail(current, { preserveEditState: true });
  }
}

function handleDetailRemoveRow(type, index) {
  const candidate = getSelectedCandidate();
  if (!candidate || Number.isNaN(index)) return;

  switch (type) {
    case "meetingPlans": {
      const list = candidate.meetingPlans || [];
      list.splice(index, 1);
      list.forEach((plan, idx) => {
        plan.sequence = idx + 2;
      });
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
  if (current) {
    renderCandidateDetail(current, { preserveEditState: true });
  }
}

function handleDetailFieldChange(event) {
  const target = event.target;
  if (!target) return;
  const candidate = getSelectedCandidate();
  if (!candidate) return;

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
    value = Number(value) || 0;
  }

  updateCandidateFieldValue(candidate, fieldPath, value);
  if (fieldPath === "birthday") {
    candidate.age = calculateAge(candidate.birthday);
  }
}

function updateCandidateArrayField(candidate, fieldPath, optionValue, checked) {
  if (!optionValue) return;
  const { container, key } = getFieldContainer(candidate, fieldPath);
  if (!container) return;
  if (!Array.isArray(container[key])) {
    container[key] = [];
  }
  const list = container[key];
  const exists = list.includes(optionValue);
  if (checked && !exists) {
    list.push(optionValue);
  } else if (!checked && exists) {
    list.splice(list.indexOf(optionValue), 1);
  }
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

function getFieldContainer(target, path) {
  const segments = path.split(".");
  let current = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    const nextKey = segments[i + 1];
    const isNumeric = /^\d+$/.test(key);
    if (Array.isArray(current)) {
      const index = Number(key);
      if (!current[index]) {
        current[index] = /^\d+$/.test(nextKey) ? [] : {};
      }
      current = current[index];
      continue;
    }
    if (current[key] === undefined || current[key] === null) {
      current[key] = /^\d+$/.test(nextKey) ? [] : {};
    }
    current = current[key];
  }
  const lastKey = segments[segments.length - 1];
  return { container: current, key: lastKey };
}

function getSelectedCandidate() {
  if (!selectedCandidateId) return null;
  return allCandidates.find((item) => item.id === selectedCandidateId) || null;
}

function resetDetailEditState() {
  detailSectionKeys.forEach((key) => {
    detailEditState[key] = false;
  });
}

function resetTemplatePanelState() {
  Object.keys(detailTemplateState).forEach((key) => {
    detailTemplateState[key] = false;
  });
}

function handleTemplateToggle(sectionKey) {
  if (!sectionKey || !(sectionKey in detailTemplateState)) return;
  detailTemplateState[sectionKey] = !detailTemplateState[sectionKey];
  const candidate = getSelectedCandidate();
  if (candidate) {
    renderCandidateDetail(candidate, { preserveEditState: true });
  }
}

function handleTemplateSelection(templateId, sectionKey) {
  if (!templateId || !sectionKey) return;
  if (sectionKey === "hearing") {
    applyHearingTemplate(templateId);
  }
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
    const inputEvent = new Event("input", { bubbles: true });
    textarea.dispatchEvent(inputEvent);
    textarea.focus();
  } else {
    candidate.hearing.memo = template.content;
    renderCandidateDetail(candidate, { preserveEditState: true });
  }
}

function initializeDetailModal() {
  const modal = document.getElementById("candidateDetailModal");
  const closeButton = document.getElementById("candidateDetailClose");

  if (modal) {
    modalHandlers.overlay = (event) => {
      if (event.target === modal) {
        closeCandidateModal();
      }
    };
    modal.addEventListener("click", modalHandlers.overlay);
  }

  if (closeButton) {
    modalHandlers.closeButton = () => closeCandidateModal();
    closeButton.addEventListener("click", modalHandlers.closeButton);
  }

  modalHandlers.keydown = (event) => {
    if (event.key === "Escape" && isCandidateModalOpen()) {
      closeCandidateModal();
    }
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
  if (wasOpen) {
    setCandidateDetailPlaceholder();
  }
  document.body.classList.remove("has-modal-open");
  if (clearSelection) {
    selectedCandidateId = null;
  }
  highlightSelectedRow();
}

function isCandidateModalOpen() {
  const modal = document.getElementById("candidateDetailModal");
  return modal ? modal.classList.contains("is-open") : false;
}

async function saveCandidateRecord(candidate, { preserveDetailState = true } = {}) {
  if (!candidate || !candidate.id) {
    throw new Error("保存対象の候補者が見つかりません。");
  }
  normalizeCandidate(candidate);
  const response = await fetch(`/api/candidates/${candidate.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(candidate),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `HTTP ${response.status} ${response.statusText} - ${text.slice(
        0,
        200
      )}`
    );
  }
  const updated = normalizeCandidate(await response.json());
  delete pendingInlineUpdates[String(candidate.id)];
  applyCandidateUpdate(updated, { preserveDetailState });
  return updated;
}

function applyCandidateUpdate(updated, { preserveDetailState = true } = {}) {
  if (!updated || !updated.id) return;
  const mergeIntoList = (list) => {
    const index = list.findIndex(
      (item) => String(item.id) === String(updated.id)
    );
    if (index !== -1) {
      list[index] = { ...list[index], ...updated };
      return list[index];
    }
    return null;
  };
  const mergedCandidate =
    mergeIntoList(allCandidates) ||
    mergeIntoList(filteredCandidates) ||
    updated;

  renderCandidatesTable(filteredCandidates);
  if (selectedCandidateId && String(selectedCandidateId) === String(updated.id)) {
    renderCandidateDetail(mergedCandidate, {
      preserveEditState: preserveDetailState,
    });
  }
  highlightSelectedRow();
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttr(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }
  return age;
}

function cleanupCandidatesEventListeners() {
  closeCandidateModal({ clearSelection: false });
  filterConfig.forEach(({ id, event }) => {
    const element = document.getElementById(id);
    if (element) {
      element.removeEventListener(event, handleFilterChange);
    }
  });

  const resetButton = document.getElementById("candidatesFilterReset");
  if (resetButton) {
    resetButton.removeEventListener("click", handleFilterReset);
  }

  const sortSelect = document.getElementById("candidatesSortOrder");
  if (sortSelect) {
    sortSelect.removeEventListener("change", handleFilterChange);
  }

  const tableBody = document.getElementById("candidatesTableBody");
  if (tableBody) {
    tableBody.removeEventListener("click", handleTableClick);
    tableBody.removeEventListener("input", handleInlineEdit);
    tableBody.removeEventListener("change", handleInlineEdit);
  }

  const toggleButton = document.getElementById("candidatesToggleEdit");
  if (toggleButton) {
    toggleButton.removeEventListener("click", toggleCandidatesEditMode);
  }

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
    if (detailContentHandlers.click) {
      detailContent.removeEventListener("click", detailContentHandlers.click);
    }
    if (detailContentHandlers.input) {
      detailContent.removeEventListener("input", detailContentHandlers.input);
      detailContent.removeEventListener("change", detailContentHandlers.input);
    }
  }
  detailContentHandlers.click = null;
  detailContentHandlers.input = null;
}

function getMockCandidates() {
  return [
    {
      id: "cand-001",
      candidateCode: "C-2024-001",
      candidateName: "田中 太郎",
      candidateKana: "タナカ タロウ",
      jobName: "法人営業（東京）",
      companyName: "ABC株式会社",
      workLocation: "東京都港区",
      validApplication: true,
      phoneConnected: true,
      smsSent: true,
      advisorName: "佐藤アドバイザー",
      callerName: "山本オペレーター",
      phase: "初回面談設定",
      registeredDate: "2024-11-01",
      updatedAt: "2024-11-07T09:45:00",
      mediaRegisteredAt: "2024-10-29",
      source: "Indeed",
      phone: "090-1234-5678",
      email: "tanaka@example.com",
      birthday: "1991-02-14",
      age: 33,
      gender: "男性",
      education: "早稲田大学 商学部",
      postalCode: "105-0001",
      address: "東京都港区虎ノ門1-1-1",
      city: "港区",
      contactTime: "平日 10:00-19:00",
      remarks: "転居相談あり",
      memo: "初回面談予定調整中",
      smsConfirmed: true,
      firstContactPlannedAt: "2024-11-05",
      firstContactAt: "2024-11-06",
      attendanceConfirmed: true,
      callDate: "2024-11-03",
      scheduleConfirmedAt: "2024-11-04",
      resumeStatus: "提出済",
      recommendationDate: "2024-11-08",
      meetingVideoLink: "https://example.com/videos/tanaka",
      resumeForSend: "https://example.com/docs/tanaka_resume.pdf",
      workHistoryForSend: "https://example.com/docs/tanaka_history.pdf",
      partnerName: "高橋パートナー",
      introductionChance: "高い",
      newActionDate: "2024-11-10",
      actionInfo: { nextActionDate: "2024-11-18", finalResult: "----" },
      meetingPlans: [
        { sequence: 2, plannedDate: "2024-11-12", attendance: false },
        { sequence: 3, plannedDate: "", attendance: false },
      ],
      resumeDocuments: [{ label: "経歴書1", value: "Google Drive - 田中太郎" }],
      hearing: {
        relocation: "福岡への転居希望あり",
        desiredArea: "九州エリア（福岡市）",
        timing: "3ヶ月以内",
        desiredJob: "法人営業職",
        firstInterviewMemo: "オンラインで30分の面談を実施",
        currentIncome: "520万円",
        desiredIncome: "600万円",
        reason: "成長環境と裁量を求めて",
        interviewPreference: "平日夜 18時以降",
        recommendationText: "営業経験豊富でコミュニケーション力が高い",
        otherSelections: "2社で一次面接進行中",
        employmentStatus: "就業中",
      },
      selectionProgress: [
        {
          companyName: "ABC株式会社",
          route: "Indeed",
          recommendationDate: "2024-11-08",
          interviewSetupDate: "2024-11-09",
          interviewDate: "2024-11-12",
          offerDate: "",
          closingDate: "",
          acceptanceDate: "",
          onboardingDate: "",
          preJoinDeclineDate: "",
          fee: "30%",
          status: "一次面接予定",
          notes: "営業本部長との面接",
        },
      ],
      afterAcceptance: {
        amount: "1,200,000円",
        jobCategory: "営業",
        reportStatuses: ["LINE報告済み"],
      },
      refundInfo: { resignationDate: "", refundAmount: "", reportStatus: "" },
      csChecklist: {
        validConfirmed: true,
        connectConfirmed: true,
        dial1: true,
        dial2: true,
        dial3: false,
        dial4: false,
        dial5: false,
        dial6: false,
        dial7: false,
        dial8: false,
        dial9: false,
        dial10: false,
      },
      memoDetail: "初回面談で家族構成と転居スケジュールをヒアリング済み。",
    },
    {
      id: "cand-002",
      candidateCode: "C-2024-014",
      candidateName: "佐藤 花子",
      candidateKana: "サトウ ハナコ",
      jobName: "カスタマーサクセス",
      companyName: "XYZソリューションズ",
      workLocation: "大阪府大阪市",
      validApplication: true,
      phoneConnected: true,
      smsSent: false,
      advisorName: "中村アドバイザー",
      callerName: "上田オペレーター",
      phase: "一次面接調整",
      registeredDate: "2024-10-25",
      updatedAt: "2024-11-05T13:20:00",
      mediaRegisteredAt: "2024-10-18",
      source: "求人ボックス",
      phone: "080-2345-6789",
      email: "sato@example.com",
      birthday: "1995-07-03",
      gender: "女性",
      education: "神戸大学 経営学部",
      postalCode: "530-0001",
      address: "大阪府大阪市北区2-2-2",
      city: "大阪市北区",
      contactTime: "終日可（SMS希望）",
      remarks: "第二志望として別業界も検討中",
      memo: "一次面接日程調整中",
      smsConfirmed: false,
      firstContactPlannedAt: "2024-10-27",
      firstContactAt: "2024-10-28",
      attendanceConfirmed: false,
      callDate: "2024-10-26",
      scheduleConfirmedAt: "2024-10-30",
      resumeStatus: "未提出",
      recommendationDate: "2024-11-02",
      meetingVideoLink: "",
      resumeForSend: "",
      workHistoryForSend: "",
      partnerName: "佐々木パートナー",
      introductionChance: "中",
      actionInfo: { nextActionDate: "2024-11-15", finalResult: "----" },
      meetingPlans: [
        { sequence: 2, plannedDate: "2024-11-20", attendance: false },
      ],
      resumeDocuments: [],
      hearing: {
        relocation: "不可（大阪限定）",
        desiredArea: "大阪市内",
        timing: "半年以内",
        desiredJob: "CS・サポート職",
        firstInterviewMemo: "初回面談で志望動機を深掘り",
        currentIncome: "420万円",
        desiredIncome: "480万円",
        reason: "スキルを活かせる職場を希望",
        interviewPreference: "火木の午前",
        recommendationText: "サブスクビジネス経験者",
        otherSelections: "1社内定保留中",
        employmentStatus: "就業中",
      },
      selectionProgress: [
        {
          companyName: "XYZソリューションズ",
          route: "求人ボックス",
          recommendationDate: "2024-11-02",
          interviewSetupDate: "2024-11-05",
          interviewDate: "",
          offerDate: "",
          closingDate: "",
          acceptanceDate: "",
          onboardingDate: "",
          preJoinDeclineDate: "",
          fee: "25%",
          status: "一次面接日程調整",
          notes: "採用担当：小林様",
        },
      ],
      afterAcceptance: { amount: "", jobCategory: "", reportStatuses: [] },
      refundInfo: { resignationDate: "", refundAmount: "", reportStatus: "" },
      csChecklist: {
        validConfirmed: true,
        connectConfirmed: true,
        dial1: true,
        dial2: true,
        dial3: true,
        dial4: false,
        dial5: false,
        dial6: false,
        dial7: false,
        dial8: false,
        dial9: false,
        dial10: false,
      },
      memoDetail: "一次面接調整中。別求人との比較資料を送付予定。",
    },
    {
      id: "cand-003",
      candidateCode: "C-2024-025",
      candidateName: "山田 次郎",
      candidateKana: "ヤマダ ジロウ",
      jobName: "プロジェクトマネージャー",
      companyName: "TechForward株式会社",
      workLocation: "愛知県名古屋市",
      validApplication: true,
      phoneConnected: true,
      smsSent: true,
      advisorName: "石井アドバイザー",
      callerName: "田島オペレーター",
      phase: "内定承諾待ち",
      registeredDate: "2024-09-15",
      updatedAt: "2024-11-06T18:45:00",
      mediaRegisteredAt: "2024-09-10",
      source: "マイナビ",
      phone: "070-9876-5432",
      email: "yamada@example.com",
      birthday: "1988-11-20",
      gender: "男性",
      education: "名古屋工業大学 情報工学科",
      postalCode: "460-0008",
      address: "愛知県名古屋市中区3-3-3",
      city: "名古屋市中区",
      contactTime: "平日 9:00-18:00",
      remarks: "年収交渉中",
      memo: "内定承諾確認待ち",
      smsConfirmed: true,
      firstContactPlannedAt: "2024-09-18",
      firstContactAt: "2024-09-18",
      attendanceConfirmed: true,
      callDate: "2024-09-16",
      scheduleConfirmedAt: "2024-09-17",
      resumeStatus: "受領済",
      recommendationDate: "2024-09-19",
      meetingVideoLink: "https://example.com/videos/yamada",
      resumeForSend: "https://example.com/docs/yamada_resume.pdf",
      workHistoryForSend: "https://example.com/docs/yamada_history.pdf",
      partnerName: "川村パートナー",
      introductionChance: "非常に高い",
      actionInfo: { nextActionDate: "2024-11-11", finalResult: "承諾" },
      meetingPlans: [
        { sequence: 2, plannedDate: "2024-10-02", attendance: true },
      ],
      resumeDocuments: [
        { label: "経歴書1", value: "最新スキルシート2024" },
        { label: "経歴書2", value: "成果資料リンク" },
      ],
      hearing: {
        relocation: "可（条件付き）",
        desiredArea: "名古屋市内",
        timing: "即時",
        desiredJob: "IT系PM",
        firstInterviewMemo: "開発体制の課題を指摘",
        currentIncome: "780万円",
        desiredIncome: "850万円",
        reason: "さらなる裁量とリモート比率向上を希望",
        interviewPreference: "終日可（リモート）",
        recommendationText: "マネジメント経験豊富、英語対応可",
        otherSelections: "1社で最終面接待ち",
        employmentStatus: "離職中",
      },
      selectionProgress: [
        {
          companyName: "TechForward株式会社",
          route: "マイナビ",
          recommendationDate: "2024-09-19",
          interviewSetupDate: "2024-09-21",
          interviewDate: "2024-09-25",
          offerDate: "2024-10-05",
          closingDate: "2024-10-10",
          acceptanceDate: "",
          onboardingDate: "2024-12-01",
          preJoinDeclineDate: "",
          fee: "35%",
          status: "内定承諾待ち",
          notes: "年収交渉中",
        },
      ],
      afterAcceptance: {
        amount: "1,800,000円",
        jobCategory: "PM",
        reportStatuses: ["LINE報告済み", "個人シート反映済み"],
      },
      refundInfo: { resignationDate: "", refundAmount: "", reportStatus: "" },
      csChecklist: {
        validConfirmed: true,
        connectConfirmed: true,
        dial1: true,
        dial2: true,
        dial3: true,
        dial4: true,
        dial5: true,
        dial6: true,
        dial7: false,
        dial8: false,
        dial9: false,
        dial10: false,
      },
      memoDetail: "入社承諾連絡を11/11までに実施予定。",
    },
    {
      id: "cand-004",
      candidateCode: "C-2024-033",
      candidateName: "鈴木 未来",
      candidateKana: "スズキ ミライ",
      jobName: "UI/UXデザイナー",
      companyName: "CreativePlus",
      workLocation: "東京都渋谷区",
      validApplication: true,
      phoneConnected: false,
      smsSent: true,
      advisorName: "藤本アドバイザー",
      callerName: "森山オペレーター",
      phase: "入社準備",
      registeredDate: "2024-09-12",
      updatedAt: "2024-11-02T16:10:00",
      mediaRegisteredAt: "2024-09-01",
      source: "doda",
      phone: "050-3333-2222",
      email: "suzuki@example.com",
      birthday: "1993-05-11",
      gender: "女性",
      education: "千葉大学 デザイン学科",
      postalCode: "150-0002",
      address: "東京都渋谷区渋谷2-2-2",
      city: "渋谷区",
      contactTime: "平日 13:00-21:00",
      remarks: "リモート勤務希望",
      memo: "入社書類回収中",
      smsConfirmed: true,
      firstContactPlannedAt: "2024-09-14",
      firstContactAt: "2024-09-15",
      attendanceConfirmed: true,
      callDate: "2024-09-13",
      scheduleConfirmedAt: "2024-09-16",
      resumeStatus: "提出済",
      recommendationDate: "2024-09-18",
      meetingVideoLink: "",
      resumeForSend: "https://example.com/docs/suzuki_resume.pdf",
      workHistoryForSend: "https://example.com/docs/suzuki_history.pdf",
      partnerName: "森口パートナー",
      introductionChance: "高い",
      actionInfo: { nextActionDate: "2024-11-09", finalResult: "承諾" },
      meetingPlans: [],
      resumeDocuments: [{ label: "経歴書1", value: "Portfolio URL" }],
      hearing: {
        relocation: "不可（関東圏内）",
        desiredArea: "渋谷・新宿エリア",
        timing: "1ヶ月以内",
        desiredJob: "UI/UXデザイン",
        firstInterviewMemo: "ポートフォリオ説明に強み",
        currentIncome: "600万円",
        desiredIncome: "700万円",
        reason: "ミッションフィット",
        interviewPreference: "リモート面談希望",
        recommendationText: "Figmaスペシャリスト",
        otherSelections: "なし",
        employmentStatus: "就業中",
      },
      selectionProgress: [
        {
          companyName: "CreativePlus",
          route: "doda",
          recommendationDate: "2024-09-18",
          interviewSetupDate: "2024-09-22",
          interviewDate: "2024-09-25",
          offerDate: "2024-10-05",
          closingDate: "2024-10-15",
          acceptanceDate: "2024-10-20",
          onboardingDate: "2024-12-01",
          preJoinDeclineDate: "",
          fee: "28%",
          status: "入社準備中",
          notes: "在籍証明待ち",
        },
      ],
      afterAcceptance: {
        amount: "1,500,000円",
        jobCategory: "デザイナー",
        reportStatuses: [
          "LINE報告済み",
          "個人シート反映済み",
          "請求書送付済み",
        ],
      },
      refundInfo: { resignationDate: "", refundAmount: "", reportStatus: "" },
      csChecklist: {
        validConfirmed: true,
        connectConfirmed: false,
        dial1: true,
        dial2: true,
        dial3: true,
        dial4: true,
        dial5: true,
        dial6: true,
        dial7: true,
        dial8: true,
        dial9: false,
        dial10: false,
      },
      memoDetail: "入社書類の最終チェック中。",
    },
    {
      id: "cand-005",
      candidateCode: "C-2023-112",
      candidateName: "伊藤 圭介",
      candidateKana: "イトウ ケイスケ",
      jobName: "バックオフィス責任者",
      companyName: "NextStage株式会社",
      workLocation: "神奈川県横浜市",
      validApplication: false,
      phoneConnected: false,
      smsSent: false,
      advisorName: "大谷アドバイザー",
      callerName: "今井オペレーター",
      phase: "クローズ",
      registeredDate: "2023-12-05",
      updatedAt: "2024-01-10T10:15:00",
      mediaRegisteredAt: "2023-12-01",
      source: "リクナビ",
      phone: "090-7777-8888",
      email: "ito@example.com",
      birthday: "1985-04-30",
      gender: "男性",
      education: "中央大学 経済学部",
      postalCode: "220-0001",
      address: "神奈川県横浜市西区1-1-1",
      city: "横浜市西区",
      contactTime: "午前中のみ",
      remarks: "家庭の事情で転職停止",
      memo: "転職活動停止のためクローズ",
      smsConfirmed: false,
      firstContactPlannedAt: "2023-12-06",
      firstContactAt: "",
      attendanceConfirmed: false,
      callDate: "2023-12-06",
      scheduleConfirmedAt: "",
      resumeStatus: "未提出",
      recommendationDate: "",
      meetingVideoLink: "",
      resumeForSend: "",
      workHistoryForSend: "",
      partnerName: "該当なし",
      introductionChance: "低い",
      actionInfo: { nextActionDate: "", finalResult: "リリース(転居不可)" },
      meetingPlans: [],
      resumeDocuments: [],
      hearing: {
        relocation: "不可",
        desiredArea: "横浜市内のみ",
        timing: "未定",
        desiredJob: "管理部門",
        firstInterviewMemo: "初回面談前に離脱",
        currentIncome: "680万円",
        desiredIncome: "700万円",
        reason: "ワークライフバランス改善",
        interviewPreference: "",
        recommendationText: "リファレンス良好",
        otherSelections: "なし",
        employmentStatus: "就業中",
      },
      selectionProgress: [],
      afterAcceptance: { amount: "", jobCategory: "", reportStatuses: [] },
      refundInfo: { resignationDate: "", refundAmount: "", reportStatus: "" },
      csChecklist: {
        validConfirmed: false,
        connectConfirmed: false,
        dial1: true,
        dial2: true,
        dial3: false,
        dial4: false,
        dial5: false,
        dial6: false,
        dial7: false,
        dial8: false,
        dial9: false,
        dial10: false,
      },
      memoDetail: "家庭の事情で無期限延期。",
    },
  ];
}
