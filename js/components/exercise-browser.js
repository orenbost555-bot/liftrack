import { el } from '../dom.js';
import { LIBRARY } from '../data/exercises.js';
import { allExercises, searchExercises, groupBySub } from '../logic/exercises.js';
import { tr } from '../i18n.js';

let ALL = allExercises();

/**
 * חיפוש + לשוניות קבוצות + רשימת תרגילים לפי תת-שריר.
 * משמש גם את מסך הספרייה וגם את בורר התרגילים בעורך התבנית.
 * renderRow(ex) בונה שורה אחת, ו-redraw() מצייר מחדש (קוראים לה אחרי שינוי מצב).
 */
export function exerciseBrowser({ renderRow }) {
  // הספרייה יכולה להשתנות (תרגילים מותאמים), לכן מרעננים בכל כניסה למסך.
  ALL = allExercises();
  let group = LIBRARY[0].id;
  let query = '';

  const chips = el('div', { class: 'chips', role: 'tablist' });
  const list = el('div', { class: 'lib__list' });
  const search = el('input', {
    class: 'field lib__search', type: 'search', placeholder: tr('חיפוש תרגיל'), 'aria-label': tr('חיפוש תרגיל'),
    oninput: (e) => { query = e.target.value; redraw(); },
  });

  function redraw() {
    ALL = allExercises();
    const searching = query.trim() !== '';
    chips.hidden = searching; // בזמן חיפוש מחפשים בכל הספרייה
    chips.replaceChildren(...LIBRARY.map((g) =>
      el('button', { class: 'chip-btn', role: 'tab', 'aria-selected': g.id === group ? 'true' : 'false',
        onclick: () => { group = g.id; redraw(); } }, tr(g.name))));

    const found = searchExercises(searching ? ALL : ALL.filter((e) => e.group === group), query);
    if (found.length === 0) {
      list.replaceChildren(el('div', { class: 'card muted' }, tr('לא נמצאו תרגילים.')));
      return;
    }
    list.replaceChildren(...groupBySub(found).map((s) =>
      el('section', { class: 'lib__sub' },
        el('h2', { class: 'lib__subtitle' }, tr(s.name)),
        el('div', { class: 'card lib__card' }, s.ex.map(renderRow)))));
  }

  redraw();
  return { node: el('div', { class: 'browser' }, search, chips, list), redraw };
}
