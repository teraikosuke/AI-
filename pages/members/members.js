import { getSession } from '../../scripts/auth.js';

const MEMBERS_API_BASE = 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev';
const MEMBERS_LIST_PATH = '/members';
const ROLE_OPTIONS = [
  { value: 'advisor', label: 'アドバイザー' },
  { value: 'caller', label: 'CS' },
  { value: 'marketing', label: 'マーケ' }
];
const TABLE_COLSPAN = 6;

const membersApi = (path) => `${MEMBERS_API_BASE}${path}`;

let membersCache = [];
let isAdmin = false;
let currentUserId = '';
let cleanupHandlers = [];

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
  renderMembersLoading();
  loadMembers();
}

export function unmount() {
  cleanupHandlers.forEach((cleanup) => cleanup());
  cleanupHandlers = [];
}

function bindMembersEvents() {
  const addButton = document.getElementById('memberAddButton');
  const tableBody = document.getElementById('membersTableBody');
  const modal = document.getElementById('memberModal');
  const modalClose = document.getElementById('memberModalClose');
  const modalCancel = document.getElementById('memberFormCancel');
  const form = document.getElementById('memberForm');

  addListener(addButton, 'click', () => openMemberModal('create'));
  addListener(tableBody, 'click', handleTableClick);
  addListener(modalClose, 'click', closeMemberModal);
  addListener(modalCancel, 'click', closeMemberModal);
  addListener(form, 'submit', handleMemberSubmit);
  addListener(document, 'keydown', handleEscapeKey);
  addListener(modal, 'click', (event) => {
    if (event.target === modal) closeMemberModal();
  });
}

function addListener(element, type, handler) {
  if (!element) return;
  element.addEventListener(type, handler);
  cleanupHandlers.push(() => element.removeEventListener(type, handler));
}

async function loadMembers() {
  try {
    const session = getSession();
    const headers = { Accept: 'application/json' };
    if (session?.token) headers.Authorization = `Bearer ${session.token}`;

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

function openMemberModal(mode, member = null) {
  const isSelf = isSelfMember(member);
  if (!isAdmin && !(mode === 'edit' && isSelf)) return;
  const modal = document.getElementById('memberModal');
  const title = document.getElementById('memberModalTitle');
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

  title.textContent = canEditSelf ? '自分のプロフィール編集' : (isEdit ? 'メンバー編集' : 'メンバー追加');
  submit.textContent = isEdit ? '更新する' : '追加する';

  nameInput.value = member?.name || '';
  emailInput.value = member?.email || '';
  emailInput.disabled = isEdit;
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
  if (!isAdmin && !isSelfEdit) return;
  const payload = {
    name: nameInput.value.trim()
  };
  const password = passwordInput.value;
  const email = emailInput.value.trim();

  if (!payload.name) {
    setFormError('氏名を入力してください。');
    return;
  }
  if (mode === 'create' && !email) {
    setFormError('メールアドレスを入力してください。');
    return;
  }
  if (mode === 'create') {
    payload.email = email;
  }
  if (!isSelfEdit) {
    payload.role = roleInput.value;
    payload.isAdmin = adminInput.checked;
  }
  if (password) {
    payload.password = password;
  }
  if (!isSelfEdit && !payload.role) {
    setFormError('役割を選択してください。');
    return;
  }

  submit.disabled = true;
  submit.textContent = mode === 'edit' ? '更新中...' : '追加中...';
  setFormError('');

  try {
    if (mode === 'edit') {
      await updateMember(memberId, payload);
    } else {
      await createMember(payload);
    }
    closeMemberModal();
    await loadMembers();
  } catch (error) {
    setFormError(error?.message || '保存に失敗しました。');
  } finally {
    submit.disabled = false;
    submit.textContent = mode === 'edit' ? '更新する' : '追加する';
  }
}

async function handleMemberDelete(member) {
  if (!isAdmin) return;
  const confirmed = window.confirm(`${member.name}さんを削除します。よろしいですか？`);
  if (!confirmed) return;
  try {
    await deleteMember(member.id);
    await loadMembers();
  } catch (error) {
    window.alert(error?.message || '削除に失敗しました。');
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
  return membersRequest(`${MEMBERS_LIST_PATH}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

async function deleteMember(id) {
  if (!id) throw new Error('IDが見つかりません。');
  return membersRequest(`${MEMBERS_LIST_PATH}/${id}`, {
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
    throw new Error(payload?.error || `HTTP ${response.status}`);
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
