import { el, svg } from '../dom.js';
import { getTemplates, getActive } from '../store.js';
import { allExercises } from '../logic/exercises.js';
import { templateStats, templateSummary, scheduleLabel } from '../logic/templates.js';
import { workoutsHeader } from '../components/workouts-header.js';
import { tr } from '../i18n.js';

let ALL = allExercises();
const PENCIL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/></svg>';
const PLUS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

function templateCard(t) {
  const { exercises, sets } = templateStats(t);
  const when = scheduleLabel(t);
  return el('article', { class: 'card tpl' },
    el('div', { class: 'tpl__top' },
      el('span', { class: 'tpl__name' }, t.name),
      when ? el('span', { class: 'tag tag--main' }, when) : null),
    el('span', { class: 'muted tpl__sub' }, templateSummary(t, ALL)),
    el('div', { class: 'tpl__bottom' },
      el('span', { class: 'tpl__count' }, `${tr('{n} תרגילים', { n: exercises })} · ${tr('{n} סטים', { n: sets })}`),
      el('div', { class: 'tpl__actions' },
        el('a', { class: 'icon-btn', href: `#/template?id=${encodeURIComponent(t.id)}`, 'aria-label': tr('ערוך תבנית') }, svg(PENCIL)),
        el('a', { class: 'btn btn--sm', href: `#/workout?template=${encodeURIComponent(t.id)}` }, tr('התחל')))));
}

export function workoutsScreen() {
  // הספרייה יכולה להשתנות (תרגילים מותאמים), לכן מרעננים בכל כניסה למסך.
  ALL = allExercises();
  const templates = getTemplates();
  const active = getActive();
  return el('main', { class: 'screen' },
    workoutsHeader('templates'),
    active
      ? el('a', { class: 'hero resume', href: '#/workout' },
          el('span', { class: 'resume__title' }, tr('אימון פעיל: {name}', { name: active.name })),
          el('span', { class: 'resume__cta' }, tr('המשך אימון ›')))
      : null,
    templates.length === 0
      ? el('div', { class: 'card' },
          el('p', { style: 'margin:0 0 4px;font-size:16px;font-weight:700' }, tr('עוד אין תבניות')),
          el('p', { class: 'muted', style: 'margin:0;font-size:14px' }, tr('בחר תרגילים מהספרייה, קבע כמה סטים, ושמור. מכאן אפשר להתחיל אימון בלחיצה.')))
      : templates.map(templateCard),
    el('a', { class: 'dashed', href: '#/template' }, svg(PLUS), el('span', {}, tr('תבנית חדשה'))));
}
