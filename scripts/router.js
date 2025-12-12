/**
 * Client-side router for dashboard application
 * Handles navigation between pages using ES modules
 */

const routes = {
  yield: () => import("../pages/yield/yield.js"),
  candidates: () => import("../pages/candidates/candidates.js"),
  "ad-performance": () => import("../pages/ad-performance/ad-performance.js"),
  teleapo: () => import("../pages/teleapo/teleapo.js"),
  referral: () => import("../pages/referral/referral.js"),
  settings: () => import("../pages/settings/settings.js"),
};

const routeMeta = {
  yield: { public: true },
  candidates: { public: true },
  "ad-performance": { public: true },
  teleapo: { public: true },
  referral: { public: true },
  settings: { public: true },
};

// CSS files for specific pages
const pageCSS = {
  yield: "pages/yield/yield.css",
  candidates: "pages/candidates/candidates.css",
  "ad-performance": "pages/ad-performance/ad-performance.css",
  teleapo: "pages/teleapo/teleapo.css",
  referral: "pages/referral/referral.css",
  settings: "pages/settings/settings.css",
};

let current = null;
let currentCSS = null;

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

export async function navigate(to) {
  const app = document.getElementById("app");
  const segments = location.hash
    .replace(/^#\/?/, "")
    .split("/")
    .filter(Boolean);
  let inferredPage = segments[0] || "candidates";
  const page = to || inferredPage;
  if (page === "login") {
    location.hash = "#/candidates";
    return;
  }

  // Authentication completely disabled – all pages are public
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
    const response = await fetch(htmlURL, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Failed to load ${page} page (${response.status})`);
    }
    const html = await response.text();
    app.innerHTML = html;
    app.dataset.page = page;

    // Load and mount page module
    const mod = await (routes[page]?.() ?? routes["candidates"]());
    current = mod;

    if (mod?.mount) {
      mod.mount(app);
    }

    // Update URL
    history.replaceState({}, "", `#/${page}`);

    // Update navigation state
    updateNavigation(page);
  } catch (error) {
    console.error("Navigation error:", error);
    app.innerHTML = `
      <div class="p-6">
        <div class="border border-red-200 bg-red-50 rounded-lg p-4 text-red-700 space-y-2">
          <p class="font-semibold">ページ読み込みに失敗しました。</p>
          <p class="text-sm">${
            error?.message ?? "不明なエラーが発生しました。"
          }</p>
        </div>
      </div>
    `;
    updateNavigation(page);
  }
}

function updateNavigation(page) {
  document.querySelectorAll("[data-target]").forEach((button) => {
    const target = button.dataset.target;
    const isActive = target === page;
    button.hidden = false;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  });
}

export function boot() {
  // Initial navigation
  addEventListener("DOMContentLoaded", () => navigate());

  // Handle hash changes
  addEventListener("hashchange", () => navigate());

  // Handle navigation clicks
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-target]");
    if (target) {
      event.preventDefault();
      navigate(target.dataset.target);
    }
  });
}
