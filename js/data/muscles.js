import { tr } from '../i18n.js';
// שמות השרירים בעברית לפי המפתחות שבספריית התרגילים.
export const MUSCLE_NAMES = {
  chestUpper: 'חזה עליון', chestMid: 'חזה אמצעי', chestLower: 'חזה תחתון',
  antDelt: 'כתף קדמית', latDelt: 'כתף אמצעית', postDelt: 'כתף אחורית',
  lats: 'רחב גבי', traps: 'טרפזים', rhomboids: 'מעוינים', erectors: 'זוקפי גב',
  biceps: 'יד קדמית', triceps: 'יד אחורית', forearms: 'אמות',
  rectus: 'ישר בטני', obliques: 'אלכסונים',
  quads: 'ארבע ראשי', hamstrings: 'המסטרינגס', glutes: 'ישבן', calves: 'תאומים וסוליה',
};
export const muscleName = (key) => tr(MUSCLE_NAMES[key] ?? key);
