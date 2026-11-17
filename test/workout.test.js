import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  startWorkout, parseNum, setField, addSet, removeSet, replaceExercise, addExerciseToWorkout,
  toggleSet, exerciseVolume, workoutVolume, doneSetCount, canFinish, finishWorkout, durationMinutes,
  previousSets, suggestIncrease, applySuggestion, bestSet,
} from '../js/logic/workout.js';
import { allExercises } from '../js/logic/exercises.js';
import { newTemplate, addExercise } from '../js/logic/templates.js';

const all = allExercises();
const tpl = () => addExercise(addExercise({ ...newTemplate('t1'), name: 'יום A' }, 'flat_press'), 'pushup');
const fresh = () => startWorkout({ template: tpl(), id: 'w1', now: 1000, exercises: all });
const doSet = (w, ex, set, weight, reps, rir = null) => {
  let x = setField(w, ex, set, 'weight', weight);
  x = setField(x, ex, set, 'reps', reps);
  x = setField(x, ex, set, 'rir', rir);
  return toggleSet(x, ex, set, null).workout;
};

test('startWorkout: סטים ריקים לפי התבנית, ומסמן משקל גוף', () => {
  const w = fresh();
  assert.equal(w.exercises.length, 2);
  assert.equal(w.exercises[0].sets.length, 3);
  assert.equal(w.exercises[0].bw, false);
  assert.equal(w.exercises[1].bw, true);
  assert.equal(w.endedAt, null);
});

test('parseNum: פסיק, רווחים, ריק ושלילי', () => {
  assert.equal(parseNum('72,5'), 72.5);
  assert.equal(parseNum(' 70 '), 70);
  assert.equal(parseNum(''), null);
  assert.equal(parseNum('abc'), null);
  assert.equal(parseNum('-5'), null);
  assert.equal(parseNum(0), 0);
});

test('toggleSet: דורש חזרות ומשקל, ומתמלא מהאימון הקודם', () => {
  const w = fresh();
  assert.equal(toggleSet(w, 0, 0, null).error, 'reps');
  assert.equal(toggleSet(setField(w, 0, 0, 'reps', 8), 0, 0, null).error, 'weight');
  const r = toggleSet(w, 0, 0, { weight: 60, reps: 10 });
  assert.equal(r.error, null);
  assert.deepEqual(r.workout.exercises[0].sets[0], { weight: 60, reps: 10, rir: null, done: true });
  // ביטול
  assert.equal(toggleSet(r.workout, 0, 0, null).workout.exercises[0].sets[0].done, false);
  // משקל גוף: מספיק חזרות
  assert.equal(toggleSet(setField(w, 1, 0, 'reps', 12), 1, 0, null).error, null);
});

test('נפח: משקל × חזרות לסטים שבוצעו בלבד, בלי משקל גוף', () => {
  let w = fresh();
  w = doSet(w, 0, 0, 60, 10);
  w = doSet(w, 0, 1, 70, 8);
  w = setField(w, 0, 2, 'weight', 100); // לא בוצע
  w = doSet(w, 1, 0, 0, 20); // שכיבות סמיכה
  assert.equal(exerciseVolume(w.exercises[0]), 1160);
  assert.equal(exerciseVolume(w.exercises[1]), 0);
  assert.equal(workoutVolume(w), 1160);
  assert.equal(doneSetCount(w), 3);
});

test('addSet / removeSet / replaceExercise / addExerciseToWorkout', () => {
  let w = fresh();
  assert.equal(addSet(w, 0).exercises[0].sets.length, 4);
  assert.equal(removeSet(w, 0, 0).exercises[0].sets.length, 2);
  const one = replaceExercise(removeSet(removeSet(w, 0, 0), 0, 0), 0, { id: 'x', bw: false });
  assert.equal(one.exercises[0].sets.length, 1);
  assert.equal(removeSet(one, 0, 0).exercises[0].sets.length, 1); // לא מורידים את הסט האחרון
  const swapped = replaceExercise(w, 0, { id: 'pec_deck', bw: false });
  assert.equal(swapped.exercises[0].exerciseId, 'pec_deck');
  assert.equal(swapped.exercises[0].sets.length, 3);
  assert.equal(addExerciseToWorkout(w, { id: 'squat', bw: false }).exercises.length, 3);
  assert.equal(w.exercises.length, 2); // המקור לא השתנה
});

test('finishWorkout: משאיר רק סטים שבוצעו ותרגילים עם סטים כאלה', () => {
  let w = fresh();
  assert.equal(canFinish(w), false);
  w = doSet(w, 0, 0, 60, 10);
  assert.equal(canFinish(w), true);
  const f = finishWorkout(w, 1000 + 58 * 60000);
  assert.equal(f.exercises.length, 1);
  assert.equal(f.exercises[0].sets.length, 1);
  assert.equal(durationMinutes(f), 58);
});

