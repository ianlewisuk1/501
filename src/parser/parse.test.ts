import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse, parseDivisionTeams, parseDivisionWorkbook } from "./index";
import { loadWorkbook } from "./workbook";
import { TEAM } from "./team";
import type { MatchResult, Player } from "./types";

const golden = (name: string) =>
  JSON.parse(readFileSync(`fixtures/expected/${name}.area501.json`, "utf8"));

const wk06 = parse("fixtures/Fa26wk06.xlsx", TEAM);
const wk07 = parse("fixtures/Fa26wk07.xlsx", TEAM);

describe("golden files", () => {
  it("matches week 6", () => expect(wk06).toEqual(golden("Fa26wk06")));
  it("matches week 7", () => expect(wk07).toEqual(golden("Fa26wk07")));
});

describe("spot checks", () => {
  it("wk07 fixtures", () => {
    expect(wk07.thisWeek).toEqual({ week: 7, home: true, opponent: "Menace 2 Sobriety", venue: "The Flying Saucer" });
    expect(wk07.nextWeek).toEqual({ week: 8, home: false, opponent: "Brutha Ducks", venue: "Snooker's 1&2" });
  });

  it("wk07 last result: away at Pints, 19-5", () => {
    const r = wk07.lastResult as MatchResult;
    expect(r).toMatchObject({ opponentShort: "Pints", home: false, score: { us: 19, them: 5 }, tiebreaker1001: null });
    expect(r.gamesWon).toEqual({ singles301: 4, singlesCricket: 5, doublesCricket: 4, doubles501: 6 });
  });

  it("wk06 last result pairs rows away from our standings row", () => {
    expect(wk06.lastResult).toMatchObject({ opponentShort: "Hump'N", home: false, score: { us: 19, them: 5 } });
  });

  it("predictions: featured in wk07, remaining list in wk06", () => {
    expect(wk07.prediction?.featured).toBe(true);
    expect(wk07.prediction?.text).toMatch(/^Match #4: \(C Div\.\) Menace 2 Sobriety @ Area 501\..*Area it is, 14-10\.$/);
    expect(wk06.prediction).toEqual({ featured: false, text: "Area 501 16, Pints and Points 8" });
  });

  it("wk07 standings", () => {
    expect(wk07.standings[0]).toEqual({ rank: 1, team: "Area 501", wins: 6, losses: 0, points: 94 });
    expect(wk07.standings[1]).toEqual({ rank: 2, team: "Menace 2 Sobriety", wins: 5, losses: 1, points: 86 });
  });

  it("wk07 players", () => {
    expect(wk07.players).toHaveLength(10);
    const ian = wk07.players.find((p) => p.name === "Ian Lewis") as Player;
    expect(ian).toMatchObject({ number: 61, total: { w: 19, l: 2 }, aspAverage: 0.9286 });
  });

  it("wk07 Pg7: blank rank inherits the rank above", () => {
    expect(wk07.leaderboards.singlesPlusDoubles.find((r) => r.player === "Jamie Bender")?.rank).toBe(10);
  });

  it("hot darts", () => {
    expect(wk06.hotDarts).toEqual([
      { players: ["Steve Massey"], feat: "15-dart 301" },
      { players: ["Steve Massey"], feat: "6.5 ASPs" },
    ]);
    expect(wk07.hotDarts).toEqual([]);
  });

  it("trophy darts", () => {
    for (const wk of [wk06, wk07]) {
      expect(wk.trophyDarts).toEqual([
        { category: "Fast Singles 301", value: "9 darts", date: "2026-08-12", players: ["Ian Lewis"] },
        { category: "Fast Doubles 501", value: "21 darts", date: "2026-09-02", players: ["Ian Lewis", "Steve Massey"] },
      ]);
    }
  });
});

describe("edge cases", () => {
  it("parses the week 1 issue, which has no results or stats yet", () => {
    const wk01 = parse("fixtures/Fa26wk01.xlsx", TEAM);
    expect(wk01.lastResult).toBeNull();
    expect(wk01.players).toEqual([]);
    expect(wk01.standings).toHaveLength(8);
  });

  it("gives a tied team with a blank rank cell the rank above (wk03)", () => {
    const wk03 = parse("fixtures/Fa26wk03.xlsx", TEAM);
    expect(wk03.standings).toHaveLength(8);
    expect(wk03.standings[5]).toMatchObject({ rank: 5, team: "Projectile Dysfunction" });
  });

  it("ranks a clinched team whose rank cell is blank by position (wk12)", () => {
    const wk12 = parse("fixtures/Fa26wk12.xlsx", TEAM);
    expect(wk12.standings.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(wk12.standings[0]).toEqual({ rank: 1, team: "Area 501", wins: 11, losses: 0, points: 171, clinched: "C" });
  });
});

describe("division players (scouting)", () => {
  const div = parseDivisionWorkbook(loadWorkbook("fixtures/Fa26wk07.xlsx"), TEAM);

  it("finds all eight C teams in page order", () => {
    expect(div).toMatchObject({ season: "Fa26", week: 7, division: "C" });
    expect(div.teams.map((t) => t.code)).toEqual(["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"]);
  });

  it("our block matches the team page's players", () => {
    expect(div.teams.find((t) => t.code === "C6")).toEqual({ code: "C6", name: "Area 501", players: wk07.players });
  });

  it("every team has players and the opponent's block is named like the standings", () => {
    for (const t of div.teams) expect(t.players.length).toBeGreaterThan(0);
    expect(div.teams.map((t) => t.name)).toContain("Menace 2 Sobriety");
  });
});

describe("every team in the division", () => {
  const teams = parseDivisionTeams(loadWorkbook("fixtures/Fa26wk07.xlsx"), TEAM);

  it("parses all 8 C teams, ours exactly as before", () => {
    expect(teams).toHaveLength(8);
    expect(teams.find((t) => t.team.name === "Area 501")).toEqual(wk07);
  });

  it("matches other teams by their short page 2 name", () => {
    const menace = teams.find((t) => t.team.name === "Menace 2 Sobriety")!;
    expect(menace.team.code).toBe("C7");
    expect(menace.thisWeek).toEqual({ week: 7, home: false, opponent: "Area 501", venue: "The Flying Saucer" });
    expect(menace.prediction?.text).toMatch(/^Match #4:/);
    // The remaining-matches list calls them "Ducks".
    expect(teams.find((t) => t.team.name === "Brutha Ducks")!.prediction).toEqual({ featured: false, text: "Ducks 14, Still Hump'N 10" });
  });
});
