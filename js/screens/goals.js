import { el, mount } from '../dom.js';
import { getSettings, getGoals, saveGoal, saveGoals, deleteGoal, getWorkouts, getProfile, newId } from '../store.js';
import { LIBRARY } from '../data/exercises.js';
import { QUOTES } from '../data/quotes.js';
import { allExercises } from '../logic/exercises.js';
import { pick } from '../logic/greeting.js';
import { exerciseSeries, seriesStats, trainedExercises } from '../logic/progress.js';
import {
  GOAL_TYPES, newGoal, validateGoal, evaluateAll, currentValue, goalTitle, progressText, achievedNote, leftLabel, endOfDay,
} from '../logic/goals.js';
import { formatDayMonth, formatNumber } from '../logic/summary.js';
import { exerciseBrowser } from '../components/exercise-browser.js';
import { tr, BACK } from '../i18n.js';
import { bodyFigure } from '../components/body-figure.js';

let ALL = allExercises();
let BY_ID = new Map(ALL.map((e) => [e.id, e]));
const DAY = 24 * 60 * 60 * 1000;

const STATUS = {
  ontrack: { label: tr('בקצב'), cls: 'gs--ok', bar: '' },
  weekdone: { label: tr('הושג השבוע'), cls: 'gs--ok', bar: '' },
  slightly: { label: tr('בפיגור קל'), cls: 'gs--warn', bar: 'bar__fill--warn' },
  behind: { label: tr('בפיגור'), cls: 'gs--bad', bar: 'bar__fill--warn' },
  overdue: { label: tr('עבר המועד'), cls: 'gs--bad', bar: 'bar__fill--warn' },
};
const HINT = {
  slightly: tr('עוד אימון או שניים ואתה חוזר לקצב. אפשר גם להזיז את התאריך.'),
  behind: tr('צריך להאיץ. אפשר גם להזיז את התאריך אם צריך יותר זמן.'),
  overdue: tr('המועד עבר. אפשר להזיז את התאריך או למחוק את היעד.'),
};

// "2026-12-15" <-> זמן מקומי
const toInputDate = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fromInputDate = (v) => { const [y, m, d] = v.split('-').map(Number); return y ? endOfDay(new Date(y, m - 1, d).getTime()) : null; };

