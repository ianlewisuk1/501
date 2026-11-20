/**
 * The page view counter, as the page sees it. Every page opened (each new address, including
 * moving between pages inside the site) counts once through /api/views, which returns the site's
 * all-time total and the last 7 days' views. Only the counts travel: no cookies, no ids, nothing
 * about the visitor. If the counter isn't reachable (the database not set up), there's simply no
 * count to show.
 */
import { useSyncExternalStore } from "react";

export type ViewCounts = { total: number; week: number | null };

let counts: ViewCounts | null = null;
let lastCounted = "";
const listeners = new Set<() => void>();

/** Count a view of this address (once, even if React runs the effect twice). */
export function countView(path: string) {
  if (path === lastCounted) return;
  lastCounted = path;
  fetch("/api/views", { method: "POST" })
    .then((r) => (r.ok ? r.json() : null))
    .then((body: { views?: number; week?: number } | null) => {
      if (typeof body?.views !== "number") return;
      counts = { total: body.views, week: typeof body.week === "number" ? body.week : null };
      for (const fn of listeners) fn();
    })
    .catch(() => {});
}

/** This week's and all-time page views, or null until (unless) the counter answers. */
export function useViewCount(): ViewCounts | null {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => counts,
    () => null,
  );
}
