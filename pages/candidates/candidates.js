import { fetchCandidateMaster } from '../../scripts/services/candidatesMaster.js';

// Candidates Page JavaScript Module
const filterConfig = [
  { id: 'candidatesFilterYear', event: 'change' },
  { id: 'candidatesFilterMonth', event: 'change' },
  { id: 'candidatesFilterDay', event: 'change' },
  { id: 'candidatesFilterSource', event: 'change' },
  { id: 'candidatesFilterName', event: 'input' },
  { id: 'candidatesFilterCompany', event: 'input' },
  { id: 'candidatesFilterAdvisor', event: 'input' },
  { id: 'candidatesFilterValid', event: 'change' },
  { id: 'candidatesFilterPhase', event: 'change' }
];

const reportStatusOptions = ['LINE報告済み', '個人シート反映済み', '請求書送付済み'];
const finalResultOptions = ['----', 'リリース(転居不可)', 'リリース(精神疾患)', 'リリース(人柄)', '飛び', '辞退', '承諾'];
const refundReportOptions = ['LINE報告済み', '企業報告済み'];
const modalHandlers = {
  closeButton: null,
  overlay: null,
  keydown: null
};

let allCandidates = [];
let filteredCandidates = [];
let selectedCandidateId = null;

export function mount() {
  initializeCandidatesFilters();
  initializeSortControl();
  initializeTableInteraction();
  initializeDetailModal();
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

  const resetButton = document.getElementById('candidatesFilterReset');
  if (resetButton) {
    resetButton.addEventListener('click', handleFilterReset);
  }
}

function initializeSortControl() {
  const sortSelect = document.getElementById('candidatesSortOrder');
  if (sortSelect) {
    sortSelect.addEventListener('change', handleFilterChange);
  }
}

function initializeTableInteraction() {
  const tableBody = document.getElementById('candidatesTableBody');
  if (tableBody) {
    tableBody.addEventListener('click', handleTableClick);
  }
}

async function loadCandidatesData() {
  try {
    allCandidates = await fetchCandidateMaster({});
  } catch (error) {
    console.error('Failed to load candidates master', error);
    allCandidates = [];
  }
  handleFilterChange();
}

function handleFilterChange() {
  const filters = collectFilters();
  const filtered = applyFilters(allCandidates, filters);
  const sorted = sortCandidates(filtered, filters.sortOrder);
  filteredCandidates = sorted;
  renderCandidatesTable(sorted);
  updateCandidatesCount(sorted.length);
  refreshSelectionState();
}

function collectFilters() {
  return {
    year: getElementValue('candidatesFilterYear'),
    month: getElementValue('candidatesFilterMonth'),
    day: getElementValue('candidatesFilterDay'),
    source: getElementValue('candidatesFilterSource'),
    name: getElementValue('candidatesFilterName'),
    company: getElementValue('candidatesFilterCompany'),
    advisor: getElementValue('candidatesFilterAdvisor'),
    valid: getElementValue('candidatesFilterValid'),
    phase: getElementValue('candidatesFilterPhase'),
    sortOrder: getElementValue('candidatesSortOrder') || 'desc'
  };
}

function getElementValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : '';
}

function applyFilters(list, filters) {
  return list.filter(candidate => {
    const [year, month, day] = candidate.registeredDate.split('-');
    if (filters.year && year !== filters.year) return false;
    if (filters.month && month !== filters.month) return false;
    if (filters.day && day !== filters.day) return false;
    if (filters.source && candidate.source !== filters.source) return false;
    if (filters.phase && candidate.phase !== filters.phase) return false;
    if (filters.valid && String(candidate.validApplication) !== filters.valid) return false;

    if (filters.name && !candidate.candidateName.toLowerCase().includes(filters.name.toLowerCase())) {
      return false;
    }

    if (filters.company && !candidate.companyName.toLowerCase().includes(filters.company.toLowerCase())) {
      return false;
    }

    if (filters.advisor && !candidate.advisorName.toLowerCase().includes(filters.advisor.toLowerCase())) {
      return false;
    }

    return true;
  });
}

function sortCandidates(list, order) {
  const sorted = [...list];
  sorted.sort((a, b) => {
    const aTime = new Date(a.registeredDate).getTime();
    const bTime = new Date(b.registeredDate).getTime();
    return order === 'asc' ? aTime - bTime : bTime - aTime;
  });
  return sorted;
}

