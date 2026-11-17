import { el, svg, mount } from '../dom.js';
import { niceTicks } from '../logic/progress.js';
import { formatDayMonth, monthShort } from '../logic/summary.js';
import { tr, isRtl } from '../i18n.js';

// גרף קו בודד (סדרה אחת, ציר אחד) ב-SVG, לפי העיצוב: ציר הזמן זורם מימין לשמאל (עברית),
// ערכי הציר בצד ימין. כולל קו מצביע + תיאור כלי בריחוף/מגע, מקלדת, ותצוגת טבלה.
//
// points: [{ t, v, mark: 'up' | 'flat', value: 'טקסט הערך', note: 'הערה קצרה', cells: [..] }]  (מהישן לחדש)
// options: { format(v), goal: { value, label } | null, ariaLabel, headers: [..], selected, onSelect(i) }

const W = 322, H = 172;
const X_LEFT = 24, X_RIGHT = 264;      // טווח הנקודות
const GRID_L = 8, GRID_R = 280;        // טווח קווי הרשת
const Y_TOP = 24, Y_BOTTOM = 140;
const ACCENT = '#5B3DF5', GOAL = '#C2288A', INK_MUTED = '#5E5A7A', HAIR = '#EEEAFB', BASELINE = '#D3CDF0', RING = '#8E88B0';
const DAY = 24 * 60 * 60 * 1000;
// בעברית הזמן זורם מימין לשמאל והערכים בצד ימין. באנגלית הכול מתהפך (mx מחשב את ה-x ההפוך).
const mx = (x) => (isRtl() ? x : W - x);

function xTicks(t0, t1) {
  if (t1 - t0 < DAY) return [{ t: t0, label: formatDayMonth(t0) }];
  if (t1 - t0 >= 60 * DAY) { // טווח ארוך: תוויות חודשים בתחילת כל חודש
    const months = [];
    const d = new Date(t0);
    d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() + 1);
    for (; d.getTime() <= t1; d.setMonth(d.getMonth() + 1)) months.push({ t: d.getTime(), label: monthShort(d.getTime()) });
    if (months.length >= 2) {
      const step = Math.ceil(months.length / 4);
      return months.filter((_, i) => i % step === 0);
    }
  }
  return [0, 1, 2].map((i) => { const t = t0 + ((t1 - t0) * i) / 2; return { t, label: formatDayMonth(t) }; });
}

