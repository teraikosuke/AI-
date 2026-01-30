/**
 * Login page JavaScript module
 */
import { authRepo } from '../../scripts/api/repositories/auth.js?v=20260120_2';
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
    memberList.innerHTML = '';
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
