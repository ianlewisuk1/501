import * as XLSX from "xlsx";
import { leaderboard } from "./leaderboards";
import { headline, issueInfo } from "./page1";
import { page2 } from "./page2";
import { hotDarts, trophies } from "./page3";
import { fixtures, prediction } from "./page5";
import { page10 } from "./page10";
import { Sheet } from "./sheet";
import type { TeamConfig } from "./team";
import type { AspRow, TeamWeek, WinPctRow } from "./types";
import { loadWorkbook } from "./workbook";

export type { TeamWeek } from "./types";

/** Parse one newsletter workbook into our team's week. */
export function parseWorkbook(wb: XLSX.WorkBook, team: TeamConfig): TeamWeek {
  const m = wb.SheetNames[0]?.match(/^(\w+?)-Wk(\d+)-Pg/);
  if (!m) throw new Error(`Unrecognised sheet name: ${wb.SheetNames[0]}`);
  const season = m[1];
  const week = Number(m[2]);
  const page = (pg: string) => {
    const ws = wb.Sheets[`${season}-Wk${week}-${pg}`];
    if (!ws) throw new Error(`Missing sheet ${season}-Wk${week}-${pg}`);
    return new Sheet(ws);
  };

  const pg1 = page("Pg1");
  const pg3 = page("Pg3");
  const pg5 = page("Pg5");
  const { standings, lastResult } = page2(page("Pg2"), team);
  const { thisWeek, nextWeek } = fixtures(pg5, team);
  const { code, players } = page10(page(`Pg10${team.division}`), team);
  const { trophyDarts, perfectThrows } = trophies(pg3, team);

  return {
    season,
    week,
    ...issueInfo(pg1),
    team: { name: team.name, division: team.division, code },
    standings,
    lastResult,
    thisWeek,
    nextWeek,
    prediction: prediction(pg5, team),
    headline: headline(pg1, team),
    players,
    leaderboards: {
      singles: leaderboard(page("Pg6"), team, ["w", "l", "pct"] as const) as WinPctRow[],
      singlesPlusDoubles: leaderboard(page("Pg7"), team, ["w", "l", "pct"] as const) as WinPctRow[],
      allStarAverage: leaderboard(page("Pg8"), team, ["asp", "gamesPlayed", "average"] as const) as AspRow[],
    },
    hotDarts: hotDarts(pg3, team),
    trophyDarts,
    perfectThrows,
  };
}

export function parse(path: string, team: TeamConfig): TeamWeek {
  return parseWorkbook(loadWorkbook(path), team);
}
