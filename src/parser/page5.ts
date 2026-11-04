import { escapeRe, isUs, norm } from "./names";
import { str, type Sheet } from "./sheet";
import type { TeamConfig } from "./team";
import { resolveTeam } from "./resolve";
import type { Fixture, Round } from "./types";

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

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "Aug. 30th" -> "2026-08-30". */
function monthDay(s: string, year: string): string | null {
  const m = s.trim().match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})/);
  const mo = m ? MONTHS.indexOf(m[1].toLowerCase()) + 1 : 0;
  return mo ? `20${year}-${String(mo).padStart(2, "0")}-${m![2].padStart(2, "0")}` : null;
}

/**
 * Every division's matches for this week (left side) and next week (right side). Each row's
 * division is the one whose standings resolve its team names, so column F's labels aren't needed.
 */
export function leagueRounds(
  ws: Sheet,
  divisions: { division: string; names: string[] }[],
  year: string,
): Map<string, { thisWeek: Round | null; nextWeek: Round | null }> {
  const end = predictionsRow(ws);
  const find = (raw: string): { division: string; team: string } | null => {
    for (const d of divisions) {
      const team = resolveTeam(raw, d.names);
      if (team) return { division: d.division, team };
    }
    return null;
  };
  const side = (away: string, at: string, home: string, venue: string): Map<string, Round> | null => {
    const wk = str(ws.get(away, 1)).match(/\(Week (\d+)\)/);
    if (!wk) return null;
    const week = Number(wk[1]);
    const out = new Map(divisions.map((d) => [d.division, { week, matches: [], byes: [] } as Round]));
    for (let r = 2; r < end; r++) {
      let [a, sep, h, v] = [str(ws.get(away, r)).trim(), ws.get(at, r), str(ws.get(home, r)).trim(), ws.get(venue, r)];
      let date: string | undefined;
      // A make-up match is one line: "Still Hump'N @ Darty Little Secrets   (Aug. 30th, Brass Tap 5&6)".
      const makeup = sep === null && a.match(/^(.+?)\s+@\s+(.+?)\s*\(([^,]+),\s*(.+)\)$/);
      if (makeup) {
        [a, sep, h, v] = [makeup[1], "@", makeup[2], makeup[4]];
        date = monthDay(makeup[3], year) ?? undefined;
      }
      if (typeof sep === "string" && sep.startsWith("BYE - ")) {
        const raw = sep.slice(6).trim();
        const hit = find(raw);
        if (hit) out.get(hit.division)!.byes.push(hit.team);
      } else if (sep === "@") {
        // Prefer the division where both names resolve; a loose match alone could land in the wrong one.
        const both = divisions.filter((d) => resolveTeam(a, d.names) && resolveTeam(h, d.names));
        const division = both.length === 1 ? both[0].division : (find(a) ?? find(h))?.division;
        if (!division) continue;
        const names = divisions.find((d) => d.division === division)!.names;
        out.get(division)!.matches.push({
          away: resolveTeam(a, names) ?? a,
          home: resolveTeam(h, names) ?? h,
          venue: str(v).trim().replace(/^[()]+|[()]+$/g, ""),
          ...(date ? { date } : {}),
        });
      }
    }
    return out;
  };
  const left = side("A", "B", "C", "E");
  const right = side("H", "I", "J", "L");
  return new Map(divisions.map((d) => [d.division, {
    thisWeek: left?.get(d.division) ?? null,
    nextWeek: right?.get(d.division) ?? null,
  }]));
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

  // Featured write-ups lead with "Away @ Home."; the remaining list reads "Team 15, Other 9".
  const names = [team.name, ...team.aliases].map(norm);
  const named = (s: string) => names.some((n) => new RegExp(`(^|[^\\w'])${escapeRe(n)}([^\\w']|$)`).test(norm(s)));
  const featured = /((?:Match(?:es)? #[\d #&]+|Match of the week):\s*\((\w) Div\.\).*?)(?=Match(?:es)? #|Match of the week|And the remaining|$)/g;
  for (const m of text.matchAll(featured)) {
    const lead = m[1].replace(/^[^)]*\)\s*/, "").split(/\.\s/)[0];
    if (m[2] === team.division && named(lead)) return { featured: true, text: m[1].trim() };
  }

  const marker = "And the remaining";
  const i = text.indexOf(marker);
  const rest = i < 0 ? text : text.slice(i + marker.length);
  const m = rest.match(new RegExp(`${team.division} Division:\\s*(.*?)(?=[A-H] Division:|$)`));
  if (m) {
    for (const part of m[1].split(";")) {
      if (named(part)) return { featured: false, text: part.trim().replace(/\.+$/, "") };
    }
  }
  return null;
}
