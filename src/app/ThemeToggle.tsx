import { setTheme, useThemeSetting } from "./theme";

/**
 * Light or dark: the whiteboard or the chalkboard. It shows what tapping does (a sun on the
 * chalkboard, a moon on the whiteboard), and the choice is remembered on this device. On the
 * lander it also says it in words ("Light", "Dark"); in the site bar of every other page it's the
 * icon alone, at the bar's right end (owner, 2026-11-19).
 */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useThemeSetting();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className={`theme-toggle${compact ? " compact" : ""}`} onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      {next === "light" ? (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        </svg>
      )}
      {!compact && <span>{next === "light" ? "Light" : "Dark"}</span>}
    </button>
  );
}
