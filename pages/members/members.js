import { getSession } from '../../scripts/auth.js';
import { mockUsers } from '../../scripts/mock/users.js';

const MEMBERS_API_BASE = window.API_BASE_URL || 'https://st70aifr22.execute-api.ap-northeast-1.amazonaws.com/prod';
const MEMBERS_LIST_PATH = '/members';
const MEMBERS_REQUESTS_PATH = '/members/requests';
const ROLE_OPTIONS = [
  { value: 'advisor', label: 'アドバイザー' },
  { value: 'caller', label: 'CS' },
  { value: 'marketing', label: 'マーケ' }
];
const TABLE_COLSPAN = 6;
const CREATE_REQUESTS_TABLE_COLSPAN = 7;
const DELETE_REQUESTS_TABLE_COLSPAN = 6;

const membersApi = (path) => `${MEMBERS_API_BASE}${path}`;

let membersCache = [];
let memberCreateRequestsCache = [];
let memberDeleteRequestsCache = [];
let isAdmin = false;
let currentUserId = '';
let cleanupHandlers = [];
let activeMembersTab = 'members';

export function mount() {
  const title = document.getElementById('pageTitle');
  if (title) title.textContent = 'メンバー';

  const session = getSession();
  isAdmin = Boolean(session?.role === 'admin' || session?.roles?.includes('admin'));
  currentUserId = String(session?.user?.id || session?.id || '').trim();
  const page = document.querySelector('.members-page');
  if (page) {
    page.classList.toggle('is-admin', isAdmin);
    page.classList.toggle('can-self-edit', !isAdmin && Boolean(currentUserId));
  }

  const addButton = document.getElementById('memberAddButton');
  if (addButton) addButton.hidden = !isAdmin;

  bindMembersEvents();
  setupMembersTabs();
  setMembersNotice('');
  renderMembersLoading();
  loadMembers();
  if (isAdmin) {
    renderMemberRequestsLoading();
    loadMemberRequests();
  }
}

export function unmount() {
  cleanupHandlers.forEach((cleanup) => cleanup());
  cleanupHandlers = [];
}

function bindMembersEvents() {
  const addButton = document.getElementById('memberAddButton');
  const tableBody = document.getElementById('membersTableBody');
  const createRequestTableBody = document.getElementById('memberCreateRequestsTableBody');
  const deleteRequestTableBody = document.getElementById('memberDeleteRequestsTableBody');
  const modal = document.getElementById('memberModal');
  const modalClose = document.getElementById('memberModalClose');
  const modalCancel = document.getElementById('memberFormCancel');
  const form = document.getElementById('memberForm');
  const tabButtons = document.querySelectorAll('[data-members-tab]');

  addListener(addButton, 'click', () => {
    if (!isAdmin) {
      setMembersNotice('新規登録申請は管理者のみ操作できます。', 'warning');
      return;
    }
    openMemberModal('create');
  });
  addListener(tableBody, 'click', handleTableClick);
  addListener(createRequestTableBody, 'click', handleRequestTableClick);
  addListener(deleteRequestTableBody, 'click', handleRequestTableClick);
  addListener(modalClose, 'click', closeMemberModal);
  addListener(modalCancel, 'click', closeMemberModal);
  addListener(form, 'submit', handleMemberSubmit);
  addListener(document, 'keydown', handleEscapeKey);
  addListener(modal, 'click', (event) => {
    if (event.target === modal) closeMemberModal();
  });
  tabButtons.forEach((button) => addListener(button, 'click', handleMembersTabClick));
}

function addListener(element, type, handler) {
  if (!element) return;
  element.addEventListener(type, handler);
  cleanupHandlers.push(() => element.removeEventListener(type, handler));
}

function setupMembersTabs() {
  if (!isAdmin) {
    setActiveMembersTab('members');
    return;
  }
  const tabs = document.querySelectorAll('[data-members-tab]');
  if (!tabs.length) return;
  const defaultTab = tabs[0]?.dataset?.membersTab || 'members';
  setActiveMembersTab(defaultTab);
}

