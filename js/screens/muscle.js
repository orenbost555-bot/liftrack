import { el, mount } from '../dom.js';
import { getWorkouts, getOverrides } from '../store.js';
import { LIBRARY } from '../data/exercises.js';
import { allExercises } from '../logic/exercises.js';
import { exerciseSeries, filterRange, seriesStats, exerciseStatus, muscleSeries, weekStats } from '../logic/progress.js';
import { formatDayMonth } from '../logic/summary.js';
import { getGoals } from '../store.js';
import { lineChart } from '../components/line-chart.js';
import { STATUS } from './progress.js';
import { tr, BACK, FORWARD } from '../i18n.js';

let ALL = allExercises();
const RANGE_LABELS = [['month', tr('חודש')], ['quarter', tr('3 חודשים')], ['all', tr('הכל')]];
const BAR_FULL = 25; // אחוזים שממלאים את הפס במלואו (ואם תרגיל עבר אותו, הסקאלה גדלה)

/** התקדמות של שריר שלם: #/muscle?g=GROUP_ID */
export function muscleScreen(params) {
  // הספרייה יכולה להשתנות (תרגילים מותאמים), לכן מרעננים בכל כניסה למסך.
  ALL = allExercises();
  const group = LIBRARY.find((g) => g.id === params.get('g')) ?? LIBRARY[0];
  const history = getWorkouts().filter((w) => w.endedAt !== null);
  const overrides = getOverrides();
  let sub = null; // null = כל הקבוצה
  let range = 'quarter';

  const main = el('main', { class: 'screen' });

  function render() {
    const exercises = ALL.filter((e) => e.group === group.id && (sub === null || e.sub === sub));
    const ids = exercises.map((e) => e.id);
    const series = muscleSeries(history, ids);
    const pts = filterRange(series.points.map((p) => ({ ...p, t: p.t })), range, Date.now());
    const shown = pts.length ? pts : series.points.slice(-1);

    const rows = exercises
      .map((e) => ({ e, s: exerciseSeries(history, e.id, overrides) }))
      .filter(({ s }) => s.length > 0 && !s[0].bw)
      .map(({ e, s }) => ({ e, stats: seriesStats(s), status: STATUS[exerciseStatus(s)] }))
      .sort((a, b) => (b.stats.pct ?? -1) - (a.stats.pct ?? -1));
    const barMax = Math.max(BAR_FULL, ...rows.map((r) => r.stats.pct ?? 0));
    const week = weekStats(history, ids, Date.now());

    const mg = getGoals().find((x) => x.type === 'muscle' && x.group === group.id && !x.achievedAt);
    const chart = shown.length
      ? lineChart(shown.map((p) => ({ t: p.t, v: p.v, mark: 'up', value: `${p.v}%`, note: '', cells: [formatDayMonth(p.t), `${p.v}%`] })), {
          format: (v) => `${v}%`, goal: mg && sub === null ? { value: mg.target, label: tr('יעד {v}', { v: `${mg.target}%` }) } : null, headers: [tr('תאריך'), tr('התקדמות כוללת')],
          ariaLabel: tr('גרף התקדמות {name}: {v} אחוזים מהנקודה הראשונה', { name: tr(group.name), v: shown.at(-1).v }),
        })
      : null;

    mount(main,
      el('div', { class: 'topbar' },
        el('a', { class: 'back', href: '#/progress', 'aria-label': tr('חזרה להתקדמות') }, BACK()),
        el('div', { class: 'topbar__text' },
          el('h1', { class: 'title' }, tr(group.name)),
          el('span', { class: 'muted wk__sub' }, tr('התקדמות כוללת מכל התרגילים')))),
      group.subs.length > 1
        ? el('div', { class: 'chips' }, [{ name: null, label: tr('הכל') }, ...group.subs.map((s) => ({ name: s.name, label: tr(s.name) }))].map((c) =>
            el('button', { class: 'chip-btn', 'aria-pressed': c.name === sub ? 'true' : 'false', onclick: () => { sub = c.name; render(); } }, c.label)))
        : null,
      el('section', { class: 'card chartcard' },
        el('div', { class: 'chartcard__head' },
          el('div', { class: 'chartcard__big' },
            el('span', { class: 'muted chartcard__cap' }, tr('התקדמות כוללת בשריר')),
            el('span', { class: 'chartcard__num' }, series.pct === null ? '—' : `${series.pct > 0 ? '↑ ' : ''}${series.pct}%`)),
          series.count > 0 ? el('span', { class: 'tag tag--main' }, tr('מחושב מ-{n} תרגילים', { n: series.count })) : null),
        chart
          ? chart.node
          : el('p', { class: 'muted', style: 'margin:8px 0;font-size:14px' }, tr('כדי לראות התקדמות צריך לפחות שני אימונים של תרגיל אחד בשריר הזה (תרגילי משקל גוף לא נכללים).')),
        el('div', { class: 'chartcard__foot' },
          el('span', { class: 'muted legend__item' }, tr('הממוצע של כל התרגילים')),
          el('div', { class: 'ranges' }, RANGE_LABELS.map(([r, label]) =>
            el('button', { class: 'ranges__btn', 'aria-pressed': r === range ? 'true' : 'false', onclick: () => { range = r; render(); } }, label)))),
        chart ? chart.toggle : null),
      rows.length
        ? [el('h2', { class: 'lib__subtitle' }, tr('התרגילים של השריר')),
           el('div', { class: 'card lib__card' }, rows.map(({ e, stats, status }) =>
             el('a', { class: 'mrow', href: `#/progress?ex=${encodeURIComponent(e.id)}` },
               el('div', { class: 'mrow__top' },
                 el('span', { class: 'mrow__name' }, e.he),
                 el('span', { class: `tag ${status.cls}` }, status.label),
                 el('span', { class: 'mrow__pct' }, stats.pct === null ? '—' : `${stats.pct}%`),
                 el('span', { class: 'muted', 'aria-hidden': 'true' }, FORWARD())),
               el('div', { class: 'bar' }, el('div', { class: 'bar__fill', style: `width:${Math.min(100, ((stats.pct ?? 0) / barMax) * 100)}%` })))))]
        : null,
      el('div', { class: 'duo' },
        el('div', { class: 'card mini' }, el('span', { class: 'muted mini__cap' }, tr('סטים השבוע')), el('span', { class: 'mini__val' }, tr('{n} סטים', { n: week.sets }))),
        el('a', { class: 'card mini mini--link', href: '#/history' },
          el('span', { class: 'mini__txt' }, el('span', { class: 'muted mini__cap' }, tr('אימונים לשריר')), el('span', { class: 'mini__val' }, tr('{n} השבוע', { n: week.workouts }))),
          el('span', { class: 'muted', 'aria-hidden': 'true' }, FORWARD()))));
  }
  render();
  return main;
}
