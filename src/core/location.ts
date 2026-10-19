// ponsfamily is a single-page app: moving between pages never reloads, so a script that reads the URL once at
// load goes stale. Call back whenever the URL changes, however the page changed it.
export function watchLocation(cb: () => void): void {
  let last = location.href;
  const check = () => {
    if (location.href === last) return;
    last = location.href;
    cb();
  };
  // Navigation API: fires for same-document navigations (history.pushState) made by the page's own scripts.
  const nav = (window as any).navigation;
  nav?.addEventListener("navigatesuccess", check);
  nav?.addEventListener("currententrychange", check);
  window.addEventListener("popstate", check);
  window.addEventListener("hashchange", check);
  // Safety net: a string compare twice a second costs nothing, and covers any path the events miss.
  setInterval(check, 500);
}