function handleMembersTabClick(event) {
  const tab = event.currentTarget?.dataset?.membersTab;
  if (!tab) return;
  setActiveMembersTab(tab);
}

function setActiveMembersTab(tab) {
  const allowedTabs = new Set(['members', 'create-requests', 'delete-requests']);
  const normalized = allowedTabs.has(tab) ? tab : 'members';
  activeMembersTab = normalized;
  const tabs = document.querySelectorAll('[data-members-tab]');
  tabs.forEach((button) => {
    const isActive = button.dataset.membersTab === normalized;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });
  const panels = document.querySelectorAll('[data-members-panel]');
  panels.forEach((panel) => {
    const isActive = panel.dataset.membersPanel === normalized;
    panel.hidden = !isActive;
  });
  if (normalized === 'create-requests' || normalized === 'delete-requests') {
    renderMemberRequestsLoading();
    loadMemberRequests();
  }
}

function setMembersNotice(message, tone = 'info') {
  const notice = document.getElementById('membersNotice');
  if (!notice) return;
  notice.hidden = !message;
  notice.textContent = message;
  notice.classList.remove(
    'members-section__notice--success',
    'members-section__notice--warning',
    'members-section__notice--error'
  );
  if (tone === 'success') notice.classList.add('members-section__notice--success');
  if (tone === 'warning') notice.classList.add('members-section__notice--warning');
  if (tone === 'error') notice.classList.add('members-section__notice--error');
}

async function loadMembers() {
  try {
    const session = getSession();
    const headers = { Accept: 'application/json' };
    console.log('[members] loadMembers session:', session);

    if (session?.token) headers.Authorization = `Bearer ${session.token}`;

    if (session?.token === 'mock') {
      console.log('[members] Using mock data');
      // モックデータを使用（少し遅延させてロード感を出す）
      await new Promise(resolve => setTimeout(resolve, 500));
      membersCache = mockUsers.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.role === 'admin',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-15T15:30:00Z'
      }));
      renderMembers(membersCache);
      return;
    }

    const response = await fetch(membersApi(MEMBERS_LIST_PATH), { headers });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    membersCache = normalizeMembers(payload);
    renderMembers(membersCache);
  } catch (error) {
    console.error('[members] load failed', error);
    renderMembersError(error);
  }
}

async function loadMemberRequests() {
  try {
    const payload = await membersRequest(`${MEMBERS_REQUESTS_PATH}?status=pending`, {
      method: 'GET'
    });
    const normalized = normalizeMemberRequests(payload);
    const createRequests = [];
    const deleteRequests = [];
    normalized.forEach((request) => {
      if (isDeleteRequest(request)) {
        deleteRequests.push(request);
      } else {
        createRequests.push(request);
      }
    });
    memberCreateRequestsCache = createRequests;
    memberDeleteRequestsCache = deleteRequests;
    renderMemberRequests(createRequests, deleteRequests);
  } catch (error) {
    console.error('[members] load requests failed', error);
    renderMemberRequestsError(error);
  }
}

function normalizeMemberRequests(result) {
  const raw = Array.isArray(result)
    ? result
    : (result?.items || result?.requests || []);
  if (!Array.isArray(raw)) return [];

  return raw.map((request) => ({
    id: request.id,
    name: request.name || '',
    email: request.email || '',
    role: request.role || '',
    isAdmin: Boolean(request.isAdmin ?? request.is_admin),
    status: request.status || '',
    requestType: request.requestType || request.request_type || '',
    targetUserId: request.targetUserId || request.target_user_id || '',
    requestedAt: request.requestedAt || request.requested_at || request.createdAt || request.created_at || '',
    requestedBy: request.requestedBy || request.requested_by || '',
    requestedByName: request.requestedByName || request.requested_by_name || ''
  }));
}

