import { el, mount } from '../dom.js';
import { getCustomExercises, saveCustomExercise, deleteCustomExercise, newExerciseId, getTemplates, saveTemplates, getWorkouts } from '../store.js';
import { allExercises, homeOf } from '../logic/exercises.js';
import { MUSCLE_KEYS, MAX_NAME, emptyDraft, buildExercise, toggleMuscle, validateExercise, takenNames, usageOf, withoutExercise } from '../logic/custom-exercise.js';
import { muscleName } from '../data/muscles.js';
import { NAME_EN } from '../i18n-data.js';
import { bodyFigure } from '../components/body-figure.js';
import { navigate } from '../router.js';
import { tr, BACK } from '../i18n.js';

/** הוספה/עריכה של תרגיל אישי: #/exercise (חדש) או #/exercise?id=c_... (עריכה). */
export function exerciseEditorScreen(params) {
  const existing = getCustomExercises().find((x) => x.id === params.get('id')) ?? null;
  let draft = existing ? { ...emptyDraft(), ...existing } : emptyDraft();
  let confirmDelete = false;
  let blocked = null; // { workouts } כשמחיקה נחסמת בגלל היסטוריה

  const main = el('main', { class: 'screen screen--no-nav' });
  const taken = takenNames(allExercises(), getCustomExercises(), NAME_EN, existing?.id ?? null);
  const problem = () => validateExercise(draft, taken);

  const hintText = () => {
    const p = problem();
    if (p === 'name') return tr('הזן שם בעברית או באנגלית כדי לשמור');
    if (p === 'main') return tr('בחר לפחות שריר עיקרי אחד כדי לשמור');
    if (p === 'dup') return tr('תרגיל בשם הזה כבר קיים');
    const home = homeOf(draft.p[0]);
    return home ? tr('יופיע בספרייה תחת: {sub}', { sub: tr(home.sub) }) : '';
  };

  const topbar = el('div', { class: 'topbar' },
    el('button', { class: 'back', 'aria-label': tr('חזרה'), onclick: () => navigate('/library') }, BACK()),
    el('h1', { class: 'title' }, existing ? tr('עריכת תרגיל') : tr('תרגיל חדש')));

  const figureBox = el('div', { class: 'xe__figure' });
  const saveBtn = el('button', { class: 'btn btn--block', onclick: save }, tr('שמור תרגיל'));
  const hintEl = el('span', { class: 'muted savebar__hint' });

  function refresh() {
    figureBox.replaceChildren(bodyFigure({ p: draft.p, sec: draft.sec }, { size: 'md' }));
    saveBtn.disabled = problem() !== null;
    hintEl.textContent = hintText();
  }

  function muscleChips(kind) {
    return el('div', { class: 'chips xe__chips' }, MUSCLE_KEYS.map((k) =>
      el('button', { class: 'chip-btn', type: 'button', 'data-m': k, 'aria-pressed': draft[kind].includes(k) ? 'true' : 'false',
        onclick: () => { draft = toggleMuscle(draft, kind, k); render(); } }, muscleName(k))));
  }

  function save() {
    if (problem() !== null) return;
    saveCustomExercise(buildExercise(draft, existing?.id ?? newExerciseId()));
    navigate('/library');
  }

  function remove() {
    const use = usageOf(existing.id, getTemplates(), getWorkouts());
    if (use.workouts > 0) { blocked = use; confirmDelete = false; render(); return; }
    if (!confirmDelete) { confirmDelete = true; render(); return; }
    if (use.templates > 0) saveTemplates(withoutExercise(getTemplates(), existing.id));
    deleteCustomExercise(existing.id);
    navigate('/library');
  }

  function render() {
    const nameHe = el('input', { class: 'field field--solid', type: 'text', dir: 'rtl', value: draft.he, maxlength: String(MAX_NAME), name: 'he',
      placeholder: 'למשל: סקוואט בולגרי', 'aria-label': tr('שם בעברית'),
      oninput: (e) => { draft = { ...draft, he: e.target.value }; refresh(); } });
    const nameEn = el('input', { class: 'field field--solid', type: 'text', dir: 'ltr', value: draft.en, maxlength: String(MAX_NAME), name: 'en',
      placeholder: 'e.g. Bulgarian split squat', 'aria-label': tr('שם באנגלית'),
      oninput: (e) => { draft = { ...draft, en: e.target.value }; refresh(); } });

    const use = existing ? usageOf(existing.id, getTemplates(), getWorkouts()) : { templates: 0, workouts: 0 };
    const delLabel = confirmDelete
      ? (use.templates > 0 ? tr('לחץ שוב: התרגיל יימחק וגם יוסר מהתבניות ({n})', { n: use.templates }) : tr('לחץ שוב כדי למחוק לצמיתות'))
      : tr('מחק תרגיל');

    mount(main,
      topbar,
      el('div', { class: 'card xe__card' }, figureBox),
      el('div', { class: 'sheet__field' }, el('span', { class: 'sheet__label' }, tr('שם בעברית')), nameHe),
      el('div', { class: 'sheet__field' }, el('span', { class: 'sheet__label' }, tr('שם באנגלית')), nameEn),
      el('p', { class: 'muted xe__note' }, tr('אפשר למלא שפה אחת בלבד, והשם יוצג כמו שהוא בשתי השפות.')),
      el('h2', { class: 'lib__subtitle' }, tr('שרירים עיקריים')),
      muscleChips('p'),
      el('h2', { class: 'lib__subtitle' }, tr('שרירים משניים')),
      muscleChips('sec'),
      el('button', { class: 'switch switch--row', type: 'button', role: 'switch', 'aria-checked': draft.bw ? 'true' : 'false',
        onclick: () => { draft = { ...draft, bw: !draft.bw }; render(); } },
        el('span', {}, tr('משקל גוף')), el('span', { class: 'switch__track' }, el('span', { class: 'switch__knob' }))),
      draft.bw ? el('p', { class: 'muted xe__note' }, tr('תרגיל במשקל גוף, לא נכלל בנפח האימון.')) : null,
      existing ? el('button', { class: 'link-danger', type: 'button', onclick: remove }, delLabel) : null,
      blocked ? el('p', { class: 'muted xe__note xe__blocked', role: 'alert' }, tr('אי אפשר למחוק: התרגיל מופיע בהיסטוריית האימונים ({n}).', { n: blocked.workouts })) : null,
      el('div', { class: 'savebar' }, hintEl, saveBtn));
    refresh();
  }

  render();
  return main;
}
