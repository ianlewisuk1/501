/**
 * League-wide page 3: every division's trophy dart records and hot darts, and the Perfect Throws list.
 * Positions on this page move week to week, so everything is found by its text.
 */
import { firstLast, norm, playerKey } from "./names";
import { cleanTeamText, DATE_TAIL, resolveTeam } from "./resolve";
import { isBlank, isoDate, str, type Sheet, type Value } from "./sheet";
import type { DivisionHotDart, PerfectThrow, RecordHolder, TrophyRecord } from "./types";

const TROPHY_HEADER = "divisional trophy dart categories";
const DIVISION_HEADER = /^"([A-Z])" Division$/;

export interface DivisionNames {
  division: string;
  teams: string[];
  /** Every player on the division's page 10, "First Last". */
  players: string[];
}

/** "(9/9)" or "(9/9/26)" on the end of a line, as an ISO date. Year defaults to the issue's. */
function tailDate(s: string, year: string): string | null {
  const m = s.match(DATE_TAIL);
  return m ? isoDate(m[1], m[2], m[3] ?? year) : null;
}

/** Every division's six trophy dart categories, with tied holders listed separately. */
export function divisionRecords(ws: Sheet, divisions: DivisionNames[], year: string): Map<string, TrophyRecord[]> {
  const out = new Map<string, TrophyRecord[]>(divisions.map((d) => [d.division, []]));
  const top = ws.findRow("A", (v) => norm(v) === TROPHY_HEADER);
  if (top === null) return out;
  const hdr = top + 1;
  const perfect = ws.findRow("A", (v) => norm(v) === "perfect throws", top) ?? ws.maxRow + 1;
  const starts: number[] = [];
  for (let r = hdr + 1; r < perfect; r++) {
    if (["high in", "high out", "fast"].includes(norm(ws.get("A", r)))) starts.push(r);
  }

  for (const [col, v] of ws.entries(hdr)) {
    const m = norm(v).match(/^([a-z]) division$/);
    const names = m && divisions.find((d) => d.division === m[1].toUpperCase());
    if (!names) continue;
    // A sub from another division can share a record, so players and teams are checked league-wide too.
    const roster = new Set(divisions.flatMap((d) => d.players).map(playerKey));
    const allTeams = divisions.flatMap((d) => d.teams);
    starts.forEach((s, i) => {
      const e = starts[i + 1] ?? perfect;
      const label: string[] = [];
      const cells: string[] = [];
      for (let r = s; r < e; r++) {
        const a = ws.get("A", r);
        if (!isBlank(a)) label.push(String(a).trim());
        const c = ws.get(col, r);
        if (!isBlank(c)) cells.push(String(c).trim());
      }
      if (!cells.length || cells[0].startsWith("(none")) return;
      // The value line can wrap: "Ton-12 (twice! -" / "8/19/26 & 9/16/26)".
      let first = cells.shift()!;
      while (balance(first) > 0 && cells.length) first = `${first} ${cells.shift()}`;
      const lines = cells;
      const value = first.replace(/\s*\(.*$/, "").trim();
      const holders = recordHolders(lines, roster, names.teams, allTeams, year);
      // A single holder's date sits on the value line (the first one if set twice); tied holders carry their own.
      const d = first.match(/\((?:.*?\D)?(\d{1,2})\/(\d{1,2})\/(\d{2})/);
      const date = d ? isoDate(d[1], d[2], d[3]) : null;
      if (date) for (const h of holders) h.date ??= date;
      out.get(names.division)!.push({
        category: label.join(" ").replace(/\s*\(.*$/, ""), // drop '(301 first turn only!!)' style notes
        value,
        holders,
      });
    });
  }
  return out;
}

/** Split a player line ("Ian Lewis &", "& Dakota Helton", "Chuck Ginger & Roy Lee") into names. */
const playerNames = (line: string): string[] =>
  line.split("&").map((p) => p.trim()).filter(Boolean);

/**
 * Group record lines into holders: player line(s), then team line(s). A line is a player when it
 * names someone on any division's roster, or continues a pair ("Ian Lewis &"); team names can wrap
 * across two lines ("The Kids who" / "say "Ni!" (10/7)").
 */
function recordHolders(lines: string[], roster: Set<string>, teams: string[], allTeams: string[], year: string): RecordHolder[] {
  const holders: RecordHolder[] = [];
  let players: string[] = [];
  let teamLines: string[] = [];
  let pairOpen = false;
  const flush = () => {
    if (!players.length && !teamLines.length) return;
    const text = teamLines.join(" ");
    holders.push({
      players,
      team: resolveTeam(text, teams) ?? resolveTeam(text, allTeams) ?? cleanTeamText(text),
      date: tailDate(text, year),
    });
    players = [];
    teamLines = [];
  };
  for (const line of lines) {
    const names = playerNames(line);
    const isPlayer =
      (names.length > 0 && names.every((n) => roster.has(playerKey(n)))) ||
      pairOpen || line.startsWith("&") ||
      (!players.length && !teamLines.length);
    if (isPlayer) {
      if (teamLines.length) flush();
      players.push(...names);
      pairOpen = line.endsWith("&");
    } else {
      teamLines.push(line);
      pairOpen = false;
    }
  }
  flush();
  return holders;
}

/**
 * Hot Darts, by division. Three column groups (name, team, value, unit) read as one flowing list,
 * with `"C" Division` headers. Doubles wrap onto a second row, as can the team name.
 */
export function leagueHotDarts(ws: Sheet, divisions: DivisionNames[]): Map<string, DivisionHotDart[]> {
  const out = new Map<string, DivisionHotDart[]>(divisions.map((d) => [d.division, []]));
  const stop = ws.findRow("A", (v) => norm(v) === TROPHY_HEADER) ?? ws.maxRow;
  const groups = [["A", "B", "C", "D"], ["G", "H", "I", "J"], ["M", "N", "O", "P"]];
  let division: DivisionNames | undefined;
  for (const [nameC, teamC, valC, unitC] of groups) {
    let entry: { names: string[]; teams: string[] } | null = null;
    for (let r = 2; r < stop; r++) {
      const name = ws.get(nameC, r);
      const who = ws.get(teamC, r);
      const text = typeof name === "string" ? name : "";
      const hdr = text.trim().match(DIVISION_HEADER);
      if (hdr) {
        division = divisions.find((d) => d.division === hdr[1]);
        entry = null;
        continue;
      }
      if (!text.trim()) {
        entry = null;
        continue;
      }
      if (entry && /^\s/.test(text)) {
        entry.names.push(text.trim());
      } else if (text.includes(",") || text.includes("(")) {
        entry = { names: [text.trim()], teams: [] };
      } else {
        entry = null; // column headings and the editor's notes
        continue;
      }
      if (!isBlank(who)) entry.teams.push(str(who).trim());
      const value = ws.get(valC, r);
      const unit = str(ws.get(unitC, r)).trim();
      if (isBlank(value) && !unit) continue; // a doubles pair or team name continues below
      if (division) out.get(division.division)!.push(hotDart(entry, value, unit, division.teams));
      entry = null;
    }
  }
  return out;
}

function hotDart(entry: { names: string[]; teams: string[] }, value: Value, unit: string, teams: string[]): DivisionHotDart {
  const feat = (isBlank(value) ? unit : `${value} ${unit}`).trim();
  const joined = entry.names.join(" ").replace(/\s+/g, " ");
  // A whole-team feat: "Jonesing for Mugs (Mike J., Jimmie J., ...)".
  const team = joined.match(/^([^(]+?)\s*\((.*)\)\s*$/);
  if (team && !team[1].includes(",")) {
    return {
      players: team[2].split(",").map((p) => p.trim()).filter(Boolean),
      team: resolveTeam(team[1], teams) ?? team[1].trim(),
      feat,
    };
  }
  // A team name can wrap onto the pair's second row; failing that, the second row's team is the one.
  const teamText = entry.teams.join(" ");
  const last = entry.teams.at(-1) ?? "";
  return {
    players: joined.split("&").map((p) => firstLast(p.trim())).filter(Boolean),
    team: resolveTeam(teamText, teams) ?? resolveTeam(last, teams) ?? teamText,
    feat,
  };
}

const balance = (s: string) => (s.match(/\(/g)?.length ?? 0) - (s.match(/\)/g)?.length ?? 0);

/**
 * The league-wide Perfect Throws list: "Name (Team, m/d)" or "Name (3) (Team, m/d, m/d, m/d)",
 * under section headings ("9-Marks", "Ton-80s", "6-Bulls") that flow down one column and into the next.
 * A long entry wraps onto the next row, a few columns to the right.
 */
export function perfectThrows(ws: Sheet, divisions: DivisionNames[], year: string): PerfectThrow[] {
  const start = ws.findRow("A", (v) => norm(v) === "perfect throws");
  if (start === null) return [];
  const footer = (r: number) => ws.row(r).some((v) => typeof v === "string" && /^Page \d+$/.test(v.trim()));
  let end = start;
  while (end <= ws.maxRow && !footer(end)) end++;

  // cells[col][row] for every text cell, then fold each wrapped tail into the open entry above-left.
  type Cell = { col: number; row: number; text: string };
  const cells: Cell[] = [];
  for (let r = start; r < end; r++) {
    ws.row(r).forEach((v, c) => {
      if (typeof v === "string" && v.trim() && !(r === start && c === 0)) cells.push({ col: c, row: r, text: v.trim() });
    });
  }
  const tails = cells.filter((c) => balance(c.text) < 0);
  for (const t of tails) {
    const open = cells
      .filter((c) => c.row === t.row - 1 && c.col < t.col && balance(c.text) > 0)
      .sort((a, b) => b.col - a.col)[0];
    if (open) open.text = `${open.text} ${t.text}`;
  }
  const entries = cells.filter((c) => !tails.includes(c)).sort((a, b) => a.col - b.col || a.row - b.row);

  const all = divisions.flatMap((d) => d.teams);
  const out: PerfectThrow[] = [];
  let kind = "";
  for (const { text } of entries) {
    if (text.startsWith("(none")) continue;
    if (!text.includes("(")) {
      kind = text;
      continue;
    }
    const m = text.match(/^(.*?)\s*(?:\(\d+\)\s*)?\((.*)\)\s*$/);
    if (!m) continue;
    const parts = m[2].split(",").map((p) => p.trim());
    const dates: string[] = [];
    while (parts.length && /^\d{1,2}\/\d{1,2}$/.test(parts.at(-1)!)) {
      const [mo, d] = parts.pop()!.split("/");
      dates.unshift(isoDate(mo, d, year));
    }
    const teamText = parts.join(", ");
    const team = resolveTeam(teamText, all);
    out.push({
      kind,
      player: m[1].trim(),
      team: team ?? teamText,
      division: team ? divisions.find((d) => d.teams.includes(team))!.division : null,
      dates,
    });
  }
  return out;
}