export function lineChart(points, options = {}) {
  const { format = String, goal = null, ariaLabel = '', headers = [tr('תאריך'), tr('ערך')], onSelect = () => {} } = options;
  let selected = options.selected ?? points.length - 1;

  const t0 = points[0].t, t1 = points[points.length - 1].t;
  const px = (t) => mx(t1 === t0 ? (X_LEFT + X_RIGHT) / 2 : X_RIGHT - ((t - t0) / (t1 - t0)) * (X_RIGHT - X_LEFT));
  const values = points.map((p) => p.v).concat(goal ? [goal.value] : []);
  const ticks = niceTicks(Math.min(...values), Math.max(...values), 3);
  const yMin = ticks[0], yMax = ticks[ticks.length - 1];
  const py = (v) => Y_BOTTOM - ((v - yMin) / (yMax - yMin)) * (Y_BOTTOM - Y_TOP);

  const f = (n) => Math.round(n * 10) / 10;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${f(px(p.t))},${f(py(p.v))}`).join(' ');
  const area = `${line} L${f(px(t1))},${Y_BOTTOM} L${f(px(t0))},${Y_BOTTOM} Z`;

  const grid = ticks.map((v, i) =>
    `<line x1="${mx(GRID_L)}" y1="${f(py(v))}" x2="${mx(GRID_R)}" y2="${f(py(v))}" stroke="${i === 0 ? BASELINE : HAIR}" stroke-width="1"/>` +
    `<text x="${mx(302)}" y="${f(py(v)) + 4}" text-anchor="middle" font-size="12" fill="${INK_MUTED}">${format(v)}</text>`).join('');
  const goalMarkup = goal
    ? `<line x1="${mx(GRID_L)}" y1="${f(py(goal.value))}" x2="${mx(GRID_R)}" y2="${f(py(goal.value))}" stroke="${GOAL}" stroke-width="1.5" stroke-dasharray="5 4"/>` +
      `<text x="${mx(GRID_R - 4)}" y="${f(py(goal.value)) - 5}" text-anchor="start" font-size="12" font-weight="700" fill="#1B1535">${goal.label}</text>`
    : '';
  const xlabels = xTicks(t0, t1).map((k) =>
    `<text x="${f(px(k.t))}" y="162" text-anchor="middle" font-size="12" fill="${INK_MUTED}">${k.label}</text>`).join('');
  const dots = points.map((p, i) => p.mark === 'up'
    ? `<circle data-i="${i}" cx="${f(px(p.t))}" cy="${f(py(p.v))}" r="5" fill="${ACCENT}" stroke="#FFFFFF" stroke-width="2"/>`
    : `<circle data-i="${i}" cx="${f(px(p.t))}" cy="${f(py(p.v))}" r="5" fill="#FFFFFF" stroke="${RING}" stroke-width="2"/>`).join('');

  const root = svg(`<svg viewBox="0 0 ${W} ${H}" width="100%" class="lc__svg" aria-hidden="true" focusable="false">
    <defs><linearGradient id="lcArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ACCENT}" stop-opacity="0.16"/><stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/></linearGradient></defs>
    ${grid}${goalMarkup}
    ${points.length > 1 ? `<path d="${area}" fill="url(#lcArea)"/><path d="${line}" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    <line class="lc__cross" y1="${Y_TOP - 6}" y2="${Y_BOTTOM}" stroke="${BASELINE}" stroke-width="1" visibility="hidden"/>
    <line class="lc__drop" y1="0" y2="${Y_BOTTOM}" stroke="${ACCENT}" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.5"/>
    ${dots}
    <circle class="lc__halo" r="10" fill="none" stroke="${ACCENT}" stroke-width="2" opacity="0.35"/>
    ${xlabels}
  </svg>`);

  const cross = root.querySelector('.lc__cross');
  const drop = root.querySelector('.lc__drop');
  const halo = root.querySelector('.lc__halo');

  const tipValue = el('span', { class: 'lc__tipv' });
  const tipNote = el('span', { class: 'lc__tipn' });
  const tipDate = el('span', { class: 'lc__tipd' });
  const tip = el('div', { class: 'lc__tip', hidden: true, 'aria-hidden': 'true' }, tipValue, tipNote, tipDate);
  const live = el('span', { class: 'sr-only', 'aria-live': 'polite' });

  function showSelected() {
    const p = points[selected];
    const x = f(px(p.t)), y = f(py(p.v));
    halo.setAttribute('cx', x); halo.setAttribute('cy', y);
    drop.setAttribute('x1', x); drop.setAttribute('x2', x); drop.setAttribute('y1', y);
    live.textContent = `${formatDayMonth(p.t)}: ${p.value}${p.note ? `, ${p.note}` : ''}`;
  }

  function showTip(i) {
    const p = points[i];
    const x = px(p.t), y = py(p.v);
    cross.setAttribute('x1', f(x)); cross.setAttribute('x2', f(x)); cross.setAttribute('visibility', 'visible');
    tipValue.textContent = p.value;
    tipNote.textContent = p.note ?? '';
    tipDate.textContent = formatDayMonth(p.t);
    tip.hidden = false;
    const left = Math.min(82, Math.max(18, (x / W) * 100)); // לא חורג מהמסגרת
    tip.style.left = `${left}%`;
    tip.style.top = `${(Math.max(y - 56, 0) / H) * 100}%`;
  }
  const hideTip = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); };

  function select(i, { announce = true } = {}) {
    selected = Math.max(0, Math.min(points.length - 1, i));
    showSelected();
    if (announce) onSelect(selected);
  }

  function nearest(ev) { // הנקודה הקרובה ביותר אופקית, בלי קשר לגובה (מטרת מגע רחבה)
    const rect = root.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(px(p.t) - x) < Math.abs(px(points[best].t) - x)) best = i; });
    return best;
  }

  const wrap = el('div', { class: 'lc', tabindex: '0', role: 'group', 'aria-label': ariaLabel,
    onpointermove: (e) => { const i = nearest(e); showTip(i); if (e.buttons || e.pointerType === 'touch') select(i); },
    onpointerdown: (e) => { const i = nearest(e); showTip(i); select(i); },
    onpointerleave: hideTip,
    onpointerup: (e) => { if (e.pointerType === 'touch') hideTip(); },
    onfocus: () => showTip(selected),
    onblur: hideTip,
    onkeydown: (e) => {
      // בציר מימין לשמאל (עברית) חץ שמאלה = אימון חדש יותר; באנגלית חץ ימינה
      const delta = (isRtl() ? { ArrowLeft: 1, ArrowRight: -1 } : { ArrowLeft: -1, ArrowRight: 1 })[e.key];
      if (!delta) return;
      e.preventDefault();
      select(selected + delta);
      showTip(selected);
    } }, root, tip, live);

  // תצוגת טבלה: כל הערכים נגישים גם בלי ריחוף
  const table = el('table', { class: 'lc__table', hidden: true },
    el('thead', {}, el('tr', {}, headers.map((h) => el('th', { scope: 'col' }, h)))),
    el('tbody', {}, [...points].reverse().map((p) => el('tr', {}, p.cells.map((c) => el('td', {}, c))))));
  const toggle = el('button', { class: 'lc__toggle', 'aria-pressed': 'false',
    onclick: () => {
      const on = table.hidden;
      table.hidden = !on; wrap.hidden = on;
      toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
      toggle.textContent = on ? tr('הצג גרף') : tr('הצג כטבלה');
    } }, tr('הצג כטבלה'));

  showSelected();
  return { node: el('div', { class: 'lc__box' }, wrap, table), toggle, setSelected: (i) => select(i, { announce: false }) };
}
