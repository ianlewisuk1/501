import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parse } from "../parser/index";
import { TEAM } from "../parser/team";
import { App, PLAYER_COLUMNS } from "./App";
import schedule from "../../data/Fa26/schedule.json";
import { CompareChart } from "./Chart";
import { buildFixtures, form, weeklyGames, WHOLE_TEAM, type SeasonSchedule } from "./model";

const wk06 = parse("fixtures/Fa26wk06.xlsx", TEAM);
const wk07 = parse("fixtures/Fa26wk07.xlsx", TEAM);

describe("rendering", () => {
  it("renders the whole page from data/", () => {
    const html = renderToStaticMarkup(<App />);
    for (const text of ["Area 501", "Menace 2 Sobriety", "Standings", "This Week&#x27;s Opponent (Week ", "Fixtures", "Players", "Performance"]) {
      expect(html).toContain(text);
    }
  });

  it("compares Russell Riley alone by default, on a nightly and a season chart", () => {
    const rows = buildFixtures(wk07, [wk06, wk07], schedule as SeasonSchedule);
    const players = wk07.players.map((p) => ({ name: p.name, pts: form(weeklyGames(wk07, [wk06, wk07], rows, p.name)) }));
    const team = form(weeklyGames(wk07, [wk06, wk07], rows, WHOLE_TEAM));
    const html = renderToStaticMarkup(<CompareChart players={players} team={team} />);
    expect(html).toContain("Win % each night");
    expect(html).toContain("Season win % so far");
    expect(html.match(/class="pline /g)).toHaveLength(2); // one line per chart
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain('aria-pressed="true" aria-label="Russell Riley"');
  });

  it("shows last, this and next week's fixtures until expanded", () => {
    const html = renderToStaticMarkup(<App />);
    const list = html.slice(html.indexOf('<ol class="fixtures">'), html.indexOf("</ol>", html.indexOf('<ol class="fixtures">')));
    expect(list.match(/<li /g)).toHaveLength(3);
    expect(list).toContain('class="current"');
    expect(html).toMatch(/Show all \d+ weeks/);
  });

  it("shows every category in the players table", () => {
    const html = renderToStaticMarkup(<App />);
    for (const label of ["Singles", "Doubles", "301", "501", "Cricket", "All-star", "Matches", "Team total"]) {
      expect(html).toContain(label);
    }
    const ian = wk07.players.find((p) => p.name === "Ian Lewis")!;
    expect(html).not.toContain("Bragging rights");
    expect(html).not.toContain("1001");
    expect(html).not.toContain("Tiebreak");
    expect(html).not.toContain("From the newsletter");
    expect(PLAYER_COLUMNS.map((c) => c.show(ian))).toEqual([
      "19–2", "90%", "11–1", "92%", "5–1", "6–0", "8–1", "89%", "3–1", "5–0", "19.5", "0.93", "21", "6",
    ]);
  });

  it("groups scouting columns as season stats, then the recent weeks on their own, all sortable", () => {
    const html = renderToStaticMarkup(<App />);
    const scout = html.slice(html.indexOf('id="scouting"'), html.indexOf("</section>", html.indexOf('id="scouting"')));
    const groups = [...scout.matchAll(/class="group">([^<]+)</g)].map((m) => m[1]);
    expect(groups).toEqual(["Season", "Last 3 wks"]);
    expect(scout.match(/<button>|<button /g)?.length).toBe(7); // player + 6 stat columns
    expect(scout).toContain('aria-sort="descending"');
  });
});

describe("folded sections", () => {
  it("starts Players and Performance folded behind big buttons, with a one-line summary", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('aria-expanded="false">Show player stats</button>');
    expect(html).toContain('aria-expanded="false">Show charts</button>');
    expect(html).toMatch(/\d+ players · team \d+–\d+/);
    expect(html).toContain('aria-expanded="false">Show leaderboard</button>');
  });
});

it("ranks the division's top 25 in a chosen category, with a button for everyone", () => {
  const html = renderToStaticMarkup(<App />);
  const board = html.slice(html.indexOf('id="division"'), html.indexOf("</section>", html.indexOf('id="division"')));
  expect(board).toContain("<option value=\"aspAvg\">All-star points per game</option>");
  const body = board.slice(board.indexOf("<tbody>"), board.indexOf("</tbody>"));
  expect(body.match(/<tr[ >]/g)).toHaveLength(25);
  expect(body).toContain('class="us"'); // our players stand out
  expect(board).toMatch(/Show all \d+ players/);
});
