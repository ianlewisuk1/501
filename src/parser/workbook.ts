import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

export function loadWorkbook(path: string): XLSX.WorkBook {
  return XLSX.read(readFileSync(path));
}
