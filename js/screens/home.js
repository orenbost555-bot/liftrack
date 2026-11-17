import { el, svg, mount } from '../dom.js';
import { getProfile, getTemplates, getActive, getWorkouts, getOverrides, getSwapState, getGoals, getSettings } from '../store.js';
import { workoutStreak } from '../logic/summary.js';
import { buildGreeting, pick } from '../logic/greeting.js';
import { QUOTES } from '../data/quotes.js';
import { stagnantList } from '../logic/swap.js';
import { trainedExercises } from '../logic/progress.js';
import { allExercises } from '../logic/exercises.js';
import { todayPlan, weekDays, recentProgress, estimateMinutes } from '../logic/home.js';
import { templateStats, DAY_NAMES } from '../logic/templates.js';
import { evaluateAll, goalTitle, progressText, leftLabel } from '../logic/goals.js';
import { formatNumber } from '../logic/summary.js';
import { toolSheet } from '../components/tools.js';
import { tr, FORWARD } from '../i18n.js';

const BOLT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C25A00" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>';
const CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
const BELL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5E5A7A" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/></svg>';
const HOURGLASS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2h12M6 22h12M7 2v4l5 6-5 6v4M17 2v4l-5 6 5 6v4"/></svg>';
const STOPWATCH = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>';
const PLAY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="#5B3DF5" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>';

const STATUS = {
  improving: { label: tr('שיפור'), cls: 'st--up' },
  trend: { label: tr('מגמת שיפור'), cls: 'st--trend' },
  stagnant: { label: tr('קיפאון'), cls: 'st--flat' },
  new: { label: tr('מעט נתונים'), cls: 'st--flat' },
};

function ring(pct) {
  const c = 2 * Math.PI * 26;
  return el('div', { class: 'ring' },
    svg(`<svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true"><defs><linearGradient id="goalGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A3D"/><stop offset="1" stop-color="#C2288A"/></linearGradient></defs><circle cx="32" cy="32" r="26" stroke="#ECE8FF" stroke-width="8"/><circle cx="32" cy="32" r="26" stroke="url(#goalGrad)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${((c * pct) / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)"/></svg>`),
    el('span', { class: 'ring__pct' }, `${pct}%`));
}

