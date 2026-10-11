'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../shared/suffix-rules.js');
require('../shared/core.js');
const C = globalThis.SFCore;

const script = (id = 1, source = 'greasyfork') => ({ id, name: 'Useful script', description: 'Works on this website', url: `https://${source}.org/en/scripts/${id}`, code_url: `https://update.${source}.org/scripts/${id}/Useful.user.js`, daily_installs: 25, users: [{ name: 'Author' }] });
const jsonResponse = (data, status = 200, headers = {}) => ({ status, text: JSON.stringify(data), headers });
function fixture(request, options = {}) {
  const values = new Map();
  const calls = [];
  let clock = 100000;
  const service = C.createService({
    request: async url => { calls.push(url); return request(url, calls.length); },
    get: async (key, fallback) => values.has(key) ? structuredClone(values.get(key)) : fallback,
    set: async (key, value) => { values.set(key, structuredClone(value)); },
    now: () => clock,
    ...options
  });
  return { service, calls, values, advance: ms => { clock += ms; } };
}

// These tests assert user-visible search behavior and trust boundaries, not UI markup.
test('normalizes case, trailing dots and internationalized hostnames', () => {
  assert.equal(C.asciiHost(' WWW.YouTube.COM. '), 'www.youtube.com');
  assert.equal(C.asciiHost('BÜCHER.DE'), 'xn--bcher-kva.de');
  for (const value of ['https://youtube.com', 'user@youtube.com', 'youtube.com/path', 'youtube.com?x=y', 'youtube.com#x', 'youtube.com:443', 'youtube..com', '-youtube.com', 'you tube.com', '<svg>.com', '']) {
    assert.throws(() => C.asciiHost(value), undefined, value);
  }
});

test('uses PSL rules for country domains, private suffixes, wildcard and exception rules', () => {
  const expected = new Map([
    ['www.bbc.co.uk', 'bbc.co.uk'],
    ['a.b.example.com', 'example.com'],
    ['docs.alice.github.io', 'alice.github.io'],
    ['a.foo.kawasaki.jp', 'a.foo.kawasaki.jp'],
    ['www.city.kawasaki.jp', 'city.kawasaki.jp'],
    ['食狮.公司.cn', 'xn--85x722f.xn--55qx5d.cn']
  ]);
  for (const [host, site] of expected) assert.equal(C.siteHost(host), site, host);
});

test('extracts only public HTTP(S) URL hostnames and retains the exact subdomain', () => {
  assert.equal(C.hostFromURL('https://aistudio.google.com/sensitive?token=secret'), 'aistudio.google.com');
  assert.equal(C.hostFromURL('http://www.bbc.co.uk:8080/news'), 'www.bbc.co.uk');
  assert.equal(C.hostFromURL('https://bücher.de/'), 'xn--bcher-kva.de');
  for (const value of ['https://localhost/', 'http://printer.local/', 'http://portal.internal/', 'http://portal.lan/', 'http://router.home/', 'http://x.home.arpa/', 'http://foo.onion/', 'http://10.0.0.1/', 'http://192.168.0.1/', 'http://127.1/', 'http://0x7f000001/', 'http://[::1]/', 'http://8.8.8.8/', 'https://foo.invalid/', 'file:///tmp/page.html', 'about:config', 'moz-extension://id/path', 'javascript:alert(1)', 'data:text/html,hello', 'not a URL', 'https://user:password@youtube.com/']) {
    assert.equal(C.hostFromURL(value), null, value);
  }
});

test('only permits HTTPS links to the exact advertised provider authority', () => {
  assert.equal(C.safeURL('https://github.com/author/repo', ['github.com']), 'https://github.com/author/repo');
  for (const value of ['javascript:alert(1)', 'data:text/javascript,alert(1)', 'http://github.com/a/b', 'https://github.com.evil.invalid/a', 'https://github.com@evil.invalid/a', 'https://user:password@github.com/a', 'https://github.com:8080/a', '//github.com/a', 'https://github.com\\@evil.invalid/a']) {
    assert.equal(C.safeURL(value, ['github.com']), '', value);
  }
});

