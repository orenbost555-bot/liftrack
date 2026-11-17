import { el, mount } from '../dom.js';
import { getWorkouts } from '../store.js';
import { LIBRARY } from '../data/exercises.js';
import { allExercises } from '../logic/exercises.js';
import { bestSet, doneSetCount, durationMinutes } from '../logic/workout.js';
import { compareWorkout, weekBucket, formatDate, formatNumber } from '../logic/summary.js';
import { workoutsHeader } from '../components/workouts-header.js';
import { tr } from '../i18n.js';

let BY_ID = new Map(allExercises().map((e) => [e.id, e]));
const BUCKETS = [tr('השבוע'), tr('שבוע שעבר'), tr('קודם@@bucket')];

function card(w, all) {
  const cmp = compareWorkout(w, all);
  const lines = w.exercises.slice(0, 2).map((ex) => {
    const b = bestSet(ex);
    return `${BY_ID.get(ex.exerciseId)?.he ?? ex.exerciseId} ${formatNumber(b.weight ?? 0)} × ${b.reps}`;
  }).join(' · ');
  return el('a', { class: 'card hcard', href: `#/summary?id=${encodeURIComponent(w.id)}` },
    el('div', { class: 'hcard__top' },
      el('span', { class: 'hcard__name' }, w.name),
      cmp.improvements > 0 ? el('span', { class: 'tag tag--bw' }, tr('{n} שיפורים', { n: cmp.improvements })) : null),
    el('span', { class: 'muted hcard__meta' }, `${formatDate(w.endedAt)} · ${tr('{n} דק׳', { n: durationMinutes(w) })} · ${tr('{n} סטים', { n: doneSetCount(w) })}`),
    lines ? el('span', { class: 'hcard__lines' }, lines) : null);
}

export function historyScreen() {
  // הספרייה יכולה להשתנות (תרגילים מותאמים), לכן מרעננים בכל כניסה למסך.
  BY_ID = new Map(allExercises().map((e) => [e.id, e]));
  const all = getWorkouts().filter((w) => w.endedAt !== null).sort((a, b) => b.endedAt - a.endedAt);
  let group = 'all';
  const chips = el('div', { class: 'chips' });
  const list = el('div', { class: 'lib__list' });

  function draw() {
    chips.replaceChildren(...[{ id: 'all', name: tr('הכל') }, ...LIBRARY].map((g) =>
      el('button', { class: 'chip-btn', 'aria-selected': g.id === group ? 'true' : 'false', onclick: () => { group = g.id; draw(); } }, g.id === 'all' ? g.name : tr(g.name))));
    const shown = group === 'all' ? all : all.filter((w) => w.exercises.some((ex) => BY_ID.get(ex.exerciseId)?.group === group));
    if (shown.length === 0) {
      list.replaceChildren(el('div', { class: 'card muted' }, all.length === 0 ? tr('עוד אין אימונים. אחרי האימון הראשון הוא יופיע כאן.') : tr('אין אימונים לקבוצה הזו.')));
      return;
    }
    const now = Date.now();
    mount(list, BUCKETS.map((b) => {
      const items = shown.filter((w) => weekBucket(w.endedAt, now) === b);
      return items.length === 0 ? null : el('section', { class: 'lib__sub' }, el('h2', { class: 'lib__subtitle' }, b), el('div', { class: 'hlist' }, items.map((w) => card(w, all))));
    }));
  }
  draw();
  return el('main', { class: 'screen' }, workoutsHeader('history'), chips, list);
}
