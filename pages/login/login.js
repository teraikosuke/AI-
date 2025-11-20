/**
 * Login page JavaScript module
 */
import { authRepo } from '../../scripts/api/repositories/auth.js';
import { consumePostLoginRedirect } from '../../scripts/router.js';

export async function mount(root) {
  console.log('Mounting login page...');
  
  const form = root.querySelector('#loginForm');
  const errorMessage = root.querySelector('#errorMessage');
  
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
}

export async function unmount() {
  console.log('Unmounting login page...');
}
