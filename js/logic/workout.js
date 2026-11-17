// לוגיקה טהורה של אימון פעיל: אין כאן DOM, localStorage או Date.now (השעה נכנסת כפרמטר).
// אימון: { id, templateId, name, startedAt, endedAt|null,
//          exercises: [{ exerciseId, bw, sets: [{ weight, reps, rir, done }] }] }
// bw = תרגיל במשקל גוף (נשמר בתוך האימון כדי שהיסטוריה לא תשתנה אם הספרייה תשתנה).
// כל הפונקציות מחזירות אובייקט חדש ולא משנות את הקיים.

export const DEFAULT_REST_SECONDS = 90;
export const REST_BONUS_SECONDS = 15;

export const emptySet = () => ({ weight: null, reps: null, rir: null, done: false });

const makeExercise = (exerciseId, bw, setCount) => ({
  exerciseId, bw: !!bw, sets: Array.from({ length: setCount }, emptySet),
});

export function startWorkout({ template, id, now, exercises }) {
  const meta = new Map(exercises.map((e) => [e.id, e]));
  return {
    id, templateId: template.id, name: template.name, startedAt: now, endedAt: null,
    exercises: template.items
      .filter((i) => meta.has(i.exerciseId))
      .map((i) => makeExercise(i.exerciseId, meta.get(i.exerciseId).bw, i.sets)),
  };
}

/** "72,5" / " 70 " / "" -> מספר או null (שלילי, ריק או לא מספר = null). */
export function parseNum(text) {
  if (typeof text === 'number') return Number.isFinite(text) && text >= 0 ? text : null;
  const s = String(text ?? '').trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const mapExercise = (w, exIdx, fn) => ({ ...w, exercises: w.exercises.map((e, i) => (i === exIdx ? fn(e) : e)) });
const mapSet = (w, exIdx, setIdx, fn) =>
  mapExercise(w, exIdx, (e) => ({ ...e, sets: e.sets.map((s, i) => (i === setIdx ? fn(s) : s)) }));

export const setField = (w, exIdx, setIdx, field, value) => mapSet(w, exIdx, setIdx, (s) => ({ ...s, [field]: value }));
export const addSet = (w, exIdx) => mapExercise(w, exIdx, (e) => ({ ...e, sets: [...e.sets, emptySet()] }));
export const removeSet = (w, exIdx, setIdx) =>
  mapExercise(w, exIdx, (e) => (e.sets.length <= 1 ? e : { ...e, sets: e.sets.filter((_, i) => i !== setIdx) }));

export const addExerciseToWorkout = (w, exercise, setCount = 3) =>
  ({ ...w, exercises: [...w.exercises, makeExercise(exercise.id, exercise.bw, setCount)] });

/** מחליף תרגיל באימון בתרגיל אחר, באותה כמות סטים (ריקים). */
export const replaceExercise = (w, exIdx, exercise) =>
  mapExercise(w, exIdx, (e) => makeExercise(exercise.id, exercise.bw, e.sets.length));

/**
 * סימון סט כבוצע (או ביטול אם כבר בוצע).
 * שדה ריק מתמלא מהסט המקביל באימון הקודם (prev), כך שלחיצה אחת = "כמו בפעם הקודמת".
 * מחזיר { workout, error } כש-error הוא 'reps' או 'weight' אם חסר נתון.
 */
export function toggleSet(w, exIdx, setIdx, prev) {
  const ex = w.exercises[exIdx];
  const s = ex.sets[setIdx];
  if (s.done) return { workout: setField(w, exIdx, setIdx, 'done', false), error: null };
  const weight = s.weight ?? prev?.weight ?? null;
  const reps = s.reps ?? prev?.reps ?? null;
  if (reps === null) return { workout: w, error: 'reps' };
  if (weight === null && !ex.bw) return { workout: w, error: 'weight' };
  return { workout: mapSet(w, exIdx, setIdx, (x) => ({ ...x, weight, reps, done: true })), error: null };
}

const doneSets = (ex) => ex.sets.filter((s) => s.done);

/** נפח = משקל × חזרות על כל הסטים שבוצעו. תרגילי משקל גוף לא נכללים (0). */
export const exerciseVolume = (ex) => (ex.bw ? 0 : doneSets(ex).reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0));
export const workoutVolume = (w) => w.exercises.reduce((sum, ex) => sum + exerciseVolume(ex), 0);
export const doneSetCount = (w) => w.exercises.reduce((n, ex) => n + doneSets(ex).length, 0);
export const canFinish = (w) => doneSetCount(w) > 0;

