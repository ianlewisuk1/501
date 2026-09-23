import { describe, expect, it } from "vitest";
import schedule from "../../data/Fa26/schedule.json";
import { parse } from "../parser/index";
import { TEAM } from "../parser/team";
import { buildFixtures, findStanding, isIOS, mapsUrl, shortDate, teamTotals, trend, WHOLE_TEAM, type SeasonSchedule } from "./model";

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
    expect(isIOS({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" })).toBe(true);
    expect(isIOS({ userAgent: "Mozilla/5.0 (Linux; Android 15)" })).toBe(false);
  });

  it("sums the whole team", () => {
    const t = teamTotals(wk07.players);
    expect(t.singles.w + t.singles.l).toBe(72); // 6 matches x 12 singles games
    expect(t.gamesPlayed).toBe(144);
  });
});

describe("trend", () => {
  it("has one point per issue and the W-L between them", () => {
    const { points, weekly } = trend([wk07, wk06], "Fa26", "Ian Lewis");
    expect(points.map((p) => p.throughWeek)).toEqual([5, 6]);
    expect(points[1].total).toBeCloseTo(19 / 21);
    expect(weekly).toEqual([{ label: "Wk 6", record: { w: 3, l: 0 } }]);
  });

  it("covers the whole team", () => {
    const { weekly } = trend([wk06, wk07], "Fa26", WHOLE_TEAM);
    expect(weekly[0].record.w + weekly[0].record.l).toBe(24);
  });
});
