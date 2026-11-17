import { el, svg } from '../dom.js';
import { SILHOUETTE, HEAD, FRONT, BACK } from '../data/body.js';
import { tr } from '../i18n.js';
import { muscleName } from '../data/muscles.js';

const BASE = '#E4E0F7';   // שריר לא מעורב
const SEC = '#B9A8FA';    // שריר משני
const MAIN = '#5B3DF5';   // שריר עיקרי (צבע המותג)

/** מחלק מבט לשרירים ומשרטט: כל צורה פעם רגילה ופעם משוקפת. */
function view(shapes, level) {
  const paths = Object.entries(shapes).map(([key, d]) => {
    const fill = level(key) === 'main' ? MAIN : level(key) === 'sec' ? SEC : BASE;
    const p = `<path d="${d}" fill="${fill}" stroke="#fff" stroke-width="0.8" stroke-linejoin="round"/>`;
    return `<g data-m="${key}">${p}<g transform="translate(100 0) scale(-1 1)">${p}</g></g>`;
  }).join('');
  const body = `<path d="${SILHOUETTE}" fill="#F1EEFC"/><g transform="translate(100 0) scale(-1 1)"><path d="${SILHOUETTE}" fill="#F1EEFC"/></g>`;
  const head = `<ellipse cx="${HEAD.cx}" cy="${HEAD.cy}" rx="${HEAD.rx}" ry="${HEAD.ry}" fill="#F1EEFC"/>`;
  return `<svg viewBox="0 0 100 210" class="body__view" aria-hidden="true" focusable="false">${body}${head}${paths}</svg>`;
}

/**
 * דמות גוף (מקדימה ומאחורה) עם השרירים של תרגיל: עיקריים בצבע חזק, משניים בבהיר.
 * ex = { p: [...], sec: [...] }. size: 'md' (ספרייה) | 'sm' (תמונה ממוזערת).
 */
export function bodyFigure(ex, { size = 'md' } = {}) {
  const level = (k) => (ex.p.includes(k) ? 'main' : ex.sec.includes(k) ? 'sec' : null);
  const label = tr('שרירים: {main}', { main: ex.p.map(muscleName).join(', ') })
    + (ex.sec.length ? `. ${tr('משניים')}: ${ex.sec.map(muscleName).join(', ')}` : '');
  return el('div', { class: `body body--${size}`, role: 'img', 'aria-label': label }, svg(view(FRONT, level)), svg(view(BACK, level)));
}
