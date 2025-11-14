/**
 * Login page JavaScript module
 */
import { login } from '../../scripts/auth.js';

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
        await login(email, password);
        location.hash = '#/yield';
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