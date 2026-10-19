// Single source for colors, type, wordmark and host tag. A reskin is one edit here.
// Both palettes are read from the launchpad's own light and dark themes so the panel feels native.
type Palette = {
  bg: string; surface: string; raised: string; border: string; text: string; muted: string;
  accent: string; accentText: string; onAccent: string; warn: string; shadow: string;
  nameL: string; // lightness for per-address name colors, tuned for contrast on this background
};

const light: Palette = {
  bg: "#ffffff",
  surface: "#f5f5f7",
  raised: "#eceee9",
  border: "rgba(12, 21, 0, 0.14)",
  text: "#0c1500",
  muted: "rgba(12, 21, 0, 0.62)",
  accent: "#00c805", // fills, dots, buttons
  accentText: "#008a06", // accent used as text on white (the fill green is too light to read)
  onAccent: "#0c1500", // text on an accent fill, as on the site's Buy button
  warn: "#e04600",
  shadow: "0 2px 4px rgba(12, 21, 0, 0.08), 0 12px 32px rgba(12, 21, 0, 0.11)",
  nameL: "36%",
};

const dark: Palette = {
  bg: "#1c1c1c",
  surface: "#252525",
  raised: "#2e2e2e",
  border: "rgba(253, 254, 249, 0.12)",
  text: "#fdfef9",
  muted: "rgba(253, 254, 249, 0.62)",
  accent: "#00c805",
  accentText: "#00c805",
  onAccent: "#0c1500",
  warn: "#ff5000",
  shadow: "0 2px 4px rgba(0, 0, 0, 0.34), 0 12px 32px rgba(0, 0, 0, 0.32)",
  nameL: "68%",
};

export const theme = {
  wordmark: "family",
  hostTag: "on pons",
  footer: "community built, not affiliated with pons",
  font: `ui-rounded, "SF Pro Rounded", Nunito, system-ui, -apple-system, "Segoe UI", sans-serif`,
  radius: "24px",
  palettes: { light, dark },
} as const;

/** CSS custom properties for one palette. */
export const cssVars = (p: Palette) =>
  `--bg:${p.bg};--surface:${p.surface};--raised:${p.raised};--border:${p.border};--text:${p.text};--muted:${p.muted};` +
  `--accent:${p.accent};--accent-text:${p.accentText};--on-accent:${p.onAccent};--warn:${p.warn};--shadow:${p.shadow};--name-l:${p.nameL};`;
