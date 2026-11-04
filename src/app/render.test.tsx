import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { parse } from "../parser/index";
import { TEAM } from "../parser/team";
import { ClinchBadge, PLAYER_COLUMNS, Screen } from "./App";
import schedule from "../../data/Fa26/schedule.json";
import { CompareChart } from "./Chart";
import { buildFixtures, form, weeklyGames, WHOLE_TEAM, type SeasonSchedule } from "./model";
import { parseRoute } from "./route";
import { loadSeason, type SeasonData } from "./store";

const wk06 = parse("fixtures/Fa26wk06.xlsx", TEAM);
const wk07 = parse("fixtures/Fa26wk07.xlsx", TEAM);

let data: SeasonData;
beforeAll(async () => { data = (await loadSeason())!; });
const at = (path: string) => renderToStaticMarkup(<Screen data={data} route={parseRoute(path)} />);
const section = (html: string, id: string) => html.slice(html.indexOf(`id="${id}"`), html.indexOf("</section>", html.indexOf(`id="${id}"`)));

describe("routes", () => {
  it("parses league, division and team paths, and old ?team= links", () => {
    expect(parseRoute("/")).toEqual({ page: "home" });
    expect(parseRoute("/c")).toEqual({ page: "division", division: "C" });
    expect(parseRoute("/c/area-501/")).toEqual({ page: "team", division: "C", team: "area-501" });
    expect(parseRoute("/", "?team=menace-2-sobriety")).toEqual({ page: "team", division: "C", team: "menace-2-sobriety" });
  });

  it("lands on a cricket board: 1st | division | 2nd, A to H down the middle", () => {
    const html = at("/");
    expect(html).toContain('aria-label="Raleigh Dart League"');
    expect(html).toContain('class="board-logo"');
    expect(html).toMatch(/Fall 2026, week \d+ of 14/);
    expect(html.match(/class="cricket-row"/g)).toHaveLength(8);
    expect(html).toContain(">Division</span>");
    expect(html).toMatch(/Area 501<span class="mark" title="Clinched"> ⊗<\/span>/);
  });

  it("puts your team against this week's opponent on the vs line", () => {
    const html = renderToStaticMarkup(<Screen data={data} route={{ page: "home" }} myTeam={{ division: "C", team: "Area 501" }} />);
    const vs = html.slice(html.indexOf('class="vs-line"'), html.indexOf("</p>", html.indexOf('class="vs-line"')));
    expect(vs).toContain(">Area 501</a>");
    expect(vs).toContain(">vs</span>");
    expect(vs).toContain(">Pints and Points</a>");
  });

  it("shows a division's standings, matches, results and leaderboard", () => {
    const html = at("/g");
    expect(html).toContain("G Division");
    for (const id of ["standings", "matches", "results", "division"]) expect(html).toContain(`id="${id}"`);
    expect(section(html, "matches")).toContain("bye");
    expect(html).toContain('aria-expanded="false">Show leaderboard</button>');
  });

  it("renders any team in the league", () => {
    const html = at("/h/calm-under-pressure");
    expect(html).toContain("Calm Under Pressure");
    expect(html).toContain("H Division, week");
    expect(html).toContain('id="fixtures"');
  });

  it("says so for an unknown page", () => {
    expect(at("/c/nobody")).toContain("Page not found");
    expect(at("/z")).toContain("Page not found");
  });
});

describe("team page", () => {
  it("renders the whole page from data/", () => {
    const html = at("/c/area-501");
    for (const text of ["Area 501", "Menace 2 Sobriety", "Standings", "This Week&#x27;s Opponent (Week ", "Fixtures", "Players", "Performance"]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain("Editor&#x27;s pick"); // no predictions anywhere
    expect(html).not.toContain("Ian&#x27;s pick");
  });

  it("badges clinched teams in the standings, but not bottom-two clinches", () => {
    expect(renderToStaticMarkup(<ClinchBadge mark="C" />)).toContain(">Clinched<");
    expect(renderToStaticMarkup(<ClinchBadge mark="G" />)).toContain(">Champion<");
    expect(renderToStaticMarkup(<ClinchBadge mark="D" />)).toBe("");
    expect(renderToStaticMarkup(<ClinchBadge mark={undefined} />)).toBe("");
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
    const html = at("/c/area-501");
    const list = html.slice(html.indexOf('<ol class="fixtures">'), html.indexOf("</ol>", html.indexOf('<ol class="fixtures">')));
    expect(list.match(/<li /g)).toHaveLength(3);
    expect(list).toContain('class="current"');
    expect(html).toMatch(/Show all \d+ weeks/);
  });

  it("shows every category in the players table", () => {
    const html = at("/c/area-501");
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
    const scout = section(at("/c/area-501"), "scouting");
    const groups = [...scout.matchAll(/class="group">([^<]+)</g)].map((m) => m[1]);
    expect(groups).toEqual(["Season", "Last 3 wks"]);
    expect(scout.match(/<button>|<button /g)?.length).toBe(7); // player + 6 stat columns
    expect(scout).toContain('aria-sort="descending"');
  });

  it("starts Players and Performance folded behind big buttons, with a one-line summary", () => {
    const html = at("/c/area-501");
    expect(html).toContain('aria-expanded="false">Show player stats</button>');
    expect(html).toContain('aria-expanded="false">Show charts</button>');
    expect(html).toMatch(/\d+ players. The team is \d+–\d+ in games/);
    expect(html).toContain('href="/c">All of C Division: results, matches and the player leaderboard</a>');
  });
});

it("ranks the division's top 25 in a chosen category, with a button for everyone", () => {
  const board = section(at("/c"), "division");
  expect(board).toContain("<option value=\"aspAvg\">All-star points per game</option>");
  const body = board.slice(board.indexOf("<tbody>"), board.indexOf("</tbody>"));
  expect(body.match(/<tr[ >]/g)).toHaveLength(25);
  expect(board).toMatch(/Show all \d+ players/);
});
