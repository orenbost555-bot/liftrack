import { el, svg, mount } from '../dom.js';
import { navigate } from '../router.js';
import { getWorkouts, getTemplates, getOverrides, getSwapState, saveSwapState, saveTemplates } from '../store.js';
import { allExercises } from '../logic/exercises.js';
import { stagnation, alternatives, replaceInTemplates, snooze, never } from '../logic/swap.js';
import { tr, BACK, FORWARD } from '../i18n.js';

let ALL = allExercises();
let BY_ID = new Map(ALL.map((e) => [e.id, e]));

/** קו התקדמות קטן: עלייה בסגול, הקיפאון האחרון בכתום מקווקו. */
function miniChart(points, metric, weeks) {
  const vals = points.slice(-8).map((p) => (metric === 'reps' ? p.maxReps : p.weight));
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = (i) => 6 + (i * 288) / Math.max(1, vals.length - 1);
  const y = (v) => 70 - ((v - lo) / span) * 58;
  const lastUp = vals.reduce((acc, v, i) => (i > 0 && v > Math.max(...vals.slice(0, i)) ? i : acc), 0);
  const path = (from, to) => vals.slice(from, to + 1).map((v, k) => `${k ? 'L' : 'M'}${x(from + k).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return svg(`<svg viewBox="0 0 300 80" width="100%" height="80" role="img" aria-label="${tr('גרף: עלייה ואז קיפאון של {n} שבועות', { n: weeks })}">
    <path d="${path(0, lastUp)}" fill="none" stroke="#5B3DF5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${path(lastUp, vals.length - 1)}" fill="none" stroke="#FF9F1C" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 6"/>
    <circle cx="${x(lastUp).toFixed(1)}" cy="${y(vals[lastUp]).toFixed(1)}" r="5" fill="#5B3DF5" stroke="#fff" stroke-width="2"/>
    <circle cx="${x(vals.length - 1).toFixed(1)}" cy="${y(vals.at(-1)).toFixed(1)}" r="5" fill="#FF9F1C" stroke="#fff" stroke-width="2"/>
  </svg>`);
}

/** הצעה להחלפת תרגיל תקוע: #/swap?ex=... */
export function swapScreen(params) {
  // הספרייה יכולה להשתנות (תרגילים מותאמים), לכן מרעננים בכל כניסה למסך.
  ALL = allExercises();
  BY_ID = new Map(ALL.map((e) => [e.id, e]));
  const ex = BY_ID.get(params.get('ex') ?? '');
  const history = getWorkouts().filter((w) => w.endedAt !== null);
  const info = ex ? stagnation(history, ex.id, Date.now(), getOverrides()) : null;
  if (!ex || !info) { navigate('/home'); return el('main', { class: 'screen' }); }

  const done = new Set(history.flatMap((w) => w.exercises.map((e) => e.exerciseId)));
  const alts = alternatives(ex, ALL, done);
  const inTemplates = getTemplates().filter((t) => t.items.some((i) => i.exerciseId === ex.id)).length;
  let chosen = null; // תרגיל חלופי שהמתאמן לחץ עליו, מחכה לאישור
  const main = el('main', { class: 'screen screen--no-nav' });
  const what = info.metric === 'reps' ? tr('בחזרות') : tr('במשקל');

  const leave = (swapState) => { saveSwapState(swapState); navigate('/home'); };

  function render() {
    mount(main,
      el('div', { class: 'topbar' },
        el('a', { class: 'back', href: '#/home', 'aria-label': tr('חזרה') }, BACK()),
        el('h1', { class: 'title' }, tr('הצעה להחלפת תרגיל'))),
      el('section', { class: 'card swap' },
        el('div', { class: 'swap__head' },
          el('span', { class: 'swap__icon', 'aria-hidden': 'true' }, '⇄'),
          el('div', { class: 'swap__text' },
            el('span', { class: 'swap__name' }, ex.he),
            el('span', { class: 'muted' }, tr('{s} אימונים ו-{w} שבועות בלי שיפור {what}', { s: info.sessions, w: info.weeks, what })))),
        miniChart(info.points, info.metric, info.weeks),
        el('span', { class: 'swap__msg' }, tr('הגוף התרגל לתרגיל הזה! תחליף גירוי ותמשיך לעלות!'))),
      alts.length ? el('h2', { class: 'lib__subtitle' }, tr('חלופות ל{name}', { name: tr(ex.sub) })) : null,
      alts.length
        ? el('div', { class: 'card lib__card' }, alts.map((a) =>
            el('button', { class: 'alt', 'aria-pressed': chosen === a.id ? 'true' : 'false', onclick: () => { chosen = chosen === a.id ? null : a.id; render(); } },
              el('span', { class: 'alt__text' }, el('span', { class: 'alt__he' }, a.he), el('span', { class: 'muted alt__en' }, a.en)),
              el('span', { class: 'alt__mark', 'aria-hidden': 'true' }, chosen === a.id ? '✓' : FORWARD()))))
        : el('div', { class: 'card muted' }, tr('לא נמצאו חלופות דומות. אפשר לבחור תרגיל אחר בספרייה.')),
      chosen
        ? el('div', { class: 'prefs__confirm', role: 'alertdialog' },
            el('span', {}, inTemplates
              ? tr('להחליף את {a} ב{b} {where}? ההיסטוריה נשמרת.', { a: ex.he, b: BY_ID.get(chosen).he, where: inTemplates === 1 ? tr('בתבנית אחת') : tr('ב-{n} תבניות', { n: inTemplates }) })
              : tr('התרגיל הזה לא נמצא באף תבנית, אז אין מה להחליף. אפשר להוסיף את החלופה לתבנית בעורך.')),
            inTemplates
              ? el('div', { class: 'prefs__btns' },
                  el('button', { class: 'btn btn--sm', onclick: () => { saveTemplates(replaceInTemplates(getTemplates(), ex.id, chosen).templates); leave(getSwapState()); } }, tr('כן, החלף')),
                  el('button', { class: 'outline-btn', onclick: () => { chosen = null; render(); } }, tr('ביטול')))
              : null)
        : null,
      el('div', { class: 'swap__links' },
        el('button', { class: 'swap__link', onclick: () => leave(snooze(getSwapState(), ex.id, Date.now())) }, tr('השאר את התרגיל ובדוק שוב בעוד שבועיים')),
        el('button', { class: 'swap__link', onclick: () => leave(never(getSwapState(), ex.id)) }, tr('אל תציע לי שוב על התרגיל הזה'))),
      el('a', { class: 'btn btn--block', href: '#/library' }, tr('בחר תרגיל אחר בספרייה')));
  }
  render();
  return main;
}
