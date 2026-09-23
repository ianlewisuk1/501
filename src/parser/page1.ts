import type { Sheet } from "./sheet";
import type { TeamConfig } from "./team";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Match date and issue number from B2. */
export function issueInfo(ws: Sheet): { issueDate: string; issue: string } {
  const s = String(ws.get("B", 2));
  const m = s.match(/week #(\d+), \w+, (\w+) (\d+), (\d{4})\s+Issue #(\w+)/);
  if (!m) throw new Error(`Unrecognised issue line in Pg1!B2: ${s}`);
  const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
  const issueDate = `${m[4]}-${String(month).padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return { issueDate, issue: m[5] };
}

/** Our division's line under RDL HEADLINES, with its indented continuation lines. */
export function headline(ws: Sheet, team: TeamConfig): string | null {
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
