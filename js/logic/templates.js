import { tr } from '../i18n.js';
// לוגיקה טהורה של תבניות אימון: אין כאן DOM ואין localStorage, ולכן קל לבדוק.
// תבנית: { id, name, slots: [{ day: 0..6 (0 = ראשון), time: 'HH:MM' | null }], items: [{ exerciseId, sets }] }
// slots = בכל איזה ימים מתאמנים ובאיזו שעה (שעה שונה לכל יום). תבניות ישנות שמורות עם day ו-time בלבד (ראה slotsOf).
// כל הפונקציות מחזירות תבנית חדשה ולא משנות את המקורית (immutable), כך שקל לזהות שינוי ולצייר מחדש.

export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map((d) => tr(d));
export const DEFAULT_SETS = 3;
export const MIN_SETS = 1;
export const MAX_SETS = 10;

export const newTemplate = (id) => ({ id, name: '', slots: [], items: [] });

/** ימי האימון של התבנית, ממוינים מראשון עד שבת. תומך גם בתבניות הישנות (day + time). */
export function slotsOf(t) {
  const raw = Array.isArray(t.slots) ? t.slots : Number.isInteger(t.day) ? [{ day: t.day, time: t.time ?? null }] : [];
  return raw.filter((s) => Number.isInteger(s.day) && s.day >= 0 && s.day <= 6).map((s) => ({ day: s.day, time: s.time || null })).sort((a, b) => a.day - b.day);
}

/** מוסיף את היום אם אין (עם אותה שעה כמו היום הראשון, כדי לחסוך הקלדה), ומסיר אם יש. */
export function toggleDay(t, day) {
  const slots = slotsOf(t);
  if (slots.some((s) => s.day === day)) return { ...t, slots: slots.filter((s) => s.day !== day) };
  return { ...t, slots: [...slots, { day, time: slots[0]?.time ?? null }].sort((a, b) => a.day - b.day) };
}

export const setSlotTime = (t, day, time) => ({ ...t, slots: slotsOf(t).map((s) => (s.day === day ? { ...s, time: time || null } : s)) });

/** שמות התבניות האחרות שמתוזמנות באותו יום (להערת "כבר יש לך אימון ביום הזה"). */
export function clashesOn(others, day) {
  return others.filter((o) => slotsOf(o).some((s) => s.day === day)).map((o) => o.name || '—');
}

export function addExercise(t, exerciseId) {
  if (t.items.some((i) => i.exerciseId === exerciseId)) return t; // כל תרגיל פעם אחת בתבנית
  return { ...t, items: [...t.items, { exerciseId, sets: DEFAULT_SETS }] };
}

export const removeExercise = (t, exerciseId) => ({ ...t, items: t.items.filter((i) => i.exerciseId !== exerciseId) });

/** מזיז תרגיל בסדר: delta = -1 למעלה, +1 למטה. מחוץ לגבולות לא קורה כלום. */
export function moveExercise(t, index, delta) {
  const to = index + delta;
  if (index < 0 || index >= t.items.length || to < 0 || to >= t.items.length) return t;
  const items = [...t.items];
  [items[index], items[to]] = [items[to], items[index]];
  return { ...t, items };
}

export function setSets(t, exerciseId, sets) {
  const n = Math.min(MAX_SETS, Math.max(MIN_SETS, Math.round(sets)));
  return { ...t, items: t.items.map((i) => (i.exerciseId === exerciseId ? { ...i, sets: n } : i)) };
}

export const templateStats = (t) => ({
  exercises: t.items.length,
  sets: t.items.reduce((sum, i) => sum + i.sets, 0),
});

/** "ראשון 18:30 · שלישי 14:00" (יום בלי שעה: רק שם היום). בלי תזמון מחזיר null. */
export function scheduleLabel(t) {
  const parts = slotsOf(t).map((s) => [DAY_NAMES[s.day], s.time].filter(Boolean).join(' '));
  return parts.join(' · ') || null;
}

/** שמות תתי-השרירים של התבנית, בלי כפילויות, לפי סדר הופעה. מעבר ל-max מקצרים ל"+N". */
export function templateSummary(t, exercises, max = 4) {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const subs = [];
  for (const item of t.items) {
    const ex = byId.get(item.exerciseId);
    if (ex && !subs.includes(ex.sub)) subs.push(ex.sub);
  }
  if (subs.length <= max) return subs.map((s) => tr(s)).join(' · ');
  return `${subs.slice(0, max).map((s) => tr(s)).join(' · ')} +${subs.length - max}`;
}

/** null אם התבנית תקינה לשמירה, אחרת 'name' (חסר שם) או 'empty' (אין תרגילים). */
export function validateTemplate(t) {
  if (t.name.trim() === '') return 'name';
  if (t.items.length === 0) return 'empty';
  return null;
}
