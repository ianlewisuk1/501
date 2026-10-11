import { firstLast, isUs } from "./names";
import { round4, type Sheet } from "./sheet";
import type { TeamConfig } from "./team";
import type { DivisionTeam, Player } from "./types";

/** Every team in the division, with each player's season stats, from Pg10{division}. */
export function divisionTeams(ws: Sheet, division: string): DivisionTeam[] {
  const teamRow = new RegExp(`^${division}\\d+/ `);
  const teams: DivisionTeam[] = [];
  for (let r = 2; r <= ws.maxRow; r++) {
    const b = ws.get("B", r);
    if (typeof b === "string" && teamRow.test(b)) {
      const slash = b.indexOf("/");
      teams.push({ code: b.slice(0, slash), name: b.slice(slash + 1).trim(), players: [] });
      continue;
    }
    if (teams.length && b === division && ws.get("D", r)) {
      const n = (col: string) => ws.get(col, r) as number;
      const wl = (w: string, l: string) => ({ w: n(w), l: n(l) });
      teams.at(-1)!.players.push({
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
  return teams;
}

/** Our team code ("C6") and our players. */
export function page10(ws: Sheet, team: TeamConfig): { code: string; players: Player[] } {
  const ours = divisionTeams(ws, team.division).find((t) => isUs(team, t.name));
  return ours ? { code: ours.code, players: ours.players } : { code: "", players: [] };
}
