/* Script Finder — MIT. Shared UI bridge for the Firefox popup and sidebar. */
(() => {
  'use strict';
  const isSidebar = new URL(location.href).searchParams.get('view') === 'sidebar';
  document.body.classList.add(isSidebar ? 'sf-sidebar' : 'sf-popup');
  let ui;
  let windowId;
  let updateVersion = 0;
  let activeHost = null;
  async function invoke(command, fields = {}) {
    const response = await browser.runtime.sendMessage({ namespace: 'script-finder', command, ...fields });
    if (!response?.ok) throw new Error(response?.error || 'The background service is unavailable. Reload the extension.');
    return response.value;
  }
  const service = {
    settings: () => invoke('settings'),
    saveSettings: value => invoke('saveSettings', { value }),
    search: (id, host, options = {}) => invoke('search', { id, host, options }),
    clearCache: () => invoke('clearCache')
  };
  function hostFor(tab) {
    const host = tab && !tab.incognito ? SFCore.hostFromURL(tab.url) : null;
    return host ? SFCore.siteHost(host) : '';
  }
  async function updateHost() {
    const version = ++updateVersion;
    const tabs = await browser.tabs.query(windowId === undefined ? { active: true, currentWindow: true } : { active: true, windowId });
    if (version !== updateVersion) return;
    const host = hostFor(tabs[0]);
    if (activeHost !== host) {
      activeHost = host;
      await ui.setHost(host);
    }
  }
  function activated(info) {
    if (windowId === undefined || info.windowId === windowId) updateHost().catch(() => {});
  }
  function updated(tabId, change, tab) {
    if (tab.active && (windowId === undefined || tab.windowId === windowId) && (change.url || change.status === 'complete')) updateHost().catch(() => {});
  }
  async function initialize() {
    windowId = browser.windows?.getCurrent ? (await browser.windows.getCurrent()).id : undefined;
    const tabs = await browser.tabs.query(windowId === undefined ? { active: true, currentWindow: true } : { active: true, windowId });
    activeHost = hostFor(tabs[0]);
    ui = SFUI.mount(document.getElementById('sf-root'), {
      service, host: activeHost,
      onClose: isSidebar ? undefined : () => window.close(),
      openURL: value => {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Only secure repository links may be opened.');
        return browser.tabs.create({ url: url.href, active: true });
      }
    });
    browser.tabs.onActivated.addListener(activated);
    browser.tabs.onUpdated.addListener(updated);
  }
  window.addEventListener('unload', () => {
    browser.tabs.onActivated.removeListener(activated);
    browser.tabs.onUpdated.removeListener(updated);
    ui?.destroy();
  }, { once: true });
  initialize().catch(error => {
    document.getElementById('sf-root').textContent = `Script Finder could not start: ${error?.message || error}`;
  });
})();
