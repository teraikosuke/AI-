import { mount as mountYield, unmount as unmountYield } from '../yield/yield.js';

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

async function renderYieldSection(root, { scope, sectionKey }) {
  const host = root?.querySelector?.('#yieldPageHost') || root;
  if (!host) return;
  host.innerHTML = '';

  const html = await loadTemplateHtml();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const source = doc.querySelector(`[data-yield-section="${sectionKey}"]`);
  if (!source) return;

  const clone = document.importNode(source, true);
  const container = document.createElement('section');
  container.className = 'kpi-v2-wrapper space-y-6 yield-page';
  container.dataset.kpi = 'v2';
  container.dataset.yieldScope = scope;
  container.appendChild(clone);
  host.appendChild(container);
}

export async function mount(root) {
  try {
    await renderYieldSection(root, { scope: 'personal', sectionKey: 'personal' });
  } catch (error) {
    console.warn('[yield-personal] failed to render', error);
  }
  mountYield(root);
}

export function unmount() {
  unmountYield();
}