test('requests the current JSON catalog route, with site, language and locale parameters', () => {
  for (const id of ['greasyfork', 'sleazyfork']) {
    const url = new URL(C.providerURL(id, 'aistudio.google.com', 2));
    assert.equal(url.origin, `https://api.${id}.org`);
    assert.equal(url.pathname, '/en/scripts.json');
    assert.equal(url.searchParams.get('site'), 'aistudio.google.com');
    assert.equal(url.searchParams.get('language'), 'js');
    assert.equal(url.searchParams.get('filter_locale'), '0');
    assert.equal(url.searchParams.get('page'), '2');
    assert.ok(!url.pathname.includes('by-site'));
  }
});

test('supports both historical arrays and current wrapped catalog results', async () => {
  for (const data of [[script()], { query: [script()], options: {} }]) {
    const f = fixture(() => jsonResponse(data));
    const result = await f.service.search('greasyfork', 'youtube.com');
    assert.equal(result.status, 'ok');
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].kind, 'script');
    assert.match(result.items[0].codeURL, /^https:\/\/update\.greasyfork\.org\//);
    assert.equal(result.hasMore, false);
  }
});

test('empty catalogs are successful, and 100 catalog rows offer a next page', async () => {
  const f = fixture((url) => jsonResponse(new URL(url).searchParams.get('page') === '1' ? { query: [] } : { query: Array.from({ length: 100 }, (_, i) => script(i)) }));
  assert.deepEqual((await f.service.search('greasyfork', 'youtube.com')).items, []);
  assert.equal((await f.service.search('greasyfork', 'youtube.com', { page: 2 })).hasMore, true);
});

test('malformed JSON, challenge HTML and wrong response shapes are visible source errors', async () => {
  for (const response of [{ status: 200, text: '<html>Verify you are human</html>' }, { status: 200, text: '{' }, jsonResponse({ challenge: true }), { text: JSON.stringify([script()]) }]) {
    const f = fixture(() => response);
    const result = await f.service.search('greasyfork', 'youtube.com');
    assert.equal(result.status, 'error');
    assert.ok(result.error);
    assert.deepEqual(result.items, []);
  }
});

test('HTTP errors and transport failures are visible and do not suppress another provider', async () => {
  const f = fixture(url => url.includes('api.sleazyfork.org') ? jsonResponse({}, 429) : jsonResponse([script()]));
  const [good, failed] = await Promise.all([f.service.search('greasyfork', 'youtube.com'), f.service.search('sleazyfork', 'youtube.com')]);
  assert.equal(good.status, 'ok');
  assert.equal(good.items.length, 1);
  assert.equal(failed.status, 'error');
  assert.match(failed.error, /429|rate limited/i);
  const transport = fixture(() => { throw new Error('Network timeout'); });
  assert.match((await transport.service.search('greasyfork', 'youtube.com')).error, /timeout/i);
});

test('catalog results reject malicious navigation and install URLs without executing content', () => {
  const data = [script(1), { ...script(2), name: '<img src=x onerror=alert(1)>', code_url: 'javascript:alert(1)' }, { ...script(3), url: 'https://greasyfork.org.evil.invalid/script' }, { ...script(4), url: 'https://user@greasyfork.org/script' }, { ...script(5), code_url: 'https://evil.invalid/steal.user.js' }, { ...script(6), deleted: true }];
  const result = C.normalize('greasyfork', { query: data }, 1);
  assert.deepEqual(result.items.map(item => item.id), ['greasyfork:1', 'greasyfork:2', 'greasyfork:5']);
  assert.equal(result.items[1].name, '<img src=x onerror=alert(1)>');
  assert.equal(result.items[1].codeURL, '');
  assert.equal(result.items[2].codeURL, '');
});

test('GitHub searches work without tokens and remain repository candidates with no install URL', async () => {
  const f = fixture(() => jsonResponse({ total_count: 1, items: [{ id: 1, full_name: 'author/userscripts', html_url: 'https://github.com/author/userscripts', stargazers_count: 7, owner: { login: 'author' } }] }));
  const result = await f.service.search('github', 'youtube.com');
  assert.equal(result.status, 'ok');
  assert.equal(result.items[0].kind, 'repository');
  assert.equal(result.items[0].codeURL, '');
  assert.match(result.note, /candidate/i);
  const url = new URL(f.calls[0]);
  assert.equal(url.pathname, '/search/repositories');
  assert.match(url.searchParams.get('q'), /youtube\.com/);
  assert.ok(!url.searchParams.has('access_token'));
});

