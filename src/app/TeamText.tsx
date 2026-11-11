/**
 * The editor's prose with every team he names turned into a link to its page: his words, in the
 * team's own chalk, underlined so it reads as something to tap. The full name is in the link's title.
 * Only a team's first mention in the text is a link, so a long paragraph isn't a wall of underlines.
 */
import { teamMentions } from "./league";
import { Link, teamPath } from "./route";
import { chalkFor } from "./ui";

export function TeamText({ text, division, teams }: { text: string; division: string; teams: string[] }) {
  const seen = new Set<string>();
  return (
    <>
      {teamMentions(text, teams).map((m, i) => typeof m === "string" ? m : seen.has(m.team) ? m.text : (seen.add(m.team), (
        <Link key={i} className="team-mention" to={teamPath(division, m.team)} title={m.team} style={{ color: chalkFor(m.team) }}>{m.text}</Link>
      )))}
    </>
  );
}
