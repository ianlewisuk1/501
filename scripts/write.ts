/**
 * Writes data/{season}/week-NN.json, data/{season}/division-week-NN.json (every team's players, for scouting),
 * data/{season}/teams-week-NN.json (every division team's week, for the team picker), data/{season}/index.json, data/latest.json (a copy of the newest week)
 * and records the file in data/manifest.json.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { parseDivisionTeams, parseDivisionWorkbook, parseWorkbook } from "../src/parser/index";
import { loadWorkbook } from "../src/parser/workbook";
import { TEAM } from "../src/parser/team";

const DATA = "data";
const write = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");

export function processedFiles(): Set<string> {
  const manifestPath = join(DATA, "manifest.json");
  return new Set(existsSync(manifestPath) ? Object.keys(JSON.parse(readFileSync(manifestPath, "utf8"))) : []);
}

export function parseFiles(files: string[]): string[] {
  const manifestPath = join(DATA, "manifest.json");
  const manifest: Record<string, string> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  const written: string[] = [];
  for (const file of files) {
    const wb = loadWorkbook(file);
    const week = parseWorkbook(wb, TEAM);
    const dir = join(DATA, week.season);
    mkdirSync(dir, { recursive: true });
    const nn = String(week.week).padStart(2, "0");
    const out = join(dir, `week-${nn}.json`);
    write(out, week);
    write(join(dir, `division-week-${nn}.json`), parseDivisionWorkbook(wb, TEAM));
    write(join(dir, `teams-week-${nn}.json`), parseDivisionTeams(wb, TEAM));
    manifest[basename(file)] = out;
    written.push(out);
    console.log(`${file} -> ${out}`);
  }
  if (!written.length) return written;

  // Rebuild each season's index and point latest.json at the newest week overall.
  let latest: { season: string; week: number; path: string } | null = null;
  for (const season of readdirSync(DATA, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    const weeks = readdirSync(join(DATA, season))
      .map((f) => f.match(/^week-(\d+)\.json$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => Number(m[1]))
      .sort((a, b) => a - b);
    if (!weeks.length) continue;
    write(join(DATA, season, "index.json"), { season, weeks });
    const path = join(DATA, season, `week-${String(weeks.at(-1)).padStart(2, "0")}.json`);
    const issueDate = JSON.parse(readFileSync(path, "utf8")).issueDate as string;
    if (!latest || issueDate > JSON.parse(readFileSync(latest.path, "utf8")).issueDate) {
      latest = { season, week: weeks.at(-1)!, path };
    }
  }
  if (latest) {
    write(join(DATA, "latest.json"), JSON.parse(readFileSync(latest.path, "utf8")));
    console.log(`latest -> ${latest.season} week ${latest.week}`);
  }
  write(manifestPath, Object.fromEntries(Object.entries(manifest).sort()));
  return written;
}
