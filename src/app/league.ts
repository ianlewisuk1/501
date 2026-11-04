/** Pure helpers that turn a season of league issues into what each page shows. */
import { teamWeekOf } from "../parser/league";
import { norm } from "../parser/names";
import { TEAM } from "../parser/team";
import type { DivisionWeek, LeagueDivision, LeagueWeek, TeamWeek } from "../parser/types";
import { teamSchedule, teamSlug, type SeasonSchedule } from "./model";
import type { SeasonData } from "./store";

const TERM_NAMES: Record<string, string> = { Wi: "Winter", Sp: "Spring", Su: "Summer", Fa: "Fall" };

/** "Fa26" -> "Fall 2026". */
export const seasonLabel = (season: string): string =>
  `${TERM_NAMES[season.slice(0, 2)] ?? season.slice(0, 2)} 20${season.slice(2)}`;

export const divisionIn = (issue: LeagueWeek | undefined, division: string): LeagueDivision | undefined =>
  issue?.divisions.find((d) => d.division === division.toUpperCase());

/** A team's standings name from its URL slug, in the newest issue. */
export function teamBySlug(issue: LeagueWeek | undefined, division: string, slug: string): string | undefined {
  return divisionIn(issue, division)?.standings.find((s) => teamSlug(s.team) === slug)?.team;
}

/** One team's view of every issue this season, oldest first. */
export const teamHistory = (data: SeasonData, team: string): TeamWeek[] =>
  data.issues.map((l) => teamWeekOf(l, team)).filter((w): w is TeamWeek => w !== null);

/** Every team's view of every issue in a division (for working out other teams' schedules). */
export function divisionHistory(data: SeasonData, division: string): TeamWeek[] {
  return data.issues.flatMap((l) =>
    (divisionIn(l, division)?.standings ?? []).map((s) => teamWeekOf(l, s.team)).filter((w): w is TeamWeek => w !== null));
}

/** Page 10 for one division, one entry per issue (for scouting and the leaderboard). */
export function divisionWeeks(data: SeasonData, division: string): DivisionWeek[] {
  return data.issues.flatMap((l) => {
    const d = divisionIn(l, division);
    return d ? [{ season: l.season, week: l.week, division: d.division, teams: d.teams }] : [];
  });
}

/** Ours is hand-entered; every other team's is worked out from the newsletters. */
export function scheduleFor(data: SeasonData, team: string, division: string): SeasonSchedule | undefined {
  if (!data.schedule) return undefined;
  if (norm(team) === norm(TEAM.name)) return data.schedule;
  return teamSchedule(team, divisionHistory(data, division), data.schedule);
}
