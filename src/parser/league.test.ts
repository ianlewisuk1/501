import { describe, expect, it } from "vitest";
import { divisionOf, parseDivisionTeams, parseLeague, teamWeekOf } from "./index";
import { resolveTeam } from "./resolve";
import { TEAM } from "./team";
import { loadWorkbook } from "./workbook";
import type { LeagueWeek } from "./types";

const league = (wk: string): LeagueWeek => parseLeague(loadWorkbook(`fixtures/Fa26wk${wk}.xlsx`));
const wk09 = league("09");
const wk13 = league("13");
const div = (L: LeagueWeek, d: string) => L.divisions.find((x) => x.division === d)!;
const record = (L: LeagueWeek, d: string, category: string) => div(L, d).records.find((r) => r.category === category)!;

describe("resolveTeam", () => {
  const A = ["The Inflationary Element", "Appetite for Destruction", "Jonesing for Mugs", "Wing & A Plaque", "Darty Minds"];
  const C = ["Projectile Dysfunction", "Pints and Points", "Still Hump'N", "Darty Little Secrets"];
  const H = ["Dirty Darts (Done Dirt Cheap)", "The Blonde Leading the Blind", "Bright Side of Flights"];
  it.each([
    ["Element", A, "The Inflationary Element"],
    ["Inflation. Element", A, "The Inflationary Element"],
    ["…Element (10/21)", A, "The Inflationary Element"],
    ["Appetite… (9/9)", A, "Appetite for Destruction"],
    ["Jonesing forMugs", A, "Jonesing for Mugs"],
    ["Wing & a Plaque", A, "Wing & A Plaque"],
    ["Projetile", C, "Projectile Dysfunction"], // page 2's typo
    ["Pints", C, "Pints and Points"],
    ["Dirty Darts (Cheap)", H, "Dirty Darts (Done Dirt Cheap)"],
    ["Blonde Leading / Blind", H, "The Blonde Leading the Blind"],
    ["The Blind", H, "The Blonde Leading the Blind"],
  ])("%s", (raw, names, full) => expect(resolveTeam(raw, names)).toBe(full));

  it("refuses an ambiguous or unknown name", () => {
    expect(resolveTeam("Darty", A.concat(C))).toBeNull();
    expect(resolveTeam("Nobody Here", A)).toBeNull();
  });
});

describe("league issue", () => {
  it("has every division with standings, fixtures and page 10", () => {
    expect(wk13.divisions.map((d) => d.division)).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
    for (const d of wk13.divisions) {
      expect(d.teams.map((t) => t.name).sort()).toEqual(d.standings.map((s) => s.team).sort());
      const seen = [...d.thisWeek!.matches.flatMap((m) => [m.away, m.home]), ...d.thisWeek!.byes].sort();
      expect(seen).toEqual(d.standings.map((s) => s.team).sort());
    }
  });

  it("resolves page 5's abbreviations", () => {
    expect(div(wk13, "G").thisWeek!.matches).toContainEqual({ away: "We're Sexy & We Throw It", home: "Rippin Darts", venue: "High Park 1&2" });
    expect(div(wk13, "A").thisWeek!.byes).toEqual(["Son of a Beach"]);
  });

  it("keeps a forfeit's note and a missing scoresheet's null score", () => {
    const wk07 = league("07");
    const g = div(wk07, "G").results!.matches.find((m) => m.away.team === "Rippin Darts")!;
    expect(g).toMatchObject({ note: "match forfeited", away: { score: 0, gamesWon: null }, home: { score: 16 } });
    const h = div(wk07, "H").results!.matches.find((m) => m.away.team === "Calm Under Pressure")!;
    expect(h).toMatchObject({ note: "scoresheet not received by press time", away: { score: null }, home: { score: null } });
  });

  it("parses a make-up match written on one line (wk04)", () => {
    const c = div(parseLeague(loadWorkbook("fixtures/Fa26wk04.xlsx")), "C");
    expect(c.thisWeek!.matches).toContainEqual({ away: "Still Hump'N", home: "Darty Little Secrets", venue: "Brass Tap 5&6", date: "2026-08-30" });
  });
});