export function homeScreen() {
  const profile = getProfile();
  const unit = profile.unit === 'lb' ? tr('פאונד') : tr('ק״ג');
  const templates = getTemplates();
  const now = Date.now();
  const history = getWorkouts().filter((w) => w.endedAt !== null);
  const exercises = allExercises();
  const names = new Map(exercises.map((e) => [e.id, e.he]));
  const plan = todayPlan(templates, history, getActive(), now);
  const motivation = getSettings().motivation !== false;
  const main = el('main', { class: 'screen home' });
  let sheet = null;

  const openTool = (kind) => { sheet?.remove(); sheet = toolSheet(kind, () => { sheet = null; }); main.append(sheet); };

  // ---- כרטיס ראשי ----
  function heroCard() {
    const t = plan.template;
    const stats = t ? templateStats(t) : null;
    const when = { active: tr('אימון פעיל'), today: `${tr('היום')}${plan.time ? ` · ${plan.time}` : ''}`, done: tr('האימון של היום בוצע'),
      next: `${tr('הבא')} · ${DAY_NAMES[plan.day]}${plan.time ? ` · ${plan.time}` : ''}`, pick: tr('מה מתאמנים היום?'), empty: tr('מוכן לאימון הראשון?') }[plan.kind];
    const title = plan.kind === 'active' ? plan.workout.name : t ? t.name : plan.kind === 'pick' ? tr('{name}, בחר תבנית והתחל', { name: profile.name }) : tr('{name}, בוא נבנה את התבנית הראשונה', { name: profile.name });
    const sub = stats ? `${tr('{n} תרגילים', { n: stats.exercises })} · ${tr('{n} סטים', { n: stats.sets })} · ${tr('כ-{n} דקות', { n: estimateMinutes(stats.sets) })}`
      : plan.kind === 'empty' ? tr('מרכיבים תבנית מהספרייה ומתחילים.') : plan.kind === 'active' ? tr('האימון שלך מחכה, ההתקדמות נשמרת.') : tr('התבניות שלך לא משויכות ליום קבוע.');
    const cta = plan.kind === 'active' ? el('a', { class: 'hero__cta', href: '#/workout' }, svg(PLAY), el('span', {}, tr('המשך אימון')))
      : t ? el('a', { class: 'hero__cta', href: `#/workout?template=${encodeURIComponent(t.id)}` }, svg(PLAY), el('span', {}, plan.kind === 'today' ? tr('התחל אימון') : plan.kind === 'done' ? tr('התחל שוב') : tr('התחל בכל זאת')))
      : el('a', { class: 'hero__cta', href: plan.kind === 'empty' ? '#/template' : '#/workouts' }, el('span', {}, plan.kind === 'empty' ? tr('בנה תבנית') : tr('לתבניות שלי')));
    return el('section', { class: 'hero herocard' },
      el('div', { class: 'herocard__bubble', 'aria-hidden': 'true' }),
      el('span', { class: 'herocard__when' }, when),
      el('span', { class: 'herocard__title' }, title),
      el('span', { class: 'herocard__sub' }, sub),
      cta,
      el('div', { class: 'herocard__tools' },
        el('button', { class: 'herocard__tool', onclick: () => openTool('timer') }, svg(HOURGLASS), el('span', {}, tr('טיימר מנוחה'))),
        el('button', { class: 'herocard__tool', onclick: () => openTool('stopwatch') }, svg(STOPWATCH), el('span', {}, tr('שעון עצר')))));
  }

  // ---- פס שבוע ----
  const week = el('div', { class: 'week', role: 'list', 'aria-label': tr('השבוע') }, weekDays(templates, history, now).map((d) =>
    el('div', { class: 'week__day', role: 'listitem', 'aria-label': `${d.letter}: ${({ done: tr('בוצע אימון'), today: tr('היום'), planned: tr('מתוכנן'), missed: tr('לא בוצע'), rest: tr('מנוחה') })[d.state]}` },
      el('span', { class: `week__letter${d.isToday ? ' week__letter--now' : ''}` }, d.letter),
      d.state === 'done' ? el('div', { class: 'week__dot week__dot--done' }, svg(CHECK))
        : d.state === 'today' ? el('div', { class: 'week__dot week__dot--today' }, el('div', { class: 'week__pulse' }))
        : d.state === 'planned' ? el('div', { class: 'week__dot week__dot--plan' }, svg(BELL))
        : d.state === 'missed' ? el('div', { class: 'week__dot week__dot--missed' })
        : el('div', { class: 'week__dot' }, el('div', { class: 'week__dash' })))));

  // ---- התקדמות אחרונה ----
  const recent = recentProgress(history, getOverrides());
  const recentSection = recent.length ? el('section', { class: 'home__sec' },
    el('h2', { class: 'home__h' }, tr('התקדמות אחרונה')),
    el('div', { class: 'card lib__card' }, recent.map((r) => {
      const st = STATUS[r.status];
      return el('a', { class: 'rec', href: `#/progress?ex=${encodeURIComponent(r.exerciseId)}` },
        el('span', { class: 'rec__text' }, el('span', { class: 'rec__name' }, names.get(r.exerciseId) ?? r.exerciseId),
          el('span', { class: 'muted rec__sub' }, r.bw ? `${tr('משקל גוף')} × ${r.reps}` : `${formatNumber(r.weight)} ${unit} × ${r.reps}`)),
        el('span', { class: `tag ${st.cls}` }, st.label));
    }))) : null;

  // ---- היעד שלי ----
  const ev = evaluateAll(getGoals(), history, exercises, now).items.filter((i) => i.status !== 'achieved');
  const goalItem = [...ev].sort((a, b) => (a.goal.deadline ?? Infinity) - (b.goal.deadline ?? Infinity))[0];
  const goalCard = goalItem
    ? el('a', { class: 'card goalcard', href: '#/goals' }, ring(goalItem.pct),
        el('span', { class: 'goalcard__text' },
          el('span', { class: 'muted goalcard__cap' }, tr('היעד שלי')),
          el('span', { class: 'goalcard__title' }, goalTitle(goalItem.goal, exercises, unit)),
          el('span', { class: 'muted goalcard__sub' }, `${progressText(goalItem, unit)}${goalItem.left ? ` · ${leftLabel(goalItem.left)}` : ''}`)))
    : history.length
      ? el('a', { class: 'card goalcard', href: '#/goals' }, el('span', { class: 'swap__icon', 'aria-hidden': 'true' }, '◎'),
          el('span', { class: 'goalcard__text' }, el('span', { class: 'goalcard__title' }, tr('עוד אין יעד')), el('span', { class: 'muted goalcard__sub' }, tr('הצבת יעד נותנת לכל סט כיוון. לחץ להגדרה.'))))
      : null;

  // ---- תרגיל תקוע ----
  const stuck = stagnantList(history, trainedExercises(history).map((t) => t.exerciseId), getSwapState(), now, getOverrides())[0];
  const swapCard = stuck
    ? el('a', { class: 'card swapcard', href: `#/swap?ex=${encodeURIComponent(stuck.exerciseId)}` },
        el('span', { class: 'swap__icon', 'aria-hidden': 'true' }, '⇄'),
        el('span', { class: 'swap__text' }, el('span', { class: 'swap__name' }, tr('{name} תקוע', { name: names.get(stuck.exerciseId) })), el('span', { class: 'muted' }, tr('{n} אימונים בלי שיפור. לחץ להצעת החלפה', { n: stuck.sessions }))),
        el('span', { class: 'linkcard__arrow', 'aria-hidden': 'true' }, FORWARD()))
    : null;

  mount(main,
    el('div', { class: 'greeting' },
      el('div', { class: 'greeting__text' },
        el('span', { class: 'greeting__hello' }, buildGreeting(new Date(), profile.gender)),
        motivation ? el('span', { class: 'greeting__quote' }, pick(QUOTES)) : null),
      el('div', { class: 'chip' }, svg(BOLT), tr('{n} אימונים ברצף', { n: workoutStreak(history, templates, now) }))),
    heroCard(),
    templates.length ? week : null,
    recentSection,
    goalCard,
    swapCard);
  return main;
}
