import type { Value } from "./sheet";
import type { TeamConfig } from "./team";

/** Trim, collapse whitespace, lowercase. */
export const norm = (s: Value | undefined): string =>
  String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

export const isUs = (team: TeamConfig, s: Value): boolean =>
  team.aliases.some((a) => norm(a) === norm(s));

/** "Lewis, Ian" (optionally with a trailing "&") -> "Ian Lewis". */
export function firstLast(lastFirst: Value): string {
  const s = String(lastFirst).replace(/\s*&\s*$/, "").trim();
  const i = s.indexOf(",");
  if (i < 0) return s;
  return `${s.slice(i + 1).trim()} ${s.slice(0, i).trim()}`;
}

/** `"C" Division` header text for a division letter. */
export const divisionHeader = (division: string): string => `"${division.toLowerCase()}" division`;

/**
 * Turn a short name ("Pints") into the single standings name that contains it
 * as a whole word ("Pints and Points"). Keeps the raw text when there isn't
 * exactly one match.
 */
export function fullTeamName(short: string, fullNames: string[]): string {
  const target = norm(short);
  if (!target) return short;
  const exact = fullNames.find((n) => norm(n) === target);
  if (exact) return exact;
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|\\s)${escaped}(\\s|$)`);
  const hits = fullNames.filter((n) => re.test(norm(n)));
  return hits.length === 1 ? hits[0] : short;
}
