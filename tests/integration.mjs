import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Miniflare, Log, LogLevel } from 'miniflare';

// Execute the actual production bundle in workerd. All database state is local,
// ephemeral test data; no Cloudflare API calls or live event requests are made.
const root = process.cwd();
const build = path.join(root, 'dist/server');
const config = JSON.parse(await fs.readFile(path.join(build, 'wrangler.json'), 'utf8'));
const files = await fs.readdir(build, { recursive: true });
const modules = ['index.js', ...files.filter(f => f.endsWith('.js') && f !== 'index.js')]
  .map(file => ({ type: 'ESModule', path: path.join(build, file) }));
const pin = String(randomInt(100000, 999999));
const newPin = String(Number(pin) + 1);
const origin = 'https://local-dj-test.invalid';
const assetsRoot = path.join(root, 'dist/client');
let catalogOffline = false;
let lastCatalogQuery = '';
const options = {
  modules, modulesRoot: build,
  compatibilityDate: config.compatibility_date,
  compatibilityFlags: config.compatibility_flags,
  bindings: { INITIAL_ADMIN_PIN: pin },
  d1Databases: ['DB'], d1Persist: false, cachePersist: false,
  cf: false, log: new Log(LogLevel.ERROR),
  serviceBindings: { ASSETS: async request => {
    const file = path.resolve(assetsRoot, '.' + new URL(request.url).pathname);
    if (!file.startsWith(assetsRoot + path.sep)) return new Response('Not found', { status: 404 });
    try {
      const content = await fs.readFile(file);
      const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'application/json';
      return new Response(content, { headers: { 'Content-Type': type } });
    } catch { return new Response('Not found', { status: 404 }); }
  } },
  outboundService: async request => {
    const url = new URL(request.url);
    assert.equal(url.hostname, 'musicbrainz.org', 'Unexpected outbound call in local test');
    lastCatalogQuery = url.searchParams.get('query');
    if (catalogOffline) return new Response('Unavailable', { status: 503 });
    return Response.json({ recordings: Array.from({ length: 40 }, (_, i) => ({
      id: String(i), title: i === 0 ? 'Cuff It' : `Catalog song ${i}`,
      score: 100 - i, 'artist-credit': [{ name: 'Beyoncé' }],
    })) });
  },
};
const mf = new Miniflare(options);
let checks = 0;
const pass = label => { checks++; console.log(`PASS ${label}`); };
async function api(route, { method = 'GET', body, cookie = '', agent = 'migration-test', requestOrigin = origin } = {}) {
  const response = await mf.dispatchFetch(origin + route, {
    method, headers: { 'Content-Type': 'application/json', Origin: requestOrigin, Cookie: cookie, 'User-Agent': agent },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.clone().json().catch(() => null);
  return { response, data, status: response.status };
}
try {
  const db = await mf.getD1Database('DB');
  const migration = await fs.readFile(path.join(root, 'drizzle/0000_sweet_white_queen.sql'), 'utf8');
  for (const sql of migration.replaceAll('--> statement-breakpoint', '').split(';').filter(s => s.trim())) await db.prepare(sql).run();
  assert.equal((await api('/api/admin/data')).status, 401);
  pass('anonymous dashboard access denied');

  const login = await api('/api/admin/session', { method: 'POST', body: { pin } });
  assert.equal(login.status, 200);
  const setCookie = login.response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /Secure/); assert.match(setCookie, /SameSite=Strict/);
  const cookie = setCookie.split(';')[0];
  const admin = await api('/api/admin/data', { cookie });
  assert.equal(admin.status, 200); assert.match(admin.response.headers.get('cache-control'), /no-store/);
  const token = admin.data.settings.guestToken;
  pass('PIN login and protected session work');

  const eventPage = await mf.dispatchFetch(`${origin}/e/${token}`);
  assert.equal(eventPage.status, 200);
  const markup = await eventPage.text();
  assert.match(markup, /DJ Request List/); assert.doesNotMatch(markup, /chatgpt\.site/);
  pass('guest HTML renders at the new origin');

  const settings = { eventName: 'Migration test event', requestLimit: 2, closingTime: '' };
  assert.equal((await api('/api/admin/settings', { cookie, method: 'PATCH', body: settings })).status, 200);
  assert.equal((await api('/api/admin/settings', { method: 'PATCH', body: settings })).status, 401);
  assert.equal((await api('/api/admin/settings', { cookie, method: 'PATCH', body: settings, requestOrigin: 'https://untrusted.invalid' })).status, 403);
  pass('event settings save; unauthorized and cross-origin edits rejected');

  assert.equal((await api('/api/guest/not-the-event')).status, 404);
  const guest = await api(`/api/guest/${token}`);
  assert.equal(guest.data.eventName, settings.eventName);
  assert.equal(guest.data.requestLimit, 2);
  assert.equal(guest.data.guestToken, undefined);
  const guestCookie = guest.response.headers.get('set-cookie').split(';')[0];
  const song = { song: 'Migration Song', artist: 'Test Artist' };
  assert.equal((await api(`/api/guest/${token}`, { cookie: guestCookie, method: 'POST', body: null })).status, 400);
  assert.equal((await api(`/api/guest/${token}`, { cookie: guestCookie, method: 'POST', body: { ...song, website: 'spam' } })).status, 400);
  const sent = await api(`/api/guest/${token}`, { cookie: guestCookie, method: 'POST', body: song });
  assert.equal(sent.status, 201); assert.equal(sent.data.requestCount, 1);
  pass('private guest link, optional fields, validation and submission confirmation');

  assert.equal((await api(`/api/guest/${token}`, { cookie: guestCookie, method: 'POST', body: { song: 'Too Soon', artist: 'Test Artist' } })).status, 429);
  await db.prepare("UPDATE song_requests SET created_at = ?").bind(new Date(Date.now() - 20_000).toISOString()).run();
  assert.equal((await api(`/api/guest/${token}`, { cookie: guestCookie, method: 'POST', body: song })).status, 409);
  assert.equal((await api(`/api/guest/${token}`, { method: 'POST', body: song })).status, 409);
  const second = await api(`/api/guest/${token}`, { cookie: guestCookie, method: 'POST', body: { song: 'Second Song', artist: 'Test Artist', note: 'Optional reason' } });
  assert.equal(second.status, 201);
  assert.equal((await api(`/api/guest/${token}`, { cookie: guestCookie, method: 'POST', body: { song: 'Third Song', artist: 'Test Artist' } })).status, 429);
  pass('cooldown, duplicate protection and per-device limit');

  const id = sent.data.requestId;
  assert.equal((await api(`/api/admin/requests/${id}`, { method: 'PATCH' })).status, 401);
  assert.equal((await api(`/api/admin/requests/${id}`, { cookie, method: 'PATCH' })).status, 200);
  let queue = (await api('/api/admin/data', { cookie })).data.requests;
  assert.equal(queue.length, 2); assert.equal(queue.find(r => r.id === id).status, 'Played');
  assert.equal((await api(`/api/admin/requests/${id}`, { cookie, method: 'DELETE' })).status, 200);
  queue = (await api('/api/admin/data', { cookie })).data.requests;
  assert.equal(queue.length, 1); assert.ok(!queue.some(r => r.id === id));
  pass('fresh queue data, Played preserves request, Clear removes it');

  assert.equal((await api('/api/admin/settings', { cookie, method: 'PATCH', body: { ...settings, closingTime: new Date(Date.now() - 60_000).toISOString() } })).status, 200);
  assert.equal((await api(`/api/guest/${token}`)).data.isOpen, false);
  assert.equal((await api(`/api/guest/${token}`, { method: 'POST', body: song })).status, 423);
  pass('closing time stops new requests');

  assert.equal((await api('/api/admin/pin', { cookie, method: 'POST', body: { currentPin: pin, newPin } })).status, 200);
  assert.equal((await api('/api/admin/data', { cookie })).status, 401);
  assert.equal((await api('/api/admin/session', { method: 'POST', body: { pin } })).status, 401);
  assert.equal((await api('/api/admin/session', { method: 'POST', body: { pin: newPin } })).status, 200);
  for (let i = 0; i < 5; i++) assert.equal((await api('/api/admin/session', { method: 'POST', body: { pin: '0000' }, agent: 'rate-limit-test' })).status, 401);
  assert.equal((await api('/api/admin/session', { method: 'POST', body: { pin: newPin }, agent: 'rate-limit-test' })).status, 429);
  pass('PIN rotation invalidates old sessions; login rate limiting');

  const catalog = await api('/api/catalog?q=Beyonce');
  assert.equal(catalog.status, 200); assert.equal(catalog.data.suggestions.length, 30);
  assert.match(lastCatalogQuery, /artistname:/); assert.match(lastCatalogQuery, /recording:/);
  assert.equal((await api('/api/catalog?q=Cuff%20It')).data.suggestions[0].title, 'Cuff It');
  catalogOffline = true;
  assert.equal((await api('/api/catalog?q=offline')).status, 503);
  pass('title/artist catalog query, 30 results and provider failure handling (mock provider)');

  const manifest = JSON.parse(await fs.readFile(path.join(assetsRoot, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) await fs.access(path.join(assetsRoot, icon.src));
  await fs.access(path.join(assetsRoot, 'sw.js')); await fs.access(path.join(assetsRoot, 'offline.html'));
  const guestSource = await fs.readFile(path.join(root, 'app/e/[token]/GuestRequestApp.tsx'), 'utf8');
  const adminSource = await fs.readFile(path.join(root, 'app/admin/page.tsx'), 'utf8');
  assert.match(guestSource, /beforeinstallprompt/); assert.match(adminSource, /clearConfirmId !== request.id/);
  pass('PWA assets and existing install/double-tap controls retained (source checks)');
  console.log(`All ${checks} local integration groups passed. No hosted resources changed.`);
} finally { await mf.dispose(); }
