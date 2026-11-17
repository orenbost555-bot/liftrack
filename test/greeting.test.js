import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayPart, buildGreeting, pick } from '../js/logic/greeting.js';

test('dayPart: גבולות השעות', () => {
  assert.equal(dayPart(4), 'לילה טוב');
  assert.equal(dayPart(5), 'בוקר טוב');
  assert.equal(dayPart(11), 'בוקר טוב');
  assert.equal(dayPart(12), 'צהריים טובים');
  assert.equal(dayPart(16), 'צהריים טובים');
  assert.equal(dayPart(17), 'ערב טוב');
  assert.equal(dayPart(21), 'ערב טוב');
  assert.equal(dayPart(22), 'לילה טוב');
  assert.equal(dayPart(0), 'לילה טוב');
});

test('pick: בוחר לפי המספר האקראי שהוזרק', () => {
  assert.equal(pick(['a', 'b', 'c'], () => 0), 'a');
  assert.equal(pick(['a', 'b', 'c'], () => 0.99), 'c');
});

test('buildGreeting: לשון זכר ונקבה', () => {
  const evening = new Date(2026, 9, 20, 19, 0);
  assert.equal(buildGreeting(evening, 'm', () => 0), 'ערב טוב אלוף');
  assert.equal(buildGreeting(evening, 'f', () => 0), 'ערב טוב אלופה');
});
