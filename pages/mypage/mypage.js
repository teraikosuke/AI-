import { getSession } from '../../scripts/auth.js';
import { authRepo } from '../../scripts/api/repositories/auth.js';
import { mount as mountYield } from '../yield/yield.js';
import { mount as mountGoalSettings } from '../goal-settings/goal-settings.js';

const MYPAGE_API_BASE = 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev';
const MYPAGE_PATH = '/mypage';

const state = {
  roleView: 'advisor',
  closedVisible: false,
  closedCandidates: [],
  candidates: [],
  toggleHandler: null
};

export async function mount() {
  const session = await ensureSession();
  if (!session) {
    renderError('ログイン情報が取得できませんでした。');
    return;
  }

  ensureStyleLink('mypage-yield-css', '../yield/yield.css');
  ensureStyleLink('mypage-goal-settings-css', '../goal-settings/goal-settings.css');

  state.roleView = resolveRoleView(session);
  updateRoleBadge();

  await injectYieldSummary();
  await injectGoalSettings();

  await loadMypageData(session);
  bindActions();

  mountYield();
  mountGoalSettings();
}

export function unmount() {
  const toggle = document.getElementById('mypageCandidatesToggleClosed');
  if (toggle && state.toggleHandler) {
    toggle.removeEventListener('click', state.toggleHandler);
  }
  state.toggleHandler = null;
}

async function ensureSession() {
  const existing = getSession();
  if (existing) return existing;
  try {
    return await authRepo.me();
  } catch {
    return null;
  }
}

function resolveRoleView(session) {
  const rawRole = String(session?.role || session?.roles?.[0] || '').toLowerCase();
  return rawRole.includes('caller') ? 'caller' : 'advisor';
}

function updateRoleBadge() {
  const badge = document.getElementById('mypageRoleBadge');
  if (!badge) return;
  badge.textContent = state.roleView;
  badge.classList.toggle('is-caller', state.roleView === 'caller');
}

function ensureStyleLink(id, path) {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = new URL(path, import.meta.url).href;
  document.head.appendChild(link);
}

async function injectYieldSummary() {
  const container = document.getElementById('mypageYieldSummary');
  if (!container) return;
  container.innerHTML = '';

  try {
    const url = new URL('../yield/index.html', import.meta.url).href;
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`yield html ${res.status}`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const wrapper = doc.querySelector('section[data-kpi="v2"]');
    const personalSection = wrapper?.querySelector('.kpi-v2-section');
    if (!personalSection) return;

    const clone = document.importNode(personalSection, true);
    clone.querySelectorAll('[data-kpi-tab="personal-graphs"], [data-kpi-tab="personal-daily"]').forEach((el) => {
      el.remove();
    });
    clone.querySelectorAll('[data-kpi-tab-panel="personal-graphs"], [data-kpi-tab-panel="personal-daily"]').forEach((el) => {
      el.remove();
    });

    const host = document.createElement('section');
    host.className = 'kpi-v2-wrapper space-y-6';
    host.appendChild(clone);
    container.appendChild(host);
  } catch (error) {
    console.warn('[mypage] failed to load yield summary', error);
  }
}

async function injectGoalSettings() {
  const container = document.getElementById('mypageGoalSettings');
  if (!container) return;
  container.innerHTML = '';

  try {
    const url = new URL('../goal-settings/index.html', import.meta.url).href;
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`goal settings html ${res.status}`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const settings = doc.querySelector('#settingsPage');
    if (!settings) return;
    container.appendChild(document.importNode(settings, true));
  } catch (error) {
    console.warn('[mypage] failed to load goal settings', error);
  }
}

async function loadMypageData(session) {
  const userId = session?.user?.id;
  if (!userId) {
    renderError('ユーザー情報が取得できませんでした。');
    return;
  }

  const url = new URL(`${MYPAGE_API_BASE}${MYPAGE_PATH}`);
  url.searchParams.set('userId', String(userId));
  url.searchParams.set('role', state.roleView);
  url.searchParams.set('limit', '10');

  const headers = { Accept: 'application/json' };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;

  try {
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error(`mypage HTTP ${res.status}`);
    const data = await res.json();

    renderTasks(data.tasks || []);
    renderNotifications(data.notifications || []);
    renderCandidates(data.candidates || [], data.closedCandidates || []);
  } catch (error) {
    console.error('[mypage] failed to load data', error);
    renderError('マイページのデータ取得に失敗しました。');
  }
}

function bindActions() {
  const toggle = document.getElementById('mypageCandidatesToggleClosed');
  if (!toggle) return;
  state.toggleHandler = () => {
    state.closedVisible = !state.closedVisible;
    renderCandidates(state.candidates, state.closedCandidates);
  };
  toggle.addEventListener('click', state.toggleHandler);
}

