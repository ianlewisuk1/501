import { isUs, norm } from "./names";
import { str, type Sheet } from "./sheet";
import type { TeamConfig } from "./team";
import type { Fixture } from "./types";

const PREDICTIONS = "predictions for the week";

function predictionsRow(ws: Sheet): number {
  return ws.findRow("A", (v) => norm(v) === PREDICTIONS) ?? ws.maxRow + 1;
}

/** This week's (left) and next week's (right) match for our team. */
export function fixtures(ws: Sheet, team: TeamConfig): { thisWeek: Fixture; nextWeek: Fixture } {
  const end = predictionsRow(ws);
  const side = (away: string, at: string, home: string, venue: string): Fixture => {
    const wk = str(ws.get(away, 1)).match(/\(Week (\d+)\)/);
    if (!wk) return null;
    const week = Number(wk[1]);
    let out: Fixture = null;
    for (let r = 2; r < end; r++) {
      const [a, sep, h, v] = [ws.get(away, r), ws.get(at, r), ws.get(home, r), ws.get(venue, r)];
      if (typeof sep === "string" && sep.startsWith("BYE - ") && norm(sep.slice(6)) === norm(team.name)) {
        out = { week, bye: true };
      } else if (sep === "@" && (isUs(team, a) || isUs(team, h))) {
        const usHome = isUs(team, h);
        out = {
          week,
          home: usHome,
          opponent: str(usHome ? a : h).trim(),
          venue: str(v).trim().replace(/^[()]+|[()]+$/g, ""),
        };
      }
    }
    return out;
  };
  return { thisWeek: side("A", "B", "C", "E"), nextWeek: side("H", "I", "J", "L") };
}

/** The editor's pick for our match: a featured write-up, or our entry in the "remaining matches" list. */
export function prediction(ws: Sheet, team: TeamConfig): { featured: boolean; text: string } | null {
  const start = predictionsRow(ws);
  if (start > ws.maxRow) return null;
  // The text runs down column A, then down column H, until the "Page N" footer.
  const footer = (r: number) => ws.row(r).some((v) => typeof v === "string" && /^Page \d+$/.test(v.trim()));
  let end = start;
  while (end <= ws.maxRow && !footer(end)) end++;
  const lines: string[] = [];
  for (let r = start + 1; r < end; r++) lines.push(str(ws.get("A", r)).trim());
  for (let r = start; r < end; r++) lines.push(str(ws.get("H", r)).trim());
  const text = lines.join(" ").replace(/\s+/g, " ");

  const name = team.name.toLowerCase();
  const featured = /(Match(?:es)? #[\d #&]+:\s*\((\w) Div\.\).*?)(?=Match(?:es)? #|And the remaining|$)/g;
  for (const m of text.matchAll(featured)) {
    if (m[2] === team.division && m[1].toLowerCase().includes(name)) return { featured: true, text: m[1].trim() };
  }

  const marker = "And the remaining";
  const i = text.indexOf(marker);
  const rest = i < 0 ? text : text.slice(i + marker.length);
  const m = rest.match(new RegExp(`${team.division} Division:\\s*(.*?)(?=[A-H] Division:|$)`));
  if (m) {
    for (const part of m[1].split(";")) {
      if (part.toLowerCase().includes(name)) return { featured: false, text: part.trim().replace(/\.+$/, "") };
    }
  }
  return null;
}
