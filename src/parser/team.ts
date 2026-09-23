export interface TeamConfig {
  name: string;
  division: string;
  /** For matching structured cells, case-insensitive. */
  aliases: string[];
}

export const TEAM: TeamConfig = {
  name: "Area 501",
  division: "C",
  aliases: ["Area 501", "Area"],
};
