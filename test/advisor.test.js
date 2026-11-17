import { test } from 'node:test';
import assert from 'node:assert/strict';
const { planWeek, applyPlan, sessionMinutes, heavyGroups, loadOf, startTime, defaultAvailability, windowMinutes, dayDistance, toMin, fromMin } = await import('../js/logic/advisor.js');
const { allExercises } = await import('../js/logic/exercises.js');
const byId = new Map(allExercises().map((e) => [e.id, e]));

const chest = { id: 'c', name: 'חזה', items: [{ exerciseId: 'flat_press', sets: 4 }, { exerciseId: 'incline_press', sets: 3 }, { exerciseId: 'ohp', sets: 3 }] };
const back = { id: 'b', name: 'גב', items: [{ exerciseId: 'pullups_wide', sets: 4 }, { exerciseId: 'bent_row', sets: 3 }, { exerciseId: 'bicep_curl', sets: 3 }] };
const legs = { id: 'l', name: 'רגליים', items: [{ exerciseId: 'squat', sets: 4 }, { exerciseId: 'rdl', sets: 3 }, { exerciseId: 'leg_press', sets: 3 }] };
const chest2 = { id: 'c2', name: 'חזה ב', items: [{ exerciseId: 'flat_press', sets: 4 }, { exerciseId: 'incline_press', sets: 4 }] };
const avail = defaultAvailability;

test('זמנים ומרחק בין ימים', () => {
  assert.equal(toMin('17:30'), 1050);
  assert.equal(fromMin(1050), '17:30');
  assert.equal(dayDistance(6, 0), 1); // שבת וראשון סמוכים
  assert.equal(dayDistance(0, 3), 3);
  assert.equal(dayDistance(1, 5), 3);
});

test('משך אימון וקבוצות שרירים', () => {
  assert.equal(sessionMinutes(chest), 40); // 10 + 10*3 = 40
  assert.deepEqual(heavyGroups(loadOf(legs, byId)), ['legs']);
  assert.ok(heavyGroups(loadOf(chest, byId)).includes('chest'));
  assert.deepEqual(heavyGroups({}), []);
});

test('חלון פנוי: כבוי או טווח הפוך נותנים 0', () => {
  assert.equal(windowMinutes({ on: true, from: '17:00', to: '21:00' }), 240);
  assert.equal(windowMinutes({ on: false, from: '17:00', to: '21:00' }), 0);
  assert.equal(windowMinutes({ on: true, from: '21:00', to: '17:00' }), 0);
});

test('שעת התחלה: ערב = מאוחר ככל האפשר, אחרת תחילת החלון', () => {
  const w = { on: true, from: '17:00', to: '21:00' };
  assert.equal(startTime(w, 40, 'any'), '17:00');
  assert.equal(startTime(w, 40, 'morning'), '17:00');
  assert.equal(startTime(w, 40, 'evening'), '20:15'); // 21:00 פחות 40 דקות, מעוגל כלפי מטה ל-15
  assert.equal(startTime({ on: true, from: '06:00', to: '06:40' }, 40, 'evening'), '06:00');
});

test('שתי תבניות על אותם שרירים לא ישובצו בימים סמוכים כשאפשר אחרת', () => {
  const plan = planWeek({ templates: [chest, chest2], byId, availability: avail(), counts: {} });
  assert.equal(plan.placements.length, 2);
  const [a, b] = plan.placements;
  assert.ok(dayDistance(a.day, b.day) >= 2, `${a.day},${b.day}`);
  assert.equal(plan.unplaced.length, 0);
});

test('תבניות על שרירים שונים כן יכולות להיות בימים סמוכים, ויש יום מנוחה', () => {
  const plan = planWeek({ templates: [chest, back, legs], byId, availability: avail() });
  assert.equal(plan.placements.length, 3);
  assert.equal(new Set(plan.placements.map((p) => p.day)).size, 3); // אימון אחד ליום
  assert.equal(plan.restDays.length, 4);
});

test('אימון אחד ליום: ארבע פעמים בשבוע לתבנית נותנות ארבעה ימים שונים', () => {
  const plan = planWeek({ templates: [chest], byId, availability: avail(), counts: { c: 4 } });
  assert.equal(new Set(plan.placements.map((p) => p.day)).size, 4);
  // אותה תבנית: מעדיף שלא יהיו ימים סמוכים
  const days = plan.placements.map((p) => p.day);
  const adjacent = days.filter((d, i) => days.some((e, j) => j !== i && dayDistance(d, e) === 1)).length;
  assert.ok(adjacent < 4);
});

