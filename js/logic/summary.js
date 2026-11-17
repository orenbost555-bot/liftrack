// השוואת אימונים, הודעות מוטיבציה, רצף ותאריכים. פונקציות טהורות.
import { exerciseVolume, workoutVolume, previousSets } from './workout.js';
import { tr, getLang } from '../i18n.js';
import { slotsOf } from './templates.js';

const finished = (history) => history.filter((w) => w.endedAt !== null);

/** האימון הקודם מאותה תבנית (האחרון שהסתיים לפני שהאימון הזה התחיל). */
export function previousWorkout(history, workout) {
  let best = null;
  for (const w of finished(history)) {
    if (w.id === workout.id || w.templateId !== workout.templateId || w.startedAt >= workout.startedAt) continue;
    if (best === null || w.endedAt > best.endedAt) best = w;
  }
  return best;
}

/**
 * השוואה לאימון הקודם:
 * volume / prevVolume / delta / pct (pct = null כשאין אימון קודם),
 * perExercise: [{ exerciseId, volume, delta }] (delta = null כשהתרגיל לא בוצע קודם; בלי תרגילי משקל גוף),
 * improvements = כמה תרגילים עלו בנפח, comparable = כמה תרגילים אפשר היה להשוות.
 */
export function compareWorkout(workout, history) {
  const prev = previousWorkout(history, workout);
  const volume = workoutVolume(workout);
  const prevVolume = prev ? workoutVolume(prev) : null;
  const perExercise = workout.exercises
    .filter((ex) => !ex.bw)
    .map((ex) => {
      const vol = exerciseVolume(ex);
      const prevSets = previousSets(history, ex.exerciseId, workout.startedAt, workout.id);
      const prevVol = prevSets ? prevSets.reduce((s, x) => s + (x.weight ?? 0) * (x.reps ?? 0), 0) : null;
      return { exerciseId: ex.exerciseId, volume: vol, delta: prevVol === null ? null : vol - prevVol };
    });
  const comparable = perExercise.filter((p) => p.delta !== null).length;
  const improvements = perExercise.filter((p) => p.delta !== null && p.delta > 0).length;
  const delta = prevVolume === null ? null : volume - prevVolume;
  const pct = prevVolume ? Math.round((delta / prevVolume) * 1000) / 10 : null;
  return { volume, prevVolume, delta, pct, perExercise, improvements, comparable };
}

