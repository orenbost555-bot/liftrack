import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { encryptPayload, vapidHeader, localParts, dueEntries, handleFetch, handleScheduled } from './worker.js';

const enc = new TextEncoder(), dec = new TextDecoder();
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const concat = (...a) => Buffer.concat(a.map((x) => Buffer.from(x)));
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}

// צד המקבל (הדפדפן) לפי RFC 8291, לבדיקת הצפנה אמיתית הלוך-חזור
async function decrypt(body, uaKeys, authSecret) {
  const salt = body.slice(0, 16), idlen = body[20], asPublic = body.slice(21, 21 + idlen), cipher = body.slice(21 + idlen);
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', uaKeys.publicKey));
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, uaKeys.privateKey, 256));
  const prk = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, prk, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, prk, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, cipher));
  assert.equal(plain.at(-1), 2);
  return dec.decode(plain.slice(0, -1));
}

async function newSub() {
  const keys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const p256dh = b64u(await crypto.subtle.exportKey('raw', keys.publicKey));
  return { keys, auth, sub: { endpoint: 'https://push.example.com/abc', keys: { p256dh, auth: b64u(auth) } } };
}

async function vapid() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return { kp, env: { VAPID_PUBLIC_KEY: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey('jwk', kp.privateKey)), VAPID_SUBJECT: 'mailto:a@b.c' } };
}

const kv = () => { const m = new Map(); return { m, get: async (k, t) => (m.has(k) ? (t === 'json' ? JSON.parse(m.get(k)) : m.get(k)) : null), put: async (k, v) => void m.set(k, v), delete: async (k) => void m.delete(k), list: async () => ({ keys: [...m.keys()].map((name) => ({ name })), list_complete: true }) }; };

test('הצפנה: המקבל מפענח בדיוק את מה שנשלח', async () => {
  const { keys, auth, sub } = await newSub();
  const body = await encryptPayload('{"title":"שלום","body":"בוא נתאמן!"}', sub.keys.p256dh, sub.keys.auth);
  assert.equal(await decrypt(body, keys, auth), '{"title":"שלום","body":"בוא נתאמן!"}');
});

test('VAPID: החתימה תקפה והכותרת מכילה את המפתח הציבורי', async () => {
  const { kp, env } = await vapid();
  const h = await vapidHeader('https://push.example.com/x', env, 1_700_000_000_000);
  const [, t, k] = /^vapid t=(.+), k=(.+)$/.exec(h);
  assert.equal(k, env.VAPID_PUBLIC_KEY);
  const [head, claims, sig] = t.split('.');
  assert.equal(JSON.parse(Buffer.from(claims, 'base64url')).aud, 'https://push.example.com');
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, Buffer.from(sig, 'base64url'), enc.encode(`${head}.${claims}`)));
});

test('זמן מקומי לפי אזור זמן', () => {
  const t = Date.UTC(2026, 9, 21, 15, 30); // רביעי 21.10.2026 15:30 UTC = 18:30 בישראל (UTC+3)
  assert.deepEqual(localParts(t, 'Asia/Jerusalem'), { date: '2026-10-21', minutes: 18 * 60 + 30, day: 3 });
  assert.equal(localParts(t, 'Nope/Zone').minutes, 15 * 60 + 30);
});

test('dueEntries: בחלון, מחוץ לחלון, כבר נשלח, אימון בוצע היום', () => {
  const now = Date.UTC(2026, 9, 21, 15, 33); // 18:33 ישראל, רביעי
  const rec = { tz: 'Asia/Jerusalem', schedule: [{ day: 3, time: '18:30', title: 'a', body: 'b' }, { day: 3, time: '18:00', title: 'x', body: 'y' }, { day: 2, time: '18:30', title: 'z', body: 'z' }] };
  assert.equal(dueEntries(rec, now).due.length, 1);
  assert.equal(dueEntries({ ...rec, sent: ['2026-10-21@18:30'] }, now).due.length, 0);
  assert.equal(dueEntries({ ...rec, doneOn: '2026-10-21' }, now).due.length, 0);
  assert.equal(dueEntries(rec, now + 20 * 60000).due.length, 0);
});

test('dueEntries: תזכורת ערב-לפני נשלחת גם אם התאמנת היום', () => {
  const now = Date.UTC(2026, 9, 21, 17, 2); // 20:02 ישראל, רביעי
  const rec = { tz: 'Asia/Jerusalem', doneOn: '2026-10-21', schedule: [{ day: 3, time: '20:00', kind: 'eve', title: 'a', body: 'b' }, { day: 3, time: '20:00', title: 'x', body: 'y' }] };
  assert.deepEqual(dueEntries(rec, now).due.map((e) => e.kind), ['eve']);
});

