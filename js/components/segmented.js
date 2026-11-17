import { el } from '../dom.js';

/**
 * בקרה מקוטעת: כפתורים שרק אחד מהם נבחר.
 * options: [['m', 'מתאמן'], ['f', 'מתאמנת']]
 * aria-pressed מעדכן קוראי מסך מה נבחר, וה-CSS משתמש בו לצביעה.
 */
export function segmented({ options, value, onChange, cls = '' }) {
  const wrap = el('div', { class: `segmented ${cls}`.trim(), role: 'group' });
  const buttons = options.map(([val, label]) =>
    el('button', {
      type: 'button',
      class: 'segmented__item',
      'aria-pressed': String(val === value),
      onclick: () => {
        buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i][0] === val)));
        onChange(val);
      },
    }, label)
  );
  wrap.append(...buttons);
  return wrap;
}
