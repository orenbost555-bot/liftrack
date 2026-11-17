// תזכורות לאימון: Web Push דרך Worker קטן ב-Cloudflare (ראה liftrack-reminders/).
// לשרת נשלחים רק: כתובת ההתראה של המכשיר, אזור זמן, ורשימת (יום, שעה, שם תבנית, טקסט). לא אימונים ולא משקלים.
import { REMINDERS } from './config.js';
import { getTemplates, getWorkouts, getSettings, saveSettings, subscribe, getActive } from './store.js';
import { nudgeAt } from './logic/idle-nudge.js';
import { tr } from './i18n.js';
import { buildSchedule, lastDoneDate } from './logic/reminders.js';

export const configured = () => Boolean(REMINDERS.url);

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

const b64ToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const bytesToB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function currentSubscription() {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  // מנוי שנוצר עם מפתח ישן (אחרי החלפת מפתחות בשרת) לא יקבל התראות: מחליפים אותו אוטומטית במנוי חדש
  const key = sub?.options?.applicationServerKey;
  if (sub && key && bytesToB64(key) !== REMINDERS.publicKey && Notification.permission === 'granted') {
    try {
      await sub.unsubscribe();
      return await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(REMINDERS.publicKey) });
    } catch { return null; }
  }
  return sub;
}

async function post(path, body) {
  const r = await fetch(REMINDERS.url.replace(/\/$/, '') + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`reminders ${r.status}`);
  return r.json();
}

/** 'unconfigured' | 'install' (אייפון שלא במסך הבית) | 'unsupported' | 'denied' | 'off' | 'on' */
export async function reminderState() {
  if (!configured()) return 'unconfigured';
  if (isIos() && !standalone()) return 'install';
  if (!('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted' || !getSettings().reminders) return 'off';
  return (await currentSubscription()) ? 'on' : 'off';
}

const SYNCED_KEY = 'liftrack.remsync';

export async function syncReminders(force = false) {
  if (!configured() || !getSettings().reminders) return;
  try {
    const sub = await currentSubscription();
    if (!sub) return;
    const payload = {
      subscription: sub.toJSON(),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      schedule: buildSchedule(getTemplates(), { eve: getSettings().reminderEve !== false, eveTime: getSettings().reminderEveTime || '20:00', lead: getSettings().reminderLead ?? 2 }),
      doneOn: lastDoneDate(getWorkouts()),
    };
    // לא שולחים שוב אם כלום לא השתנה (שמירות באמצע אימון לא נוגעות בלוח הזמנים)
    const fingerprint = JSON.stringify(payload);
    if (!force && localStorage.getItem(SYNCED_KEY) === fingerprint) return;
    await post('/sync', payload);
    localStorage.setItem(SYNCED_KEY, fingerprint);
  } catch { /* אין רשת: ינסה שוב בשינוי הבא או בפתיחה הבאה */ }
}

/** חייב להיקרא מלחיצה של המשתמש (דרישת iOS). מחזיר את המצב החדש. */
export async function enableReminders() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(REMINDERS.publicKey) }));
  saveSettings({ reminders: true });
  await syncReminders(true);
  return sub ? 'on' : 'off';
}

export async function disableReminders() {
  saveSettings({ reminders: false });
  try { localStorage.removeItem(SYNCED_KEY); } catch { /* ממשיכים */ }
  try {
    const sub = await currentSubscription();
    if (sub) { await post('/unsubscribe', { subscription: sub.toJSON() }).catch(() => {}); await sub.unsubscribe(); }
  } catch { /* ממשיכים */ }
}

export async function sendTestReminder(title, body) {
  const sub = await currentSubscription();
  if (!sub) return false;
  try { return (await post('/test', { subscription: sub.toJSON(), title, body })).ok; } catch { return false; }
}

// ---- "חזור לאימון" ----
// בכל פעילות באימון הזמן נדחה, ובסיום או ביטול האימון ההתראה מבוטלת. נשלח רק כשהערך משתנה.
let lastNudge; // undefined = עוד לא סונכרן בטעינה הזו
export async function syncNudge() {
  if (!configured() || !getSettings().reminders) return;
  const minutes = getSettings().idleNudge ?? 0;
  const active = getActive();
  const at = nudgeAt(active, minutes);
  const key = at === null ? 'off' : String(at);
  if (key === lastNudge || (at === null && lastNudge === undefined && !active)) { lastNudge = key; return; }
  if (at !== null && at <= Date.now()) { lastNudge = key; return; } // כבר הגיע זמנה: השרת שלח או ישלח, לא מפעילים מחדש
  try {
    const sub = await currentSubscription();
    if (!sub) return;
    await post('/nudge', { subscription: sub.toJSON(), at, title: active?.name || 'LIFTRACK', body: tr('עברו {n} דקות בלי סט. מחכים לך באימון!', { n: minutes }) });
    lastNudge = key;
  } catch { /* אין רשת: ינסה שוב בשינוי הבא */ }
}

let timer;
/** מסנכרן את הלוח זמנים בכל שינוי נתונים (אחרי שקט של שנייה וחצי) ובפתיחת האפליקציה. */
export function startReminderSync() {
  if (!configured()) return;
  subscribe(() => { clearTimeout(timer); timer = setTimeout(() => { syncReminders(); syncNudge(); }, 1500); });
  syncReminders();
  syncNudge();
}
