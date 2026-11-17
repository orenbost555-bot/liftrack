import { el } from '../dom.js';
import { tr } from '../i18n.js';

const TABS = [
  { id: 'templates', label: tr('התבניות שלי'), href: '#/workouts' },
  { id: 'history', label: tr('היסטוריה'), href: '#/history' },
  { id: 'library', label: tr('ספרייה'), href: '#/library' },
];

/** כותרת + לשוניות משנה, משותפים לשלושת המסכים תחת "אימונים". */
export function workoutsHeader(active) {
  return [
    el('div', { class: 'wk-head' },
      el('h1', { class: 'title' }, tr('אימונים')),
      el('span', { class: 'muted wk-head__sub' }, tr('מרכיבים פעם אחת ומתחילים בלחיצה'))),
    el('div', { class: 'tabs', role: 'tablist' },
      TABS.map((t) => el('a', { class: 'tabs__item', href: t.href, role: 'tab', 'aria-selected': t.id === active ? 'true' : 'false' }, t.label))),
  ];
}
