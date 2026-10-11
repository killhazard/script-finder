/* Script Finder — MIT. No downloaded JavaScript is executed. */
(() => {
  'use strict';
  const DEFAULTS = Object.freeze({ automatic: true, greasyfork: true, sleazyfork: true, github: true });
  const PROVIDERS = Object.freeze([
    { id: 'greasyfork', name: 'Greasy Fork', kind: 'script', origin: 'https://api.greasyfork.org' },
    { id: 'sleazyfork', name: 'Sleazy Fork', kind: 'script', origin: 'https://api.sleazyfork.org' },
    { id: 'github', name: 'GitHub', kind: 'repository', origin: 'https://api.github.com' }
  ]);
  let suffixes;
  function asciiHost(value) {
    const raw = String(value || '').trim();
    if (!raw || /[\s/@?#\\:]/.test(raw)) throw new Error('Enter a hostname, such as youtube.com.');
    const url = new URL(`https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!/^[a-z0-9.-]+$/.test(host) || host.split('.').some(p => !p || p.length > 63 || p.startsWith('-') || p.endsWith('-')) || host.length > 253) {
      throw new Error('Enter a valid hostname.');
    }
    return host;
  }
  function publicHost(host) {
    return typeof host === 'string' && /^[a-z0-9.-]+$/.test(host) &&
      host.includes('.') && !/^\d+(?:\.\d+){3}$/.test(host) &&
      !/(?:^|\.)(?:localhost|local|localdomain|lan|home|corp|intranet|internal|invalid|test|example|onion|arpa)$/.test(host);
  }
  function rules() {
    if (!suffixes) {
      suffixes = { exact: new Set(), wildcard: new Set(), exception: new Set() };
      for (let rule of (globalThis.SF_SUFFIX_RULES || '').split('\n')) {
        if (!rule) continue;
        let type = 'exact';
        if (rule.startsWith('!')) { type = 'exception'; rule = rule.slice(1); }
        else if (rule.startsWith('*.')) { type = 'wildcard'; rule = rule.slice(2); }
        if (/[^\x00-\x7f]/.test(rule)) rule = new URL(`https://${rule}`).hostname;
        suffixes[type].add(rule);
      }
    }
    return suffixes;
  }
  function siteHost(value) {
    const host = asciiHost(value);
    if (!publicHost(host)) return host;
    const parts = host.split('.');
    const list = rules();
    let size = 1;
    for (let i = 0; i < parts.length; i++) {
      const part = parts.slice(i).join('.');
      if (list.exception.has(part)) return parts.slice(Math.max(0, i)).join('.');
      if (list.exact.has(part)) size = Math.max(size, parts.length - i);
      if (i > 0 && list.wildcard.has(part)) size = Math.max(size, parts.length - i + 1);
    }
    return parts.slice(-Math.min(parts.length, size + 1)).join('.');
  }
  function hostFromURL(value) {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
      const host = asciiHost(url.hostname);
      return publicHost(host) ? host : null;
    } catch { return null; }
  }
  function safeURL(value, allowedHosts) {
    try {
      if (typeof value !== 'string' || /[\u0000-\u0020\\]/.test(value)) return '';
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
        allowedHosts.includes(url.hostname) ? url.href : '';
    } catch { return ''; }
  }
  function directoryLinks(value) {
    if (value === '*') return [
      { name: 'Greasy Fork', url: 'https://greasyfork.org/en/scripts/by-site/*?filter_locale=0' },
      { name: 'Sleazy Fork', url: 'https://sleazyfork.org/en/scripts/by-site/*?filter_locale=0' }
    ];
    const host = asciiHost(value);
    const enc = encodeURIComponent;
    return [
      ['Greasy Fork', `https://greasyfork.org/en/scripts/by-site/${enc(host)}?filter_locale=0`],
      ['Sleazy Fork', `https://sleazyfork.org/en/scripts/by-site/${enc(host)}?filter_locale=0`],
      ['OpenUserJS', `https://openuserjs.org/?q=${enc(host)}`],
      ['Userscript.Zone', `https://www.userscript.zone/search?q=${enc(host)}`],
      ['ScriptCat', `https://scriptcat.org/en/search?domain=${enc(host)}`],
      ['GitHub code', `https://github.com/search?type=code&q=${enc(`"${host}" path:*.user.js`)}`],
      ['GitHub repositories', `https://github.com/search?type=repositories&q=${enc(`"${host}" userscript in:name,description,readme`)}`],
      ['GitHub Gists', `https://gist.github.com/search?q=${enc(`${host} userscript`)}`],
      ['GitLab', `https://gitlab.com/explore/projects?name=${enc(`${host} userscript`)}`],
      ['Codeberg', `https://codeberg.org/explore/repos?q=${enc(`${host} userscript`)}&topic=false`],
      ['Gitee', `https://search.gitee.com/?q=${enc(`${host} userscript`)}&type=repository`],
      ['SourceHut', `https://sr.ht/projects?search=${enc(`${host} userscript`)}`],
      ['Web search', `https://www.google.com/search?q=${enc(`"${host}" "userscript" OR "user.js"`)}`]
    ].map(([name, url]) => ({ name, url }));
  }
  function providerURL(id, host, page) {
    const provider = PROVIDERS.find(p => p.id === id);
    if (!provider) throw new Error('Unknown repository.');
    if (id === 'github') {
      if (host === '*') throw new Error('GitHub requires a specific hostname; all-sites search is available on Greasy Fork and Sleazy Fork.');
      const url = new URL('/search/repositories', provider.origin);
      url.search = new URLSearchParams({ q: `"${host}" userscript in:name,description,readme`, sort: 'stars', per_page: '30', page: String(page) });
      return url.href;
    }
    const url = new URL('/en/scripts.json', provider.origin);
    url.search = new URLSearchParams({ site: host, filter_locale: '0', language: 'js', sort: 'daily_installs', page: String(page) });
    return url.href;
  }
  function normalize(id, data, page) {
    if (id === 'github') {
      if (!data || !Array.isArray(data.items)) throw new Error('Unexpected GitHub response format.');
      const items = data.items.map(r => ({
        id: `github:${r.id}`, kind: 'repository', source: id, name: String(r.full_name || r.name || 'Repository'),
        description: String(r.description || ''), url: safeURL(r.html_url, ['github.com']), codeURL: '',
        installs: Number(r.stargazers_count) || 0, updated: r.pushed_at || '', author: r.owner?.login || ''
      })).filter(r => r.url);
      return { items, hasMore: items.length === 30 && page * 30 < Math.min(Number(data.total_count) || 0, 1000), note: 'Repository candidates; inspect their .user.js files and @match rules.' };
    }
    // Greasy/Sleazy Fork currently wrap results in .query. Older servers return an array.
    const rows = Array.isArray(data) ? data : data?.query;
    if (!Array.isArray(rows)) throw new Error('Unexpected catalog response format; use the repository search link.');
    const host = id === 'greasyfork' ? 'greasyfork.org' : 'sleazyfork.org';
    const items = rows.filter(r => r && !r.deleted).map(r => ({
      id: `${id}:${r.id}`, kind: 'script', source: id, name: String(r.name || 'Untitled script'),
      description: String(r.description || ''), url: safeURL(r.url, [host]),
      codeURL: safeURL(r.code_url, [`update.${host}`, host]),
      installs: Number(r.daily_installs) || 0, updated: r.code_updated_at || '',
      author: Array.isArray(r.users) ? r.users.map(u => u.name).join(', ') : ''
    })).filter(r => r.url);
    return { items, hasMore: rows.length >= 100, note: 'Site catalog matches; Violentmonkey checks the precise @match / @include rules.' };
  }
  function createService({ request, get, set, privateMode = false, now = () => Date.now() }) {
    const inflight = new Map();
    const memory = new Map();
    let githubNext = 0;
    let writes = Promise.resolve();
    let settingsWrites = Promise.resolve();
    let cacheEpoch = 0;
    async function settings() {
      const stored = await get('sf_settings', {});
      return Object.fromEntries(Object.entries(DEFAULTS).map(([key, fallback]) => [key, typeof stored?.[key] === 'boolean' ? stored[key] : fallback]));
    }
    async function saveSettings(value) {
      const update = Object.fromEntries(Object.keys(DEFAULTS).filter(key => typeof value?.[key] === 'boolean').map(key => [key, value[key]]));
      const task = settingsWrites.then(async () => {
        const next = { ...await settings(), ...update };
        await set('sf_settings', next);
        return next;
      });
      settingsWrites = task.catch(() => {});
      return task;
    }
    async function readCache(key, isPrivate) {
      if (isPrivate || privateMode) return memory.get(key);
      const cache = await get('sf_cache', {});
      return cache?.[key];
    }
    async function writeCache(key, value, isPrivate, epoch) {
      if (epoch !== cacheEpoch) return;
      // Private lookup history stays exclusively in its own in-memory cache.
      if (isPrivate || privateMode) {
        memory.set(key, value);
        if (memory.size > 200) memory.delete(memory.keys().next().value);
        return;
      }
      const task = writes.then(async () => {
        if (epoch !== cacheEpoch) return;
        const cache = { ...await get('sf_cache', {}), [key]: value };
        if (epoch !== cacheEpoch) return;
        const entries = Object.entries(cache).filter(([, v]) => v && v.expires > now()).sort((a,b) => b[1].at - a[1].at).slice(0, 120);
        await set('sf_cache', Object.fromEntries(entries));
      });
      writes = task.catch(() => {});
      await task;
    }
    async function search(id, value, { page = 1, force = false, isPrivate = false } = {}) {
      const host = value === '*' ? '*' : asciiHost(value);
      if (!PROVIDERS.some(p => p.id === id)) throw new Error('Unknown repository.');
      if (host !== '*' && !publicHost(host)) throw new Error('Enter a public hostname. Local addresses and IP addresses are not sent to repositories.');
      if (host === '*' && id === 'github') throw new Error('GitHub requires a specific hostname; all-sites search is available on Greasy Fork and Sleazy Fork.');
      if (!Number.isInteger(page) || page < 1 || page > (id === 'github' ? 34 : 1000)) throw new Error('Invalid page number.');
      const key = `${id}:${host}:${page}`;
      const privateKey = `${isPrivate || privateMode ? 'private' : 'normal'}:${key}`;
      if (!force) {
        const cached = await readCache(key, isPrivate);
        if (cached?.expires > now()) return { ...cached.result, cached: true };
      }
      if (inflight.has(privateKey)) return inflight.get(privateKey);
      const epoch = cacheEpoch;
      const task = (async () => {
        const result = { id, host, page, items: [], hasMore: false, status: 'ok', at: now(), cached: false };
        try {
          if (id === 'github' && now() < githubNext) throw new Error(`GitHub search is cooling down. Retry in ${Math.ceil((githubNext - now()) / 1000)} seconds, or use its search link.`);
          if (id === 'github') githubNext = now() + 7000;
          const response = await request(providerURL(id, host, page));
          if (!Number.isInteger(response?.status)) throw new Error('Repository returned an invalid HTTP response. Use its search link.');
          if (response.status < 200 || response.status >= 300) {
            if (id === 'github' && [403,429].includes(response.status)) {
              const reset = Number(response.headers?.['x-ratelimit-reset']) * 1000;
              githubNext = Math.max(now() + 60000, Number.isFinite(reset) ? reset : 0);
            }
            throw new Error(response.status === 429 ? 'Rate limited (HTTP 429). Wait and retry, or open the search link.' :
              response.status === 404 ? 'Repository returned HTTP 404; this site may be unsupported or restricted.' :
              response.status === 403 ? 'Access blocked or rate limited (HTTP 403). Open the search link or retry later.' : `Repository returned HTTP ${response.status}.`);
          }
          let data;
          try { data = JSON.parse(response.text); } catch { throw new Error('Repository returned a non-JSON page, possibly an anti-bot challenge. Use its search link.'); }
          Object.assign(result, normalize(id, data, page));
        } catch (error) {
          result.status = 'error';
          result.error = error?.message || 'Request failed. Check your connection and retry.';
        }
        try {
          await writeCache(key, { at: now(), expires: now() + (result.status === 'error' ? 60000 : id === 'github' ? 3600000 : 1800000), result }, isPrivate, epoch);
        } catch { result.storageWarning = 'Cache could not be saved.'; }
        return result;
      })();
      inflight.set(privateKey, task);
      try { return await task; } finally { if (inflight.get(privateKey) === task) inflight.delete(privateKey); }
    }
    async function clearCache() {
      cacheEpoch++;
      inflight.clear();
      await writes;
      memory.clear();
      await set('sf_cache', {});
    }
    return { settings, saveSettings, search, clearCache };
  }
  globalThis.SFCore = Object.freeze({ DEFAULTS, PROVIDERS, asciiHost, publicHost, siteHost, hostFromURL, safeURL, directoryLinks, providerURL, normalize, createService });
})();
