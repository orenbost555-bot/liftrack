import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allExercises, exercisesByMuscle } from '../js/logic/exercises.js';

const all = allExercises();
const ids = (list) => list.map((e) => e.id);

test('allExercises: כל התרגילים בלי כפילויות ועם group ו-sub', () => {
  assert.equal(all.length, 87);
  assert.equal(new Set(ids(all)).size, 87);
  const squat = all.find((e) => e.id === 'squat');
  assert.equal(squat.group, 'legs');
  assert.equal(squat.sub, 'ארבע ראשי');
});

test('exercisesByMuscle: מחזיר תרגילים שהשריר עיקרי בהם', () => {
  const lats = ids(exercisesByMuscle(all, 'lats'));
  assert.ok(lats.includes('pullups'));
  assert.ok(lats.includes('bent_row')); // lats הוא אחד משני העיקריים שלו
  assert.ok(!lats.includes('shrugs'));
});

test('exercisesByMuscle: שריר משני לא נספר', () => {
  // biceps הוא משני בחתירה בהטיית גוף, ולכן היא לא אמורה להופיע
  const biceps = ids(exercisesByMuscle(all, 'biceps'));
  assert.ok(biceps.includes('preacher'));
  assert.ok(!biceps.includes('bent_row'));
});

test('exercisesByMuscle: שריר שלא קיים מחזיר רשימה ריקה', () => {
  assert.deepEqual(exercisesByMuscle(all, 'nope'), []);
});

test('exercisesByMuscle: לא משנה את הרשימה המקורית', () => {
  const before = all.length;
  exercisesByMuscle(all, 'quads');
  assert.equal(all.length, before);
});

import { searchExercises, groupBySub } from '../js/logic/exercises.js';

test('searchExercises: עברית, אנגלית וטקסט ריק', () => {
  assert.ok(ids(searchExercises(all, 'סקוואט')).includes('squat'));
  assert.ok(ids(searchExercises(all, 'bench')).includes('flat_press'));
  assert.ok(ids(searchExercises(all, '  PULL ')).includes('pullups'));
  assert.equal(searchExercises(all, '   ').length, 87);
  assert.deepEqual(searchExercises(all, 'zzzz'), []);
});

test('groupBySub: שומר על הסדר ועל כל התרגילים', () => {
  const groups = groupBySub(all.filter((e) => e.group === 'chest'));
  assert.deepEqual(groups.map((g) => g.name), ['חזה עליון', 'חזה אמצעי', 'חזה תחתון']);
  assert.equal(groups.reduce((n, g) => n + g.ex.length, 0), all.filter((e) => e.group === 'chest').length);
});
