// LIFTRACK reminders: Cloudflare Worker אחד שמקבל מהאפליקציה "ימים + שעות" ושולח Web Push בזמן.
// לא נשמרים כאן אימונים, משקלים או שם. רק: כתובת ההתראה של המכשיר, אזור זמן, ורשימת (יום, שעה, כותרת, טקסט).
// Bindings נדרשים: KV בשם SUBS; משתנים: VAPID_PUBLIC_KEY, VAPID_PRIVATE_JWK (Secret), VAPID_SUBJECT (mailto:...).
// Cron: */5 * * * *

const enc = new TextEncoder();
const b64u = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0)),
};
const concat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };

const NUDGE_MAX_AGE = 3 * 60 * 60 * 1000; // התראת "חזור לאימון" שהתעכבה יותר מ-3 שעות כבר לא רלוונטית
const WINDOW_MIN = 10; // תזכורת נשלחת עד 10 דקות אחרי השעה (הגנה מפני ריצת cron שפוספסה)

// ---------- הצפנת Web Push (RFC 8291, aes128gcm) ----------
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

export async function encryptPayload(payload, p256dhB64, authB64, { ephemeral, salt } = {}) {
  const uaPublic = b64u.dec(p256dhB64);
  const authSecret = b64u.dec(authB64);
  const asKeys = ephemeral ?? (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']));
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));
  const prk = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(s, prk, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(s, prk, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plain = concat(enc.encode(payload), new Uint8Array([2]));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, plain));
  const rs = new Uint8Array([0, 0, 0x10, 0]); // 4096
  return concat(s, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

// ---------- VAPID (RFC 8292) ----------
export async function vapidHeader(endpoint, env, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const head = b64u.enc(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u.enc(enc.encode(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || 'mailto:admin@example.com' })));
  const jwk = typeof env.VAPID_PRIVATE_JWK === 'string' ? JSON.parse(env.VAPID_PRIVATE_JWK) : env.VAPID_PRIVATE_JWK;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${b64u.enc(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}

async function sendPush(sub, payload, env) {
  const body = await encryptPayload(JSON.stringify(payload), sub.keys.p256dh, sub.keys.auth);
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: { Authorization: await vapidHeader(sub.endpoint, env), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '3600', Urgency: 'normal' },
    body,
  });
}

// ---------- זמן מקומי של המשתמש ----------
export function localParts(now, tz) {
  let f;
  try { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }); }
  catch { f = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }); }
  const p = Object.fromEntries(f.formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute), day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}

const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

/** אילו תזכורות מגיע זמנן עכשיו (ולא נשלחו כבר, ולא אחרי אימון שבוצע היום). */
export function dueEntries(rec, now) {
  const L = localParts(now, rec.tz);
  const trainedToday = rec.doneOn === L.date; // תזכורת היום מדלגת אם כבר התאמנת; תזכורת "ערב לפני" (kind: 'eve') נשלחת תמיד
  const due = (rec.schedule ?? []).filter((e) => {
    if (trainedToday && e.kind !== 'eve') return false;
    const m = toMin(e.time);
    return m !== null && e.day === L.day && L.minutes >= m && L.minutes - m < WINDOW_MIN && !(rec.sent ?? []).includes(`${L.date}@${e.time}`);
  });
  return { due, L };
}

const keyFor = async (endpoint) => b64u.enc(await crypto.subtle.digest('SHA-256', enc.encode(endpoint)));