function normalizeMembers(result) {
  const raw = Array.isArray(result)
    ? result
    : (result?.items || result?.members || result?.users || []);
  if (!Array.isArray(raw)) return [];

  return raw.map((member) => ({
    id: member.id,
    name: member.name || member.fullName || '',
    email: member.email || '',
    role: member.role || '',
    isAdmin: Boolean(member.isAdmin ?? member.is_admin),
    createdAt: member.createdAt || member.created_at || '',
    updatedAt: member.updatedAt || member.updated_at || ''
  }));
}

function isDeleteRequest(request) {
  const type = String(request?.requestType || '').toLowerCase();
  return type === 'delete';
}

function renderMembers(members) {
  const tableBody = document.getElementById('membersTableBody');
  const countEl = document.getElementById('membersCount');
  if (!tableBody) return;

  if (!members.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="${TABLE_COLSPAN}" class="members-empty">メンバーが見つかりませんでした。</td>
      </tr>
    `;
  } else {
    tableBody.innerHTML = members.map(renderMemberRow).join('');
  }

  if (countEl) {
    countEl.textContent = `${members.length}名`;
  }
}

function renderMemberRow(member) {
  const isSelf = isSelfMember(member);
  const name = escapeHtml(member.name || '—');
  const email = escapeHtml(member.email || '—');
  const roleLabel = escapeHtml(getRoleLabel(member.role));
  const roleClass = escapeHtml(getRoleClass(member.role));
  const createdAt = escapeHtml(formatDateTime(member.createdAt));
  const updatedAt = escapeHtml(formatDateTime(member.updatedAt));
  const id = escapeHtml(member.id);
  const adminBadge = member.isAdmin
    ? '<span class="members-admin-badge">管理者</span>'
    : '';
  const actions = isAdmin
    ? `
      <button class="members-action" type="button" data-action="edit">編集</button>
      <button class="members-action members-action--danger" type="button" data-action="delete">削除</button>
    `
    : (isSelf ? '<button class="members-action" type="button" data-action="edit">自分を編集</button>' : '');

  return `
    <tr data-member-id="${id}">
      <td>
        <div class="members-name">
          <span>${name}</span>
          ${adminBadge}
        </div>
      </td>
      <td class="members-cell--email">${email}</td>
      <td>
        <span class="members-role-pill ${roleClass}">${roleLabel}</span>
      </td>
      <td>${createdAt}</td>
      <td>${updatedAt}</td>
      <td data-admin-only>
        <div class="members-actions">
          ${actions}
        </div>
      </td>
    </tr>
  `;
}

function renderMemberRequests(createRequests, deleteRequests) {
  const createTableBody = document.getElementById('memberCreateRequestsTableBody');
  const deleteTableBody = document.getElementById('memberDeleteRequestsTableBody');
  const createCountEl = document.getElementById('memberCreateRequestsCount');
  const deleteCountEl = document.getElementById('memberDeleteRequestsCount');
  const createTabCountEl = document.getElementById('memberCreateRequestsTabCount');
  const deleteTabCountEl = document.getElementById('memberDeleteRequestsTabCount');

  if (createTableBody) {
    if (!createRequests.length) {
      createTableBody.innerHTML = `
        <tr>
          <td colspan="${CREATE_REQUESTS_TABLE_COLSPAN}" class="members-empty">新規登録待ちの申請はありません。</td>
        </tr>
      `;
    } else {
      createTableBody.innerHTML = createRequests.map(renderCreateRequestRow).join('');
    }
  }

  if (deleteTableBody) {
    if (!deleteRequests.length) {
      deleteTableBody.innerHTML = `
        <tr>
          <td colspan="${DELETE_REQUESTS_TABLE_COLSPAN}" class="members-empty">削除承認待ちの申請はありません。</td>
        </tr>
      `;
    } else {
      deleteTableBody.innerHTML = deleteRequests.map(renderDeleteRequestRow).join('');
    }
  }

  if (createCountEl) createCountEl.textContent = `${createRequests.length}件`;
  if (deleteCountEl) deleteCountEl.textContent = `${deleteRequests.length}件`;
  if (createTabCountEl) createTabCountEl.textContent = createRequests.length ? `(${createRequests.length})` : '';
  if (deleteTabCountEl) deleteTabCountEl.textContent = deleteRequests.length ? `(${deleteRequests.length})` : '';
}

function renderCreateRequestRow(request) {
  const name = escapeHtml(request.name || '-');
  const email = escapeHtml(request.email || '-');
  const roleLabel = escapeHtml(getRoleLabel(request.role));
  const roleClass = escapeHtml(getRoleClass(request.role));
  const requestedAt = escapeHtml(formatDateTime(request.requestedAt));
  const requestedBy = escapeHtml(request.requestedByName || request.requestedBy || '-');
  const statusLabel = escapeHtml(getRequestStatusLabel(request.status));
  const id = escapeHtml(request.id);

  return `
    <tr data-request-id="${id}">
      <td>
        <div class="members-name">${name}</div>
      </td>
      <td class="members-cell--email">${email}</td>
      <td>
        <span class="members-role-pill ${roleClass}">${roleLabel}</span>
      </td>
      <td>${requestedBy}</td>
      <td>${requestedAt}</td>
      <td>${statusLabel}</td>
      <td>
        <div class="members-actions">
          <button class="members-action" type="button" data-action="cancel-request">取り下げ</button>
        </div>
      </td>
    </tr>
  `;
}

function renderDeleteRequestRow(request) {
  const name = escapeHtml(request.name || '-');
  const email = escapeHtml(request.email || '-');
  const requestedAt = escapeHtml(formatDateTime(request.requestedAt));
  const requestedBy = escapeHtml(request.requestedByName || request.requestedBy || '-');
  const statusLabel = escapeHtml(getRequestStatusLabel(request.status));
  const id = escapeHtml(request.id);

  return `
    <tr data-request-id="${id}">
      <td>
        <div class="members-name">${name}</div>
      </td>
      <td class="members-cell--email">${email}</td>
      <td>${requestedBy}</td>
      <td>${requestedAt}</td>
      <td>${statusLabel}</td>
      <td>
        <div class="members-actions">
          <button class="members-action members-action--danger" type="button" data-action="cancel-request">取り下げ</button>
        </div>
      </td>
    </tr>
  `;
}

function renderMemberRequestsLoading() {
  const createTableBody = document.getElementById('memberCreateRequestsTableBody');
  const deleteTableBody = document.getElementById('memberDeleteRequestsTableBody');
  const createCountEl = document.getElementById('memberCreateRequestsCount');
  const deleteCountEl = document.getElementById('memberDeleteRequestsCount');
  const createTabCountEl = document.getElementById('memberCreateRequestsTabCount');
  const deleteTabCountEl = document.getElementById('memberDeleteRequestsTabCount');

  if (createTableBody) {
    createTableBody.innerHTML = `
      <tr>
        <td colspan="${CREATE_REQUESTS_TABLE_COLSPAN}" class="members-empty">読み込み中...</td>
      </tr>
    `;
  }
  if (deleteTableBody) {
    deleteTableBody.innerHTML = `
      <tr>
        <td colspan="${DELETE_REQUESTS_TABLE_COLSPAN}" class="members-empty">読み込み中...</td>
      </tr>
    `;
  }
  if (createCountEl) createCountEl.textContent = '';
  if (deleteCountEl) deleteCountEl.textContent = '';
  if (createTabCountEl) createTabCountEl.textContent = '';
  if (deleteTabCountEl) deleteTabCountEl.textContent = '';
}

function renderMemberRequestsError(error) {
  const createTableBody = document.getElementById('memberCreateRequestsTableBody');
  const deleteTableBody = document.getElementById('memberDeleteRequestsTableBody');
  const createCountEl = document.getElementById('memberCreateRequestsCount');
  const deleteCountEl = document.getElementById('memberDeleteRequestsCount');
  const createTabCountEl = document.getElementById('memberCreateRequestsTabCount');
  const deleteTabCountEl = document.getElementById('memberDeleteRequestsTabCount');

  if (createTableBody) {
    createTableBody.innerHTML = `
      <tr>
        <td colspan="${CREATE_REQUESTS_TABLE_COLSPAN}" class="members-empty">
          申請の読み込みに失敗しました: ${escapeHtml(error?.message || 'unknown')}
        </td>
      </tr>
    `;
  }
  if (deleteTableBody) {
    deleteTableBody.innerHTML = `
      <tr>
        <td colspan="${DELETE_REQUESTS_TABLE_COLSPAN}" class="members-empty">
          申請の読み込みに失敗しました: ${escapeHtml(error?.message || 'unknown')}
        </td>
      </tr>
    `;
  }
  if (createCountEl) createCountEl.textContent = '';
  if (deleteCountEl) deleteCountEl.textContent = '';
  if (createTabCountEl) createTabCountEl.textContent = '';
  if (deleteTabCountEl) deleteTabCountEl.textContent = '';
}

function renderMembersLoading() {
  const tableBody = document.getElementById('membersTableBody');
  const countEl = document.getElementById('membersCount');
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="${TABLE_COLSPAN}" class="members-empty">読み込み中...</td>
      </tr>
    `;
  }
  if (countEl) countEl.textContent = '';
}