/** סגירת האימון: נשארים רק סטים שבוצעו ותרגילים שיש בהם סט כזה. */
export function finishWorkout(w, now) {
  const exercises = w.exercises
    .map((ex) => ({ ...ex, sets: doneSets(ex) }))
    .filter((ex) => ex.sets.length > 0);
  return { ...w, exercises, endedAt: now };
}

export const durationMinutes = (w) => Math.max(1, Math.round((w.endedAt - w.startedAt) / 60000));

/** הסטים שבוצעו באימון האחרון שכלל את התרגיל (history = אימונים שהסתיימו). */
export function previousSets(history, exerciseId, beforeTs = Infinity, excludeId = null) {
  let best = null;
  for (const w of history) {
    if (w.id === excludeId || w.endedAt === null || w.startedAt >= beforeTs) continue;
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId && doneSets(e).length > 0);
    if (ex && (best === null || w.endedAt > best.endedAt)) best = { endedAt: w.endedAt, sets: doneSets(ex) };
  }
  return best ? best.sets : null;
}

const weightStep = (kg) => (kg < 50 ? 2.5 : 5);
const REPS_STEP = 2;

/**
 * הצעה לעלייה: אחרי לפחות 2 סטים שבוצעו, אם בשניים האחרונים נשארו 2 חזרות או יותר
 * עד כשל (RIR >= 2), הגוף לא התאמץ מספיק. מציעים לעלות במשקל או בחזרות, לפי הסט האחרון.
 * מחזיר null כשאין הצעה.
 */
export function suggestIncrease(ex) {
  const done = doneSets(ex);
  if (done.length < 2) return null;
  const [a, b] = done.slice(-2);
  if (a.rir === null || b.rir === null || a.rir < 2 || b.rir < 2) return null;
  const last = b;
  return {
    rir: Math.min(a.rir, b.rir),
    weight: ex.bw || last.weight === null ? null : { from: last.weight, to: last.weight + weightStep(last.weight) },
    reps: { from: last.reps, to: last.reps + REPS_STEP },
  };
}

/** מחיל את ההצעה על כל הסטים שעוד לא בוצעו בתרגיל. kind = 'weight' | 'reps'. */
export function applySuggestion(w, exIdx, suggestion, kind) {
  const value = suggestion[kind].to;
  return mapExercise(w, exIdx, (e) => ({
    ...e, sets: e.sets.map((s) => (s.done ? s : { ...s, [kind]: value })),
  }));
}

/** הסט הכי טוב בתרגיל: משקל גבוה ביותר, ובשוויון הכי הרבה חזרות. */
export function bestSet(ex) {
  const done = doneSets(ex);
  if (done.length === 0) return null;
  return done.reduce((best, s) => {
    const sw = s.weight ?? 0, bw = best.weight ?? 0;
    return sw > bw || (sw === bw && (s.reps ?? 0) > (best.reps ?? 0)) ? s : best;
  });
}

// ---- עריכת אימון שהסתיים (מההיסטוריה) ----
// באימון שהסתיים נשארו רק סטים שבוצעו, ולכן כל סט כאן הוא סט שבוצע.

/** סט חדש באימון שהסתיים: מתחיל כעותק של הסט האחרון, כך שמשנים רק מה שהיה שונה. */
export const addDoneSet = (w, exIdx) => mapExercise(w, exIdx, (e) => {
  const last = e.sets[e.sets.length - 1];
  return { ...e, sets: [...e.sets, { weight: last?.weight ?? null, reps: last?.reps ?? null, rir: last?.rir ?? null, done: true }] };
});

export const removeExerciseAt = (w, exIdx) => ({ ...w, exercises: w.exercises.filter((_, i) => i !== exIdx) });

/**
 * בדיקה לפני שמירת אימון שנערך. null אם תקין, אחרת { error, exIdx }:
 * 'empty' (אין אף סט), 'reps' (חזרות חסרות או 0), 'weight' (משקל חסר בתרגיל עם משקל).
 */
export function validateEditedWorkout(w) {
  if (w.exercises.length === 0 || w.exercises.every((e) => e.sets.length === 0)) return { error: 'empty', exIdx: 0 };
  for (let i = 0; i < w.exercises.length; i++) {
    const ex = w.exercises[i];
    for (const s of ex.sets) {
      if (!(s.reps > 0)) return { error: 'reps', exIdx: i };
      if (!ex.bw && s.weight === null) return { error: 'weight', exIdx: i };
    }
  }
  return null;
}
