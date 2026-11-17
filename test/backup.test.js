import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBackup, parseBackup } from '../js/logic/backup.js';

const state = { version: 1, profile: { name: 'אורן' }, templates: [], workouts: [{ id: 'w' }], goals: [], settings: {}, overrides: {} };

test('גיבוי ושחזור חוזרים לאותו מצב', () => {
  const r = parseBackup(makeBackup(state, 5));
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, state);
});

test('טקסט שאינו JSON נדחה', () => assert.deepEqual(parseBackup('hello'), { ok: false, error: 'json' }));
test('JSON של אפליקציה אחרת נדחה', () => assert.deepEqual(parseBackup('{"a":1}'), { ok: false, error: 'format' }));
test('מבנה שבור נדחה', () => {
  assert.equal(parseBackup(JSON.stringify({ app: 'liftrack', data: { workouts: 'x' } })).error, 'shape');
  assert.equal(parseBackup(JSON.stringify({ app: 'liftrack', data: { profile: { name: 3 } } })).error, 'shape');
  assert.equal(parseBackup(JSON.stringify({ app: 'liftrack', data: [] })).error, 'format');
});
