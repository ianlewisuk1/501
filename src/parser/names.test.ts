import { describe, expect, it } from "vitest";
import { firstLast, fullTeamName, isUs } from "./names";
import { TEAM } from "./team";

const C = ["Area 501", "Menace 2 Sobriety", "Mulligans Mafia", "Projectile Dysfunction", "Darty Little Secrets", "Brutha Ducks", "Pints and Points", "Still Hump'N"];

describe("names", () => {
  it("matches our aliases loosely", () => {
    expect(isUs(TEAM, "  area   501 ")).toBe(true);
    expect(isUs(TEAM, "Area")).toBe(true);
    expect(isUs(TEAM, "Area 51")).toBe(false);
  });

  it("flips Last, First", () => {
    expect(firstLast("Lewis, Ian")).toBe("Ian Lewis");
    expect(firstLast("Massengill, Chad  &")).toBe("Chad Massengill");
  });

  it.each([
    ["Pints", "Pints and Points"],
    ["Menace", "Menace 2 Sobriety"],
    ["Hump'N", "Still Hump'N"],
    ["Ducks", "Brutha Ducks"],
    ["Secrets", "Darty Little Secrets"],
    ["Mafia", "Mulligans Mafia"],
    ["Projectile", "Projectile Dysfunction"],
    ["brutha ducks", "Brutha Ducks"],
    ["Nobody", "Nobody"],
  ])("resolves %s", (short, full) => expect(fullTeamName(short, C)).toBe(full));
});
