import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import schedule from "../../data/Fa26/schedule.json";
import { parse } from "../parser/index";
import { TEAM } from "../parser/team";
import { buildFixtures, editorPick, findStanding, isIOS, mapsUrl, mapsUrls, shortDate, form, teamTotals, weeklyGames, WHOLE_TEAM, type SeasonSchedule } from "./model";

const wk06 = parse("fixtures/Fa26wk06.xlsx", TEAM);
const wk07 = parse("fixtures/Fa26wk07.xlsx", TEAM);
const sched = schedule as SeasonSchedule;

describe("fixtures", () => {
  const rows = buildFixtures(wk07, [wk06, wk07], sched);

  it("lists all 14 weeks with status", () => {
    expect(rows).toHaveLength(14);
    expect(rows[6]).toMatchObject({ week: 7, status: "current", home: true, opponent: "Menace 2 Sobriety", venue: "The Flying Saucer" });
    expect(rows[0].status).toBe("past");
    expect(rows[13]).toMatchObject({ status: "future", opponent: "Menace 2 Sobriety", home: false });
  });

  it("attaches results from every issue we have", () => {
    expect(rows[4].result?.score).toEqual({ us: 19, them: 5 });
    expect(rows[5].result?.opponentShort).toBe("Pints");
    expect(rows[3].result).toBeNull();
  });

  it("uses hand-entered scores for weeks with no newsletter", () => {
    expect(rows.slice(0, 4).map((r) => r.score)).toEqual([
      { us: 15, them: 9 }, { us: 13, them: 11 }, { us: 13, them: 11 }, { us: 15, them: 9 },
    ]);
    expect(rows[5].score).toEqual({ us: 19, them: 5 });
    expect(rows[7].score).toBeNull();
  });

  it("hand-entered points agree with the standings", () => {
    const points = rows.filter((r) => r.status === "past").reduce((a, r) => a + (r.score?.us ?? 0), 0);
    expect(points).toBe(wk07.standings.find((s) => s.team === "Area 501")?.points);
  });

  it("lets the newsletter override the schedule", () => {
    const moved = { ...wk07, nextWeek: { week: 8, home: true, opponent: "Ducks", venue: "Somewhere Else" } };
    expect(buildFixtures(moved, [moved], sched)[7]).toMatchObject({ home: true, opponent: "Brutha Ducks", venue: "Somewhere Else" });
  });

  it("works without a schedule", () => {
    expect(buildFixtures(wk07, [wk07], undefined).map((r) => [r.week, r.date])).toEqual([[7, "2026-09-23"], [8, "2026-09-30"]]);
  });
});

describe("helpers", () => {
  it("formats dates without timezone drift", () => expect(shortDate("2026-09-23")).toBe("Wed, Sep 23"));

  it("finds the opponent's standing from a short name", () => {
    expect(findStanding("Menace", wk07.standings)).toMatchObject({ rank: 2, wins: 5, losses: 1 });
  });

  it("builds maps links per platform", () => {
    expect(mapsUrl("The Flying Saucer", sched, true)).toBe("https://maps.apple.com/?q=The%20Flying%20Saucer%2C%20Raleigh%2C%20NC");
    expect(mapsUrl("Nowhere", sched, false)).toBe("https://www.google.com/maps/search/?api=1&query=Nowhere%2C%20Raleigh%2C%20NC");
    expect(mapsUrls("Snooker's 1&2", sched).google).toContain("query=Snooker's%2C%20Raleigh%2C%20NC");
    expect(isIOS({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" })).toBe(true);
    expect(isIOS({ userAgent: "Mozilla/5.0 (Linux; Android 15)" })).toBe(false);
  });

  it("sums the whole team", () => {
    const t = teamTotals(wk07.players);
    expect(t.singles.w + t.singles.l).toBe(72); // 6 matches x 12 singles games
    expect(t.gamesPlayed).toBe(144);
  });
});

describe("weeklyGames", () => {
  const rows = buildFixtures(wk07, [wk06, wk07], sched);

  it("gives the whole team every week with a score", () => {
    const weeks = weeklyGames(wk07, [wk06, wk07], rows, WHOLE_TEAM);
    expect(weeks.map((w) => w.week)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(weeks[0]).toEqual({ week: 1, won: 15, lost: 9, opponent: "Brutha Ducks" });
    expect(weeks[5]).toMatchObject({ week: 6, won: 19, lost: 5 });
  });

  it("gives a player only the weeks two consecutive issues isolate", () => {
    const weeks = weeklyGames(wk07, [wk06, wk07], rows, "Ian Lewis");
    expect(weeks.slice(0, 5).every((w) => w.won === null)).toBe(true);
    expect(weeks[5]).toEqual({ week: 6, won: 3, lost: 0 });
  });
});

describe("editorPick", () => {
  const pick = (f: string, opp: string) => {
    const p = JSON.parse(readFileSync(`data/Fa26/${f}.json`, "utf8")).prediction;
    const r = editorPick(p, TEAM, opp);
    return r && { winner: r.winner, score: r.score };
  };

  it("reads the remaining-matches line", () => {
    expect(pick("week-06", "Pints and Points")).toEqual({ winner: "Area 501", score: "16–8" });
  });

  it("finds the winner in a featured write-up's closing call", () => {
    expect(pick("week-07", "Menace 2 Sobriety")).toEqual({ winner: "Area 501", score: "14–10" });
    expect(pick("week-09", "Mulligans Mafia")).toEqual({ winner: "Area 501", score: "14–10" });
  });

  it("leaves the winner unknown when the call doesn't name a team", () => {
    // "The Ducks won't make it easy, but it still happens, 15-9."
    expect(pick("week-08", "Brutha Ducks")).toEqual({ winner: null, score: "15–9" });
  });
});

describe("form", () => {
  it("gives each week's own win % and the season so far", () => {
    const pts = form([
      { week: 1, won: 4, lost: 0 },
      { week: 2, won: 2, lost: 1 },
      { week: 3, won: null, lost: null },
      { week: 4, won: 1, lost: 3 },
      { week: 5, won: 3, lost: 0 },
    ]);
    expect(pts.map((p) => p.night)).toEqual([1, 2 / 3, null, 1 / 4, 1]);
    expect(pts.map((p) => p.season)).toEqual([1, 6 / 7, null, 7 / 11, 10 / 14]);
  });
});
