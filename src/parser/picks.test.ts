import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { loadWorkbook } from "./workbook";
import { parseLeague } from "./league";

const wk = (n: string) => parseLeague(loadWorkbook(`inbox/Fa26wk${n}.xlsx`));
/** The pick for the match a team plays in (home or away). */
const pick = (l: ReturnType<typeof wk>, div: string, team: string) => l.divisions.find((d) => d.division === div)!.picks!.find((p) => p.away === team || p.home === team);

describe("the newsletter editor's picks (page 5)", () => {
  it("finds a pick for every one of this week's matches, in every issue that has them", () => {
    for (const f of readdirSync("inbox").filter((f) => /^Fa26wk\d+\.xlsx$/.test(f))) {
      const l = parseLeague(loadWorkbook(`inbox/${f}`));
      for (const d of l.divisions) for (const m of d.thisWeek?.matches ?? []) {
        if (l.week === 1) continue; // the first issue picks nothing
        // The newsletter left this one out of week 14's list (D has four matches, three picks).
        if (l.week === 14 && m.away === "Nine Lives") continue;
        expect(d.picks!.some((p) => p.away === m.away && p.home === m.home), `${f} ${d.division} ${m.away} @ ${m.home}`).toBe(true);
      }
    }
   }, 30_000); // reads every workbook

  it("reads the season's last issue, where this week's matches sit on the right and there is no next week", () => {
    const l = wk("14");
    const c = l.divisions.find((d) => d.division === "C")!;
    expect(c.thisWeek?.week).toBe(14);
    expect(c.thisWeek?.matches).toContainEqual({ away: "Area 501", home: "Menace 2 Sobriety", venue: "High Park 1&2" });
    expect(c.nextWeek).toBeNull();
    // Column H's predictions start above the header, under the match list: Match #5 runs on into it.
    expect(pick(l, "D", "Point & Rally")!.call).toBe("They do, but Sanchez is tough. 14-10.");
  });

  it("reads the last issue's title possibilities, one paragraph a division, and none in other issues", () => {
    const l = wk("14");
    const race = (d: string) => l.divisions.find((x) => x.division === d)!.titleRace;
    expect(race("C")).toMatch(/^Area 501 is 1st\. Darty Little Secrets are 2nd if they win/);
    expect(race("C")).toMatch(/extra head-to-head match before next week!$/);
    expect(race("H")).toBe("SofaKings are 1st. Double Vision is 1st if the win, or if Dirty Darts lose. If Vision loses and Dirty wins, Dirty is 2nd if they can gain at least 5 points on Vision tonight.");
    expect(l.divisions.every((d) => d.titleRace)).toBe(true);
    expect(wk("13").divisions.some((d) => "titleRace" in d)).toBe(false);
  });

  it("keeps a featured match's write-up and its closing call, in the editor's words", () => {
    const p = pick(wk("13"), "A", "The Inflationary Element")!;
    expect(p.featured).toBe(true);
    expect(p.call).toBe("Have to go Element, 13-11.");
    expect(p.text).toMatch(/^The Inflationary Element @ Jonesing for Mugs\. This one is simple/);
    // A call that is only a score brings the sentence it finishes.
    expect(pick(wk("13"), "B", "Consistently Inconsistent")!.call).toBe("No small task, but they do…. barely. 13-11.");
  });

  it("gives a write-up that covers several matches no single call", () => {
    const f = wk("10");
    for (const away of ["Cheap Shots", "Shark Shooters", "Nein Mark"]) {
      const p = pick(f, "F", away)!;
      expect(p.call).toBeNull();
      expect(p.together).toBe(3);
    }
  });

  it("writes listed picks with the standings' names, whatever the spelling", () => {
    expect(pick(wk("13"), "C", "Pints and Points")!.text).toBe("Area 501 16, Pints and Points 8");
    expect(pick(wk("13"), "B", "Liquor Possee")!.text).toBe("Why So Serious? 13, Liquor Possee 11"); // "Serious? 13, Possee 11"
    expect(pick(wk("02"), "E", "Main St Mayhem")!.text).toBe("Shooting Blanks 14, Main St Mayhem 10"); // "Main St Mayhew"
    expect(pick(wk("02"), "H", "Bright Side of Flights")!.text).toBe("Dirty Darts (Done Dirt Cheap) 12 (wins the 1001), Bright Side of Flights 12"); // "12+"
  });
});
