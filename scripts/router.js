/**
 * Client-side router for dashboard application
 * Handles navigation between pages using ES modules
 */

import { getSession, hasRole, onAuthChange } from './auth.js';
import { authRepo } from './api/repositories/auth.js?v=20260120_2';

const POST_LOGIN_REDIRECT_KEY = 'dashboard.postLoginRedirect';

const routes = {
  login: () => import("../pages/login/login.js"),
  mypage: () => import("../pages/mypage/mypage.js"),
  members: () => import("../pages/members/members.js"),
  yield: () => import("../pages/yield/yield.js"),
  "yield-personal": () => import("../pages/yield-personal/yield-personal.js"),
  "yield-company": () => import("../pages/yield-company/yield-company.js"),
  "yield-admin": () => import("../pages/yield-admin/yield-admin.js"),
  candidates: () => import("../pages/candidates/candidates.js?v=20260322_55"),
  "ad-performance": () => import("../pages/ad-performance/ad-performance.js?v=20260322_12"),
  teleapo: () => import("../pages/teleapo/teleapo.js?v=20260322_10"),
  referral: () => import("../pages/referral/referral.js?v=20260322_48"),
  settings: () => import("../pages/settings/settings.js?v=20260230"),
  "goal-settings": () => import("../pages/goal-settings/goal-settings.js"),
  "kpi-summery-test": () => import("../pages/kpi-summery-test/kpi-summery-test.js"),
};

const routeMeta = {
  login: { public: true },
  mypage: { roles: ['admin', 'member'] },
  yield: { roles: ['admin', 'member'] },
  "yield-personal": { roles: ['admin', 'member'] },
  "yield-company": { roles: ['admin', 'member'] },
  "yield-admin": { roles: ['admin'] },
  candidates: { roles: ['admin', 'member'] },
  'ad-performance': { roles: ['admin', 'member'] },
  teleapo: { roles: ['admin', 'member'] },
  referral: { roles: ['admin', 'member'] },
  settings: { roles: ['admin', 'member'] },
  members: { roles: ['admin', 'member'] },
  'goal-settings': { roles: ['admin', 'member'] },
  'kpi-summery-test': { roles: ['admin', 'member'] }
};

// CSS files for specific pages
const pageCSS = {
  yield: "pages/yield/yield.css?v=20260127",
  "yield-personal": "pages/yield/yield.css?v=20260127",
  "yield-company": "pages/yield/yield.css?v=20260127",
  "yield-admin": "pages/yield/yield.css?v=20260127",
  mypage: "pages/mypage/mypage.css",
  candidates: "pages/candidates/candidates.css?v=20260322_55",
  "ad-performance": "pages/ad-performance/ad-performance.css?v=20260133",
  teleapo: "pages/teleapo/teleapo.css?v=20260322_2",
  referral: "pages/referral/referral.css?v=20260322_48",
  settings: "pages/settings/settings.css?v=20260229",
  "goal-settings": "pages/goal-settings/goal-settings.css?v=20260127",
  members: "pages/members/members.css",
  "kpi-summery-test": "pages/kpi-summery-test/kpi-summery-test.css",
  login: null, // Uses global styles
};

let current = null;
let currentCSS = null;
const BADGE_SELECTORS = ["#sidebarUserBadgeSlot"];
const BADGE_SELECTOR = "[data-user-badge]";
const PAGE_TITLE_SELECTOR = "#pageTitle";
let unsubscribeBadge = null;

function resolveAsset(path) {
  return new URL(path, import.meta.url).href;
}

function loadPageCSS(page) {
  // Remove previous page CSS
  if (currentCSS) {
    currentCSS.remove();
    currentCSS = null;
  }

  // Load page-specific CSS if exists
  if (pageCSS[page]) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = resolveAsset(`../${pageCSS[page]}`);
    link.dataset.pageCSS = page;
    document.head.appendChild(link);
    currentCSS = link;
  }
}

/**
 * 繝翫ン繧ｲ繝ｼ繧ｷ繝ｧ繝ｳ蜑阪・繝ｫ繝ｼ繧ｿ繝ｼ繧ｬ繝ｼ繝・
 * - 譛ｪ繝ｭ繧ｰ繧､繝ｳ譎ゅ・菫晁ｭｷ繝ｫ繝ｼ繝医い繧ｯ繧ｻ繧ｹ 竊・login 縺ｸ
 * - 繝ｭ繝ｼ繝ｫ荳崎ｶｳ縺ｮ繝ｫ繝ｼ繝医い繧ｯ繧ｻ繧ｹ 竊・yield 縺ｸ
 * @param {string} page
 * @returns {string} 螳滄圀縺ｫ驕ｷ遘ｻ縺吶∋縺阪・繝ｼ繧ｸID
 */
