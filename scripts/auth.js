/**
 * Authentication module with mock users
 * Provides login/logout functionality and role-based access control
 */

const KEY = 'session.v1';
const USERS = [
  { email: 'admin@example.com', password: 'admin123', role: 'admin', name: '管理者' },
  { email: 'member@example.com', password: 'member123', role: 'member', name: '一般社員' }
];

export function getSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    
    const s = JSON.parse(raw);
    if (s.exp && Date.now() > s.exp) {
      localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function setSession(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent('auth:change', { detail: s }));
}

export async function login(email, pw) {
  const u = USERS.find(x => x.email === email && x.password === pw);
  if (!u) throw new Error('メールアドレスまたはパスワードが違います');
  
  setSession({
    email: u.email,
    name: u.name,
    role: u.role,
    exp: Date.now() + 8 * 60 * 60 * 1000
  });
  
  return getSession();
}

export function logout() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event('auth:change'));
}

export function hasRole(role) {
  const s = getSession();
  if (!s) return false;
  return Array.isArray(role) ? role.includes(s.role) : s.role === role;
}

export function applyRoleGates(root = document) {
  const s = getSession();
  root.querySelectorAll('[data-role]').forEach(el => {
    const allowed = (el.dataset.role || '').split(/\s+/);
    el.hidden = !s || !allowed.includes(s.role);
  });
}