describe("records", () => {
  it("C: Ian Lewis holds Fast Singles 301 and, with Steve Massey, Fast Doubles 501", () => {
    expect(record(wk13, "C", "Fast Singles 301")).toEqual({
      category: "Fast Singles 301", value: "9 darts",
      holders: [{ players: ["Ian Lewis"], team: "Area 501", date: "2026-08-12" }],
    });
    expect(record(wk13, "C", "Fast Doubles 501").holders).toEqual([{ players: ["Ian Lewis", "Steve Massey"], team: "Area 501", date: "2026-09-02" }]);
  });

  it("lists every tied holder with their own date", () => {
    expect(record(wk13, "A", "Fast Singles 301")).toEqual({
      category: "Fast Singles 301", value: "9 darts",
      holders: [
        { players: ["Rich Bialaszewski"], team: "Appetite for Destruction", date: "2026-09-09" },
        { players: ["Mike Jones"], team: "Jonesing for Mugs", date: "2026-10-14" },
        { players: ["Chad Massengill"], team: "The Inflationary Element", date: "2026-10-21" },
      ],
    });
  });

  it("finds a holder from another division's team", () => {
    expect(record(wk13, "B", "Fast Singles 301").holders).toEqual([
      { players: ["Mike Cole"], team: "Why So Serious?", date: "2026-09-23" },
      { players: ["Kyle Gaulthier"], team: "Jonesing for Mugs", date: "2026-10-28" },
    ]);
  });

  it("joins team names and pairs that wrap across lines", () => {
    expect(record(wk13, "G", "High Out").holders).toEqual([{ players: ["Chris Mori"], team: "We're Sexy & We Throw It", date: "2026-10-28" }]);
    expect(record(wk13, "G", "Fast Doubles Cricket").holders[0].players).toEqual(["Thorbjorn Gylfason", "Dakota Helton"]);
    expect(record(wk13, "B", "Fast Doubles 501").holders[1]).toEqual({ players: ["David Hoyt", "Matt Ridgway"], team: 'The Kids who say "Ni!"', date: "2026-10-07" });
  });

  it("takes the first date from a value line that wraps (wk09 H)", () => {
    expect(record(wk09, "H", "High In")).toEqual({
      category: "High In", value: "Ton-12",
      holders: [{ players: ["Mike Ham"], team: "Double Vision", date: "2026-08-19" }],
    });
  });
});

describe("hot darts and perfect throws", () => {
  it("joins a doubles pair whose team name wraps", () => {
    expect(div(wk13, "A").hotDarts).toContainEqual({ players: ["Kenny Persson", "Robbie Phillips"], team: "The Inflationary Element", feat: "19-dart DCkt" });
  });

  it("keeps a whole-team feat", () => {
    expect(div(wk13, "A").hotDarts).toContainEqual({
      players: ["Mike J.", "Jimmie J.", "Kyle G.", "Grey J.", "Aaron V.", "Casey J."], team: "Jonesing for Mugs", feat: "37-dart 1001(!!)",
    });
  });

  it("uses the second row's team when the first row's is wrong (wk09 A)", () => {
    expect(div(wk09, "A").hotDarts).toContainEqual({ players: ["Grey Jones", "Guy Howes"], team: "Jonesing for Mugs", feat: "18-dart 501" });
  });

  it("reads perfect throws across columns, sections and wrapped lines", () => {
    const pt = wk13.perfectThrows;
    expect(pt.find((p) => p.player === "Robbie Phillips" && p.kind === "9-Marks")).toEqual({
      kind: "9-Marks", player: "Robbie Phillips", team: "The Inflationary Element", division: "A",
      dates: ["2026-08-19", "2026-09-23", "2026-10-14"],
    });
    expect(pt.find((p) => p.player === "Joe McCartney")).toMatchObject({ kind: "Ton-80s", team: "What's the Point?", dates: ["2026-08-19", "2026-09-23"] });
    expect(pt.find((p) => p.player === "Ian Lewis")).toMatchObject({ kind: "Ton-80s", team: "Area 501", division: "C", dates: ["2026-09-23"] });
    expect(pt.find((p) => p.player === "Tim Mozzetti")).toMatchObject({ kind: "6-Bulls" });
    expect(pt.every((p) => p.division)).toBe(true);
  });
});

describe("a team's view of the league issue matches the team parser", () => {
  for (const wk of ["01", "03", "06", "07", "12"]) {
    it(`every C team, week ${wk}`, () => {
      const wb = loadWorkbook(`fixtures/Fa26wk${wk}.xlsx`);
      const L = parseLeague(wb);
      for (const old of parseDivisionTeams(wb, TEAM)) {
        const view = teamWeekOf(L, old.team.name)!;
        expect(view.team).toEqual(old.team);
        expect(view.standings).toEqual(old.standings);
        expect(view.lastResult).toEqual(old.lastResult);
        // The team parser misses wk4's one-line make-up match (Still Hump'N @ Darty Little Secrets); the league parser finds it.
        const makeup = wk === "03" && ["Still Hump'N", "Darty Little Secrets"].includes(old.team.name);
        expect(view.thisWeek).toEqual(old.thisWeek);
        if (makeup) expect(old.nextWeek).toBeNull();
        else expect(view.nextWeek).toEqual(old.nextWeek);
        expect(view.players).toEqual(old.players);
        expect(view.headline).toEqual(old.headline);
      }
    });
  }

  it("carries our trophy darts and hot darts (wk06)", () => {
    const view = teamWeekOf(league("06"), TEAM.name)!;
    expect(view.trophyDarts).toEqual([
      { category: "Fast Singles 301", value: "9 darts", date: "2026-08-12", players: ["Ian Lewis"] },
      { category: "Fast Doubles 501", value: "21 darts", date: "2026-09-02", players: ["Ian Lewis", "Steve Massey"] },
    ]);
    expect(view.hotDarts).toEqual([
      { players: ["Steve Massey"], feat: "15-dart 301" },
      { players: ["Steve Massey"], feat: "6.5 ASPs" },
    ]);
  });

  it("finds a team's division", () => {
    expect(divisionOf(wk13, "Rippin Darts")?.division).toBe("G");
    expect(teamWeekOf(wk13, "Nobody")).toBeNull();
  });
});
