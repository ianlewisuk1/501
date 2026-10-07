import { fullTeamName, norm } from "../parser/names";
import type { MatchResult, Player, Standing, TeamWeek, WL } from "../parser/types";

export interface SeasonSchedule {
  season: string;
  division: string;
  weeks: ({ week: number; date: string; bye: true }
    | { week: number; date: string; home: boolean; opponent: string; venue: string; score?: Score })[];
  venues: Record<string, { maps: string }>;
  keyDates: { date: string; label: string }[];
}

export type Score = { us: number; them: number };

export interface FixtureRow {
  week: number;
  date: string;
  bye: boolean;
  home: boolean;
  opponent: string;
  venue: string;
  /** Final score: from a parsed newsletter, or entered by hand in schedule.json for weeks we have no issue for. */
  score: Score | null;
  /** Full result detail, only when parsed from a newsletter. */
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
      score: "bye" in s ? null : s.score ?? null,
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
      ? { week: f.week, date, bye: true, home: false, opponent: "", venue: "", score: null, result: null, status: status(f.week) }
      : { week: f.week, date, bye: false, home: f.home, opponent: fullTeamName(f.opponent, names), venue: f.venue, score: prev?.score ?? null, result: null, status: status(f.week) });
  }
  for (const [week, r] of results) {
    const row = rows.get(week);
    if (row) {
      row.result = r;
      row.score = r.score;
    }
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

export function mapsUrls(venue: string, schedule: SeasonSchedule | undefined): { apple: string; google: string } {
  const q = encodeURIComponent(schedule?.venues[venue]?.maps ?? `${venue}, Raleigh, NC`);
  return { apple: `https://maps.apple.com/?q=${q}`, google: `https://www.google.com/maps/search/?api=1&query=${q}` };
}

/** One link per platform, for compact places like the fixtures list. */
export function mapsUrl(venue: string, schedule: SeasonSchedule | undefined, ios: boolean): string {
  const urls = mapsUrls(venue, schedule);
  return ios ? urls.apple : urls.google;
}

export interface EditorPick {
  /** Full team name of the predicted winner, or null when the prose doesn't say clearly. */
  winner: string | null;
  /** Winner's score first, e.g. "14–10". */
  score: string;
  /** The write-up without its "Match #N: (C Div.)" lead, for featured picks. */
  detail: string | null;
}

/**
 * Boils the editor's prediction down to "who wins, by what". Featured write-ups end with the
 * call ("Area it is, 14-10."); the winner is whichever team the closing clause names.
 */
export function editorPick(
  p: { featured: boolean; text: string },
  us: { name: string; aliases: string[] },
  opponent: string,
): EditorPick | null {
  if (!p.featured) {
    const m = p.text.match(/^(.+?)\s+(\d+),\s*(.+?)\s+(\d+)$/);
    if (!m) return null;
    const [a, b] = [{ team: m[1], n: +m[2] }, { team: m[3], n: +m[4] }].sort((x, y) => y.n - x.n);
    return { winner: a.n === b.n ? null : a.team, score: `${a.n}–${b.n}`, detail: null };
  }
  const detail = p.text.replace(/^Match(?:es)? #[^:]+:\s*\([A-H] Div\.\)\s*/, "");
  const m = detail.match(/(\d+)\s*-\s*(\d+)\.?\s*$/);
  if (!m) return null;
  const last = detail.split(/(?<=[.!?])\s+/).at(-1) ?? "";
  const clause = norm(last.split(/,?\s+but\s+/i).at(-1) ?? "");
  const word = (s: string) => new RegExp(`(^|\\W)${norm(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`).test(clause);
  const ours = us.aliases.some(word);
  const theirs = opponent.split(/\s+/).filter((w) => w.length > 3).some(word);
  const winner = ours === theirs ? null : ours ? us.name : opponent;
  return { winner, score: `${m[1]}–${m[2]}`, detail };
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

export interface WeekGames {
  week: number;
  /** Games won and lost that week; both null when no newsletter isolates the week (a gap, not zero). */
  won: number | null;
  lost: number | null;
  /** Whole-team view: who we played. */
  opponent?: string;
}

/**
 * Games won and lost in each week played so far. The whole team comes from match scores (every
 * week with a result). A player's week is the difference between consecutive issues' season
 * totals, so it only exists when issues for that week and the one before are both in data/.
 */
export function weeklyGames(current: TeamWeek, history: TeamWeek[], fixtures: FixtureRow[], name: string): WeekGames[] {
  const weeks = Array.from({ length: Math.max(0, current.week - 1) }, (_, i) => i + 1);
  if (name === WHOLE_TEAM) {
    const byWeek = new Map(fixtures.map((f) => [f.week, f]));
    return weeks.map((week) => {
      const f = byWeek.get(week);
      return f?.score
        ? { week, won: f.score.us, lost: f.score.them, opponent: f.opponent }
        : { week, won: null, lost: null, opponent: f?.opponent };
    });
  }
  // Season totals keyed by the week they run through. Before week 1, everyone is 0–0.
  const totals = new Map<number, WL>([[0, { w: 0, l: 0 }]]);
  for (const issue of history) {
    const p = issue.season === current.season ? playerIn(issue, name) : undefined;
    if (p) totals.set(issue.week - 1, p.total);
  }
  return weeks.map((week) => {
    const [a, b] = [totals.get(week - 1), totals.get(week)];
    return a && b ? { week, won: b.w - a.w, lost: b.l - a.l } : { week, won: null, lost: null };
  });
}

export interface FormPoint extends WeekGames {
  /** Win % that night. */
  night: number | null;
  /** Win % for the season so far. */
  season: number | null;
}

/** Each week's own win %, and the season's so far. */
export function form(weeks: WeekGames[]): FormPoint[] {
  const sum = (ws: WeekGames[]): WL => ws.reduce((a, w) => ({ w: a.w + (w.won ?? 0), l: a.l + (w.lost ?? 0) }), { w: 0, l: 0 });
  return weeks.map((w, i) => {
    if (w.won === null) return { ...w, night: null, season: null };
    return { ...w, night: pct({ w: w.won, l: w.lost! }), season: pct(sum(weeks.slice(0, i + 1))) };
  });
}
