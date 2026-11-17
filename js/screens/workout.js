import { el, mount } from '../dom.js';
import { navigate } from '../router.js';
import {
  getActive, saveActive, clearActive, finishActive, getTemplate, getWorkouts, getProfile, newId, getSettings, saveSettings,
} from '../store.js';
import { allExercises } from '../logic/exercises.js';
import {
  startWorkout, parseNum, setField, addSet, removeSet, replaceExercise, addExerciseToWorkout, toggleSet,
  canFinish, finishWorkout, previousSets, suggestIncrease, applySuggestion, bestSet,
  DEFAULT_REST_SECONDS, REST_BONUS_SECONDS,
} from '../logic/workout.js';
import { formatNumber } from '../logic/summary.js';
import { exerciseBrowser } from '../components/exercise-browser.js';
import { tr, BACK } from '../i18n.js';
import { bodyFigure } from '../components/body-figure.js';

let ALL = allExercises();
let BY_ID = new Map(ALL.map((e) => [e.id, e]));
const CHECK = '✓';
const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** אימון פעיל. #/workout?template=ID מתחיל אימון חדש, ובלי פרמטר ממשיך את האימון הפעיל. */
export function workoutScreen(params) {
  // הספרייה יכולה להשתנות (תרגילים מותאמים), לכן מרעננים בכל כניסה למסך.
  ALL = allExercises();
  BY_ID = new Map(ALL.map((e) => [e.id, e]));
  let w = getActive();
  if (!w) {
    const template = getTemplate(params.get('template') ?? '');
    if (!template || template.items.length === 0) { navigate('/workouts'); return el('main', { class: 'screen' }); }
    w = startWorkout({ template, id: newId(), now: Date.now(), exercises: ALL });
    saveActive(w);
  }
  history.replaceState(null, '', '#/workout'); // שלא יתחיל אימון חדש בטעות אם חוזרים אחורה

  const unit = getProfile()?.unit === 'lb' ? tr('פאונד') : tr('ק״ג');
  const past = getWorkouts();
  const firstOpen = w.exercises.findIndex((e) => e.sets.some((s) => !s.done));
  let idx = Math.max(0, firstOpen);
  let view = 'main'; // 'main' | 'pick'
  let pickMode = 'add'; // 'add' | 'replace'
  let hint = '';
  let bodyOpen = false; // דמות שרירים מוגדלת מעל הסטים
  let rest = null; // { endsAt, total }
  let dismissedKey = '';
  let confirmCancel = false;
  let timerEl = null, barEl = null, restMsgEl = null, buzzed = false;

  const main = el('main', { class: 'screen screen--no-nav' });

  const update = (next) => { w = { ...next, lastActivityAt: Date.now() }; saveActive(w); }; // lastActivityAt: למנגנון "חזור לאימון"
  const nameOf = (id) => BY_ID.get(id)?.he ?? id;

  // ---- טיימר מנוחה: מתעדכן ישירות ב-DOM כדי לא לצייר מחדש את כל המסך ----
  const interval = setInterval(() => {
    if (!main.isConnected) { clearInterval(interval); return; }
    if (!rest || !timerEl) return;
    const left = rest.endsAt - Date.now();
    timerEl.textContent = mmss(left);
    barEl.style.width = `${Math.max(0, Math.min(100, (left / rest.total) * 100))}%`;
    if (left <= 0) {
      restMsgEl.textContent = tr('המנוחה נגמרה, לסט הבא!');
      if (!buzzed) { buzzed = true; navigator.vibrate?.(200); }
    }
  }, 250);

  function startRest() {
    if (!getSettings().restTimer) return; // המתאמן בחר לעבוד בלי טיימר
    const total = (getSettings().restSeconds ?? DEFAULT_REST_SECONDS) * 1000;
    rest = { endsAt: Date.now() + total, total };
    buzzed = false;
  }

  // ---- בורר תרגילים (הוספה / החלפה) ----
  const picker = exerciseBrowser({
    renderRow(ex) {
      return el('button', { class: 'ex__head pick', onclick: () => {
        const meta = { id: ex.id, bw: ex.bw };
        if (pickMode === 'replace') update(replaceExercise(w, idx, meta));
        else { update(addExerciseToWorkout(w, meta)); idx = w.exercises.length - 1; }
        view = 'main'; render();
      } },
        bodyFigure(ex, { size: 'sm' }),
        el('span', { class: 'ex__text' }, el('span', { class: 'ex__he' }, ex.he), el('span', { class: 'ex__en' }, ex.en)),
        el('span', { class: 'pick__mark', 'aria-hidden': 'true' }, '+'));
    },
  });

  // ---- בניית חלקי המסך ----
  function restSwitch() {
    const on = getSettings().restTimer;
    return el('button', { class: 'switch', role: 'switch', 'aria-checked': on ? 'true' : 'false',
      onclick: () => { saveSettings({ restTimer: !on }); if (on) rest = null; render(); } },
      el('span', {}, tr('טיימר מנוחה אחרי כל סט')),
      el('span', { class: 'switch__track' }, el('span', { class: 'switch__knob' })));
  }

  function restCard() {
    if (!rest) { timerEl = barEl = restMsgEl = null; return null; }
    timerEl = el('span', { class: 'rest__time' }, mmss(rest.endsAt - Date.now()));
    barEl = el('div', { class: 'rest__fill' });
    restMsgEl = el('span', { class: 'rest__label' }, tr('טיימר מנוחה'));
    return el('section', { class: 'hero rest' },
      el('div', { class: 'rest__row' },
        el('div', { class: 'rest__col' }, restMsgEl, timerEl),
        el('div', { class: 'rest__btns' },
          el('button', { class: 'pill pill--ghost', onclick: () => { rest.endsAt += REST_BONUS_SECONDS * 1000; rest.total += REST_BONUS_SECONDS * 1000; buzzed = false; } }, `+${REST_BONUS_SECONDS}`),
          el('button', { class: 'pill pill--white', onclick: () => { rest = null; render(); } }, tr('דלג')))),
      el('div', { class: 'rest__bar' }, barEl));
  }

  function setRow(ex, s, i, prevSets, nextOpenIdx) {
    const prev = prevSets?.[i] ?? null;
    const isNext = i === nextOpenIdx;
    const onInput = (field, parse) => (e) => { update(setField(w, idx, i, field, parse(e.target.value))); };
    const input = (field, label, mode, value, ph, extra = '') =>
      el('input', { class: `set__in ${extra}`, type: 'text', inputmode: mode, value: value ?? '', placeholder: ph ?? '—', 'aria-label': tr('{label} בסט {n}', { label, n: i + 1 }),
        oninput: onInput(field, parseNum) });
    return el('div', { class: `set${s.done ? ' set--done' : ''}${isNext ? ' set--next' : ''}` },
      el('span', { class: 'set__n' }, String(i + 1)),
      el('span', { class: 'set__prev' }, prev ? `${formatNumber(prev.weight ?? 0)} × ${prev.reps}` : tr('אין נתון')),
      input('weight', tr('משקל'), 'decimal', s.weight, prev?.weight != null ? formatNumber(prev.weight) : null),
      input('reps', tr('חזרות'), 'numeric', s.reps, prev?.reps != null ? String(prev.reps) : null),
      input('rir', tr('חזרות שנותרו עד כשל'), 'numeric', s.rir, null, 'set__in--rir'),
      el('button', { class: `set__check${s.done ? ' set__check--on' : ''}`, 'aria-label': s.done ? tr('בטל סט {n}', { n: i + 1 }) : tr('סמן סט {n} כבוצע', { n: i + 1 }),
        onclick: () => {
          const r = toggleSet(w, idx, i, prev);
          if (r.error) { hint = r.error === 'reps' ? tr('חסרות חזרות בסט הזה') : tr('חסר משקל בסט הזה'); render(); return; }
          hint = '';
          update(r.workout);
          if (r.workout.exercises[idx].sets[i].done) startRest(); else rest = null;
          render();
        } }, CHECK));
  }

  function exerciseCard() {
    const ex = w.exercises[idx];
    const meta = BY_ID.get(ex.exerciseId);
    const prevSets = previousSets(past, ex.exerciseId);
    const prevBest = prevSets ? bestSet({ sets: prevSets }) : null;
    const nextOpenIdx = ex.sets.findIndex((s) => !s.done);
    return el('section', { class: 'card wk' },
      el('div', { class: 'wk__head' },
        meta ? el('button', { class: 'body-btn', 'aria-expanded': bodyOpen ? 'true' : 'false', 'aria-label': tr('הצג שרירים'), onclick: () => { bodyOpen = !bodyOpen; render(); } }, bodyFigure(meta, { size: 'sm' })) : null,
        el('div', { class: 'wk__text' },
          el('span', { class: 'wk__name' }, meta?.he ?? ex.exerciseId),
          el('span', { class: 'muted wk__sub' }, [meta ? tr(meta.sub) : null, prevBest ? tr('בפעם הקודמת: {v}', { v: `${formatNumber(prevBest.weight ?? 0)} ${unit} × ${prevBest.reps}` }) : tr('בפעם הראשונה אין נתון קודם')].filter(Boolean).join(' · '))),
        el('button', { class: 'icon-btn', 'aria-label': tr('החלף תרגיל'), onclick: () => { pickMode = 'replace'; view = 'pick'; picker.redraw(); render(); } }, '⇄')),
      bodyOpen && meta ? el('div', { class: 'wk__body' }, bodyFigure(meta)) : null,
      el('div', { class: 'set set--labels' },
        el('span', {}, tr('סט')), el('span', { class: 'set__lbl-start' }, tr('קודם')), el('span', {}, unit), el('span', {}, tr('חזרות')), el('span', { class: 'set__rir-lbl' }, 'RIR'), el('span')),
      ex.sets.map((s, i) => setRow(ex, s, i, prevSets, nextOpenIdx)),
      hint ? el('p', { class: 'wk__hint', role: 'alert' }, hint) : null,
      el('div', { class: 'wk__setbtns' },
        el('button', { class: 'pill pill--soft wk__add', onclick: () => { update(addSet(w, idx)); render(); } }, tr('+ הוסף סט')),
        ex.sets.length > 1 && !ex.sets[ex.sets.length - 1].done
          ? el('button', { class: 'pill pill--plain', onclick: () => { update(removeSet(w, idx, ex.sets.length - 1)); render(); } }, tr('הסר סט אחרון'))
          : null));
  }

  function suggestionCard() {
    const ex = w.exercises[idx];
    const sug = suggestIncrease(ex);
    const key = `${idx}:${ex.sets.filter((s) => s.done).length}`;
    if (!sug || dismissedKey === key) return null;
    const apply = (kind) => () => { update(applySuggestion(w, idx, sug, kind)); dismissedKey = key; render(); };
    return el('section', { class: 'suggest' },
      el('p', { class: 'suggest__text' }, `↑ ${tr('לא הגעת לכשל (RIR {n}): הזמן לעלות!', { n: sug.rir })}`),
      el('div', { class: 'suggest__btns' },
        sug.weight ? el('button', { class: 'pill pill--solid', onclick: apply('weight') }, `${formatNumber(sug.weight.from)} → ${formatNumber(sug.weight.to)} ${unit}`) : null,
        el('button', { class: sug.weight ? 'pill pill--white' : 'pill pill--solid', onclick: apply('reps') }, `${sug.weight ? tr('או ') : ''}${sug.reps.from} → ${sug.reps.to} ${tr('חזרות')}`)));
  }

  // כל תרגילי האימון ברשימה אחת: אפשר לקפוץ לכל תרגיל בכל סדר, ושום דבר לא נעלם.
  // התרגיל הנוכחי מסומן, ותרגיל שכל הסטים בו בוצעו מקבל ✓.
  function exerciseList() {
    if (w.exercises.length < 2) return null;
    return el('section', { class: 'next' },
      el('h2', { class: 'lib__subtitle' }, tr('תרגילי האימון')),
      el('div', { class: 'card lib__card' },
        w.exercises.map((e, i) => {
          const doneN = e.sets.filter((x) => x.done).length;
          const complete = doneN === e.sets.length;
          return el('button', { class: `next__row${i === idx ? ' next__row--on' : ''}${complete ? ' next__row--done' : ''}`, 'aria-current': i === idx ? 'true' : 'false',
            onclick: () => { idx = i; hint = ''; render(); window.scrollTo(0, 0); } },
            el('span', { class: 'next__n' }, complete ? CHECK : String(i + 1)),
            el('span', { class: 'next__name' }, nameOf(e.exerciseId)),
            el('span', { class: 'muted next__sets' }, `${doneN}/${e.sets.length}`));
        })));
  }

  /** התרגיל הבא שעוד יש בו סטים לביצוע: קודם אחרי הנוכחי, ואז מההתחלה. -1 אם הכול בוצע. */
  function nextOpen() {
    const n = w.exercises.length;
    for (let k = 1; k < n; k++) {
      const i = (idx + k) % n;
      if (w.exercises[i].sets.some((x) => !x.done)) return i;
    }
    return -1;
  }

  function finish() {
    if (!canFinish(w)) { hint = tr('סמן לפחות סט אחד כדי לסיים את האימון'); render(); return; }
    const done = finishWorkout(w, Date.now());
    clearInterval(interval);
    finishActive(done);
    navigate(`/summary?id=${encodeURIComponent(done.id)}`);
  }

  function renderMain() {
    const nextIdx = nextOpen();
    mount(main,
      el('div', { class: 'topbar' },
        el('button', { class: 'back', 'aria-label': tr('חזרה (האימון נשמר)'), onclick: () => navigate('/workouts') }, '✕'),
        el('div', { class: 'topbar__text' },
          el('span', { class: 'wk__title' }, w.name),
          el('span', { class: 'muted wk__sub' }, tr('תרגיל {a} מתוך {b}', { a: idx + 1, b: w.exercises.length }))),
        el('button', { class: 'btn btn--sm', onclick: finish }, tr('סיים'))),
      restSwitch(),
      restCard(),
      exerciseCard(),
      suggestionCard(),
      exerciseList(),
      el('button', { class: 'link-danger', onclick: () => {
        if (!confirmCancel) { confirmCancel = true; render(); return; }
        clearInterval(interval); clearActive(); navigate('/workouts');
      } }, confirmCancel ? tr('לחץ שוב כדי לבטל את האימון ולמחוק אותו') : tr('בטל אימון')),
      el('div', { class: 'savebar savebar--row' },
        el('button', { class: 'btn btn--grow', onclick: () => { if (nextIdx === -1) finish(); else { idx = nextIdx; hint = ''; render(); window.scrollTo(0, 0); } } },
          nextIdx === -1 ? tr('סיום האימון') : tr('סיום תרגיל · לתרגיל הבא')),
        el('button', { class: 'icon-btn icon-btn--lg', 'aria-label': tr('הוסף תרגיל'), onclick: () => { pickMode = 'add'; view = 'pick'; picker.redraw(); render(); } }, '+')));
  }

  function renderPick() {
    mount(main,
      el('div', { class: 'topbar' },
        el('button', { class: 'back', 'aria-label': tr('חזרה'), onclick: () => { view = 'main'; render(); } }, BACK()),
        el('h1', { class: 'title' }, pickMode === 'replace' ? tr('החלפת תרגיל') : tr('הוספת תרגיל'))),
      picker.node);
  }

  function render() { (view === 'main' ? renderMain : renderPick)(); }
  render();
  return main;
}
