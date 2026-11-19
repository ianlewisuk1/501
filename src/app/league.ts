/** Pure helpers that turn a season of league issues into what each page shows. */
import { teamWeekOf } from "../parser/league";
import { norm } from "../parser/names";
import { TEAM } from "../parser/team";
import type { Bracket, DivisionWeek, LeagueDivision, LeagueWeek, Match, Pick, Round, Standing, TeamWeek } from "../parser/types";
import { addDays, shortDate, teamSchedule, teamSlug, type SeasonSchedule } from "./model";
import type { SeasonData } from "./store";

const TERM_NAMES: Record<string, string> = { Wi: "Winter", Sp: "Spring", Su: "Summer", Fa: "Fall" };

/** "Fa26" -> "Fall 2026". */
export const seasonLabel = (season: string): string =>
  `${TERM_NAMES[season.slice(0, 2)] ?? season.slice(0, 2)} 20${season.slice(2)}`;

/**
 * "week 13 of 14", or "tournaments" for the issue that comes out after the regular season
 * (the tournament issue is numbered week 15 of a 14-week season).
 */
export const weekLabel = (week: number, seasonWeeks?: number | null): string =>
  seasonWeeks && week > seasonWeeks ? "tournaments" : `week ${week}${seasonWeeks ? ` of ${seasonWeeks}` : ""}`;

/** True once an issue's results cover the regular season's last week. */
export const isFinal = (resultsWeek: number | null | undefined, seasonWeeks?: number | null): boolean =>
  !!resultsWeek && !!seasonWeeks && resultsWeek >= seasonWeeks;

/** Which results a table is from, as a short label: "Through week 12 of 14" (like the Players tab's "Through week 12"). */
export const resultsLabel = (results: { week: number }, seasonWeeks?: number | null): string =>
  `Through week ${results.week}${seasonWeeks ? ` of ${seasonWeeks}` : ""}`;

/**
 * The league's current match night, the same for every division, for the pill under a division's
 * title: the next regular night still to come ("Week 13 of 14"), else the next tournament round from
 * the bracket ("Quarterfinals, Nov 18"), else the next tournament night in `keyDates`; "tonight" on
 * the night itself. Null once the season is over.
 */
export function currentWeek(data: SeasonData, issue: LeagueWeek, today: string): string | null {
  const schedule = data.schedule?.season === issue.season ? data.schedule : undefined;
  const night = schedule?.weeks.find((w) => w.date >= today);
  if (night) return `Week ${night.week} of ${schedule!.weeks.length}${night.date === today ? ", tonight" : ""}`;
  const dates = issue.divisions.find((d) => d.bracket)?.bracket?.dates;
  const rounds: [string, string | null | undefined][] = [["Quarterfinals", dates?.quarterfinals], ["Semifinals", dates?.semifinals], ["Final", dates?.final]];
  const round = rounds.find(([, d]) => d && d >= today);
  const next = round ? { name: round[0], date: round[1]! } : (() => {
    const t = schedule?.keyDates.find((k) => k.date >= today && /tournament/i.test(k.label));
    return t ? { name: "Tournament", date: t.date } : null;
  })();
  if (!next) return null;
  return next.date === today ? `${next.name} tonight` : `${next.name}, ${shortDate(next.date, false)}`;
}

/**
 * Page 1's RDL Headlines for a division, one story each: the newsletter runs them together with
 * semicolons. Each starts with a capital.
 */
export const headlineStories = (text: string): string[] =>
  text.split(/;\s+/).map((t) => t.trim()).filter(Boolean).map((t) => t[0].toUpperCase() + t.slice(1));

/**
 * Nicknames the editor uses that aren't in a team's name, by the standings name. Kept by hand; a
 * new one shows up as plain text until it's added here.
 */
const NICKNAMES: Record<string, string[]> = {
  "Cheap Shots": ["Cheapies"],
  "Nine Lives": ["Niners"],
  "SofaKings": ["Sofa"],
  "Down to F, Again": ["DTF"],
  "Shark Shooters": ["Sharks"],
  "Banging the Wire": ["Bangin"],
  "Runs with Corks": ["Cork"],
  "Consistently Inconsistent": ["Inconsist"],
};

// Words that join a name together ("for", "the") or are too ordinary to mean a team on their own
// ("Point", "Darts", "Mark", which could be a player's first name). They still count inside a
// longer run of the name: "Two Time", "What's the Point", "Down to F".
const JOINING = new Set(["the", "a", "an", "of", "and", "for", "to", "in", "on", "at", "with", "who", "say", "&"]);
const ORDINARY = new Set([
  "point", "dart", "darts", "throw", "down", "time", "side", "out", "so", "why", "we", "it", "two", "double", "off",
  "under", "little", "said", "she", "what's", "mark", "up", "again", "done", "dirt", "cheap", "eye", "red", "ing", "are", "you", "ni",
]);

export type Mention = string | { text: string; team: string };

