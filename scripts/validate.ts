/**
 * npm run validate [-- files...]: parse every newsletter league-wide and cross-check it.
 * Defaults to every .xlsx in inbox/. Exits 1 if any check fails.
 *
 * Within an issue: names resolve to a standings team, every team plays or byes exactly once,
 * match games add up. Across issues: standings move by exactly last week's result, page 5's
 * "next week" agrees with the following issue's "this week", and player numbers keep their names.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { parseLeague } from "../src/parser/league";
import { playerKey } from "../src/parser/names";
import { loadWorkbook } from "../src/parser/workbook";
import type { LeagueWeek, Round } from "../src/parser/types";

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync("inbox").filter((f) => f.endsWith(".xlsx")).sort().map((f) => join("inbox", f));

const problems: string[] = [];
const warnings: string[] = [];
const fail = (where: string, msg: string) => problems.push(`${where}: ${msg}`);
const warn = (where: string, msg: string) => warnings.push(`${where}: ${msg}`);

const issues: LeagueWeek[] = files.map((f) => parseLeague(loadWorkbook(f))).sort((a, b) => a.issueDate.localeCompare(b.issueDate));

for (const L of issues) {
  const wk = `${L.season} wk${L.week}`;
  const allTeams = new Set(L.divisions.flatMap((d) => d.standings.map((s) => s.team)));
  const allPlayers = new Set(L.divisions.flatMap((d) => d.teams.flatMap((t) => t.players.map((p) => playerKey(p.name)))));
  if (L.divisions.length !== 8) warn(wk, `${L.divisions.length} divisions`);

  for (const d of L.divisions) {
    const numbers = new Map<number, string>(); // player numbers are unique within a division only
    const at = `${wk} ${d.division}`;
    const names = d.standings.map((s) => s.team);
    const known = new Set(names);
    if (names.length < 6) fail(at, `only ${names.length} teams in the standings`);

    // Page 10 lists the same teams (absent only in the week 1 issue).
    if (L.week > 1) {
      const pg10 = d.teams.map((t) => t.name);
      const missing = names.filter((n) => !pg10.includes(n));
      const extra = pg10.filter((n) => !known.has(n));
      if (missing.length || extra.length) fail(at, `page 10 teams differ: missing ${missing.join(", ")} extra ${extra.join(", ")}`);
      for (const t of d.teams) {
        if (!t.players.length) fail(at, `${t.name} has no players`);
        for (const p of t.players) {
          const prev = numbers.get(p.number);
          if (prev && prev !== p.name) fail(at, `player #${p.number} is both ${prev} and ${p.name}`);
          numbers.set(p.number, p.name);
        }
      }
    }

    // Results: each team once, games add up.
    if (d.results) {
      const seen = [...d.results.matches.flatMap((m) => [m.away.team, m.home.team]), ...d.results.byes];
      for (const t of seen) if (!known.has(t)) fail(at, `results name "${t}" not in standings`);
      for (const n of names) {
        const c = seen.filter((t) => t === n).length;
        if (c !== 1) fail(at, `${n} appears ${c} times in results`);
      }
      for (const m of d.results.matches) {
        if (m.note) warn(at, `${m.away.team} @ ${m.home.team}: ${m.note}`);
        for (const s of [m.away, m.home]) {
          if (!s.gamesWon) continue;
          const g = s.gamesWon.singles301 + s.gamesWon.singlesCricket + s.gamesWon.doublesCricket + s.gamesWon.doubles501;
          if (g !== s.score) warn(at, `${s.team} scored ${s.score} but won ${g} games`);
        }
        // Short-handed teams forfeit games, so under 24 is normal.
        if ((m.away.score ?? 0) + (m.home.score ?? 0) > 24) fail(at, `${m.away.team} @ ${m.home.team} totals over 24`);
      }
    } else if (L.week > 1) fail(at, "no results");

    // Fixtures: each team once per week.
    for (const [label, round] of [["this week", d.thisWeek], ["next week", d.nextWeek]] as const) {
      if (!round) {
        if (L.week > 1) warn(at, `no ${label} fixtures`); // the week 1 page 5 recaps last season
        continue;
      }
      const seen = [...round.matches.flatMap((m) => [m.away, m.home]), ...round.byes];
      for (const t of seen) if (!known.has(t)) fail(at, `${label} name "${t}" not in standings`);
      for (const n of names) {
        const c = seen.filter((t) => t === n).length;
        if (c !== 1) fail(at, `${n} appears ${c} times in ${label} (week ${round.week})`);
      }
      for (const m of round.matches) if (!m.venue) fail(at, `${label}: ${m.away} @ ${m.home} has no venue`);
    }

    // Records, hot darts.
    for (const r of d.records) {
      if (!r.holders.length) fail(at, `${r.category} has no holders`);
      for (const h of r.holders) {
        if (!allTeams.has(h.team)) fail(at, `${r.category} team "${h.team}" unresolved`);
        if (!h.players.length) fail(at, `${r.category} holder with no players`);
        for (const p of h.players) if (L.week > 1 && !allPlayers.has(playerKey(p))) warn(at, `${r.category} player "${p}" not on any roster`);
        if (!h.date) warn(at, `${r.category} ${h.players.join(" & ")} has no date`);
      }
    }
    for (const h of d.hotDarts) if (!known.has(h.team)) fail(at, `hot dart team "${h.team}" unresolved (${h.players.join(" & ")}, ${h.feat})`);
  }
  for (const p of L.perfectThrows) {
    if (!p.division) fail(wk, `perfect throw team "${p.team}" unresolved (${p.player})`);
    if (!p.kind) fail(wk, `perfect throw ${p.player} has no section`);
    if (!p.dates.length) fail(wk, `perfect throw ${p.player} has no dates`);
  }
}

// ---- Across issues ----
const pairKey = (away: string, home: string) => `${away} @ ${home}`;
const roundKeys = (r: Round | null) => new Set(r ? [...r.matches.map((m) => pairKey(m.away, m.home)), ...r.byes.map((b) => `BYE ${b}`)] : []);

// Teams whose scoresheet missed press time. The newsletter adds those points in a later issue,
// sometimes in pieces, so after a late sheet a team's point mismatches are only warnings.
const late = new Set<string>();
const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`);
const unreported = (div: LeagueWeek["divisions"][number] | undefined) =>
  (div?.results?.matches ?? []).filter((m) => m.away.score === null || m.home.score === null).flatMap((m) => [m.away.team, m.home.team]);
for (const d of issues[0]?.divisions ?? []) for (const t of unreported(d)) late.add(t);

for (let i = 1; i < issues.length; i++) {
  const [prev, cur] = [issues[i - 1], issues[i]];
  const wk = `${cur.season} wk${cur.week}`;
  if (cur.week !== prev.week + 1) warn(wk, `follows wk${prev.week}; cross-week checks may be off`);
  for (const d of cur.divisions) {
    const at = `${wk} ${d.division}`;
    const p = prev.divisions.find((x) => x.division === d.division);
    if (!p || !d.results) continue;

    // Standings move by exactly the result. A 12-12 tie goes to the 1001 tiebreaker.
    const thisLate = new Set(unreported(d));
    const delta = new Map<string, { points: number; w: number; l: number; tied: boolean }>();
    for (const m of d.results.matches) {
      if (m.away.score === null || m.home.score === null) continue;
      for (const [us, them] of [[m.away, m.home], [m.home, m.away]]) {
        const tied = us.score === them.score;
        const won = us.score! > them.score! || (tied && us.tiebreaker1001 === "W");
        const lost = us.score! < them.score! || (tied && us.tiebreaker1001 === "L");
        delta.set(us.team, { points: us.score!, w: won ? 1 : 0, l: lost ? 1 : 0, tied });
      }
    }
    for (const s of d.standings) {
      const before = p.standings.find((x) => x.team === s.team) ?? { points: 0, wins: 0, losses: 0 };
      const dl = delta.get(s.team) ?? { points: 0, w: 0, l: 0, tied: false }; // bye or missing sheet
      const points = s.points - before.points;
      const games = s.wins + s.losses - before.wins - before.losses;
      const record = s.wins - before.wins === dl.w && s.losses - before.losses === dl.l;
      if (late.has(s.team) && (points !== dl.points || !record)) {
        warn(at, `${s.team}: late scoresheet adjustment (${signed(points - dl.points)} points, ${games} games)`);
        continue;
      }
      if (thisLate.has(s.team)) continue;
      if (points !== dl.points) fail(at, `${s.team} points ${before.points} -> ${s.points}, but scored ${dl.points}`);
      if (!record) {
        const msg = `${s.team} record ${before.wins}-${before.losses} -> ${s.wins}-${s.losses}, result ${dl.w ? "W" : dl.l ? "L" : "-"}`;
        // A tied score's winner hinges on page 2's 1001 column, which has disagreed with the standings.
        if (dl.tied) warn(at, `${msg} (tied score: page 2's tiebreaker disagrees with the standings)`);
        else fail(at, msg);
      }
    }
    for (const t of thisLate) late.add(t);

    // Last issue's "this week" is what was played.
    const played = new Set([...d.results.matches.map((m) => pairKey(m.away.team, m.home.team)), ...d.results.byes.map((b) => `BYE ${b}`)]);
    if (p.thisWeek?.week === d.results.week) {
      for (const k of roundKeys(p.thisWeek)) if (!played.has(k)) warn(at, `wk${d.results.week} listed "${k}" but results differ`);
    }
    // Last issue's "next week" is this issue's "this week".
    if (p.nextWeek && d.thisWeek && p.nextWeek.week === d.thisWeek.week) {
      const now = roundKeys(d.thisWeek);
      for (const k of roundKeys(p.nextWeek)) if (!now.has(k)) warn(at, `wk${d.thisWeek.week} fixture "${k}" changed since last issue`);
    }
  }
}

const summary = (label: string, list: string[]) => {
  if (!list.length) return;
  console.log(`\n${label} (${list.length}):`);
  for (const line of list) console.log(`  ${line}`);
};
console.log(`Checked ${issues.length} issues: ${issues.map((l) => `wk${l.week}`).join(" ")}`);
summary("Warnings", warnings);
summary("Failures", problems);
if (problems.length) process.exit(1);
console.log("\nAll checks passed.");
