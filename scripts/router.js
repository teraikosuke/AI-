/**
 * Client-side router for dashboard application
 * Handles navigation between pages using ES modules
 */

const routes = {
  'yield':        () => import('../pages/yield/yield.js'),
  'candidates':   () => import('../pages/candidates/candidates.js'),
  'ad-performance': () => import('../pages/ad-performance/ad-performance.js'),
  'teleapo':      () => import('../pages/teleapo/teleapo.js'),
  'referral':     () => import('../pages/referral/referral.js'),
};

// CSS files for specific pages
const pageCSS = {
  'yield': 'pages/yield/yield.css',
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
    const mod = await (routes[page]?.() ?? routes['yield']());
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
    // Fallback to yield page
    if (page !== 'yield') {
      navigate('yield');
    }
  }
}

function updateNavigation(page) {
  document.querySelectorAll('[data-target]').forEach(button => {
    const isActive = button.dataset.target === page;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

export function boot() {
  // Initial navigation
  addEventListener('DOMContentLoaded', () => navigate());
  
  // Handle hash changes
  addEventListener('hashchange', () => navigate());
  
  // Handle navigation clicks
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-target]');
    if (target) {
      event.preventDefault();
      navigate(target.dataset.target);
    }
  });
}