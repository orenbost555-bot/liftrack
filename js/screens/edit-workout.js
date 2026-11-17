import { el, mount } from '../dom.js';
import { navigate } from '../router.js';
import { getWorkout, getProfile, updateWorkout } from '../store.js';
import { allExercises } from '../logic/exercises.js';
import { setField, addDoneSet, removeSet, removeExerciseAt, parseNum, validateEditedWorkout } from '../logic/workout.js';
import { formatNumber, formatDate } from '../logic/summary.js';
import { tr, BACK } from '../i18n.js';

/** עריכת אימון מההיסטוריה: #/edit-workout?id=... (משקל, חזרות, RIR, הוספה והסרה של סטים). */
export function editWorkoutScreen(params) {
  const orig = getWorkout(params.get('id') ?? '');
  if (!orig || orig.endedAt === null) { navigate('/history'); return el('main', { class: 'screen' }); }
  const byId = new Map(allExercises().map((e) => [e.id, e]));
  const unit = getProfile()?.unit === 'lb' ? tr('פאונד') : tr('ק״ג');
  let w = structuredClone(orig);
  let hint = '';
  let confirmCancel = false;
  const main = el('main', { class: 'screen screen--no-nav' });
  const back = () => navigate(`/summary?id=${encodeURIComponent(orig.id)}`);

  const message = (error, name) => (error === 'empty' ? tr('צריך לפחות סט אחד באימון')
    : error === 'reps' ? tr('חסרות חזרות באחד הסטים של {name}', { name }) : tr('חסר משקל באחד הסטים של {name}', { name }));

  function setRow(ex, exIdx, s, i) {
    const before = orig.exercises.find((o) => o.exerciseId === ex.exerciseId)?.sets[i];
    const input = (field, label, mode, value, extra = '') =>
      el('input', { class: `set__in ${extra}`, type: 'text', inputmode: mode, value: value ?? '', placeholder: '—', 'aria-label': tr('{label} בסט {n}', { label, n: i + 1 }),
        oninput: (e) => { w = setField(w, exIdx, i, field, parseNum(e.target.value)); hint = ''; } });
    return el('div', { class: 'set' },
      el('span', { class: 'set__n' }, String(i + 1)),
      el('span', { class: 'set__prev' }, before ? `${formatNumber(before.weight ?? 0)} × ${before.reps}` : tr('סט חדש')),
      input('weight', tr('משקל'), 'decimal', s.weight),
      input('reps', tr('חזרות'), 'numeric', s.reps),
      input('rir', tr('חזרות שנותרו עד כשל'), 'numeric', s.rir, 'set__in--rir'),
      el('button', { class: 'set__check', type: 'button', 'aria-label': tr('הסר סט {n}', { n: i + 1 }), disabled: ex.sets.length <= 1,
        onclick: () => { w = removeSet(w, exIdx, i); hint = ''; render(); } }, '✕'));
  }

  function exerciseCard(ex, exIdx) {
    const meta = byId.get(ex.exerciseId);
    return el('section', { class: 'card wk' },
      el('div', { class: 'wk__head' },
        el('div', { class: 'wk__text' }, el('span', { class: 'wk__name' }, meta?.he ?? ex.exerciseId), el('span', { class: 'muted wk__sub' }, meta ? tr(meta.sub) : '')),
        w.exercises.length > 1
          ? el('button', { class: 'icon-btn icon-btn--sm', type: 'button', 'aria-label': tr('הסר תרגיל'), onclick: () => { w = removeExerciseAt(w, exIdx); hint = ''; render(); } }, '✕')
          : null),
      el('div', { class: 'set set--labels' },
        el('span', {}, tr('סט')), el('span', { class: 'set__lbl-start' }, tr('לפני')), el('span', {}, unit), el('span', {}, tr('חזרות')), el('span', { class: 'set__rir-lbl' }, 'RIR'), el('span')),
      ex.sets.map((s, i) => setRow(ex, exIdx, s, i)),
      el('div', { class: 'wk__setbtns' },
        el('button', { class: 'pill pill--soft wk__add', type: 'button', onclick: () => { w = addDoneSet(w, exIdx); render(); } }, tr('+ הוסף סט'))));
  }

  function save() {
    const bad = validateEditedWorkout(w);
    if (bad) {
      const name = byId.get(w.exercises[bad.exIdx]?.exerciseId)?.he ?? '';
      hint = message(bad.error, name);
      render();
      return;
    }
    updateWorkout(w);
    back();
  }

  function render() {
    mount(main,
      el('div', { class: 'topbar' },
        el('button', { class: 'back', type: 'button', 'aria-label': tr('חזרה'), onclick: () => {
          const changed = JSON.stringify(w) !== JSON.stringify(orig);
          if (changed && !confirmCancel) { confirmCancel = true; hint = tr('יש שינויים שלא נשמרו. לחץ שוב כדי לצאת בלי לשמור.'); render(); return; }
          back();
        } }, BACK()),
        el('div', { class: 'topbar__text' },
          el('h1', { class: 'title' }, tr('עריכת אימון')),
          el('span', { class: 'muted wk__sub' }, `${w.name} · ${formatDate(w.endedAt)}`))),
      el('p', { class: 'muted fine' }, tr('אפשר לתקן משקל, חזרות ו-RIR, להוסיף או להסיר סטים. הגרפים והשיפורים יתעדכנו לפי התיקון.')),
      w.exercises.map(exerciseCard),
      el('div', { class: 'savebar' },
        hint ? el('span', { class: 'savebar__hint wk__hint', role: 'alert' }, hint) : null,
        el('button', { class: 'btn btn--block', type: 'button', onclick: save }, tr('שמור שינויים'))));
  }

  render();
  return main;
}
