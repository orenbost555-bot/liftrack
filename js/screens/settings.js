import { el, mount } from '../dom.js';
import { segmented } from '../components/segmented.js';
import { getProfile, getTemplates, saveProfile, getSettings, saveSettings, exportData, importData, resetAll } from '../store.js';
import { REST_OPTIONS } from '../logic/backup.js';
import { navigate } from '../router.js';
import { slotsOf } from '../logic/templates.js';
import { NUDGE_OPTIONS } from '../logic/idle-nudge.js';
import { reminderState, enableReminders, disableReminders, sendTestReminder } from '../reminders.js';
import { tr, BACK, getLang, setLang } from '../i18n.js';

const IMPORT_ERRORS = {
  json: tr('הקובץ אינו קובץ גיבוי תקין.'),
  format: tr('זה לא קובץ גיבוי של LIFTRACK.'),
  shape: tr('קובץ הגיבוי פגום ולא ניתן לשחזר ממנו.'),
};

const switchRow = (label, on, onToggle) =>
  el('button', { class: 'switch switch--row', role: 'switch', 'aria-checked': on ? 'true' : 'false', onclick: onToggle },
    el('span', {}, label), el('span', { class: 'switch__track' }, el('span', { class: 'switch__knob' })));


/** הגדרות: #/settings. נפתח מהגלגל במסך היעדים. */
export function settingsScreen() {
  const main = el('main', { class: 'screen' });
  let notice = ''; // הודעת הצלחה/שגיאה אחרי גיבוי או שחזור
  let noticeBad = false;
  let confirm = null; // 'import' | 'reset' | null
  let pendingText = '';
  let remState = 'unconfigured';
  const refreshReminders = async () => { remState = await reminderState(); render(); };

  const fileInput = el('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': tr('בחירת קובץ גיבוי'),
    onchange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      pendingText = await file.text();
      confirm = 'import';
      render();
    } });

  function download() {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `liftrack-backup-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice = tr('הגיבוי נשמר. שמור את הקובץ במקום בטוח.');
    noticeBad = false;
    render();
  }

  function doImport() {
    const r = importData(pendingText);
    pendingText = '';
    confirm = null;
    if (r.ok) {
      const lang = getProfile().lang === 'en' ? 'en' : 'he';
      navigate('/home');
      if (lang !== getLang()) { setLang(lang); location.reload(); }
      return;
    }
    notice = IMPORT_ERRORS[r.error];
    noticeBad = true;
    render();
  }

  const section = (title, ...rows) => el('section', { class: 'prefs' }, el('h2', { class: 'lib__subtitle' }, title), el('div', { class: 'card prefs__card' }, rows));
  const row = (label, control) => el('div', { class: 'row' }, el('span', { class: 'row__label' }, label), control);

  function render() {
    const profile = getProfile();
    const s = getSettings();
    mount(main,
      el('div', { class: 'topbar' },
        el('a', { class: 'back', href: '#/goals', 'aria-label': tr('חזרה ליעדים') }, BACK()),
        el('h1', { class: 'title' }, tr('הגדרות'))),
      notice ? el('p', { class: noticeBad ? 'wk__hint' : 'msg msg--up', role: 'status', style: noticeBad ? 'margin:0' : '' }, notice) : null,

      section(tr('פרופיל'),
        row(tr('שם'), el('input', { class: 'field', type: 'text', value: profile.name, maxlength: '30', 'aria-label': tr('שם'),
          onchange: (e) => { const name = e.target.value.trim(); if (name) saveProfile({ ...getProfile(), name }); else e.target.value = getProfile().name; } })),
        getLang() === 'he' ? row(tr('מין'), segmented({ options: [['m', tr('מתאמן')], ['f', tr('מתאמנת')]], value: profile.gender, onChange: (v) => saveProfile({ ...getProfile(), gender: v }) })) : null,
        row(tr('שפה'), segmented({ options: [['he', 'עברית'], ['en', 'English']], value: getLang(), onChange: (v) => { saveProfile({ ...getProfile(), lang: v }); setLang(v); location.reload(); } })),
        row(tr('יחידות'), segmented({ options: [['kg', tr('ק״ג')], ['lb', tr('פאונד')]], value: profile.unit, onChange: (v) => { saveProfile({ ...getProfile(), unit: v }); notice = tr('שינוי יחידות משנה רק את התווית. המספרים השמורים לא מומרים.'); noticeBad = false; render(); } }))),

      section(tr('אימון'),
        switchRow(tr('טיימר מנוחה אחרי כל סט'), s.restTimer, () => { saveSettings({ restTimer: !s.restTimer }); render(); }),
        s.restTimer
          ? el('div', { class: 'row row--stack' }, el('span', { class: 'row__label' }, tr('זמן מנוחה')), segmented({ options: REST_OPTIONS.map((v) => [v, v >= 120 ? tr('{n} דק׳', { n: v / 60 }) : tr('{n} שנ׳', { n: v })]), value: s.restSeconds, onChange: (v) => saveSettings({ restSeconds: v }) }))
          : null,
        switchRow(tr('הודעות מוטיבציה'), s.motivation !== false, () => { saveSettings({ motivation: s.motivation === false }); render(); })),

      remState === 'unconfigured' ? null : section(tr('תזכורות'), ...[
        remState === 'install' ? el('p', { class: 'muted prefs__note' }, tr('באייפון צריך קודם להוסיף את האפליקציה למסך הבית (שיתוף ← הוסף למסך הבית) ולפתוח אותה משם.'))
        : remState === 'unsupported' ? el('p', { class: 'muted prefs__note' }, tr('הדפדפן הזה לא תומך בתזכורות.'))
        : remState === 'denied' ? el('p', { class: 'muted prefs__note' }, tr('ההתראות חסומות. אפשר לאפשר אותן בהגדרות הטלפון עבור האפליקציה.'))
        : [
            switchRow(tr('תזכורת לאימון'), remState === 'on', async () => {
              if (remState === 'on') { await disableReminders(); } else { await enableReminders(); }
              refreshReminders();
            }),
            remState === 'on' ? el('div', { class: 'row row--stack' }, el('span', { class: 'row__label' }, tr('תזכורת מוקדמת: כמה שעות לפני האימון')),
              segmented({ cls: 'segmented--5', options: [[0, tr('כבוי')], [1, '1'], [2, '2'], [3, '3'], [4, '4']], value: s.reminderLead ?? 2,
                onChange: (v) => { saveSettings({ reminderLead: v }); render(); } })) : null,
            remState === 'on' ? switchRow(tr('גם תזכורת בערב שלפני'), s.reminderEve !== false, () => { saveSettings({ reminderEve: s.reminderEve === false }); render(); }) : null,
            remState === 'on' && s.reminderEve !== false
              ? row(tr('שעה בערב שלפני'), el('input', { class: 'field time', type: 'time', value: s.reminderEveTime || '20:00', 'aria-label': tr('שעה בערב שלפני'),
                  onchange: (e) => { if (e.target.value) saveSettings({ reminderEveTime: e.target.value }); } }))
              : null,
            remState === 'on' ? el('div', { class: 'row row--stack' }, el('span', { class: 'row__label' }, tr('חזור לאימון: התראה אם אין סט חדש (דקות)')),
              segmented({ cls: 'segmented--6', options: NUDGE_OPTIONS.map((m) => [m, m === 0 ? tr('כבוי') : String(m)]), value: s.idleNudge ?? 0,
                onChange: (v) => { saveSettings({ idleNudge: v }); render(); } })) : null,
            el('p', { class: 'muted prefs__note' }, remState === 'on' && !getTemplates().some((t) => slotsOf(t).some((x) => x.time))
              ? tr('כדי לקבל תזכורת, קבע בתבנית יום ושעה.')
              : tr('התזכורות מחושבות מהיום והשעה שקבעת לתבנית: כמה שעות לפני האימון ובערב שלפני. תזכורת של אותו יום לא נשלחת אם כבר התאמנת. לשרת נשלחים רק ימים, שעות ושמות תבניות.')),
            remState === 'on' ? el('button', { class: 'outline-btn', onclick: async () => { const ok = await sendTestReminder('LIFTRACK', tr('כך תיראה התזכורת')); notice = ok ? tr('נשלחה התראת בדיקה.') : tr('השליחה נכשלה. בדוק חיבור לאינטרנט.'); noticeBad = !ok; render(); } }, tr('שלח התראת בדיקה')) : null,
          ]].flat()),

      section(tr('הנתונים שלי'),
        el('p', { class: 'muted prefs__note' }, tr('הכל נשמר רק בטלפון הזה. גיבוי מאפשר להעביר או לשחזר את הנתונים.')),
        el('div', { class: 'prefs__btns' },
          el('button', { class: 'outline-btn', onclick: download }, tr('שמור גיבוי')),
          el('button', { class: 'outline-btn', onclick: () => fileInput.click() }, tr('שחזר מגיבוי')),
          fileInput),
        confirm === 'import'
          ? el('div', { class: 'prefs__confirm', role: 'alertdialog' },
              el('span', {}, tr('השחזור מחליף את כל הנתונים הנוכחיים. להמשיך?')),
              el('div', { class: 'prefs__btns' },
                el('button', { class: 'btn btn--sm', onclick: doImport }, tr('כן, שחזר')),
                el('button', { class: 'outline-btn', onclick: () => { confirm = null; pendingText = ''; render(); } }, tr('ביטול'))))
          : null,
        confirm === 'reset'
          ? el('div', { class: 'prefs__confirm', role: 'alertdialog' },
              el('span', {}, tr('זה ימחק לצמיתות את כל האימונים, התבניות והיעדים. אי אפשר לבטל.')),
              el('div', { class: 'prefs__btns' },
                el('button', { class: 'btn btn--sm prefs__danger', onclick: () => { resetAll(); navigate('/onboarding'); } }, tr('כן, מחק הכל')),
                el('button', { class: 'outline-btn', onclick: () => { confirm = null; render(); } }, tr('ביטול'))))
          : el('button', { class: 'link-danger', onclick: () => { confirm = 'reset'; render(); } }, tr('מחק את כל הנתונים'))),

      el('p', { class: 'muted prefs__note', style: 'text-align:center' },
        el('a', { href: `privacy.html?lang=${getLang()}`, target: '_blank', rel: 'noopener' }, tr('מדיניות פרטיות')), ' · LIFTRACK'));
  }
  render();
  refreshReminders();
  return main;
}
