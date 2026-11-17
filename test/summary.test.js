import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previousWorkout, compareWorkout, motivationFor, streak, weekBucket, formatDate, formatNumber, scheduledStreak, workoutStreak, scheduleOf } from '../js/logic/summary.js';

const DAY = 86400000;
const set = (weight, reps) => ({ weight, reps, rir: null, done: true });
const wk = (id, startedAt, exs, templateId = 't1') => ({
  id, templateId, name: 'A', startedAt, endedAt: startedAt + 3600000,
  exercises: exs.map(([exerciseId, sets, bw = false]) => ({ exerciseId, bw, sets })),
});

const old = wk('old', 1 * DAY, [['flat_press', [set(60, 10)]], ['pec_deck', [set(30, 10)]]]);
const other = wk('other', 2 * DAY, [['squat', [set(100, 5)]]], 't2');

test('previousWorkout: מאותה תבנית בלבד', () => {
  const cur = wk('cur', 5 * DAY, []);
  assert.equal(previousWorkout([old, other], cur).id, 'old');
  assert.equal(previousWorkout([other], cur), null);
  assert.equal(previousWorkout([old, cur], cur).id, 'old');
});

test('compareWorkout: נפח, אחוז ושיפורים לפי תרגיל', () => {
  const cur = wk('cur', 5 * DAY, [['flat_press', [set(60, 12)]], ['pec_deck', [set(30, 8)]], ['pushup', [set(0, 20)], true]]);
  const c = compareWorkout(cur, [old, other]);
  assert.equal(c.volume, 720 + 240);
  assert.equal(c.prevVolume, 600 + 300);
  assert.equal(c.delta, 60);
  assert.equal(c.pct, 6.7);
  assert.equal(c.perExercise.length, 2); // בלי משקל גוף
  assert.equal(c.improvements, 1);
  assert.equal(c.comparable, 2);
});

test('compareWorkout: תרגיל חדש (בלי היסטוריה) לא נספר כשיפור', () => {
  const cur = wk('cur', 5 * DAY, [['flat_press', [set(60, 12)]], ['squat', [set(100, 5)]]]);
  const c = compareWorkout(cur, [old]);
  assert.equal(c.perExercise[1].delta, null);
  assert.equal(c.comparable, 1);
  assert.equal(c.improvements, 1);
});

test('motivationFor: ארבעת המצבים', () => {
  assert.equal(motivationFor({ delta: null }).tone, 'first');
  const all = motivationFor({ delta: 100, comparable: 6, improvements: 6 });
  assert.equal(all.title, 'כל הכבוד! מפה רק עולים למעלה');
  assert.match(all.text, /בכל 6 התרגילים/);
  assert.match(motivationFor({ delta: 100, comparable: 6, improvements: 3 }).text, /3 מתוך 6/);
  assert.equal(motivationFor({ delta: 0, comparable: 2, improvements: 0 }).tone, 'same');
  const down = motivationFor({ delta: -50, comparable: 2, improvements: 0 });
  assert.equal(down.tone, 'down');
  assert.match(down.text, /אולי באת עייף/);
});

test('streak: רצף שבוצע ללא פער של יותר משבוע', () => {
  const h = [wk('a', 0, []), wk('b', 3 * DAY, []), wk('c', 6 * DAY, []), wk('d', 20 * DAY, [])];
  assert.equal(streak(h, 21 * DAY), 1); // הפער בין c ל-d גדול
  assert.equal(streak(h.slice(0, 3), 7 * DAY), 3);
  assert.equal(streak(h.slice(0, 3), 30 * DAY), 0); // יותר משבוע מהאחרון
  assert.equal(streak([], 5), 0);
});

test('weekBucket ותאריכים', () => {
  const wed = new Date(2026, 9, 21, 12).getTime(); // רביעי 21.10.2026
  assert.equal(weekBucket(new Date(2026, 9, 18, 9).getTime(), wed), 'השבוע'); // ראשון
  assert.equal(weekBucket(new Date(2026, 9, 17, 9).getTime(), wed), 'שבוע שעבר'); // שבת
  assert.equal(weekBucket(new Date(2026, 9, 5, 9).getTime(), wed), 'קודם');
  assert.equal(formatDate(new Date(2026, 9, 19).getTime()), 'יום ב׳, 19 באוק׳');
  assert.equal(formatNumber(5915), '5,915');
  assert.equal(formatNumber(72.5), '72.5');
});

// ---- רצף מתוכנן ----
// 2026-10-21 הוא יום רביעי. תבנית X מתוכננת ליום ראשון (0), תבנית Y ליום רביעי (3).
const at = (m, d, h = 18) => new Date(2026, m - 1, d, h).getTime();
const done = (id, templateId, ts) => ({ id, templateId, name: 'x', startedAt: ts, endedAt: ts + 3600000, exercises: [] });
const X = { id: 'X', day: 0, scheduledSince: at(9, 1) };
const Y = { id: 'Y', day: 3, scheduledSince: at(9, 1) };

