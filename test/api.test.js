// API entegrasyon testleri: gerçek bir sunucuyu bellek içi veritabanıyla başlatıp
// HTTP istekleriyle uçtan uca dener.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createApp } from '../server/app.js';

let server;
let base;
let cookie = '';

before(async () => {
  const passwordHash = await bcrypt.hash('dogru-sifre', 4); // testte hızlı olsun diye düşük maliyet
  const { app } = createApp({ dbPath: ':memory:', username: 'mert', passwordHash });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

/** Küçük yardımcı: JSON istek at, cookie'yi taşı. */
async function req(method, path, body, { withCookie = true, ip } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (withCookie && cookie) headers.Cookie = cookie;
  if (ip) headers['X-Forwarded-For'] = ip;
  const res = await fetch(base + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, headers: res.headers };
}

test('giriş yapmadan API ve sayfalar kapalı', async () => {
  assert.equal((await req('GET', '/api/data')).status, 401);
  assert.equal((await req('GET', '/api/backup')).status, 401);
  const page = await req('GET', '/');
  assert.equal(page.status, 302);
  assert.equal(page.headers.get('location'), '/login');
  assert.equal((await req('GET', '/assets/x.js')).status, 302);
  assert.equal((await req('GET', '/login')).status, 200);
});

test('yanlış şifre 401, 5 yanlış denemeden sonra 429 (bekletme)', async () => {
  const ip = '10.0.0.99';
  for (let i = 0; i < 5; i++) {
    const r = await req('POST', '/api/login', { username: 'mert', password: 'yanlis' }, { ip });
    assert.equal(r.status, 401);
  }
  const locked = await req('POST', '/api/login', { username: 'mert', password: 'dogru-sifre' }, { ip });
  assert.equal(locked.status, 429, 'kilitliyken doğru şifre bile kabul edilmemeli');
  // Başka IP etkilenmez
  const other = await req('POST', '/api/login', { username: 'yanlis-kullanici', password: 'dogru-sifre' }, { ip: '10.0.0.5' });
  assert.equal(other.status, 401);
});

test('doğru giriş: HTTP-only cookie, beni hatırla', async () => {
  const r = await req('POST', '/api/login', { username: 'mert', password: 'dogru-sifre', remember: true }, { ip: '10.0.0.1' });
  assert.equal(r.status, 200);
  const setCookie = r.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Max-Age=2592000/); // 30 gün
  cookie = setCookie.split(';')[0];
  assert.deepEqual((await req('GET', '/api/me')).json, { loggedIn: true });
});

test('ders + çalışma -> sınava göre kısaltılmış otomatik tekrarlar', async () => {
  const c = await req('POST', '/api/courses', { name: 'Matematik', color: '#60a5fa', examDate: '2026-11-18' });
  assert.equal(c.status, 201);
  const s = await req('POST', '/api/studies', { courseId: c.json.id, topic: 'Matrisler', date: '2026-11-08' });
  assert.equal(s.status, 201);
  assert.deepEqual(s.json.reviewDates, ['2026-11-09', '2026-11-11', '2026-11-17']);

  const { json } = await req('GET', '/api/data');
  const titles = json.tasks.map((t) => `${t.date} ${t.courseName} – ${t.topicName} (${t.kind} ${t.seq})`);
  assert.deepEqual(titles, [
    '2026-11-08 Matematik – Matrisler (study 0)',
    '2026-11-09 Matematik – Matrisler (review 1)',
    '2026-11-11 Matematik – Matrisler (review 2)',
    '2026-11-17 Matematik – Matrisler (review 3)',
  ]);
});

test('doğrulama hataları anlaşılır mesaj döner', async () => {
  const r = await req('POST', '/api/courses', { name: '', color: '#60a5fa' });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /Ders adı/);
  const r2 = await req('POST', '/api/studies', { courseId: 999, topic: 'x', date: '2026-11-08' });
  assert.equal(r2.status, 400);
  const r3 = await req('PUT', '/api/settings', { intervals: [0] });
  assert.equal(r3.status, 400);
});