function validSchedule(s) {
  return Array.isArray(s) && s.length <= 14 && s.every((e) => Number.isInteger(e.day) && e.day >= 0 && e.day <= 6 && toMin(e.time) !== null && typeof e.title === 'string' && typeof e.body === 'string' && (e.kind === undefined || e.kind === 'eve' || e.kind === 'lead'));
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

async function handleFetch(request, env, now = Date.now()) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const url = new URL(request.url);
  if (request.method !== 'POST') return json({ ok: true, service: 'liftrack-reminders' });
  let body;
  try { body = await request.json(); } catch { return json({ error: 'json' }, 400); }
  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth || !/^https:\/\//.test(sub.endpoint)) return json({ error: 'subscription' }, 400);
  const key = await keyFor(sub.endpoint);

  if (url.pathname === '/unsubscribe') { await env.SUBS.delete(key); return json({ ok: true }); }
  if (url.pathname === '/sync' || url.pathname === '/subscribe') {
    if (!validSchedule(body.schedule)) return json({ error: 'schedule' }, 400);
    const rec = { sub: { endpoint: sub.endpoint, keys: sub.keys }, tz: String(body.tz || 'UTC'), schedule: body.schedule, doneOn: body.doneOn ?? null, sent: [] };
    // תזכורת שכבר "בחלון" ברגע הסנכרון לא נשלחת (נמנע מהתראה מיידית אחרי עריכת שעה)
    const { due, L } = dueEntries({ ...rec, doneOn: null }, now);
    rec.sent = due.map((e) => `${L.date}@${e.time}`);
    const prev = await env.SUBS.get(key, 'json');
    if (prev?.sent) rec.sent = [...new Set([...prev.sent, ...rec.sent])].slice(-20);
    if (prev?.nudge) rec.nudge = prev.nudge; // סנכרון תזכורות לא מוחק התראת "חזור לאימון" שממתינה
    await env.SUBS.put(key, JSON.stringify(rec));
    return json({ ok: true });
  }
  if (url.pathname === '/nudge') { // "חזור לאימון": מתי לשלוח אם לא הוזן סט (at = זמן במילישניות), או at: null לביטול
    const rec = await env.SUBS.get(key, 'json');
    if (!rec) return json({ ok: false, error: 'no_subscription' }, 404);
    if (body.at === null || body.at === undefined) delete rec.nudge;
    else if (Number.isFinite(body.at) && body.at > now - NUDGE_MAX_AGE && body.at < now + 12 * 60 * 60 * 1000) {
      rec.nudge = { at: Math.floor(body.at), title: String(body.title || 'LIFTRACK').slice(0, 60), body: String(body.body || '').slice(0, 140) };
    } else return json({ error: 'at' }, 400);
    await env.SUBS.put(key, JSON.stringify(rec));
    return json({ ok: true });
  }
  if (url.pathname === '/test') { // התראת בדיקה מיידית
    const r = await sendPush(sub, { title: body.title || 'LIFTRACK', body: body.body || 'OK' }, env);
    return json({ ok: r.ok, status: r.status });
  }
  return json({ error: 'not_found' }, 404);
}

async function handleScheduled(env, now = Date.now()) {
  let cursor;
  do {
    const page = await env.SUBS.list({ cursor });
    for (const { name } of page.keys) {
      const rec = await env.SUBS.get(name, 'json');
      if (!rec) continue;
      const { due, L } = dueEntries(rec, now);
      let changed = false;
      if (due.length) {
        const e = due[0];
        let res;
        try { res = await sendPush(rec.sub, { title: e.title, body: e.body, tag: `liftrack-${L.date}` }, env); } catch { res = null; }
        if (res && (res.status === 404 || res.status === 410)) { await env.SUBS.delete(name); continue; }
        if (res) { rec.sent = [...(rec.sent ?? []), ...due.map((d) => `${L.date}@${d.time}`)].slice(-20); changed = true; }
      }
      // "חזור לאימון": הגיע הזמן ואין פעילות. נשלחת פעם אחת, ואז נמחקת (סט חדש באפליקציה יקבע זמן חדש)
      if (rec.nudge && now >= rec.nudge.at) {
        const n = rec.nudge;
        if (now - n.at < NUDGE_MAX_AGE) {
          let res;
          try { res = await sendPush(rec.sub, { title: n.title, body: n.body, tag: 'liftrack-nudge', url: './#/workout' }, env); } catch { res = null; }
          if (res && (res.status === 404 || res.status === 410)) { await env.SUBS.delete(name); continue; }
          if (!res) continue; // נסיון חוזר בריצה הבאה
        }
        delete rec.nudge;
        changed = true;
      }
      if (changed) await env.SUBS.put(name, JSON.stringify(rec));
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
}

export default {
  fetch: (request, env) => handleFetch(request, env),
  scheduled: (event, env, ctx) => ctx.waitUntil(handleScheduled(env)),
};
export { handleFetch, handleScheduled };
