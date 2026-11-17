import { el, mount } from '../dom.js';
import { REST_OPTIONS } from '../logic/backup.js';
import { tr } from '../i18n.js';

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const csec = (ms) => `${mmss(Math.floor(ms / 1000) * 1000)}.${String(Math.floor((ms % 1000) / 10)).padStart(2, '0')}`;

/**
 * כלי עזר עצמאיים מהבית: טיימר מנוחה (ספירה לאחור) ושעון עצר, בגיליון תחתון.
 * kind: 'timer' | 'stopwatch'. מחזיר את אלמנט הגיליון; onClose נקרא כשסוגרים.
 */
export function toolSheet(kind, onClose) {
  let running = false;
  let endsAt = 0, total = 90000, left = 90000; // טיימר
  let startedAt = 0, base = 0, elapsed = 0; // שעון עצר
  let buzzed = false;
  const body = el('div', { class: 'tool' });
  const overlay = el('div', { class: 'sheet-overlay', onclick: (e) => { if (e.target === e.currentTarget) close(); } },
    el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': kind === 'timer' ? tr('טיימר מנוחה') : tr('שעון עצר') },
      el('div', { class: 'sheet__head' },
        el('span', { class: 'sheet__title' }, kind === 'timer' ? tr('טיימר מנוחה') : tr('שעון עצר')),
        el('button', { class: 'icon-btn', 'aria-label': tr('סגירה'), onclick: () => close() }, '✕')),
      body));

  let handle = null;
  function close() { clearInterval(handle); overlay.remove(); onClose?.(); }

  function tick() {
    if (!overlay.isConnected) { clearInterval(handle); return; }
    if (kind === 'timer' && running) {
      left = endsAt - Date.now();
      if (left <= 0) { left = 0; running = false; if (!buzzed) { buzzed = true; navigator.vibrate?.([200, 100, 200]); } render(); return; }
    }
    if (kind === 'stopwatch' && running) elapsed = base + Date.now() - startedAt;
    const t = body.querySelector('.tool__time');
    if (t) t.textContent = kind === 'timer' ? mmss(left) : csec(elapsed);
    const bar = body.querySelector('.bar__fill');
    if (bar) bar.style.width = `${total ? Math.max(0, (left / total) * 100) : 0}%`;
  }

  function render() {
    if (kind === 'timer') {
      mount(body,
        el('div', { class: 'tool__time', role: 'timer', 'aria-live': 'off' }, mmss(left)),
        el('div', { class: 'bar bar--lg' }, el('div', { class: 'bar__fill', style: `width:${total ? (left / total) * 100 : 0}%` })),
        el('div', { class: 'chips', style: 'justify-content:center' }, REST_OPTIONS.map((s) =>
          el('button', { class: 'chip-btn', 'aria-pressed': total === s * 1000 ? 'true' : 'false', disabled: running,
            onclick: () => { total = left = s * 1000; buzzed = false; render(); } }, s >= 120 ? tr('{n} דק׳', { n: s / 60 }) : tr('{n} שנ׳', { n: s })))),
        left === 0 ? el('p', { class: 'msg msg--up', role: 'status', style: 'margin:0' }, tr('המנוחה נגמרה! הסט הבא מחכה!')) : null,
        el('div', { class: 'prefs__btns' },
          el('button', { class: 'btn btn--sm', onclick: () => {
            if (running) { running = false; left = Math.max(0, endsAt - Date.now()); }
            else { if (left === 0) left = total; buzzed = false; endsAt = Date.now() + left; running = true; }
            render();
          } }, running ? tr('השהה') : left > 0 && left < total ? tr('המשך') : tr('התחל')),
          el('button', { class: 'outline-btn', onclick: () => { running = false; left = total; buzzed = false; render(); } }, tr('אפס'))));
    } else {
      mount(body,
        el('div', { class: 'tool__time', role: 'timer', 'aria-live': 'off' }, csec(elapsed)),
        el('div', { class: 'prefs__btns' },
          el('button', { class: 'btn btn--sm', onclick: () => {
            if (running) { running = false; elapsed = base + Date.now() - startedAt; base = elapsed; }
            else { running = true; startedAt = Date.now(); }
            render();
          } }, running ? tr('עצור') : elapsed > 0 ? tr('המשך') : tr('התחל')),
          el('button', { class: 'outline-btn', onclick: () => { running = false; base = elapsed = 0; render(); } }, tr('אפס'))));
    }
  }
  render();
  handle = setInterval(tick, 50);
  return overlay;
}
