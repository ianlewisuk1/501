/**
 * Which team is "yours", kept only in this browser's local storage: nothing is sent anywhere,
 * and there are no accounts. Two separate things are remembered:
 *
 * - the team someone picked with "This is my team" on its page (changes only when they say so),
 * - the team page they last looked at (changes on every team page, for a quieter "Last looked at").
 *
 * Storage can be blocked (private windows, strict settings): then nothing is remembered.
 */
import { useSyncExternalStore } from "react";

export type TeamRef = { division: string; team: string };

const PICKED = "rdl.pickedTeam";
const LAST = "rdl.lastTeam";
/** Before 2026-11-05 the last team page opened was saved here and shown as "Your team". */
const OLD = "rdl.myTeam";

const read = (key: string): TeamRef | null => {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    return v && typeof v.division === "string" && typeof v.team === "string" ? { division: v.division, team: v.team } : null;
  } catch {
    return null;
  }
};

const write = (key: string, v: TeamRef | null) => {
  try {
    if (v) localStorage.setItem(key, JSON.stringify(v));
    else localStorage.removeItem(key);
  } catch { /* storage blocked */ }
};

// The old value was only ever "last opened", so it carries over as that, never as a pick.
try {
  if (typeof localStorage !== "undefined" && localStorage.getItem(OLD) !== null) {
    if (!read(LAST)) write(LAST, read(OLD));
    localStorage.removeItem(OLD);
  }
} catch { /* storage blocked */ }

// Snapshots are cached so useSyncExternalStore sees a stable value until something changes.
let snapshot: { picked: TeamRef | null; last: TeamRef | null } | null = null;
const listeners = new Set<() => void>();
const changed = () => { snapshot = null; for (const fn of listeners) fn(); };

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  // Another tab picking a team updates this one too.
  const onStorage = (e: StorageEvent) => { if (e.key === PICKED || e.key === LAST) changed(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(fn); window.removeEventListener("storage", onStorage); };
};
const getSnapshot = () => (snapshot ??= { picked: read(PICKED), last: read(LAST) });
const SERVER = { picked: null, last: null };

/** The picked team and the last team looked at, kept up to date as either changes. */
export function useMyTeams(): { picked: TeamRef | null; last: TeamRef | null } {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER);
}

export const sameTeam = (a: TeamRef | null | undefined, b: TeamRef | null | undefined) =>
  !!a && !!b && a.division === b.division && a.team === b.team;

/** "This is my team" (or null to undo it). */
export function pickTeam(v: TeamRef | null) {
  write(PICKED, v);
  changed();
}

/** Called whenever a team page opens. */
export function sawTeam(v: TeamRef) {
  if (sameTeam(read(LAST), v)) return;
  write(LAST, v);
  changed();
}
