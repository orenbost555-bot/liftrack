// יועץ התזמון: לוגיקה טהורה, בלי DOM ובלי רשת. מקבל זמנים פנויים ועדיפויות, ומחזיר לוח שבועי מוצע.
// הכל מחושב בטלפון: שום מידע לא נשלח לשום מקום.
import { scheduleOf, entryDays } from './summary.js';

/** מיפוי שריר -> קבוצת שרירים גסה, כדי לזהות אימונים שעובדים על אותם שרירים (ומצריכים מנוחה ביניהם). */
export const GROUP_OF = {
  chestUpper: 'chest', chestMid: 'chest', chestLower: 'chest',
  antDelt: 'shoulders', latDelt: 'shoulders', postDelt: 'shoulders',
  lats: 'back', traps: 'back', rhomboids: 'back', erectors: 'back',
  biceps: 'arms', triceps: 'arms', forearms: 'arms',
  rectus: 'core', obliques: 'core',
  quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs',
};
export const GROUP_NAMES = { chest: 'חזה', shoulders: 'כתפיים', back: 'גב', arms: 'ידיים', core: 'בטן', legs: 'רגליים' };

export const MIN_PER_WEEK = 1;
export const MAX_PER_WEEK = 4;
const HEAVY_SETS = 4; // קבוצה עם לפחות כך וכך סטים בתבנית נחשבת "עיקרית" בה
const SLACK = 10; // דקות מרווח מעבר למשך האימון המשוער

export const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
export const fromMin = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
/** מרחק מעגלי בין שני ימים בשבוע: 1 = ימים סמוכים (גם שבת וראשון). */
export const dayDistance = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 7 - d); };

/** סטים לכל קבוצת שרירים בתבנית (לפי השרירים העיקריים של כל תרגיל). */
export function loadOf(template, byId) {
  const load = {};
  for (const item of template.items ?? []) {
    const ex = byId.get(item.exerciseId);
    for (const m of ex?.p ?? []) { const g = GROUP_OF[m]; if (g) load[g] = (load[g] ?? 0) + item.sets; }
  }
  return load;
}

/** הקבוצות שהתבנית "עובדת עליהן בעיקר". אם אין אף אחת מעל הסף, לוקחים את החזקה ביותר. */
export function heavyGroups(load) {
  const entries = Object.entries(load);
  if (!entries.length) return [];
  const heavy = entries.filter(([, n]) => n >= HEAVY_SETS).map(([g]) => g);
  if (heavy.length) return heavy.sort();
  return [entries.sort((a, b) => b[1] - a[1])[0][0]];
}

/** משך אימון משוער בדקות: חימום + כ-3 דקות לסט, מעוגל ל-5. */
export function sessionMinutes(template) {
  const sets = (template.items ?? []).reduce((s, i) => s + i.sets, 0);
  return Math.round((10 + sets * 3) / 5) * 5;
}

/** ברירת מחדל: פנוי כל יום 17:00-21:00. */
export const defaultAvailability = () => Array.from({ length: 7 }, () => ({ on: true, from: '17:00', to: '21:00' }));

/** כמה דקות פנויות ביום (0 אם לא פנוי או אם הטווח לא תקין). */
export function windowMinutes(a) {
  if (!a || !a.on || !a.from || !a.to) return 0;
  return Math.max(0, toMin(a.to) - toMin(a.from));
}

/** ציון לשיבוץ שלם. ככל שגבוה יותר, השיבוץ טוב יותר. */
function scoreAssignment(sessions, days, availability) {
  let score = 0;
  sessions.forEach((s, i) => {
    const slack = windowMinutes(availability[days[i]]) - s.tpl.mins;
    score += (s.tpl.high ? 2 : 1) * Math.min(slack, 120) / 12; // חלון נוח יותר = יותר נקודות, ועדיפות גבוהה שוקלת כפול
  });
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const d = dayDistance(days[i], days[j]);
      const a = sessions[i].tpl, b = sessions[j].tpl;
      if (a.id === b.id) { score += d === 1 ? -30 : d === 2 ? 4 : 2; continue; }
      const shared = a.heavy.filter((g) => b.heavy.includes(g)).length;
      if (shared) score += d === 1 ? -40 * Math.min(shared, 2) : d === 2 ? 0 : 3;
    }
  }
  // רצף של 3 ימים רצופים ומעלה מאמץ ביותר, ומרווחים לא שווים בין האימונים פחות נוחים.
  const sorted = [...days].sort((x, y) => x - y);
  const set = new Set(sorted);
  for (const d of sorted) if (set.has((d + 1) % 7) && set.has((d + 2) % 7)) score -= 12;
  if (sorted.length > 1) {
    const gaps = sorted.map((d, i) => (i + 1 < sorted.length ? sorted[i + 1] - d : sorted[0] + 7 - d));
    const mean = 7 / sorted.length;
    score -= gaps.reduce((s, g) => s + (g - mean) ** 2, 0) * 1.5 / sorted.length;
  }
  return score;
}

/** שעת התחלה בתוך החלון: בוקר או "לא משנה" = תחילת החלון, ערב = כמה שיותר מאוחר שעדיין נכנס. */
export function startTime(window, mins, timeOfDay) {
  const from = toMin(window.from), to = toMin(window.to);
  if (timeOfDay === 'evening') return fromMin(Math.max(from, Math.floor((to - mins) / 15) * 15));
  return fromMin(Math.ceil(from / 15) * 15 <= to - mins ? Math.ceil(from / 15) * 15 : from);
}

