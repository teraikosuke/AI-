/**
 * Client-side router for dashboard application
 * Handles navigation between pages using ES modules
 */

import { getSession, hasRole, onAuthChange } from './auth.js';
import { authRepo } from './api/repositories/auth.js?v=20260120_2';

const POST_LOGIN_REDIRECT_KEY = 'dashboard.postLoginRedirect';

const routes = {
  login: () => import("../pages/login/login.js"),
  mypage: () => import("../pages/mypage/mypage.js?v=20260206_01"),
  members: () => import("../pages/members/members.js"),
  yield: () => import("../pages/yield/yield.js?v=20260206_02"),
  "yield-personal": () => import("../pages/yield-personal/yield-personal.js?v=20260203_01"),
  "yield-company": () => import("../pages/yield-company/yield-company.js?v=20260203_01"),
  "yield-admin": () => import("../pages/yield-admin/yield-admin.js?v=20260203_01"),
  candidates: () => import("../pages/candidates/candidates.js?v=20260209_03"),
  "candidate-detail": () => import("../pages/candidate-detail/candidate-detail.js?v=20260209_03"),
  "ad-performance": () => import("../pages/ad-performance/ad-performance.js?v=20260322_14"),
  teleapo: () => import("../pages/teleapo/teleapo.js?v=20260209_1"),
  referral: () => import("../pages/referral/referral.js?v=20260322_60"),
  settings: () => import("../pages/settings/settings.js?v=20260322_01"),
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
  "candidate-detail": { roles: ['admin', 'member'] },
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
  yield: "pages/yield/yield.css?v=20260203_01",
  "yield-personal": "pages/yield/yield.css?v=20260203_01",
  "yield-company": "pages/yield/yield.css?v=20260203_01",
  "yield-admin": "pages/yield/yield.css?v=20260203_01",
  mypage: "pages/mypage/mypage.css?v=20260202_02",
  candidates: "pages/candidates/candidates.css?v=20260322_57",
  "candidate-detail": "pages/candidate-detail/candidate-detail.css?v=20260322_02",
  "ad-performance": "pages/ad-performance/ad-performance.css?v=20260133",
  teleapo: "pages/teleapo/teleapo.css?v=20260322_2",
  referral: "pages/referral/referral.css?v=20260322_49",
  settings: "pages/settings/settings.css?v=20260322_01",
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
 * ナビゲーション前のルーターガード
 * - 未ログイン時の保護ルートアクセス → loginへ
 * - ロール不許可のルートアクセス → yieldへ
 * @param {string} page
 * @returns {string} 実際に遷移すべきページID
 */
export function beforeNavigate(page) {
  if (page === "yield") return "yield-personal";
  const session = getSession();
  const meta = routeMeta[page];

  // 未ログインかつ保護ルートの場合は login へ誘導
  if (!meta?.public && !session) {
    if (page !== "login") {
      try {
        sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, page);
      } catch {
        // sessionStorage が使えない環境では単にloginへ遷移
      }
      return "login";
    }
  }

  // ロール不許可の場合は yield へフォールバック
  if (meta?.roles && !hasRole(meta.roles)) {
    return "yield";
  }

  return page;
}

/**
 * ログイン前にアクセスしようとしていた保護ルートを取得して破棄する
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

  // ハッシュからクエリパラメータを分離
  const hashPart = location.hash.replace(/^#\/?/, "");
  const [pathPart, hashQueryRaw] = hashPart.split("?");
  const hashQuery = hashQueryRaw ? `?${hashQueryRaw}` : "";
  const segments = pathPart.split("/").filter(Boolean);
  const toValue = to ? String(to) : "";
  const [toPath, toQueryRaw] = toValue.split("?");
  const rawPage = toPath || segments[0] || "candidates";
  const toQuery = toQueryRaw ? `?${toQueryRaw}` : "";

  // ルーターガード（beforeNavigate）で実際に表示すべきページを決定
  const guardedPage = beforeNavigate(rawPage);

  if (guardedPage !== rawPage) {
    // ハッシュを書き換えて早期リターン（実際の描画は次のnavigate呼び出しで行う）
    location.hash = `#/${guardedPage}`;
    return;
  }

  const page = guardedPage;
  const queryPart = guardedPage === rawPage ? (toQuery || (rawPage === segments[0] ? hashQuery : "")) : "";

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
    history.replaceState({}, "", `#/${page}${queryPart}`);

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
    if (target === "yield-admin") {
      button.hidden = !session || session.role !== "admin";
    } else if (meta?.roles) {
      button.hidden = !session || !hasRole(meta.roles);
    } else {
      button.hidden = false;
    }
    const item = button.closest("li");
    if (item) item.hidden = button.hidden;

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

  const settingsGroup = document.querySelector('[data-nav-group="settings"]');
  if (settingsGroup) {
    const isSettingsPage = ["settings", "goal-settings", "members"].includes(page);
    settingsGroup.classList.toggle("is-open", isSettingsPage);
    const toggle = settingsGroup.querySelector("[data-submenu-toggle]");
    if (toggle) {
      toggle.classList.toggle("is-active", isSettingsPage);
      toggle.setAttribute("aria-expanded", isSettingsPage ? "true" : "false");
    }
    const hasVisibleChild = Array.from(settingsGroup.querySelectorAll("[data-target]")).some(
      (button) => !button.hidden
    );
    settingsGroup.hidden = !session || !hasVisibleChild;
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
    // サーバー上のセッションからローカルセッションを復元
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