/**
 * The editor's prose split into plain text and the teams he names, for linking. He writes teams
 * short ("Menace", "the Kids", "Rippin's"), so any run of words from a team's standings name counts,
 * as long as it starts with a capital, isn't only joining or ordinary words, and fits just one team
 * in the division. Longest runs win ("Death Throw" over "Death"). The words stay his: only the
 * link knows the full name. A leading "the" and a trailing "'s" are left outside the link.
 */
export function teamMentions(text: string, teams: string[]): Mention[] {
  const owners = new Map<string, Set<string>>();
  const add = (phrase: string, team: string) => {
    if (!owners.has(phrase)) owners.set(phrase, new Set());
    owners.get(phrase)!.add(team);
  };
  for (const team of teams) {
    const words = team.match(/[A-Za-z0-9][A-Za-z0-9']*|&/g) ?? [];
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j <= words.length; j++) {
        const run = words.slice(i, j);
        if (!/^[A-Z0-9]/.test(run[0]) || JOINING.has(run[0].toLowerCase()) || JOINING.has(run.at(-1)!.toLowerCase())) continue;
        const plain = run.every((w) => JOINING.has(w.toLowerCase()) || ORDINARY.has(w.toLowerCase()));
        // A number alone is a game ("sweeps 501"), never "Area 501".
        if (run.length === 1 ? plain || run[0].length < 3 || /^\d+$/.test(run[0]) : run.every((w) => JOINING.has(w.toLowerCase()))) continue;
        add(run.join(" ").toLowerCase(), team);
      }
    }
    for (const nick of NICKNAMES[team] ?? []) add(nick.toLowerCase(), team);
  }
  const phrases = [...owners].filter(([, t]) => t.size === 1).map(([p]) => p).sort((a, b) => b.length - a.length);
  if (!phrases.length) return [text];
  // Words in the prose may be joined by spaces, hyphens or a comma ("Off Constantly-Reboot", "Down to F, Again").
  // Case is ignored after the first letter ("Down To F"), but a name has to start with a capital.
  const pattern = phrases.map((p) => p.split(" ").map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s,\\-/]+")).join("|");
  const re = new RegExp(`(?<![A-Za-z0-9'])(?:${pattern})(?![A-Za-z0-9])`, "gi");
  const out: Mention[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const key = m[0].split(/[\s,\-/]+/).join(" ").toLowerCase();
    const team = [...owners.get(key) ?? []][0];
    if (!team || !/^[A-Z0-9]/.test(m[0])) continue;
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push({ text: m[0], team });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

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
      rounds.set(d.results.week, { week: d.results.week, date: d.results.date, played: true, matches: d.results.matches, byes: d.results.byes, picks: picksFor.get(d.results.week) ?? [] });
  }
  return [...rounds.values()].sort((a, b) => a.week - b.week);
}

/**
 * Hand-entered tournament facts (data/{season}/bracket.json), for when the league sends a bracket
 * outside the newsletter: final seeds (index 0 = seed 1, null for the bye) and, as rounds are
 * played, the winners in bracket order. They win over what the newsletter printed.
 */
export interface BracketFile {
  season: string;
  divisions: Record<string, {
    seeds?: (string | null)[];
    quarterfinals?: (string | null)[];
    semifinals?: (string | null)[];
    final?: string | null;
  }>;
}

export function withBracketFile(b: Bracket, file: BracketFile | undefined, division: string): Bracket {
  const o = file?.divisions[division];
  if (!o) return b;
  const pick = (given: string | null | undefined, parsed: string | null) => given ?? parsed;
  return {
    ...b,
    slots: b.slots.map((s) => ({ seed: s.seed, team: s.seed !== null && o.seeds ? o.seeds[s.seed - 1] ?? null : s.team })),
    quarterfinals: b.quarterfinals.map((m, i) => ({ ...m, winner: pick(o.quarterfinals?.[i], m.winner) })),
    semifinals: b.semifinals.map((m, i) => ({ ...m, winner: pick(o.semifinals?.[i], m.winner) })),
    final: { ...b.final, winner: pick(o.final, b.final.winner) },
  };
}

/** One team line in a bracket match: who, their seed, and whether the newsletter has placed them yet. */
export interface BracketEntry {
  seed: number | null;
  /** Placed by the newsletter, or (with `projected`) where the latest standings put that seed. */
  team: string | null;
  projected: boolean;
  /** "Winner of 1 v 8" for a later round's line not decided yet; "Bye" for the bye. */
  placeholder: string | null;
}
export interface BracketGame { entries: [BracketEntry, BracketEntry]; venue: string | null; winner: string | null; date: string | null }
export interface BracketView { rounds: { name: string; date: string | null; games: BracketGame[] }[]; champion: string | null }

/**
 * A division's bracket laid out round by round. First-round lines the newsletter hasn't filled yet
 * take the team in that place in the standings, marked projected, unless that team is already
 * placed somewhere else in the bracket. Later rounds carry the winners written in so far.
 */
