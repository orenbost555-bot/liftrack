// ראוטר מבוסס hash: הכתובת נראית כמו index.html#/home.
// למה hash? כי הוא עובד בכל שרת סטטי בלי הגדרות, וגם כשהאפליקציה מותקנת במסך הבית.

export const navigate = (path) => {
  location.hash = path;
};

/**
 * routes: { '/home': { render(params): HTMLElement, nav?: true } }  (params = URLSearchParams של ה-?query)
 * guard(path): מחזיר נתיב אחר להפניה, או null אם הכול בסדר.
 * renderNav(path): בונה את הניווט התחתון (נקרא רק למסכים עם nav: true).
 */
export function startRouter({ routes, root, guard, renderNav }) {
  function render() {
    // כתובת כמו #/template?id=abc: מפרידים בין הנתיב לפרמטרים
    const [path, query = ''] = (location.hash.replace(/^#/, '') || '/').split('?');
    const params = new URLSearchParams(query);
    const redirect = guard(path);
    if (redirect && redirect !== path) {
      navigate(redirect); // משנה את ה-hash ולכן יפעיל שוב את render
      return;
    }
    const route = routes[path] ?? routes['/home'];
    const screen = route.render(params);
    root.replaceChildren(...(route.nav ? [screen, renderNav(path)] : [screen]));
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', render);
  render();
}
