import { norm } from "../parser/names";
import { TEAM } from "../parser/team";
import type { DivisionWeek, TeamWeek } from "../parser/types";
import { sortWeeks, teamSchedule, type SeasonSchedule } from "./model";

// Bundled at build time: every division team's parsed weeks and every season's schedule.
const teamFiles = import.meta.glob<TeamWeek[]>("../../data/*/teams-week-*.json", { eager: true, import: "default" });
const scheduleFiles = import.meta.glob<SeasonSchedule>("../../data/*/schedule.json", { eager: true, import: "default" });

/** Every team's week from every parsed issue. */
const allWeeks: TeamWeek[] = sortWeeks(Object.values(teamFiles).flat());
const latest = allWeeks.at(-1);

/** One team's issues this season, oldest first. */
export const historyOf = (team: string): TeamWeek[] =>
  allWeeks.filter((w) => w.season === latest?.season && norm(w.team.name) === norm(team));

export const history: TeamWeek[] = historyOf(TEAM.name);
export const current: TeamWeek | undefined = history.at(-1);
export const schedule: SeasonSchedule | undefined = Object.values(scheduleFiles).find((s) => s.season === current?.season);

/** The division's teams in the newest issue, A to Z, for the team picker. */
export const teamNames: string[] = (latest?.standings.map((s) => s.team) ?? []).sort((a, b) => a.localeCompare(b));

/** Ours is hand-entered; everyone else's is worked out from the newsletters. */
export const scheduleOf = (team: string): SeasonSchedule | undefined =>
  !schedule || norm(team) === norm(TEAM.name) ? schedule : teamSchedule(team, allWeeks, schedule);

/** Every team's players in our division, one entry per parsed issue (for scouting). */
export const divisions: DivisionWeek[] = Object.values(teamFiles).filter((teams) => teams.length).map((teams) => ({
  season: teams[0].season,
  week: teams[0].week,
  division: teams[0].team.division,
  teams: teams.filter((t) => t.team.code).map((t) => ({ code: t.team.code, name: t.team.name, players: t.players })),
}));
