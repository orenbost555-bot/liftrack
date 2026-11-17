import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGoal, validateGoal, evaluateGoal, evaluateAll, currentValue, achievedNote, leftLabel, endOfDay, goalTitle, progressText,
} from '../js/logic/goals.js';
import { allExercises } from '../js/logic/exercises.js';

const all = allExercises();
const DAY = 86400000;
const at = (m, d, h = 18) => new Date(2026, m - 1, d, h).getTime();
const S = (weight, reps) => ({ weight, reps, rir: null, done: true });
const wk = (id, ts, exs) => ({ id, templateId: 't', name: 'A', startedAt: ts - 3600000, endedAt: ts,
  exercises: exs.map(([exerciseId, sets, bw = false]) => ({ exerciseId, bw, sets })) });

// לחיצת חזה: 60 (ספט) -> 72.5 (אוק׳)
const hist = [
  wk('1', at(9, 7), [['flat_press', [S(60, 8)]], ['pushup', [S(0, 10)], true]]),
  wk('2', at(9, 21), [['flat_press', [S(65, 8)]]]),
  wk('3', at(10, 12), [['flat_press', [S(72.5, 8), S(70, 8)]]]),
];
const NOW = at(10, 21, 12); // רביעי

test('newGoal: נקודת התחלה לפי המצב הנוכחי, ומטריקה לפי סוג התרגיל', () => {
  const g = newGoal({ id: 'g', type: 'exercise', exerciseId: 'flat_press', target: 80, deadline: endOfDay(at(12, 15)) }, hist, all, NOW);
  assert.deepEqual([g.start, g.metric, g.createdAt, g.achievedAt], [72.5, 'weight', NOW, null]);
  const bw = newGoal({ id: 'b', type: 'exercise', exerciseId: 'pushup', target: 15, deadline: endOfDay(at(12, 15)) }, hist, all, NOW);
  assert.deepEqual([bw.start, bw.metric], [10, 'reps']);
});

test('התקדמות באחוזים נמדדת מנקודת ההתחלה (ולא מאפס)', () => {
  // נוצר כשהמקסימום היה 60, יעד 80, עכשיו 72.5 -> 62%
  const g = { id: 'g', type: 'exercise', exerciseId: 'flat_press', metric: 'weight', start: 60, target: 80, createdAt: at(9, 1), deadline: endOfDay(at(12, 15)), achievedAt: null };
  const ev = evaluateGoal(g, hist, all, NOW);
  assert.equal(ev.current, 72.5);
  assert.equal(ev.pct, 62);
  assert.equal(ev.achievedAt, null);
});

test('סטטוס לפי הזמן שעבר מול ההתקדמות', () => {
  const base = { id: 'g', type: 'exercise', exerciseId: 'flat_press', metric: 'weight', start: 60, target: 80, achievedAt: null };
  // 62% התקדמות, ~40% מהזמן עבר -> בקצב
  assert.equal(evaluateGoal({ ...base, createdAt: at(9, 20), deadline: endOfDay(at(12, 31)) }, hist, all, NOW).status, 'ontrack');
  // 62% התקדמות, כמעט כל הזמן עבר -> בפיגור קל
  assert.equal(evaluateGoal({ ...base, createdAt: at(9, 1), deadline: endOfDay(at(10, 25)) }, hist, all, NOW).status, 'slightly');
  // 62% התקדמות, כל הזמן עבר כמעט (חצי שעה לפני המועד) ובהתחלה היה יעד גבוה -> בפיגור
  assert.equal(evaluateGoal({ ...base, target: 100, createdAt: at(9, 1), deadline: endOfDay(at(10, 25)) }, hist, all, NOW).status, 'behind');
  // עבר המועד
  assert.equal(evaluateGoal({ ...base, createdAt: at(8, 1), deadline: endOfDay(at(10, 1)) }, hist, all, NOW).status, 'overdue');
});

test('הושג: מזהה את האימון הראשון שהגיע ליעד, ושומר אותו', () => {
  const g = { id: 'g', type: 'exercise', exerciseId: 'flat_press', metric: 'weight', start: 60, target: 70, createdAt: at(9, 1), deadline: endOfDay(at(10, 26)), achievedAt: null };
  const ev = evaluateGoal(g, hist, all, NOW);
  assert.equal(ev.status, 'achieved');
  assert.equal(ev.achievedAt, at(10, 12));
  assert.equal(ev.pct, 100);
  const r = evaluateAll([g], hist, all, NOW);
  assert.equal(r.goals[0].achievedAt, at(10, 12));
  assert.equal(r.newlyAchieved.length, 1);
  assert.equal(evaluateAll(r.goals, hist, all, NOW).newlyAchieved.length, 0); // כבר נשמר
  // שנשמר אחרי שנמחק האימון, נשאר הושג
  assert.equal(evaluateGoal(r.goals[0], [], all, NOW).status, 'achieved');
});

test('יעד שהושג לפני יצירתו לא נחשב (חייב להיות מעל המצב הנוכחי)', () => {
  const low = { id: 'g', type: 'exercise', exerciseId: 'flat_press', target: 70, deadline: endOfDay(at(12, 1)) };
  assert.equal(validateGoal(low, hist, all, NOW), 'reached');
  assert.equal(validateGoal({ ...low, target: 80 }, hist, all, NOW), null);
  assert.equal(validateGoal({ ...low, target: 0 }, hist, all, NOW), 'target');
  assert.equal(validateGoal({ ...low, target: 80, deadline: at(10, 1) }, hist, all, NOW), 'deadline');
  assert.equal(validateGoal({ ...low, target: 80, exerciseId: 'nope' }, hist, all, NOW), 'exercise');
  assert.equal(validateGoal({ id: 'w', type: 'weekly', target: 4 }, hist, all, NOW), null);
  assert.equal(validateGoal({ id: 'w', type: 'weekly', target: 9 }, hist, all, NOW), 'target');
});

