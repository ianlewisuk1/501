import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { loadWorkbook } from "./workbook";
import { parseVenueDirectory } from "./venues";
import { resolveVenue, venueBar } from "./venueMatch";
import type { LeagueWeek } from "./types";

const directory = parseVenueDirectory(loadWorkbook("inbox/Fa26wk01.xlsx"))!;

describe("the league's venue directory (week 1, page 3)", () => {
  it("reads all 26 host bars, with street, town and landmark, and no phone numbers", () => {
    expect(directory).toHaveLength(26);
    for (const v of directory) {
      expect(v.street).toMatch(/^\d+ /);
      expect(v.city).toBeTruthy();
      expect(JSON.stringify(v)).not.toMatch(/\d{3}-\d{3}-\d{4}/);
    }
  });

  it("points Brass Tap at the league's pool hall on Capital Blvd, by address, not by name", () => {
    const v = resolveVenue("Brass Tap 1&2", directory)!;
    expect(v.name).toBe("Brass Tap & Billiards");
    expect(v.maps).toBe("3316 Capital Boulevard, Raleigh, NC");
    expect(v.landmark).toBe("in Starmount shopping center");
    expect(resolveVenue("Brass Tap 5&6", directory)).toBe(v); // same bar, other boards
  });

  it("cleans addresses for maps: no suite, no former address, the town not the area", () => {
    expect(resolveVenue("D's Bottle Shop", directory)!.maps).toBe("13200 Falls of Neuse Rd, Raleigh, NC");
    expect(resolveVenue("Rally Point", directory)!.maps).toBe("837 Bass Pro Lane, Cary, NC");
    expect(resolveVenue("Snooker's 7&8", directory)!.maps).toBe("3520 Wade Avenue, Raleigh, NC");
  });

  it("matches every venue page 5 printed this season to exactly one bar", () => {
    const names = new Set<string>();
    for (const f of readdirSync("data/Fa26").filter((f) => f.startsWith("league-week-"))) {
      const l: LeagueWeek = JSON.parse(readFileSync(`data/Fa26/${f}`, "utf8"));
      for (const d of l.divisions) for (const r of [d.thisWeek, d.nextWeek]) for (const m of r?.matches ?? []) names.add(m.venue);
    }
    expect(names.size).toBeGreaterThan(30);
    for (const n of names) expect(resolveVenue(n, directory), n).not.toBeNull();
    expect(resolveVenue("Amer. Legion F-V", directory)!.name).toBe("American Legion Fuquay-Varina");
    expect(resolveVenue("Main Street Taps", directory)!.name).toMatch(/^Main Street Taps/);
    expect(resolveVenue("Main Street Tavern", directory)!.name).toBe("Main Street Tavern");
    expect(resolveVenue("Nowhere Bar", directory)).toBeNull();
    expect(venueBar("Sharky's Place 1&2*")).toBe("Sharky's Place");
  });

  it("matches the directory the site bundles", () => {
    expect(JSON.parse(readFileSync("data/Fa26/venues.json", "utf8"))).toEqual(directory);
  });
});
