// הצעת החלפת תרגיל: מזהה תרגיל שלא משתפר כבר שלושה שבועות ומציע חלופות מאותה קבוצת שריר.
import { exerciseSeries, isImproved } from './progress.js';

const DAY = 24 * 60 * 60 * 1000;
export const STAGNANT_DAYS = 60; // חודשיים בלי שינוי
export const STAGNANT_SESSIONS = 5; // או 5 אימונים בלי שיפור
export const MIN_SESSIONS = 3; // ובכל מקרה לפחות 3 אימונים בלי שיפור, אחרת חודשיים של היעדרות היו נספרים
export const SNOOZE_DAYS = 14;

/**
 * האם התרגיל תקוע: לפחות 5 אימונים בלי שיפור, או לפחות חודשיים (60 יום)
 * בלי שיפור (ובכל מקרה 3 אימונים לפחות). הספירה מהשיפור האחרון (או מנקודת הפתיחה אם לא היה שיפור). בתרגיל משקל גוף מודדים חזרות.
 * מחזיר { weeks, sessions, metric, points } או null.
 */
export function stagnation(history, exerciseId, now, overrides = {}) {
  const points = exerciseSeries(history, exerciseId, overrides);
  if (points.length === 0) return null;
  const metric = points[0].bw ? 'reps' : 'weight';
  const lastIdx = points.map((p, i) => (p.first || isImproved(p, metric) ? i : -1)).reduce((a, b) => Math.max(a, b), 0);
  const sessions = points.length - 1 - lastIdx;
  const days = Math.floor((now - points[lastIdx].t) / DAY);
  return sessions >= MIN_SESSIONS && (sessions >= STAGNANT_SESSIONS || days >= STAGNANT_DAYS) ? { weeks: Math.floor(days / 7), sessions, metric, points } : null;
}

/** דחיות שהמתאמן בחר: { [exerciseId]: { until: זמן | null, never: boolean } } */
export function isSuppressed(swapState, exerciseId, now) {
  const s = swapState?.[exerciseId];
  return !!s && (s.never === true || (s.until !== null && s.until !== undefined && s.until > now));
}
export const snooze = (swapState, id, now) => ({ ...swapState, [id]: { until: now + SNOOZE_DAYS * DAY, never: false } });
export const never = (swapState, id) => ({ ...swapState, [id]: { until: null, never: true } });

/** כל התרגילים התקועים שלא נדחו, מהתקוע ביותר: [{ exerciseId, weeks, metric, points }] */
export function stagnantList(history, exerciseIds, swapState, now, overrides = {}) {
  return exerciseIds
    .filter((id) => !isSuppressed(swapState, id, now))
    .map((id) => ({ exerciseId: id, ...stagnation(history, id, now, overrides) }))
    .filter((r) => r.weeks !== undefined)
    .sort((a, b) => b.weeks - a.weeks);
}

/**
 * חלופות לתרגיל: אותה קבוצת שריר ואותו סוג (משקל גוף או לא).
 * דירוג: שרירים עיקריים משותפים, אחר כך אותה תת-קבוצה, ותרגילים שהמתאמן עוד לא עשה קודמים (גירוי חדש).
 */
export function alternatives(exercise, library, doneIds, count = 3) {
  const score = (e) => e.p.filter((m) => exercise.p.includes(m)).length * 4 + (e.sub === exercise.sub ? 2 : 0) + (doneIds.has(e.id) ? 0 : 1);
  return library
    .filter((e) => e.id !== exercise.id && e.group === exercise.group && !!e.bw === !!exercise.bw && e.p.some((m) => exercise.p.includes(m)))
    .map((e) => ({ e, s: score(e) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, count)
    .map((x) => x.e);
}

/**
 * מחליף תרגיל בכל התבניות שיש בהן אותו. אם התבנית כבר מכילה את החלופה, התרגיל הישן רק מוסר.
 * מחזיר { templates, changed } (changed = כמה תבניות השתנו).
 */
export function replaceInTemplates(templates, fromId, toId) {
  let changed = 0;
  const next = templates.map((t) => {
    if (!t.items.some((i) => i.exerciseId === fromId)) return t;
    changed += 1;
    const hasTo = t.items.some((i) => i.exerciseId === toId);
    return { ...t, items: hasTo ? t.items.filter((i) => i.exerciseId !== fromId) : t.items.map((i) => (i.exerciseId === fromId ? { ...i, exerciseId: toId } : i)) };
  });
  return { templates: next, changed };
}
