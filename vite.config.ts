/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * The day the league data last changed, for the lander's "last updated" line. scripts/write.ts
 * stamps it in data/updated.json; failing that, the newest commit touching data/; failing that, today.
 */
function dataUpdated(): string {
  try {
    const { date } = JSON.parse(readFileSync("data/updated.json", "utf8"));
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  } catch { /* not written yet */ }
  try {
    const iso = execSync("git log -1 --format=%cI -- data/", { encoding: "utf8" }).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
  } catch { /* no git */ }
  return new Date().toISOString().slice(0, 10);
}

// Served from the root of https://area501.lol (Vercel).
export default defineConfig({
  plugins: [react()],
  define: { __DATA_UPDATED__: JSON.stringify(dataUpdated()) },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