test('settings keep only recognized boolean fields, accepting missing and malformed storage', async () => {
  const f = fixture(() => jsonResponse([]));
  f.values.set('sf_settings', { automatic: false, greasyfork: 'true', sleazyfork: null, github: 0, token: 'secret', injected: 'bad' });
  assert.deepEqual(await f.service.settings(), { automatic: false, greasyfork: true, sleazyfork: true, github: true });
  assert.deepEqual(await f.service.saveSettings({ github: false, automatic: 0, token: 'secret' }), { automatic: false, greasyfork: true, sleazyfork: true, github: false });
  assert.deepEqual(await f.service.saveSettings(null), await f.service.settings());
  assert.deepEqual(Object.keys(f.values.get('sf_settings')).sort(), Object.keys(C.DEFAULTS).sort());
});

test('simultaneous settings changes preserve both preferences', async () => {
  const f = fixture(() => jsonResponse([]));
  await Promise.all([
    f.service.saveSettings({ greasyfork: false }),
    f.service.saveSettings({ sleazyfork: false })
  ]);
  assert.deepEqual(await f.service.settings(), { automatic: true, greasyfork: false, sleazyfork: false, github: true });
});

test('rejects non-public search scopes and invalid pages before any network call', async () => {
  const f = fixture(() => jsonResponse([]));
  for (const host of ['localhost', 'printer.local', 'router.lan', 'x.home.arpa', '10.0.0.1', '127.1', '[::1]', 'foo.invalid', 'javascript:alert(1)', 'youtube.com@evil.invalid', 'youtube.com/path']) {
    await assert.rejects(f.service.search('greasyfork', host), undefined, host);
  }
  await assert.rejects(f.service.search('unknown', 'youtube.com'));
  for (const page of [0, -1, 1.5, '2', 1001, NaN]) await assert.rejects(f.service.search('greasyfork', 'youtube.com', { page }));
  assert.equal(f.calls.length, 0);
});

test('universal scope is explicit and supported only by fork catalogs', async () => {
  const f = fixture(() => jsonResponse([script()]));
  for (const id of ['greasyfork', 'sleazyfork']) {
    const result = await f.service.search(id, '*');
    assert.equal(result.status, 'ok');
    assert.equal(result.host, '*');
    assert.equal(new URL(f.calls.at(-1)).searchParams.get('site'), '*');
  }
  await assert.rejects(f.service.search('github', '*'), /all.sites|universal|specific/i);
  const links = C.directoryLinks('*');
  assert.deepEqual(links.map(link => link.name), ['Greasy Fork', 'Sleazy Fork']);
  assert.throws(() => C.asciiHost('*'));
});

test('directory links cover advertised sources and encode exact hostnames', () => {
  const links = C.directoryLinks('aistudio.google.com');
  for (const name of ['Greasy Fork', 'Sleazy Fork', 'OpenUserJS', 'Userscript.Zone', 'ScriptCat', 'GitHub code', 'GitHub repositories', 'GitHub Gists', 'GitLab', 'Codeberg', 'Gitee', 'SourceHut']) {
    const link = links.find(item => item.name === name);
    assert.ok(link, name);
    assert.equal(new URL(link.url).protocol, 'https:');
    assert.ok(decodeURIComponent(link.url).includes('aistudio.google.com'), name);
  }
});

test('same-scope concurrent searches share one request', async () => {
  let complete;
  const f = fixture(() => new Promise(resolve => { complete = resolve; }));
  const first = f.service.search('greasyfork', 'youtube.com');
  const second = f.service.search('greasyfork', 'youtube.com');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.calls.length, 1);
  complete(jsonResponse([script()]));
  assert.deepEqual(await first, await second);
});

