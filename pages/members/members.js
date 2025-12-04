import { mockUsers } from '../../scripts/mock/users.js';

export function mount() {
  const title = document.getElementById('pageTitle');
  if (title) title.textContent = 'メンバー';

  renderMembers();
}

export function unmount() {}

function renderMembers() {
  const grid = document.getElementById('membersGrid');
  const countEl = document.getElementById('membersCount');
  if (!grid) return;

  grid.innerHTML = mockUsers
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

  if (countEl) {
    countEl.textContent = `${mockUsers.length}名`;
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
