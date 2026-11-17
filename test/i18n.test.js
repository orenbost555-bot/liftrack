import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

globalThis.localStorage = { getItem: () => null, setItem() {} };
const { tr, getLang } = await import('../js/i18n.js');
const { EN } = await import('../js/i18n-en.js');
const { QUOTES_EN } = await import('../js/i18n-data.js');
const { QUOTES_HE } = await import('../js/data/quotes.js').catch(() => ({}));

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk('js').filter((f) => f.endsWith('.js') && !/i18n/.test(f));

test('ברירת מחדל עברית: tr מחזיר את המפתח ומציב משתנים', () => {
  assert.equal(getLang(), 'he');
  assert.equal(tr('{n} סטים', { n: 3 }), '3 סטים');
});

test('לכל מפתח tr בקוד יש תרגום לאנגלית', () => {
  const pat = /\btr\(\s*'((?:[^'\\]|\\.)*)'/g;
  const missing = [];
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(pat)) {
      const key = m[1].replace(/\\'/g, "'");
      if (/[א-ת]/.test(key) && !(key in EN)) missing.push(`${f}: ${key}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('צורות רבים תקינות ושומרות על אותם משתנים', () => {
  for (const [k, v] of Object.entries(EN)) {
    const parts = v.split('|');
    assert.ok(parts.length <= 2, k);
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    if (parts.length === 2 && k.includes('{n}')) assert.ok(parts[0].includes('{n}') && parts[1].includes('{n}'), k);
    if (k.includes('{') ) assert.equal(vars(parts[1] ?? parts[0]), vars(k), k);
  }
});

test('ציטוטים באנגלית: אותה כמות כמו בעברית ואחרי כל אחד סימן קריאה', () => {
  if (QUOTES_HE) assert.equal(QUOTES_EN.length, QUOTES_HE.length);
  assert.ok(QUOTES_EN.every((q) => q.endsWith('!')));
});
