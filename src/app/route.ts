/** Real URLs for a single-page app: /, /c (a division), /c/area-501 (a team). */
import { createElement, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { teamSlug } from "./model";

export type Route =
  | { page: "home" }
  | { page: "division"; division: string }
  | { page: "team"; division: string; team: string };

export const divisionPath = (division: string) => `/${division.toLowerCase()}`;
export const teamPath = (division: string, team: string) => `/${division.toLowerCase()}/${teamSlug(team)}`;

export function parseRoute(path: string, search = ""): Route {
  // Links shared before the league pages existed: /?team=menace-2-sobriety (C Division only).
  const legacy = new URLSearchParams(search).get("team");
  if (legacy) return { page: "team", division: "C", team: legacy };
  const parts = path.split("/").filter(Boolean);
  if (parts[0] && /^[a-z]$/i.test(parts[0])) {
    const division = parts[0].toUpperCase();
    return parts[1] ? { page: "team", division, team: parts[1].toLowerCase() } : { page: "division", division };
  }
  return { page: "home" };
}

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener("popstate", fn);
  return () => { listeners.delete(fn); window.removeEventListener("popstate", fn); };
};
const snapshot = () => location.pathname + location.search;

export function navigate(to: string, replace = false) {
  if (replace) history.replaceState(null, "", to);
  else history.pushState(null, "", to);
  for (const fn of listeners) fn();
  if (!replace) window.scrollTo(0, 0);
}

/** The current route. Server rendering (tests) passes its own. */
export function useRoute(): Route {
  const url = useSyncExternalStore(subscribe, snapshot, () => "/");
  const q = url.indexOf("?");
  return parseRoute(q < 0 ? url : url.slice(0, q), q < 0 ? "" : url.slice(q));
}

/** An ordinary link that changes page without a reload (modifier-clicks still open a new tab). */
export function Link({ to, ...props }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    props.onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return createElement("a", { ...props, href: to, onClick });
}
