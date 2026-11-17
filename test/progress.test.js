import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  exerciseSeries, filterRange, seriesStats, exerciseStatus, muscleSeries, weekStats, trainedExercises, niceTicks, metricValue,
} from '../js/logic/progress.js';

const DAY = 86400000;
const set = (weight, reps) => ({ weight, reps, rir: null, done: true });
const wk = (id, day, exs) => ({
  id, templateId: 't', name: 'A', startedAt: day * DAY, endedAt: day * DAY + 3600000,
  exercises: exs.map(([exerciseId, sets, bw = false]) => ({ exerciseId, bw, sets })),
});
// לחיצת חזה: 60x10, 62.5x8, 62.5x8 (אין שיפור), 62.5x9 (יותר חזרות), 60x10 (ירידה), 65x6
const H = [
  wk('a', 1, [['flat_press', [set(60, 10)]]]),
  wk('b', 8, [['flat_press', [set(62.5, 8), set(60, 10)]]]),
  wk('c', 15, [['flat_press', [set(62.5, 8)]]]),
  wk('d', 22, [['flat_press', [set(62.5, 9)]]]),
  wk('e', 29, [['flat_press', [set(60, 10)]]]),
  wk('f', 36, [['flat_press', [set(65, 6)]]]),
];

test('exerciseSeries: הסט הטוב ביותר, מהישן לחדש, ושיפורים לפי משקל ואז חזרות', () => {
  const s = exerciseSeries([...H].reverse(), 'flat_press'); // סדר הקלט לא משנה
  assert.deepEqual(s.map((p) => [p.weight, p.reps]), [[60, 10], [62.5, 8], [62.5, 8], [62.5, 9], [60, 10], [65, 6]]);
  assert.deepEqual(s.map((p) => p.improvedWeight), [false, true, false, true, false, true]);
  assert.equal(s[0].first, true);
});

test('exerciseSeries: שיפור בחזרות לפי maxReps, ואימונים בלי התרגיל לא נספרים', () => {
  const s = exerciseSeries([...H, wk('x', 40, [['squat', [set(100, 5)]]])], 'flat_press');
  assert.equal(s.length, 6);
  assert.deepEqual(s.map((p) => p.maxReps), [10, 10, 8, 9, 10, 6]);
  assert.deepEqual(s.map((p) => p.improvedReps), [false, false, false, false, false, false]);
  assert.deepEqual(exerciseSeries(H, 'nope'), []);
});

test('exerciseSeries: תיקון ידני של המתאמן', () => {
  const s = exerciseSeries(H, 'flat_press', { 'b:flat_press:weight': false, 'c:flat_press:weight': true });
  assert.equal(s[1].improvedWeight, false);
  assert.equal(s[2].improvedWeight, true);
});

test('seriesStats: עלייה מהפתיחה, אחוזים ושיא', () => {
  const st = seriesStats(exerciseSeries(H, 'flat_press'));
  assert.deepEqual([st.first, st.best, st.gain, st.pct], [60, 65, 5, 8.3]);
  assert.deepEqual(st.pr, { weight: 65, reps: 6, t: 36 * DAY + 3600000 });
  assert.equal(seriesStats([]), null);
  assert.equal(seriesStats(exerciseSeries(H, 'flat_press'), 'reps').best, 10);
});

test('exerciseStatus: שיפור / מגמת שיפור / קיפאון / מעט נתונים', () => {
  const s = exerciseSeries(H, 'flat_press');
  assert.equal(exerciseStatus(s), 'improving');          // האחרון שיפור
  assert.equal(exerciseStatus(s.slice(0, 4)), 'improving');
  assert.equal(exerciseStatus(s.slice(0, 5)), 'trend');  // השיפור היה לפני אימון אחד
  assert.equal(exerciseStatus(s.slice(0, 3)), 'trend');  // שיפור באימון b
  assert.equal(exerciseStatus(s.slice(0, 2)), 'improving');
  assert.equal(exerciseStatus(s.slice(0, 1)), 'new');
  const flat = exerciseSeries([wk('1', 1, [['pec_deck', [set(30, 10)]]]), wk('2', 8, [['pec_deck', [set(30, 10)]]]), wk('3', 15, [['pec_deck', [set(30, 10)]]]), wk('4', 22, [['pec_deck', [set(30, 10)]]])], 'pec_deck');
  assert.equal(exerciseStatus(flat), 'stagnant');
  assert.equal(exerciseStatus(flat.slice(0, 2)), 'new');
  assert.equal(exerciseStatus([]), 'new');
});

