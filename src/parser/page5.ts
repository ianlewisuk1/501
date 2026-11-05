import { escapeRe, isUs, norm } from "./names";
import { str, type Sheet } from "./sheet";
import type { TeamConfig } from "./team";
import { resolveTeam } from "./resolve";
import type { Fixture, Pick, Round } from "./types";

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

/** The editor's predictions as one run of text: down column A, then down column H, to the "Page N" footer. */
function predictionText(ws: Sheet): string | null {
  const start = predictionsRow(ws);
  if (start > ws.maxRow) return null;
  const footer = (r: number) => ws.row(r).some((v) => typeof v === "string" && /^Page \d+$/.test(v.trim()));
  let end = start;
  while (end <= ws.maxRow && !footer(end)) end++;
  const lines: string[] = [];
  for (let r = start + 1; r < end; r++) lines.push(str(ws.get("A", r)).trim());
  for (let r = start; r < end; r++) lines.push(str(ws.get("H", r)).trim());
  // A "Page 5" footer can land mid-sentence where column A's text runs on into column H's.
  return lines.join(" ").replace(/\bPage \d+\b/g, " ").replace(/\s+/g, " ").trim();
}

/** The editor's pick for our match: a featured write-up, or our entry in the "remaining matches" list. */
export function prediction(ws: Sheet, team: TeamConfig): { featured: boolean; text: string } | null {
  const text = predictionText(ws);
  if (text === null) return null;

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

/** "Have to go Element, 13-11." The sentence that makes the call, with the one before it when it's only a score. */
function closingCall(body: string): string {
  const sentences = body.split(/(?<=[.!?…])\s+(?=\S)/).map((x) => x.trim()).filter(Boolean);
  // Take sentences from the end until there are some words, so "13-11." or "barely. 13-11." brings
  // the sentence it finishes ("No small task, but they do…. barely. 13-11.").
  let call = "";
  for (let i = sentences.length - 1; i >= 0; i--) {
    call = call ? `${sentences[i]} ${call}` : sentences[i];
    if (call.replace(/[\d\s+\-–.,…]/g, "").length >= 10) break;
  }
  return call;
}

/**
 * The fixture a pick is about, from the two names the editor wrote. Names get shortened and
 * misspelled ("Only Darts", "Fight Club", "Main St Mayhew"), so when only one of them is
 * recognised the fixture still is: each team plays once a week.
 */
function fixtureFor(a: string, b: string, names: string[], matches: { away: string; home: string }[]) {
  const ra = resolveTeam(a, names);
  const rb = resolveTeam(b, names);
  const has = (m: { away: string; home: string }, t: string | null) => !!t && (m.away === t || m.home === t);
  return matches.find((m) => has(m, ra) && has(m, rb))
    ?? matches.find((m) => (ra && !rb && has(m, ra)) || (rb && !ra && has(m, rb)))
    ?? null;
}

/**
 * The editor's pick for every match this week, by division, matched to page 5's fixtures. Featured
 * matches ("Match #4: (C Div.) Menace 2 Sobriety @ Area 501. …") keep the write-up and its closing
 * call in the editor's words; no winner is read into the prose. The "remaining matches" list
 * ("C Division: Mulligans Mafia 15, Still Hump'N 9; …") is a plain score line, with the names
 * resolved to the standings'. "12+" means that side takes a 12–12 on the 1001.
 */
export function leaguePicks(
  ws: Sheet,
  divisions: { division: string; names: string[]; matches: { away: string; home: string }[] }[],
): Map<string, Pick[]> {
  const out = new Map<string, Pick[]>(divisions.map((d) => [d.division, []]));
  const text = predictionText(ws);
  if (!text) return out;
  const add = (division: string, away: string, home: string, pick: Omit<Pick, "away" | "home">) => {
    const list = out.get(division);
    if (list && !list.some((p) => p.away === away && p.home === home)) list.push({ away, home, ...pick });
  };

  const featured = /(Match(?:es)? #[\d #&,]+|Match of the week):\s*\(([A-H]) Div\.\)\s*(.*?)(?=Match(?:es)? #\d|Match of the week:|And the remaining|$)/g;
  for (const m of text.matchAll(featured)) {
    const d = divisions.find((x) => x.division === m[2]);
    if (!d) continue;
    const body = m[3].trim();
    // The lead names the match(es): "Away @ Home." or "A @ B; C @ D; E @ F."
    const lead = body.slice(0, 240);
    const found = [...lead.matchAll(/(?:^|;\s*)([^;@]+?)\s+@\s+([^;]+?)(?=;|[.?!]\s|$)/g)]
      .map((pair) => fixtureFor(pair[1], pair[2], d.names, d.matches))
      .filter((f): f is { away: string; home: string } => !!f);
    // A write-up covering several matches ends on a call about only one of them, so it has no call of its own.
    const call = found.length === 1 ? closingCall(body) : null;
    for (const f of found) add(d.division, f.away, f.home, { featured: true, text: body, call, together: found.length });
  }

  const i = text.indexOf("And the remaining");
  if (i >= 0) {
    const rest = text.slice(i);
    for (const sec of rest.matchAll(/([A-H]) Division:\s*(.*?)(?=\s[A-H] Division:|$)/g)) {
      const d = divisions.find((x) => x.division === sec[1]);
      if (!d) continue;
      for (const part of sec[2].split(";")) {
        const pm = part.trim().replace(/\.$/, "").match(/^(.+?)\s+(\d+)(\+?),\s*(.+?)\s+(\d+)(\+?)$/);
        if (!pm) continue;
        const f = fixtureFor(pm[1], pm[4], d.names, d.matches);
        if (!f) continue;
        // Written with the standings' names, whichever spelling the editor used.
        const full = (raw: string) => resolveTeam(raw, d.names) ?? ([f.away, f.home].find((t) => t !== resolveTeam(raw === pm[1] ? pm[4] : pm[1], d.names)) ?? raw);
        const side = (raw: string, n: string, plus: string) => `${full(raw)} ${n}${plus ? " (wins the 1001)" : ""}`;
        const line = `${side(pm[1], pm[2], pm[3])}, ${side(pm[4], pm[5], pm[6])}`;
        add(d.division, f.away, f.home, { featured: false, text: line, call: line, together: 1 });
      }
    }
  }
  return out;
}
