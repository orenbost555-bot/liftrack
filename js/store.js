// אחסון מקומי: כל נתוני המשתמש נשמרים בטלפון בלבד (localStorage).
// מבנה הנתונים:
//   { version, profile: { name, gender: 'm'|'f', lang: 'he'|'en', unit: 'kg'|'lb' } | null,
//     templates: [{ id, name, day, time, items: [{ exerciseId, sets }] }],
//     active: אימון שמתבצע עכשיו | null,
//     workouts: אימונים שהסתיימו (ההיסטוריה),
//     settings: { restTimer: טיימר מנוחה פעיל באימון (המתאמן בוחר), restSeconds, motivation: הודעות מוטיבציה },
//     goals: יעדים (ראה logic/goals.js),
//     swap: דחיות של הצעות החלפת תרגיל { [exerciseId]: { until, never } },
//     overrides: תיקונים ידניים של "שיפור" בגרפים { 'workoutId:exerciseId:weight|reps': true|false } }
// בהמשך נוסיף יעדים. כשהנתונים יגדלו נעבור ל-IndexedDB,
// ושאר האפליקציה לא תרגיש בזה כי היא עובדת רק דרך הפונקציות כאן.

import { makeBackup, parseBackup } from './logic/backup.js';
import { setCustomExercises } from './logic/exercises.js';

const KEY = 'liftrack.v1';

const defaults = () => ({ version: 1, profile: null, templates: [], active: null, workouts: [], settings: { restTimer: true, restSeconds: 90, motivation: true, reminders: false, reminderEve: true, reminderEveTime: '20:00', reminderLead: 2, idleNudge: 0 }, overrides: {}, goals: [], swap: {}, customExercises: [] });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
  } catch {
    // נתונים פגומים או localStorage חסום (גלישה פרטית): ממשיכים עם ברירת מחדל
    return defaults();
  }
}

let state = load();
setCustomExercises(state.customExercises);

const listeners = new Set();
/** מאזין לכל שמירה (משמש לסנכרון תזכורות). מחזיר פונקציית ביטול. */
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function persist() {
  setCustomExercises(state.customExercises);
  listeners.forEach((fn) => { try { fn(); } catch { /* מאזין תקול לא עוצר שמירה */ } });
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* אין מקום או חסום: האפליקציה ממשיכה לעבוד בזיכרון בלבד */
  }
}

export const getProfile = () => state.profile;
export const hasProfile = () => state.profile !== null;

export function saveProfile(profile) {
  state = { ...state, profile: { ...profile } };
  persist();
}

// ---- תבניות אימון ----
export const getTemplates = () => state.templates;
export const getTemplate = (id) => state.templates.find((t) => t.id === id) ?? null;

/** שומר תבנית: אם ה-id כבר קיים מחליף אותה, אחרת מוסיף לסוף. */
export function saveTemplate(template) {
  const exists = state.templates.some((t) => t.id === template.id);
  const templates = exists
    ? state.templates.map((t) => (t.id === template.id ? template : t))
    : [...state.templates, template];
  state = { ...state, templates };
  persist();
}

export function deleteTemplate(id) {
  state = { ...state, templates: state.templates.filter((t) => t.id !== id) };
  persist();
}

export const newId = () => `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---- אימון פעיל והיסטוריה ----
// אימון אחד פעיל בכל רגע. נשמר אחרי כל שינוי, כך שסגירת האפליקציה באמצע אימון לא מאבדת כלום.
export const getActive = () => state.active;
export function saveActive(workout) {
  state = { ...state, active: workout };
  persist();
}
export function clearActive() {
  state = { ...state, active: null };
  persist();
}
/** מעביר את האימון שהסתיים מ"פעיל" להיסטוריה בפעולה אחת. */
export function finishActive(finishedWorkout) {
  state = { ...state, active: null, workouts: [...state.workouts, finishedWorkout] };
  persist();
}

export const getWorkouts = () => state.workouts;
export const getWorkout = (id) => state.workouts.find((w) => w.id === id) ?? null;
/** מחליף אימון קיים (לפי id) באימון ערוך. */
export function updateWorkout(workout) {
  state = { ...state, workouts: state.workouts.map((x) => (x.id === workout.id ? workout : x)) };
  persist();
}
export function deleteWorkout(id) {
  state = { ...state, workouts: state.workouts.filter((w) => w.id !== id) };
  persist();
}

// ---- הגדרות ----
export const getSettings = () => ({ ...defaults().settings, ...state.settings });
export function saveSettings(patch) {
  state = { ...state, settings: { ...getSettings(), ...patch } };
  persist();
}

// ---- תיקוני שיפור ידניים (כפתור "לא שיפור?" בגרף ההתקדמות) ----
export const getOverrides = () => state.overrides ?? {};
/** value: true / false מכריע ידנית, null מחזיר לחישוב האוטומטי. */
export function setOverride(key, value) {
  const next = { ...getOverrides() };
  if (value === null) delete next[key]; else next[key] = value;
  state = { ...state, overrides: next };
  persist();
}

// ---- יעדים ----
export const getGoals = () => state.goals ?? [];
export function saveGoal(goal) {
  const goals = getGoals();
  state = { ...state, goals: goals.some((g) => g.id === goal.id) ? goals.map((g) => (g.id === goal.id ? goal : g)) : [...goals, goal] };
  persist();
}
/** מחליף את כל רשימת היעדים (למשל אחרי סימון יעדים שהושגו). */
export function saveGoals(goals) {
  state = { ...state, goals };
  persist();
}
export function deleteGoal(id) {
  state = { ...state, goals: getGoals().filter((g) => g.id !== id) };
  persist();
}

// ---- תרגילים מותאמים אישית ----
export const getCustomExercises = () => state.customExercises ?? [];
export const newExerciseId = () => `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
/** שומר תרגיל חדש או מעדכן קיים (לפי id). */
export function saveCustomExercise(ex) {
  const list = getCustomExercises();
  state = { ...state, customExercises: list.some((x) => x.id === ex.id) ? list.map((x) => (x.id === ex.id ? ex : x)) : [...list, ex] };
  persist();
}
export function deleteCustomExercise(id) {
  state = { ...state, customExercises: getCustomExercises().filter((x) => x.id !== id) };
  persist();
}

// ---- גיבוי ואיפוס ----
export const exportData = () => makeBackup(state, Date.now());

/** מחליף את כל הנתונים בגיבוי. מחזיר { ok } או { ok:false, error }. */
export function importData(text) {
  const r = parseBackup(text);
  if (!r.ok) return r;
  state = { ...defaults(), ...r.data, active: null };
  persist();
  return { ok: true };
}

export function resetAll() {
  state = defaults();
  persist();
}

// ---- הצעות החלפת תרגיל ----
export const getSwapState = () => state.swap ?? {};
export function saveSwapState(swap) {
  state = { ...state, swap };
  persist();
}
/** מחליף את כל רשימת התבניות (החלפת תרגיל בכמה תבניות בבת אחת). */
export function saveTemplates(templates) {
  state = { ...state, templates };
  persist();
}
