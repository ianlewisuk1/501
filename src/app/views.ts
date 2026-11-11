/**
 * The page view counter, as the page sees it. Every page opened (each new address, including
 * moving between pages inside the site) counts once through /api/views, which returns the site's
 * running total. Only the count travels: no cookies, no ids, nothing about the visitor. If the
 * counter isn't reachable (local dev, or the database not set up), there's simply no count to show.
 */
import { useSyncExternalStore } from "react";

let total: number | null = null;
let lastCounted = "";
const listeners = new Set<() => void>();

/** Count a view of this address (once, even if React runs the effect twice). */
export function countView(path: string) {
  if (path === lastCounted) return;
  lastCounted = path;
  fetch("/api/views", { method: "POST" })
    .then((r) => (r.ok ? r.json() : null))
    .then((body: { views?: number } | null) => {
      if (typeof body?.views !== "number") return;
      total = body.views;
      for (const fn of listeners) fn();
    })
    .catch(() => {});
}

/** The site's running total of page views, or null until (unless) the counter answers. */
export function useViewCount(): number | null {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => total,
    () => null,
  );
}