test('tekrarı taşı: sadece bunu / sonrakileri de kaydır', async () => {
  let { json } = await req('GET', '/api/data');
  const [, r1] = json.tasks;

  // Sadece bunu: 1. tekrarı 1 gün ileri
  await req('PATCH', `/api/tasks/${r1.id}`, { date: '2026-11-10', shiftFollowing: false });
  ({ json } = await req('GET', '/api/data'));
  assert.deepEqual(json.tasks.map((t) => t.date), ['2026-11-08', '2026-11-10', '2026-11-11', '2026-11-17']);

  // Sonrakileri de: 1. tekrarı 1 gün daha ileri -> diğerleri de +1
  await req('PATCH', `/api/tasks/${r1.id}`, { date: '2026-11-11', shiftFollowing: true });
  ({ json } = await req('GET', '/api/data'));
  assert.deepEqual(json.tasks.map((t) => t.date), ['2026-11-08', '2026-11-11', '2026-11-12', '2026-11-18']);
});

test('tamamla, elle tekrar ekle (numaralar tarihe göre), sil', async () => {
  let { json } = await req('GET', '/api/data');
  const topicId = json.tasks[0].topicId;
  const r1 = json.tasks[1];
  await req('PATCH', `/api/tasks/${r1.id}`, { done: true });

  // 2026-11-09'a elle tekrar -> artık 1. tekrar o olmalı
  assert.equal((await req('POST', '/api/tasks', { topicId, date: '2026-11-09' })).status, 201);
  ({ json } = await req('GET', '/api/data'));
  const reviews = json.tasks.filter((t) => t.kind === 'review');
  assert.deepEqual(reviews.map((t) => [t.date, t.seq, t.done]), [
    ['2026-11-09', 1, false],
    ['2026-11-11', 2, true],
    ['2026-11-12', 3, false],
    ['2026-11-18', 4, false],
  ]);

  // Bir tekrarı sil -> yeniden numaralanır
  await req('DELETE', `/api/tasks/${reviews[0].id}`);
  ({ json } = await req('GET', '/api/data'));
  assert.deepEqual(json.tasks.filter((t) => t.kind === 'review').map((t) => t.seq), [1, 2, 3]);
});

test('konuyu düzenle ve ayarlar', async () => {
  let { json } = await req('GET', '/api/data');
  const t = json.tasks[0];
  await req('PUT', `/api/topics/${t.topicId}`, { name: 'Matrisler ve Determinant', courseId: t.courseId });
  const s = await req('PUT', '/api/settings', { intervals: [21, 2, 9] });
  assert.deepEqual(s.json.intervals, [2, 9, 21]);
  ({ json } = await req('GET', '/api/data'));
  assert.equal(json.tasks[0].topicName, 'Matrisler ve Determinant');
  assert.deepEqual(json.settings.intervals, [2, 9, 21]);
});

test('yedek al -> sil -> geri yükle', async () => {
  const backup = await req('GET', '/api/backup');
  assert.equal(backup.status, 200);
  assert.match(backup.headers.get('content-disposition'), /attachment/);
  const before = (await req('GET', '/api/data')).json;

  // Dersi sil -> konu ve görevler de gider
  await req('DELETE', `/api/courses/${before.courses[0].id}`);
  assert.equal((await req('GET', '/api/data')).json.tasks.length, 0);

  assert.equal((await req('POST', '/api/restore', backup.json)).status, 200);
  assert.deepEqual((await req('GET', '/api/data')).json, before);

  assert.equal((await req('POST', '/api/restore', { foo: 1 })).status, 400);
});

test('çıkış yapınca oturum geçersiz', async () => {
  await req('POST', '/api/logout');
  assert.equal((await req('GET', '/api/data')).status, 401);
});
