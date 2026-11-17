// יעדים: חישוב התקדמות, סטטוס וזיהוי השגה. פונקציות טהורות, בלי DOM ובלי localStorage.
//
// יעד: { id, type, createdAt, start, target, deadline, achievedAt, ...פרטי סוג }
//   'exercise': { exerciseId, metric: 'weight' | 'reps' }  יעד משקל (או חזרות בתרגיל משקל גוף)
//   'muscle':   { group }                                   אחוז התקדמות כולל בשריר (כמו בגרף השריר)
//   'volume':   {}                                          נפח באימון בודד
//   'weekly':   {}                                          מספר אימונים בשבוע (יעד קבוע, בלי מועד)
//   start = הערך ברגע יצירת היעד, ממנו נמדדת ההתקדמות באחוזים.
//   deadline = סוף היום (ms). achievedAt = מתי הושג (נקבע פעם אחת ונשמר).
import { exerciseSeries, metricValue, muscleSeries } from './progress.js';
import { workoutVolume } from './workout.js';
import { formatNumber } from './summary.js';
import { LIBRARY } from '../data/exercises.js';
import { tr } from '../i18n.js';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

export const GOAL_TYPES = [
  { id: 'exercise', label: tr('תרגיל') },
  { id: 'muscle', label: tr('שריר') },
  { id: 'volume', label: tr('נפח אימון') },
  { id: 'weekly', label: tr('אימונים בשבוע') },
];

const finished = (history) => history.filter((w) => w.endedAt !== null);
const weekStart = (now) => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d.getTime(); };
export const endOfDay = (ts) => { const d = new Date(ts); d.setHours(23, 59, 59, 999); return d.getTime(); };

/** הערך הנוכחי של יעד (לפי כל ההיסטוריה). */
export function currentValue(goal, history, exercises, now) {
  const done = finished(history);
  if (goal.type === 'exercise') {
    const s = exerciseSeries(done, goal.exerciseId);
    return s.length ? Math.max(...s.map((p) => metricValue(p, goal.metric))) : 0;
  }
  if (goal.type === 'muscle') {
    return muscleSeries(done, exercises.filter((e) => e.group === goal.group).map((e) => e.id)).pct ?? 0;
  }
  if (goal.type === 'volume') return done.length ? Math.max(...done.map(workoutVolume)) : 0;
  return done.filter((w) => w.endedAt >= weekStart(now)).length; // weekly
}

/** יוצר יעד חדש: קובע את נקודת ההתחלה לפי המצב הנוכחי. */
export function newGoal(input, history, exercises, now) {
  const goal = { achievedAt: null, deadline: null, ...input, createdAt: now };
  if (goal.type === 'exercise') goal.metric = exercises.find((e) => e.id === goal.exerciseId)?.bw ? 'reps' : 'weight';
  goal.start = goal.type === 'weekly' ? 0 : currentValue(goal, history, exercises, now);
  return goal;
}

/** התנאי להצלחת יצירה: היעד חייב להיות מעל המצב הנוכחי. מחזיר null או קוד שגיאה. */
export function validateGoal(goal, history, exercises, now) {
  if (!(goal.target > 0)) return 'target';
  if (goal.type === 'weekly') return goal.target > 7 ? 'target' : null;
  if (goal.deadline === null || goal.deadline < now) return 'deadline';
  if (goal.type === 'exercise' && !exercises.some((e) => e.id === goal.exerciseId)) return 'exercise';
  if (goal.type === 'muscle' && !exercises.some((e) => e.group === goal.group)) return 'group';
  return goal.target <= currentValue(goal, history, exercises, now) ? 'reached' : null;
}

/** מתי היעד הושג לראשונה (אחרי יצירתו), או null. */
function findAchievedAt(goal, history, exercises) {
  const done = finished(history);
  if (goal.type === 'exercise') {
    return exerciseSeries(done, goal.exerciseId).find((p) => p.t >= goal.createdAt && metricValue(p, goal.metric) >= goal.target)?.t ?? null;
  }
  if (goal.type === 'muscle') {
    const ids = exercises.filter((e) => e.group === goal.group).map((e) => e.id);
    return muscleSeries(done, ids).points.find((p) => p.t >= goal.createdAt && p.v >= goal.target)?.t ?? null;
  }
  if (goal.type === 'volume') {
    return done.filter((w) => w.endedAt >= goal.createdAt && workoutVolume(w) >= goal.target)
      .sort((a, b) => a.endedAt - b.endedAt)[0]?.endedAt ?? null;
  }
  return null;
}

const clampPct = (n) => Math.max(0, Math.min(100, Math.floor(n)));

/**
 * מצב מלא של יעד: { goal, current, pct, status, achievedAt, left }
 * status: 'achieved' | 'ontrack' (בקצב) | 'slightly' (בפיגור קל) | 'behind' (בפיגור) | 'overdue' (עבר המועד) | 'weekdone'
 * left: { weeks, days } עד המועד (null ביעד קבוע או כשהושג).
 */
