import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newTemplate, addExercise, removeExercise, moveExercise, setSets,
  templateStats, scheduleLabel, slotsOf, toggleDay, setSlotTime, clashesOn, templateSummary, validateTemplate, DEFAULT_SETS,
} from '../js/logic/templates.js';
import { allExercises } from '../js/logic/exercises.js';

const base = () => addExercise(addExercise(addExercise(newTemplate('t1'), 'squat'), 'leg_ext'), 'rdl');

test('addExercise: מוסיף עם סטים ברירת מחדל ולא מוסיף פעמיים', () => {
  const t = addExercise(newTemplate('t1'), 'squat');
  assert.deepEqual(t.items, [{ exerciseId: 'squat', sets: DEFAULT_SETS }]);
  assert.equal(addExercise(t, 'squat'), t);
});

test('הפונקציות לא משנות את התבנית המקורית', () => {
  const t = base();
  const snapshot = JSON.stringify(t);
  removeExercise(t, 'squat'); moveExercise(t, 0, 1); setSets(t, 'squat', 5); addExercise(t, 'hack');
  assert.equal(JSON.stringify(t), snapshot);
});

test('removeExercise', () => {
  assert.deepEqual(removeExercise(base(), 'leg_ext').items.map((i) => i.exerciseId), ['squat', 'rdl']);
});

test('moveExercise: מחליף מקומות ושומר על הגבולות', () => {
  const t = base();
  assert.deepEqual(moveExercise(t, 0, 1).items.map((i) => i.exerciseId), ['leg_ext', 'squat', 'rdl']);
  assert.deepEqual(moveExercise(t, 2, -1).items.map((i) => i.exerciseId), ['squat', 'rdl', 'leg_ext']);
  assert.equal(moveExercise(t, 0, -1), t);
  assert.equal(moveExercise(t, 2, 1), t);
});

test('setSets: מגביל בין 1 ל-10', () => {
  const t = base();
  assert.equal(setSets(t, 'squat', 5).items[0].sets, 5);
  assert.equal(setSets(t, 'squat', 0).items[0].sets, 1);
  assert.equal(setSets(t, 'squat', 99).items[0].sets, 10);
});

test('templateStats', () => {
  assert.deepEqual(templateStats(setSets(base(), 'squat', 5)), { exercises: 3, sets: 11 });
  assert.deepEqual(templateStats(newTemplate('x')), { exercises: 0, sets: 0 });
});

test('scheduleLabel', () => {
  assert.equal(scheduleLabel({ day: 0, time: '18:30' }), 'ראשון 18:30'); // תבנית ישנה
  assert.equal(scheduleLabel({ slots: [{ day: 2, time: null }] }), 'שלישי');
  assert.equal(scheduleLabel({ slots: [{ day: 2, time: '14:00' }, { day: 0, time: '18:00' }] }), 'ראשון 18:00 · שלישי 14:00');
  assert.equal(scheduleLabel({ slots: [] }), null);
  assert.equal(scheduleLabel({ day: null, time: null }), null);
});

test('slotsOf: תבנית ישנה מומרת, ימים ממוינים ותקינים בלבד', () => {
  assert.deepEqual(slotsOf({ day: 3, time: '07:00' }), [{ day: 3, time: '07:00' }]);
  assert.deepEqual(slotsOf({ day: null, time: '07:00' }), []);
  assert.deepEqual(slotsOf({ slots: [{ day: 4, time: '' }, { day: 9, time: 'x' }, { day: 1, time: '08:00' }] }), [{ day: 1, time: '08:00' }, { day: 4, time: null }]);
});

test('toggleDay / setSlotTime: כמה ימים, שעה לכל יום', () => {
  let t = newTemplate('t');
  t = toggleDay(t, 2);
  t = setSlotTime(t, 2, '14:00');
  t = toggleDay(t, 0); // מעתיק את שעת היום הראשון
  assert.deepEqual(t.slots, [{ day: 0, time: '14:00' }, { day: 2, time: '14:00' }]);
  t = setSlotTime(t, 0, '18:00');
  assert.deepEqual(t.slots.map((s) => s.time), ['18:00', '14:00']);
  t = toggleDay(t, 2);
  assert.deepEqual(t.slots, [{ day: 0, time: '18:00' }]);
  for (let d = 0; d < 7; d++) if (d !== 0) t = toggleDay(t, d);
  assert.equal(t.slots.length, 7); // אין הגבלה על מספר הימים
});

test('clashesOn: שמות תבניות אחרות באותו יום', () => {
  const others = [{ name: 'גב', slots: [{ day: 0, time: '18:00' }] }, { name: 'רגליים', day: 0, time: null }, { name: 'חזה', slots: [{ day: 3, time: null }] }];
  assert.deepEqual(clashesOn(others, 0), ['גב', 'רגליים']);
  assert.deepEqual(clashesOn(others, 5), []);
});

test('templateSummary: תתי-שרירים ללא כפילויות, ומקצר', () => {
  const all = allExercises();
  assert.equal(templateSummary(base(), all), 'ארבע ראשי · המסטרינגס');
  let t = newTemplate('x');
  for (const id of ['incline_press', 'flat_press', 'decline_press', 'pullups', 'shrugs', 'deadlift']) t = addExercise(t, id);
  assert.equal(templateSummary(t, all, 4), 'חזה עליון · חזה אמצעי · חזה תחתון · רחב גבי +2');
  assert.equal(templateSummary({ items: [{ exerciseId: 'gone', sets: 3 }] }, all), '');
});

test('validateTemplate', () => {
  assert.equal(validateTemplate({ ...base(), name: 'רגליים' }), null);
  assert.equal(validateTemplate({ ...base(), name: '   ' }), 'name');
  assert.equal(validateTemplate({ ...newTemplate('x'), name: 'ריק' }), 'empty');
});
