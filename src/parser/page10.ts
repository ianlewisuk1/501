import { firstLast, isUs } from "./names";
import { round4, type Sheet } from "./sheet";
import type { TeamConfig } from "./team";
import type { Player } from "./types";

/** Our team code ("C6") and every player's season stats from Pg10{division}. */
export function page10(ws: Sheet, team: TeamConfig): { code: string; players: Player[] } {
  const teamRow = new RegExp(`^${team.division}\\d+/ `);
  let code = "";
  let inBlock = false;
  const players: Player[] = [];
  for (let r = 2; r <= ws.maxRow; r++) {
    const b = ws.get("B", r);
    if (typeof b === "string" && teamRow.test(b)) {
      if (inBlock) break;
      const [c, name] = [b.slice(0, b.indexOf("/")), b.slice(b.indexOf("/") + 1)];
      if (isUs(team, name)) {
        inBlock = true;
        code = c;
      }
      continue;
    }
    if (inBlock && b === team.division && ws.get("D", r)) {
      const n = (col: string) => ws.get(col, r) as number;
      const wl = (w: string, l: string) => ({ w: n(w), l: n(l) });
      players.push({
        number: n("C"),
        name: firstLast(ws.get("D", r)),
        singles: wl("I", "J"),
        doubles: wl("P", "Q"),
        total: wl("S", "T"),
        singles301: wl("E", "F"),
        singlesCricket: wl("G", "H"),
        doublesCricket: wl("L", "M"),
        doubles501: wl("N", "O"),
        tiebreaker: wl("V", "W"),
        allStarPoints: n("X"),
        gamesPlayed: n("Y"),
        aspAverage: round4(ws.get("Z", r)),
        matchesPlayed: n("AA"),
      });
    }
  }
  return { code, players };
}
