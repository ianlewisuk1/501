import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "../parser/index";
import { TEAM } from "../parser/team";
import { ClinchBadge, PLAYER_COLUMNS, Screen } from "./App";
import schedule from "../../data/Fa26/schedule.json";
import { todayIso, type SeasonSchedule } from "./model";
import { divisionBest, playerLine, teamLine, verdict } from "./form";
import { divisionIn, divisionRounds, divisionWeeks } from "./league";
import { parseRoute } from "./route";
import { SHORT_NAMES } from "./ui";
import { topPlayers } from "./TeamInfo";
import type { TeamWeek } from "../parser/types";
import tournament from "../../data/Fa26/league-week-15.json";
import { loadSeason, type SeasonData } from "./store";

const wk07 = parse("fixtures/Fa26wk07.xlsx", TEAM);

// Most tests read the newest regular-season issue; the tournament issue (week 15) has its own block below.
let full: SeasonData;
let data: SeasonData;
/** The season as it stood before any tournament result was entered in bracket.json (seeds kept). */
const noResults = (d: SeasonData): SeasonData => ({
  ...d,
  bracket: d.bracket && {
    ...d.bracket,
    divisions: Object.fromEntries(Object.entries(d.bracket.divisions).map(([k, { seeds, venues }]) => [k, { seeds, venues }])),
  },
});
beforeAll(async () => {
  full = (await loadSeason())!;
  const weeks = full.schedule?.weeks.length ?? Infinity;
  // The regular season's view: no tournament results yet.
  data = noResults({ ...full, issues: full.issues.filter((i) => i.week <= weeks) });
});
// Pages follow the calendar, so pin "today" to the newest issue's match day (morning, local time):
// otherwise the tests change once that night has passed, sooner on a UTC build server.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${data.issues.at(-1)!.issueDate}T09:00:00`));
});
afterEach(() => { vi.useRealTimers(); });
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
    // How to add RDL to a phone, for everyone, after the key dates: iPhone and Android side by side.
    expect(html).toContain("Add RDL to your phone");
    expect(html.indexOf("Add RDL to your phone")).toBeGreaterThan(html.indexOf("Coming up"));
    expect(html).toMatch(/<th scope="col">iPhone<\/th><th scope="col">Android<\/th>/);
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
    // Says what the box is, and names the next match: this issue's, or the week after once that night has passed.
    expect(mine).toContain("Your team</span>");
    expect(mine).toContain("Change it on any team&#x27;s page.");
    expect(mine).toMatch(/Next: \w{3} \d+<\/span><span class=\"your-team-what\">(Home to|Away at) <a[^>]*>(Pints and Points|Menace 2 Sobriety)<\/a>/);
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

  it("lets a team page be picked as my team, and steps through the division's teams with arrows", () => {
    const html = at("/c/darty-little-secrets");
    expect(html).toContain('class="my-team-btn" aria-pressed="false"');
    expect(html).toContain("This is my team");
    // Standings order, wrapping: the Secrets are 2nd, so Area 501 (1st) before and Menace 2 Sobriety (3rd) after.
    expect(html).toContain('aria-label="Previous team: Area 501" href="/c/area-501"');
    expect(html).toContain('aria-label="Next team: Menace 2 Sobriety" href="/c/menace-2-sobriety"');
    expect(html).not.toContain("Show another team in the division"); // the team dropdown is gone
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

  it("puts a division in tabs: standings, matches, players and records", () => {
    const html = at("/g");
    expect(html).toContain("G Division");
    for (const id of ["standings", "matches", "division"]) expect(html).toContain(`id="${id}"`);
    expect(section(html, "matches")).toContain('<span class="card-status">Bye</span>');
    const tabs = html.slice(html.indexOf('role="tablist"'), html.indexOf("</div>", html.indexOf('role="tablist"')));
    expect([...tabs.matchAll(/role="tab"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(["Standings", "Matches", "Players", "Records", "Bracket"]);
    expect(html).toContain('id="tab-standings" role="tab" aria-selected="true"'); // opens on the standings
    expect(html).not.toContain("Show leaderboard"); // the tab is the fold
    // Arrows to the divisions either side, instead of a dropdown.
    expect(html).toContain('aria-label="Previous: F Division" href="/f"');
    expect(html).toContain('aria-label="Next: H Division" href="/h"');
  });

  it("opens a division on its tournament bracket once the regular season is over", () => {
    vi.setSystemTime(new Date("2026-11-16T09:00:00"));
    try {
      const html = at("/c");
      expect(html).toContain('id="tab-bracket" role="tab" aria-selected="true"');
      const bracket = section(html, "bracket");
      expect(bracket).toContain("Quarterfinals");
      expect(bracket).toContain("Upper Deck 1&amp;2");
      expect(bracket).toContain("Seed 1 or 8");
      // Full names first; the page swaps in page 2's short name only when one won't fit its box.
      expect(bracket).toMatch(/class="b-name"[^>]*>Menace 2 Sobriety</);
      // Every hand-picked bracket name belongs to a real team.
      const teams = new Set(tournament.divisions.flatMap((d) => d.standings.map((t) => t.team)));
      for (const name of Object.keys(SHORT_NAMES)) expect(teams).toContain(name);
      expect(bracket).not.toContain("bracket-key");
    } finally {
      vi.setSystemTime(new Date(`${data.issues.at(-1)!.issueDate}T09:00:00`));
    }
  });

  it("writes a division's standings up as a chalk ladder, leader ringed, and lists its records", () => {
    const html = at("/c");
    const ladder = html.slice(html.indexOf('class="ladder"'), html.indexOf("</ol>", html.indexOf('class="ladder"')));
    expect(ladder.match(/<li/g)).toHaveLength(8);
    expect(ladder).toMatch(/<li class="ladder-top"><a href="\/c\/area-501">/);
    expect(ladder).toContain('aria-label="13 wins, 0 losses">13–0<');
    expect(ladder).not.toContain("points clear");
    // Says the rows can be tapped.
    expect(html).toContain('<p class="tab-note">Through week 13 of 14</p>');
    // The last issue's title race sits under the ladder, before the headlines.
    if (data.issues.at(-1)!.divisions.find((x) => x.division === "C")!.titleRace) {
      expect(html).toContain('<p class="headlines-label">Title race <span>going into week 14</span></p><p><a class="team-mention" title="Area 501"');
      expect(html.indexOf("Title race")).toBeLessThan(html.indexOf("Kilt&#x27;s headlines"));
      expect(section(html, "matches")).not.toContain("Title race"); // once, under the ladder only
    }
    // The arrows wrap round: before A comes H.
    expect(at("/a")).toContain('aria-label="Previous: H Division" href="/h"');
    const rec = html.slice(html.indexOf('id="panel-records"'));
    expect(rec).toContain("Fast singles 301");
    expect(rec).toMatch(/<span class="rec-val">9 darts<\/span>.*?Ian Lewis<\/span> <span class="rec-team-date"><span class="rec-team"[^>]*>Area 501<\/span><span class="rec-date">, Aug 12/);
    expect(rec).toContain("Perfect throws");
    // Hot darts lead, ringed, with last week's number; one line per feat with everyone who threw it.
    expect(rec.indexOf("rec-hot-board")).toBeLessThan(rec.indexOf("Trophy darts"));
    expect(rec).toMatch(/Hot darts<span class="rec-hot-week">week \d+<\/span>/);
    const feats = [...rec.matchAll(/class="rec-feat">([^<]+)</g)].map((m) => m[1]);
    expect(new Set(feats).size).toBe(feats.length);
    // Each kind of perfect throw is counted in tally marks.
    expect(rec).toMatch(/class="rec-kind"><span>9-Marks<\/span><span class="tally" role="img" aria-label="\d+ this season">/);
  });

  it("renders any team in the league", () => {
    const html = at("/h/calm-under-pressure");
    expect(html).toContain("Calm Under Pressure");
    expect(html).toMatch(/<p class="meta">\d+(st|nd|rd|th) in H Division<\/p>/);
    // The league's match night sits under a division's title, not on team pages.
    expect(html).not.toContain("week-pill");
    expect(at("/h")).toMatch(/<p class="week-pill">Week 1[34] of 14/);
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
    for (const text of ["Area 501", "Menace 2 Sobriety", "This Week&#x27;s Opponent (Week ", "Fixtures", "Players", "All games"]) {
      // Titles live on in the tabs and, for screen readers, in hidden headings.
      expect(html).toContain(text);
    }
    expect(html).not.toContain("Editor&#x27;s pick"); // no predictions anywhere
    expect(html).not.toContain("Ian&#x27;s pick");
    expect(html).not.toContain("Key dates");
  });

  it("badges only a team sure to finish first, not top-two or bottom-two clinches", () => {
    expect(renderToStaticMarkup(<ClinchBadge mark="G" />)).toContain(">Clinched<");
    expect(renderToStaticMarkup(<ClinchBadge mark="G" final />)).toContain(">Season champs<");
    expect(renderToStaticMarkup(<ClinchBadge mark="C" final />)).toBe("");
    expect(renderToStaticMarkup(<ClinchBadge mark="C" />)).toBe("");
    expect(renderToStaticMarkup(<ClinchBadge mark="D" />)).toBe("");
    expect(renderToStaticMarkup(<ClinchBadge mark={undefined} />)).toBe("");
  });

  it("charts a player's season-so-far win % in one game, week by week", () => {
    const divs = divisionWeeks(data, "C");
    const latest = data.issues.at(-1)!;
    const ian = divisionIn(latest, "C")!.teams.flatMap((t) => t.players).find((p) => p.name === "Ian Lewis")!;
    const line = playerLine(divs, "Fa26", ian.number, "singles301");
    // One point per issue after week 1, each at the week its stats run through.
    expect(line.map((p) => p.week)).toEqual(Array.from({ length: latest.week - 1 }, (_, i) => i + 1));
    expect(line.at(-1)!.wl).toEqual(ian.singles301);
    // The season record only ever grows.
    for (let i = 1; i < line.length; i++) if (line[i].wl && line[i - 1].wl) expect(line[i].wl!.w + line[i].wl!.l).toBeGreaterThanOrEqual(line[i - 1].wl!.w + line[i - 1].wl!.l);
    // The team line adds up every player.
    const area = divisionIn(latest, "C")!.teams.find((t) => t.name === "Area 501")!;
    const total = area.players.reduce((a, p) => ({ w: a.w + p.total.w, l: a.l + p.total.l }), { w: 0, l: 0 });
    expect(teamLine(divs, "Fa26", area.code, "total").at(-1)!.wl).toEqual(total);
    // The division's best is a regular, not a sub with two games.
    const best = divisionBest(divs, "Fa26", "singlesCricket")!;
    expect(best.singlesCricket.w + best.singlesCricket.l).toBeGreaterThanOrEqual(6);
  });

  it("says hot, cold or steady only on enough recent games, against everything before", () => {
    const pts = (rows: [number, number][]) => rows.map(([w, l], i) => ({ week: i + 1, wl: { w, l }, pct: w + l ? w / (w + l) : null }));
    // 3–3 through week 3, then 4 straight wins: hot.
    expect(verdict(pts([[1, 1], [2, 2], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3]])).kind).toBe("hot");
    // 6–0, then 0–3: cold.
    expect(verdict(pts([[2, 0], [4, 0], [6, 0], [6, 1], [6, 2], [6, 3]])).kind).toBe("cold");
    // Only 2 recent games: too few to call.
    expect(verdict(pts([[1, 0], [2, 0], [3, 0], [3, 0], [4, 0], [4, 1]])).kind).toBe("few");
  });

  it("opens the Form tab on one player and all games, with the team average on", () => {
    const html = at("/c/area-501");
    const panel = html.slice(html.indexOf('id="panel-form"'));
    expect(panel).toContain('aria-pressed="true">All games</button>');
    // The player is picked from a dropdown, like "Compare with", with the whole team as the last choice.
    expect(panel).toContain('class="form-compare form-who"');
    expect(panel).toContain('<option value="-1">Whole team</option>');
    expect(panel).not.toContain('class="form-pick"');
    expect(panel).toMatch(/class="form-verdict (hot|cold|steady|few)"/);
    expect(panel).toContain('class="ref-team" aria-pressed="true"');
    expect(panel).toContain('class="ref-best" aria-pressed="false"');
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

  it("ranks a team's top players with tied records sharing a place, and keeps a tie for 3rd", () => {
    const p = (name: string, w: number, l: number) => ({ name, singles301: { w, l } }) as unknown as TeamWeek["players"][number];
    const top = topPlayers([p("A", 9, 1), p("B", 7, 1), p("C", 7, 1), p("D", 6, 2), p("E", 6, 2), p("F", 5, 3)], "singles301");
    expect(top.map((t) => `${t.rank} ${t.name}`)).toEqual(["1 A", "2 B", "2 C"]);
    const tie3 = topPlayers([p("A", 9, 1), p("B", 8, 2), p("C", 7, 3), p("D", 7, 3), p("E", 6, 4)], "singles301");
    expect(tie3.map((t) => `${t.rank} ${t.name}`)).toEqual(["1 A", "2 B", "3 C", "3 D"]);
  });

  it("has an Info tab: home bar with map links, the season so far, and the team's records", () => {
    const html = at("/c/area-501");
    const panel = html.slice(html.indexOf('id="panel-info"'), html.indexOf("</main>"));
    expect(panel).toContain("Home Bar");
    expect(panel).toContain('class="ti-bar-name"');
    expect(panel).toContain("Map (Apple)");
    expect(panel).toMatch(/1st in C, 1[34]–0/);
    // Top players in each game, not the records lists.
    expect(panel).toContain("Top Players");
    expect(panel).toContain("Singles Cricket");
    expect(panel).toContain("All-Star Points Per Game");
    expect(panel).toContain("Singles 301");
    expect(panel).not.toContain("Hot darts");
  });

  it("puts the sections in tabs under tonight's match, the players open first", () => {
    const html = at("/c/area-501");
    const tabs = [...html.matchAll(/role="tab" aria-selected="(true|false)"[^>]*>([^<]+)</g)].map((m) => [m[2], m[1]]);
    // No Standings tab: the division page has the same table, a tap away in the site bar.
    expect(tabs).toEqual([["Players", "true"], ["Form", "false"], ["Opponent", "false"], ["Fixtures", "false"], ["Info", "false"]]);
    expect(html).toMatch(/id="panel-players" role="tabpanel"[^>]*class="tab-panel"/);
    expect(html).toMatch(/id="panel-opponent" role="tabpanel"[^>]*hidden=""/);
    // Inside a tab, sections open flat: no fold buttons.
    expect(html).not.toContain("Show player stats");
    expect(html).not.toContain("Show charts");
    expect(html).toContain("Team total"); // the players table is there, unfolded
    // No title repeated inside a tab; details like the gap to 2nd stay as a line.
    expect(html).toContain('<h2 id="fixtures" class="sr-only">Fixtures</h2>');
    expect(html).toContain('href="/c"'); // the division (and its standings) from the site bar
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

it("writes each team's place in the standings small in front of its name, with no monogram crest", () => {
  const matches = section(at("/c"), "matches");
  expect(matches).toContain('<span class="rank-tag" title="1st in the standings">1</span><span class="card-name"><span class="card-line"><span class="side-name">Area 501</span></span><span class="card-rec">13–0</span>');
  expect(matches).not.toContain('class="crest"');
});

describe("matches, every week", () => {
  it("covers the whole season: played weeks with scores, the rest as fixtures", () => {
    const rounds = divisionRounds(data, "C");
    const last = data.issues.at(-1)!.week;
    // Through next week's fixtures, or to the end of the 14-week season.
    expect(rounds.map((r) => r.week)).toEqual(Array.from({ length: Math.min(last + 1, 14) }, (_, i) => i + 1));
    expect(rounds.filter((r) => r.played).map((r) => r.week)).toEqual(Array.from({ length: last - 1 }, (_, i) => i + 1));
    // C has 8 teams: four matches a week, no byes.
    for (const r of rounds) expect(r.matches).toHaveLength(4);
    // Dates come from the season schedule: Wednesdays, a week apart.
    expect(rounds[0].date).toBe("2026-08-12");
    expect(rounds.at(-1)!.date).toBe("2026-11-11");
  });

  it("opens on the next match night still to come, with a week picker either side", () => {
    const html = section(at("/c"), "matches");
    const rounds = divisionRounds(data, "C");
    // The week just played shows no scores until the next newsletter, so the tab looks ahead.
    const start = rounds.find((r) => !r.played && r.date >= todayIso())?.week ?? data.issues.at(-1)!.week;
    expect(html).toContain('aria-label="Previous week"');
    expect(html).toContain('aria-label="Next week"');
    expect(html).toMatch(new RegExp(`<option value="${start}" selected="">Week ${start} \\(next\\)</option>`));
    expect(html.match(/<option /g)).toHaveLength(rounds.length);
    expect(html).toContain(": next match night");
  });

});

describe("the team page's match card follows the calendar, not the newsletter", () => {
  afterEach(() => { vi.useRealTimers(); });
  const card = (iso: string) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${iso}T09:00:00`));
    const html = at("/c/area-501");
    return html.slice(html.indexOf('aria-labelledby="tonight"'), html.indexOf("</section>", html.indexOf('aria-labelledby="tonight"')));
  };

  it("shows next week's match the morning after match night", () => {
    const latest = data.issues.at(-1)!;
    if (latest.week >= 14) return; // only meaningful while week 14 is still to come
    const day = new Date(`${latest.issueDate}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + 1);
    const html = card(day.toISOString().slice(0, 10));
    expect(html).toContain("Next match");
    expect(html).not.toContain("This week");
  });

  it("points at the team's first tournament match after the last night of the season", () => {
    const html = card("2026-11-12");
    // The bracket is printed from week 13, so the card names the quarterfinal and its bar.
    expect(html).toContain("Next match");
    expect(html).toContain("Quarterfinal, seed 1 v 8, 7:00 pm");
    expect(html).toContain("Wed, Nov 18");
  });

  it("falls back to the tournament night when the bracket hasn't placed the team", () => {
    const bare = { ...data, issues: data.issues.map((i) => ({ ...i, divisions: i.divisions.map(({ bracket: _, ...d }) => d) })) };
    vi.setSystemTime(new Date("2026-11-12T09:00:00"));
    const html = renderToStaticMarkup(<Screen data={bare} route={parseRoute("/c/area-501")} />);
    expect(html).toContain("Next up");
    expect(html).toContain("Division tournaments (night 1)");
  });
});

describe("from the newsletter itself", () => {
  it("puts the editor's headlines for the week just played under the standings, one story a line", () => {
    const html = at("/c");
    const standings = html.slice(html.indexOf('id="panel-standings"'), html.indexOf('id="panel-matches"'));
    const latest = data.issues.at(-1)!;
    const text = divisionIn(latest, "C")!.headline!;
    expect(standings).toContain(`Kilt&#x27;s headlines <span>week ${latest.week - 1}</span>`);
    const first = text.split(/;\s+/)[0];
    const plain = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");
    expect(plain(standings)).toContain(first[0].toUpperCase() + first.slice(1));
    // The teams he names link to their pages, in his words, with the full name in the title.
    expect(standings).toMatch(/<li><a class="team-mention" title="Area 501" style="color:var\(--c\d\)" href="\/c\/area-501">Area<\/a> keeps their streak alive/);
  });

  it("keeps Kilt's headlines off the Matches tab, but keeps his picks", () => {
    const matches = section(at("/c"), "matches");
    expect(matches).not.toContain("Kilt&#x27;s headlines");
    expect(matches).toContain("Kilt&#x27;s pick");
  });

  it("links to the full newsletter from division and team pages", () => {
    for (const path of ["/c", "/c/area-501"]) {
      expect(at(path)).toContain('<a href="https://raleighdartleague.org/newsletter/" target="_blank" rel="noopener">Read the full newsletter</a>');
    }
  });
});

describe("tournament issue", () => {
  const atFull = (path: string, search = "") => renderToStaticMarkup(<Screen data={full} route={parseRoute(path, search)} />);
  const atBefore = (path: string) => renderToStaticMarkup(<Screen data={noResults(full)} route={parseRoute(path)} />);
  const tourney = () => full.issues.find((i) => i.week > (full.schedule?.weeks.length ?? Infinity));
  beforeEach(() => {
    const t = tourney();
    if (t) vi.setSystemTime(new Date(`${t.issueDate}T09:00:00`));
  });

  it("says final standings, not week 15 of 14, and opens divisions on the bracket", () => {
    const t = tourney();
    if (!t) return;
    const home = atFull("/");
    expect(home).toContain("Final standings");
    expect(home).not.toContain("Fall 2026, tournaments");
    expect(home).not.toMatch(/week 15 of 14/);
    const div = atFull("/c");
    expect(div).not.toContain("Fall 2026");
    const tabs = [...div.matchAll(/role="tab"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(tabs[0]).toBe("Bracket");
    // Final standings and the last regular night's scores come with it.
    expect(div).toContain('aria-label="14 wins, 0 losses">14–0<');
    expect(div).toContain('<p class="tab-note">Through week 14 of 14</p>');
    expect(div).toMatch(/<p class="week-pill">(Quarterfinals|Semifinals|Final)/);
    // The leader is "Season champs" now, with no "Clinched" pill or key.
    expect(div).toContain(">Season champs<");
    expect(div).not.toContain("Clinched");
    // Every division's winner reads the same, ranked by wins (F: Cheap Shots has Down to F's points but fewer wins).
    for (const d of ["a", "b", "d", "e", "f", "g", "h"]) {
      const page = atFull(`/${d}`);
      expect(page.match(/>Season champs</g)).toHaveLength(1);
      expect(page).not.toContain("Clinched");
    }
    expect(atFull("/f")).toMatch(/ladder-top.*Down to F, Again/);
    expect(atFull("/c/area-501")).not.toContain("Breaking");
    expect(atFull("/c/area-501")).toContain('<p class="meta">1st in C Division</p>');
  });

  it("names the bracket's opponent and bar on the team page and the lander's Your team card", () => {
    if (!tourney()) return;
    const team = atBefore("/c/area-501");
    expect(team).toMatch(/vs <span><a href="\/c\/still-hump-n">Still Hump&#x27;N<\/a><\/span>/);
    expect(team).toContain("8th in C, 1–13");
    expect(team).toContain("Quarterfinal, seed 1 v 8, 7:00 pm");
    expect(team).toContain("At Upper Deck 1&amp;2");
    expect(team).toContain("Map (Apple)");
    expect(team).not.toContain("Pairings and venues come from the league");
    const home = renderToStaticMarkup(<Screen data={noResults(full)} route={{ page: "home" }} myTeam={{ division: "C", team: "Area 501" }} />);
    expect(home).toMatch(/Next: Nov 18<\/span><span class="your-team-what">Quarterfinal vs <span><a[^>]*href="\/c\/still-hump-n"[^>]*>Still Hump&#x27;N<\/a>/);
  });

  it("says a played round's result is still to come, with only the next round's date", () => {
    if (!tourney()) return;
    vi.setSystemTime(new Date("2026-11-19T09:00:00"));
    const team = atBefore("/c/area-501");
    expect(team).toContain('Awaiting result of</h2><p class="big">Quarterfinal vs <a href="/c/still-hump-n">Still Hump&#x27;N</a></p>');
    expect(team).not.toContain("Last match");
    expect(team).toContain("Semifinals are Wed, Dec 2");
    // Nothing that depends on the result: no next opponent, no bar.
    const card = section(team, "tonight");
    expect(card).not.toContain("Brutha Ducks");
    expect(card).not.toContain("Break Time Billiards");
    expect(card).not.toMatch(/if they/i);
    const home = renderToStaticMarkup(<Screen data={noResults(full)} route={{ page: "home" }} myTeam={{ division: "C", team: "Area 501" }} />);
    expect(home).toMatch(/Awaiting result of<\/span><span class="your-team-what">Quarterfinal vs <a[^>]*>Still Hump&#x27;N<\/a><\/span>/);
  });

  it("moves on to the next round, or says who knocked them out, once a winner is entered", () => {
    if (!tourney()) return;
    vi.setSystemTime(new Date("2026-11-19T09:00:00"));
    const withWinners = (qf: (string | null)[]) => ({ ...full, bracket: { ...full.bracket!, divisions: { ...full.bracket!.divisions, C: { ...full.bracket!.divisions.C, quarterfinals: qf } } } });
    const won = renderToStaticMarkup(<Screen data={withWinners(["Area 501", "Brutha Ducks", null, null])} route={parseRoute("/c/area-501")} />);
    expect(won).toContain("Next match <span class=\"muted\">Wed, Dec 2</span>");
    expect(won).toContain('vs <span><a href="/c/brutha-ducks">Brutha Ducks</a></span>');
    expect(won).toContain("At Break Time Billiards");
    const lost = renderToStaticMarkup(<Screen data={withWinners(["Still Hump'N", null, null, null])} route={parseRoute("/c/area-501")} />);
    expect(lost).toContain("Out in the quarterfinals");
    expect(lost).toContain('Beaten by <a href="/c/still-hump-n">Still Hump&#x27;N</a>');
  });

  it("shows the quarterfinal results the league sent on 2026-11-19", () => {
    if (!tourney()) return;
    vi.setSystemTime(new Date("2026-11-19T09:00:00"));
    // Area 501 beat Still Hump'N and meets Brutha Ducks (who beat Menace) in the semifinal.
    const card = section(atFull("/c/area-501"), "tonight");
    expect(card).toContain("Next match <span class=\"muted\">Wed, Dec 2</span>");
    expect(card).toContain('vs <span><a href="/c/brutha-ducks">Brutha Ducks</a></span>');
    expect(card).toContain("At Break Time Billiards");
    expect(atFull("/c/still-hump-n")).toContain("Out in the quarterfinals");
    // B's semifinal and final bars were swapped after the newsletter printed them.
    const b = section(atFull("/b"), "bracket");
    expect(b).toContain("American Legion-FV");
    expect(b.indexOf("American Legion-FV")).toBeLessThan(b.indexOf("Backstage Pub"));
    // Scores: each side's games won, a 12-12 decided on the 1001 and a forfeit said in words.
    const c = section(atFull("/c"), "bracket");
    expect(c).toMatch(/Area 501<\/span><span class="b-score">13<\/span>/);
    expect(c).toMatch(/Still Hump&#x27;N<\/span><span class="b-score">3<\/span>/);
    expect(b).toContain('<span class="b-note">Won on the 1001</span>');
    expect(section(atFull("/a"), "bracket")).toContain('<span class="b-note">Forfeit</span>');
    expect(section(atFull("/a"), "bracket")).not.toContain("b-score");
  });
});