function renderCandidatesTable(list) {
  const tableBody = document.getElementById('candidatesTableBody');
  if (!tableBody) return;

  if (list.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="22" class="text-center text-slate-500 py-6">条件に一致する候補者が見つかりません。</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = list.map(candidate => buildTableRow(candidate)).join('');
  highlightSelectedRow();
}

function buildTableRow(candidate) {
  const age = candidate.age ?? calculateAge(candidate.birthday);
  return `
    <tr class="candidate-item" data-id="${candidate.id}">
      <td>${renderValidityBadge(candidate.validApplication)}</td>
      <td>${renderStatusChip(candidate.phoneConnected)}</td>
      <td>${renderStatusChip(candidate.smsSent)}</td>
      <td>${candidate.advisorName || '-'}</td>
      <td>${candidate.callerName || '-'}</td>
      <td><span class="candidate-phase-pill">${candidate.phase}</span></td>
      <td>${formatDateJP(candidate.registeredDate)}</td>
      <td>${candidate.source}</td>
      <td>${candidate.companyName}</td>
      <td>${candidate.jobName}</td>
      <td class="font-semibold text-slate-900">${candidate.candidateName}</td>
      <td>${candidate.phone}</td>
      <td>${formatDateJP(candidate.birthday)}</td>
      <td>${age ? `${age}歳` : '-'}</td>
      <td class="cell-wrap">${candidate.memo || '-'}</td>
      <td>${formatDateJP(candidate.firstContactPlannedAt)}</td>
      <td>${formatDateJP(candidate.firstContactAt)}</td>
      <td>${renderStatusChip(candidate.attendanceConfirmed, '確認済', '未')}</td>
      <td>${candidate.email}</td>
      <td>${formatDateJP(candidate.callDate)}</td>
      <td>${formatDateJP(candidate.scheduleConfirmedAt)}</td>
      <td>${candidate.resumeStatus || '-'}</td>
    </tr>
  `;
}

function renderValidityBadge(isValid) {
  const tone = isValid ? 'candidate-pill-positive' : 'candidate-pill-warning';
  const label = isValid ? '有効' : '無効';
  return `<span class="candidate-pill ${tone}">${label}</span>`;
}

function renderStatusChip(value, positiveLabel = '済', negativeLabel = '未') {
  const tone = value ? 'candidate-pill-positive' : 'candidate-pill-muted';
  const label = value ? positiveLabel : negativeLabel;
  return `<span class="candidate-pill ${tone}">${label}</span>`;
}

function updateCandidatesCount(count) {
  const element = document.getElementById('candidatesResultCount');
  if (element) {
    element.textContent = `${count}件`;
  }
}

function refreshSelectionState() {
  if (!selectedCandidateId) {
    highlightSelectedRow();
    return;
  }

  const candidate = filteredCandidates.find(item => item.id === selectedCandidateId);
  if (!candidate) {
    closeCandidateModal();
    return;
  }

  if (isCandidateModalOpen()) {
    renderCandidateDetail(candidate);
  }
  highlightSelectedRow();
}

function highlightSelectedRow() {
  const rows = document.querySelectorAll('#candidatesTableBody .candidate-item');
  const modalOpen = isCandidateModalOpen();
  rows.forEach(row => {
    const active = modalOpen && selectedCandidateId && row.dataset.id === selectedCandidateId;
    row.classList.toggle('is-active', Boolean(active));
  });
}

function handleTableClick(event) {
  const row = event.target.closest('tr[data-id]');
  if (!row) return;
  const candidate = filteredCandidates.find(item => item.id === row.dataset.id);
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
    element.value = '';
  });

  const sortSelect = document.getElementById('candidatesSortOrder');
  if (sortSelect) {
    sortSelect.value = 'desc';
  }

  selectedCandidateId = null;
  closeCandidateModal({ clearSelection: false });
  handleFilterChange();
}

