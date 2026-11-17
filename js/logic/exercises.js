import { LIBRARY } from '../data/exercises.js';
import { getLang } from '../i18n.js';
import { DESC_EN, NAME_EN } from '../i18n-data.js';

// באנגלית: he = השם באנגלית ו-en = תיאור קצר באנגלית (השדות נשארים באותם שמות כדי שהמסכים לא ישתנו).
const HEB = /[\u05d0-\u05ea]/;
function localize(ex) {
  const [first, desc] = ex.en.split(' · ');
  const name = HEB.test(first) ? NAME_EN[ex.id] ?? ex.id : first;
  const description = HEB.test(first) ? DESC_EN[first] ?? '' : desc ? DESC_EN[desc] ?? desc : '';
  return { ...ex, he: name, en: description };
}

// ---- תרגילים מותאמים אישית ----
// נשמרים ב-store ומועברים לכאן. כל שינוי מעלה גרסה, כדי שהמטמון של allExercises יתרענן.
let custom = [];
let rev = 0;
const NONE = [];
export function setCustomExercises(list) {
  const next = Array.isArray(list) ? list : NONE;
  if (next === custom) return;
  custom = next;
  rev += 1;
}

/** המקום בספרייה (קבוצה + תת-שריר) שבו יופיע תרגיל לפי השריר העיקרי הראשון שלו. */
export function homeOf(muscle, library = LIBRARY) {
  for (const g of library) for (const s of g.subs) if (s.ex.some((e) => e.p[0] === muscle)) return { group: g.id, sub: s.name };
  for (const g of library) for (const s of g.subs) if (s.ex.some((e) => e.p.includes(muscle))) return { group: g.id, sub: s.name };
  return null;
}

// בעברית: he = השם העברי ו-en = השם האנגלי. באנגלית: he = השם האנגלי (או העברי אם חסר) ו-en = השם העברי.
function customView(c, en) {
  const he = c.he || c.en;
  const enName = c.en || c.he;
  return en ? { ...c, he: enName, en: he === enName ? '' : he } : { ...c, he, en: enName === he ? '' : enName };
}

// הופך את המבנה המקונן (קבוצה -> תת-שריר -> תרגיל) לרשימה שטוחה אחת.
// כל תרגיל מקבל גם group (id של הקבוצה) ו-sub (שם תת-השריר), כדי שנדע מאיפה הוא.
// תרגילים מותאמים נכנסים בסוף תת-השריר של השריר העיקרי הראשון שלהם.
let memo = null;
export function allExercises(library = LIBRARY) {
  const en = getLang() === 'en';
  if (library === LIBRARY && memo && memo.rev === rev && memo.en === en) return memo.list;
  const extra = new Map(); // "group|sub" -> [תרגילים]
  for (const c of custom) {
    const home = homeOf(c.p[0], library);
    if (!home) continue;
    const key = `${home.group}|${home.sub}`;
    if (!extra.has(key)) extra.set(key, []);
    extra.get(key).push({ ...customView(c, en), custom: true });
  }
  const out = [];
  for (const group of library) {
    for (const sub of group.subs) {
      for (const exercise of sub.ex) {
        out.push({ ...(en ? localize(exercise) : exercise), group: group.id, sub: sub.name });
      }
      for (const x of extra.get(`${group.id}|${sub.name}`) ?? []) out.push({ ...x, group: group.id, sub: sub.name });
    }
  }
  if (library === LIBRARY) memo = { rev, en, list: out };
  return out;
}

// מחזיר את התרגילים שהשריר הוא אחד מהשרירים העיקריים שלהם (p).
// שרירים משניים (sec) לא נספרים: חתירה היא תרגיל גב, לא תרגיל יד קדמית.
export function exercisesByMuscle(exercises, muscle) {
  return exercises.filter((e) => e.p.includes(muscle));
}

// חיפוש חופשי בשם העברי ובתיאור האנגלי. לא רגיש לאותיות גדולות/קטנות,
// ומתעלם מרווחים בקצוות. טקסט ריק מחזיר את הכול.
export function searchExercises(exercises, text) {
  const q = text.trim().toLowerCase();
  if (!q) return exercises;
  return exercises.filter((e) => e.he.toLowerCase().includes(q) || e.en.toLowerCase().includes(q));
}

// מקבץ רשימה של תרגילים חזרה לפי תת-שריר, בסדר שבו הם מופיעים בספרייה.
// מחזיר [{ name: 'חזה עליון', ex: [...] }, ...]
export function groupBySub(exercises) {
  const map = new Map();
  for (const e of exercises) {
    if (!map.has(e.sub)) map.set(e.sub, []);
    map.get(e.sub).push(e);
  }
  return [...map].map(([name, ex]) => ({ name, ex }));
}