export function beforeNavigate(page) {
  if (page === "yield") return "yield-personal";
  const session = getSession();
  const meta = routeMeta[page];

  // 譛ｪ繝ｭ繧ｰ繧､繝ｳ縺九▽菫晁ｭｷ繝ｫ繝ｼ繝医・蝣ｴ蜷医・ login 縺ｸ隱伜ｰ・
  if (!meta?.public && !session) {
    if (page !== "login") {
      try {
        sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, page);
      } catch {
        // sessionStorage 縺御ｽｿ縺医↑縺・腸蠅・〒縺ｯ蜊倡ｴ斐↓login縺ｸ驕ｷ遘ｻ
      }
      return "login";
    }
  }

  // 繝ｭ繝ｼ繝ｫ荳崎ｶｳ縺ｮ蝣ｴ蜷医・ yield 縺ｸ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
  if (meta?.roles && !hasRole(meta.roles)) {
    return "yield";
  }

  return page;
}

/**
 * 繝ｭ繧ｰ繧､繝ｳ蜑阪↓繧｢繧ｯ繧ｻ繧ｹ縺励ｈ縺・→縺励※縺・◆菫晁ｭｷ繝ｫ繝ｼ繝医ｒ蜿門ｾ励＠縺ｦ遐ｴ譽・☆繧・
 * @returns {string|null}
 */
export function consumePostLoginRedirect() {
  try {
    const page = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    if (!page) return null;
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    return page;
  } catch {
    return null;
  }
}

