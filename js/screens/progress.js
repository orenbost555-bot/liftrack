import { el, mount } from '../dom.js';
import { getWorkouts, getOverrides, setOverride, getProfile } from '../store.js';
import { LIBRARY } from '../data/exercises.js';
import { allExercises } from '../logic/exercises.js';
import {
  exerciseSeries, filterRange, seriesStats, exerciseStatus, trainedExercises, isImproved, metricValue,
} from '../logic/progress.js';
import { formatNumber, formatDayMonth } from '../logic/summary.js';
import { getGoals } from '../store.js';
import { lineChart } from '../components/line-chart.js';
import { tr, BACK } from '../i18n.js';

let BY_ID = new Map(allExercises().map((e) => [e.id, e]));
const RANGE_LABELS = [['month', tr('חודש')], ['quarter', tr('3 חודשים')], ['all', tr('הכל')]];
export const STATUS = {
  improving: { label: tr('שיפור'), cls: 'st--up' },
  trend: { label: tr('מגמת שיפור'), cls: 'st--trend' },
  stagnant: { label: tr('קיפאון'), cls: 'st--flat' },
  new: { label: tr('מעט נתונים'), cls: 'st--flat' },
};

/** התקדמות בתרגיל: #/progress?ex=ID (בלי פרמטר: התרגיל שבוצע לאחרונה). */
export function progressScreen(params) {
  // הספרייה יכולה להשתנות (תרגילים מותאמים), לכן מרעננים בכל כניסה למסך.
  BY_ID = new Map(allExercises().map((e) => [e.id, e]));
  const history = getWorkouts().filter((w) => w.endedAt !== null);
  const trained = trainedExercises(history);
  const unit = getProfile()?.unit === 'lb' ? tr('פאונד') : tr('ק״ג');

  if (trained.length === 0) {
    return el('main', { class: 'screen' },
      el('h1', { class: 'title' }, tr('התקדמות')),
      el('div', { class: 'card' },
        el('p', { style: 'margin:0 0 4px;font-size:16px;font-weight:700' }, tr('עוד אין נתונים')),
        el('p', { class: 'muted', style: 'margin:0;font-size:14px' }, tr('אחרי האימון הראשון תראה כאן גרף לכל תרגיל, ואחרי כמה אימונים גם את ההתקדמות של כל שריר.'))),
      el('a', { class: 'dashed', href: '#/workouts' }, tr('לתבניות שלי')));
  }

  let exId = trained.some((t) => t.exerciseId === params.get('ex')) ? params.get('ex') : trained[0].exerciseId;
  let metric = 'weight';
  let range = 'quarter';
  let view = 'main'; // 'main' | 'pick'
  let selected = null;

  const main = el('main', { class: 'screen' });
  const meta = () => BY_ID.get(exId);

  function pickerView() {
    mount(main,
      el('div', { class: 'topbar' },
        el('button', { class: 'back', 'aria-label': tr('חזרה'), onclick: () => { view = 'main'; render(); } }, BACK()),
        el('h1', { class: 'title' }, tr('בחירת תרגיל'))),
      LIBRARY.map((g) => {
        const rows = trained.filter((t) => BY_ID.get(t.exerciseId)?.group === g.id);
        return rows.length === 0 ? null : el('section', { class: 'lib__sub' },
          el('h2', { class: 'lib__subtitle' }, tr(g.name)),
          el('div', { class: 'card lib__card' }, rows.map((t) =>
            el('button', { class: 'ex__head pick', onclick: () => { exId = t.exerciseId; selected = null; view = 'main'; render(); } },
              el('span', { class: 'ex__text' }, el('span', { class: 'ex__he' }, BY_ID.get(t.exerciseId).he), el('span', { class: 'ex__en' }, tr('{n} אימונים', { n: t.count }))),
              t.exerciseId === exId ? el('span', { class: 'pick__mark pick__mark--on', 'aria-hidden': 'true' }, '✓') : null))));
      }));
  }

  function render() {
    if (view === 'pick') { pickerView(); return; }
    const ex = meta();
    const all = exerciseSeries(history, exId, getOverrides());
    const bw = all.some((p) => p.bw);
    if (bw) metric = 'reps'; // בתרגיל משקל גוף אין משקל לעקוב אחריו
    const stats = seriesStats(all, metric);
    const status = STATUS[exerciseStatus(all, metric)];
    const visible = filterRange(all, range, Date.now());
    const shown = visible.length ? visible : all.slice(-1); // טווח בלי אימונים: מציגים את האחרון
    if (selected === null || selected >= shown.length) selected = shown.length - 1;

    const unitFor = metric === 'reps' ? tr('חזרות') : unit;
    const fmt = (p) => (metric === 'reps' ? tr('{n} חזרות', { n: p.maxReps }) : bw ? tr('{n} חזרות', { n: p.reps }) : `${formatNumber(p.weight)} ${unit} × ${p.reps}`);
    const chartPoints = shown.map((p) => ({
      t: p.t, v: metricValue(p, metric), mark: isImproved(p, metric) ? 'up' : 'flat',
      value: fmt(p), note: isImproved(p, metric) ? tr('שיפור') : p.first ? tr('נקודת פתיחה') : '',
      cells: [formatDayMonth(p.t), fmt(p), isImproved(p, metric) ? tr('שיפור') : p.first ? tr('פתיחה') : '—'],
    }));

    const readout = el('div', { class: 'card sel' });
    const fillReadout = () => {
      const p = shown[selected];
      const imp = isImproved(p, metric);
      const key = `${p.workoutId}:${exId}:${metric}`;
      mount(readout,
        el('div', { class: 'sel__text' },
          el('span', { class: 'muted sel__date' }, `${formatDayMonth(p.t)} · ${tr('הנקודה שנבחרה')}`),
          el('span', { class: 'sel__val' }, fmt(p)),
          el('span', { class: `tag ${imp ? 'tag--bw' : 'tag--sec'}` }, imp ? tr('סומן כשיפור') : p.first ? tr('נקודת פתיחה') : tr('לא שיפור'))),
        p.first ? null : el('button', { class: 'outline-btn', onclick: () => { setOverride(key, !imp); render(); } }, imp ? tr('לא שיפור?') : tr('כן, שיפור')));
    };

    const g = getGoals().find((x) => x.type === 'exercise' && x.exerciseId === exId && !x.achievedAt && x.metric === metric);
    const chart = shown.length ? lineChart(chartPoints, {
      format: (v) => formatNumber(v), selected, goal: g ? { value: g.target, label: tr('יעד {v}', { v: formatNumber(g.target) }) } : null,
      headers: [tr('תאריך'), metric === 'reps' ? tr('חזרות מקסימליות') : tr('הסט הטוב ביותר'), tr('סטטוס')],
      ariaLabel: tr('גרף {what} ב{name}: {n} אימונים, מ-{a} ל-{b}', { what: metric === 'reps' ? tr('חזרות') : tr('משקל'), name: ex.he, n: chartPoints.length, a: chartPoints[0].value, b: chartPoints.at(-1).value }),
      onSelect: (i) => { selected = i; fillReadout(); },
    }) : null;
    fillReadout();

    mount(main,
      el('div', { class: 'topbar' },
        el('button', { class: 'picker', onclick: () => { view = 'pick'; render(); } },
          el('span', { class: 'picker__text' }, el('span', { class: 'picker__name' }, ex.he), el('span', { class: 'muted wk__sub' }, `${tr('התקדמות בתרגיל')} · ${tr(ex.sub)}`)),
          el('span', { class: 'picker__chev', 'aria-hidden': 'true' }, '⌄'))),
      el('section', { class: 'card chartcard' },
        el('div', { class: 'chartcard__head' },
          el('div', { class: 'chartcard__big' },
            el('span', { class: 'muted chartcard__cap' }, tr('עלייה מהמקסימום ההתחלתי')),
            el('span', { class: 'chartcard__num' }, stats.gain > 0 ? '↑ ' : '', `${formatNumber(stats.gain)} ${unitFor}`)),
          stats.pct !== null
            ? el('div', { class: `pct${stats.gain > 0 ? '' : ' pct--flat'}` }, el('span', { class: 'pct__cap' }, tr('התקדמות באחוזים')), el('span', { class: 'pct__val' }, `${stats.pct}%`))
            : null),
        bw ? null : el('div', { class: 'metrics' }, [['weight', tr('משקל')], ['reps', tr('חזרות')]].map(([m, label]) =>
          el('button', { class: 'metrics__btn', 'aria-pressed': m === metric ? 'true' : 'false', onclick: () => { metric = m; selected = null; render(); } }, label))),
        chart ? chart.node : null,
        el('div', { class: 'chartcard__foot' },
          el('div', { class: 'legend' },
            el('span', { class: 'legend__item' }, el('span', { class: 'dot dot--on' }), tr('שיפור')),
            el('span', { class: 'legend__item' }, el('span', { class: 'dot dot--off' }), tr('ללא שיפור'))),
          el('div', { class: 'ranges' }, RANGE_LABELS.map(([r, label]) =>
            el('button', { class: 'ranges__btn', 'aria-pressed': r === range ? 'true' : 'false', onclick: () => { range = r; selected = null; render(); } }, label)))),
        chart ? chart.toggle : null),
      readout,
      el('div', { class: 'duo' },
        el('div', { class: 'card mini' }, el('span', { class: 'muted mini__cap' }, tr('שיא אישי')), el('span', { class: 'mini__val' }, bw ? tr('{n} חזרות', { n: stats.pr.reps }) : `${formatNumber(stats.pr.weight)} × ${stats.pr.reps}`)),
        el('div', { class: 'card mini' }, el('span', { class: 'muted mini__cap' }, tr('מצב נוכחי')), el('span', { class: `mini__val ${status.cls}` }, status.label))),
      el('a', { class: 'hero muscle-link', href: `#/muscle?g=${encodeURIComponent(ex.group)}` },
        el('span', { class: 'muscle-link__text' },
          el('span', { class: 'muscle-link__cap' }, tr('ההתקדמות של כל {name}', { name: tr(LIBRARY.find((g) => g.id === ex.group).name) })),
          el('span', { class: 'muscle-link__title' }, tr('לגרף השריר ›')))));
  }
  render();
  return main;
}
