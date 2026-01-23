import { mount as mountYield, unmount as unmountYield } from '../yield/yield.js?v=20260322_01';

let templateCache = null;

async function loadTemplateHtml() {
  if (templateCache) return templateCache;
  const url = new URL('../yield/index.html', import.meta.url).href;
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`yield template ${res.status}`);
  }
  templateCache = await res.text();
  return templateCache;
}

function removeCompanyTabs(section, tabIds) {
  tabIds.forEach(tabId => {
    section.querySelector(`[data-kpi-tab="${tabId}"]`)?.remove();
    section.querySelector(`[data-kpi-tab-panel="${tabId}"]`)?.remove();
  });
}

function activateCompanyTab(section, tabId) {
  const tabs = section.querySelectorAll('.kpi-tab[data-kpi-tab]');
  const panels = section.querySelectorAll('.kpi-tab-panel[data-kpi-tab-panel]');
  tabs.forEach(tab => {
    tab.classList.toggle('is-active', tab.dataset.kpiTab === tabId);
  });
  panels.forEach(panel => {
    panel.classList.toggle('is-hidden', panel.dataset.kpiTabPanel !== tabId);
  });
}

async function renderYieldSection(root, { scope, sectionKey }) {
  const host = root?.querySelector?.('#yieldPageHost') || root;
  if (!host) return;
  host.innerHTML = '';

  const html = await loadTemplateHtml();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const source = doc.querySelector(`[data-yield-section="${sectionKey}"]`);
  if (!source) return;

  const clone = document.importNode(source, true);
  removeCompanyTabs(clone, ['company-metrics', 'company-graphs']);
  activateCompanyTab(clone, 'company-period');

  const container = document.createElement('section');
  container.className = 'kpi-v2-wrapper space-y-6 yield-page';
  container.dataset.kpi = 'v2';
  container.dataset.yieldScope = scope;
  container.appendChild(clone);
  host.appendChild(container);
}

export async function mount(root) {
  try {
    await renderYieldSection(root, { scope: 'admin', sectionKey: 'company' });
  } catch (error) {
    console.warn('[yield-admin] failed to render', error);
  }
  mountYield(root);
}

export function unmount() {
  unmountYield();
}
