import type { TeamWeek } from "../parser/types";
import { sortWeeks, type SeasonSchedule } from "./model";

// Bundled at build time: every parsed week and every season's schedule.
const weekFiles = import.meta.glob<TeamWeek>("../../data/*/week-*.json", { eager: true, import: "default" });
const scheduleFiles = import.meta.glob<SeasonSchedule>("../../data/*/schedule.json", { eager: true, import: "default" });

export const history: TeamWeek[] = sortWeeks(Object.values(weekFiles));
export const current: TeamWeek | undefined = history.at(-1);
export const schedule: SeasonSchedule | undefined = Object.values(scheduleFiles).find((s) => s.season === current?.season);
