export type WL = { w: number; l: number };

export type Fixture =
  | null
  | { week: number; bye: true }
  | { week: number; home: boolean; opponent: string; venue: string };

export interface Standing {
  rank: number;
  team: string;
  wins: number;
  losses: number;
  points: number;
  /** Page 2's column B marker, only once set: G = division champion, C = clinched top two, D = clinched bottom two. */
  clinched?: "G" | "C" | "D";
}

export interface MatchResult {
  week: number;
  date: string;
  opponentShort: string;
  home: boolean;
  score: { us: number; them: number };
  gamesWon: { singles301: number; singlesCricket: number; doublesCricket: number; doubles501: number };
  tiebreaker1001: "W" | "L" | null;
  allStarPoints: number;
  shortHanded: string | null;
  penalties: string | null;
}

export type LastResult = null | { week: number; date: string; bye: true } | MatchResult;

export interface Player {
  number: number;
  name: string;
  singles: WL;
  doubles: WL;
  total: WL;
  singles301: WL;
  singlesCricket: WL;
  doublesCricket: WL;
  doubles501: WL;
  tiebreaker: WL;
  allStarPoints: number;
  gamesPlayed: number;
  aspAverage: number | null;
  matchesPlayed: number;
}

export interface WinPctRow {
  rank: number;
  player: string;
  w: number;
  l: number;
  pct: number;
}

export interface AspRow {
  rank: number;
  player: string;
  asp: number;
  gamesPlayed: number;
  average: number;
}

export interface HotDart {
  players: string[];
  feat: string;
}

export interface TrophyDart {
  category: string;
  value: string;
  date: string | null;
  players: string[];
}

export interface TeamWeek {
  season: string;
  week: number;
  issueDate: string;
  issue: string;
  team: { name: string; division: string; code: string };
  standings: Standing[];
  lastResult: LastResult;
  thisWeek: Fixture;
  nextWeek: Fixture;
  prediction: null | { featured: boolean; text: string };
  headline: string | null;
  players: Player[];
  leaderboards: {
    singles: WinPctRow[];
    singlesPlusDoubles: WinPctRow[];
    allStarAverage: AspRow[];
  };
  hotDarts: HotDart[];
  trophyDarts: TrophyDart[];
  perfectThrows: string[];
}

/** One team's block on Pg10{division}. */
export interface DivisionTeam {
  code: string; // "C7"
  name: string; // "Menace 2 Sobriety"
  players: Player[];
}

/** Every team's player stats for one issue, written beside week-NN.json for scouting. */
export interface DivisionWeek {
  season: string;
  week: number;
  division: string;
  teams: DivisionTeam[];
}

// ---- League-wide issue (every division), one file per newsletter ----

/** One team's line in a page 2 result. */
export interface MatchSide {
  team: string; // full standings name, or page 2's text when it can't be resolved
  short: string; // page 2's short name ("Pints")
  score: number | null; // null when the scoresheet hadn't arrived
  gamesWon: MatchResult["gamesWon"] | null; // null for a forfeit or a missing scoresheet
  tiebreaker1001: "W" | "L" | null;
  allStarPoints: number;
  shortHanded: string | null;
  penalties: string | null;
}

export interface Match {
  away: MatchSide;
  home: MatchSide;
  /** Page 2's note in place of game counts: "match forfeited", "scoresheet not received by press time". */
  note?: string;
}

export interface Matchup {
  away: string;
  home: string;
  venue: string;
  /** A make-up match on another day ("Still Hump'N @ Darty Little Secrets (Aug. 30th, Brass Tap 5&6)"). */
  date?: string;
}

/** One week's matches for a division, as page 5 lists them. */
export interface Round {
  week: number;
  matches: Matchup[];
  byes: string[];
}

/** One holder of a divisional trophy dart record. Ties list several. */
export interface RecordHolder {
  players: string[];
  team: string;
  date: string | null;
}

export interface TrophyRecord {
  category: string; // "Fast Singles 301"
  value: string; // "9 darts"
  holders: RecordHolder[];
}

export interface DivisionHotDart {
  players: string[]; // a whole-team feat lists the newsletter's short names ("Mike J.")
  team: string;
  feat: string; // "15-dart 301", "6.5 ASPs"
}

export interface PerfectThrow {
  kind: string; // "9-Marks", "Ton-80s", "6-Bulls"
  player: string;
  team: string;
  division: string | null;
  dates: string[];
}

/** The newsletter editor's pick for one of this week's matches (page 5, "Predictions for the week"). */
export interface Pick {
  away: string;
  home: string;
  /** A featured match, written up in prose; otherwise a line in the "remaining matches" list. */
  featured: boolean;
  /** The whole write-up, or the score line ("Mulligans Mafia 15, Still Hump'N 9"). */
  text: string;
  /** The sentence that makes the call ("Have to go Element, 13-11."), or the score line; null when one write-up covers several matches. */
  call: string | null;
  /** How many matches the write-up covers (1 unless the editor took a few together). */
  together: number;
}

export interface LeagueDivision {
  division: string;
  headline: string | null;
  standings: Standing[];
  /** Page 2's results; null in the week 1 issue. */
  results: { week: number; date: string; matches: Match[]; byes: string[] } | null;
  thisWeek: Round | null;
  nextWeek: Round | null;
  teams: DivisionTeam[];
  records: TrophyRecord[];
  hotDarts: DivisionHotDart[];
  /** The editor's picks for this issue's matches (thisWeek). Missing in data parsed before 2026-11-05. */
  picks?: Pick[];
}

export interface LeagueWeek {
  season: string;
  week: number;
  issueDate: string;
  issue: string;
  divisions: LeagueDivision[];
  perfectThrows: PerfectThrow[];
}
