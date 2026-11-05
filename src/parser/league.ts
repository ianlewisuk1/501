/**
 * One newsletter, every division: standings, results, fixtures, player stats, records and hot darts.
 * Each fact is stored once; a single team's view is derived from it (see `teamWeekOf`).
 */
import type * as XLSX from "xlsx";
import { headline, issueInfo } from "./page1";
import { page2Division } from "./page2";
import { leaguePicks, leagueRounds } from "./page5";
import { divisionTeams } from "./page10";
import { divisionLetters, issueOf } from "./issue";
import { norm } from "./names";
import { resolveTeam } from "./resolve";
import { divisionRecords, leagueHotDarts, perfectThrows, type DivisionNames } from "./records";
import { Sheet } from "./sheet";
import type { Fixture, LastResult, LeagueDivision, LeagueWeek, Round, TeamWeek } from "./types";

export function parseLeague(wb: XLSX.WorkBook): LeagueWeek {
  const { season, week } = issueOf(wb);
  const page = (pg: string): Sheet | null => {
    const ws = wb.Sheets[`${season}-Wk${week}-${pg}`];
    return ws ? new Sheet(ws) : null;
  };
  const need = (pg: string): Sheet => {
    const ws = page(pg);
    if (!ws) throw new Error(`Missing sheet ${season}-Wk${week}-${pg}`);
    return ws;
  };
  const pg1 = need("Pg1");
  const pg2 = need("Pg2");
  const pg3 = need("Pg3");
  const pg5 = need("Pg5");
  const info = issueInfo(pg1);
  const year = info.issueDate.slice(2, 4);

  const base = divisionLetters(pg2).map((division) => {
    const { standings, results } = page2Division(pg2, division);
    // The week 1 issue carries an empty results block for week 1 itself.
    const pg10 = page(`Pg10${division}`);
    // Page 10's capitalisation can drift from the standings' ("Wing & a Plaque"); the standings win.
    const teamNames = standings.map((s) => s.team);
    const teams = (pg10 ? divisionTeams(pg10, division) : []).map((t) => ({ ...t, name: resolveTeam(t.name, teamNames) ?? t.name }));
    return {
      division,
      standings,
      results: results && results.week < week ? results : null,
      teams,
    };
  });
  const names: DivisionNames[] = base.map((d) => ({
    division: d.division,
    teams: d.standings.map((s) => s.team),
    players: d.teams.flatMap((t) => t.players.map((p) => p.name)),
  }));
  const rounds = leagueRounds(pg5, names.map((n) => ({ division: n.division, names: n.teams })), year);
  const records = divisionRecords(pg3, names, year);
  const picks = leaguePicks(pg5, names.map((n) => ({ division: n.division, names: n.teams, matches: rounds.get(n.division)?.thisWeek?.matches ?? [] })));
  const hot = leagueHotDarts(pg3, names);

  const divisions: LeagueDivision[] = base.map((d) => ({
    division: d.division,
    headline: headline(pg1, d),
    standings: d.standings,
    results: d.results,
    thisWeek: rounds.get(d.division)?.thisWeek ?? null,
    nextWeek: rounds.get(d.division)?.nextWeek ?? null,
    teams: d.teams,
    records: records.get(d.division) ?? [],
    hotDarts: hot.get(d.division) ?? [],
    picks: picks.get(d.division) ?? [],
  }));
  return { season, week, ...info, divisions, perfectThrows: perfectThrows(pg3, names, year) };
}

const same = (a: string, b: string) => norm(a) === norm(b);

function fixtureOf(round: Round | null, team: string): Fixture {
  if (!round) return null;
  if (round.byes.some((b) => same(b, team))) return { week: round.week, bye: true };
  for (const m of round.matches) {
    const home = same(m.home, team);
    if (home || same(m.away, team)) return { week: round.week, home, opponent: home ? m.away : m.home, venue: m.venue };
  }
  return null;
}

function resultOf(d: LeagueDivision, team: string): LastResult {
  const r = d.results;
  if (!r) return null;
  if (r.byes.some((b) => same(b, team))) return { week: r.week, date: r.date, bye: true };
  for (const m of r.matches) {
    const home = same(m.home.team, team);
    if (!home && !same(m.away.team, team)) continue;
    const [us, them] = home ? [m.home, m.away] : [m.away, m.home];
    // A missing scoresheet has no result to show yet.
    if (us.score === null || them.score === null) return null;
    return {
      week: r.week,
      date: r.date,
      opponentShort: them.short,
      home,
      score: { us: us.score, them: them.score },
      gamesWon: us.gamesWon ?? { singles301: 0, singlesCricket: 0, doublesCricket: 0, doubles501: 0 },
      tiebreaker1001: us.tiebreaker1001,
      allStarPoints: us.allStarPoints,
      shortHanded: us.shortHanded,
      penalties: us.penalties,
    };
  }
  return null;
}

/** The division a team plays in, by its standings name. */
export const divisionOf = (league: LeagueWeek, team: string): LeagueDivision | undefined =>
  league.divisions.find((d) => d.standings.some((s) => same(s.team, team)));

/**
 * One team's view of a league issue, in the shape the page already uses.
 * The editor's prediction and the page 6-8 leaderboards aren't carried league-wide.
 */
export function teamWeekOf(league: LeagueWeek, team: string): TeamWeek | null {
  const d = divisionOf(league, team);
  if (!d) return null;
  const name = d.standings.find((s) => same(s.team, team))!.team;
  const block = d.teams.find((t) => same(t.name, name));
  return {
    season: league.season,
    week: league.week,
    issueDate: league.issueDate,
    issue: league.issue,
    team: { name, division: d.division, code: block?.code ?? "" },
    standings: d.standings,
    lastResult: resultOf(d, name),
    thisWeek: fixtureOf(d.thisWeek, name),
    nextWeek: fixtureOf(d.nextWeek, name),
    prediction: null,
    headline: d.headline,
    players: block?.players ?? [],
    leaderboards: { singles: [], singlesPlusDoubles: [], allStarAverage: [] },
    hotDarts: d.hotDarts.filter((h) => same(h.team, name)).map(({ players, feat }) => ({ players, feat })),
    trophyDarts: d.records.flatMap((r) =>
      r.holders.filter((h) => same(h.team, name)).map((h) => ({ category: r.category, value: r.value, date: h.date, players: h.players }))),
    perfectThrows: [],
  };
}
