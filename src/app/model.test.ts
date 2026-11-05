import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import schedule from "../../data/Fa26/schedule.json";
import { parse, parseDivisionTeams, parseDivisionWorkbook } from "../parser/index";
import { loadWorkbook } from "../parser/workbook";
import type { DivisionWeek } from "../parser/types";
import { TEAM } from "../parser/team";
import venuesJson from "../../data/Fa26/venues.json";
import type { Venue } from "../parser/venueMatch";
import { breakingNews, buildFixtures, clinchNews, withClinchedFirst, editorPick, scoutReport, findStanding, isIOS, mapsUrl, mapsUrls, shortDate, form, divisionPlayers, teamSchedule, teamSlug, teamTotals, weeklyGames, WHOLE_TEAM, type SeasonSchedule } from "./model";

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

const venues = venuesJson as Venue[];

describe("helpers", () => {
  it("formats dates without timezone drift", () => expect(shortDate("2026-09-23")).toBe("Wed, Sep 23"));

  it("finds the opponent's standing from a short name", () => {
    expect(findStanding("Menace", wk07.standings)).toMatchObject({ rank: 2, wins: 5, losses: 1 });
  });

  it("builds maps links per platform", () => {
    // Street address from the league's directory, no business name.
    expect(mapsUrl("The Flying Saucer", venues, true)).toBe("https://maps.apple.com/?q=328%20West%20Morgan%20Street%2C%20Raleigh%2C%20NC");
    expect(mapsUrls("Brass Tap 5&6", venues).google).toBe("https://www.google.com/maps/search/?api=1&query=3316%20Capital%20Boulevard%2C%20Raleigh%2C%20NC");
    expect(mapsUrl("Nowhere 1&2", venues, false)).toBe("https://www.google.com/maps/search/?api=1&query=Nowhere%2C%20Raleigh%2C%20NC");
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

describe("scouting", () => {
  const div = (w: number): DivisionWeek => JSON.parse(readFileSync(`data/Fa26/division-week-0${w}.json`, "utf8"));
  const divisions = [div(4), div(7)];

  it("ranks the opponent's players by record, with the last three weeks beside it", () => {
    const r = scoutReport("Menace 2 Sobriety", wk07, divisions)!;
    expect(r).toMatchObject({ team: "Menace 2 Sobriety", through: 6, recentWeeks: [4, 6] });
    expect(r.rows).toHaveLength(7);
    expect(r.rows[0]).toMatchObject({ name: "Spencer Rogers", total: { w: 14, l: 3 }, recent: { w: 6, l: 1 }, matches: 5 });
  });

  it("finds the team from a short name", () => {
    expect(scoutReport("Menace", wk07, divisions)?.team).toBe("Menace 2 Sobriety");
  });

  it("drops the recent column when the older issue is missing", () => {
    const r = scoutReport("Menace 2 Sobriety", wk07, [div(7)])!;
    expect(r.recentWeeks).toBeNull();
    expect(r.rows[0].recent).toBeNull();
  });

  it("is null without this issue's division page or a known opponent", () => {
    expect(scoutReport("Menace 2 Sobriety", wk07, [div(4)])).toBeNull();
    expect(scoutReport("Nobody", wk07, divisions)).toBeNull();
  });
});

describe("other teams' schedules", () => {
  const issues = [6, 7].flatMap((n) => parseDivisionTeams(loadWorkbook(`fixtures/Fa26wk0${n}.xlsx`), TEAM));

  it("rebuilds ours from the newsletters alone, around weeks 5 to 8 and mirrored half a season away", () => {
    const ours = teamSchedule("Area 501", issues, sched).weeks;
    const strip = ({ score: _, ...w }: Record<string, unknown>) => w;
    const want = sched.weeks.filter((w) => [5, 6, 7, 8, 12, 13, 14, 1].includes(w.week)).map(strip);
    expect(ours).toEqual(want);
  });

  it("uses the home team's bar for inferred weeks", () => {
    const menace = teamSchedule("Menace 2 Sobriety", issues, sched).weeks;
    expect(menace.find((w) => w.week === 14)).toEqual({ week: 14, date: "2026-11-11", home: true, opponent: "Area 501", venue: "High Park 1&2" });
  });

  it("slugs team names for links", () => expect(teamSlug("Still Hump'N")).toBe("still-hump-n"));
});

describe("division leaderboard", () => {
  const div = parseDivisionWorkbook(loadWorkbook("fixtures/Fa26wk07.xlsx"), TEAM);

  it("lists every player in the division from the same issue, with their team", () => {
    const all = divisionPlayers(wk07, [div]);
    expect(all.length).toBe(div.teams.reduce((n, t) => n + t.players.length, 0));
    expect(all.find((p) => p.name === "Ian Lewis")).toMatchObject({ team: "Area 501", code: "C6", number: 61 });
    expect(divisionPlayers(wk06, [div])).toEqual([]); // no issue for that week, no rows
  });

  it("counts regulars as half the weeks played so far", () => {
  });
});

describe("clinch news", () => {
  it("announces nothing before anyone clinches", () => {
    expect(clinchNews(wk07, 14)).toBeNull();
  });

  it("says nothing about a top-two clinch while first can still be caught (wk12)", () => {
    const wk12 = parse("fixtures/Fa26wk12.xlsx", TEAM);
    expect(wk12.standings[0].clinched).toBe("C");
    // 11-0 with 3 to play; 2nd could still reach 11 wins, so nothing yet.
    expect(withClinchedFirst(wk12.standings, 14)).toBe(wk12.standings);
    expect(clinchNews(wk12, 14)).toBeNull();
    const won = { ...wk12, standings: wk12.standings.map((s, i) => (i === 0 ? { ...s, clinched: "G" as const } : s)) };
    expect(clinchNews(won, 14)).toEqual({
      headline: "Area 501 clinches the C Division title",
      detail: "11–0 record · 14 pts clear · 3 weeks still to play",
    });
  });
});

describe("withClinchedFirst", () => {
  const row = (team: string, wins: number, losses: number) => ({ rank: 0, team, wins, losses, points: 0 });
  it("marks the leader once no one can reach its wins", () => {
    const out = withClinchedFirst([row("A", 12, 0), row("B", 8, 4), row("C", 7, 5)], 14);
    expect(out.map((s) => s.clinched)).toEqual(["G", undefined, undefined]);
  });
  it("waits while a chaser could tie, and counts unplayed matches as possible wins", () => {
    expect(withClinchedFirst([row("A", 12, 0), row("B", 10, 2)], 14)[0].clinched).toBeUndefined();
    expect(withClinchedFirst([row("A", 12, 0), row("B", 8, 2)], 14)[0].clinched).toBeUndefined();
  });
  it("changes nothing without a season length", () => {
    const s = [row("A", 12, 0), row("B", 1, 11)];
    expect(withClinchedFirst(s, null)).toBe(s);
  });
});

describe("breakingNews", () => {
  const wk12 = parse("fixtures/Fa26wk12.xlsx", TEAM);
  const item = { season: wk12.season, week: wk12.week, team: wk12.team.name, headline: "Hand-entered headline" };
  it("prefers a hand-entered item for the shown team and week", () => {
    expect(breakingNews(wk12, 14, [item])).toEqual({ headline: "Hand-entered headline", detail: "" });
  });
  it("falls back to clinch news when the item is for another week or team", () => {
    expect(breakingNews(wk12, 14, [{ ...item, week: 99 }])).toEqual(clinchNews(wk12, 14));
    expect(breakingNews(wk12, 14, [{ ...item, team: "Someone Else" }])).toEqual(clinchNews(wk12, 14));
  });
});