test('filterRange', () => {
  const s = exerciseSeries(H, 'flat_press');
  const now = 37 * DAY;
  assert.equal(filterRange(s, 'month', now).length, 5);
  assert.equal(filterRange(s, 'quarter', now).length, 6);
  assert.equal(filterRange(s, 'all', 1000 * DAY).length, 6);
});

test('muscleSeries: ממוצע האחוזים של התרגילים התורמים', () => {
  const hist = [
    wk('1', 1, [['flat_press', [set(60, 10)]], ['pec_deck', [set(20, 10)]], ['pushup', [set(0, 20)], true]]),
    wk('2', 8, [['flat_press', [set(66, 10)]], ['pec_deck', [set(20, 10)]]]),   // +10% , 0%
    wk('3', 15, [['flat_press', [set(72, 10)]], ['pec_deck', [set(25, 10)]]]),  // +20% , +25%
  ];
  const m = muscleSeries(hist, ['flat_press', 'pec_deck', 'pushup']);
  assert.equal(m.count, 2); // משקל גוף ותרגילים בלי נקודה שנייה לא נספרים
  assert.deepEqual(m.points.map((p) => p.v), [5, 22.5]);
  assert.equal(m.pct, 22.5);
  assert.deepEqual(muscleSeries(hist, ['squat']), { points: [], pct: null, count: 0 });
});

test('weekStats: סטים ואימונים מתחילת השבוע', () => {
  const wed = new Date(2026, 9, 21, 12).getTime();
  const mk = (id, d, h = 18) => { const t = new Date(2026, 9, d, h).getTime(); return { id, templateId: 't', name: 'A', startedAt: t, endedAt: t + 3600000, exercises: [{ exerciseId: 'flat_press', bw: false, sets: [set(60, 10), set(60, 10)] }, { exerciseId: 'squat', bw: false, sets: [set(80, 5)] }] }; };
  const hist = [mk('old', 17), mk('sun', 18), mk('tue', 20)];
  assert.deepEqual(weekStats(hist, ['flat_press'], wed), { sets: 4, workouts: 2 });
  assert.deepEqual(weekStats(hist, ['flat_press', 'squat'], wed), { sets: 6, workouts: 2 });
  assert.deepEqual(weekStats(hist, ['deadlift'], wed), { sets: 0, workouts: 0 });
});

test('trainedExercises: מהאחרון לראשון, עם ספירת אימונים', () => {
  const t = trainedExercises([
    wk('1', 1, [['flat_press', [set(60, 10)]]]),
    wk('2', 8, [['flat_press', [set(60, 10)]]]),
    wk('3', 15, [['squat', [set(60, 10)]]]),
  ]);
  assert.deepEqual(t.map((x) => [x.exerciseId, x.count]), [['squat', 1], ['flat_press', 2]]);
});

test('metricValue', () => {
  assert.equal(metricValue({ weight: 5, maxReps: 9 }, 'reps'), 9);
  assert.equal(metricValue({ weight: 5, maxReps: 9 }, 'weight'), 5);
});

test('niceTicks: קפיצות עגולות שמכסות את הטווח', () => {
  const t = niceTicks(60, 72.5, 3);
  assert.ok(t[0] <= 60 && t.at(-1) >= 72.5);
  assert.ok(t.length >= 2 && t.length <= 8);
  assert.deepEqual(niceTicks(0, 100, 4), [0, 25, 50, 75, 100]);
  const flat = niceTicks(10, 10, 3);
  assert.ok(flat[0] < 10 && flat.at(-1) > 10);
});