/**
 * מייצר לוח שבועי.
 * @param {object} p
 * @param {Array} p.templates תבניות {id, name, items}
 * @param {Map} p.byId ספריית התרגילים לפי מזהה
 * @param {Array} p.availability 7 ערכים {on, from, to} (אינדקס 0 = ראשון)
 * @param {object} p.counts {templateId: כמה פעמים בשבוע}
 * @param {object} p.priority {templateId: 'high' | 'normal'}
 * @param {'morning'|'evening'|'any'} p.timeOfDay
 */
export function planWeek({ templates, byId, availability, counts = {}, priority = {}, timeOfDay = 'any' }) {
  const info = templates.map((t) => ({
    id: t.id, name: t.name, mins: sessionMinutes(t), heavy: heavyGroups(loadOf(t, byId)),
    n: clamp(Math.round(counts[t.id] ?? 1), MIN_PER_WEEK, MAX_PER_WEEK), high: priority[t.id] === 'high',
  }));
  const feasibleDays = (tpl) => [0, 1, 2, 3, 4, 5, 6].filter((d) => windowMinutes(availability[d]) >= tpl.mins + SLACK);

  // כל אימון בשבוע הוא "מושב". המושבים החשובים ביותר ראשונים: עדיפות גבוהה, ואחרי זה הפעם הראשונה של כל תבנית.
  let sessions = info.flatMap((tpl) => Array.from({ length: tpl.n }, (_, k) => ({ tpl, k })))
    .sort((a, b) => (b.tpl.high - a.tpl.high) || (a.k - b.k) || (info.indexOf(a.tpl) - info.indexOf(b.tpl)));
  const unplaced = [];

  for (let i = sessions.length - 1; i >= 0; i--) {
    if (!feasibleDays(sessions[i].tpl).length) { unplaced.push({ templateId: sessions[i].tpl.id, name: sessions[i].tpl.name, reason: 'no-window', minutes: sessions[i].tpl.mins }); sessions.splice(i, 1); }
  }

  let best = null;
  while (sessions.length) {
    best = searchBest(sessions, feasibleDays, availability);
    if (best) break;
    const dropped = sessions.pop(); // אין שיבוץ חוקי: מוותרים על האימון הכי פחות חשוב ומנסים שוב
    unplaced.push({ templateId: dropped.tpl.id, name: dropped.tpl.name, reason: 'no-day', minutes: dropped.tpl.mins });
  }

  const placements = (best?.days ?? []).map((day, i) => {
    const { tpl } = sessions[i];
    return { templateId: tpl.id, name: tpl.name, day, time: startTime(availability[day], tpl.mins, timeOfDay), minutes: tpl.mins, reasons: [] };
  }).sort((a, b) => a.day - b.day);
  for (const p of placements) p.reasons = reasonsFor(p, placements, info, availability);
  const used = new Set(placements.map((p) => p.day));
  return { placements, unplaced, restDays: [0, 1, 2, 3, 4, 5, 6].filter((d) => !used.has(d)) };
}

function searchBest(sessions, feasibleDays, availability) {
  const options = sessions.map((s) => feasibleDays(s.tpl));
  const days = new Array(sessions.length);
  const used = new Set();
  let best = null;
  (function go(i) {
    if (i === sessions.length) {
      const score = scoreAssignment(sessions, days, availability);
      if (!best || score > best.score) best = { score, days: [...days] };
      return;
    }
    for (const d of options[i]) {
      if (used.has(d)) continue;
      used.add(d); days[i] = d;
      go(i + 1);
      used.delete(d);
    }
  })(0);
  return best;
}

/** הסברים קצרים לכל שיבוץ: התאוששות מהאימון הקודם על אותם שרירים, וגודל החלון הפנוי. */
function reasonsFor(p, placements, info, availability) {
  const me = info.find((i) => i.id === p.templateId);
  const reasons = [];
  let nearest = null;
  for (const o of placements) {
    if (o === p || o.day === p.day) continue;
    const other = info.find((i) => i.id === o.templateId);
    const groups = me.heavy.filter((g) => other.heavy.includes(g));
    if (!groups.length) continue;
    // כמה ימים עברו מהאימון הקודם שמשתף איתי שרירים (מעגלית, אחורה)
    const gap = (p.day - o.day + 7) % 7;
    if (!nearest || gap < nearest.gap) nearest = { gap, name: o.name, groups };
  }
  if (nearest) reasons.push({ code: 'rest', gap: nearest.gap, name: nearest.name, groups: nearest.groups });
  else if (placements.length > 1) reasons.push({ code: 'free' });
  const win = windowMinutes(availability[p.day]);
  reasons.push({ code: 'window', hours: Math.round(win / 6) / 10, minutes: p.minutes, from: availability[p.day].from, to: availability[p.day].to });
  return reasons;
}

/** מחיל את התוכנית על התבניות: מחליף את הימים והשעות, ושומר היסטוריית לוח (כמו בעורך התבניות). */
export function applyPlan(templates, plan, now = Date.now()) {
  const byTemplate = new Map();
  for (const p of plan.placements) byTemplate.set(p.templateId, [...(byTemplate.get(p.templateId) ?? []), { day: p.day, time: p.time }]);
  return templates.map((t) => {
    const slots = byTemplate.get(t.id);
    if (!slots) return t;
    slots.sort((a, b) => a.day - b.day);
    const days = slots.map((s) => s.day);
    const schedule = scheduleOf(t);
    const prev = schedule.length ? entryDays(schedule[schedule.length - 1]) : [];
    const changed = prev.join() !== days.join();
    const { day, time, ...rest } = t; // השדות הישנים מוחלפים ב-slots
    return { ...rest, slots, schedule: changed ? [...schedule, { days, since: now }] : schedule };
  });
}
