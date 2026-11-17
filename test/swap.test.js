import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stagnation, isSuppressed, snooze, never, stagnantList, alternatives, replaceInTemplates } from '../js/logic/swap.js';

const DAY = 86400000;
const NOW = 100 * DAY;
const S = (weight, reps = 8) => ({ weight, reps, rir: 2, done: true });
// weights לפי אימון, כל אימון בהפרש שבוע, האחרון לפני יומיים
const hist = (weights, { bw = false, id = 'x' } = {}) => weights.map((w, i) => ({
  id: 'w' + i, templateId: 't', name: 'A', startedAt: 0, endedAt: NOW - 2 * DAY - (weights.length - 1 - i) * 7 * DAY,
  exercises: [{ exerciseId: id, bw, sets: [S(w, bw ? w : 8)] }],
}));

test('5 אימונים בלי שיפור = תקוע', () => {
  // שיפור באימון השני, ואז 5 אימונים בלי שיפור (שבוע בין אימונים)
  const r = stagnation(hist([60, 65, 70, ...Array(5).fill(70)]), 'x', NOW);
  assert.equal(r.sessions, 5);
  assert.equal(r.weeks, 5);
  assert.equal(r.metric, 'weight');
});
test('חודשיים בלי שיפור מספיקים גם עם מעט אימונים', () => {
  const h = hist([70, 70, 70, 70]).map((w, i) => ({ ...w, endedAt: NOW - 90 * DAY + i * 20 * DAY }));
  assert.equal(stagnation(h, 'x', NOW).sessions, 3);
});
test('5 אימונים מספיקים גם בפחות מחודשיים', () => {
  const h = hist(Array(6).fill(70)).map((w, i) => ({ ...w, endedAt: NOW - (5 - i) * 4 * DAY }));
  assert.equal(stagnation(h, 'x', NOW).sessions, 5);
});
test('פחות מ-3 אימונים לא נחשב גם אחרי חודשיים', () => {
  const h = hist([70, 70]).map((w, i) => ({ ...w, endedAt: NOW - 90 * DAY + i * 20 * DAY }));
  assert.equal(stagnation(h, 'x', NOW), null);
});
test('פחות מ-5 אימונים ופחות מחודשיים = לא תקוע', () => {
  const h = hist([70, 70, 70, 70]).map((w, i) => ({ ...w, endedAt: NOW - (3 - i) * 7 * DAY }));
  assert.equal(stagnation(h, 'x', NOW), null);
});
test('שיפור לאחרונה = לא תקוע', () => assert.equal(stagnation(hist([...Array(6).fill(60), 65]), 'x', NOW), null));
test('משקל גוף נמדד בחזרות', () => {
  assert.equal(stagnation(hist([10, 12, ...Array(6).fill(12)], { bw: true }), 'x', NOW).metric, 'reps');
});
test('דחייה: זמנית ולתמיד', () => {
  assert.equal(isSuppressed({}, 'x', NOW), false);
  const s = snooze({}, 'x', NOW);
  assert.equal(isSuppressed(s, 'x', NOW + 13 * DAY), true);
  assert.equal(isSuppressed(s, 'x', NOW + 15 * DAY), false);
  assert.equal(isSuppressed(never({}, 'x'), 'x', NOW + 999 * DAY), true);
});
test('רשימת תקועים מדלגת על נדחים', () => {
  const h = hist([60, 65, 70, ...Array(5).fill(70)]);
  assert.equal(stagnantList(h, ['x'], {}, NOW).length, 1);
  assert.equal(stagnantList(h, ['x'], never({}, 'x'), NOW).length, 0);
});

const lib = [
  { id: 'a', group: 'g', sub: 's1', p: ['m1'], bw: false },
  { id: 'b', group: 'g', sub: 's1', p: ['m1'], bw: false },
  { id: 'c', group: 'g', sub: 's2', p: ['m1', 'm2'], bw: false },
  { id: 'd', group: 'g', sub: 's2', p: ['m2'], bw: false },
  { id: 'e', group: 'h', sub: 's1', p: ['m1'], bw: false },
  { id: 'f', group: 'g', sub: 's1', p: ['m1'], bw: true },
];
test('חלופות: אותה קבוצה וסוג, בלי התרגיל עצמו, עם שריר משותף', () => {
  const ids = alternatives(lib[0], lib, new Set(['b'])).map((e) => e.id);
  assert.deepEqual(ids, ['b', 'c']); // d בלי שריר משותף, e קבוצה אחרת, f משקל גוף
});
test('חלופה שעוד לא בוצעה קודמת לשוות ערך', () => {
  const ids = alternatives(lib[0], lib, new Set(['b'])).map((e) => e.id);
  assert.equal(alternatives({ ...lib[0] }, [...lib, { id: 'g2', group: 'g', sub: 's1', p: ['m1'], bw: false }], new Set(['b'])).map((e) => e.id)[0], 'g2');
  assert.ok(ids.length);
});

test('החלפה בתבניות: מחליף, שומר סטים, ולא מכפיל', () => {
  const ts = [
    { id: '1', items: [{ exerciseId: 'a', sets: 4 }, { exerciseId: 'z', sets: 3 }] },
    { id: '2', items: [{ exerciseId: 'a', sets: 3 }, { exerciseId: 'b', sets: 3 }] },
    { id: '3', items: [{ exerciseId: 'z', sets: 3 }] },
  ];
  const r = replaceInTemplates(ts, 'a', 'b');
  assert.equal(r.changed, 2);
  assert.deepEqual(r.templates[0].items[0], { exerciseId: 'b', sets: 4 });
  assert.deepEqual(r.templates[1].items.map((i) => i.exerciseId), ['b']);
  assert.equal(r.templates[2], ts[2]);
  assert.equal(ts[0].items[0].exerciseId, 'a'); // המקור לא השתנה
});
