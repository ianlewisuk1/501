/** Pure helpers that turn a season of league issues into what each page shows. */
import { teamWeekOf } from "../parser/league";
import { norm } from "../parser/names";
import { TEAM } from "../parser/team";
import type { DivisionWeek, LeagueDivision, LeagueWeek, Match, Pick, Round, TeamWeek } from "../parser/types";
import { addDays, teamSchedule, teamSlug, type SeasonSchedule } from "./model";
import type { SeasonData } from "./store";

const TERM_NAMES: Record<string, string> = { Wi: "Winter", Sp: "Spring", Su: "Summer", Fa: "Fall" };

/** "Fa26" -> "Fall 2026". */
export const seasonLabel = (season: string): string =>
  `${TERM_NAMES[season.slice(0, 2)] ?? season.slice(0, 2)} 20${season.slice(2)}`;

/**
 * Page 1's RDL Headlines for a division, one story each: the newsletter runs them together with
 * semicolons. Each starts with a capital.
 */
export const headlineStories = (text: string): string[] =>
  text.split(/;\s+/).map((t) => t.trim()).filter(Boolean).map((t) => t[0].toUpperCase() + t.slice(1));

/** A hot dart with its division, for league-wide lists. */
export type LeagueHotDart = { players: string[]; team: string; feat: string; division: string };

// Fewest darts a fast game could take, so fast games of different kinds compare fairly.
const GAME_BASE: Record<string, number> = { "301": 9, "501": 15, "1001": 25, SCkt: 8, DCkt: 8 };

/**
 * How rare a hot dart is, lower first: 9-marks, Ton-80s, 6-bulls, fast games (fewest darts for
 * the game), big ins and outs, 5-bulls, then all-star points (most first), then anything else.
 */
export function hotDartRank(feat: string): [number, number] {
  let m: RegExpMatchArray | null;
  if ((m = feat.match(/^(\d+)m$/))) return [0, -Number(m[1])];
  if ((m = feat.match(/^T(\d+)$/))) return [1, -Number(m[1])];
  if ((m = feat.match(/^(\d+)-Bulls$/)) && Number(m[1]) >= 6) return [2, -Number(m[1])];
  if ((m = feat.match(/^(\d+)-dart (\w+)/))) return [3, Number(m[1]) / (GAME_BASE[m[2]] ?? 20)];
  if ((m = feat.match(/^(\d+)-(In|Out)$/))) return [4, -Number(m[1])];
  if ((m = feat.match(/^(\d+)-Bulls$/))) return [5, -Number(m[1])];
  if ((m = feat.match(/^([\d.]+) ASPs$/))) return [6, -Number(m[1])];
  return [7, 0];
}

/** Hot darts, rarest first; ties keep the newsletter's order. */
export const rankHotDarts = <T extends { feat: string }>(list: T[]): T[] =>
  list.map((h, i) => ({ h, i, r: hotDartRank(h.feat) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || a.i - b.i)
    .map((x) => x.h);

/** The newsletter's shorthand for a feat, written out: "9m" is "9-marks", "T80" is "Ton-80". */
export const featLabel = (feat: string): string =>
  feat.replace(/^(\d+)m$/, "$1-marks").replace(/^T(\d+)$/, "Ton-$1")
    .replace(/ SCkt\b/, " singles cricket").replace(/ DCkt\b/, " doubles cricket");

/** Who won a page 2 match: the higher score, or the 1001 at 12-12. Null when it isn't known. */
export function matchWinner(m: Match): "away" | "home" | null {
  const a = m.away.score, h = m.home.score;
  if (a == null || h == null) return null;
  if (a !== h) return a > h ? "away" : "home";
  return m.away.tiebreaker1001 === "W" ? "away" : m.home.tiebreaker1001 === "W" ? "home" : null;
}

export const divisionIn = (issue: LeagueWeek | undefined, division: string): LeagueDivision | undefined =>
  issue?.divisions.find((d) => d.division === division.toUpperCase());

/** A team's standings name from its URL slug, in the newest issue. */
export function teamBySlug(issue: LeagueWeek | undefined, division: string, slug: string): string | undefined {
  return divisionIn(issue, division)?.standings.find((s) => teamSlug(s.team) === slug)?.team;
}

/** One team's view of every issue this season, oldest first. */
export const teamHistory = (data: SeasonData, team: string): TeamWeek[] =>
  data.issues.map((l) => teamWeekOf(l, team)).filter((w): w is TeamWeek => w !== null);

/** Every team's view of every issue in a division (for working out other teams' schedules). */
export function divisionHistory(data: SeasonData, division: string): TeamWeek[] {
  return data.issues.flatMap((l) =>
    (divisionIn(l, division)?.standings ?? []).map((s) => teamWeekOf(l, s.team)).filter((w): w is TeamWeek => w !== null));
}

/** Page 10 for one division, one entry per issue (for scouting and the leaderboard). */
export function divisionWeeks(data: SeasonData, division: string): DivisionWeek[] {
  return data.issues.flatMap((l) => {
    const d = divisionIn(l, division);
    return d ? [{ season: l.season, week: l.week, division: d.division, teams: d.teams }] : [];
  });
}

/** Ours is hand-entered; every other team's is worked out from the newsletters. */
export function scheduleFor(data: SeasonData, team: string, division: string): SeasonSchedule | undefined {
  if (!data.schedule) return undefined;
  if (norm(team) === norm(TEAM.name)) return data.schedule;
  return teamSchedule(team, divisionHistory(data, division), data.schedule);
}

/** One week of a division's season: final scores once played, otherwise the matchups. */
export type DivisionRound = (
  | { week: number; date: string; played: true; matches: Match[]; byes: string[] }
  | { week: number; date: string; played: false; matches: Round["matches"]; byes: string[] }
) & {
  /** The newsletter editor's picks for the week, from the issue dated that night. */
  picks: Pick[];
  /** A played week's write-up from page 1's RDL Headlines, in the issue that brought its results. */
  headline?: string | null;
};

/**
 * Every week of a division's season that any issue covers, in order. A played week comes from
 * page 2 of the issue after it; a week still to come from page 5 of the newest issue that lists
 * it (so a reschedule wins). Dates come from the hand-entered schedule when it has the week.
 */
export function divisionRounds(data: SeasonData, division: string): DivisionRound[] {
  const rounds = new Map<number, DivisionRound>();
  // Issue N's page 5 picks week N's matches.
  const picksFor = new Map<number, Pick[]>();
  for (const issue of data.issues) {
    const d = divisionIn(issue, division);
    if (d?.thisWeek && d.picks?.length) picksFor.set(d.thisWeek.week, d.picks);
  }
  const scheduled = (week: number) =>
    data.schedule?.season === data.season ? data.schedule.weeks.find((w) => w.week === week)?.date : undefined;
  for (const issue of data.issues) {
    const d = divisionIn(issue, division);
    if (!d) continue;
    for (const [round, date] of [[d.thisWeek, issue.issueDate], [d.nextWeek, addDays(issue.issueDate, 7)]] as const) {
      if (round && !rounds.get(round.week)?.played)
        rounds.set(round.week, { week: round.week, date: scheduled(round.week) ?? date, played: false, matches: round.matches, byes: round.byes, picks: picksFor.get(round.week) ?? [] });
    }
    if (d.results)
      rounds.set(d.results.week, { week: d.results.week, date: d.results.date, played: true, matches: d.results.matches, byes: d.results.byes, picks: picksFor.get(d.results.week) ?? [], headline: d.headline });
  }
  return [...rounds.values()].sort((a, b) => a.week - b.week);
}
