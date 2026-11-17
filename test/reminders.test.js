import { test } from 'node:test';
import assert from 'node:assert/strict';
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { buildSchedule, lastDoneDate, localDate } = await import('../js/logic/reminders.js');

test('buildSchedule: ללא תזכורת בשעת האימון, רק מוקדמת וערב-לפני', () => {
  assert.deepEqual(buildSchedule([{ name: 'A', day: 3, time: '18:30' }]), []);
  const s = buildSchedule([{ name: 'A', day: 3, time: '18:30' }], { lead: 2, eve: true });
  assert.deepEqual(s.map((e) => [e.kind, e.day, e.time]), [['lead', 3, '16:30'], ['eve', 2, '20:00']]);
});

test('תבניות בלי יום או בלי שעה לא מקבלות תזכורות', () => {
  const s = buildSchedule([{ name: 'x', day: 1, time: null }, { name: 'y', day: null, time: '08:00' }], { lead: 2, eve: true });
  assert.equal(s.length, 0);
});

test('יום ראשון (0) תקין, והערב שלפניו הוא שבת (6)', () => {
  const s = buildSchedule([{ name: 'x', day: 0, time: '09:00' }], { eve: true });
  assert.deepEqual(s.map((e) => e.day), [6]);
});

test('lastDoneDate: האימון האחרון, או null', () => {
  assert.equal(lastDoneDate([]), null);
  const a = new Date(2026, 9, 20, 18, 0).getTime(), b = new Date(2026, 9, 21, 7, 30).getTime();
  assert.equal(lastDoneDate([{ endedAt: a }, { endedAt: b }]), '2026-10-21');
  assert.equal(localDate(new Date(2026, 0, 5, 23, 59).getTime()), '2026-01-05');
});

test('ערב לפני: שעה מותאמת ושם תבנית; kind eve', () => {
  const s = buildSchedule([{ name: 'A', day: 0, time: '18:00' }, { name: 'B', day: 3, time: '07:30' }], { eve: true, eveTime: '21:00' });
  assert.deepEqual(s.map((e) => [e.day, e.time, e.kind]), [[6, '21:00', 'eve'], [2, '21:00', 'eve']]);
});

test('תזכורת מוקדמת: כמה שעות לפני, עם גלישה אחורה מעבר לחצות', () => {
  const s = buildSchedule([{ name: 'A', day: 3, time: '18:30' }, { name: 'B', day: 0, time: '01:00' }], { lead: 2 });
  assert.deepEqual(s.map((e) => [e.day, e.time]), [[3, '16:30'], [6, '23:00']]);
  assert.equal(s[0].body, 'עוד 2 שעות לאימון. תתכוננו!');
  assert.equal(buildSchedule([{ name: 'A', day: 3, time: '18:30' }], { lead: 1 })[0].body, 'עוד שעה לאימון. תתכוננו!');
});

test('כמה ימים לתבנית: תזכורת לכל יום לפי השעה שלו', () => {
  const t = { name: 'גב', slots: [{ day: 0, time: '18:00' }, { day: 2, time: '14:00' }, { day: 4, time: null }] };
  const s = buildSchedule([t], { lead: 2, eve: true });
  assert.deepEqual(s.map((e) => [e.kind, e.day, e.time]), [['lead', 0, '16:00'], ['lead', 2, '12:00'], ['eve', 6, '20:00'], ['eve', 1, '20:00']]);
});