test('זרימה מלאה: סנכרון, cron שולח פעם אחת, ו-410 מוחק', async () => {
  const { keys, auth, sub } = await newSub();
  const { env } = await vapid();
  env.SUBS = kv();
  const syncAt = Date.UTC(2026, 9, 21, 14, 0); // 17:00 ישראל
  const post = (path, body, now) => handleFetch(new Request('https://w.dev' + path, { method: 'POST', body: JSON.stringify(body) }), env, now);
  const body = { subscription: sub, tz: 'Asia/Jerusalem', doneOn: null, schedule: [{ day: 3, time: '18:30', title: 'יום A', body: 'זמן לאימון!' }] };
  assert.equal((await post('/sync', body, syncAt)).status, 200);
  assert.equal((await post('/sync', { ...body, schedule: [{ day: 9, time: 'x' }] }, syncAt)).status, 400);

  const sent = [];
  const realFetch = globalThis.fetch;
  let status = 201;
  globalThis.fetch = async (url, init) => { sent.push({ url, init }); return new Response(null, { status }); };
  try {
    const t = Date.UTC(2026, 9, 21, 15, 31); // 18:31
    const realNow = Date.now; Date.now = () => t;
    try { await handleScheduled(env, t); await handleScheduled(env, t + 5 * 60000); } finally { Date.now = realNow; }
    assert.equal(sent.length, 1, 'נשלח פעם אחת בלבד');
    assert.match(sent[0].init.headers.Authorization, /^vapid t=/);
    const msg = JSON.parse(await decrypt(new Uint8Array(sent[0].init.body), keys, auth));
    assert.equal(msg.title, 'יום A');

    // מנוי שפג תוקפו נמחק
    status = 410;
    const next = Date.UTC(2026, 9, 28, 16, 31); // שבוע אחרי (אחרי מעבר לשעון חורף)
await handleScheduled(env, next);
assert.equal(env.SUBS.m.size, 0);
  } finally { globalThis.fetch = realFetch; }
});

test('סנכרון בתוך חלון לא שולח התראה מיידית', async () => {
  const { sub } = await newSub();
  const { env } = await vapid(); env.SUBS = kv();
  const now = Date.UTC(2026, 9, 21, 15, 33); // 18:33
  await handleFetch(new Request('https://w.dev/sync', { method: 'POST', body: JSON.stringify({ subscription: sub, tz: 'Asia/Jerusalem', schedule: [{ day: 3, time: '18:30', title: 'a', body: 'b' }] }) }), env, now);
  const rec = JSON.parse([...env.SUBS.m.values()][0]);
  assert.equal(dueEntries(rec, now).due.length, 0);
});

test('unsubscribe מוחק, ו-GET מחזיר סטטוס', async () => {
  const { sub } = await newSub();
  const { env } = await vapid(); env.SUBS = kv();
  const mk = (p, b) => handleFetch(new Request('https://w.dev' + p, { method: 'POST', body: JSON.stringify(b) }), env);
  await mk('/sync', { subscription: sub, tz: 'UTC', schedule: [] });
  assert.equal(env.SUBS.m.size, 1);
  await mk('/unsubscribe', { subscription: sub });
  assert.equal(env.SUBS.m.size, 0);
  assert.equal((await handleFetch(new Request('https://w.dev/'), env)).status, 200);
  assert.equal(typeof worker.fetch, 'function');
});

test('dueEntries: תזכורת lead מדולגת אם התאמנת היום, ולא נשלחת פעמיים', () => {
  const now = Date.UTC(2026, 9, 21, 13, 31); // 16:31 ישראל, רביעי
  const rec = { tz: 'Asia/Jerusalem', schedule: [{ day: 3, time: '16:30', kind: 'lead', title: 'a', body: 'b' }] };
  assert.equal(dueEntries(rec, now).due.length, 1);
  assert.equal(dueEntries({ ...rec, doneOn: '2026-10-21' }, now).due.length, 0);
  assert.equal(dueEntries({ ...rec, sent: ['2026-10-21@16:30'] }, now).due.length, 0);
});

test('nudge: נקבע, נשלח פעם אחת בזמנו, ו-/sync לא מוחק אותו', async () => {
  const { sub } = await newSub();
  const { env } = await vapid(); env.SUBS = kv();
  const mk = (p, b, now) => handleFetch(new Request('https://w.dev' + p, { method: 'POST', body: JSON.stringify(b) }), env, now);
  const now = Date.UTC(2026, 9, 24, 15, 0);
  assert.equal((await mk('/nudge', { subscription: sub, at: now + 600000 }, now)).status, 404); // אין מנוי עדיין
  await mk('/sync', { subscription: sub, tz: 'Asia/Jerusalem', schedule: [] }, now);
  assert.equal((await mk('/nudge', { subscription: sub, at: now + 600000, title: 'גב', body: 'חזור' }, now)).status, 200);
  await mk('/sync', { subscription: sub, tz: 'Asia/Jerusalem', schedule: [] }, now); // לא מוחק
  const rec = () => JSON.parse([...env.SUBS.m.values()][0]);
  assert.equal(rec().nudge.title, 'גב');
  assert.equal((await mk('/nudge', { subscription: sub, at: 'x' }, now)).status, 400);

  const realFetch = globalThis.fetch; const sent = [];
  globalThis.fetch = async (url, init) => { sent.push(url); return new Response(null, { status: 201 }); };
  try {
    await handleScheduled(env, now + 300000); // עוד לא הגיע הזמן
    assert.equal(sent.length, 0);
    await handleScheduled(env, now + 610000); // הגיע
    assert.equal(sent.length, 1);
    assert.equal(rec().nudge, undefined);
    await handleScheduled(env, now + 910000); // לא נשלח שוב
    assert.equal(sent.length, 1);
    // ביטול
    await mk('/nudge', { subscription: sub, at: now + 2000000 }, now);
    await mk('/nudge', { subscription: sub, at: null }, now);
    assert.equal(rec().nudge, undefined);
    // התראה ישנה מאוד (מעל 3 שעות) לא נשלחת אלא נמחקת
    await mk('/nudge', { subscription: sub, at: now + 60000 }, now);
    await handleScheduled(env, now + 4 * 3600000);
    assert.equal(sent.length, 1);
    assert.equal(rec().nudge, undefined);
  } finally { globalThis.fetch = realFetch; }
});
