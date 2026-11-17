import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nudgeAt, lastActivity, NUDGE_OPTIONS } from '../js/logic/idle-nudge.js';

test('nudgeAt: פעילות אחרונה ועוד X דקות', () => {
  const w = { startedAt: 1000000, lastActivityAt: 5000000 };
  assert.equal(lastActivity(w), 5000000);
  assert.equal(nudgeAt(w, 15), 5000000 + 15 * 60000);
  assert.equal(nudgeAt({ startedAt: 1000000 }, 10), 1000000 + 600000); // עוד לא הוזן כלום: מתחילת האימון
});

test('nudgeAt: כבוי או בלי אימון פעיל', () => {
  assert.equal(nudgeAt(null, 15), null);
  assert.equal(nudgeAt({ startedAt: 1 }, 0), null);
  assert.equal(nudgeAt({ startedAt: 1 }, undefined), null);
  assert.deepEqual(NUDGE_OPTIONS[0], 0);
});
