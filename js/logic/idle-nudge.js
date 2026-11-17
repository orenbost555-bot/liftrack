// התראת "חזור לאימון": אם באימון פעיל לא הוזן שום סט תוך X דקות, נשלחת התראה (דרך אותו Worker של התזכורות).
// כאן רק החישוב (פונקציה טהורה): מתי ההתראה צריכה להישלח.

export const NUDGE_OPTIONS = [0, 10, 15, 20, 30, 45]; // 0 = כבוי. ה-Worker בודק כל 5 דקות, לכן מתחילים מ-10

/** זמן הפעילות האחרונה באימון: הזנת סט, סימון סט, הוספת/הסרת סט או תרגיל. אם עוד לא הייתה, תחילת האימון. */
export const lastActivity = (active) => active.lastActivityAt ?? active.startedAt;

/** מתי לשלוח (מילישניות), או null אם אין אימון פעיל או שהאפשרות כבויה. */
export function nudgeAt(active, minutes) {
  if (!active || !Number.isFinite(minutes) || minutes <= 0) return null;
  return lastActivity(active) + minutes * 60000;
}