export function evaluateGoal(goal, history, exercises, now) {
  const current = currentValue(goal, history, exercises, now);
  if (goal.type === 'weekly') {
    const day = new Date(now).getDay();
    const needed = goal.target - current;
    const expected = Math.floor((goal.target * day) / 7);
    const status = needed <= 0 ? 'weekdone' : needed > 7 - day ? 'behind' : current >= expected ? 'ontrack' : 'slightly';
    return { goal, current, pct: clampPct((current / goal.target) * 100), status, achievedAt: null, left: null };
  }
  const achievedAt = goal.achievedAt ?? findAchievedAt(goal, history, exercises);
  const span = goal.target - goal.start;
  const pct = achievedAt !== null ? 100 : clampPct(span > 0 ? ((current - goal.start) / span) * 100 : 0);
  const msLeft = goal.deadline - now;
  const left = achievedAt !== null ? null : { weeks: Math.max(0, Math.ceil(msLeft / WEEK)), days: Math.max(0, Math.ceil(msLeft / DAY)) };
  let status;
  if (achievedAt !== null) status = 'achieved';
  else if (msLeft < 0) status = 'overdue';
  else {
    // כמה אחוזים מהדרך "היו אמורים" להיעשות לפי הזמן שעבר, מול מה שבוצע בפועל
    const elapsed = Math.min(1, Math.max(0, (now - goal.createdAt) / (goal.deadline - goal.createdAt))) * 100;
    const gap = elapsed - pct;
    status = gap <= 10 ? 'ontrack' : gap <= 30 ? 'slightly' : 'behind';
  }
  return { goal, current, pct, status, achievedAt, left };
}

/** מעריך את כל היעדים. מחזיר { items, goals (עם achievedAt שנקבע), newlyAchieved }. */
export function evaluateAll(goals, history, exercises, now) {
  const items = goals.map((g) => evaluateGoal(g, history, exercises, now));
  const updated = items.map((it) => (it.achievedAt !== null && it.goal.achievedAt === null ? { ...it.goal, achievedAt: it.achievedAt } : it.goal));
  return { items, goals: updated, newlyAchieved: updated.filter((g, i) => g !== items[i].goal) };
}

/** "2 שבועות לפני המועד" / "בזמן" / "באיחור של 3 ימים" */
export function achievedNote(goal) {
  if (goal.deadline === null || goal.deadline === undefined) return '';
  const diff = goal.deadline - goal.achievedAt;
  if (diff < 0) { const d = Math.ceil(-diff / DAY); return d === 1 ? tr('באיחור של יום') : tr('באיחור של {n} ימים', { n: d }); }
  const weeks = Math.floor(diff / WEEK);
  if (weeks === 0) return tr('בזמן');
  return weeks === 1 ? tr('שבוע לפני המועד') : tr('{n} שבועות לפני המועד', { n: weeks });
}

/** "עוד 8 שבועות" / "עוד 3 ימים" / "היום" */
export function leftLabel(left) {
  if (!left) return '';
  if (left.days === 0) return tr('היום');
  if (left.days < 7) return left.days === 1 ? tr('עוד יום') : tr('עוד {n} ימים', { n: left.days });
  return left.weeks === 1 ? tr('עוד שבוע') : tr('עוד {n} שבועות', { n: left.weeks });
}

/** כותרת היעד: "לחיצת חזה: 80 ק״ג" */
export function goalTitle(goal, exercises, unit) {
  if (goal.type === 'exercise') {
    const name = exercises.find((e) => e.id === goal.exerciseId)?.he ?? goal.exerciseId;
    return `${name}: ${formatNumber(goal.target)} ${goal.metric === 'reps' ? tr('חזרות') : unit}`;
  }
  if (goal.type === 'muscle') return `${tr(LIBRARY.find((g) => g.id === goal.group)?.name ?? goal.group)}: +${formatNumber(goal.target)}%`;
  if (goal.type === 'volume') return tr('נפח באימון: {v}', { v: `${formatNumber(goal.target)} ${unit}` });
  return tr('{n} אימונים בשבוע', { n: goal.target });
}

/** שורת ההתקדמות: "72.5 מתוך 80 ק״ג · 62%" */
export function progressText(item, unit) {
  const { goal, current, pct } = item;
  if (goal.type === 'weekly') return tr('{cur} מתוך {target} השבוע', { cur: current, target: goal.target });
  const u = goal.type === 'muscle' ? '%' : goal.type === 'exercise' && goal.metric === 'reps' ? ` ${tr('חזרות')}` : ` ${unit}`;
  const cur = goal.type === 'muscle' ? `${formatNumber(current)}%` : formatNumber(current);
  return tr('{cur} מתוך {target}{u} · {pct}%', { cur, target: formatNumber(goal.target), u, pct });
}
