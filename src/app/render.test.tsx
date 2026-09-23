import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parse } from "../parser/index";
import { TEAM } from "../parser/team";
import { App, PlayerRow } from "./App";
import { Trend } from "./Chart";
import { trend } from "./model";

const wk06 = parse("fixtures/Fa26wk06.xlsx", TEAM);
const wk07 = parse("fixtures/Fa26wk07.xlsx", TEAM);

describe("rendering", () => {
  it("renders the whole page from data/", () => {
    const html = renderToStaticMarkup(<App />);
    for (const text of ["Area 501", "Menace 2 Sobriety", "Standings", "Fixtures", "Players", "Performance", "Bragging rights"]) {
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

  it("renders an expanded player row", () => {
    const html = renderToStaticMarkup(<table><tbody><PlayerRow p={wk07.players[1]} open toggle={() => {}} /></tbody></table>);
    expect(html).toContain("Singles cricket");
  });
});