function renderCandidateDetail(candidate) {
  const container = document.getElementById('candidateDetailContent');
  if (!container) return;

  if (!candidate) {
    container.innerHTML = getCandidateDetailPlaceholder();
    return;
  }

  const header = `
    <div class="candidate-detail-header">
      <div>
        <span class="candidate-phase-pill">${candidate.phase}</span>
        <h3>${candidate.candidateName}</h3>
        <p>${candidate.companyName} / ${candidate.jobName}</p>
        <p class="candidate-contact-row">
          <span>${candidate.phone}</span>
          <span>${candidate.email}</span>
        </p>
      </div>
      <div class="candidate-detail-header-meta">
        <div><strong>担当</strong><span>${candidate.advisorName}</span></div>
        <div><strong>登録日</strong><span>${formatDateJP(candidate.registeredDate)}</span></div>
        <div><strong>次回アクション</strong><span>${formatDateJP(candidate.actionInfo?.nextActionDate)}</span></div>
      </div>
    </div>
  `;

  const registrationSection = renderDetailSection('登録情報', renderInfoGrid([
    { label: '登録日', value: formatDateJP(candidate.registeredDate) },
    { label: '更新日時', value: formatDateTimeJP(candidate.updatedAt) },
    { label: '媒体登録日', value: formatDateJP(candidate.mediaRegisteredAt) },
    { label: '担当者', value: candidate.advisorName },
    { label: '通電実施者', value: candidate.callerName },
    { label: '担当パートナー', value: candidate.partnerName },
    { label: '紹介可能性', value: candidate.introductionChance },
    { label: '流入媒体', value: candidate.source }
  ]));

  const meetingSection = renderDetailSection('面談', renderMeetingSection(candidate));
  const applicantInfoSection = renderDetailSection('求職者情報', renderApplicantInfoSection(candidate));
  const hearingSection = renderDetailSection('ヒアリング事項', renderHearingSection(candidate));
  const progressSection = renderDetailSection('選考進捗', renderSelectionProgressSection(candidate));
  const afterAcceptanceSection = renderDetailSection('入社承諾後', renderAfterAcceptanceSection(candidate));
  const refundSection = renderDetailSection('返金・減額【自動入力】', renderRefundSection(candidate));
  const nextActionSection = renderDetailSection('次回アクション日【対応可否】', renderNextActionSection(candidate));
  const csSection = renderDetailSection('CS項目', renderCsSection(candidate));
  const memoSection = renderDetailSection('自由メモ記入欄', renderMemoSection(candidate));

  container.innerHTML = `
    ${header}
    <div class="candidate-detail-sections">
      ${registrationSection}
      ${meetingSection}
      ${applicantInfoSection}
      ${hearingSection}
      ${progressSection}
      ${afterAcceptanceSection}
      ${refundSection}
      ${nextActionSection}
      ${csSection}
      ${memoSection}
    </div>
  `;

  attachDetailPanelEvents();
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
  const container = document.getElementById('candidateDetailContent');
  if (container) {
    container.innerHTML = getCandidateDetailPlaceholder();
  }
}

function renderDetailSection(title, body) {
  return `
    <section class="candidate-detail-section">
      <header class="candidate-detail-section-header">
        <h4>${title}</h4>
      </header>
      <div class="candidate-detail-section-body">
        ${body}
      </div>
    </section>
  `;
}

function renderInfoGrid(items) {
  return `
    <dl class="detail-grid">
      ${items
        .map(item => {
          return `
            <div class="detail-grid-item">
              <dt>${item.label}</dt>
              <dd>${formatDisplayValue(item.value)}</dd>
            </div>
          `;
        })
        .join('')}
    </dl>
  `;
}

function renderMeetingSection(candidate) {
  const items = [
    { label: 'SMS送信確認', value: candidate.smsConfirmed ? '済' : '未' },
    { label: 'フェーズ', value: candidate.phase },
    { label: '通電日', value: formatDateJP(candidate.callDate) },
    { label: '日程確定日', value: formatDateJP(candidate.scheduleConfirmedAt) },
    { label: '新規接触予定日', value: formatDateJP(candidate.firstContactPlannedAt) },
    { label: '新規接触日', value: formatDateJP(candidate.firstContactAt) },
    { label: '着座確認', value: candidate.attendanceConfirmed ? '確認済' : '未' },
    { label: '企業への推薦日', value: formatDateJP(candidate.recommendationDate) }
  ];

  const meetings = candidate.meetingPlans || [];

  return `
    ${renderInfoGrid(items)}
    <div class="repeatable-block">
      <div class="repeatable-header">
        <h5>2回目以降の面談予定</h5>
        <button type="button" id="addMeetingButton" class="repeatable-add-btn">＋ 面談予定を追加</button>
      </div>
      <div class="repeatable-list" id="candidateMeetingList">
        ${meetings.map(plan => renderMeetingPlanRow(plan)).join('')}
      </div>
    </div>
  `;
}

