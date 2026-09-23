import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "./index";
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
