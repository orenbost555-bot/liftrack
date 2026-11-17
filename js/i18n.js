// tr = תרגום: מפתח התרגום הוא הטקסט בעברית (עם {name} למשתנים). בעברית מחזירים אותו כמו שהוא,
// ובאנגלית מחפשים ב-EN (js/i18n-en.js). תרגום חסר חוזר לעברית, ובדיקה אוטומטית (test/i18n.test.js)
// דואגת שלא יישאר מפתח בלי תרגום.
// צורת רבים באנגלית: 'one|other' נבחרת לפי params.n (1 = יחיד).
//
// השפה נקבעת פעם אחת בטעינה (מהפרופיל, ובזמן ההרשמה ממפתח נפרד), כך שגם קבועים ברמת המודול
// מתורגמים נכון. החלפת שפה שומרת ומרעננת את הדף.
import { EN } from './i18n-en.js';

const LANG_KEY = 'liftrack.lang';

function detect() {
  try {
    const raw = localStorage.getItem('liftrack.v1');
    const profileLang = raw ? JSON.parse(raw)?.profile?.lang : null;
    if (profileLang === 'en' || profileLang === 'he') return profileLang;
    const stored = localStorage.getItem(LANG_KEY);
    return stored === 'en' ? 'en' : 'he';
  } catch {
    return 'he';
  }
}

let lang = detect();

export const getLang = () => lang;
export const isRtl = () => lang === 'he';

function applyDocument() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtl() ? 'rtl' : 'ltr';
}
applyDocument();

/** משנה שפה בזיכרון ושומר אותה גם לפני שיש פרופיל. הקוראים מרעננים את הדף. */
export function setLang(next) {
  lang = next === 'en' ? 'en' : 'he';
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* חסום: ממשיכים */ }
  applyDocument();
}

export function tr(key, params) {
  let s = key;
  if (lang === 'en') {
    s = EN[key] ?? key;
    if (s.includes('|') && params && 'n' in params) {
      const [one, other] = s.split('|');
      s = params.n === 1 ? one : other;
    }
  }
  s = s.replace(/@@\w+$/, ''); // @@הקשר: מבדיל מפתחות זהים בעברית שמתורגמים אחרת
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
  return s;
}

/** חיצי ניווט: "חזרה" מצביע לצד שבו מתחיל הטקסט, "קדימה" לצד ההפוך. */
export const BACK = () => (isRtl() ? '›' : '‹');
export const FORWARD = () => (isRtl() ? '‹' : '›');
