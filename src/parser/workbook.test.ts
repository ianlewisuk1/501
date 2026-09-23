import { describe, expect, it } from "vitest";
import { loadWorkbook } from "./workbook";

describe("loadWorkbook", () => {
  it.each([
    ["fixtures/Fa26wk06.xlsx", "Fa26-Wk6-Pg1"],
    ["fixtures/Fa26wk07.xlsx", "Fa26-Wk7-Pg1"],
  ])("reads %s", (path, firstSheet) => {
    const wb = loadWorkbook(path);
    expect(wb.SheetNames[0]).toBe(firstSheet);
    expect(wb.SheetNames).toContain(firstSheet.replace("Pg1", "Pg10C"));
  });
});