/** הודעת הסיכום. tone: 'first' | 'up' | 'same' | 'down'. */
export function motivationFor(cmp) {
  if (cmp.delta === null) {
    return { tone: 'first', title: tr('אימון ראשון בספר!'), text: tr('מכאן בונים. בפעם הבאה שוברים אותו.') };
  }
  if (cmp.delta > 0) {
    const all = cmp.comparable > 0 && cmp.improvements === cmp.comparable;
    return all
      ? { tone: 'up', title: tr('כל הכבוד! מפה רק עולים למעלה'),
          text: cmp.comparable === 1 ? tr('עלית בנפח בתרגיל. רק משתפרים.') : tr('עלית בנפח בכל {n} התרגילים. רק משתפרים.', { n: cmp.comparable }) }
      : { tone: 'up', title: tr('אימון חזק! הנפח עלה'), text: tr('{a} מתוך {b} תרגילים השתפרו. ממשיכים.', { a: cmp.improvements, b: cmp.comparable }) };
  }
  if (cmp.delta === 0) {
    return { tone: 'same', title: tr('שומרים על הקצב'), text: tr('אותו נפח כמו בפעם הקודמת. בפעם הבאה מוסיפים עוד.') };
  }
  return { tone: 'down', title: tr('ירידה קלה בנפח'), text: tr('אולי באת עייף, או שהאימון היה קשה מהרגיל. עדיין עשית אותו, כל הכבוד!') };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * רצף חלופי (כשאין לאף תבנית יום קבוע): כמה אימונים ברצף בלי פער של יותר משבוע ביניהם.
 * אם האימון האחרון היה לפני יותר משבוע, הרצף נשבר (0).
 */
export function streak(history, now) {
  const ends = finished(history).map((w) => w.endedAt).sort((a, b) => b - a);
  if (ends.length === 0 || now - ends[0] > 7 * DAY_MS) return 0;
  let n = 1;
  for (let i = 1; i < ends.length; i++) {
    if (ends[i - 1] - ends[i] > 7 * DAY_MS) break;
    n++;
  }
  return n;
}

const startOfDay = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const startOfWeek = (ts) => { // שבוע מתחיל ביום ראשון
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
};

/** 'השבוע' | 'שבוע שעבר' | 'קודם' */
export function weekBucket(ts, now) {
  const diff = startOfWeek(now) - startOfWeek(ts);
  if (diff <= 0) return tr('השבוע');
  if (diff <= 7 * DAY_MS + DAY_MS / 2) return tr('שבוע שעבר');
  return tr('קודם@@bucket');
}

const MONTHS = ['בינו׳', 'בפבר׳', 'במרץ', 'באפר׳', 'במאי', 'ביוני', 'ביולי', 'באוג׳', 'בספט׳', 'באוק׳', 'בנוב׳', 'בדצמ׳'];
const DAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "יום ב׳, 19 באוק׳" (באנגלית: "Mon, Oct 19") */
export function formatDate(ts) {
  const d = new Date(ts);
  if (getLang() === 'en') return `${DAYS_EN[d.getDay()]}, ${MONTHS_EN[d.getMonth()]} ${d.getDate()}`;
  return `יום ${DAY_LETTERS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "12 באוק׳" */
export function formatDayMonth(ts) {
  const d = new Date(ts);
  if (getLang() === 'en') return `${MONTHS_EN[d.getMonth()]} ${d.getDate()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** שם חודש קצר בלי ב': "אוק׳" */
export const monthShort = (ts) => (getLang() === 'en' ? MONTHS_EN[new Date(ts).getMonth()] : MONTHS[new Date(ts).getMonth()].slice(1));

/** 5915 -> "5,915", 72.5 -> "72.5" */
export function formatNumber(n) {
  return (Math.round(n * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
}

/**
 * לוח הזמנים של תבנית לאורך זמן: [{ days: [0..6], since }] (since = מתי נקבע).
 * פורמטים ישנים נתמכים: רשומה עם day בודד, ותבנית עם day ו-scheduledSince בלבד.
 */
export function scheduleOf(template) {
  if (Array.isArray(template.schedule)) return template.schedule;
  return slotsOf(template).length ? [{ days: slotsOf(template).map((s) => s.day), since: template.scheduledSince ?? 0 }] : [];
}

/** הימים בשבוע שרשומה בלוח מתייחסת אליהם. */
export const entryDays = (entry) => entry.days ?? (Number.isInteger(entry.day) ? [entry.day] : []);

/** באילו ימים בשבוע התבנית הייתה מתוכננת בתאריך נתון (מערך ריק אם לא הייתה מתוכננת). */
function daysOn(template, dayTs) {
  let days = [];
  for (const entry of scheduleOf(template)) if (startOfDay(entry.since) <= dayTs) days = entryDays(entry);
  return days;
}

/**
 * רצף אימונים מתוכננים: כמה אימונים שתוכננו המתאמן באמת ביצע, ברצף, מהיום אחורה.
 * - אימון מתוכנן שהיום שלו עבר ולא בוצע באותו יום שובר את הרצף ומאפס אותו.
 * - אימון של היום שעוד לא בוצע רק "ממתין" ולא שובר (היום עוד לא נגמר).
 * - שינוי יום בתבנית משפיע מהיום והלאה בלבד. אימונים שכבר בוצעו נשארים בספירה, ושינוי לפני שהיום
 *   המקורי עבר מונע החמצה: זה מה שמאפשר למתאמן "להזיז" אימון בלי לאבד רצף.
 * - לא סופרים ימים לפני האימון הראשון. אימון בתבנית בלי יום קבוע לא משפיע על הרצף.
 */
export function scheduledStreak(history, templates, now) {
  const done = finished(history);
  const scheduled = templates.filter((t) => scheduleOf(t).some((e) => entryDays(e).length > 0));
  if (done.length === 0 || scheduled.length === 0) return 0;
  const firstDay = startOfDay(Math.min(...done.map((w) => w.startedAt)));
  const today = startOfDay(now);
  let count = 0;
  for (let i = 0; i < 366; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayTs = d.getTime();
    if (dayTs < firstDay) break;
    for (const t of scheduled) {
      if (!daysOn(t, dayTs).includes(d.getDay())) continue;
      if (done.some((w) => w.templateId === t.id && startOfDay(w.endedAt) === dayTs)) count++;
      else if (i > 0) return count; // יום שעבר בלי אימון: הרצף נשבר
    }
  }
  return count;
}

/** הרצף שמוצג בבית: לפי לוח האימונים אם יש, ואחרת לפי הרצף השבועי. */
export function workoutStreak(history, templates, now) {
  return templates.some((t) => scheduleOf(t).some((e) => entryDays(e).length > 0))
    ? scheduledStreak(history, templates, now)
    : streak(history, now);
}
