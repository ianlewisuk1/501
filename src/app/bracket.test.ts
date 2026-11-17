import { describe, expect, it } from "vitest";
import { loadWorkbook } from "../parser/workbook";
import { parseLeague } from "../parser/league";
import { bracketView, withBracketFile, type BracketFile } from "./league";
import file from "../../data/Fa26/bracket.json";

const wk14 = parseLeague(loadWorkbook("inbox/Fa26wk14.xlsx"));
const div = (d: string) => wk14.divisions.find((x) => x.division === d)!;

describe("tournament bracket", () => {
  it("reads every division's bracket from week 14 page 7", () => {
    expect(wk14.divisions.every((d) => d.bracket)).toBe(true);
    const c = div("C").bracket!;
    expect(c.dates).toEqual({ quarterfinals: "2026-11-18", semifinals: "2026-12-02", final: "2026-12-09" });
    expect(c.slots.map((s) => s.seed)).toEqual([1, 8, 5, 4, 3, 6, 7, 2]);
    expect(c.slots[0].team).toBe("Area 501");
    expect(c.quarterfinals.map((q) => q.venue)).toEqual(["Upper Deck 1&2*", "Upper Deck 5&6*", "Upper Deck 9&11*", "Upper Deck 13&15*"]);
    expect(c.semifinals.map((q) => q.venue)).toEqual(["Break Time Billiards*", "Dugout Tavern"]);
    expect(c.final.venue).toBe("Mac's Tavern 1&2*");
  });

  it("puts a bye's seed straight through, as the newsletter writes it", () => {
    const e = div("E").bracket!;
    expect(e.slots[1]).toEqual({ seed: null, team: null });
    expect(e.quarterfinals[0]).toEqual({ venue: null, winner: "What's the Point?" });
    expect(div("G").bracket!.slots.slice(5, 7).map((s) => s.team)).toEqual(["Aim-ing For Trouble", "Cary On Our Wayward Darts"]);
  });

  it("fills open seeds from the standings and names who can reach each later line", () => {
    const c = div("C");
    const v = bracketView(c.bracket!, c.standings);
    const [qf, sf, fin] = v.rounds;
    expect(qf.games[0].entries.map((e) => [e.team, e.projected])).toEqual([["Area 501", false], ["Still Hump'N", true]]);
    expect(sf.games[0].entries.map((e) => e.placeholder)).toEqual(["Seed 1 or 8", "Seed 5 or 4"]);
    expect(fin.games[0].entries[0].placeholder).toBe("Seed 1, 8, 5 or 4");
    const e = div("E");
    const ev = bracketView(e.bracket!, e.standings);
    expect(ev.rounds[0].games[0].entries[1].placeholder).toBe("Bye");
    expect(ev.rounds[1].games[0].entries[0].team).toBe("What's the Point?");
    expect(ev.rounds[2].games[0].entries[0].placeholder).toBe("Seed 1, 5 or 4");
  });

  it("takes the final seeds from data/Fa26/bracket.json, every name a standings name", () => {
    const f = file as BracketFile;
    for (const [d, o] of Object.entries(f.divisions)) {
      const names = div(d).standings.map((s) => s.team);
      for (const t of [...(o.seeds ?? []), ...(o.quarterfinals ?? []), ...(o.semifinals ?? []), o.final ?? null]) if (t) expect(names).toContain(t);
    }
    const view = (d: string) => bracketView(withBracketFile(div(d).bracket!, f, d), div(d).standings);
    const c = view("C").rounds[0].games.map((g) => g.entries.map((e) => `${e.seed} ${e.team}${e.projected ? "?" : ""}`));
    expect(c).toEqual([
      ["1 Area 501", "8 Still Hump'N"], ["5 Brutha Ducks", "4 Menace 2 Sobriety"],
      ["3 Mulligans Mafia", "6 Projectile Dysfunction"], ["7 Pints and Points", "2 Darty Little Secrets"],
    ]);
    // G's top seed goes straight through on the bye.
    const g = view("G");
    expect(g.rounds[1].games[0].entries[0].team).toBe("Banging the Wire");
    expect(g.rounds[0].games[3].entries.map((e) => e.team)).toEqual(["Cary On Our Wayward Darts", "Rippin Darts"]);
  });
});
