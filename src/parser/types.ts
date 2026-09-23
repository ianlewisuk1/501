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
