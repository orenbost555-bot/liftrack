import { el, mount } from '../dom.js';
import { getTemplates, getSettings, saveSettings, saveTemplates } from '../store.js';
import { allExercises } from '../logic/exercises.js';
import { DAY_NAMES, slotsOf } from '../logic/templates.js';
import { planWeek, applyPlan, defaultAvailability, windowMinutes, GROUP_NAMES, MIN_PER_WEEK, MAX_PER_WEEK } from '../logic/advisor.js';
import { segmented } from '../components/segmented.js';
import { navigate } from '../router.js';
import { tr, BACK } from '../i18n.js';

/** יועץ התזמון: מזינים זמנים פנויים ועדיפויות, ומקבלים הצעה ללוח שבועי עם הסברים. הכל מחושב בטלפון. */
export function advisorScreen() {
  const templates = getTemplates();
  const byId = new Map(allExercises().map((e) => [e.id, e]));
  const saved = getSettings().advisor ?? {};
  const form = {
    avail: defaultAvailability().map((d, i) => ({ ...d, ...(saved.avail?.[i] ?? {}) })),
    counts: Object.fromEntries(templates.map((t) => [t.id, saved.counts?.[t.id] ?? Math.max(MIN_PER_WEEK, Math.min(MAX_PER_WEEK, slotsOf(t).length || 1))])),
    priority: Object.fromEntries(templates.filter((t) => saved.priority?.[t.id] === 'high').map((t) => [t.id, 'high'])),
    timeOfDay: saved.timeOfDay ?? 'any',
  };
  let plan = null;
  const main = el('main', { class: 'screen screen--no-nav' });
  const persist = () => saveSettings({ advisor: form });
  const topbar = el('div', { class: 'topbar' },
    el('button', { class: 'back', type: 'button', 'aria-label': tr('חזרה'), onclick: () => navigate('/workouts') }, BACK()),
    el('div', { class: 'topbar__text' }, el('h1', { class: 'title' }, tr('יועץ תזמון'))));

  if (templates.length === 0) {
    mount(main, topbar,
      el('div', { class: 'card' },
        el('p', { style: 'margin:0 0 4px;font-size:16px;font-weight:700' }, tr('עוד אין תבניות')),
        el('p', { class: 'muted', style: 'margin:0;font-size:14px' }, tr('כדי לקבל הצעה לוח אימונים צריך לפחות תבנית אחת.'))),
      el('a', { class: 'dashed', href: '#/template' }, el('span', {}, tr('תבנית חדשה'))));
    return main;
  }

  const days = (list) => list.map((d) => DAY_NAMES[d]).join(', ');
  const groupsText = (groups) => groups.map((g) => tr(GROUP_NAMES[g])).join(', ');

  function reasonText(r) {
    if (r.code === 'rest') {
      const key = r.gap === 1 ? 'יום אחרי {name}: אותם שרירים ({groups}), אז כדאי לפנות עוד יום' : r.gap === 2 ? 'יומיים אחרי {name}: מנוחה לשרירים המשותפים ({groups})' : '{n} ימים אחרי {name}: מנוחה לשרירים המשותפים ({groups})';
      return tr(key, { n: r.gap, name: r.name, groups: groupsText(r.groups) });
    }
    if (r.code === 'free') return tr('עובד על שרירים שונים משאר האימונים');
    return tr('חלון פנוי {from}-{to}, והאימון נמשך כ-{m} דקות', { from: r.from, to: r.to, m: r.minutes });
  }

  function availRow(d, i) {
    const bad = d.on && windowMinutes(d) === 0;
    return el('div', { class: 'slot', 'data-adv-day': String(i) },
      el('div', { class: 'row adv__day' },
        el('button', { class: 'chip-btn', type: 'button', 'aria-pressed': String(d.on), onclick: () => { d.on = !d.on; plan = null; persist(); render(); } }, DAY_NAMES[i]),
        d.on ? el('input', { class: 'field time', type: 'time', value: d.from, 'aria-label': tr('משעה'), onchange: (e) => { d.from = e.target.value; plan = null; persist(); render(); } }) : null,
        d.on ? el('input', { class: 'field time', type: 'time', value: d.to, 'aria-label': tr('עד שעה'), onchange: (e) => { d.to = e.target.value; plan = null; persist(); render(); } }) : null,
        !d.on ? el('span', { class: 'muted adv__off' }, tr('לא פנוי')) : null),
      bad ? el('p', { class: 'slot__warn', role: 'status' }, tr('שעת הסיום צריכה להיות אחרי שעת ההתחלה')) : null);
  }

  function templateRow(t) {
    const n = form.counts[t.id];
    const high = form.priority[t.id] === 'high';
    return el('div', { class: 'card adv__tpl', 'data-adv-tpl': t.id },
      el('span', { class: 'adv__name' }, t.name),
      el('div', { class: 'item__bottom' },
        el('div', { class: 'stepper' },
          el('button', { class: 'stepper__btn', type: 'button', 'aria-label': tr('פחות פעמים בשבוע'), disabled: n <= MIN_PER_WEEK, onclick: () => { form.counts[t.id] = n - 1; plan = null; persist(); render(); } }, '−'),
          el('span', { class: 'stepper__val' }, tr('{n} בשבוע', { n })),
          el('button', { class: 'stepper__btn', type: 'button', 'aria-label': tr('יותר פעמים בשבוע'), disabled: n >= MAX_PER_WEEK, onclick: () => { form.counts[t.id] = n + 1; plan = null; persist(); render(); } }, '+')),
        el('button', { class: 'chip-btn adv__prio', type: 'button', 'aria-pressed': String(high),
          onclick: () => { if (high) delete form.priority[t.id]; else form.priority[t.id] = 'high'; plan = null; persist(); render(); } }, tr('חשוב לי במיוחד'))));
  }

  function suggest() {
    plan = planWeek({ templates, byId, availability: form.avail, counts: form.counts, priority: form.priority, timeOfDay: form.timeOfDay });
    render();
    main.querySelector('.adv__result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function apply() {
    saveTemplates(applyPlan(templates, plan));
    navigate('/workouts');
  }

  function resultCard() {
    if (!plan) return null;
    return el('section', { class: 'adv__result', 'aria-live': 'polite' },
      el('h2', { class: 'lib__subtitle' }, tr('הלוח המוצע')),
      plan.placements.length === 0
        ? el('div', { class: 'card' }, el('p', { class: 'muted', style: 'margin:0' }, tr('לא הצלחתי לשבץ אימונים. בדוק שיש ימים פנויים עם חלון ארוך מספיק.')))
        : plan.placements.map((p) => el('div', { class: 'card adv__plan', 'data-plan-day': String(p.day) },
            el('div', { class: 'adv__plantop' },
              el('span', { class: 'adv__name' }, p.name),
              el('span', { class: 'tag tag--main' }, `${DAY_NAMES[p.day]} ${p.time}`)),
            el('ul', { class: 'adv__why' }, p.reasons.map((r) => el('li', {}, reasonText(r)))))),
      plan.unplaced.map((u) => el('p', { class: 'slot__warn', role: 'status' },
        u.reason === 'no-window'
          ? tr('{name}: אין יום עם חלון ארוך מספיק (האימון נמשך כ-{m} דקות)', { name: u.name, m: u.minutes })
          : tr('{name}: אין מספיק ימים פנויים לכל האימונים. אפשר לפנות עוד יום, או להוריד את מספר הפעמים בשבוע.', { name: u.name }))),
      plan.placements.length ? el('p', { class: 'muted adv__rest' }, tr('ימי מנוחה: {days}', { days: days(plan.restDays) })) : null,
      plan.placements.length ? el('p', { class: 'muted fine' }, tr('אישור הלוח מחליף את הימים והשעות של התבניות. אימונים שכבר בוצעו לא משתנים.')) : null,
      plan.placements.length ? el('button', { class: 'btn btn--block', type: 'button', onclick: apply }, tr('אשר והחל על התבניות')) : null);
  }

  function render() {
    const anyDay = form.avail.some((d) => windowMinutes(d) > 0);
    mount(main, topbar,
      el('p', { class: 'muted fine' }, tr('ספר לי מתי אתה פנוי ומה חשוב לך, ואציע לוח אימונים שבועי. החישוב נעשה בטלפון, ושום מידע לא נשלח.')),
      el('div', { class: 'card sched' },
        el('span', { class: 'sched__title' }, tr('מתי אתה פנוי?')),
        form.avail.map(availRow)),
      el('div', { class: 'sched' },
        el('span', { class: 'sched__title' }, tr('כמה פעמים בשבוע לכל תבנית?')),
        templates.map(templateRow)),
      el('div', { class: 'card sched' },
        el('span', { class: 'sched__title' }, tr('מתי נוח לך להתאמן?')),
        segmented({ options: [['morning', tr('בתחילת החלון')], ['any', tr('לא משנה')], ['evening', tr('בסוף החלון')]], value: form.timeOfDay,
          onChange: (v) => { form.timeOfDay = v; plan = null; persist(); } })),
      el('button', { class: 'btn btn--block adv__go', type: 'button', disabled: !anyDay, onclick: suggest }, tr('הצע לי לוח')),
      !anyDay ? el('p', { class: 'slot__warn', role: 'status' }, tr('סמן לפחות יום פנוי אחד')) : null,
      resultCard());
  }
  render();
  return main;
}
