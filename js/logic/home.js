// לוגיקה טהורה של מסך הבית: מה האימון של היום, פס השבוע והתקדמות אחרונה.
import { exerciseSeries, exerciseStatus, trainedExercises } from './progress.js';
import { tr } from '../i18n.js';
import { slotsOf } from './templates.js';

const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((d) => tr(d));
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const finished = (history) => history.filter((w) => w.endedAt !== null);
const doneOn = (history, templateId, dayTs) => finished(history).some((w) => w.templateId === templateId && startOfDay(w.endedAt) === dayTs);
const byTime = (a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99');

/** משך משוער בדקות: כ-3 דקות לסט כולל מנוחה, מעוגל ל-5. */
export const estimateMinutes = (sets) => Math.max(5, Math.round((sets * 10) / 3 / 5) * 5);

/**
 * מה מציגים בכרטיס הראשי:
 *  active (יש אימון פעיל) | today (תבנית מתוכננת להיום שעוד לא בוצעה) | done (כל אימוני היום בוצעו)
 *  next (האימון המתוכנן הבא, daysAhead ימים קדימה) | pick (יש תבניות בלי יום) | empty (אין תבניות)
 */
export function todayPlan(templates, history, active, now) {
  if (active) return { kind: 'active', workout: active };
  if (templates.length === 0) return { kind: 'empty' };
  const today = startOfDay(now);
  const dow = new Date(now).getDay();
  // כל זוג (תבנית, יום) הוא אימון מתוכנן אחד, עם השעה של אותו יום.
  const entries = templates.flatMap((t) => slotsOf(t).map((s) => ({ template: t, day: s.day, time: s.time })));
  const todays = entries.filter((e) => e.day === dow).sort(byTime);
  const pending = todays.find((e) => !doneOn(history, e.template.id, today));
  if (pending) return { kind: 'today', template: pending.template, time: pending.time };
  if (todays.length) return { kind: 'done', template: todays[0].template, time: todays[0].time };
  const ahead = (e) => ((e.day - dow + 7) % 7) || 7;
  const next = [...entries].sort((a, b) => ahead(a) - ahead(b) || byTime(a, b))[0];
  return next ? { kind: 'next', template: next.template, time: next.time, day: next.day, daysAhead: ahead(next) } : { kind: 'pick' };
}

/**
 * פס השבוע הנוכחי (ראשון עד שבת). מצב לכל יום:
 *  done (בוצע אימון) | today (היום, עוד לא בוצע) | planned (מתוכנן בהמשך) | missed (תוכנן ועבר) | rest (מנוחה)
 */
export function weekDays(templates, history, now) {
  const today = startOfDay(now);
  const dow = new Date(now).getDay();
  const doneDays = new Set(finished(history).map((w) => startOfDay(w.endedAt)));
  return DAY_LETTERS.map((letter, day) => {
    const d = new Date(today);
    d.setDate(d.getDate() + (day - dow));
    const ts = d.getTime();
    const planned = templates.some((t) => slotsOf(t).some((s) => s.day === day));
    let state = 'rest';
    if (doneDays.has(ts)) state = 'done';
    else if (ts === today) state = 'today';
    else if (planned) state = ts > today ? 'planned' : 'missed';
    return { day, letter, state, isToday: ts === today };
  });
}

/** התרגילים שבוצעו לאחרונה עם הסט הטוב שלהם והסטטוס: [{ exerciseId, bw, weight, reps, status }] */
export function recentProgress(history, overrides = {}, limit = 3) {
  return trainedExercises(history).slice(0, limit).map((t) => {
    const points = exerciseSeries(history, t.exerciseId, overrides);
    const last = points[points.length - 1];
    const metric = last.bw ? 'reps' : 'weight';
    return { exerciseId: t.exerciseId, bw: last.bw, weight: last.weight, reps: last.bw ? last.maxReps : last.reps, status: exerciseStatus(points, metric) };
  });
}
