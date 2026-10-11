'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
require('../shared/suffix-rules.js');
require('../shared/core.js');
const code = fs.readFileSync(path.join(__dirname, '../userscript/entry.js'), 'utf8');
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.events = new Map(); this.attrs = {}; this.isConnected = true; }
  append(...nodes) { this.children.push(...nodes); }
  attachShadow() { this.shadow = new Element('shadow'); return this.shadow; }
  addEventListener(name, fn) { this.events.set(name, fn); }
  setAttribute(name, value) { this.attrs[name] = value; }
  querySelector() { return null; }
  focus() {}
}
function harness({ mode = 'legacy', isPrivate = false, href = 'https://www.youtube.com/watch?v=private', frame = false, apiFailure = false } = {}) {
  const requests = [], searches = [], timers = new Map();
  let captured, mounted, aborts = 0;
  const win = { open() {} }; win.self = win; win.top = frame ? {} : win;
  const doc = { contentType: 'text/html', documentElement: new Element('html'), activeElement: new Element('body'), createElement: tag => new Element(tag) };
  const base = { window: win, location: { href }, document: doc, console, URL, Promise,
    requestAnimationFrame: fn => fn(),
    setTimeout(fn, delay) { const id = Symbol(); timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    SF_STYLE: '',
    SFUI: { mount(root, options) { mounted = options; return {}; } },
    SFCore: { ...globalThis.SFCore, createService(options) {
      captured = options;
      return { settings: async () => ({ ...globalThis.SFCore.DEFAULTS, automatic: !isPrivate }), saveSettings: async data => data, clearCache: async () => {},
        search: async (id, host) => { searches.push({ id, host }); return { id, host, status: 'ok', items: [], hasMore: false }; } };
    } }
  };
  function xhr(details) {
    if (apiFailure) throw new Error('API unavailable');
    requests.push(details);
    return { abort() { aborts++; details.onabort(); } };
  }
  if (mode === 'legacy') Object.assign(base, { GM_xmlhttpRequest: xhr, GM_getValue: (key, fallback) => fallback, GM_setValue() {}, GM_info: { isIncognito: isPrivate } });
  else {
    base.GM = { info: { isIncognito: isPrivate }, marker: true,
      xmlHttpRequest(details) { assert.equal(this.marker, true); return xhr(details); },
      getValue(key, fallback) { assert.equal(this.marker, true); return Promise.resolve(fallback); },
      setValue() { assert.equal(this.marker, true); return Promise.resolve(); } };
  }
  vm.runInNewContext(code, base, { filename: 'userscript/entry.js' });
  return { get captured() { return captured; }, get mounted() { return mounted; }, get aborts() { return aborts; }, requests, searches, timers, doc };
}

test('userscript supports legacy GM functions and modern bound aliases', async () => {
  for (const mode of ['legacy', 'modern']) {
    const h = harness({ mode });
    assert.ok(h.captured);
    assert.equal(await h.captured.get('missing', 42), 42);
    await h.captured.set('setting', true);
    const pending = h.captured.request('https://api.greasyfork.org/en/scripts.json?site=youtube.com');
    const req = h.requests[0];
    assert.equal(req.anonymous, true);
    assert.equal(req.method, 'GET');
    assert.ok(req.timeout > 0 && req.timeout <= 30000);
    req.onload({ status: 200, responseText: '[]', responseHeaders: 'X-RateLimit-Reset: 123\r\nContent-Type: application/json' });
    const result = await pending;
    assert.equal(result.status, 200);
    assert.equal(result.text, '[]');
    assert.equal(result.headers['x-ratelimit-reset'], '123');
    assert.equal(h.timers.size, 0);
  }
});

test('userscript fallback timeout aborts a stalled request and rejects only once', async () => {
  const h = harness();
  const pending = h.captured.request('https://api.greasyfork.org/en/scripts.json');
  const failed = assert.rejects(pending, /timed out/i);
  assert.equal(h.timers.size, 1);
  for (const timer of [...h.timers.values()]) { assert.ok(timer.delay <= 30000); timer.fn(); }
  await failed;
  assert.equal(h.aborts, 1);
  assert.equal(h.timers.size, 0);
  h.requests[0].onload({ status: 200, responseText: '[]' });
});

test('userscript reports synchronous GM failures and network failures', async () => {
  const sync = harness({ apiFailure: true });
  await assert.rejects(sync.captured.request('https://api.greasyfork.org/en/scripts.json'), /API unavailable/);
  assert.equal(sync.timers.size, 0);
  const network = harness();
  const pending = network.captured.request('https://api.greasyfork.org/en/scripts.json');
  network.requests[0].onerror();
  await assert.rejects(pending, /network request failed/i);
  assert.equal(network.timers.size, 0);
});

test('private userscript disables startup lookup and uses private cache mode', async () => {
  const h = harness({ isPrivate: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.captured.privateMode, true);
  assert.equal(h.searches.length, 0);
  const container = h.doc.documentElement.children[0];
  const launcher = container.shadow.children.find(node => node.tag === 'button');
  launcher.events.get('click')();
  assert.equal((await h.mounted.service.settings()).automatic, false);
});

test('userscript does not initialize on frames or non-public/special pages', () => {
  for (const options of [{ frame: true }, { href: 'http://127.0.0.1/' }, { href: 'https://router.lan/' }, { href: 'file:///tmp/page.html' }, { href: 'about:config' }]) {
    const h = harness(options);
    assert.equal(h.captured, undefined);
    assert.equal(h.doc.documentElement.children.length, 0);
  }
});
