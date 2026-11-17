// התקדמות: סדרות נתונים לגרפים, שיפורים, סטטוס ואחוזים. פונקציות טהורות, בלי DOM.
// נקודה בגרף = אימון אחד שכלל את התרגיל. ערך האימון נקבע לפי הסט הטוב ביותר בו
// (המשקל הגבוה ביותר, ובשוויון הכי הרבה חזרות), כמו ב"הנקודה שנבחרה" בעיצוב.
import { bestSet } from './workout.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const RANGES = { month: 30 * DAY_MS, quarter: 90 * DAY_MS, all: Infinity };

/**
 * סדרת נקודות לתרגיל, מהישנה לחדשה (history = אימונים שהסתיימו):
 * { t, workoutId, weight, reps, maxReps, bw, improvedWeight, improvedReps, first }
 *  - weight/reps: הסט הטוב ביותר באימון. maxReps: הכי הרבה חזרות בסט אחד.
 *  - improvedWeight: הסט (משקל, חזרות) עובר את כל מה שהיה עד אז (השוואה לפי משקל ואז חזרות).
 *  - improvedReps: maxReps גבוה מכל מה שהיה עד אז.
 *  - first: הנקודה הראשונה היא נקודת הפתיחה ולכן אף פעם לא "שיפור".
 * overrides: { 'workoutId:exerciseId:weight|reps': true|false } תיקון ידני של המתאמן ("לא שיפור?").
 */
export function exerciseSeries(history, exerciseId, overrides = {}) {
  const points = [];
  for (const w of history) {
    if (w.endedAt === null) continue;
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
    const top = ex && bestSet(ex);
    if (!top) continue;
    const reps = ex.sets.filter((s) => s.done).map((s) => s.reps ?? 0);
    points.push({ t: w.endedAt, workoutId: w.id, weight: top.weight ?? 0, reps: top.reps ?? 0, maxReps: Math.max(...reps), bw: !!ex.bw });
  }
  points.sort((a, b) => a.t - b.t);

  let bestW = null, bestR = null, bestMax = null;
  return points.map((p, i) => {
    const raw = {
      weight: i > 0 && (p.weight > bestW || (p.weight === bestW && p.reps > bestR)),
      reps: i > 0 && p.maxReps > bestMax,
    };
    if (bestW === null || p.weight > bestW || (p.weight === bestW && p.reps > bestR)) { bestW = p.weight; bestR = p.reps; }
    if (bestMax === null || p.maxReps > bestMax) bestMax = p.maxReps;
    const key = (m) => `${p.workoutId}:${exerciseId}:${m}`;
    return {
      ...p, first: i === 0,
      improvedWeight: key('weight') in overrides ? overrides[key('weight')] : raw.weight,
      improvedReps: key('reps') in overrides ? overrides[key('reps')] : raw.reps,
    };
  });
}

export const metricValue = (p, metric) => (metric === 'reps' ? p.maxReps : p.weight);
export const isImproved = (p, metric) => (metric === 'reps' ? p.improvedReps : p.improvedWeight);

/** משאיר רק נקודות מהטווח האחרון ('month' | 'quarter' | 'all'). */
export const filterRange = (points, range, now) => points.filter((p) => now - p.t <= RANGES[range]);

/**
 * סיכום סדרה: first (ערך פתיחה), best (המקסימום עד כה), gain (best - first),
 * pct (gain באחוזים מערך הפתיחה, או null אם אין נקודת פתיחה חיובית), pr (הסט הטוב ביותר אי פעם).
 */
export function seriesStats(points, metric = 'weight') {
  if (points.length === 0) return null;
  const first = metricValue(points[0], metric);
  const best = Math.max(...points.map((p) => metricValue(p, metric)));
  const gain = best - first;
  const pct = first > 0 ? Math.round((gain / first) * 1000) / 10 : null;
  const pr = points.reduce((b, p) => (p.weight > b.weight || (p.weight === b.weight && p.reps > b.reps) ? p : b));
  return { first, best, gain, pct, pr: { weight: pr.weight, reps: pr.reps, t: pr.t } };
}

