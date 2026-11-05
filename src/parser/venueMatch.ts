/**
 * Matching the venue names the newsletter prints ("Brass Tap 1&2", "Amer. Legion F-V") to the
 * league's directory of host bars (venues.ts reads it). Kept apart from the spreadsheet code so
 * the site can bundle it.
 */
export interface Venue {
  /** As the directory prints it: "Brass Tap & Billiards". */
  name: string;
  /** "3316 Capital Boulevard". */
  street: string;
  /** As printed: "north Raleigh", "Cary". */
  area: string;
  /** The city a map wants: "Raleigh", "Cary". */
  city: string;
  /** The directory's how-to-find-it line: "in Starmount shopping center". */
  landmark: string | null;
  /** What the map links search for: street and city only, "3316 Capital Boulevard, Raleigh, NC". */
  maps: string;
}

/** Lower case, "&" as "and", no punctuation, no leading "the", no "(was …)" history. */
const norm = (s: string) =>
  s.toLowerCase().replace(/\(was[^)]*\)/g, " ").replace(/&/g, " and ").replace(/['’.]/g, "").replace(/[^a-z0-9#]+/g, " ").trim().replace(/^the /, "");

/** The newsletter's shortenings that no prefix rule can untangle, mapped to the directory's names. */
const ALIASES: Record<string, string> = {
  "amer legion f v": "American Legion Fuquay-Varina",
  "american legion fv": "American Legion Fuquay-Varina",
  "buffalo bros cap": "Buffalo Brothers - Capital Blvd",
  "cleve dh garner": "Cleveland Draft House - Garner",
  "lonerider wf": "Lonerider Wake Forest",
  "snookers": "Snooker's-RW",
  "taproom knightdale": "The Taproom - Knightdale",
};

/** "Brass Tap 1&2", "Sharky's Place 1&2*", "Upper Deck 13&15" name the boards; the bar is the rest. */
export const venueBar = (venue: string) => venue.replace(/\s*\d+\s*&\s*\d+\*?\s*$/, "").replace(/\*$/, "").trim();

/**
 * The directory entry a printed venue name means, or null unless exactly one fits: an alias, an
 * exact match, or one name starting with the other ("Brass Tap" and "Brass Tap & Billiards").
 */
export function resolveVenue(venue: string, directory: Venue[]): Venue | null {
  const key = norm(venueBar(venue));
  if (!key) return null;
  const alias = ALIASES[key];
  if (alias) return directory.find((v) => v.name === alias) ?? null;
  const exact = directory.filter((v) => norm(v.name) === key);
  if (exact.length === 1) return exact[0];
  const word = (a: string, b: string) => a === b || a.startsWith(b + " ");
  const fits = directory.filter((v) => word(norm(v.name), key) || word(key, norm(v.name)));
  return fits.length === 1 ? fits[0] : null;
}
