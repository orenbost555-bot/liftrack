// גיבוי ושחזור: המרה בין מצב האפליקציה לקובץ JSON, עם בדיקת תקינות לפני שמחליפים נתונים.

export const BACKUP_APP = 'liftrack';

/** עוטף את המצב בקובץ גיבוי עם חותמת זמן. */
export function makeBackup(state, now) {
  return JSON.stringify({ app: BACKUP_APP, exportedAt: now, data: state }, null, 2);
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * בודק קובץ גיבוי. מחזיר { ok: true, data } או { ok: false, error } עם קוד שגיאה:
 * 'json' (לא JSON), 'format' (לא קובץ של האפליקציה), 'shape' (מבנה לא תקין).
 */
export function parseBackup(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { return { ok: false, error: 'json' }; }
  if (!isObj(parsed) || parsed.app !== BACKUP_APP || !isObj(parsed.data)) return { ok: false, error: 'format' };
  const d = parsed.data;
  const lists = ['templates', 'workouts', 'goals', 'customExercises'];
  if (!lists.every((k) => d[k] === undefined || Array.isArray(d[k]))) return { ok: false, error: 'shape' };
  if (d.profile !== null && d.profile !== undefined && (!isObj(d.profile) || typeof d.profile.name !== 'string')) return { ok: false, error: 'shape' };
  if (d.settings !== undefined && !isObj(d.settings)) return { ok: false, error: 'shape' };
  if (d.overrides !== undefined && !isObj(d.overrides)) return { ok: false, error: 'shape' };
  return { ok: true, data: d };
}

export const REST_OPTIONS = [60, 90, 120, 180];
