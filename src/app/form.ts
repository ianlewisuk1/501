/**
 * The Form tab's numbers: a player's season-so-far win % in one game type, week by week, and
 * what it says about their form lately. Each player plays about one game of each type a week, so
 * a single week's win % is just 0% or 100%; the running season figure is the honest line, and
 * whether it's climbing or falling is the form.
 *
 * Issue N carries season totals through week N-1, so each issue gives one point on the line.
 */
import type { DivisionWeek, Player, WL } from "../parser/types";
import { pct } from "./model";

export type GameKey = "total" | "singles301" | "singlesCricket" | "doubles501" | "doublesCricket";

/** The game buttons, in the order they show. */
export const GAMES: { key: GameKey; label: string; short: string }[] = [
  { key: "total", label: "All games", short: "All" },
  { key: "singles301", label: "Singles 301", short: "301" },
  { key: "singlesCricket", label: "Singles cricket", short: "Cricket" },
  { key: "doubles501", label: "Doubles 501", short: "501" },
  { key: "doublesCricket", label: "Doubles cricket", short: "Cricket" },
];

export interface LinePoint {
  /** Stats run through this week. */
  week: number;
  /** Season-so-far record, or null when the issue is missing or the player wasn't listed. */
  wl: WL | null;
  pct: number | null;
}

const add = (a: WL, b: WL): WL => ({ w: a.w + b.w, l: a.l + b.l });

/** The season's issues, oldest first, each placed at the week its stats run through. */
function issues(divisions: DivisionWeek[], season: string): { week: number; div: DivisionWeek }[] {
  return divisions
    .filter((d) => d.season === season && d.week > 1)
    .sort((a, b) => a.week - b.week)
    .map((div) => ({ week: div.week - 1, div }));
}

/** One line: whatever `pick` finds in each issue (a player, or a whole team added up). */
function line(divisions: DivisionWeek[], season: string, pick: (d: DivisionWeek) => WL | null): LinePoint[] {
  return issues(divisions, season).map(({ week, div }) => {
    const wl = pick(div);
    return { week, wl, pct: wl && wl.w + wl.l > 0 ? pct(wl) : null };
  });
}

/** A player, found by their number (unique within a division, steady across issues). */
export const playerLine = (divisions: DivisionWeek[], season: string, number: number, key: GameKey) =>
  line(divisions, season, (d) => {
    for (const t of d.teams) {
      const p = t.players.find((x) => x.number === number);
      if (p) return p[key];
    }
    return null;
  });

/** A whole team: every player's games in that type added up. */
export const teamLine = (divisions: DivisionWeek[], season: string, code: string, key: GameKey) =>
  line(divisions, season, (d) => {
    const t = d.teams.find((x) => x.code === code);
    return t ? t.players.reduce<WL>((a, p) => add(a, p[key]), { w: 0, l: 0 }) : null;
  });

/**
 * The division's best in a game type, from the newest issue: the highest win % among players
 * with at least half as many games of that type as the busiest player (so a 2–0 sub can't lead).
 */
export function divisionBest(divisions: DivisionWeek[], season: string, key: GameKey): (Player & { team: string }) | null {
  const latest = issues(divisions, season).at(-1)?.div;
  if (!latest) return null;
  const all = latest.teams.flatMap((t) => t.players.map((p) => ({ ...p, team: t.name })));
  const games = (p: Player) => p[key].w + p[key].l;
  const most = Math.max(0, ...all.map(games));
  const regulars = all.filter((p) => games(p) > 0 && games(p) >= most / 2);
  regulars.sort((a, b) => (pct(b[key]) ?? 0) - (pct(a[key]) ?? 0) || games(b) - games(a));
  return regulars[0] ?? null;
}

export type Verdict =
  | { kind: "hot" | "cold" | "steady"; recent: WL; season: WL; now: number; then: number | null }
  | { kind: "few"; recent: WL | null; season: WL | null; now: number | null };

/** How many weeks count as "lately". */
export const RECENT = 3;

/**
 * Form in plain words: the last few weeks' record against everything before it. Hot or cold
 * only when the gap is clear (15 points or more) and there are at least 3 recent games.
 */
export function verdict(points: LinePoint[]): Verdict {
  const known = points.filter((p) => p.wl);
  const last = known.at(-1);
  if (!last?.wl) return { kind: "few", recent: null, season: null, now: null };
  const before = known.filter((p) => p.week <= last.week - RECENT).at(-1);
  const base = before?.wl ?? { w: 0, l: 0 };
  const recent = { w: last.wl.w - base.w, l: last.wl.l - base.l };
  const now = pct(last.wl) ?? 0;
  if (recent.w + recent.l < 3 || !before) return { kind: "few", recent, season: last.wl, now };
  const earlier = pct(base);
  const lately = pct(recent) ?? 0;
  const kind = earlier === null ? "steady" : lately >= earlier + 0.15 ? "hot" : lately <= earlier - 0.15 ? "cold" : "steady";
  return { kind, recent, season: last.wl, now, then: before.pct };
}
