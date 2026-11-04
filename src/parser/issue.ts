import type * as XLSX from "xlsx";
import type { Sheet } from "./sheet";

/** Season and issue week from the first sheet name ("Fa26-Wk7-Pg1"). */
export function issueOf(wb: XLSX.WorkBook): { season: string; week: number } {
  const m = wb.SheetNames[0]?.match(/^(\w+?)-Wk(\d+)-Pg/);
  if (!m) throw new Error(`Unrecognised sheet name: ${wb.SheetNames[0]}`);
  return { season: m[1], week: Number(m[2]) };
}

/** Division letters in page 2 order, from its `"C" Division` headers. */
export function divisionLetters(pg2: Sheet): string[] {
  const out: string[] = [];
  for (let r = 1; r <= pg2.maxRow; r++) {
    const m = String(pg2.get("A", r) ?? "").trim().match(/^"([A-Z])" Division$/);
    if (m) out.push(m[1]);
  }
  return out;
}