test('ימים לא פנויים לא משובצים', () => {
  const a = avail().map((d, i) => ({ ...d, on: i === 2 || i === 4 })); // רק שלישי וחמישי
  const plan = planWeek({ templates: [chest, back], byId, availability: a });
  assert.deepEqual(plan.placements.map((p) => p.day).sort(), [2, 4]);
});

test('יותר אימונים מימים פנויים: מוותרים על הפחות חשוב ומדווחים', () => {
  const a = avail().map((d, i) => ({ ...d, on: i === 1 || i === 3 }));
  const plan = planWeek({ templates: [chest, back, legs], byId, availability: a, priority: { l: 'high' } });
  assert.equal(plan.placements.length, 2);
  assert.ok(plan.placements.some((p) => p.templateId === 'l'), 'עדיפות גבוהה נשארת');
  assert.equal(plan.unplaced.length, 1);
  assert.equal(plan.unplaced[0].reason, 'no-day');
});

test('חלון קצר מדי לאימון: האימון לא משובץ עם סיבה', () => {
  const a = avail().map((d) => ({ ...d, from: '17:00', to: '17:30' }));
  const plan = planWeek({ templates: [chest], byId, availability: a });
  assert.equal(plan.placements.length, 0);
  assert.equal(plan.unplaced[0].reason, 'no-window');
});

test('עדיפות גבוהה מקבלת את היום עם החלון הארוך', () => {
  const a = avail().map((d, i) => ({ ...d, on: i === 1 || i === 3, to: i === 3 ? '22:00' : '18:30' }));
  const plan = planWeek({ templates: [chest, back], byId, availability: a, priority: { b: 'high' } });
  assert.equal(plan.placements.find((p) => p.templateId === 'b').day, 3);
});

test('הסברים: התאוששות מאימון קודם על אותם שרירים, וחלון', () => {
  const plan = planWeek({ templates: [chest, chest2], byId, availability: avail() });
  const reasons = plan.placements[0].reasons;
  assert.ok(reasons.some((r) => r.code === 'rest' && r.gap >= 2));
  assert.ok(reasons.some((r) => r.code === 'window' && r.hours > 0));
});

test('אין תבניות: תוכנית ריקה', () => {
  const plan = planWeek({ templates: [], byId, availability: avail() });
  assert.deepEqual(plan.placements, []);
  assert.equal(plan.restDays.length, 7);
});

test('הלוגיקה דטרמיניסטית', () => {
  const run = () => JSON.stringify(planWeek({ templates: [chest, back, legs, chest2], byId, availability: avail(), counts: { c: 2 } }));
  assert.equal(run(), run());
});

test('applyPlan מחליף ימים ושעות ומוסיף רשומה להיסטוריית הלוח', () => {
  const t = { ...chest, slots: [{ day: 0, time: '18:00' }], schedule: [{ days: [0], since: 1000 }] };
  const plan = { placements: [{ templateId: 'c', day: 2, time: '19:00' }, { templateId: 'c', day: 4, time: '17:30' }] };
  const [out, untouched] = applyPlan([t, back], plan, 5000);
  assert.deepEqual(out.slots, [{ day: 2, time: '19:00' }, { day: 4, time: '17:30' }]);
  assert.deepEqual(out.schedule, [{ days: [0], since: 1000 }, { days: [2, 4], since: 5000 }]);
  assert.equal(untouched, back); // תבנית שלא בתוכנית לא משתנה
});

test('applyPlan: אותם ימים לא מוסיף רשומה כפולה, ומנקה שדות ישנים', () => {
  const t = { ...chest, day: 2, time: '18:00', slots: [{ day: 2, time: '18:00' }], schedule: [{ days: [2], since: 1000 }] };
  const [out] = applyPlan([t], { placements: [{ templateId: 'c', day: 2, time: '20:00' }] }, 9000);
  assert.deepEqual(out.schedule, [{ days: [2], since: 1000 }]);
  assert.equal(out.day, undefined);
  assert.equal(out.slots[0].time, '20:00');
});