test('previousSets: האימון האחרון שכלל את התרגיל, בלי האימון הנוכחי', () => {
  const mk = (id, startedAt, endedAt, weight) => ({
    id, templateId: 't1', startedAt, endedAt,
    exercises: [{ exerciseId: 'flat_press', bw: false, sets: [{ weight, reps: 8, rir: null, done: true }] }],
  });
  const hist = [mk('a', 100, 200, 60), mk('b', 300, 400, 70), mk('c', 500, null, 99)];
  assert.equal(previousSets(hist, 'flat_press')[0].weight, 70);
  assert.equal(previousSets(hist, 'flat_press', 300)[0].weight, 60);
  assert.equal(previousSets(hist, 'flat_press', Infinity, 'b')[0].weight, 60);
  assert.equal(previousSets(hist, 'squat'), null);
});

test('suggestIncrease: רק אחרי 2 סטים עם RIR >= 2', () => {
  let w = fresh();
  w = doSet(w, 0, 0, 70, 8, 2);
  assert.equal(suggestIncrease(w.exercises[0]), null); // סט אחד לא מספיק
  w = doSet(w, 0, 1, 70, 8, 2);
  const s = suggestIncrease(w.exercises[0]);
  assert.deepEqual(s.weight, { from: 70, to: 75 });
  assert.deepEqual(s.reps, { from: 8, to: 10 });
  // סט שהגיע לכשל מבטל את ההצעה
  const hard = doSet(w, 0, 2, 70, 6, 0);
  assert.equal(suggestIncrease(hard.exercises[0]), null);
  // משקל קל: קפיצה של 2.5
  let light = doSet(doSet(fresh(), 0, 0, 20, 12, 3), 0, 1, 20, 12, 3);
  assert.equal(suggestIncrease(light.exercises[0]).weight.to, 22.5);
  // בלי RIR לא מציעים
  assert.equal(suggestIncrease(doSet(doSet(fresh(), 0, 0, 20, 12), 0, 1, 20, 12).exercises[0]), null);
  // משקל גוף: רק חזרות
  const bw = doSet(doSet(fresh(), 1, 0, 0, 10, 3), 1, 1, 0, 10, 3);
  assert.equal(suggestIncrease(bw.exercises[1]).weight, null);
});

test('applySuggestion: ממלא רק סטים שעוד לא בוצעו', () => {
  let w = doSet(doSet(fresh(), 0, 0, 70, 8, 2), 0, 1, 70, 8, 2);
  const s = suggestIncrease(w.exercises[0]);
  const after = applySuggestion(w, 0, s, 'weight');
  assert.equal(after.exercises[0].sets[0].weight, 70);
  assert.equal(after.exercises[0].sets[2].weight, 75);
});

test('bestSet: משקל גבוה ביותר', () => {
  let w = doSet(doSet(fresh(), 0, 0, 60, 12), 0, 1, 70, 6);
  assert.deepEqual([bestSet(w.exercises[0]).weight, bestSet(w.exercises[0]).reps], [70, 6]);
  assert.equal(bestSet(fresh().exercises[0]), null);
});

import { addDoneSet, removeExerciseAt, validateEditedWorkout } from '../js/logic/workout.js';

const done = (weight, reps, rir = null) => ({ weight, reps, rir, done: true });
const hw = (exs) => ({ id: 'w', endedAt: 2, exercises: exs });

test('עריכת אימון: סט חדש מועתק מהאחרון, והסרת תרגיל', () => {
  const w = hw([{ exerciseId: 'a', bw: false, sets: [done(60, 8, 2)] }, { exerciseId: 'b', bw: false, sets: [done(20, 10)] }]);
  const w2 = addDoneSet(w, 0);
  assert.deepEqual(w2.exercises[0].sets[1], { weight: 60, reps: 8, rir: 2, done: true });
  assert.equal(w.exercises[0].sets.length, 1); // המקור לא משתנה
  assert.deepEqual(removeExerciseAt(w, 0).exercises.map((e) => e.exerciseId), ['b']);
});

test('validateEditedWorkout: חזרות, משקל ואימון ריק', () => {
  assert.equal(validateEditedWorkout(hw([])).error, 'empty');
  assert.equal(validateEditedWorkout(hw([{ exerciseId: 'a', bw: false, sets: [done(60, 0)] }])).error, 'reps');
  assert.equal(validateEditedWorkout(hw([{ exerciseId: 'a', bw: false, sets: [done(null, 5)] }])).error, 'weight');
  assert.equal(validateEditedWorkout(hw([{ exerciseId: 'a', bw: true, sets: [done(null, 5)] }])), null); // משקל גוף בלי משקל
  const bad = validateEditedWorkout(hw([{ exerciseId: 'a', bw: false, sets: [done(1, 1)] }, { exerciseId: 'b', bw: false, sets: [done(1, null)] }]));
  assert.deepEqual(bad, { error: 'reps', exIdx: 1 });
});
