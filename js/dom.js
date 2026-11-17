// עזר קטן לבניית אלמנטים בלי innerHTML.
// למה לא innerHTML? אם שם המשתמש יכיל תגיות HTML, innerHTML היה מריץ אותן (פרצת XSS).
// כאן כל טקסט נכנס דרך textContent / createTextNode ולכן תמיד מוצג כטקסט בלבד.

/**
 * el('button', { class: 'btn', onclick: fn }, 'שלום')
 * props: class, text, ו-on* לאירועים, כל השאר הופך לתכונה (attribute).
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** יוצר SVG מטקסט שאנחנו כתבנו בעצמנו (לא מקלט משתמש), לכן בטוח. */
export function svg(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

/**
 * מחליף את תוכן parent בילדים החדשים. שלא כמו replaceChildren הרגיל, מפרק מערכים מקוננים
 * ומדלג על null / undefined / false (אחרת replaceChildren היה מציג את המילה "null" על המסך).
 */
export function mount(parent, ...children) {
  const flat = children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false);
  parent.replaceChildren(...flat.map((c) => (c instanceof Node ? c : document.createTextNode(String(c)))));
}
