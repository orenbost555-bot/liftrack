import { el, svg } from '../dom.js';
import { tr } from '../i18n.js';

const icon = (paths) =>
  svg(`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`);

const TABS = [
  { path: '/home', label: tr('בית'), paths: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>' },
  { path: '/workouts', label: tr('אימונים'), paths: '<path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/>' },
  { path: '/progress', label: tr('התקדמות'), paths: '<path d="M5 20V11M12 20V4M19 20v-6"/>' },
  { path: '/goals', label: tr('יעדים'), paths: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.8"/>' },
];

// מסכי המשנה של "אימונים" (ספרייה, היסטוריה) מדליקים את הלשונית של אימונים.
const SUBPAGES = { '/library': '/workouts', '/history': '/workouts', '/muscle': '/progress', '/settings': '/goals' };
const isCurrent = (tabPath, current) => tabPath === (SUBPAGES[current] ?? current);

export function renderNav(currentPath) {
  return el('nav', { class: 'nav', 'aria-label': tr('ניווט ראשי') },
    TABS.map((t) =>
      el('a', { class: 'nav__item', href: `#${t.path}`, 'aria-current': isCurrent(t.path, currentPath) ? 'page' : false },
        icon(t.paths), el('span', {}, t.label))
    )
  );
}