/**
 * סטטוס תרגיל:
 *  'improving' (שיפור): האימון האחרון היה שיפור.
 *  'trend' (מגמת שיפור): היה שיפור באחד משני האימונים שלפניו.
 *  'stagnant' (קיפאון): 3 אימונים אחרונים בלי שיפור.
 *  'new' (מעט נתונים): פחות מ-3 אימונים ואין שיפור.
 */
export function exerciseStatus(points, metric = 'weight') {
  if (points.length === 0) return 'new';
  const last = points[points.length - 1];
  if (isImproved(last, metric)) return 'improving';
  if (points.length < 3) return 'new';
  return points.slice(-3, -1).some((p) => isImproved(p, metric)) ? 'trend' : 'stagnant';
}

/**
 * התקדמות של שריר שלם: ממוצע האחוזים של כל תרגילי השריר (בלי משקל גוף).
 * לכל תרגיל, בכל אימון: אחוז העלייה של המשקל המקסימלי עד אז לעומת נקודת הפתיחה שלו.
 * תרגיל נכנס לממוצע מהאימון השני שלו (כדי שתרגיל חדש בנקודת פתיחה לא ימשוך את הממוצע למטה).
 * מחזיר { points: [{ t, v }], pct (הערך האחרון או null), count (כמה תרגילים תורמים) }.
 */
export function muscleSeries(history, exerciseIds) {
  const per = [];
  for (const id of exerciseIds) {
    const s = exerciseSeries(history, id).filter((p) => !p.bw && p.weight > 0);
    if (s.length < 2) continue;
    let best = 0;
    per.push(s.map((p) => { best = Math.max(best, p.weight); return { t: p.t, pct: (best / s[0].weight - 1) * 100 }; }));
  }
  if (per.length === 0) return { points: [], pct: null, count: 0 };
  const times = [...new Set(per.flatMap((s) => s.slice(1).map((p) => p.t)))].sort((a, b) => a - b);
  const points = times.map((t) => {
    const vals = per
      .filter((s) => s[1].t <= t)
      .map((s) => s.filter((p) => p.t <= t).at(-1).pct);
    return { t, v: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 };
  });
  return { points, pct: points.at(-1).v, count: per.length };
}

/** סטים ואימונים של קבוצת תרגילים מתחילת השבוע (שבוע מתחיל ביום ראשון). */
export function weekStats(history, exerciseIds, now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const ids = new Set(exerciseIds);
  let sets = 0, workouts = 0;
  for (const w of history) {
    if (w.endedAt === null || w.endedAt < start.getTime()) continue;
    const mine = w.exercises.filter((e) => ids.has(e.exerciseId));
    const n = mine.reduce((sum, e) => sum + e.sets.filter((s) => s.done).length, 0);
    if (n > 0) { sets += n; workouts += 1; }
  }
  return { sets, workouts };
}

/** תרגילים שיש עליהם נתונים, מהאחרון שבוצע לראשון: [{ exerciseId, lastT, count }]. */
export function trainedExercises(history) {
  const map = new Map();
  for (const w of history) {
    if (w.endedAt === null) continue;
    for (const ex of w.exercises) {
      if (!ex.sets.some((s) => s.done)) continue;
      const cur = map.get(ex.exerciseId) ?? { exerciseId: ex.exerciseId, lastT: 0, count: 0 };
      map.set(ex.exerciseId, { ...cur, lastT: Math.max(cur.lastT, w.endedAt), count: cur.count + 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.lastT - a.lastT);
}

// ---- סקאלה לגרפים ----

/** מספרים "יפים" לציר: קפיצות של 1, 2, 2.5, 5 כפול חזקת 10. מחזיר מערך עולה שמכסה את [min, max]. */
export function niceTicks(min, max, count = 3) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const ticks = [];
  for (let v = Math.floor(min / step) * step; v < max + step - 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks.filter((_, i) => i === 0 || ticks[i - 1] < max - 1e-9);
}
