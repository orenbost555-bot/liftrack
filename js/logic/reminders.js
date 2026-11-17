import { tr } from '../i18n.js';
import { slotsOf } from './templates.js';

const pad = (n) => String(n).padStart(2, '0');
/** תאריך מקומי בפורמט YYYY-MM-DD (כמו שהשרת מחשב לפי אזור הזמן של המשתמש). */
export const localDate = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

/** תבניות עם יום ושעה הופכות לתזכורות (כמה שעות לפני, וערב לפני). */
export function buildSchedule(templates, { eve = false, eveTime = '20:00', lead = 0 } = {}) {
  // כל יום בתבנית עם שעה הוא אימון נפרד, עם שעה משלו
  const scheduled = templates.flatMap((t) => slotsOf(t).filter((s) => /^\d{1,2}:\d{2}$/.test(s.time ?? '')).map((s) => ({ name: t.name, day: s.day, time: s.time })));
  const list = []; // אין תזכורת בשעת האימון עצמו: רק "כמה שעות לפני" ו"ערב לפני"
  // תזכורת כמה שעות לפני האימון (kind: 'lead'). אם יוצא לפני חצות, עוברת ליום הקודם
  if (lead > 0) {
    for (const t of scheduled) {
      const [h, m] = t.time.split(':').map(Number);
      const total = h * 60 + m - lead * 60;
      const day = total < 0 ? (t.day + 6) % 7 : t.day;
      const mins = ((total % 1440) + 1440) % 1440;
      list.push({ day, time: `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`, kind: 'lead', title: t.name || 'LIFTRACK',
        body: lead === 1 ? tr('עוד שעה לאימון. תתכוננו!') : tr('עוד {n} שעות לאימון. תתכוננו!', { n: lead }) });
    }
  }
  // תזכורת בערב שלפני האימון (kind: 'eve'): נשלחת גם אם התאמנת באותו יום
  if (eve && /^\d{1,2}:\d{2}$/.test(eveTime)) {
    for (const t of scheduled) list.push({ day: (t.day + 6) % 7, time: eveTime, kind: 'eve', title: t.name || 'LIFTRACK', body: tr('מחר יש אימון. תתכוננו!') });
  }
  return list;
}

/** התאריך המקומי של האימון האחרון שהסתיים (השרת לא שולח תזכורת ביום שבו כבר התאמנת). */
export function lastDoneDate(workouts) {
  const ends = workouts.map((w) => w.endedAt ?? w.startedAt).filter(Boolean);
  return ends.length ? localDate(Math.max(...ends)) : null;
}
