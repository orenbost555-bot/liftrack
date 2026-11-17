// תרגילים מותאמים אישית: בניית תרגיל, בדיקת תקינות ובדיקת שימוש לפני מחיקה.

import { MUSCLE_NAMES } from '../data/muscles.js';

export const MUSCLE_KEYS = Object.keys(MUSCLE_NAMES);
export const MAX_NAME = 40;

const clean = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);
const norm = (s) => clean(s).toLowerCase();

export const emptyDraft = () => ({ id: null, he: '', en: '', p: [], sec: [], bw: false });

/** מסנן שרירים לא מוכרים וכפילויות; שריר עיקרי לא יכול להיות גם משני. */
export function buildExercise(draft, id) {
  const known = (list) => [...new Set(list ?? [])].filter((m) => MUSCLE_KEYS.includes(m));
  const p = known(draft.p);
  const sec = known(draft.sec).filter((m) => !p.includes(m));
  return { id, he: clean(draft.he), en: clean(draft.en), p, sec, bw: Boolean(draft.bw) };
}

/** מסמן/מבטל שריר ברשימה (kind: 'p' | 'sec'). בחירה ברשימה אחת מוציאה אותו מהשנייה. */
export function toggleMuscle(draft, kind, key) {
  const other = kind === 'p' ? 'sec' : 'p';
  const has = draft[kind].includes(key);
  return {
    ...draft,
    [kind]: has ? draft[kind].filter((m) => m !== key) : [...draft[kind], key],
    [other]: draft[other].filter((m) => m !== key),
  };
}

/**
 * null אם תקין, אחרת קוד: 'name' (אין שם בשום שפה), 'main' (אין שריר עיקרי), 'dup' (שם קיים).
 * taken = קבוצה של שמות קיימים באותיות קטנות (בלי התרגיל שעורכים).
 */
export function validateExercise(draft, taken = new Set()) {
  const he = norm(draft.he);
  const en = norm(draft.en);
  if (!he && !en) return 'name';
  if (!draft.p || draft.p.length === 0) return 'main';
  if ((he && taken.has(he)) || (en && taken.has(en))) return 'dup';
  return null;
}

/** כל השמות התפוסים (עברית ואנגלית) של תרגילים, חוץ מהתרגיל שעורכים. */
export function takenNames(exercises, customList, nameEn = {}, exceptId = null) {
  const out = new Set();
  const add = (s) => { const n = norm(s); if (n) out.add(n); };
  for (const e of exercises) {
    if (e.id === exceptId) continue;
    add(e.he);
    add(String(e.en ?? '').split(' · ')[0]);
    if (nameEn[e.id]) add(nameEn[e.id]);
  }
  for (const c of customList) if (c.id !== exceptId) { add(c.he); add(c.en); }
  return out;
}

/** כמה תבניות ואימונים בהיסטוריה משתמשים בתרגיל (מונע מחיקה שתשאיר היסטוריה בלי שם). */
export function usageOf(id, templates, workouts) {
  return {
    templates: templates.filter((t) => t.items.some((i) => i.exerciseId === id)).length,
    workouts: workouts.filter((w) => w.exercises.some((e) => e.exerciseId === id)).length,
  };
}

/** מסיר תרגיל מכל התבניות (בעת מחיקה). */
export function withoutExercise(templates, id) {
  return templates.map((t) => (t.items.some((i) => i.exerciseId === id) ? { ...t, items: t.items.filter((i) => i.exerciseId !== id) } : t));
}
