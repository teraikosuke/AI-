/**
 * Login page JavaScript module
 */
import { authRepo } from '../../scripts/api/repositories/auth.js?v=20260120_2';
import { mockUsers } from '../../scripts/mock/users.js';
import { consumePostLoginRedirect } from '../../scripts/router.js';

export async function mount(root) {
  console.log('Mounting login page...');

  const form = root.querySelector('#loginForm');
  const errorMessage = root.querySelector('#errorMessage');
  const devLoginButton = root.querySelector('#devLoginButton');
  const memberList = root.querySelector('#loginMemberList');

  const fillCredentials = (email, password) => {
    if (!form) return;
    form.email.value = email || '';
    form.password.value = password || '';
  };

  if (memberList) {
    const members = Array.isArray(mockUsers) ? mockUsers : [];
    if (!members.length) {
      memberList.innerHTML = '<div class="text-xs text-gray-400">??????????????????</div>';
    } else {
      memberList.innerHTML = members.map(user => (`
        <div class="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2">
          <div>
            <div class="text-sm font-semibold text-slate-700">${escapeHtml(user.name || '')}</div>
            <div class="text-xs text-slate-500">${escapeHtml(user.email || '')} ? ${escapeHtml(user.role || '')}</div>
            <div class="text-xs text-slate-500">PW: ${escapeHtml(user.password || '')}</div>
          </div>
          <button type="button" class="login-fill-button rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50" data-email="${escapeHtml(user.email || '')}" data-password="${escapeHtml(user.password || '')}">??</button>
        </div>
      `)).join('');

      memberList.querySelectorAll('.login-fill-button').forEach(button => {
        button.addEventListener('click', () => {
          fillCredentials(button.dataset.email || '', button.dataset.password || '');
        });
      });
    }
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = form.email.value;
      const password = form.password.value;

      try {
        errorMessage.classList.add('hidden');
        const session = await authRepo.login(email, password);

        // 直前にアクセスしようとしていた保護ルートがあればそちらへ、
        // なければデフォルトのyieldページへ遷移
        const redirectTo = consumePostLoginRedirect() || 'yield';
        console.log('Login success, session:', session, 'redirectTo:', redirectTo);
        location.hash = `#/${redirectTo}`;
      } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.classList.remove('hidden');
      }
    });
  }

  if (devLoginButton) {
    devLoginButton.addEventListener('click', async () => {
      try {
        errorMessage.classList.add('hidden');
        const session = await authRepo.devLogin();
        const redirectTo = consumePostLoginRedirect() || 'yield';
        console.log('Dev login success, session:', session, 'redirectTo:', redirectTo);
        location.hash = `#/${redirectTo}`;
      } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.classList.remove('hidden');
      }
    });
  }
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

export async function unmount() {
  console.log('Unmounting login page...');
}
