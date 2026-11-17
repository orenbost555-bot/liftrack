import { el, svg } from '../dom.js';
import { segmented } from '../components/segmented.js';
import { saveProfile } from '../store.js';
import { navigate } from '../router.js';
import { tr, getLang, setLang } from '../i18n.js';

// משקולת עומדת במקום האות I בלוגו
const DUMBBELL = `<svg width="27" height="37" viewBox="0 0 34 46" aria-hidden="true">
  <defs>
    <linearGradient id="blk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0A0A0D"/><stop offset="0.35" stop-color="#4A4A55"/><stop offset="0.6" stop-color="#1A1A1F"/><stop offset="1" stop-color="#050507"/></linearGradient>
    <linearGradient id="hnd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2A2A30"/><stop offset="0.4" stop-color="#9A9AA6"/><stop offset="1" stop-color="#2A2A30"/></linearGradient>
  </defs>
  <rect x="13" y="8" width="8" height="30" fill="url(#hnd)"/>
  <rect x="2" y="0" width="30" height="10" rx="3" fill="url(#blk)"/>
  <rect x="2" y="36" width="30" height="10" rx="3" fill="url(#blk)"/>
  <rect x="7" y="9" width="20" height="3" rx="1" fill="url(#blk)"/>
  <rect x="7" y="34" width="20" height="3" rx="1" fill="url(#blk)"/>
</svg>`;

export function onboardingScreen() {
  // מצב מקומי של הטופס. נשמר לחנות רק בלחיצה על "בואו נתחיל".
  const form = { name: '', gender: 'm', lang: getLang(), unit: 'kg' };
  try { // החלפת שפה מרעננת את הדף; השם והיחידות שכבר הוזנו נשמרים
    const kept = JSON.parse(sessionStorage.getItem('liftrack.draft') ?? 'null');
    if (kept) { form.name = kept.name ?? ''; form.unit = kept.unit ?? 'kg'; form.gender = kept.gender ?? 'm'; }
    sessionStorage.removeItem('liftrack.draft');
  } catch { /* אין sessionStorage: מתחילים נקי */ }

  const start = el('button', { class: 'btn btn--block', type: 'submit', disabled: form.name === '' }, tr('בואו נתחיל'));

  const nameInput = el('input', {
    class: 'field', type: 'text', name: 'name', value: form.name, autocomplete: 'given-name', 'aria-label': tr('שם'), maxlength: '30',
    oninput: (e) => {
      form.name = e.target.value.trim();
      start.disabled = form.name === ''; // אי אפשר להתחיל בלי שם
    },
  });

  const row = (label, control) => el('div', { class: 'row' }, el('span', { class: 'row__label' }, label), control);

  return el('main', { class: 'screen screen--no-nav' },
    el('div', { class: 'welcome' },
      el('div', { class: 'logo', role: 'img', 'aria-label': 'LIFTRACK' }, 'L', svg(DUMBBELL), 'FTRACK'),
      el('div', { class: 'welcome__title' }, tr('בואו נתחיל'))),
    el('form', {
      class: 'card', style: 'display:flex;flex-direction:column;gap:8px;margin-bottom:12px',
      onsubmit: (e) => {
        e.preventDefault();
        if (!form.name) return;
        saveProfile(form);
        navigate('/home');
      },
    },
      row(tr('שם'), nameInput),
      getLang() === 'he' ? row(tr('מין'), segmented({ options: [['m', tr('מתאמן')], ['f', tr('מתאמנת')]], value: form.gender, onChange: (v) => (form.gender = v) })) : null,
      row(tr('שפה'), segmented({ options: [['he', 'עברית'], ['en', 'English']], value: form.lang, onChange: (v) => {
        if (v === form.lang) return;
        try { sessionStorage.setItem('liftrack.draft', JSON.stringify(form)); } catch { /* ממשיכים בלי */ }
        setLang(v);
        location.reload();
      } })),
      row(tr('יחידות'), segmented({ options: [['kg', tr('ק״ג')], ['lb', tr('פאונד')]], value: form.unit, onChange: (v) => (form.unit = v) })),
      el('div', { style: 'margin-top:8px' }, start)));
}
