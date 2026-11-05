/**
 * Light (whiteboard) or dark (chalkboard). index.html sets <html data-theme> before the first paint:
 * the visitor's own choice if they've made one on this device, otherwise dark (the chalkboard is
 * the site's look; decided 2026-11-05). The toggle on the lander changes it and remembers it.
 */
import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
const KEY = "rdl.theme";

const listeners = new Set<() => void>();
const changed = () => { for (const fn of listeners) fn(); syncStatusBar(); };

export const currentTheme = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

/** Picks a theme for this device from now on. */
export function setTheme(t: Theme) {
  try { localStorage.setItem(KEY, t); } catch { /* storage blocked: it still applies for this visit */ }
  document.documentElement.dataset.theme = t;
  changed();
}

export const useThemeSetting = (): Theme =>
  useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, currentTheme, () => "dark");

/** The phone's status bar takes the colour of the page behind it (black, slate or whiteboard). */
export function syncStatusBar() {
  if (typeof document === "undefined") return;
  requestAnimationFrame(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const bg = getComputedStyle(document.body).backgroundColor;
    if (meta && bg && bg !== "rgba(0, 0, 0, 0)") meta.content = bg;
  });
}
