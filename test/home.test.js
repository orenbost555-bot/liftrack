import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayPlan, weekDays, recentProgress, estimateMinutes } from '../js/logic/home.js';

// 2026-10-21 הוא יום רביעי (3)
const NOW = new Date(2026, 9, 21, 10, 0).getTime();
const at = (d, h = 18) => new Date(2026, 9, d, h, 0).getTime();
const T = (id, day, time = '18:30') => ({ id, name: id, day, time, items: [{ exerciseId: 'x', sets: 3 }] });
const W = (templateId, endedAt, weight = 60) => ({ id: `w${endedAt}`, templateId, name: templateId, startedAt: endedAt - 3600000, endedAt, exercises: [{ exerciseId: 'x', bw: false, sets: [{ weight, reps: 8, rir: 2, done: true }] }] });

test('אורך משוער', () => {
  assert.equal(estimateMinutes(18), 60);
  assert.equal(estimateMinutes(21), 70);
  assert.equal(estimateMinutes(1), 5);
});

test('אין תבניות / יש אימון פעיל', () => {
  assert.equal(todayPlan([], [], null, NOW).kind, 'empty');
  assert.equal(todayPlan([T('a', 3)], [], { id: 'x' }, NOW).kind, 'active');
});
test('תבנית של היום, ואחרי שבוצעה: done', () => {
  assert.equal(todayPlan([T('a', 3)], [], null, NOW).kind, 'today');
  assert.equal(todayPlan([T('a', 3)], [W('a', at(21, 8))], null, NOW).kind, 'done');
});
test('שתי תבניות היום: הבאה לפי שעה, ואחרי שהראשונה בוצעה עוברים לשנייה', () => {
  const ts = [T('late', 3, '20:00'), T('early', 3, '07:00')];
  assert.equal(todayPlan(ts, [], null, NOW).template.id, 'early');
  assert.equal(todayPlan(ts, [W('early', at(21, 8))], null, NOW).template.id, 'late');
});
test('אין היום: האימון הבא בשבוע, כולל מעבר שבוע', () => {
  const r = todayPlan([T('fri', 5), T('mon', 1)], [], null, NOW);
  assert.equal(r.kind, 'next');
  assert.equal(r.template.id, 'fri');
  assert.equal(r.daysAhead, 2);
  assert.equal(todayPlan([T('mon', 1)], [], null, NOW).daysAhead, 5);
});
test('תבניות בלי יום: pick', () => assert.equal(todayPlan([T('a', null)], [], null, NOW).kind, 'pick'));

test('פס שבוע: מצבים לכל יום', () => {
  const ts = [T('a', 0), T('b', 1), T('c', 3), T('d', 5)];
  const days = weekDays(ts, [W('a', at(18))], NOW); // א׳ 18/10 בוצע, ב׳ 19 הוחמץ, ד׳ היום, ו׳ בהמשך
  assert.deepEqual(days.map((d) => d.state), ['done', 'missed', 'rest', 'today', 'rest', 'planned', 'rest']);
  assert.equal(days[3].isToday, true);
});
test('אימון בלי תבנית מתוכננת מסמן יום כבוצע, והיום שבוצע לא נשאר today', () => {
  const days = weekDays([], [W('free', at(21, 8))], NOW);
  assert.equal(days[3].state, 'done');
});

test('התקדמות אחרונה: סט אחרון וסטטוס', () => {
  const h = [W('a', at(5), 60), W('a', at(12), 65), W('a', at(19), 70)];
  const r = recentProgress(h);
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].weight, r[0].reps, r[0].status], [70, 8, 'improving']);
});

test('כמה ימים לתבנית: כל יום עם שעה משלו', () => {
  const back = { id: 'back', name: 'גב', items: [{ exerciseId: 'x', sets: 3 }], slots: [{ day: 0, time: '18:00' }, { day: 3, time: '14:00' }] };
  const r = todayPlan([back], [], null, NOW); // היום רביעי
  assert.equal(r.kind, 'today');
  assert.equal(r.time, '14:00');
  const n = todayPlan([back], [W('back', at(21, 8))], null, new Date(2026, 9, 22, 12).getTime()); // חמישי: הבא ראשון
  assert.equal(n.kind, 'next');
  assert.equal(n.day, 0);
  assert.equal(n.time, '18:00');
  assert.equal(weekDays([back], [], NOW)[0].state, 'missed');
});
