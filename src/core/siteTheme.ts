// Follows the site's light/dark switch. The launchpad sets data-p-theme on <html>; if that ever
// changes we fall back to the page background's brightness, then to the OS preference.
export type Mode = "light" | "dark";

function readSiteTheme(): Mode {
  const attr = document.documentElement.dataset.pTheme;
  if (attr === "dark" || attr === "light") return attr;
  const rgb = getComputedStyle(document.body ?? document.documentElement).backgroundColor.match(/[\d.]+/g)?.map(Number);
  if (rgb && rgb.length >= 3 && (rgb.length < 4 || rgb[3] > 0)) {
    const [r, g, b] = rgb;
    return 0.299 * r + 0.587 * g + 0.114 * b < 128 ? "dark" : "light";
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function watchSiteTheme(cb: (m: Mode) => void): void {
  let last: Mode | undefined;
  const tick = () => {
    const m = readSiteTheme();
    if (m !== last) { last = m; cb(m); }
  };
  tick();
  new MutationObserver(tick).observe(document.documentElement, { attributes: true });
  if (document.body) new MutationObserver(tick).observe(document.body, { attributes: true });
}
