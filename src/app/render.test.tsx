import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parse } from "../parser/index";
import { TEAM } from "../parser/team";
import { App, PLAYER_COLUMNS } from "./App";
import schedule from "../../data/Fa26/schedule.json";
import { CompareChart, WeeklyChart } from "./Chart";
import { buildFixtures, form, weeklyGames, WHOLE_TEAM, type SeasonSchedule } from "./model";

const wk06 = parse("fixtures/Fa26wk06.xlsx", TEAM);
const wk07 = parse("fixtures/Fa26wk07.xlsx", TEAM);

describe("rendering", () => {
  it("renders the whole page from data/", () => {
    const html = renderToStaticMarkup(<App />);
    for (const text of ["Area 501", "Menace 2 Sobriety", "Standings", "Fixtures", "Players", "Performance"]) {
      expect(html).toContain(text);
    }
  });

  it("renders the week-by-week chart", () => {
    const rows = buildFixtures(wk07, [wk06, wk07], schedule as SeasonSchedule);
    const html = renderToStaticMarkup(<WeeklyChart weeks={weeklyGames(wk07, [wk06, wk07], rows, WHOLE_TEAM)} />);
    expect(html).toContain("That week");
    expect(html).not.toContain("3-week");
    expect(html).not.toContain("Games"); // every match is 24 games, so the row says nothing
    expect(html).toContain("Week 6: that week 79%, season 65%");
  });

  it("compares the three players in best form by default", () => {
    const rows = buildFixtures(wk07, [wk06, wk07], schedule as SeasonSchedule);
    const players = wk07.players.map((p) => ({ name: p.name, pts: form(weeklyGames(wk07, [wk06, wk07], rows, p.name)) }));
    const team = form(weeklyGames(wk07, [wk06, wk07], rows, WHOLE_TEAM));
    const html = renderToStaticMarkup(<CompareChart players={players} team={team} />);
    expect(html.match(/class="pline /g)).toHaveLength(3);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(3);
    expect(html).toContain("Ian Lewis");
  });

  it("shows every category in the players table", () => {
    const html = renderToStaticMarkup(<App />);
    for (const label of ["Singles", "Doubles", "301", "501", "Cricket", "1001", "All-star", "Matches", "Team total"]) {
      expect(html).toContain(label);
    }
    const ian = wk07.players.find((p) => p.name === "Ian Lewis")!;
    expect(html).not.toContain("Bragging rights");
    expect(html).not.toContain("From the newsletter");
    expect(PLAYER_COLUMNS.map((c) => c.show(ian))).toEqual([
      "19–2", "90%", "11–1", "92%", "5–1", "6–0", "8–1", "89%", "3–1", "5–0", "0–0", "19.5", "0.93", "21", "6",
    ]);
  });
});