export function goalsScreen() {
  // הספרייה יכולה להשתנות (תרגילים מותאמים), לכן מרעננים בכל כניסה למסך.
  ALL = allExercises();
  BY_ID = new Map(ALL.map((e) => [e.id, e]));
  const unit = getProfile()?.unit === 'lb' ? tr('פאונד') : tr('ק״ג');
  const history = getWorkouts().filter((w) => w.endedAt !== null);
  let tab = 'progress';
  let quote = pick(QUOTES);
  let sheet = null; // { mode: 'new' | 'edit', draft, view: 'form' | 'pick', error, confirmDelete }

  const main = el('main', { class: 'screen' });
  const evaluate = () => {
    const r = evaluateAll(getGoals(), history, ALL, Date.now());
    if (r.newlyAchieved.length) saveGoals(r.goals); // השגה נקבעת פעם אחת ונשמרת
    return r;
  };
  const justAchieved = evaluate().newlyAchieved;

  // ---------- כרטיסים ----------
  function progressCard(item) {
    const st = STATUS[item.status];
    const g = item.goal;
    const note = HINT[item.status];
    return el('button', { class: 'card goal', onclick: () => openEdit(g) },
      el('div', { class: 'goal__top' },
        el('span', { class: 'goal__title' }, goalTitle(g, ALL, unit)),
        el('span', { class: `tag ${st.cls}` }, st.label)),
      el('div', { class: 'bar bar--lg' }, el('div', { class: `bar__fill ${st.bar}`, style: `width:${item.pct}%` })),
      el('div', { class: 'goal__meta' },
        el('span', {}, progressText(item, unit)),
        el('span', {}, g.type === 'weekly' ? tr('יעד קבוע · מתחדש ביום א׳') : `${tr('עד {d}', { d: formatDayMonth(g.deadline) })}${item.left ? ` · ${leftLabel(item.left)}` : ''}`)),
      note ? el('span', { class: 'goal__hint' }, note) : null);
  }

  function doneCard(item) {
    const g = item.goal;
    return el('button', { class: 'card goal goal--done', onclick: () => openEdit(g) },
      el('span', { class: 'goal__check', 'aria-hidden': 'true' }, '✓'),
      el('span', { class: 'goal__text' },
        el('span', { class: 'goal__title' }, goalTitle(g, ALL, unit)),
        el('span', { class: 'muted goal__sub' }, `${tr('הושג ב-{d}', { d: formatDayMonth(item.achievedAt) })}${achievedNote(g) ? ` · ${achievedNote(g)}` : ''}`)));
  }

  function recordsList() {
    const rows = trainedExercises(history).map((t) => {
      const series = exerciseSeries(history, t.exerciseId);
      const bw = series[0].bw;
      if (bw) {
        const best = series.reduce((b, p) => (p.maxReps > b.maxReps ? p : b));
        return { id: t.exerciseId, label: `${tr('משקל גוף')} × ${best.maxReps}`, t: best.t };
      }
      const pr = seriesStats(series).pr;
      return { id: t.exerciseId, label: `${formatNumber(pr.weight)} × ${pr.reps}`, t: pr.t };
    }).sort((a, b) => b.t - a.t);
    if (rows.length === 0) return el('div', { class: 'card muted' }, tr('עוד אין שיאים. אחרי האימון הראשון הם יופיעו כאן.'));
    return el('div', { class: 'card lib__card' }, rows.map((r) =>
      el('a', { class: 'rec', href: `#/progress?ex=${encodeURIComponent(r.id)}` },
        el('span', { class: 'rec__name' }, BY_ID.get(r.id)?.he ?? r.id),
        el('span', { class: 'rec__val' }, r.label),
        el('span', { class: 'muted rec__date' }, formatDayMonth(r.t)))));
  }

  // ---------- גיליון יעד חדש / עריכה ----------
  function openNew() {
    sheet = { mode: 'new', error: '', confirmDelete: false, view: 'form',
      draft: { id: newId(), type: 'exercise', exerciseId: null, group: LIBRARY[0].id, target: '', deadline: toInputDate(Date.now() + 56 * DAY) } };
    render();
  }
  function openEdit(goal) {
    sheet = { mode: 'edit', error: '', confirmDelete: false, view: 'form', goal,
      draft: { ...goal, target: String(goal.target), deadline: goal.deadline ? toInputDate(goal.deadline) : '' } };
    render();
  }
  const closeSheet = () => { sheet = null; render(); };

  const ERRORS = {
    target: tr('הכנס יעד גדול מאפס (באימונים בשבוע: עד 7)'),
    deadline: tr('בחר מועד עתידי'),
    exercise: tr('בחר תרגיל'),
    group: tr('בחר שריר'),
  };

  function buildGoal() {
    const d = sheet.draft;
    const target = Number(String(d.target).replace(',', '.'));
    return { ...d, target, deadline: d.type === 'weekly' ? null : fromInputDate(d.deadline) };
  }

  function submit() {
    const candidate = buildGoal();
    const now = Date.now();
    const code = validateGoal(candidate, history, ALL, now);
    // בעריכה, יעד שכבר מעל נקודת ההתחלה שלו לא צריך לעבור שוב את בדיקת "כבר הושג" מול המצב הנוכחי
    if (code && !(sheet.mode === 'edit' && code === 'reached' && candidate.target > sheet.goal.start)) {
      sheet.error = code === 'reached'
        ? tr('היעד הזה כבר הושג (כרגע {v}). הכנס ערך גבוה יותר.', { v: formatNumber(currentValue(candidate, history, ALL, now)) })
        : ERRORS[code];
      render();
      return;
    }
    if (sheet.mode === 'edit') saveGoal({ ...sheet.goal, target: candidate.target, deadline: candidate.deadline });
    else saveGoal(newGoal({ id: candidate.id, type: candidate.type, exerciseId: candidate.exerciseId ?? undefined, group: candidate.type === 'muscle' ? candidate.group : undefined, target: candidate.target, deadline: candidate.deadline }, history, ALL, now));
    sheet = null;
    tab = 'progress';
    render();
  }

  const picker = exerciseBrowser({
    renderRow: (ex) => el('button', { class: 'ex__head pick', onclick: () => { sheet.draft.exerciseId = ex.id; sheet.view = 'form'; sheet.error = ''; render(); } },
      bodyFigure(ex, { size: 'sm' }),
      el('span', { class: 'ex__text' }, el('span', { class: 'ex__he' }, ex.he), el('span', { class: 'ex__en' }, ex.en)),
      el('span', { class: 'pick__mark', 'aria-hidden': 'true' }, '+')),
  });

  function field(label, control) {
    return el('label', { class: 'sheet__field' }, el('span', { class: 'sheet__label' }, label), control);
  }

  function sheetView() {
    const d = sheet.draft;
    const isEdit = sheet.mode === 'edit';
    const weeklyExists = getGoals().some((g) => g.type === 'weekly');
    const ex = d.exerciseId ? BY_ID.get(d.exerciseId) : null;
    const set = (patch) => { sheet.draft = { ...sheet.draft, ...patch }; sheet.error = ''; };

    if (sheet.view === 'pick') {
      return el('div', { class: 'sheet-overlay' },
        el('div', { class: 'sheet sheet--tall', role: 'dialog', 'aria-modal': 'true', 'aria-label': tr('בחירת תרגיל') },
          el('div', { class: 'sheet__head' },
            el('span', { class: 'sheet__title' }, tr('בחירת תרגיל')),
            el('button', { class: 'icon-btn', 'aria-label': tr('חזרה'), onclick: () => { sheet.view = 'form'; render(); } }, BACK())),
          picker.node));
    }

    const targetLabel = d.type === 'exercise' ? (ex?.bw ? tr('חזרות יעד') : tr('משקל יעד ({unit})', { unit }))
      : d.type === 'muscle' ? tr('אחוז התקדמות יעד (%)')
      : d.type === 'volume' ? tr('נפח יעד באימון ({unit})', { unit }) : tr('אימונים בשבוע');

    const body = [
      isEdit ? null : [
        el('span', { class: 'sheet__label' }, tr('סוג היעד')),
        el('div', { class: 'chips' }, GOAL_TYPES.map((t) =>
          el('button', { class: 'chip-btn', 'aria-pressed': d.type === t.id ? 'true' : 'false', disabled: t.id === 'weekly' && weeklyExists,
            onclick: () => { set({ type: t.id }); render(); } }, t.label))),
        weeklyExists ? el('span', { class: 'muted sheet__note' }, tr('כבר יש יעד אימונים בשבוע. אפשר לערוך אותו מהרשימה.')) : null,
      ],
      d.type === 'exercise'
        ? field(tr('תרגיל'), el('button', { class: 'field field--btn', disabled: isEdit, onclick: () => { sheet.view = 'pick'; picker.redraw(); render(); } }, ex ? ex.he : tr('בחר תרגיל')))
        : null,
      d.type === 'muscle' && !isEdit
        ? [el('span', { class: 'sheet__label' }, tr('שריר')),
           el('div', { class: 'chips' }, LIBRARY.map((g) => el('button', { class: 'chip-btn', 'aria-pressed': d.group === g.id ? 'true' : 'false', onclick: () => { set({ group: g.id }); render(); } }, tr(g.name))))]
        : null,
      el('div', { class: 'sheet__grid' },
        field(targetLabel, el('input', { class: 'field field--num', type: 'text', inputmode: 'decimal', value: d.target, 'aria-label': targetLabel, oninput: (e) => { sheet.draft.target = e.target.value; } })),
        d.type === 'weekly' ? null
          : field(tr('מועד יעד'), el('input', { class: 'field field--num', type: 'date', value: d.deadline, min: toInputDate(Date.now()), 'aria-label': tr('מועד יעד'), oninput: (e) => { sheet.draft.deadline = e.target.value; } }))),
      sheet.error ? el('p', { class: 'wk__hint', role: 'alert', style: 'margin:0' }, sheet.error) : null,
      el('button', { class: 'btn btn--block', onclick: submit }, isEdit ? tr('שמור') : tr('צור יעד')),
      isEdit ? el('button', { class: 'link-danger', onclick: () => {
        if (!sheet.confirmDelete) { sheet.confirmDelete = true; render(); return; }
        deleteGoal(sheet.goal.id); sheet = null; render();
      } }, sheet.confirmDelete ? tr('לחץ שוב כדי למחוק את היעד') : tr('מחק יעד')) : null,
    ];

    return el('div', { class: 'sheet-overlay', onclick: (e) => { if (e.target === e.currentTarget) closeSheet(); } },
      el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': isEdit ? tr('עריכת יעד') : tr('יעד חדש') },
        el('div', { class: 'sheet__head' },
          el('span', { class: 'sheet__title' }, isEdit ? tr('עריכת יעד') : tr('יעד חדש')),
          el('button', { class: 'icon-btn', 'aria-label': tr('סגירה'), onclick: closeSheet }, '✕')),
        ...body.flat(Infinity).filter(Boolean)));
  }

  // ---------- מסך ----------
  function render() {
    const { items } = evaluate();
    const open = items.filter((i) => i.status !== 'achieved').sort((a, b) => (a.goal.deadline ?? Infinity) - (b.goal.deadline ?? Infinity));
    const done = items.filter((i) => i.status === 'achieved').sort((a, b) => b.achievedAt - a.achievedAt);
    const tabs = [['progress', tr('בדרך ({n})', { n: open.length })], ['done', tr('הושגו ({n})', { n: done.length })], ['records', tr('שיאים')]];

    mount(main,
      el('div', { class: 'topbar' },
        el('h1', { class: 'title', style: 'flex:1' }, tr('יעדים')),
        el('button', { class: 'btn btn--sm btn--add', onclick: openNew }, tr('+ יעד חדש')),
        el('a', { class: 'icon-btn', href: '#/settings', 'aria-label': tr('הגדרות') }, '⚙')),
      justAchieved.length
        ? el('div', { class: 'msg msg--up', role: 'status' }, el('span', { class: 'msg__title' }, justAchieved.length === 1 ? tr('הושג יעד!') : tr('הושגו {n} יעדים!', { n: justAchieved.length })),
            el('span', { class: 'msg__text' }, justAchieved.map((g) => goalTitle(g, ALL, unit)).join(' · ')))
        : null,
      getSettings().motivation === false ? null : el('button', { class: 'hero quote', 'aria-label': tr('משפט מוטיבציה, לחץ להחלפה'), onclick: () => { quote = pick(QUOTES.filter((q) => q !== quote)); render(); } },
        el('span', { class: 'quote__icon', 'aria-hidden': 'true' }, '⚑'), el('span', { class: 'quote__text' }, quote)),
      el('div', { class: 'tabs', role: 'tablist' }, tabs.map(([id, label]) =>
        el('button', { class: 'tabs__item', role: 'tab', 'aria-selected': tab === id ? 'true' : 'false', onclick: () => { tab = id; render(); } }, label))),
      tab === 'progress'
        ? (open.length ? el('div', { class: 'hlist' }, open.map(progressCard)) : el('div', { class: 'card muted' }, tr('עוד אין יעדים. לחץ על "יעד חדש" כדי להתחיל.')))
        : tab === 'done'
          ? (done.length ? el('div', { class: 'hlist' }, done.map(doneCard)) : el('div', { class: 'card muted' }, tr('עוד לא הושג יעד. הראשון בדרך!')))
          : recordsList(),
      sheet ? sheetView() : null);
  }
  render();
  return main;
}