test('יעד נפח: האימון הכי גדול, והושג באימון שעבר את היעד', () => {
  assert.equal(currentValue({ type: 'volume' }, hist, all, NOW), 72.5 * 8 + 70 * 8);
  const g = newGoal({ id: 'v', type: 'volume', target: 1000, deadline: endOfDay(at(12, 1)) }, hist.slice(0, 2), all, at(9, 22));
  assert.equal(g.start, 520);
  assert.equal(evaluateGoal(g, hist, all, NOW).achievedAt, at(10, 12));
});

test('יעד שריר: לפי אחוז ההתקדמות של הקבוצה', () => {
  const g = newGoal({ id: 'm', type: 'muscle', group: 'chest', target: 15, deadline: endOfDay(at(12, 1)) }, hist.slice(0, 1), all, at(9, 8));
  assert.equal(g.start, 0);
  const ev = evaluateGoal(g, hist, all, NOW);
  assert.equal(ev.current, 20.8);
  assert.equal(ev.status, 'achieved');
});

test('יעד שבועי: בקצב, בפיגור קל, בפיגור והושג השבוע', () => {
  const g = { id: 'w', type: 'weekly', target: 4, createdAt: 0, start: 0, deadline: null, achievedAt: null };
  const inWeek = (...days) => days.map((d, i) => wk('x' + i, at(10, d), [['flat_press', [S(60, 8)]]]));
  // רביעי 21/10: ראשון 18 = היום הראשון של השבוע
  assert.equal(evaluateGoal(g, inWeek(18, 20), all, NOW).status, 'ontrack');      // 2 מתוך 4, צפוי 1
  assert.equal(evaluateGoal(g, inWeek(20), all, NOW).status, 'ontrack');           // 1, צפוי 1
  assert.equal(evaluateGoal(g, [], all, NOW).status, 'slightly');                  // 0, צפוי 1, אבל עוד אפשרי (4 ימים נשארו)
  assert.equal(evaluateGoal(g, [], all, at(10, 23, 12)).status, 'behind');         // שישי: 0 מתוך 4, נשאר יום אחד ושבת
  assert.equal(evaluateGoal(g, inWeek(18, 19, 20, 21), all, NOW).status, 'weekdone');
  assert.equal(evaluateGoal(g, inWeek(18, 20), all, NOW).pct, 50);
  assert.equal(evaluateGoal(g, [wk('old', at(10, 15), [])], all, NOW).current, 0); // אימון משבוע שעבר לא נספר
});

test('טקסטים: achievedNote ו-leftLabel', () => {
  const dl = at(12, 15);
  assert.equal(achievedNote({ deadline: dl, achievedAt: dl - 15 * DAY }), '2 שבועות לפני המועד');
  assert.equal(achievedNote({ deadline: dl, achievedAt: dl - 8 * DAY }), 'שבוע לפני המועד');
  assert.equal(achievedNote({ deadline: dl, achievedAt: dl - 2 * DAY }), 'בזמן');
  assert.equal(achievedNote({ deadline: dl, achievedAt: dl + 3 * DAY }), 'באיחור של 3 ימים');
  assert.equal(achievedNote({ deadline: null, achievedAt: 1 }), '');
  assert.equal(leftLabel({ weeks: 8, days: 56 }), 'עוד 8 שבועות');
  assert.equal(leftLabel({ weeks: 1, days: 7 }), 'עוד שבוע');
  assert.equal(leftLabel({ weeks: 1, days: 3 }), 'עוד 3 ימים');
  assert.equal(leftLabel({ weeks: 1, days: 1 }), 'עוד יום');
  assert.equal(leftLabel({ weeks: 0, days: 0 }), 'היום');
  assert.equal(leftLabel(null), '');
});

test('goalTitle ו-progressText', () => {
  const ex = { id: 'x', type: 'exercise', exerciseId: 'flat_press', metric: 'weight', target: 80, start: 60 };
  assert.equal(goalTitle(ex, all, 'ק״ג'), 'לחיצת חזה בשכיבה: 80 ק״ג');
  assert.equal(goalTitle({ ...ex, exerciseId: 'pushup', metric: 'reps', target: 15 }, all, 'ק״ג'), 'שכיבות סמיכה קלאסיות: 15 חזרות');
  assert.equal(goalTitle({ type: 'muscle', group: 'chest', target: 20 }, all, 'ק״ג'), 'חזה: +20%');
  assert.equal(goalTitle({ type: 'volume', target: 6000 }, all, 'ק״ג'), 'נפח באימון: 6,000 ק״ג');
  assert.equal(goalTitle({ type: 'weekly', target: 4 }, all, 'ק״ג'), '4 אימונים בשבוע');
  assert.equal(progressText({ goal: ex, current: 72.5, pct: 62 }, 'ק״ג'), '72.5 מתוך 80 ק״ג · 62%');
  assert.equal(progressText({ goal: { type: 'muscle', target: 20 }, current: 14, pct: 70 }, 'ק״ג'), '14% מתוך 20% · 70%');
  assert.equal(progressText({ goal: { type: 'weekly', target: 4 }, current: 3, pct: 75 }, 'ק״ג'), '3 מתוך 4 השבוע');
});
