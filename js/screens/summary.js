import { el, mount } from '../dom.js';
import { navigate } from '../router.js';
import { getWorkout, getWorkouts, deleteWorkout, getProfile, getSettings, getGoals, saveGoals } from '../store.js';
import { evaluateAll, goalTitle } from '../logic/goals.js';
import { allExercises } from '../logic/exercises.js';
import { doneSetCount, durationMinutes } from '../logic/workout.js';
import { compareWorkout, motivationFor, formatNumber, formatDate } from '../logic/summary.js';
import { tr, BACK } from '../i18n.js';

let BY_ID = new Map(allExercises().map((e) => [e.id, e]));

const stat = (value, label, accent) =>
  el('div', { class: 'stat' }, el('span', { class: `stat__v${accent ? ' stat__v--ok' : ''}` }, String(value)), el('span', { class: 'muted stat__l' }, label));

// \u2066...\u2069 (בידוד כיוון): בעברית הסימן + או − היה מוצג בצד הלא נכון של המספר
const signed = (n) => `\u2066${n > 0 ? '+' : n < 0 ? '−' : ''}${formatNumber(Math.abs(n))}\u2069`;

/** סיכום אימון שהסתיים: #/summary?id=... */
export function summaryScreen(params) {
  // הספרייה יכולה להשתנות (תרגילים מותאמים), לכן מרעננים בכל כניסה למסך.
  BY_ID = new Map(allExercises().map((e) => [e.id, e]));
  const w = getWorkout(params.get('id') ?? '');
  if (!w) { navigate('/history'); return el('main', { class: 'screen' }); }

  const unit = getProfile()?.unit === 'lb' ? tr('פאונד') : tr('ק״ג');
  const cmp = compareWorkout(w, getWorkouts());
  const msg = motivationFor(cmp);
  let confirmDelete = false;
  // יעדים שהושגו באימון הזה: נקבעים ונשמרים כאן פעם אחת, והחגיגה מוצגת בסיכום
  const ev = evaluateAll(getGoals(), getWorkouts().filter((x) => x.endedAt !== null), allExercises(), Date.now());
  if (ev.newlyAchieved.length) saveGoals(ev.goals);
  const achieved = ev.newlyAchieved;
  const main = el('main', { class: 'screen screen--no-nav' });

  const deltaChip = cmp.delta === null ? null
    : el('span', { class: `chipnote ${cmp.delta >= 0 ? 'chipnote--up' : 'chipnote--down'}` },
        `${cmp.delta >= 0 ? '↑' : '↓'} ${signed(cmp.delta)} ${unit}${cmp.pct !== null ? ` · \u2066${cmp.pct > 0 ? '+' : cmp.pct < 0 ? '−' : ''}${Math.abs(cmp.pct)}%\u2069` : ''}`);

  function render() {
    mount(main,
      el('div', { class: 'topbar' },
        el('a', { class: 'back', href: '#/history', 'aria-label': tr('להיסטוריה') }, BACK()),
        el('div', { class: 'topbar__text' },
          el('h1', { class: 'title' }, tr('סיכום אימון')),
          el('span', { class: 'muted wk__sub' }, `${w.name} · ${formatDate(w.endedAt)}`))),
      el('section', { class: 'hero sum' },
        el('span', { class: 'sum__label' }, tr('סך נפח העבודה באימון')),
        el('div', { class: 'sum__num' }, el('span', { class: 'sum__big' }, formatNumber(cmp.volume)), el('span', { class: 'sum__unit' }, unit)),
        cmp.prevVolume === null
          ? el('span', { class: 'sum__sub' }, tr('אין אימון קודם מהתבנית הזו להשוואה'))
          : el('div', { class: 'sum__cmp' }, deltaChip, el('span', { class: 'sum__sub' }, tr('לעומת האימון הקודם ({v})', { v: formatNumber(cmp.prevVolume) })))),
      getSettings().motivation === false ? null : el('section', { class: `msg msg--${msg.tone}` },
        el('span', { class: 'msg__title' }, msg.title),
        el('span', { class: 'msg__text' }, msg.text)),
      achieved.length
        ? el('a', { class: 'msg msg--up', href: '#/goals', role: 'status' },
            el('span', { class: 'msg__title' }, achieved.length === 1 ? tr('הושג יעד!') : tr('הושגו {n} יעדים!', { n: achieved.length })),
            el('span', { class: 'msg__text' }, achieved.map((g) => goalTitle(g, allExercises(), unit)).join(' · ')))
        : null,
      el('div', { class: 'stats' },
        stat(durationMinutes(w), tr('דקות')), stat(doneSetCount(w), tr('סטים')), stat(cmp.improvements, tr('שיפורים'), cmp.improvements > 0)),
      cmp.perExercise.length
        ? [el('h2', { class: 'lib__subtitle' }, tr('נפח לפי תרגיל')),
           el('div', { class: 'card lib__card' }, cmp.perExercise.map((p) =>
             el('div', { class: 'vrow' },
               el('span', { class: 'vrow__name' }, BY_ID.get(p.exerciseId)?.he ?? p.exerciseId),
               el('span', { class: 'vrow__vol' }, formatNumber(p.volume)),
               el('span', { class: `vrow__delta${p.delta === null ? ' vrow__delta--new' : p.delta > 0 ? ' vrow__delta--up' : p.delta < 0 ? ' vrow__delta--down' : ''}` },
                 p.delta === null ? tr('חדש') : signed(p.delta))))),
           el('p', { class: 'muted fine' }, tr('נפח = משקל × חזרות, מחוברים על כל הסטים. תרגילי משקל גוף לא נכללים.'))]
        : el('p', { class: 'muted fine' }, tr('באימון הזה היו רק תרגילי משקל גוף, ולכן אין נפח לחשב.')),
      el('a', { class: 'outline-btn sum__edit', href: `#/edit-workout?id=${encodeURIComponent(w.id)}` }, tr('ערוך אימון')),
      el('button', { class: 'link-danger', onclick: () => {
        if (!confirmDelete) { confirmDelete = true; render(); return; }
        deleteWorkout(w.id); navigate('/history');
      } }, confirmDelete ? tr('לחץ שוב כדי למחוק את האימון לצמיתות') : tr('מחק אימון')),
      el('div', { class: 'savebar' }, el('a', { class: 'btn btn--block', href: '#/home' }, tr('סיום וחזרה לבית'))));
  }
  render();
  return main;
}
