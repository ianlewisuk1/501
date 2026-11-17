import { divisionHeader, firstLast, isUs, norm } from "./names";
import { isBlank, num, round4, str, type Sheet } from "./sheet";
import type { TeamConfig } from "./team";

/**
 * Our players' rows from a leaderboard (pages 6 to 8 most weeks; they move late in the season,
 * and a sheet can hold two). `start` is the row of the board's heading. Two divisions sit side by side;
 * a blank rank means tied with the row above.
 */
export function leaderboard<K extends readonly [string, string, string]>(
  ws: Sheet,
  team: TeamConfig,
  keys: K,
  start = 1,
): ({ rank: number; player: string } & Record<K[number], number>)[] {
  const sides = [
    { name: "C", team: "D", a: "E", b: "F", c: "G", rank: "A" },
    { name: "L", team: "M", a: "N", b: "O", c: "P", rank: "J" },
  ];
  for (const s of sides) {
    const top = ws.findRow(s.name, (v) => norm(v) === divisionHeader(team.division), start);
    if (top === null) continue;
    const rows = [];
    let rank = 0;
    for (let r = top + 1; !isBlank(ws.get(s.name, r)); r++) {
      const rk = ws.get(s.rank, r);
      if (!isBlank(rk)) rank = rk as number;
      const who = str(ws.get(s.team, r));
      const slash = who.indexOf("/");
      if (slash >= 0 && isUs(team, who.slice(slash + 1))) {
        rows.push({
          rank,
          player: firstLast(ws.get(s.name, r)),
          [keys[0]]: num(ws.get(s.a, r)),
          [keys[1]]: num(ws.get(s.b, r)),
          [keys[2]]: round4(ws.get(s.c, r)),
        } as { rank: number; player: string } & Record<K[number], number>);
      }
    }
    return rows;
  }
  return [];
}

/**
 * Where a leaderboard is printed: the sheet and row whose column C heading matches, e.g.
 * "Fall 2026 RDL Top Singles Records (by division)". Null when the issue doesn't print it.
 */
export function findLeaderboard(sheets: Sheet[], title: RegExp): { ws: Sheet; start: number } | null {
  for (const ws of sheets) {
    const start = ws.findRow("C", (v) => title.test(str(v)));
    if (start !== null) return { ws, start };
  }
  return null;
}
