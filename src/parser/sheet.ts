import * as XLSX from "xlsx";

export type Value = string | number | boolean | null;

/** Read-only view of one worksheet, addressed like the newsletter: column letter + 1-based row. */
export class Sheet {
  readonly maxRow: number;
  readonly maxCol: number;

  constructor(private readonly ws: XLSX.WorkSheet) {
    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    this.maxRow = range.e.r + 1;
    this.maxCol = range.e.c + 1;
  }

  get(col: string, row: number): Value {
    const cell = this.ws[`${col}${row}`] as XLSX.CellObject | undefined;
    return (cell?.v as Value | undefined) ?? null;
  }

  /** Every value in a row, left to right. */
  row(row: number): Value[] {
    const out: Value[] = [];
    for (let c = 0; c < this.maxCol; c++) out.push(this.get(XLSX.utils.encode_col(c), row));
    return out;
  }

  /** Column letters for a row, paired with their values. */
  entries(row: number): [string, Value][] {
    return this.row(row).map((v, c) => [XLSX.utils.encode_col(c), v]);
  }

  findRow(col: string, pred: (v: Value) => boolean, start = 1): number | null {
    for (let r = start; r <= this.maxRow; r++) if (pred(this.get(col, r))) return r;
    return null;
  }
}

export const isBlank = (v: Value): v is null | "" => v === null || v === "";

/** The newsletter uses "-" to mean "nothing here". */
export const dash = <T extends Value>(v: T): Exclude<T, ""> | null =>
  v === null || v === "" || v === "-" ? null : (v as Exclude<T, "">);

export const num = (v: Value): number | null => (typeof v === "number" ? v : null);

export const round4 = (v: Value): number | null => (typeof v === "number" ? Number(v.toFixed(4)) : null);

export const str = (v: Value): string => (v === null ? "" : String(v));

/** "9/2/26" parts -> "2026-09-02". */
export const isoDate = (m: string, d: string, yy: string): string =>
  `20${yy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
