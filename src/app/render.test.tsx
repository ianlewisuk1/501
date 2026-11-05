import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { parse } from "../parser/index";
import { TEAM } from "../parser/team";
import { ClinchBadge, PLAYER_COLUMNS, Screen } from "./App";
import schedule from "../../data/Fa26/schedule.json";
import { CompareChart } from "./Chart";
import { buildFixtures, form, todayIso, weeklyGames, WHOLE_TEAM, type SeasonSchedule } from "./model";
import { divisionRounds } from "./league";
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

  it("lands on a chalk dartboard: one segment per division, each a link to it", () => {
    const html = at("/");
    expect(html).toContain('aria-label="Raleigh Dart League"');
    expect(html).toContain('class="board-logo"');
    expect(html).toMatch(/Fall 2026, week \d+ of 14/);
    // Key dates sit at the bottom of the lander, while any are still ahead.
    const ahead = (schedule as SeasonSchedule).keyDates.some((d) => d.date >= todayIso());
    expect(html.includes("Coming up")).toBe(ahead);
    expect(html).toContain("Throw for your division");
    expect(html.match(/class="seg[ "]/g)).toHaveLength(8);
    expect(html).toContain('class="seg" aria-label="C Division, 8 teams" href="/c"');
    expect(html).toContain("Know your team&#x27;s name?");
    // When the data last changed, under the season line.
    expect(html).toMatch(/Last updated \w{3}, \w{3} \d+/);
    // The lander is its own banner: no site bar.
    expect(html).not.toContain('class="site-bar"');
    // Nothing typed yet, so no team list; no returning visitor, so no shortcut.
    expect(html).not.toContain('class="team-list"');
    expect(html).not.toContain("Your team");
  });

  it("gives a returning visitor their team, with this week's match, on a clean board", () => {
    const html = renderToStaticMarkup(<Screen data={data} route={{ page: "home" }} myTeam={{ division: "C", team: "Area 501" }} />);
    const mine = html.slice(html.indexOf('class="your-team"'), html.indexOf('class="aim"'));
    expect(mine).toContain('href="/c/area-501"');
    expect(mine).toMatch(/This week: (home to|away at) Pints and Points/);
    expect(html).toContain('class="seg" aria-label="C Division, 8 teams"'); // nothing chalked in from last time
  });

  it("adds a quieter link to the team looked at last, unless it is the picked team", () => {
    const home = (myTeam: { division: string; team: string } | null, lastTeam: { division: string; team: string } | null) =>
      renderToStaticMarkup(<Screen data={data} route={{ page: "home" }} myTeam={myTeam} lastTeam={lastTeam} />);
    const area = { division: "C", team: "Area 501" };
    const menace = { division: "C", team: "Menace 2 Sobriety" };
    // Only looked around, never picked: no "Your team", just the link.
    let html = home(null, menace);
    expect(html).not.toContain("Your team");
    expect(html).toContain('Last looked at <a href="/c/menace-2-sobriety">Menace 2 Sobriety</a>');
    // Picked Area 501, then looked at Menace: both.
    html = home(area, menace);
    expect(html).toContain("Your team");
    expect(html).toContain("Last looked at");
    // Last looked at their own team: no second link to the same place.
    expect(home(area, area)).not.toContain("Last looked at");
    // A team no longer in the standings is dropped.
    expect(home(null, { division: "C", team: "Gone Team" })).not.toContain("Last looked at");
  });

  it("lets a team page be picked as my team", () => {
    expect(at("/c/menace-2-sobriety")).toContain('<button type="button" class="my-team-pick">');
    expect(at("/c/menace-2-sobriety")).toContain("This is my team");
  });

  it("puts the same black site bar and page heading on division and team pages", () => {
    const div = at("/c");
    const team = at("/c/area-501");
    for (const html of [div, team]) {
      expect(html).toContain('class="site-bar"');
      expect(html).toContain('<a class="site-home" href="/">');
      expect(html).toContain('<header class="page-head');
    }
    expect(div).toContain('aria-current="page" href="/c">C Division</a>');
    expect(team).toContain('aria-current="page" href="/c/area-501">Area 501</a>');
    expect(team).toContain('<header class="page-head team-head">');
  });

  it("puts a division in tabs: standings, matches and leaderboard", () => {
    const html = at("/g");
    expect(html).toContain("G Division");
    for (const id of ["standings", "matches", "division"]) expect(html).toContain(`id="${id}"`);
    expect(section(html, "matches")).toContain('<span class="card-status">Bye</span>');
    const tabs = html.slice(html.indexOf('role="tablist"'), html.indexOf("</div>", html.indexOf('role="tablist"')));
    expect([...tabs.matchAll(/role="tab"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(["Standings", "Matches", "Leaderboard"]);
    expect(html).toContain('id="tab-standings" role="tab" aria-selected="true"'); // opens on the standings
    expect(html).not.toContain("Show leaderboard"); // the tab is the fold
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
      // Titles live on in the tabs and, for screen readers, in hidden headings.
      expect(html).toContain(text);
    }
    expect(html).not.toContain("Editor&#x27;s pick"); // no predictions anywhere
    expect(html).not.toContain("Ian&#x27;s pick");
    expect(html).not.toContain("Key dates");
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

  it("lists every week of the season in the Fixtures tab, this week highlighted", () => {
    const html = at("/c/area-501");
    const list = html.slice(html.indexOf('<ol class="fixtures">'), html.indexOf("</ol>", html.indexOf('<ol class="fixtures">')));
    expect(list.match(/<li /g)).toHaveLength(14);
    expect(list).toContain('class="current"');
    expect(html).not.toMatch(/Show all \d+ weeks/);
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

  it("puts the sections in tabs under tonight's match, the opponent open first", () => {
    const html = at("/c/area-501");
    const tabs = [...html.matchAll(/role="tab" aria-selected="(true|false)"[^>]*>([^<]+)</g)].map((m) => [m[2], m[1]]);
    expect(tabs).toEqual([["Opponent", "true"], ["Standings", "false"], ["Fixtures", "false"], ["Players", "false"], ["Form", "false"]]);
    expect(html).toMatch(/id="panel-opponent" role="tabpanel"[^>]*class="tab-panel"/);
    expect(html).toMatch(/id="panel-players" role="tabpanel"[^>]*hidden=""/);
    // Inside a tab, sections open flat: no fold buttons.
    expect(html).not.toContain("Show player stats");
    expect(html).not.toContain("Show charts");
    expect(html).toContain("Team total"); // the players table is there, unfolded
    // No title repeated inside a tab; details like the gap to 2nd stay as a line.
    expect(html).toContain('<h2 id="fixtures" class="sr-only">Fixtures</h2>');
    expect(html).toMatch(/<p class="tab-note">\d+ pts clear of 2nd<\/p>/);
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

it("filters the leaderboard by games played: all, more than 5, more than 20", () => {
  const board = section(at("/c"), "division");
  expect(board).toContain('aria-pressed="false">All players</button>');
  expect(board).toContain('aria-pressed="false">More than 5 games</button>');
  expect(board).toContain('aria-pressed="true">More than 20 games</button>'); // late season: enough regulars
  expect(board).not.toContain("6+ matches");
});

it("writes each team's place in the standings small in front of its name, with a chalk crest", () => {
  const matches = section(at("/c"), "matches");
  expect(matches).toContain('<span class="rank-tag" title="1st in the standings">1</span><span class="card-name"><span class="side-name">Area 501</span><span class="card-rec">12–0</span>');
  expect(matches).toContain('aria-hidden="true">PP</span>'); // Pints and Points' chalk crest
});

describe("matches, every week", () => {
  it("covers the whole season: played weeks with scores, the rest as fixtures", () => {
    const rounds = divisionRounds(data, "C");
    const last = data.issues.at(-1)!.week;
    expect(rounds.map((r) => r.week)).toEqual(Array.from({ length: last + 1 }, (_, i) => i + 1));
    expect(rounds.filter((r) => r.played).map((r) => r.week)).toEqual(Array.from({ length: last - 1 }, (_, i) => i + 1));
    // C has 8 teams: four matches a week, no byes.
    for (const r of rounds) expect(r.matches).toHaveLength(4);
    // Dates come from the season schedule: Wednesdays, a week apart.
    expect(rounds[0].date).toBe("2026-08-12");
    expect(rounds.at(-1)!.date).toBe("2026-11-11");
  });

  it("opens on this week, with a week picker either side", () => {
    const html = section(at("/c"), "matches");
    const week = data.issues.at(-1)!.week;
    expect(html).toContain('aria-label="Previous week"');
    expect(html).toContain('aria-label="Next week"');
    expect(html).toMatch(new RegExp(`<option value="${week}" selected="">Week ${week} \\(this week\\)</option>`));
    expect(html.match(/<option /g)).toHaveLength(week + 1);
    expect(html).toContain(": this week&#x27;s matches");
  });
});
