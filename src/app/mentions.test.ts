import { describe, expect, it } from "vitest";
import { teamMentions } from "./league";

const C = ["Area 501", "Darty Little Secrets", "Menace 2 Sobriety", "Mulligans Mafia", "Projectile Dysfunction", "Brutha Ducks", "Pints and Points", "Still Hump'N"];
const links = (text: string, teams: string[]) =>
  teamMentions(text, teams).filter((m) => typeof m !== "string").map((m) => typeof m === "string" ? m : `${m.text}=${m.team}`);

describe("teams named in the editor's prose", () => {
  it("links the short names he uses, keeping his words", () => {
    expect(teamMentions("Area keeps their streak alive; Menace edges the Mafia", C)).toEqual([
      { text: "Area", team: "Area 501" }, " keeps their streak alive; ",
      { text: "Menace", team: "Menace 2 Sobriety" }, " edges the ",
      { text: "Mafia", team: "Mulligans Mafia" },
    ]);
  });

  it("never takes a game for a team: a bare 501 is the game", () => {
    expect(links("Menace sweeps 501 to flip the script on Projectile", C)).toEqual(["Menace=Menace 2 Sobriety", "Projectile=Projectile Dysfunction"]);
  });

  it("prefers the longest run of the name, and reads hyphens, commas and drifting capitals", () => {
    const F = ["Down to F, Again", "Death Throw", "Cheap Shots", "Two Time", "Nein Mark", "That's What She Said", "Shark Shooters"];
    expect(links("Death Throw jumps on Down To F early; Two Time never trails Cheapies", F))
      .toEqual(["Death Throw=Death Throw", "Down To F=Down to F, Again", "Two Time=Two Time", "Cheapies=Cheap Shots"]);
    expect(links("The winner of the Rippin-Banging match", ["Rippin Darts", "Banging the Wire", "Flight Club"]))
      .toEqual(["Rippin=Rippin Darts", "Banging=Banging the Wire"]);
  });

  it("leaves ordinary words, lower-case uses and possessives' 's outside", () => {
    const H = ["Double Vision", "SofaKings", "Bright Side of Flights", "Dirty Darts (Done Dirt Cheap)"];
    expect(teamMentions("Vision's third straight loss; dirty work by the Darts", H))
      .toEqual([{ text: "Vision", team: "Double Vision" }, "'s third straight loss; dirty work by the Darts"]);
  });

  it("skips a word that fits more than one team", () => {
    expect(links("Dart wins", ["Dart Attack", "Dart Knights"])).toEqual([]);
  });
});
