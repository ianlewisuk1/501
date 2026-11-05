/**
 * League data, loaded on demand: each data/{season}/league-week-NN.json is its own chunk, so the
 * page only downloads the season it shows. The schedule and news are small and bundled.
 */
import { useEffect, useState } from "react";
import type { LeagueWeek } from "../parser/types";
import type { NewsItem, SeasonSchedule } from "./model";
import type { Venue } from "../parser/venueMatch";

const leagueFiles = import.meta.glob<LeagueWeek>("../../data/*/league-week-*.json", { import: "default" });
const scheduleFiles = import.meta.glob<SeasonSchedule>("../../data/*/schedule.json", { eager: true, import: "default" });
const newsFiles = import.meta.glob<NewsItem[]>("../../data/news.json", { eager: true, import: "default" });
const venueFiles = import.meta.glob<Venue[]>("../../data/*/venues.json", { eager: true, import: "default" });

export interface SeasonData {
  season: string;
  /** Every parsed issue this season, oldest first. */
  issues: LeagueWeek[];
  /** Hand-entered season schedule (dates, venues' map queries, key dates), if there is one. */
  schedule: SeasonSchedule | undefined;
  news: NewsItem[];
  /** The league's directory of host bars, read from the season's first issue (for map links). */
  venues: Venue[] | undefined;
}

const TERMS = ["Wi", "Sp", "Su", "Fa"];
/** "Sp27" sorts after "Fa26". */
const seasonOrder = (s: string) => Number(s.slice(2)) * 10 + TERMS.indexOf(s.slice(0, 2));

const refs = Object.keys(leagueFiles).map((path) => {
  const m = path.match(/data\/(\w+)\/league-week-(\d+)\.json$/)!;
  return { season: m[1], week: Number(m[2]), path };
});

export const latestSeason: string | undefined = [...new Set(refs.map((r) => r.season))].sort((a, b) => seasonOrder(a) - seasonOrder(b)).at(-1);

const cache = new Map<string, Promise<SeasonData>>();

const assemble = (season: string, issues: LeagueWeek[]): SeasonData => ({
  season,
  issues: issues.sort((a, b) => a.issueDate.localeCompare(b.issueDate)),
  schedule: Object.values(scheduleFiles).find((s) => s.season === season),
  news: Object.values(newsFiles).flat(),
  venues: Object.entries(venueFiles).find(([path]) => path.includes(`/data/${season}/`))?.[1],
});

const files = (season: string) => refs.filter((r) => r.season === season).sort((a, b) => a.week - b.week);

/** Every issue of a season. */
export function loadSeason(season = latestSeason): Promise<SeasonData | null> {
  if (!season) return Promise.resolve(null);
  let p = cache.get(season);
  if (!p) {
    p = Promise.all(files(season).map((r) => leagueFiles[r.path]())).then((issues) => assemble(season, issues));
    cache.set(season, p);
  }
  return p;
}

/** Just the newest issue: enough for the league and division pages. */
async function loadLatest(season = latestSeason): Promise<SeasonData | null> {
  const last = season ? files(season).at(-1) : undefined;
  return last ? assemble(season!, [await leagueFiles[last.path]()]) : null;
}

/**
 * The latest season's data, or undefined while it loads (null if there's none). With `full` false
 * it hands over the newest issue first and the whole season once that arrives.
 */
export function useSeason(full: boolean): SeasonData | null | undefined {
  const [data, setData] = useState<{ data: SeasonData | null; complete: boolean } | undefined>(undefined);
  useEffect(() => {
    let live = true;
    if (!full) loadLatest().then((d) => live && setData((cur) => cur?.complete ? cur : { data: d, complete: false }));
    loadSeason().then((d) => live && setData({ data: d, complete: true }));
    return () => { live = false; };
  }, [full]);
  if (!data || (full && !data.complete)) return undefined;
  return data.data;
}
