import type { Sheet } from "./sheet";
import type { TeamConfig } from "./team";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/**
 * Match date and issue number from B2. The tournament issue runs onto B3 and lists every
 * tournament night ("tournament weeks #15/16/17, Wednesdays, November 18, and" / "Dec. 2 & 9, 2026
 * Issue #JK959"); its date is the first night.
 */
export function issueInfo(ws: Sheet): { issueDate: string; issue: string } {
  let s = String(ws.get("B", 2));
  if (!/Issue #/.test(s)) s += " " + String(ws.get("B", 3) ?? "");
  const m = s.match(/weeks? #[\d/]+, \w+, (\w+) (\d+),.*?(\d{4})\s+Issue #(\w+)/);
  if (!m) throw new Error(`Unrecognised issue line in Pg1!B2: ${s}`);
  const [, mon, day, year, issue] = m;
  const month = MONTHS.indexOf(mon.toLowerCase()) + 1;
  return { issueDate: `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`, issue };
}

/** Our division's line under RDL HEADLINES, with its indented continuation lines. */
export function headline(ws: Sheet, team: Pick<TeamConfig, "division">): string | null {
  const prefix = `"${team.division}" Division:`;
  let r = ws.findRow("H", (v) => typeof v === "string" && v.startsWith(prefix));
  if (r === null) return null;
  const first = String(ws.get("H", r));
  const parts = [first.slice(first.indexOf(":") + 1).trim()];
  for (r++; ; r++) {
    const v = ws.get("H", r);
    if (typeof v !== "string" || !v.startsWith(" ")) break;
    parts.push(v.trim());
  }
  return parts.join(" ").replace(/-\s+(?=[a-z])/g, "-");
}
