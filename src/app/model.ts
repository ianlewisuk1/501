import { fullTeamName, norm } from "../parser/names";
import type { MatchResult, Player, Standing, TeamWeek, WL } from "../parser/types";

export interface SeasonSchedule {
  season: string;
  division: string;
  weeks: ({ week: number; date: string; bye: true } | { week: number; date: string; home: boolean; opponent: string; venue: string })[];
  venues: Record<string, { maps: string }>;
  keyDates: { date: string; label: string }[];
}

export interface FixtureRow {
  week: number;
  date: string;
  bye: boolean;
  home: boolean;
  opponent: string;
  venue: string;
  result: MatchResult | null;
  status: "past" | "current" | "future";
}

/** "2026-09-23" -> "Wed Sep 23". Parsed at noon so no timezone shifts the day. */
export function shortDate(iso: string, weekday = true): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: weekday ? "short" : undefined, month: "short", day: "numeric" });
}

/** Today's date in the viewer's timezone as "YYYY-MM-DD". */
export function todayIso(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export const pct = ({ w, l }: WL): number | null => (w + l ? w / (w + l) : null);

export const fmtPct = (x: number | null, digits = 0): string => (x === null ? "–" : `${(x * 100).toFixed(digits)}%`);

export const fmtWL = ({ w, l }: WL): string => `${w}–${l}`;

export const sortWeeks = (weeks: TeamWeek[]): TeamWeek[] =>
  [...weeks].sort((a, b) => a.issueDate.localeCompare(b.issueDate));

/** The standings row for a team name, allowing short or abbreviated names. */
export function findStanding(name: string, standings: Standing[]): Standing | undefined {
  const full = fullTeamName(name, standings.map((s) => s.team));
  return standings.find((s) => norm(s.team) === norm(full));
}

/** Every week of the season: schedule, overridden by the newsletter's own fixtures, plus any results we have. */
export function buildFixtures(current: TeamWeek, history: TeamWeek[], schedule: SeasonSchedule | undefined): FixtureRow[] {
  const results = new Map<number, MatchResult>();
  for (const w of history) {
    if (w.season === current.season && w.lastResult && !("bye" in w.lastResult)) results.set(w.lastResult.week, w.lastResult);
  }
  const names = current.standings.map((s) => s.team);
  const rows = new Map<number, FixtureRow>();
  const status = (week: number): FixtureRow["status"] =>
    week < current.week ? "past" : week === current.week ? "current" : "future";

  for (const s of schedule?.season === current.season ? schedule.weeks : []) {
    rows.set(s.week, {
      week: s.week,
      date: s.date,
      bye: "bye" in s,
      home: "bye" in s ? false : s.home,
      opponent: "bye" in s ? "" : s.opponent,
      venue: "bye" in s ? "" : s.venue,
      result: null,
      status: status(s.week),
    });
  }
  // Page 5 wins for this week and next week (reschedules, venue changes).
  current.thisWeek && applyNewsletter(current.thisWeek, current.issueDate, 0);
  current.nextWeek && applyNewsletter(current.nextWeek, current.issueDate, 7);
  function applyNewsletter(f: NonNullable<TeamWeek["thisWeek"]>, issueDate: string, offsetDays: number) {
    const prev = rows.get(f.week);
    const date = prev?.date ?? addDays(issueDate, offsetDays);
    rows.set(f.week, "bye" in f
      ? { week: f.week, date, bye: true, home: false, opponent: "", venue: "", result: null, status: status(f.week) }
      : { week: f.week, date, bye: false, home: f.home, opponent: fullTeamName(f.opponent, names), venue: f.venue, result: null, status: status(f.week) });
  }
  for (const [week, r] of results) {
    const row = rows.get(week);
    if (row) row.result = r;
  }
  return [...rows.values()].sort((a, b) => a.week - b.week);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isIOS(nav?: { userAgent: string; platform?: string; maxTouchPoints?: number }): boolean {
  nav ??= typeof navigator === "undefined" ? { userAgent: "" } : navigator;
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1);
}

export function mapsUrl(venue: string, schedule: SeasonSchedule | undefined, ios: boolean): string {
  const query = schedule?.venues[venue]?.maps ?? `${venue}, Raleigh, NC`;
  const q = encodeURIComponent(query);
  return ios ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Sum of every player's stats, for the "Whole team" option. */
export function teamTotals(players: Player[]): Player {
  const sum = (k: keyof Player) => players.reduce((a, p) => a + ((p[k] as number) ?? 0), 0);
  const sumWL = (k: keyof Player): WL => ({
    w: players.reduce((a, p) => a + (p[k] as WL).w, 0),
    l: players.reduce((a, p) => a + (p[k] as WL).l, 0),
  });
  const asp = sum("allStarPoints");
  const games = sum("gamesPlayed");
  return {
    number: 0,
    name: "Whole team",
    singles: sumWL("singles"),
    doubles: sumWL("doubles"),
    total: sumWL("total"),
    singles301: sumWL("singles301"),
    singlesCricket: sumWL("singlesCricket"),
    doublesCricket: sumWL("doublesCricket"),
    doubles501: sumWL("doubles501"),
    tiebreaker: sumWL("tiebreaker"),
    allStarPoints: asp,
    gamesPlayed: games,
    aspAverage: games ? Number((asp / games).toFixed(4)) : null,
    matchesPlayed: Math.max(0, ...players.map((p) => p.matchesPlayed)),
  };
}

export const WHOLE_TEAM = "Whole team";

export function playerIn(week: TeamWeek, name: string): Player | undefined {
  return name === WHOLE_TEAM ? teamTotals(week.players) : week.players.find((p) => p.name === name);
}

export interface TrendPoint {
  /** Stats in this issue run through this week. */
  throughWeek: number;
  total: number | null;
  singles: number | null;
  doubles: number | null;
  aspAverage: number | null;
}

export interface WeekRecord {
  label: string;
  record: WL;
}

/** One point per issue in the season, and the W-L between consecutive issues. */
export function trend(history: TeamWeek[], season: string, name: string): { points: TrendPoint[]; weekly: WeekRecord[] } {
  const issues = sortWeeks(history.filter((w) => w.season === season));
  const points: TrendPoint[] = [];
  const weekly: WeekRecord[] = [];
  let prev: { week: number; p: Player } | null = null;
  for (const issue of issues) {
    const p = playerIn(issue, name);
    if (!p) continue;
    const throughWeek = issue.week - 1;
    points.push({ throughWeek, total: pct(p.total), singles: pct(p.singles), doubles: pct(p.doubles), aspAverage: p.aspAverage });
    if (prev) {
      const from = prev.week + 1;
      weekly.push({
        label: from === throughWeek ? `Wk ${throughWeek}` : `Wks ${from}–${throughWeek}`,
        record: { w: p.total.w - prev.p.total.w, l: p.total.l - prev.p.total.l },
      });
    }
    prev = { week: throughWeek, p };
  }
  return { points, weekly };
}
