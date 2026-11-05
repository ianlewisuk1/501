/**
 * The league's own list of host bars, "WHERE WE PLAY" (page 3 of a season's first issue), and the
 * matching of every venue name the newsletter prints elsewhere ("Brass Tap 1&2", "Amer. Legion
 * F-V") to exactly one entry in it. Map links are built from these addresses, never from a bar's
 * name: two businesses can share a name (the league's Brass Tap & Billiards on Capital Blvd is
 * not the downtown beer bar The Brass Tap), but a street address only points one place.
 *
 * Phone numbers in the directory are deliberately not kept. The matching lives in venueMatch.ts,
 * apart from this file, so the site can use it without loading the spreadsheet library.
 */
import * as XLSX from "xlsx";
import type { Venue } from "./venueMatch";

export type { Venue };


const PHONE = /\(?\d{3}\)?[-. ]\d{3}-\d{4}/;
const cell = (ws: XLSX.WorkSheet, r: number, c: number): string => {
  const v = ws[XLSX.utils.encode_cell({ r, c })]?.v;
  return v === undefined || v === null ? "" : String(v).trim();
};

/** "north Raleigh", "N. Raleigh", "NW Raleigh" are all Raleigh to a map. */
export const cityOf = (area: string) => area.replace(/^(north|south|east|west|n\.?|s\.?|e\.?|w\.?|nw|ne|sw|se)\s+/i, "").trim();

/** "13200 Falls of Neuse Rd, Suite 115" and "837 Bass Pro Lane (formerly 1837 N. Harrison Ave.)" lose the suite and the old address. */
export const cleanStreet = (s: string) => s.replace(/\(formerly[^)]*\)/i, "").replace(/,?\s*(suite|ste\.?|unit)\s*\S+$/i, "").replace(/\s+/g, " ").trim();

/**
 * Reads the directory from a workbook, or null when no sheet has one (only the first issue of a
 * season prints it). Entries sit in two column pairs (name and phone, then street and town, then
 * a landmark line); a name is any cell whose right-hand neighbour is a phone number.
 */
export function parseVenueDirectory(wb: XLSX.WorkBook): Venue[] | null {
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws["!ref"]) continue;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    let found = false;
    for (let r = range.s.r; r <= Math.min(range.e.r, 5) && !found; r++)
      for (let c = range.s.c; c <= range.e.c; c++) if (/^WHERE WE PLAY/i.test(cell(ws, r, c))) found = true;
    if (!found) continue;

    const venues: Venue[] = [];
    for (let c = range.s.c; c < range.e.c; c++) {
      for (let r = range.s.r; r <= range.e.r; r++) {
        const name = cell(ws, r, c);
        if (!name || !PHONE.test(cell(ws, r, c + 1)) || PHONE.test(name)) continue;
        let street = cell(ws, r + 1, c);
        let area = cell(ws, r + 1, c + 1);
        // Rally Point's town shares the street's cell after a run of spaces.
        if (!area) {
          const m = street.match(/^(.*?)\s{3,}(\S.*)$/);
          if (m) { street = m[1]; area = m[2]; }
        }
        const below = cell(ws, r + 2, c);
        const landmark = below && !PHONE.test(cell(ws, r + 2, c + 1)) ? below.replace(/^-\s*/, "") : null;
        const city = cityOf(area);
        venues.push({ name, street, area, city, landmark, maps: `${cleanStreet(street)}, ${city}, NC` });
      }
    }
    return venues.length ? venues : null;
  }
  return null;
}