export function bracketView(b: Bracket, standings: Standing[]): BracketView {
  // A bye's partner goes straight through, whether the newsletter has written it in or not.
  b = { ...b, quarterfinals: b.quarterfinals.map((m, i) => {
    const [x, y] = [b.slots[2 * i], b.slots[2 * i + 1]];
    const through = x.seed === null ? y.team : y.seed === null ? x.team : null;
    return m.winner || !through ? m : { ...m, winner: through };
  }) };
  const placed = new Set(b.slots.map((s) => s.team).filter(Boolean));
  const first: BracketEntry[] = b.slots.map((s) => {
    if (s.seed === null) return { seed: null, team: null, projected: false, placeholder: "Bye" };
    if (s.team) return { seed: s.seed, team: s.team, projected: false, placeholder: null };
    const guess = standings.find((x) => x.rank === s.seed && !placed.has(x.team))?.team ?? null;
    return { seed: s.seed, team: guess, projected: guess !== null, placeholder: guess ? null : `Seed ${s.seed}` };
  });
  const seedOf = (team: string) => first.find((e) => e.team === team)?.seed ?? null;
  // The seeds that could still turn up on a line: the line's own seed once known, else everyone in the half below it.
  const could = (e: BracketEntry, from: number[]): number[] => (e.team && !e.projected ? [e.seed!].filter((x) => x !== null) : from);
  const orList = (seeds: number[]) => seeds.length > 1 ? `${seeds.slice(0, -1).join(", ")} or ${seeds.at(-1)}` : String(seeds[0] ?? "");
  const next = (games: BracketGame[], pools: number[][]): { entries: BracketEntry[]; pools: number[][] } => {
    const entries: BracketEntry[] = [];
    const out: number[][] = [];
    games.forEach((g, i) => {
      const pool = [...could(g.entries[0], pools[2 * i]), ...could(g.entries[1], pools[2 * i + 1])];
      out.push(g.winner ? [seedOf(g.winner)].filter((x): x is number => x !== null) : pool);
      entries.push(g.winner
        ? { seed: seedOf(g.winner), team: g.winner, projected: false, placeholder: null }
        : { seed: null, team: null, projected: false, placeholder: `Seed ${orList(pool)}` });
    });
    return { entries, pools: out };
  };
  const pairUp = (entries: BracketEntry[], matches: { venue: string | null; winner: string | null }[], date: string | null): BracketGame[] =>
    matches.map((m, i) => ({ entries: [entries[2 * i], entries[2 * i + 1]], venue: m.venue, winner: m.winner, date }));
  const qf = pairUp(first, b.quarterfinals, b.dates.quarterfinals);
  const r2 = next(qf, first.map((e) => (e.seed === null ? [] : [e.seed])));
  const sf = pairUp(r2.entries, b.semifinals, b.dates.semifinals);
  const fin = pairUp(next(sf, r2.pools).entries, [b.final], b.dates.final);
  return {
    rounds: [
      { name: "Quarterfinals", date: b.dates.quarterfinals, games: qf },
      { name: "Semifinals", date: b.dates.semifinals, games: sf },
      { name: "Final", date: b.dates.final, games: fin },
    ],
    champion: b.final.winner,
  };
}

export interface TournamentMatch {
  /** "Quarterfinal", "Semifinal" or "Final". */
  round: string;
  date: string;
  seed: number | null;
  /** The other team once it's known, else null and `opponentText` says who it could be ("Seed 3 or 6"). */
  opponent: string | null;
  opponentSeed: number | null;
  opponentText: string | null;
  /** The bar, without the newsletter's "*" (a third board may be free). */
  venue: string | null;
}

/**
 * A team's next tournament match, from the newest issue's bracket and the hand-entered winners:
 * the first round on or after today. Null when there's no bracket, the team was knocked out, or
 * it waits on a result not entered yet. A bye carries straight on to the next round.
 */
export function tournamentMatch(data: SeasonData, division: string, team: string, today: string): TournamentMatch | null {
  const issue = data.issues.at(-1);
  const d = issue?.divisions.find((x) => x.division === division);
  if (!d?.bracket) return null;
  const view = bracketView(withBracketFile(d.bracket, data.bracket, division), d.standings);
  const mine = (e: BracketEntry) => !e.projected && e.team !== null && sameName(e.team, team);
  for (const r of view.rounds) {
    const g = r.games.find((x) => x.entries.some(mine));
    if (!g) return null; // not through to this round (or not decided yet)
    if (g.winner) {
      if (!sameName(g.winner, team)) return null; // knocked out
      continue; // won it, or a bye
    }
    if (!r.date || r.date < today) return null; // played, result not entered yet
    const [me, them] = mine(g.entries[0]) ? g.entries : [g.entries[1], g.entries[0]];
    const known = them.team !== null && !them.projected;
    return {
      round: r.name.replace(/s$/, ""),
      date: r.date,
      seed: me.seed,
      opponent: known ? them.team : null,
      opponentSeed: known ? them.seed : null,
      opponentText: known ? null : them.placeholder,
      venue: g.venue?.replace(/\*$/, "").trim() || null,
    };
  }
  return null;
}

const sameName = (a: string, b: string) => norm(a) === norm(b);
