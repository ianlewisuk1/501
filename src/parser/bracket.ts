/**
 * The divisional tournament brackets, printed in the last two issues of a regular season under
 * "FALL 2026 RDL DIVISIONAL TOURNAMENT SCHEDULE" (page 6 in week 13, page 7 in week 14).
 *
 * Two divisions sit side by side, each block headed `"C" Division`. Within a block the columns are
 * fixed: seed, team, quarterfinal venue, semifinal, final, winner (A to F on the left, K to P on
 * the right). Rows alternate between the eight first-round slots (a seed number, with the team
 * once it's locked in, or "(Bye)" in the team column) and venue lines. What a cell means depends
 * on where it sits: a venue in the quarterfinal column between a pair's two slots is that match's
 * bar; in the semifinal column, a cell inside a pair is that pair's winner and a cell between two
 * pairs is the semifinal's bar; the final column works the same way one level up.
 */
import * as XLSX from "xlsx";
import { resolveTeam } from "./resolve";
import { Sheet, str } from "./sheet";
import type { Bracket, BracketMatch } from "./types";

const HEAD = /DIVISIONAL TOURNAMENT SCHEDULE/i;
const DIV = /^"([A-H])" Division$/;

/** The sheet that prints the brackets, if this issue has one. */
export function bracketSheet(wb: XLSX.WorkBook): Sheet | null {
  for (const name of wb.SheetNames) {
    const s = new Sheet(wb.Sheets[name]);
    for (let r = 1; r <= Math.min(s.maxRow, 12); r++) if (HEAD.test(str(s.get("A", r)))) return s;
  }
  return null;
}

const col = (base: number, offset: number) => XLSX.utils.encode_col(base + offset);

/** "Quarterfinals (11/18)" -> "2026-11-18". */
function roundDate(text: string, year: string): string | null {
  const m = text.match(/\((\d{1,2})\/(\d{1,2})\)/);
  return m ? `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
}

/** Every division's bracket in the sheet, keyed by letter. */
export function parseBrackets(ws: Sheet, teamsOf: (division: string) => readonly string[], year: string): Map<string, Bracket> {
  const out = new Map<string, Bracket>();
  const headRow = ws.findRow("A", (v) => /^Quarterfinals/i.test(str(v)));
  // Each block: its letter, its first column (0 = A, 10 = K) and its header row.
  const blocks: { division: string; base: number; row: number }[] = [];
  for (let r = 1; r <= ws.maxRow; r++) {
    for (const base of [0, 10]) {
      const m = str(ws.get(col(base, 3), r)).trim().match(DIV);
      if (m) blocks.push({ division: m[1], base, row: r });
    }
  }
  for (const b of blocks) {
    const end = blocks.filter((o) => o.base === b.base && o.row > b.row).map((o) => o.row).sort((x, y) => x - y)[0] ?? ws.maxRow + 1;
    const teams = teamsOf(b.division);
    const at = (offset: number, r: number) => str(ws.get(col(b.base, offset), r)).trim();
    const team = (text: string) => (text ? resolveTeam(text, teams) : null);

    const slots: { row: number; seed: number | null; team: string | null }[] = [];
    for (let r = b.row + 1; r < end; r++) {
      const seed = ws.get(col(b.base, 0), r);
      const name = at(1, r);
      if (typeof seed === "number") slots.push({ row: r, seed, team: /^\(bye\)$/i.test(name) ? null : team(name) });
      else if (/^\(bye\)$/i.test(name)) slots.push({ row: r, seed: null, team: null });
    }
    if (slots.length !== 8) continue;

    const qf: BracketMatch[] = Array.from({ length: 4 }, () => ({ venue: null, winner: null }));
    const sf: BracketMatch[] = Array.from({ length: 2 }, () => ({ venue: null, winner: null }));
    const final: BracketMatch = { venue: null, winner: null };
    let champion: string | null = null;
    // Which group of `size` slots a row falls inside (strictly between its first and last slot), or between.
    const inside = (r: number, size: number) => {
      for (let g = 0; g < 8 / size; g++) if (r > slots[g * size].row && r < slots[g * size + size - 1].row) return g;
      return -1;
    };
    const between = (r: number, size: number) => {
      for (let g = 0; g + 1 < 8 / size; g++) if (r > slots[g * size + size - 1].row && r < slots[(g + 1) * size].row) return g;
      return -1;
    };
    const lo = slots[0].row - 1, hi = slots[7].row + 1;
    for (let r = lo; r <= hi; r++) {
      const c = at(2, r), d = at(3, r), e = at(4, r), f = at(5, r);
      if (c && inside(r, 2) >= 0) qf[inside(r, 2)].venue = c;
      if (d && !DIV.test(d)) {
        if (inside(r, 2) >= 0) qf[inside(r, 2)].winner = team(d) ?? d;
        else if (between(r, 2) === 0 || between(r, 2) === 2) sf[between(r, 2) / 2].venue = d;
      }
      if (e) {
        if (inside(r, 4) >= 0) sf[inside(r, 4)].winner = team(e) ?? e;
        else if (between(r, 4) >= 0) final.venue = e;
      }
      if (f && !/^winner$/i.test(f)) champion = team(f) ?? f;
    }
    final.winner = champion;
    // A bye's seed goes straight through even before the newsletter writes it in.
    slots.forEach((s, i) => {
      const other = slots[i ^ 1];
      if (s.seed === null && other.team && !qf[i >> 1].winner) qf[i >> 1].winner = other.team;
    });
    out.set(b.division, {
      dates: {
        quarterfinals: headRow ? roundDate(at(0, headRow), year) : null,
        semifinals: headRow ? roundDate(at(3, headRow), year) : null,
        final: headRow ? roundDate(at(4, headRow), year) : null,
      },
      slots: slots.map(({ seed, team }) => ({ seed, team })),
      quarterfinals: qf,
      semifinals: sf,
      final,
    });
  }
  return out;
}