function renderMeetingPlanRow(plan) {
  return `
    <div class="repeatable-row meeting-row">
      <label>${plan.sequence}回目面談予定日</label>
      <input type="date" class="repeatable-input" value="${plan.plannedDate || ''}" />
      <label class="meeting-check">
        <input type="checkbox" ${plan.attendance ? 'checked' : ''} />
        着座確認
      </label>
    </div>
  `;
}

function renderApplicantInfoSection(candidate) {
  const infoItems = [
    { label: '求職者コード', value: candidate.candidateCode },
    { label: '求職者名', value: candidate.candidateName },
    { label: '求職者名（ヨミガナ）', value: candidate.candidateKana },
    { label: '応募企業名', value: candidate.companyName },
    { label: '応募求人名', value: candidate.jobName },
    { label: '勤務地', value: candidate.workLocation },
    { label: '面談動画リンク', value: renderLink(candidate.meetingVideoLink) },
    { label: '履歴書（送付用）', value: renderLink(candidate.resumeForSend) },
    { label: '職務経歴書（送付用）', value: renderLink(candidate.workHistoryForSend) },
    { label: '生年月日', value: formatDateJP(candidate.birthday) },
    { label: '年齢', value: candidate.age ? `${candidate.age}歳` : '-' },
    { label: '性別', value: candidate.gender },
    { label: '最終学歴', value: candidate.education },
    { label: '電話番号', value: candidate.phone },
    { label: 'メールアドレス', value: candidate.email },
    { label: '郵便番号', value: candidate.postalCode },
    { label: '現住所', value: candidate.address },
    { label: '市区町村', value: candidate.city },
    { label: '連絡希望時間帯', value: candidate.contactTime },
    { label: '備考', value: candidate.remarks || candidate.memo }
  ];

  const resumeRows = (candidate.resumeDocuments || []).map(doc => renderResumeRow(doc)).join('');

  return `
    ${renderInfoGrid(infoItems)}
    <div class="repeatable-block">
      <div class="repeatable-header">
        <h5>経歴書</h5>
        <button type="button" id="addResumeButton" class="repeatable-add-btn">＋ 経歴書を追加</button>
      </div>
      <div class="repeatable-list" id="candidateResumeList">
        ${resumeRows}
      </div>
    </div>
  `;
}

function renderResumeRow(doc) {
  return `
    <div class="repeatable-row">
      <label>${doc.label}</label>
      <input type="text" class="repeatable-input" value="${doc.value || ''}" placeholder="リンクまたはメモを入力" />
    </div>
  `;
}

function renderHearingSection(candidate) {
  const hearing = candidate.hearing || {};
  const textareaItems = [
    { key: 'relocation', label: '転居' },
    { key: 'desiredArea', label: '希望エリア' },
    { key: 'timing', label: '転職時期' },
    { key: 'desiredJob', label: '希望職種' },
    { key: 'firstInterviewMemo', label: '初回面談メモ' },
    { key: 'currentIncome', label: '現年収' },
    { key: 'desiredIncome', label: '希望年収' },
    { key: 'reason', label: '転職理由・転職軸' },
    { key: 'interviewPreference', label: '面接希望日' },
    { key: 'recommendationText', label: '推薦文' },
    { key: 'otherSelections', label: '他社選考状況' }
  ];

  const textareaGrid = textareaItems
    .map(item => {
      return `
        <label class="detail-textarea-field">
          <span>${item.label}</span>
          <textarea rows="2">${hearing[item.key] || ''}</textarea>
        </label>
      `;
    })
    .join('');

  const statusSelect = `
    <label class="detail-textarea-field">
      <span>就業ステータス</span>
      <select class="filter-input">
        ${['未回答', '就業中', '離職中']
          .map(option => `<option value="${option}" ${option === hearing.employmentStatus ? 'selected' : ''}>${option}</option>`)
          .join('')}
      </select>
    </label>
  `;

  return `<div class="detail-textarea-grid">${textareaGrid + statusSelect}</div>`;
}

