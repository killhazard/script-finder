/* Script Finder — MIT. Network and storage live in this extension background. */
(() => {
  'use strict';
  const core = globalThis.SFCore;
  const api = browser;
  const tabVersions = new Map();
  const panelURL = new URL(api.runtime.getURL('panel.html'));
  const endpoints = new Map(core.PROVIDERS.map(p => [p.origin, p.id === 'github' ? '/search/repositories' : '/en/scripts.json']));

  async function request(value) {
    const url = new URL(value);
    if (url.username || url.password || endpoints.get(url.origin) !== url.pathname) {
      throw new Error('Repository endpoint is not allowed.');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(url.href, {
        method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer',
        redirect: 'error', signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      return { status: response.status, text: await response.text(), headers: Object.fromEntries(response.headers.entries()) };
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Repository request timed out after 18 seconds. Retry or use its search link.');
      throw new Error(error?.message || 'Repository request failed.');
    } finally {
      clearTimeout(timer);
    }
  }

  const service = core.createService({
    request,
    async get(key, fallback) {
      const data = await api.storage.local.get(key);
      return data[key] ?? fallback;
    },
    async set(key, value) { await api.storage.local.set({ [key]: value }); }
  });

  function nextVersion(tabId) {
    const version = (tabVersions.get(tabId) || 0) + 1;
    tabVersions.set(tabId, version);
    return version;
  }
  async function badge(tabId, text, title, color = '#126d62') {
    await Promise.all([
      api.browserAction.setBadgeText({ tabId, text }),
      api.browserAction.setBadgeBackgroundColor({ tabId, color }),
      api.browserAction.setTitle({ tabId, title })
    ]);
  }
  async function clearBadge(tabId) {
    await badge(tabId, '', 'Script Finder — find userscripts for this site');
  }
  function siteOf(tab) {
    if (!tab || tab.incognito) return '';
    const host = core.hostFromURL(tab.url);
    return host ? core.siteHost(host) : '';
  }
  async function currentTab(tabId, version, url) {
    if (tabVersions.get(tabId) !== version) return null;
    try {
      const tab = await api.tabs.get(tabId);
      return tabVersions.get(tabId) === version && tab.active && !tab.incognito && tab.url === url ? tab : null;
    } catch { return null; }
  }
  async function lookup(tab) {
    if (!Number.isInteger(tab?.id)) return;
    const version = nextVersion(tab.id);
    const host = siteOf(tab);
    if (!host || !tab.active) { await clearBadge(tab.id); return; }
    const settings = await service.settings();
    if (!await currentTab(tab.id, version, tab.url)) return;
    if (!settings.automatic) { await clearBadge(tab.id); return; }
    const enabled = core.PROVIDERS.filter(p => settings[p.id]);
    if (!enabled.length) { await clearBadge(tab.id); return; }
    await badge(tab.id, '…', `Script Finder — searching for ${host}`);
    const results = await Promise.all(enabled.map(p => service.search(p.id, host)));
    if (!await currentTab(tab.id, version, tab.url)) return;
    const catalogs = results.filter(r => r.id !== 'github');
    const successful = catalogs.filter(r => r.status === 'ok');
    if (catalogs.length && !successful.length) {
      await badge(tab.id, '!', `Script Finder — catalog lookup failed for ${host}. Open the panel for details and search links.`, '#a34120');
      return;
    }
    if (!catalogs.length) {
      await badge(tab.id, '', `Script Finder — open GitHub repository candidates for ${host}`);
      return;
    }
    const count = successful.reduce((total, result) => total + result.items.length, 0);
    const partial = successful.length !== catalogs.length;
    const more = partial || successful.some(r => r.hasMore);
    const text = `${Math.min(count, 999)}${more || count > 999 ? '+' : ''}`;
    const title = `Script Finder — ${more ? 'at least ' : ''}${count} catalog scripts for ${host}${partial ? ' (one catalog unavailable)' : ''}. GitHub repositories are shown separately.`;
    await badge(tab.id, text, title);
  }
  function runLookup(tab) {
    lookup(tab).catch(() => {
      // A closed tab or unavailable browser action is routine during navigation.
      // Provider failures are represented by the service and shown in the panel.
    });
  }
  async function refreshActive() {
    const tabs = await api.tabs.query({ active: true });
    tabs.forEach(runLookup);
  }

  api.tabs.onActivated.addListener(({ tabId }) => {
    api.tabs.get(tabId).then(runLookup).catch(() => {});
  });
  api.tabs.onUpdated.addListener((tabId, change, tab) => {
    if (change.url || change.status === 'loading') {
      nextVersion(tabId);
      clearBadge(tabId).catch(() => {});
    }
    if (change.status === 'complete' && tab.active) runLookup(tab);
  });
  api.tabs.onRemoved.addListener(tabId => tabVersions.delete(tabId));
  api.windows?.onFocusChanged?.addListener(windowId => {
    if (windowId < 0) return;
    api.tabs.query({ active: true, windowId }).then(tabs => tabs.forEach(runLookup)).catch(() => {});
  });

  function trustedSender(sender) {
    if (sender?.id !== api.runtime.id || !sender.url || sender.tab?.incognito) return false;
    try {
      const url = new URL(sender.url);
      return url.protocol === panelURL.protocol && url.hostname === panelURL.hostname && url.pathname === panelURL.pathname;
    } catch { return false; }
  }
  async function dispatch(message) {
    if (!message || typeof message !== 'object' || message.namespace !== 'script-finder') throw new Error('Unknown request.');
    switch (message.command) {
      case 'settings': return service.settings();
      case 'saveSettings': {
        const value = message.value;
        if (!value || typeof value !== 'object' || Array.isArray(value) ||
            Object.entries(value).some(([key, flag]) => !Object.hasOwn(core.DEFAULTS, key) || typeof flag !== 'boolean')) {
          throw new Error('Invalid settings.');
        }
        const saved = await service.saveSettings(value);
        await refreshActive();
        return saved;
      }
      case 'search': {
        const host = message.host === '*' ? '*' : core.asciiHost(message.host);
        if (host !== '*' && !core.publicHost(host)) throw new Error('Enter a public website hostname. Local and private addresses are not searched.');
        if (!core.PROVIDERS.some(p => p.id === message.id)) throw new Error('Unknown repository.');
        if (host === '*' && message.id === 'github') throw new Error('All-site listings are available from the userscript catalogs.');
        const settings = await service.settings();
        if (!settings[message.id]) throw new Error('This repository is disabled in settings.');
        const options = message.options || {};
        if (typeof options !== 'object' || Array.isArray(options) ||
            Object.keys(options).some(k => !['page', 'force', 'isPrivate'].includes(k)) || options.isPrivate) throw new Error('Invalid search options.');
        if (options.force !== undefined && typeof options.force !== 'boolean') throw new Error('Invalid search options.');
        return service.search(message.id, host, { page: options.page ?? 1, force: options.force === true });
      }
      case 'clearCache': {
        await service.clearCache();
        for (const tabId of tabVersions.keys()) {
          nextVersion(tabId);
          clearBadge(tabId).catch(() => {});
        }
        return true;
      }
      default: throw new Error('Unknown request.');
    }
  }
  api.runtime.onMessage.addListener((message, sender) => {
    if (!trustedSender(sender)) return Promise.resolve({ ok: false, error: 'Only the Script Finder panel may use this service.' });
    return dispatch(message).then(value => ({ ok: true, value }), error => ({ ok: false, error: error?.message || 'Request failed.' }));
  });
  refreshActive().catch(() => {});
})();
