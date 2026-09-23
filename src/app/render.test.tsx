import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parse } from "../parser/index";
import { TEAM } from "../parser/team";
import { App, PLAYER_COLUMNS } from "./App";
import { Trend } from "./Chart";
import { trend } from "./model";

const wk06 = parse("fixtures/Fa26wk06.xlsx", TEAM);
const wk07 = parse("fixtures/Fa26wk07.xlsx", TEAM);

describe("rendering", () => {
  it("renders the whole page from data/", () => {
    const html = renderToStaticMarkup(<App />);
    for (const text of ["Area 501", "Menace 2 Sobriety", "Standings", "Fixtures", "Players", "Performance"]) {
      expect(html).toContain(text);
    }
  });

  it("renders the season trend", () => {
    const { points, weekly } = trend([wk06, wk07], "Fa26", "Ian Lewis");
    const html = renderToStaticMarkup(<Trend points={points} weekly={weekly} />);
    expect(html).toContain("Wk 5");
    expect(html).toContain("Wk 6");
    expect(html).toContain("3–0");
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