function renderSelectionProgressSection(candidate) {
  const rows = (candidate.selectionProgress || []).map(row => renderSelectionRow(row)).join('');
  return `
    <div class="repeatable-header">
      <h5>企業ごとの進捗</h5>
      <button type="button" id="addSelectionRowButton" class="repeatable-add-btn">＋ 企業を追加</button>
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
          </tr>
        </thead>
        <tbody id="selectionProgressBody">
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function renderSelectionRow(row = {}) {
  const buildCell = (value = '', type = 'text') =>
    `<td><input type="${type}" class="detail-table-input" value="${value || ''}" /></td>`;

  return `
    <tr>
      ${buildCell(row.companyName)}
      ${buildCell(row.route)}
      ${buildCell(row.recommendationDate, 'date')}
      ${buildCell(row.interviewSetupDate, 'date')}
      ${buildCell(row.interviewDate, 'date')}
      ${buildCell(row.offerDate, 'date')}
      ${buildCell(row.closingDate, 'date')}
      ${buildCell(row.acceptanceDate, 'date')}
      ${buildCell(row.onboardingDate, 'date')}
      ${buildCell(row.preJoinDeclineDate, 'date')}
      ${buildCell(row.fee)}
      ${buildCell(row.status)}
      ${buildCell(row.notes)}
    </tr>
  `;
}

function renderAfterAcceptanceSection(candidate) {
  const data = candidate.afterAcceptance || {};
  return `
    ${renderInfoGrid([
      { label: '受注金額（税抜）', value: data.amount },
      { label: '職種', value: data.jobCategory }
    ])}
    <div class="detail-checkbox-row">
      ${reportStatusOptions
        .map(option => {
          const checked = data.reportStatuses?.includes(option) ? 'checked' : '';
          return `
            <label class="cs-checkbox">
              <input type="checkbox" ${checked} />
              <span>${option}</span>
            </label>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderRefundSection(candidate) {
  const info = candidate.refundInfo || {};
  return `
    ${renderInfoGrid([
      { label: '退職日', value: formatDateJP(info.resignationDate) },
      { label: '返金・減額（税抜）', value: info.refundAmount }
    ])}
    <label class="detail-textarea-field">
      <span>返金報告</span>
      <select class="filter-input">
        <option value="">選択してください</option>
        ${refundReportOptions
          .map(option => `<option value="${option}" ${option === info.reportStatus ? 'selected' : ''}>${option}</option>`)
          .join('')}
      </select>
    </label>
  `;
}

function renderNextActionSection(candidate) {
  const action = candidate.actionInfo || {};
  return `
    <div class="detail-grid">
      <div class="detail-grid-item">
        <dt>次回アクション日</dt>
        <dd><input type="date" class="detail-inline-input" value="${action.nextActionDate || ''}" /></dd>
      </div>
      <div class="detail-grid-item">
        <dt>最終結果</dt>
        <dd>
          <select class="filter-input">
            ${finalResultOptions
              .map(option => `<option value="${option}" ${option === action.finalResult ? 'selected' : ''}>${option}</option>`)
              .join('')}
          </select>
        </dd>
      </div>
    </div>
  `;
}

function renderCsSection(candidate) {
  const checklist = candidate.csChecklist || {};
  const csItems = [
    { key: 'validConfirmed', label: '有効応募確認' },
    { key: 'connectConfirmed', label: '通電確認' },
    { key: 'dial1', label: '1回目架電' },
    { key: 'dial2', label: '2回目架電' },
    { key: 'dial3', label: '3回目架電' },
    { key: 'dial4', label: '4回目架電' },
    { key: 'dial5', label: '5回目架電' },
    { key: 'dial6', label: '6回目架電' },
    { key: 'dial7', label: '7回目架電' },
    { key: 'dial8', label: '8回目架電' },
    { key: 'dial9', label: '9回目架電' },
    { key: 'dial10', label: '10回目架電' }
  ];

  return `
    <div class="cs-checkbox-grid">
      ${csItems
        .map(item => {
          const checked = checklist[item.key] ? 'checked' : '';
          return `
            <label class="cs-checkbox">
              <input type="checkbox" ${checked} />
              <span>${item.label}</span>
            </label>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderMemoSection(candidate) {
  return `
    <label class="detail-textarea-field">
      <span>自由メモ</span>
      <textarea rows="4" id="candidateFreeMemo">${candidate.memoDetail || ''}</textarea>
    </label>
  `;
}

function attachDetailPanelEvents() {
  const meetingButton = document.getElementById('addMeetingButton');
  if (meetingButton) {
    meetingButton.addEventListener('click', () => {
      const list = document.getElementById('candidateMeetingList');
      if (!list) return;
      const nextSequence = list.children.length + 2;
      list.insertAdjacentHTML(
        'beforeend',
        renderMeetingPlanRow({ sequence: nextSequence, plannedDate: '', attendance: false })
      );
    });
  }

  const resumeButton = document.getElementById('addResumeButton');
  if (resumeButton) {
    resumeButton.addEventListener('click', () => {
      const list = document.getElementById('candidateResumeList');
      if (!list) return;
      const nextIndex = list.children.length + 1;
      list.insertAdjacentHTML(
        'beforeend',
        renderResumeRow({ label: `経歴書${nextIndex}`, value: '' })
      );
    });
  }

  const selectionButton = document.getElementById('addSelectionRowButton');
  if (selectionButton) {
    selectionButton.addEventListener('click', () => {
      const tableBody = document.getElementById('selectionProgressBody');
      if (!tableBody) return;
      tableBody.insertAdjacentHTML('beforeend', renderSelectionRow({}));
    });
  }
}

function initializeDetailModal() {
  const modal = document.getElementById('candidateDetailModal');
  const closeButton = document.getElementById('candidateDetailClose');

  if (modal) {
    modalHandlers.overlay = event => {
      if (event.target === modal) {
        closeCandidateModal();
      }
    };
    modal.addEventListener('click', modalHandlers.overlay);
  }

  if (closeButton) {
    modalHandlers.closeButton = () => closeCandidateModal();
    closeButton.addEventListener('click', modalHandlers.closeButton);
  }

  modalHandlers.keydown = event => {
    if (event.key === 'Escape' && isCandidateModalOpen()) {
      closeCandidateModal();
    }
  };
  document.addEventListener('keydown', modalHandlers.keydown);
}

function openCandidateModal() {
  const modal = document.getElementById('candidateDetailModal');
  if (!modal) return;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-modal-open');
}

function closeCandidateModal({ clearSelection = true } = {}) {
  const modal = document.getElementById('candidateDetailModal');
  if (!modal) return;
  const wasOpen = modal.classList.contains('is-open');
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  if (wasOpen) {
    setCandidateDetailPlaceholder();
  }
  document.body.classList.remove('has-modal-open');
  if (clearSelection) {
    selectedCandidateId = null;
  }
  highlightSelectedRow();
}

function isCandidateModalOpen() {
  const modal = document.getElementById('candidateDetailModal');
  return modal ? modal.classList.contains('is-open') : false;
}

function formatDateJP(dateLike) {
  if (!dateLike) return '-';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return dateLike;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function formatDateTimeJP(dateTimeLike) {
  if (!dateTimeLike) return '-';
  const date = new Date(dateTimeLike);
  if (Number.isNaN(date.getTime())) return dateTimeLike;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatDateJP(dateTimeLike)} ${hours}:${minutes}`;
}

function formatDisplayValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  return value;
}

function renderLink(url) {
  if (!url) return '-';
  return `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`;
}

function calculateAge(birthday) {
  if (!birthday) return null;
  const birthDate = new Date(birthday);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
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

  const resetButton = document.getElementById('candidatesFilterReset');
  if (resetButton) {
    resetButton.removeEventListener('click', handleFilterReset);
  }

  const sortSelect = document.getElementById('candidatesSortOrder');
  if (sortSelect) {
    sortSelect.removeEventListener('change', handleFilterChange);
  }

  const tableBody = document.getElementById('candidatesTableBody');
  if (tableBody) {
    tableBody.removeEventListener('click', handleTableClick);
  }

  const modal = document.getElementById('candidateDetailModal');
  const closeButton = document.getElementById('candidateDetailClose');

  if (modal && modalHandlers.overlay) {
    modal.removeEventListener('click', modalHandlers.overlay);
    modalHandlers.overlay = null;
  }

  if (closeButton && modalHandlers.closeButton) {
    closeButton.removeEventListener('click', modalHandlers.closeButton);
    modalHandlers.closeButton = null;
  }

  if (modalHandlers.keydown) {
    document.removeEventListener('keydown', modalHandlers.keydown);
    modalHandlers.keydown = null;
  }
}
