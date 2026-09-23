import { divisionHeader, isUs, norm } from "./names";
import { dash, isBlank, isoDate, str, type Sheet } from "./sheet";
import type { TeamConfig } from "./team";
import type { LastResult, MatchResult, Standing } from "./types";

/** Division standings and our result from last week. */
export function page2(ws: Sheet, team: TeamConfig): { standings: Standing[]; lastResult: LastResult } {
  const title = str(ws.get("A", 1));
  const m = title.match(/WEEK (\d+) \((\d+)\/(\d+)\/(\d+)\)/);
  const top = ws.findRow("A", (v) => norm(v) === divisionHeader(team.division));
  if (!m || top === null) return { standings: [], lastResult: null };
  const week = Number(m[1]);
  const date = isoDate(m[2], m[3], m[4]);

  const standings: Standing[] = [];
  const blockRows: number[] = [];
  for (let r = top; r <= ws.maxRow && !isBlank(ws.get("C", r)); r++) {
    standings.push({
      rank: ws.get("C", r) as number,
      team: str(ws.get("D", r)).trim(),
      wins: ws.get("F", r) as number,
      losses: ws.get("G", r) as number,
      points: ws.get("H", r) as number,
    });
    blockRows.push(r);
  }

  // Results share the block's rows but not its order. Consecutive non-BYE rows
  // pair into one match, with the home team listed second.
  const rows = blockRows.filter((r) => norm(ws.get("M", r)) !== "(bye)");
  let lastResult: LastResult = null;
  for (let i = 0; i + 1 < rows.length; i += 2) {
    const [a, b] = [rows[i], rows[i + 1]];
    for (const [us, them, home] of [[a, b, false], [b, a, true]] as const) {
      if (!isUs(team, ws.get("K", us))) continue;
      const result: MatchResult = {
        week,
        date,
        opponentShort: str(ws.get("K", them)).trim(),
        home,
        score: { us: ws.get("L", us) as number, them: ws.get("L", them) as number },
        gamesWon: {
          singles301: ws.get("M", us) as number,
          singlesCricket: ws.get("N", us) as number,
          doublesCricket: ws.get("O", us) as number,
          doubles501: ws.get("P", us) as number,
        },
        tiebreaker1001: dash(ws.get("Q", us)) as MatchResult["tiebreaker1001"],
        allStarPoints: ws.get("R", us) as number,
        shortHanded: dash(ws.get("S", us)) as string | null,
        penalties: dash(ws.get("T", us)) as string | null,
      };
      lastResult = result;
    }
  }
  if (lastResult === null && blockRows.some((r) => isUs(team, ws.get("K", r)))) {
    lastResult = { week, date, bye: true };
  }
  return { standings, lastResult };
}
