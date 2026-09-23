import { firstLast, isUs, norm } from "./names";
import { isBlank, isoDate, str, type Sheet } from "./sheet";
import type { TeamConfig } from "./team";
import type { HotDart, TrophyDart } from "./types";

const TROPHY_HEADER = "divisional trophy dart categories";

/** Hot Darts: three column groups of name, team, value, unit. Doubles span two rows. */
export function hotDarts(ws: Sheet, team: TeamConfig): HotDart[] {
  const stop = ws.findRow("A", (v) => norm(v) === TROPHY_HEADER) ?? ws.maxRow;
  const out: HotDart[] = [];
  const groups = [["A", "B", "C", "D"], ["G", "H", "I", "J"], ["M", "N", "O", "P"]];
  for (const [nameC, teamC, valC, unitC] of groups) {
    let pending: string[] = [];
    for (let r = 2; r < stop; r++) {
      const name = ws.get(nameC, r);
      const who = ws.get(teamC, r);
      if (typeof name !== "string" || name.startsWith('"') || name.startsWith("(")) {
        pending = [];
        continue;
      }
      pending.push(firstLast(name));
      if (who === null) continue; // doubles pair continues on the next row
      if (isUs(team, who)) {
        const value = ws.get(valC, r);
        const unit = str(ws.get(unitC, r));
        const feat = isBlank(value) ? unit : `${value} ${unit}`;
        out.push({ players: pending, feat: feat.trim() });
      }
      pending = [];
    }
  }
  return out;
}

/** Trophy darts for our division's column, and perfect throws naming our team. */
export function trophies(ws: Sheet, team: TeamConfig): { trophyDarts: TrophyDart[]; perfectThrows: string[] } {
  const top = ws.findRow("A", (v) => norm(v) === TROPHY_HEADER);
  if (top === null) return { trophyDarts: [], perfectThrows: [] };
  const hdr = top + 1;
  const col = ws.entries(hdr).find(([, v]) => norm(v) === `${team.division.toLowerCase()} division`)?.[0];
  const perfect = ws.findRow("A", (v) => norm(v) === "perfect throws", top) ?? ws.maxRow + 1;

  const trophyDarts: TrophyDart[] = [];
  if (col) {
    const starts: number[] = [];
    for (let r = hdr + 1; r < perfect; r++) {
      if (["high in", "high out", "fast"].includes(norm(ws.get("A", r)))) starts.push(r);
    }
    starts.forEach((s, i) => {
      const e = starts[i + 1] ?? perfect;
      const label: string[] = [];
      const cells: string[] = [];
      for (let r = s; r < e; r++) {
        const a = ws.get("A", r);
        if (a) label.push(String(a).trim());
        const c = ws.get(col, r);
        if (!isBlank(c)) cells.push(String(c).trim());
      }
      if (!cells.length || cells[0].startsWith("(none")) return;
      if (!cells.some((c) => isUs(team, c))) return;
      const m = cells[0].match(/^(.*?)\s*\((\d+)\/(\d+)\/(\d+)\)/);
      const players = cells
        .slice(1)
        .filter((c) => !isUs(team, c))
        .map((c) => c.replace(/\s*&$/, "").trim())
        .flatMap((c) => c.split(" & "));
      trophyDarts.push({
        category: label.join(" ").replace(/\s*\(.*$/, ""), // drop '(301 first turn only!!)' style notes
        value: m ? m[1] : cells[0],
        date: m ? isoDate(m[2], m[3], m[4]) : null,
        players,
      });
    });
  }

  // Perfect throws: 'Name (Team, m/d)' anywhere below the header.
  const perfectThrows: string[] = [];
  const needle = team.name.toLowerCase();
  for (let r = perfect; r <= ws.maxRow; r++) {
    for (const v of ws.row(r)) {
      if (typeof v === "string" && v.toLowerCase().includes(needle)) perfectThrows.push(v.trim());
    }
  }
  return { trophyDarts, perfectThrows };
}