export async function navigate(to) {
  const app = document.getElementById("app");
  const segments = location.hash
    .replace(/^#\/?/, "")
    .split("/")
    .filter(Boolean);
  const rawPage = to || segments[0] || "candidates";

  // 繝ｫ繝ｼ繧ｿ繝ｼ繧ｬ繝ｼ繝会ｼ・eforeNavigate・峨〒螳滄圀縺ｫ陦ｨ遉ｺ縺吶∋縺阪・繝ｼ繧ｸ繧呈ｱｺ螳・
  const guardedPage = beforeNavigate(rawPage);

  if (guardedPage !== rawPage) {
    // 繝上ャ繧ｷ繝･繧呈嶌縺肴鋤縺医※譌ｩ譛溘Μ繧ｿ繝ｼ繝ｳ・亥ｮ滄圀縺ｮ謠冗判縺ｯ谺｡縺ｮnavigate蜻ｼ縺ｳ蜃ｺ縺励〒陦後≧・・
    location.hash = `#/${guardedPage}`;
    return;
  }

  const page = guardedPage;

  // Unmount current page
  if (current?.unmount) {
    try {
      current.unmount();
    } catch (error) {
      console.warn("Error unmounting page:", error);
    }
  }

  try {
    // Load page-specific CSS
    loadPageCSS(page);

    // Load page HTML
    const htmlURL = resolveAsset(`../pages/${page}/index.html`);
    // Add cache-busting parameter
    const htmlUrl = `${htmlURL}?v=${Date.now()}`;
    const response = await fetch(htmlUrl, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Failed to load ${page} page (${response.status})`);
    }
    const html = await response.text();
    app.innerHTML = html;
    app.dataset.page = page;

    // Load and mount page module
    const mod = await (routes[page]?.() ?? routes["login"]());
    current = mod;

    if (mod?.mount) {
      mod.mount(app);
    }
    updatePageTitle(page);

    // Update URL
    history.replaceState({}, "", `#/${page}`);

    // Update navigation state
    updateNavigation(page);
    ensureUserBadge();
  } catch (error) {
    console.error("Navigation error:", error);
    // Fallback to login page
    if (page !== "login") {
      navigate("login");
    }
  }
}

function updateNavigation(page) {
  const session = getSession();

  document.querySelectorAll("[data-target]").forEach((button) => {
    const target = button.dataset.target;
    const isActive = target === page;

    // Show/hide based on role permissions
    const meta = routeMeta[target];
    if (meta?.roles) {
      button.hidden = !session || !hasRole(meta.roles);
    } else {
      button.hidden = false;
    }

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");

    // Keep the nav dot in sync with the active page
    const dot = button.querySelector(".nav-dot");
    if (dot) {
      dot.classList.toggle("bg-indigo-400", isActive);
      dot.classList.toggle("bg-slate-500", !isActive);
    }
  });

  const yieldGroup = document.querySelector('[data-nav-group="yield"]');
  if (yieldGroup) {
    const isYieldPage = ["yield-personal", "yield-company", "yield-admin"].includes(page);
    yieldGroup.classList.toggle("is-open", isYieldPage);
    const toggle = yieldGroup.querySelector("[data-submenu-toggle]");
    if (toggle) {
      toggle.classList.toggle("is-active", isYieldPage);
      toggle.setAttribute("aria-expanded", isYieldPage ? "true" : "false");
    }
    const hasVisibleChild = Array.from(yieldGroup.querySelectorAll("[data-target]")).some(
      (button) => !button.hidden
    );
    yieldGroup.hidden = !session || !hasVisibleChild;
  }
}

function updatePageTitle(page) {
  const titleEl = document.querySelector(PAGE_TITLE_SELECTOR);
  if (!titleEl) return;

  const navLabel = document.querySelector(`[data-target="${page}"] .nav-label`);
  const navText = navLabel?.textContent?.trim();
  if (navText) {
    titleEl.textContent = navText;
    return;
  }

  const pageTitle = document.querySelector("[data-page-title]")?.textContent?.trim();
  if (pageTitle) {
    titleEl.textContent = pageTitle;
    return;
  }

  const heading = document.querySelector("#app h1, #app h2, #app h3");
  const headingText = heading?.textContent?.trim();
  if (headingText) {
    titleEl.textContent = headingText;
    return;
  }

  titleEl.textContent = page.replace(/-/g, " ");
}

function setupSidebarToggle() {
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = sidebar?.querySelector("#sidebarToggle");
  if (!sidebar || !toggleBtn) return;

  const updateToggleLabel = () => {
    const collapsed = sidebar.classList.contains("sidebar-collapsed");
    const iconSvg = collapsed
      ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5" /></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m18.75 4.5-7.5 7.5 7.5 7.5m-6-15L5.25 12l7.5 7.5" /></svg>`;

    toggleBtn.innerHTML = iconSvg;
    toggleBtn.setAttribute(
      "aria-label",
      collapsed ? "サイドバーを展開" : "サイドバーを折りたたみ"
    );
  };

  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("sidebar-collapsed");
    updateToggleLabel();
  });

  updateToggleLabel();
}

export function boot() {
  // Initial navigation
  addEventListener("DOMContentLoaded", async () => {
    // 繧ｵ繝ｼ繝舌・荳翫・繧ｻ繝・す繝ｧ繝ｳ縺九ｉ繝ｭ繝ｼ繧ｫ繝ｫ繧ｻ繝・す繝ｧ繝ｳ繧貞ｾｩ蜈・
    await authRepo.me();
    await navigate();
    setupSidebarToggle();
  });

  // Handle hash changes
  addEventListener("hashchange", () => navigate());

  // Handle auth changes
  addEventListener("auth:change", () => {
    navigate(location.hash.replace("#/", "") || "yield");
  });

  // Handle navigation clicks
  document.addEventListener("click", (event) => {
    const submenuToggle = event.target.closest("[data-submenu-toggle]");
    if (submenuToggle) {
      event.preventDefault();
      const key = submenuToggle.dataset.submenuToggle;
      const group = document.querySelector(`[data-nav-group=\"${key}\"]`);
      if (group) {
        const next = !group.classList.contains("is-open");
        group.classList.toggle("is-open", next);
        submenuToggle.setAttribute("aria-expanded", next ? "true" : "false");
      }
      return;
    }
    const target = event.target.closest("[data-target]");
    if (target) {
      event.preventDefault();
      navigate(target.dataset.target);
    }

    // Handle logout clicks
    const logoutButton = event.target.closest("[data-action=\"logout\"]");
    if (logoutButton) {
      event.preventDefault();
      authRepo.logout();
      location.hash = "#/login";
    }
  });
}

function ensureUserBadge() {
  renderUserBadge();
  if (!unsubscribeBadge) {
    unsubscribeBadge = onAuthChange(() => renderUserBadge());
  }
}

function renderUserBadge() {
  const container = BADGE_SELECTORS.map((selector) =>
    document.querySelector(selector)
  ).find(Boolean);
  if (!container) return;

  let badge = document.querySelector(BADGE_SELECTOR);
  if (!badge) {
    badge = document.createElement("div");
    badge.dataset.userBadge = "true";
    badge.className = "sidebar-user-chip";
    badge.innerHTML = `
      <div class="sidebar-user-avatar" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 18.5a6.5 6.5 0 0 1 13 0v.5h-13v-.5z" />
        </svg>
      </div>
      <div class="sidebar-user-text">
        <span class="sidebar-user-name user-badge-chip__text"></span>
      </div>
    `;
    badge.addEventListener("click", handleBadgeActivate);
    badge.addEventListener("keydown", handleBadgeActivate);
  }

  if (badge.parentElement !== container) {
    container.appendChild(badge);
  }

  updateUserBadgeText(badge);
}

function handleBadgeActivate(event) {
  const isKey = event.type === "keydown";
  if (isKey && event.key !== "Enter" && event.key !== " ") {
    return;
  }
  const badge = event.currentTarget;
  if (!badge) return;
  if (badge.dataset.badgeAction === "login") {
    event.preventDefault();
    location.hash = "#/login";
  }
}

function updateUserBadgeText(badge) {
  const textEl = badge.querySelector(".user-badge-chip__text");
  if (!textEl) return;
  const session = getSession();

  if (session) {
    const name = session.user?.name || session.user?.email || "";
    const roleLabel = session.role === "admin"
      ? "管理者"
      : session.role === "member"
        ? "一般"
        : (session.role || "");
    textEl.textContent = roleLabel ? `${name} / ${roleLabel}` : name;
    badge.dataset.badgeAction = "";
    badge.removeAttribute("role");
    badge.removeAttribute("tabindex");
    badge.removeAttribute("aria-label");
  } else {
    textEl.textContent = "未ログイン";
    badge.dataset.badgeAction = "login";
    badge.setAttribute("role", "button");
    badge.setAttribute("tabindex", "0");
    badge.setAttribute("aria-label", "ログインページへ移動");
  }
}