test('cache hits, expiration and forced refresh make expected network requests', async () => {
  const f = fixture((url, count) => jsonResponse([script(count)]));
  assert.equal((await f.service.search('greasyfork', 'youtube.com')).cached, false);
  assert.equal((await f.service.search('greasyfork', 'youtube.com')).cached, true);
  assert.equal(f.calls.length, 1);
  const refresh = await f.service.search('greasyfork', 'youtube.com', { force: true });
  assert.equal(refresh.cached, false);
  assert.equal(refresh.items[0].id, 'greasyfork:2');
  f.advance(30 * 60 * 1000 + 1);
  assert.equal((await f.service.search('greasyfork', 'youtube.com')).cached, false);
  assert.equal(f.calls.length, 3);
});

test('cached failures expire quickly and forced retries can recover immediately', async () => {
  const f = fixture((url, count) => count === 1 ? jsonResponse({}, 503) : jsonResponse([script()]));
  assert.equal((await f.service.search('greasyfork', 'youtube.com')).status, 'error');
  assert.equal((await f.service.search('greasyfork', 'youtube.com')).cached, true);
  assert.equal((await f.service.search('greasyfork', 'youtube.com', { force: true })).status, 'ok');
  const g = fixture(() => jsonResponse({}, 503));
  await g.service.search('greasyfork', 'youtube.com');
  g.advance(60001);
  assert.equal((await g.service.search('greasyfork', 'youtube.com')).cached, false);
  assert.equal(g.calls.length, 2);
});

test('private requests are isolated from normal cache and never persist lookup history', async () => {
  const f = fixture((url, count) => jsonResponse([script(count)]));
  await f.service.search('greasyfork', 'youtube.com');
  const normalCache = structuredClone(f.values.get('sf_cache'));
  const firstPrivate = await f.service.search('greasyfork', 'youtube.com', { isPrivate: true });
  assert.equal(firstPrivate.cached, false);
  assert.equal(firstPrivate.items[0].id, 'greasyfork:2');
  assert.equal((await f.service.search('greasyfork', 'youtube.com', { isPrivate: true })).cached, true);
  assert.deepEqual(f.values.get('sf_cache'), normalCache);
  const privateService = fixture(() => jsonResponse([script()]), { privateMode: true });
  await privateService.service.search('greasyfork', 'youtube.com');
  assert.equal(privateService.values.has('sf_cache'), false);
});

test('clearing cache invalidates existing entries', async () => {
  const f = fixture(() => jsonResponse([script()]));
  await f.service.search('greasyfork', 'youtube.com');
  await f.service.search('greasyfork', 'youtube.com', { isPrivate: true });
  await f.service.clearCache();
  assert.deepEqual(f.values.get('sf_cache'), {});
  assert.equal((await f.service.search('greasyfork', 'youtube.com')).cached, false);
  assert.equal((await f.service.search('greasyfork', 'youtube.com', { isPrivate: true })).cached, false);
});

test('clearing cache while a lookup is running does not restore cleared history', async () => {
  let complete;
  const f = fixture(() => new Promise(resolve => { complete = resolve; }));
  const pending = f.service.search('greasyfork', 'youtube.com');
  await new Promise(resolve => setImmediate(resolve));
  await f.service.clearCache();
  complete(jsonResponse([script()]));
  assert.equal((await pending).status, 'ok');
  assert.deepEqual(f.values.get('sf_cache'), {});
});

test('cache storage failure still preserves successfully fetched results', async () => {
  const f = fixture(() => jsonResponse([script()]), { set: async () => { throw new Error('Quota exhausted'); } });
  const result = await f.service.search('greasyfork', 'youtube.com');
  assert.equal(result.status, 'ok');
  assert.equal(result.items.length, 1);
  assert.ok(result.storageWarning);
});

test('GitHub rate limiting is reported and prevents immediate repeated API traffic', async () => {
  const f = fixture(() => jsonResponse({}, 429));
  const first = await f.service.search('github', 'youtube.com');
  assert.equal(first.status, 'error');
  const second = await f.service.search('github', 'reddit.com');
  assert.equal(second.status, 'error');
  assert.match(second.error, /cooling down/i);
  assert.equal(f.calls.length, 1);
  f.advance(60001);
  await f.service.search('github', 'reddit.com', { force: true });
  assert.equal(f.calls.length, 2);
});
