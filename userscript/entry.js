(() => {
  'use strict';
  if (window.top !== window.self || !['text/html', 'application/xhtml+xml'].includes(document.contentType)) return;
  const C = globalThis.SFCore;
  const pageHost = C.hostFromURL(location.href);
  if (!pageHost) return;
  const gm = typeof GM !== 'undefined' ? GM : {};
  // Choose functions directly. An async function factory would return a Promise, not an API function.
  const xhr = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : gm.xmlHttpRequest?.bind(gm);
  const read = typeof GM_getValue === 'function' ? GM_getValue : gm.getValue?.bind(gm);
  const write = typeof GM_setValue === 'function' ? GM_setValue : gm.setValue?.bind(gm);
  const open = typeof GM_openInTab === 'function' ? GM_openInTab : gm.openInTab?.bind(gm);
  const menu = typeof GM_registerMenuCommand === 'function' ? GM_registerMenuCommand : gm.registerMenuCommand?.bind(gm);
  const info = typeof GM_info !== 'undefined' ? GM_info : gm.info || {};
  const isPrivate = Boolean(info.isIncognito);
  if (!xhr || !read || !write) { console.error('Script Finder requires Violentmonkey GM request and storage APIs.'); return; }
  const service = C.createService({
    privateMode: isPrivate,
    get: (key, fallback) => Promise.resolve(read(key, fallback)),
    set: (key, value) => Promise.resolve(write(key, value)),
    request: url => new Promise((resolve, reject) => {
      let settled = false;
      let handle;
      function fail(message) { if (!settled) { settled = true; clearTimeout(timer); reject(new Error(message)); } }
      const timer = setTimeout(() => { fail('Request timed out. Retry or use the repository search link.'); try { handle?.abort?.(); } catch {} }, 19000);
      try {
        handle = xhr({
          method: 'GET', url, responseType: 'text', anonymous: true, timeout: 18000,
          headers: { Accept: 'application/json' },
          onload(response) {
            if (settled) return;
            settled = true; clearTimeout(timer);
            const headers = {};
            for (const line of String(response.responseHeaders || '').split(/\r?\n/)) {
              const colon = line.indexOf(':');
              if (colon > 0) headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
            }
            resolve({ status: response.status, text: response.responseText ?? response.response ?? '', headers });
          },
          onerror: () => fail('Network request failed. Check your connection or repository permissions.'),
          ontimeout: () => fail('Request timed out. Retry or use the repository search link.'),
          onabort: () => fail('Request was cancelled.')
        });
        if (handle?.catch) handle.catch(error => fail(error?.message || 'Network request failed.'));
      } catch (error) { fail(error?.message || 'GM request API failed.'); }
    })
  });
  const container = document.createElement('div');
  container.id = 'script-finder-container';
  container.style.cssText = 'all:initial!important;position:fixed!important;right:16px!important;bottom:16px!important;z-index:2147483646!important;display:block!important;';
  const shadow = container.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = globalThis.SF_STYLE + '\n.sf-launcher{font:600 13px/1.4 system-ui,sans-serif;border:1px solid #577569;border-radius:24px;padding:10px 15px;background:#14251e;color:#b2f3d3;box-shadow:0 3px 14px #0005;cursor:pointer}.sf-launcher:focus-visible{outline:3px solid #8de4bb;outline-offset:3px}.sf-floating{position:fixed;right:16px;bottom:68px;width:min(580px,calc(100vw - 24px));max-height:calc(100dvh - 92px);overflow:auto;border:1px solid #344357;border-radius:12px;box-shadow:0 12px 45px #0008;background:#121a25;}.sf-floating[hidden]{display:none!important;}@media(max-width:420px){.sf-floating{right:12px;bottom:64px;}}';
  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'sf-launcher';
  launcher.textContent = 'JS · …';
  launcher.title = 'Find userscripts for this website';
  launcher.setAttribute('aria-label', 'Open Script Finder');
  launcher.setAttribute('aria-expanded', 'false');
  const panel = document.createElement('div');
  panel.className = 'sf-floating';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Script Finder');
  panel.hidden = true;
  shadow.append(style, launcher, panel);
  document.documentElement.append(container);
  let ui;
  let priorFocus;
  const uiService = isPrivate ? { ...service, settings: async () => ({ ...await service.settings(), automatic: false }) } : service;
  function hide() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    if (priorFocus?.isConnected) priorFocus.focus(); else launcher.focus();
  }
  function show() {
    priorFocus = document.activeElement;
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    if (!ui) ui = globalThis.SFUI.mount(panel, {
      service: uiService, host: C.siteHost(pageHost), onClose: hide,
      automaticLock: isPrivate ? 'Automatic lookups are disabled in private windows. Manual searches use an in-memory cache only.' : undefined,
      openURL: url => open ? open(url, { active: true, insert: true }) : window.open(url, '_blank', 'noopener,noreferrer'),
      onSettingsChange: updateBadge,
      onClearCache: () => { launcher.textContent = 'JS · Find'; },
      onResults: state => {
        if (state.host !== C.siteHost(pageHost)) { launcher.textContent = 'JS · Find'; return; }
        const count = state.items.filter(item => item.kind === 'script').length;
        launcher.textContent = !count && state.errors ? 'JS · !' : `JS · ${count}${state.hasMore || state.errors ? '+' : ''}`;
      }
    });
    requestAnimationFrame(() => panel.querySelector('input')?.focus());
  }
  launcher.addEventListener('click', () => panel.hidden ? show() : hide());
  shadow.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); hide(); } });
  if (menu) menu('Open Script Finder', show);
  async function updateBadge() {
    const settings = await service.settings();
    if (isPrivate || !settings.automatic) { launcher.textContent = 'JS · Find'; return; }
    const responses = await Promise.all(C.PROVIDERS.filter(p => settings[p.id]).map(p => service.search(p.id, C.siteHost(pageHost))));
    const catalogs = responses.filter(r => r.id !== 'github');
    const count = catalogs.reduce((sum, r) => sum + r.items.length, 0);
    const more = catalogs.some(r => r.hasMore);
    launcher.textContent = catalogs.length && catalogs.every(r => r.status === 'error') ? 'JS · !' : `JS · ${count}${more ? '+' : ''}`;
  }
  updateBadge().catch(error => { launcher.textContent = 'JS · !'; launcher.title = error?.message || 'Lookup failed. Open Script Finder for details.'; });
})();