test('scheduledStreak: סופר אימונים מתוכננים שבוצעו ברצף', () => {
  const h = [done('1', 'X', at(10, 11)), done('2', 'Y', at(10, 14)), done('3', 'X', at(10, 18))];
  assert.equal(scheduledStreak(h, [X, Y], at(10, 19)), 3); // יום שני, הכול בוצע
});

test('scheduledStreak: אימון מתוכנן שלא בוצע מאפס את הרצף', () => {
  // ראשון 11 בוצע, רביעי 14 לא בוצע, ראשון 18 בוצע: רק האחרון נספר
  const h = [done('1', 'X', at(10, 11)), done('3', 'X', at(10, 18))];
  assert.equal(scheduledStreak(h, [X, Y], at(10, 19)), 1);
});

test('scheduledStreak: אימון של היום שעוד לא בוצע לא שובר', () => {
  const h = [done('1', 'X', at(10, 18))];
  assert.equal(scheduledStreak(h, [X, Y], at(10, 21, 7)), 1); // רביעי בבוקר, Y עוד ממתין
  assert.equal(scheduledStreak([...h, done('2', 'Y', at(10, 21, 7))], [X, Y], at(10, 21, 9)), 2);
});

test('scheduledStreak: מחר לא נספר, וימים לפני התחלה לא נחשבים החמצה', () => {
  const h = [done('1', 'Y', at(10, 14))]; // האימון הראשון אי פעם
  assert.equal(scheduledStreak(h, [X, Y], at(10, 15)), 1); // ראשון 11 קדם לאימון הראשון, לא החמצה
  const late = { ...X, scheduledSince: at(10, 15) }; // היום נקבע רק אחרי
  assert.equal(scheduledStreak([done('1', 'X', at(10, 4)), done('2', 'Y', at(10, 7)), done('3', 'Y', at(10, 14))], [late, Y], at(10, 15)), 2);
});

test('scheduledStreak: אימון בתבנית בלי יום קבוע לא משפיע', () => {
  const free = { id: 'F', day: null };
  const h = [done('1', 'X', at(10, 18)), done('2', 'F', at(10, 19))];
  assert.equal(scheduledStreak(h, [X, free], at(10, 19)), 1);
});

test('workoutStreak: בלי לוח אימונים חוזרים לרצף השבועי', () => {
  const h = [done('1', 'F', at(10, 12)), done('2', 'F', at(10, 16))];
  assert.equal(workoutStreak(h, [{ id: 'F', day: null }], at(10, 17)), 2);
  assert.equal(workoutStreak([], [X], at(10, 17)), 0);
});

test('scheduledStreak: שינוי יום לפני שהיום המקורי עבר לא מאפס את הרצף', () => {
  // X היה ביום ראשון ובוצע ב-4/10 וב-11/10. ב-15/10 (חמישי) המתאמן מעביר את X ליום שלישי.
  const moved = { id: 'X', day: 2, schedule: [{ day: 0, since: at(9, 1) }, { day: 2, since: at(10, 15) }] };
  const h = [done('1', 'X', at(10, 4)), done('2', 'X', at(10, 11)), done('3', 'X', at(10, 20))]; // 20/10 הוא יום שלישי
  assert.equal(scheduledStreak(h, [moved], at(10, 21)), 3);
  // בלי האימון בשלישי: ראשון 18/10 כבר לא מתוכנן (עבר לשלישי), אבל שלישי 20/10 הוחמץ ולכן הרצף מתאפס
  assert.equal(scheduledStreak(h.slice(0, 2), [moved], at(10, 21)), 0);
});

test('scheduledStreak: שינוי יום אחרי שהאימון הוחמץ לא מציל את הרצף', () => {
  const late = { id: 'X', day: 3, schedule: [{ day: 0, since: at(9, 1) }, { day: 3, since: at(10, 19) }] };
  // ראשון 18/10 הוחמץ והמתאמן שינה רק ב-19/10
  assert.equal(scheduledStreak([done('1', 'X', at(10, 11))], [late], at(10, 19)), 0);
});

test('scheduleOf: תבנית ישנה בלי schedule', () => {
  assert.deepEqual(scheduleOf({ day: 2, scheduledSince: 5 }), [{ days: [2], since: 5 }]);
  assert.deepEqual(scheduleOf({ day: null }), []);
  assert.deepEqual(scheduleOf({ schedule: [{ day: 1, since: 1 }], day: 1 }), [{ day: 1, since: 1 }]);
});

test('scheduledStreak: תבנית עם כמה ימים בשבוע', () => {
  const T = { id: 'T', schedule: [{ days: [0, 3], since: at(9, 1) }] };
  const h = [done('1', 'T', at(10, 11)), done('2', 'T', at(10, 14))];
  assert.equal(scheduledStreak(h, [T], at(10, 15)), 2);
  assert.equal(scheduledStreak([h[1]], [T], at(10, 15)), 1); // ראשון 11 הוחמץ אך קדם לאימון הראשון
  assert.equal(scheduledStreak([done('x', 'T', at(10, 11))], [T], at(10, 15)), 0); // רביעי 14 הוחמץ
});
