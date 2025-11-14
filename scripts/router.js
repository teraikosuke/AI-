/**
 * Client-side router for dashboard application
 * Handles navigation between pages using ES modules
 */
import { getSession, hasRole, logout } from './auth.js';

const routes = {
  'login':        () => import('../pages/login/login.js'),
  'yield':        () => import('../pages/yield/yield.js'),
  'candidates':   () => import('../pages/candidates/candidates.js'),
  'ad-performance': () => import('../pages/ad-performance/ad-performance.js'),
  'teleapo':      () => import('../pages/teleapo/teleapo.js'),
  'referral':     () => import('../pages/referral/referral.js'),
};

const routeMeta = {
  login:          { public: true },
  yield:          { roles: ['admin', 'member'] },
  candidates:     { roles: ['admin', 'member'] },
  'ad-performance': { roles: ['admin'] },
  teleapo:        { roles: ['admin', 'member'] },
  referral:       { roles: ['admin', 'member'] },
};

// CSS files for specific pages
const pageCSS = {
  'login': null, // Uses global styles
  'yield': 'pages/yield/yield.css',
  'candidates': 'pages/candidates/candidates.css',
  'ad-performance': 'pages/ad-performance/ad-performance.css',
  'teleapo': 'pages/teleapo/teleapo.css',
  'referral': 'pages/referral/referral.css',
};

let current = null;
let currentCSS = null;

function loadPageCSS(page) {
  // Remove previous page CSS
  if (currentCSS) {
    currentCSS.remove();
    currentCSS = null;
  }
  
  // Load page-specific CSS if exists
  if (pageCSS[page]) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = pageCSS[page];
    link.dataset.pageCSS = page;
    document.head.appendChild(link);
    currentCSS = link;
  }
}

export async function navigate(to) {
  const app = document.getElementById('app');
  const page = to || (location.hash.replace('#/', '') || 'yield');
  
  // Auth guard
  const session = getSession();
  const meta = routeMeta[page];
  
  if (!meta?.public && !session) {
    // Redirect to login if not authenticated
    if (page !== 'login') {
      location.hash = '#/login';
      return;
    }
  }
  
  if (meta?.roles && !hasRole(meta.roles)) {
    // Redirect to yield if insufficient permissions
    location.hash = '#/yield';
    return;
  }
  
  // Unmount current page
  if (current?.unmount) {
    try {
      current.unmount();
    } catch (error) {
      console.warn('Error unmounting page:', error);
    }
  }
  
  try {
    // Load page-specific CSS
    loadPageCSS(page);
    
    // Load page HTML
    const html = await fetch(`/pages/${page}/index.html`, {cache: 'no-cache'})
      .then(r => r.text());
    app.innerHTML = html;
    app.dataset.page = page;
    
    // Load and mount page module
    const mod = await (routes[page]?.() ?? routes['login']());
    current = mod;
    
    if (mod?.mount) {
      mod.mount(app);
    }
    
    // Update URL
    history.replaceState({}, '', `#/${page}`);
    
    // Update navigation state
    updateNavigation(page);
  } catch (error) {
    console.error('Navigation error:', error);
    // Fallback to login page
    if (page !== 'login') {
      navigate('login');
    }
  }
}

function updateNavigation(page) {
  const session = getSession();
  
  document.querySelectorAll('[data-target]').forEach(button => {
    const target = button.dataset.target;
    const isActive = target === page;
    
    // Show/hide based on role permissions
    const meta = routeMeta[target];
    if (meta?.roles) {
      button.hidden = !session || !hasRole(meta.roles);
    } else {
      button.hidden = false;
    }
    
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

export function boot() {
  // Initial navigation
  addEventListener('DOMContentLoaded', () => navigate());
  
  // Handle hash changes
  addEventListener('hashchange', () => navigate());
  
  // Handle auth changes
  addEventListener('auth:change', () => {
    navigate(location.hash.replace('#/', '') || 'yield');
  });
  
  // Handle navigation clicks
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-target]');
    if (target) {
      event.preventDefault();
      navigate(target.dataset.target);
    }
    
    // Handle logout clicks
    const logoutButton = event.target.closest('[data-action="logout"]');
    if (logoutButton) {
      event.preventDefault();
      logout();
      location.hash = '#/login';
    }
  });
}