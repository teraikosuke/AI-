import { getSession } from '../../scripts/auth.js';

const MEMBERS_API_BASE = 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev';
const MEMBERS_LIST_PATH = '/members';
const membersApi = (path) => `${MEMBERS_API_BASE}${path}`;

export function mount() {
  const title = document.getElementById('pageTitle');
  if (title) title.textContent = 'メンバー';

  renderMembersLoading();
  loadMembers();
}

export function unmount() {}

async function loadMembers() {
  try {
    const session = getSession();
    const headers = { Accept: 'application/json' };
    if (session?.token) {
      headers.Authorization = `Bearer ${session.token}`;
    }

    const url = membersApi(MEMBERS_LIST_PATH);
    console.log('[members] fetching', { url, hasToken: Boolean(session?.token) });
    const response = await fetch(url, { headers });
    console.log('[members] response', { status: response.status });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const result = await response.json();
    console.log('[members] payload', result);
    const members = normalizeMembers(result);
    console.log('[members] normalized count', members.length);
    renderMembers(members);
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
    role: member.role || (member.is_admin ? 'admin' : 'member')
  }));
}

function renderMembers(members) {
  const grid = document.getElementById('membersGrid');
  const countEl = document.getElementById('membersCount');
  if (!grid) return;

  if (!members.length) {
    grid.innerHTML = '<p class="member-card__email">メンバーが見つかりませんでした。</p>';
  } else {
    grid.innerHTML = members
    .map(user => {
      const roleBadge = user.role === 'admin' ? '<span class="member-card__badge">管理者</span>' : '';
      return `
        <article class="member-card">
          <div class="member-card__avatar" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="currentColor" class="member-card__icon">
              <path d="M10 10a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 10 10Zm0 2c-3.1 0-5.5 1.4-5.5 3.5V17h11v-1.5C15.5 13.4 13.1 12 10 12Z" />
            </svg>
          </div>
          <div class="member-card__body">
            <div class="member-card__name-row">
              <p class="member-card__name">${escapeHtml(user.name)}</p>
              ${roleBadge}
            </div>
            <p class="member-card__email">${escapeHtml(user.email)}</p>
          </div>
        </article>
      `;
    })
    .join('');
  }

  if (countEl) {
    countEl.textContent = `${members.length}名`;
  }
}

function renderMembersLoading() {
  const grid = document.getElementById('membersGrid');
  const countEl = document.getElementById('membersCount');
  if (grid) {
    grid.innerHTML = '<p class="member-card__email">読み込み中...</p>';
  }
  if (countEl) {
    countEl.textContent = '';
  }
}

function renderMembersError(error) {
  const grid = document.getElementById('membersGrid');
  const countEl = document.getElementById('membersCount');
  if (grid) {
    grid.innerHTML = `<p class="member-card__email">取得に失敗しました: ${escapeHtml(error?.message || 'unknown')}</p>`;
  }
  if (countEl) {
    countEl.textContent = '';
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