function renderMembersError(error) {
  const tableBody = document.getElementById('membersTableBody');
  const countEl = document.getElementById('membersCount');
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="${TABLE_COLSPAN}" class="members-empty">
          取得に失敗しました: ${escapeHtml(error?.message || 'unknown')}
        </td>
      </tr>
    `;
  }
  if (countEl) countEl.textContent = '';
}

function handleTableClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const row = button.closest('tr');
  const id = row?.dataset?.memberId;
  if (!id) return;

  const member = membersCache.find((item) => String(item.id) === String(id));
  if (!member) return;

  const action = button.dataset.action;
  if (action === 'edit') {
    if (!isAdmin && !isSelfMember(member)) return;
    openMemberModal('edit', member);
  }
  if (action === 'delete') {
    if (!isAdmin) return;
    handleMemberDelete(member);
  }
}

function handleRequestTableClick(event) {
  if (!isAdmin) return;
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const row = button.closest('tr');
  const id = row?.dataset?.requestId;
  if (!id) return;

  const action = button.dataset.action;
  if (action !== 'cancel-request') return;

  const request =
    memberCreateRequestsCache.find((item) => String(item.id) === String(id)) ||
    memberDeleteRequestsCache.find((item) => String(item.id) === String(id));
  const isDelete = isDeleteRequest(request);
  const label = isDelete ? '削除申請' : '新規登録申請';
  const nameLabel = request?.name ? `${request.name}さんの` : '';
  const confirmed = window.confirm(
    `${nameLabel}${label}を取り下げますか？\n(送信済みのメールリンクも無効になります)`
  );
  if (!confirmed) return;

  cancelMemberRequest(id)
    .then(() => {
      setMembersNotice('申請を取り下げました。', 'success');
      return loadMemberRequests();
    })
    .catch((error) => {
      setMembersNotice(error?.message || '取り下げに失敗しました。', 'error');
    });
}


function openMemberModal(mode, member = null) {
  const isSelf = isSelfMember(member);
  if (mode === 'edit' && !isAdmin && !isSelf) return;
  if (mode === 'create' && !isAdmin) {
    setMembersNotice('新規登録申請は管理者のみ操作できます。', 'warning');
    return;
  }
  const modal = document.getElementById('memberModal');
  const title = document.getElementById('memberModalTitle');
  const requestNote = document.getElementById('memberRequestNote');
  const form = document.getElementById('memberForm');
  const submit = document.getElementById('memberFormSubmit');
  const nameInput = document.getElementById('memberNameInput');
  const emailInput = document.getElementById('memberEmailInput');
  const roleInput = document.getElementById('memberRoleInput');
  const adminInput = document.getElementById('memberAdminInput');
  const passwordInput = document.getElementById('memberPasswordInput');

  if (!modal || !form || !nameInput || !emailInput || !roleInput || !adminInput || !passwordInput) return;

  const isEdit = mode === 'edit';
  const canEditSelf = isSelf && !isAdmin;
  modal.dataset.mode = mode;
  modal.dataset.memberId = member?.id ?? '';

  title.textContent = canEditSelf ? '自分のプロフィール編集' : (isEdit ? 'メンバー編集' : '新規登録申請');
  submit.textContent = isEdit ? '更新する' : '申請する';
  if (requestNote) requestNote.hidden = isEdit;

  nameInput.value = member?.name || '';
  emailInput.value = member?.email || '';
  emailInput.disabled = isEdit && !isAdmin && !isSelf;
  passwordInput.value = '';
  passwordInput.required = !isEdit;
  adminInput.checked = Boolean(member?.isAdmin);

  populateRoleOptions(roleInput, member?.role);
  roleInput.value = member?.role || ROLE_OPTIONS[0]?.value || '';
  roleInput.disabled = canEditSelf;
  adminInput.disabled = canEditSelf;

  setFormError('');

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-modal-open');
}

function closeMemberModal() {
  const modal = document.getElementById('memberModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('has-modal-open');
}

function handleEscapeKey(event) {
  if (event.key !== 'Escape') return;
  const modal = document.getElementById('memberModal');
  if (modal?.classList.contains('is-open')) closeMemberModal();
}

async function handleMemberSubmit(event) {
  event.preventDefault();
  const modal = document.getElementById('memberModal');
  const form = document.getElementById('memberForm');
  const submit = document.getElementById('memberFormSubmit');
  const nameInput = document.getElementById('memberNameInput');
  const emailInput = document.getElementById('memberEmailInput');
  const roleInput = document.getElementById('memberRoleInput');
  const adminInput = document.getElementById('memberAdminInput');
  const passwordInput = document.getElementById('memberPasswordInput');
  if (!modal || !form || !submit || !nameInput || !emailInput || !roleInput || !adminInput || !passwordInput) return;

  const mode = modal.dataset.mode || 'create';
  const memberId = modal.dataset.memberId || '';
  const isSelfEdit = mode === 'edit' && isSelfId(memberId) && !isAdmin;
  if (mode === 'edit' && !isAdmin && !isSelfEdit) return;
  if (mode === 'create' && !isAdmin) {
    setFormError('新規登録申請は管理者のみ操作できます。');
    return;
  }
  const payload = {
    name: nameInput.value.trim()
  };
  const password = passwordInput.value;
  const email = emailInput.value.trim();

  if (!payload.name) {
    setFormError('氏名を入力してください。');
    return;
  }
  if ((mode === 'create' || (mode === 'edit' && (isAdmin || isSelfEdit))) && !email) {
    setFormError('メールアドレスを入力してください。');
    return;
  }
  if (mode === 'create' || (mode === 'edit' && (isAdmin || isSelfEdit))) {
    payload.email = email;
  }
  payload.role = roleInput.value;
  payload.isAdmin = adminInput.checked;
  if (password) {
    payload.password = password;
  }
  if (!payload.role) {
    setFormError('役割を選択してください。');
    return;
  }

  submit.disabled = true;
  submit.textContent = mode === 'edit' ? '更新中...' : '申請中...';
  setFormError('');

  try {
    if (mode === 'edit') {
      await updateMember(memberId, payload);
      closeMemberModal();
      await loadMembers();
    } else {
      const result = await createMember(payload);
      closeMemberModal();
      const mailStatus = result?.notification?.status || result?.mailStatus || '';
      if (mailStatus === 'sent') {
        setMembersNotice('登録申請を受け付けました。メール通知を送信しました。承認完了後にログイン可能になります。', 'success');
      } else if (mailStatus === 'failed') {
        setMembersNotice('登録申請は受け付けましたが、メール送信に失敗しました。運営者へお問い合わせください。', 'warning');
      } else {
        setMembersNotice('登録申請を受け付けました。承認完了後にログイン可能になります。', 'success');
      }
      if (isAdmin) {
        await loadMemberRequests();
      }
    }
  } catch (error) {
    const isServerError = Number(error?.status || 0) >= 500;
    if (mode !== 'edit' && isServerError) {
      setFormError('申請に失敗しました。管理者へお問い合わせください。');
    } else {
      setFormError(error?.message || '申請に失敗しました。管理者へお問い合わせください。');
    }
  } finally {
    submit.disabled = false;
    submit.textContent = mode === 'edit' ? '更新する' : '申請する';
  }
}

async function handleMemberDelete(member) {
  if (!isAdmin) return;
  const confirmed = window.confirm(`${member.name}さんを削除します。よろしいですか？`);
  if (!confirmed) return;
  try {
    const result = await deleteMember(member.id);
    const mailStatus = result?.notification?.status || result?.mailStatus || '';
    if (mailStatus === 'sent') {
      setMembersNotice('削除依頼を送信しました。メール通知を送信しました。承認完了後に反映されます。', 'success');
    } else if (mailStatus === 'failed') {
      setMembersNotice('削除依頼は送信しましたが、メール送信に失敗しました。運営者へお問い合わせください。', 'warning');
    } else {
      setMembersNotice('削除依頼を送信しました。承認完了後に反映されます。', 'success');
    }
    await loadMembers();
  } catch (error) {
    setMembersNotice(error?.message || '削除に失敗しました。', 'error');
  }
}

async function createMember(payload) {
  return membersRequest(MEMBERS_LIST_PATH, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function updateMember(id, payload) {
  if (!id) throw new Error('IDが見つかりません。');
  const encodedId = encodeURIComponent(String(id));
  return membersRequest(`${MEMBERS_LIST_PATH}?id=${encodedId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

async function deleteMember(id) {
  if (!id) throw new Error('IDが見つかりません。');
  const encodedId = encodeURIComponent(String(id));
  return membersRequest(`${MEMBERS_LIST_PATH}?id=${encodedId}`, {
    method: 'DELETE'
  });
}

async function cancelMemberRequest(id) {
  if (!id) throw new Error('IDが見つかりません。');
  const encodedId = encodeURIComponent(String(id));
  return membersRequest(`${MEMBERS_REQUESTS_PATH}?id=${encodedId}`, {
    method: 'DELETE'
  });
}

async function membersRequest(path, options) {
  const session = getSession();
  const headers = { Accept: 'application/json' };
  if (options?.body) headers['Content-Type'] = 'application/json';
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;

  const response = await fetch(membersApi(path), { ...options, headers });
  const payload = await readJson(response);
  if (!response.ok) {
    const error = new Error(payload?.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function populateRoleOptions(select, currentRole) {
  const roles = [...ROLE_OPTIONS];
  const normalized = String(currentRole || '').trim();
  if (normalized && !roles.some((opt) => opt.value === normalized)) {
    roles.unshift({ value: normalized, label: normalized });
  }
  select.innerHTML = roles
    .map((opt) => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`)
    .join('');
}

function setFormError(message) {
  const formError = document.getElementById('memberFormError');
  if (!formError) return;
  formError.textContent = message;
  formError.hidden = !message;
}

function isSelfId(id) {
  return Boolean(currentUserId && String(id) === String(currentUserId));
}

function isSelfMember(member) {
  return Boolean(member?.id && isSelfId(member.id));
}

function getRoleLabel(role) {
  const match = ROLE_OPTIONS.find((opt) => opt.value === role);
  return match?.label || role || '—';
}

function getRequestStatusLabel(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') return '承認済み';
  if (normalized === 'rejected') return '却下';
  if (normalized === 'pending') return '承認待ち';
  if (normalized === 'canceled' || normalized === 'cancelled') return '取り下げ済み';
  return status || '—';
}

function getRoleClass(role) {
  const normalized = String(role || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  return `members-role--${normalized || 'unknown'}`;
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
