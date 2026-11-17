import { startRouter } from './router.js';
import { hasProfile } from './store.js';
import { renderNav } from './components/nav.js';
import { onboardingScreen } from './screens/onboarding.js';
import { homeScreen } from './screens/home.js';
import { workoutsScreen } from './screens/workouts.js';
import { libraryScreen } from './screens/library.js';
import { historyScreen } from './screens/history.js';
import { templateEditorScreen } from './screens/template-editor.js';
import { workoutScreen } from './screens/workout.js';
import { summaryScreen } from './screens/summary.js';
import { progressScreen } from './screens/progress.js';
import { muscleScreen } from './screens/muscle.js';
import { goalsScreen } from './screens/goals.js';
import { settingsScreen } from './screens/settings.js';
import { swapScreen } from './screens/swap.js';
import { exerciseEditorScreen } from './screens/exercise-editor.js';
import { editWorkoutScreen } from './screens/edit-workout.js';
import { startReminderSync } from './reminders.js';

// טבלת הנתיבים: כל מסך הוא פונקציה שמחזירה אלמנט.
// nav: true אומר שמציגים את הניווט התחתון.
const routes = {
  '/onboarding': { render: onboardingScreen },
  '/home': { render: homeScreen, nav: true },
  '/workouts': { render: workoutsScreen, nav: true },
  '/library': { render: libraryScreen, nav: true },
  '/history': { render: historyScreen, nav: true },
  '/template': { render: templateEditorScreen }, // מסך מלא, בלי ניווט תחתון
  '/workout': { render: workoutScreen }, // מסך מלא: האימון תופס את כל המסך
  '/summary': { render: summaryScreen },
  '/progress': { render: progressScreen, nav: true },
  '/muscle': { render: muscleScreen, nav: true },
  '/goals': { render: goalsScreen, nav: true },
  '/settings': { render: settingsScreen, nav: true },
  '/swap': { render: swapScreen },
  '/exercise': { render: exerciseEditorScreen },
  '/edit-workout': { render: editWorkoutScreen },
};

// שומר: בלי פרופיל מפנים לפתיחה, ועם פרופיל לא חוזרים אליה.
function guard(path) {
  if (!hasProfile()) return path === '/onboarding' ? null : '/onboarding';
  if (path === '/' || path === '/onboarding') return '/home';
  return null;
}

startRouter({ routes, root: document.getElementById('app'), guard, renderNav });

// בלי תפריט "חיפוש בגוגל" / העתקה בלחיצה ארוכה (חוץ משדות הקלט)
document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input, textarea')) e.preventDefault(); });

startReminderSync();

// Service Worker עובד רק ב-HTTPS או ב-localhost
if ('serviceWorker' in navigator) {
  // עדכונים: בכל פתיחה/חזרה לאפליקציה בודקים אם יש גרסה חדשה. כשגרסה חדשה נכנסת לתוקף
  // הדף נטען מחדש אוטומטית (לא באמצע אימון פעיל, שם מחכים עד שהמסך הבא נפתח).
  const hadController = Boolean(navigator.serviceWorker.controller); // בהתקנה ראשונה אין צורך ברענון
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    if (location.hash.startsWith('#/workout')) { addEventListener('hashchange', () => location.reload(), { once: true }); return; }
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
}
