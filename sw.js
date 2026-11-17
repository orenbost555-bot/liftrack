// Service Worker: שומר את קבצי האפליקציה במטמון כדי שתיפתח גם בלי אינטרנט.
// בכל שינוי בקבצים צריך להעלות את CACHE_VERSION, אחרת הטלפון ימשיך להציג את הגרסה הישנה.
const CACHE_VERSION = 'liftrack-v37';
const SHELL = [
  './', './index.html', './privacy.html', './manifest.webmanifest', './css/styles.css',
  './js/main.js', './js/router.js', './js/store.js', './js/dom.js', './js/i18n.js', './js/i18n-en.js', './js/i18n-data.js', './js/config.js', './js/components/body-figure.js', './js/data/body.js', './js/reminders.js', './js/logic/reminders.js',
  './js/logic/greeting.js', './js/logic/exercises.js', './js/logic/templates.js', './js/logic/workout.js', './js/logic/progress.js', './js/logic/goals.js', './js/logic/backup.js', './js/logic/swap.js', './js/logic/home.js', './js/logic/summary.js', './js/data/quotes.js',
  './js/data/exercises.js', './js/data/muscles.js',
  './js/components/nav.js', './js/components/segmented.js',
  './js/screens/onboarding.js', './js/screens/home.js', './js/screens/workouts.js', './js/screens/library.js', './js/screens/history.js', './js/screens/workout.js', './js/screens/summary.js', './js/screens/progress.js', './js/screens/muscle.js', './js/screens/goals.js', './js/screens/settings.js', './js/screens/swap.js',
  './js/screens/exercise-editor.js', './js/screens/advisor.js', './js/logic/advisor.js', './js/screens/edit-workout.js',
  './js/logic/custom-exercise.js', './js/logic/idle-nudge.js', './js/components/tools.js', './js/screens/template-editor.js',
  './js/components/workouts-header.js', './js/components/exercise-browser.js', './js/components/line-chart.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// cache-first: קודם מהמטמון, ואם אין, מהרשת.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});

// תזכורות אימון (Web Push). ההצפנה והשליחה נעשות בשרת התזכורות; כאן רק מציגים את ההתראה.
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { /* טקסט לא תקין: מציגים ברירת מחדל */ }
  e.waitUntil(self.registration.showNotification(data.title || 'LIFTRACK', {
    body: data.body || '',
    tag: data.tag || 'liftrack',
    icon: './icons/icon-192.png',
    badge: './icons/favicon-32.png',
    data: { url: data.url || './#/home' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || './#/home';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((all) => {
    const open = all[0];
    if (open) { open.navigate(url).catch(() => {}); return open.focus(); }
    return self.clients.openWindow(url);
  }));
});
