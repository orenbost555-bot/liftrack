import { el } from '../dom.js';
import { muscleName } from '../data/muscles.js';
import { exerciseBrowser } from '../components/exercise-browser.js';
import { workoutsHeader } from '../components/workouts-header.js';
import { tr } from '../i18n.js';
import { bodyFigure } from '../components/body-figure.js';

const tag = (text, kind) => el('span', { class: `tag tag--${kind}` }, text);

export function libraryScreen() {
  let openId = null; // איזה תרגיל פתוח כרגע (מציג שרירים)

  const browser = exerciseBrowser({
    renderRow(ex) {
      const open = openId === ex.id;
      return el('div', { class: 'ex' },
        el('button', { class: 'ex__head', 'aria-expanded': open ? 'true' : 'false',
          onclick: () => { openId = open ? null : ex.id; browser.redraw(); } },
          el('span', { class: 'ex__text' },
            el('span', { class: 'ex__he' }, ex.he),
            el('span', { class: 'ex__en' }, ex.en)),
          ex.custom ? tag(tr('שלי'), 'main') : null,
          ex.bw ? tag(tr('משקל גוף'), 'bw') : null),
        open
          ? el('div', { class: 'ex__body ex__body--fig' },
              el('div', { class: 'ex__info' },
                el('div', { class: 'ex__line' }, el('span', { class: 'ex__label' }, tr('עיקריים')), ex.p.map((m) => tag(muscleName(m), 'main'))),
                ex.sec.length
                  ? el('div', { class: 'ex__line' }, el('span', { class: 'ex__label' }, tr('משניים')), ex.sec.map((m) => tag(muscleName(m), 'sec')))
                  : null,
                ex.bw ? el('p', { class: 'muted ex__note' }, tr('תרגיל במשקל גוף, לא נכלל בנפח האימון.')) : null,
                ex.custom ? el('a', { class: 'outline-btn xe__edit', href: `#/exercise?id=${encodeURIComponent(ex.id)}` }, tr('ערוך תרגיל')) : null),
              bodyFigure(ex))
          : null);
    },
  });

  return el('main', { class: 'screen' }, workoutsHeader('library'),
    el('a', { class: 'dashed', href: '#/exercise' }, tr('הוסף תרגיל משלך')),
    browser.node);
}
