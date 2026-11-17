import { el, mount } from '../dom.js';
import { getTemplate, getTemplates, saveTemplate, deleteTemplate, newId } from '../store.js';
import { allExercises } from '../logic/exercises.js';
import {
  DAY_NAMES, slotsOf, toggleDay, setSlotTime, clashesOn, newTemplate, addExercise, removeExercise, moveExercise, setSets,
  templateStats, validateTemplate, MIN_SETS, MAX_SETS,
} from '../logic/templates.js';
import { exerciseBrowser } from '../components/exercise-browser.js';
import { navigate } from '../router.js';
import { scheduleOf, entryDays } from '../logic/summary.js';
import { tr, BACK } from '../i18n.js';
import { bodyFigure } from '../components/body-figure.js';

let BY_ID = new Map(allExercises().map((e) => [e.id, e]));

/** מסך יצירה/עריכה של תבנית. #/template = חדשה, #/template?id=... = עריכה. */
export function templateEditorScreen(params) {
  // הספרייה יכולה להשתנות (תרגילים מותאמים), לכן מרעננים בכל כניסה למסך.
  BY_ID = new Map(allExercises().map((e) => [e.id, e]));
  const existing = getTemplate(params.get('id') ?? '');
  let draft = existing ? structuredClone(existing) : newTemplate(newId());
  let view = 'edit'; // 'edit' | 'pick'
  let confirmDelete = false;

  const main = el('main', { class: 'screen screen--no-nav' });

  // בורר התרגילים: לחיצה על שורה מוסיפה או מסירה מהתבנית
  const picker = exerciseBrowser({
    renderRow(ex) {
      const added = draft.items.some((i) => i.exerciseId === ex.id);
      return el('button', { class: 'ex__head pick', 'aria-pressed': added ? 'true' : 'false',
        onclick: () => { draft = added ? removeExercise(draft, ex.id) : addExercise(draft, ex.id); picker.redraw(); render(); } },
        bodyFigure(ex, { size: 'sm' }),
        el('span', { class: 'ex__text' }, el('span', { class: 'ex__he' }, ex.he), el('span', { class: 'ex__en' }, ex.en)),
        el('span', { class: `pick__mark${added ? ' pick__mark--on' : ''}`, 'aria-hidden': 'true' }, added ? '✓' : '+'));
    },
  });

  const topbar = (title, backHandler) =>
    el('div', { class: 'topbar' },
      el('button', { class: 'back', 'aria-label': tr('חזרה'), onclick: backHandler }, BACK()),
      el('h1', { class: 'title' }, title));

  function stepper(item) {
    return el('div', { class: 'stepper' },
      el('button', { class: 'stepper__btn', 'aria-label': tr('פחות סטים'), disabled: item.sets <= MIN_SETS,
        onclick: () => { draft = setSets(draft, item.exerciseId, item.sets - 1); render(); } }, '−'),
      el('span', { class: 'stepper__val' }, tr('{n} סטים', { n: item.sets })),
      el('button', { class: 'stepper__btn', 'aria-label': tr('יותר סטים'), disabled: item.sets >= MAX_SETS,
        onclick: () => { draft = setSets(draft, item.exerciseId, item.sets + 1); render(); } }, '+'));
  }

  function itemRow(item, index) {
    const ex = BY_ID.get(item.exerciseId);
    if (!ex) return null; // תרגיל שהוסר מהספרייה: מדלגים
    return el('div', { class: 'card item' },
      el('div', { class: 'item__top' },
        bodyFigure(ex, { size: 'sm' }),
        el('span', { class: 'item__text' }, el('span', { class: 'ex__he' }, ex.he), el('span', { class: 'ex__en' }, tr(ex.sub))),
        el('button', { class: 'icon-btn icon-btn--sm', 'aria-label': tr('הסר תרגיל'), onclick: () => { draft = removeExercise(draft, ex.id); render(); } }, '✕')),
      el('div', { class: 'item__bottom' },
        stepper(item),
        el('div', { class: 'item__moves' },
          el('button', { class: 'icon-btn icon-btn--sm', 'aria-label': tr('הזז למעלה'), disabled: index === 0,
            onclick: () => { draft = moveExercise(draft, index, -1); render(); } }, '↑'),
          el('button', { class: 'icon-btn icon-btn--sm', 'aria-label': tr('הזז למטה'), disabled: index === draft.items.length - 1,
            onclick: () => { draft = moveExercise(draft, index, 1); render(); } }, '↓'))));
  }

  function renderEdit() {
    const problem = validateTemplate(draft);
    const { exercises, sets } = templateStats(draft);
    const hint = problem === 'name' ? tr('תן שם לתבנית כדי לשמור') : problem === 'empty' ? tr('הוסף לפחות תרגיל אחד כדי לשמור') : `${tr('{n} תרגילים', { n: exercises })} · ${tr('{n} סטים', { n: sets })}`;

    const nameInput = el('input', { class: 'field field--solid', type: 'text', value: draft.name, placeholder: tr('שם התבנית, למשל יום A'), 'aria-label': tr('שם התבנית'), maxlength: '40',
      oninput: (e) => { draft = { ...draft, name: e.target.value }; refreshSave(); } });
    const saveBtn = el('button', { class: 'btn btn--block', onclick: save }, tr('שמור תבנית'));
    const hintEl = el('span', { class: 'muted savebar__hint' }, hint);
    function refreshSave() {
      const p = validateTemplate(draft);
      saveBtn.disabled = p !== null;
      hintEl.textContent = p === 'name' ? tr('תן שם לתבנית כדי לשמור') : p === 'empty' ? tr('הוסף לפחות תרגיל אחד כדי לשמור') : `${tr('{n} תרגילים', { n: templateStats(draft).exercises })} · ${tr('{n} סטים', { n: templateStats(draft).sets })}`;
    }
    saveBtn.disabled = problem !== null;

    // כמה ימים לתבנית, ולכל יום שעה משלו. יום שכבר תפוס בתבנית אחרת מקבל הערה (לא חוסם).
    const slots = slotsOf(draft);
    const others = getTemplates().filter((t) => t.id !== draft.id);
    const dayChips = DAY_NAMES.map((name, day) =>
      el('button', { class: 'chip-btn', type: 'button', 'data-day': String(day), 'aria-pressed': slots.some((x) => x.day === day) ? 'true' : 'false',
        onclick: () => { draft = toggleDay(draft, day); render(); } }, name));
    const slotRows = slots.map((slot) => {
      const clash = clashesOn(others, slot.day);
      return el('div', { class: 'slot', 'data-slot': String(slot.day) },
        el('div', { class: 'row' },
          el('span', { class: 'row__label slot__day' }, DAY_NAMES[slot.day]),
          el('input', { class: 'field time', type: 'time', value: slot.time ?? '', 'aria-label': tr('שעה ביום {day}', { day: DAY_NAMES[slot.day] }),
            onchange: (e) => { draft = setSlotTime(draft, slot.day, e.target.value); } })),
        clash.length ? el('p', { class: 'slot__warn', role: 'status' }, tr('שים לב: כבר יש לך אימון ביום הזה ({names})', { names: clash.join(', ') })) : null);
    });

    mount(main,
      topbar(existing ? tr('עריכת תבנית') : tr('תבנית חדשה'), () => navigate('/workouts')),
      nameInput,
      el('div', { class: 'card sched' },
        el('span', { class: 'sched__title' }, tr('באילו ימים מתאמנים?')),
        el('div', { class: 'chips sched__days' }, dayChips),
        slots.length ? el('p', { class: 'muted sched__note' }, tr('אפשר לבחור כמה ימים, ושעה אחרת לכל יום.')) : el('p', { class: 'muted sched__note' }, tr('בלי יום קבוע התבנית רק מחכה לך ברשימה.')),
        slotRows),
      el('h2', { class: 'lib__subtitle' }, tr('תרגילים')),
      ...draft.items.map(itemRow),
      el('button', { class: 'dashed', onclick: () => { view = 'pick'; picker.redraw(); render(); } },
        el('span', {}, draft.items.length ? tr('הוסף תרגיל') : tr('הוסף תרגיל מהספרייה'))),
      existing
        ? el('button', { class: 'link-danger', onclick: () => {
            if (!confirmDelete) { confirmDelete = true; render(); return; }
            deleteTemplate(existing.id); navigate('/workouts');
          } }, confirmDelete ? tr('לחץ שוב כדי למחוק לצמיתות') : tr('מחק תבנית'))
        : null,
      el('div', { class: 'savebar' }, hintEl, saveBtn));
  }

  function renderPick() {
    mount(main,
      topbar(tr('הוספת תרגיל'), () => { view = 'edit'; render(); }),
      picker.node,
      el('div', { class: 'savebar' },
        el('span', { class: 'muted savebar__hint' }, tr('{n} נבחרו', { n: draft.items.length })),
        el('button', { class: 'btn btn--block', onclick: () => { view = 'edit'; render(); } }, tr('סיום'))));
  }

  function save() {
    if (validateTemplate(draft) !== null) return;
    // לוח הזמנים נשמר כהיסטוריה: כשהיום משתנה מוסיפים רשומה חדשה, וכך אימונים שכבר בוצעו נשארים ברצף.
    const days = slotsOf(draft).map((x) => x.day);
    const schedule = scheduleOf(existing ?? { slots: [] });
    const prev = schedule.length ? entryDays(schedule[schedule.length - 1]) : [];
    const changed = !existing || prev.join() !== days.join();
    const { day, time, ...rest } = draft; // השדות הישנים מוחלפים ב-slots
    saveTemplate({
      ...rest, name: draft.name.trim(), slots: slotsOf(draft),
      schedule: changed ? [...schedule, { days, since: Date.now() }] : schedule,
    });
    navigate('/workouts');
  }

  function render() { (view === 'edit' ? renderEdit : renderPick)(); }
  render();
  return main;
}
