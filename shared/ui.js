/* Shared Script Finder panel. Repository text is always rendered as text. */
(() => {
  'use strict';
  function mount(root, { service, host: initialHost = '', onClose, onSettingsChange, onResults, onClearCache, automaticLock, openURL = url => window.open(url, '_blank', 'noopener,noreferrer') }) {
    const C = globalThis.SFCore;
    let host = initialHost;
    let settings = { ...C.DEFAULTS };
    let generation = 0;
    let destroyed = false;
    let pending = 0;
    let allItems = [];
    const sections = new Map();
    function el(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }
    function button(text, action, className = '') {
      const node = el('button', className, text);
      node.type = 'button';
      node.addEventListener('click', () => Promise.resolve(action()).catch(showError));
      return node;
    }
    function link(text, url) {
      const node = el('a', '', text);
      node.href = url;
      node.target = '_blank';
      node.rel = 'noopener noreferrer';
      node.addEventListener('click', event => {
        event.preventDefault();
        try { Promise.resolve(openURL(url)).catch(showError); } catch (error) { showError(error); }
      });
      return node;
    }
    const app = el('main', 'sf-app');
    const header = el('header', 'sf-header');
    const title = el('div');
    title.append(el('h1', '', 'Script Finder'), el('p', 'sf-subtitle', 'Userscripts for the site you’re visiting'));
    header.append(title);
    if (onClose) header.append(button('Close', onClose, 'sf-quiet'));
    app.append(header);
    const form = el('form', 'sf-host-form');
    const label = el('label', 'sf-label', 'Search site');
    const input = el('input', 'sf-host');
    input.type = 'text';
    input.placeholder = 'youtube.com';
    input.setAttribute('aria-label', 'Website hostname, or * for all-site scripts');
    input.autocomplete = 'off';
    input.spellcheck = false;
    label.append(input);
    const go = el('button', 'sf-primary', 'Find scripts');
    go.type = 'submit';
    form.append(label, go);
    form.addEventListener('submit', event => {
      event.preventDefault();
      try {
        const next = input.value.trim() === '*' ? '*' : C.asciiHost(input.value);
        if (next !== '*' && !C.publicHost(next)) throw new Error('Use a public website hostname. Local and private addresses are not searched.');
        host = next;
        refresh().catch(showError);
      } catch (error) { showError(error); }
    });
    app.append(form);
    const actions = el('div', 'sf-actions');
    actions.append(button('Refresh', () => refresh(true)), button('All-site scripts', () => { host = '*'; return refresh(); }));
    const status = el('p', 'sf-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const errorBox = el('p', 'sf-error');
    errorBox.setAttribute('role', 'alert');
    errorBox.hidden = true;
    app.append(actions, status, errorBox);
    const controls = el('div', 'sf-filter-row');
    const filter = el('input', 'sf-filter');
    filter.type = 'search';
    filter.placeholder = 'Filter loaded results…';
    filter.setAttribute('aria-label', 'Filter loaded results by name, description or author');
    filter.addEventListener('input', filterResults);
    const sort = el('select', 'sf-sort');
    sort.setAttribute('aria-label', 'Sort results');
    for (const [value, text] of [['popular','Most popular'], ['updated','Recently updated'], ['name','Name']]) {
      const option = el('option', '', text); option.value = value; sort.append(option);
    }
    sort.addEventListener('change', renderAllLists);
    controls.append(filter, sort);
    app.append(controls);
    const results = el('div', 'sf-results');
    const directory = el('details', 'sf-directory');
    const summary = el('summary', '', 'Search more repositories');
    const directoryNote = el('p', 'sf-note', 'Search links open the repository’s own search. Code hosts may require sign-in or find only names and descriptions.');
    const directoryLinks = el('div', 'sf-links');
    directory.append(summary, directoryNote, directoryLinks);
    app.append(directory);
    const options = el('details', 'sf-options');
    options.append(el('summary', '', 'Settings & privacy'));
    const settingsFields = new Map();
    for (const [key, text] of [
      ['automatic', 'Look up sites automatically'],
      ['greasyfork', 'Greasy Fork scripts'],
      ['sleazyfork', 'Sleazy Fork scripts (includes adult listings)'],
      ['github', 'GitHub repository candidates']
    ]) {
      const row = el('label', 'sf-check');
      const check = el('input'); check.type = 'checkbox';
      if (key === 'automatic' && automaticLock) { check.disabled = true; row.title = automaticLock; }
      check.addEventListener('change', async () => {
        check.disabled = true;
        try {
          settings = await service.saveSettings({ [key]: check.checked });
          await onSettingsChange?.(settings);
        }
        catch (error) { check.checked = settings[key]; showError(error); }
        finally { check.disabled = false; }
        if (key !== 'automatic') { try { await refresh(); } catch (error) { showError(error); } }
      });
      row.append(check, document.createTextNode(text));
      settingsFields.set(key, check);
      options.append(row);
    }
    if (automaticLock) options.append(el('p', 'sf-note', automaticLock));
    options.append(el('p', 'sf-note', 'Automatic discovery sends only the site hostname to enabled repositories. Results are cached locally. GitHub can limit frequent searches. Disable automatic lookups to search only when you click Find scripts.'));
    options.append(button('Clear cached results', async () => {
      await service.clearCache();
      onClearCache?.();
      status.textContent = 'Cached results cleared. Click Find scripts to look up this site again.';
    }));
    app.append(options);
    app.append(results);
    app.append(el('footer', 'sf-footer', 'Discovery only. Review the code; Violentmonkey installs and runs .user.js files. Catalog matches may cover the whole domain or only some paths.'));
    root.append(app);
    function showError(error) {
      if (destroyed) return;
      errorBox.textContent = error?.message || String(error);
      errorBox.hidden = false;
    }
    function updateStatus() {
      const scripts = allItems.filter(i => i.kind === 'script').length;
      const repos = allItems.filter(i => i.kind === 'repository').length;
      status.textContent = `${pending ? 'Searching… ' : ''}${scripts} scripts · ${repos} repository candidates loaded${host === '*' ? ' · All-site catalog' : ''}`;
      if (!pending) onResults?.({ host, items: allItems, hasMore: [...sections.values()].some(s => s.hasMore), errors: [...sections.entries()].filter(([id, s]) => id !== 'github' && s.failed).length });
    }
    function filterResults() {
      const query = filter.value.trim().toLocaleLowerCase();
      for (const node of results.querySelectorAll('.sf-card')) {
        node.hidden = query !== '' && !node.dataset.search.includes(query);
      }
    }
    function formatDate(value) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
    }
    function renderList(section) {
      section.list.replaceChildren();
      const items = [...section.items];
      items.sort(sort.value === 'name' ? (a,b) => a.name.localeCompare(b.name) :
        sort.value === 'updated' ? (a,b) => (Date.parse(b.updated) || 0) - (Date.parse(a.updated) || 0) :
        (a,b) => b.installs - a.installs);
      for (const item of items) {
        const card = el('article', 'sf-card');
        card.dataset.search = `${item.name} ${item.description} ${item.author}`.toLocaleLowerCase();
        const heading = el('h3'); heading.append(link(item.name, item.url));
        card.append(heading, el('p', 'sf-description', item.description));
        const facts = [`${Number(item.installs).toLocaleString()} ${item.kind === 'repository' ? 'stars' : 'daily installs'}`];
        if (item.author) facts.push(item.author);
        const updated = formatDate(item.updated); if (updated) facts.push(`Updated ${updated}`);
        card.append(el('p', 'sf-meta', facts.join(' · ')));
        const links = el('div', 'sf-card-links');
        if (item.kind === 'script') {
          links.append(link('Details', item.url), link('View code', `${item.url}/code`));
          if (item.codeURL) links.append(link('.user.js', item.codeURL));
        } else links.append(link('Browse repository', item.url));
        card.append(links);
        section.list.append(card);
      }
      filterResults();
    }
    function renderAllLists() { for (const section of sections.values()) renderList(section); }
    async function loadProvider(provider, page, force, ticket) {
      const section = sections.get(provider.id);
      section.more.disabled = true;
      section.message.textContent = `Searching ${provider.name}…`;
      pending++; updateStatus();
      try {
        const response = await service.search(provider.id, host, { page, force });
        if (destroyed || ticket !== generation) return;
        if (response.status === 'error') {
          section.failed = true;
          section.message.textContent = response.error;
          section.message.className = 'sf-provider-message sf-error';
          section.more.textContent = 'Retry';
          section.more.hidden = false;
          section.retryPage = page;
          section.forceNext = true;
        } else {
          section.failed = false;
          section.hasMore = response.hasMore;
          const ids = new Set(section.items.map(i => i.id));
          section.items.push(...response.items.filter(i => !ids.has(i.id)));
          allItems = [...sections.values()].flatMap(s => s.items);
          section.message.className = 'sf-provider-message sf-note';
          section.message.textContent = section.items.length ? `${section.items.length}${response.hasMore ? '+' : ''} loaded${response.cached ? ' · cached' : ''}. ${response.note || ''}` : 'No catalog matches returned for this hostname. Try the parent domain, all-site scripts, or the repository search links.';
          section.more.hidden = !response.hasMore;
          section.more.textContent = 'Load more';
          section.retryPage = page + 1;
          section.forceNext = false;
          renderList(section);
        }
      } catch (error) {
        if (destroyed || ticket !== generation) return;
        section.message.className = 'sf-provider-message sf-error';
        section.failed = true;
        section.message.textContent = error?.message || 'Search failed.';
        section.more.hidden = false; section.more.textContent = 'Retry';
        section.retryPage = page; section.forceNext = true;
      } finally {
        if (!destroyed && ticket === generation) {
          pending--; section.more.disabled = false; updateStatus();
        }
      }
    }
    async function refresh(force = false, manual = true) {
      const ticket = ++generation;
      errorBox.hidden = true;
      pending = 0; allItems = []; sections.clear(); results.replaceChildren(); directoryLinks.replaceChildren();
      settings = await service.settings();
      if (destroyed || ticket !== generation) return;
      for (const [key, check] of settingsFields) check.checked = settings[key];
      input.value = host || '';
      if (!host) {
        status.textContent = 'Open a public HTTP or HTTPS website, or enter a hostname above.';
        return;
      }
      for (const item of C.directoryLinks(host)) directoryLinks.append(link(item.name, item.url));
      if (!manual && !settings.automatic) {
        status.textContent = 'Automatic lookups are off. Click Find scripts to search this site.';
        return;
      }
      const enabled = C.PROVIDERS.filter(p => settings[p.id] && !(host === '*' && p.id === 'github'));
      if (!enabled.length) { status.textContent = 'Enable at least one repository in Settings.'; return; }
      const tasks = [];
      for (const provider of enabled) {
        const block = el('section', 'sf-provider');
        block.append(el('h2', '', `${provider.name}${provider.kind === 'repository' ? ' · repositories' : ''}`));
        const message = el('p', 'sf-provider-message sf-note');
        const list = el('div', 'sf-list');
        const section = { message, list, items: [], retryPage: 1, forceNext: false };
        section.more = button('Load more', () => loadProvider(provider, section.retryPage, section.forceNext, ticket), 'sf-more');
        section.more.hidden = true;
        block.append(message, list, section.more); results.append(block); sections.set(provider.id, section);
        tasks.push(loadProvider(provider, 1, force, ticket));
      }
      await Promise.allSettled(tasks);
    }
    function setHost(value) {
      host = value || '';
      return refresh(false, false);
    }
    refresh(false, false).catch(showError);
    return { setHost, refresh, destroy() { destroyed = true; generation++; app.remove(); } };
  }
  globalThis.SFUI = Object.freeze({ mount });
})();
