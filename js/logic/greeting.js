import { tr, getLang } from '../i18n.js';
import { COMPLIMENTS_EN } from '../i18n-data.js';
// לוגיקה טהורה של הברכה: אין כאן DOM ואין גישה לשעון או לאקראיות בלי שמעבירים אותם,
// ולכן קל לבדוק אותה (ראה test/greeting.test.js).

/** בוקר טוב 5-11, צהריים טובים 12-16, ערב טוב 17-21, אחרת לילה טוב. */
export function dayPart(hour) {
  if (hour >= 5 && hour < 12) return tr('בוקר טוב');
  if (hour >= 12 && hour < 17) return tr('צהריים טובים');
  if (hour >= 17 && hour < 22) return tr('ערב טוב');
  return tr('לילה טוב');
}

const COMPLIMENTS = {
  m: ['אלוף', 'תותח', 'לוחם', 'מכונה', 'אריה'],
  f: ['אלופה', 'תותחית', 'לוחמת', 'מכונה', 'מלכה'],
};

/** בוחר איבר אקראי. rng מוזרק כדי שאפשר יהיה לבדוק בצורה דטרמיניסטית. */
export function pick(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)];
}

/** "ערב טוב אלופה" */
export function buildGreeting(date, gender, rng = Math.random) {
  if (getLang() === 'en') return `${dayPart(date.getHours())}, ${pick(COMPLIMENTS_EN, rng)}`;
  const list = COMPLIMENTS[gender] ?? COMPLIMENTS.m;
  return `${dayPart(date.getHours())} ${pick(list, rng)}`;
}