const { adviseDay, lastTrained } = await import('../js/logic/advisor.js');
const D = '2026-11-18'; // רביעי
const dayStart = new Date(2026, 10, 18).getTime();
const done = (templateId, tpl, hoursAgo) => ({ templateId, startedAt: dayStart - hoursAgo * 3600000, endedAt: dayStart - hoursAgo * 3600000 + 3000000,
  exercises: tpl.items.map((i) => ({ exerciseId: i.exerciseId, sets: Array.from({ length: i.sets }, () => ({ done: true, weight: 50, reps: 10, rir: 2 })) })) });
const W17 = [{ from: '17:00', to: '21:00' }];

test('lastTrained: קבוצה נחשבת מאומנת רק עם מספיק סטים שהושלמו', () => {
  const light = { templateId: 'x', endedAt: 5000, startedAt: 1, exercises: [{ exerciseId: 'flat_press', sets: [{ done: true }, { done: false }, { done: false }] }] };
  assert.deepEqual(lastTrained([light], byId), {});
  const full = done('c', chest, 30);
  assert.ok(lastTrained([full], byId).chest);
});

test('adviseDay: ממליץ על התבנית שהשרירים שלה התאוששו ולא על זו שאומנה אתמול', () => {
  const workouts = [done('c', chest, 20), done('l', legs, 100)];
  const r = adviseDay({ templates: [chest, legs], byId, date: D, windows: W17, workouts });
  assert.equal(r.best.templateId, 'l');
  assert.equal(r.best.time, '17:00');
  const c = r.alternatives.find((a) => a.templateId === 'c');
  assert.equal(c.status, 'recovering');
});

test('adviseDay: אם הכל מתאושש, ממליץ לנוח', () => {
  const workouts = [done('c', chest, 10), done('b', back, 12), done('l', legs, 14)];
  const r = adviseDay({ templates: [chest, back, legs], byId, date: D, windows: W17, workouts });
  assert.equal(r.best, null);
  assert.equal(r.rest, 'recovering');
});

test('adviseDay: חלון קצר מדי נותן nofit, ואין המלצה', () => {
  const r = adviseDay({ templates: [chest], byId, date: D, windows: [{ from: '17:00', to: '17:20' }], workouts: [] });
  assert.equal(r.best, null);
  assert.equal(r.rest, 'nofit');
  assert.equal(r.alternatives[0].status, 'nofit');
});

test('adviseDay: בלי חלונות פנויים מדווח', () => {
  const r = adviseDay({ templates: [chest], byId, date: D, windows: [], workouts: [] });
  assert.equal(r.noWindows, true);
  assert.equal(r.best, null);
});

test('adviseDay: בוחר את החלון הארוך ביותר שמתאים, ושעת ערב מאוחרת', () => {
  const r = adviseDay({ templates: [chest], byId, date: D, timeOfDay: 'evening', workouts: [],
    windows: [{ from: '07:00', to: '07:30' }, { from: '18:00', to: '20:00' }, { from: '12:00', to: '13:00' }] });
  assert.equal(r.best.window.from, '18:00');
  assert.equal(r.best.time, '19:15'); // 20:00 פחות 40 דקות, מעוגל ל-15
});

test('adviseDay: יום עייף מעדיף אימון קצר', () => {
  const long = { id: 'long', name: 'ארוך', items: [...legs.items, ...back.items, ...chest.items] };
  const short = { id: 'short', name: 'קצר', items: [{ exerciseId: 'bicep_curl', sets: 3 }, { exerciseId: 'pushdown', sets: 3 }] };
  const r = adviseDay({ templates: [long, short], byId, date: D, windows: [{ from: '17:00', to: '21:00' }], energy: 'tired', workouts: [] });
  assert.equal(r.best.templateId, 'short');
  assert.ok(r.best.reasons.some((x) => x.code === 'short'));
});

test('adviseDay: תבנית שמתוכננת ליום הזה מקבלת עדיפות', () => {
  const a = { ...chest, slots: [{ day: 3, time: '18:00' }] }; // רביעי = 3
  const r = adviseDay({ templates: [legs, a], byId, date: D, windows: W17, workouts: [] });
  assert.equal(r.best.templateId, 'c');
  assert.ok(r.best.reasons.some((x) => x.code === 'scheduled'));
});
