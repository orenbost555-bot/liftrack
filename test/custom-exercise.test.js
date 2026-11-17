import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allExercises, setCustomExercises, homeOf } from '../js/logic/exercises.js';
import { parseBackup } from '../js/logic/backup.js';
import {
  emptyDraft, buildExercise, toggleMuscle, validateExercise, takenNames, usageOf, withoutExercise,
} from '../js/logic/custom-exercise.js';

test('buildExercise: מנקה רווחים, כפילויות ושרירים לא מוכרים; עיקרי לא נשאר משני', () => {
  const ex = buildExercise({ he: '  סקוואט   בולגרי ', en: 'Bulgarian', p: ['quads', 'quads', 'zzz'], sec: ['quads', 'glutes'], bw: 1 }, 'c_1');
  assert.deepEqual(ex, { id: 'c_1', he: 'סקוואט בולגרי', en: 'Bulgarian', p: ['quads'], sec: ['glutes'], bw: true });
});

test('toggleMuscle: בחירה ברשימה אחת מוציאה מהשנייה, ולחיצה חוזרת מבטלת', () => {
  let d = emptyDraft();
  d = toggleMuscle(d, 'sec', 'glutes');
  d = toggleMuscle(d, 'p', 'glutes');
  assert.deepEqual([d.p, d.sec], [['glutes'], []]);
  d = toggleMuscle(d, 'p', 'glutes');
  assert.deepEqual(d.p, []);
});

test('validateExercise: שם, שריר עיקרי וכפילות', () => {
  const taken = new Set(['squat']);
  assert.equal(validateExercise({ he: ' ', en: '', p: ['quads'] }, taken), 'name');
  assert.equal(validateExercise({ he: 'א', en: '', p: [] }, taken), 'main');
  assert.equal(validateExercise({ he: '', en: 'SQUAT', p: ['quads'] }, taken), 'dup');
  assert.equal(validateExercise({ he: '', en: 'Lunge walk', p: ['quads'] }, taken), null);
});

test('takenNames: כולל שמות בשתי השפות ומתעלם מהתרגיל שעורכים', () => {
  const t = takenNames([{ id: 'squat', he: 'סקוואט', en: 'Squat · חזק' }], [{ id: 'c_1', he: 'א', en: 'B' }, { id: 'c_2', he: 'ג', en: 'D' }], { squat: 'Back squat' }, 'c_2');
  assert.deepEqual([...t].sort(), ['b', 'back squat', 'squat', 'סקוואט', 'א'].sort());
});

test('allExercises: תרגיל אישי נכנס לתת-השריר של השריר העיקרי הראשון, בסוף הרשימה שלו', () => {
  const base = allExercises().length;
  setCustomExercises([{ id: 'c_1', he: 'סקוואט בולגרי', en: 'Bulgarian split squat', p: ['quads', 'glutes'], sec: [], bw: false }]);
  const all = allExercises();
  assert.equal(all.length, base + 1);
  const mine = all.find((e) => e.id === 'c_1');
  assert.equal(mine.group, 'legs');
  assert.equal(mine.sub, 'ארבע ראשי');
  assert.equal(mine.custom, true);
  assert.equal(mine.he, 'סקוואט בולגרי');
  assert.equal(mine.en, 'Bulgarian split squat');
  const inSub = all.filter((e) => e.sub === 'ארבע ראשי');
  assert.equal(inSub.at(-1).id, 'c_1');
  setCustomExercises([]);
  assert.equal(allExercises().length, base);
});

test('allExercises: שם בשפה אחת בלבד מוצג בשתי השפות', () => {
  setCustomExercises([{ id: 'c_2', he: 'משיכה מיוחדת', en: '', p: ['lats'], sec: [], bw: true }]);
  const e = allExercises().find((x) => x.id === 'c_2');
  assert.equal(e.he, 'משיכה מיוחדת');
  assert.equal(e.en, '');
  setCustomExercises([]);
});

test('homeOf: כל שריר מקבל מקום בספרייה', () => {
  for (const m of ['chestUpper', 'traps', 'erectors', 'rectus', 'forearms', 'calves']) assert.ok(homeOf(m), m);
});

test('usageOf ו-withoutExercise', () => {
  const templates = [{ id: 't1', items: [{ exerciseId: 'c_1', sets: 3 }, { exerciseId: 'squat', sets: 3 }] }, { id: 't2', items: [{ exerciseId: 'squat', sets: 3 }] }];
  const workouts = [{ exercises: [{ exerciseId: 'c_1' }] }, { exercises: [{ exerciseId: 'squat' }] }];
  assert.deepEqual(usageOf('c_1', templates, workouts), { templates: 1, workouts: 1 });
  const next = withoutExercise(templates, 'c_1');
  assert.deepEqual(next[0].items.map((i) => i.exerciseId), ['squat']);
  assert.equal(next[1], templates[1]);
});

test('parseBackup: customExercises חייב להיות מערך', () => {
  const wrap = (data) => JSON.stringify({ app: 'liftrack', data });
  assert.equal(parseBackup(wrap({ customExercises: [] })).ok, true);
  assert.equal(parseBackup(wrap({ customExercises: {} })).error, 'shape');
});