function renderTasks(tasks) {
  const section = document.getElementById('mypageTasksSection');
  const body = document.getElementById('mypageTasksBody');
  const empty = document.getElementById('mypageTasksEmpty');
  const tableWrapper = document.getElementById('mypageTasksTableWrapper');

  if (!section || !body || !empty || !tableWrapper) return;

  if (state.roleView !== 'advisor') {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  if (!tasks.length) {
    body.innerHTML = '';
    empty.classList.add('is-visible');
    tableWrapper.hidden = true;
    return;
  }

  tableWrapper.hidden = false;
  empty.classList.remove('is-visible');
  body.innerHTML = tasks
    .map((task) => `
      <tr>
        <td>${escapeHtml(task.candidateName || '-') }</td>
        <td>${escapeHtml(task.phase || '-') }</td>
        <td>${formatAction(task.nextAction)}</td>
      </tr>
    `)
    .join('');
}

function renderNotifications(notifications) {
  const list = document.getElementById('mypageNotificationsList');
  const empty = document.getElementById('mypageNotificationsEmpty');
  if (!list || !empty) return;

  if (!notifications.length) {
    list.innerHTML = '';
    empty.classList.add('is-visible');
    return;
  }

  empty.classList.remove('is-visible');
  list.innerHTML = notifications
    .map((note) => {
      const date = formatDateJP(note.date);
      const name = note.candidateName ? ` - ${note.candidateName}` : '';
      return `
        <li class="mypage-list-item">
          <span>${escapeHtml(note.label || '更新')}${escapeHtml(name)}</span>
          <span class="mypage-list-meta">${escapeHtml(date)}</span>
        </li>
      `;
    })
    .join('');
}

function renderCandidates(candidates, closedCandidates) {
  const head = document.getElementById('mypageCandidatesHead');
  const body = document.getElementById('mypageCandidatesBody');
  const empty = document.getElementById('mypageCandidatesEmpty');
  const subtitle = document.getElementById('mypageCandidatesSubtitle');
  const toggle = document.getElementById('mypageCandidatesToggleClosed');

  if (!head || !body || !empty || !subtitle || !toggle) return;

  state.candidates = candidates;
  state.closedCandidates = closedCandidates;

  const isAdvisor = state.roleView === 'advisor';

  subtitle.textContent = isAdvisor
    ? '担当CSが自分の候補者（クローズは非表示）'
    : '担当パートナーが自分で、通電前の候補者';

  if (isAdvisor && closedCandidates.length > 0) {
    toggle.hidden = false;
    toggle.textContent = state.closedVisible
      ? `クローズを非表示 (${closedCandidates.length})`
      : `クローズを表示 (${closedCandidates.length})`;
  } else {
    toggle.hidden = true;
  }

  head.innerHTML = isAdvisor
    ? `
      <tr>
        <th>求職者名</th>
        <th>フェーズ</th>
        <th>前回アクション</th>
        <th>次回アクション</th>
      </tr>
    `
    : `
      <tr>
        <th>求職者名</th>
        <th>前回アクション</th>
      </tr>
    `;

  const visibleCandidates = state.closedVisible && isAdvisor
    ? candidates.concat(closedCandidates)
    : candidates;

  if (!visibleCandidates.length) {
    body.innerHTML = '';
    empty.classList.add('is-visible');
    return;
  }

  empty.classList.remove('is-visible');
  body.innerHTML = visibleCandidates
    .map((candidate) => {
      if (isAdvisor) {
        return `
          <tr>
            <td>${escapeHtml(candidate.candidateName || '-') }</td>
            <td>${escapeHtml(candidate.phase || '-') }</td>
            <td>${formatAction(candidate.lastAction)}</td>
            <td>${formatAction(candidate.nextAction)}</td>
          </tr>
        `;
      }
      return `
        <tr>
          <td>${escapeHtml(candidate.candidateName || '-') }</td>
          <td>${formatAction(candidate.lastAction)}</td>
        </tr>
      `;
    })
    .join('');
}

function renderError(message) {
  const tasksEmpty = document.getElementById('mypageTasksEmpty');
  const notificationsEmpty = document.getElementById('mypageNotificationsEmpty');
  const candidatesEmpty = document.getElementById('mypageCandidatesEmpty');
  [tasksEmpty, notificationsEmpty, candidatesEmpty].forEach((el) => {
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
  });
}

function formatDateJP(dateKey) {
  if (!dateKey) return '-';
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function formatAction(action) {
  if (!action?.date) return '-';
  const date = formatDateJP(action.date);
  const label = action.type ? ` (${action.type})` : '';
  return `${date}${label}`;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
