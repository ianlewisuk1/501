/** The league lander: every division's table, and a shortcut back to the team you last looked at. */
import type { LeagueWeek } from "../parser/types";
import { divisionIn, seasonLabel } from "./league";
import { shortDate } from "./model";
import { divisionPath, Link, teamPath } from "./route";
import { ClinchBadge } from "./ui";

export function HomePage({ issue, myTeam }: { issue: LeagueWeek; myTeam: { division: string; team: string } | null }) {
  const mine = myTeam && divisionIn(issue, myTeam.division)?.standings.find((s) => s.team === myTeam.team);
  return (
    <main>
      <header className="page-head">
        <h1>Raleigh Dart League</h1>
        <p className="meta">{seasonLabel(issue.season)} · Week {issue.week} · {shortDate(issue.issueDate)}</p>
      </header>
      {mine && myTeam && (
        <Link className="my-team" to={teamPath(myTeam.division, myTeam.team)}>
          <span className="muted small">Your team</span>
          <span className="my-name">{myTeam.team}</span>
          <span className="muted small">{myTeam.division} Division · {mine.wins}–{mine.losses} · {mine.points} pts</span>
        </Link>
      )}
      <div className="divisions">
        {issue.divisions.map((d) => (
          <section key={d.division} aria-labelledby={`div-${d.division}`}>
            <h2 id={`div-${d.division}`}><Link to={divisionPath(d.division)}>{d.division} Division</Link></h2>
            <table className="mini">
              <tbody>
                {d.standings.map((s) => (
                  <tr key={s.team}>
                    <td className="num rank">{s.rank}</td>
                    <td><Link to={teamPath(d.division, s.team)}>{s.team}</Link><ClinchBadge mark={s.clinched} /></td>
                    <td className="num">{s.wins}–{s.losses}</td>
                    <td className="num muted">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      <footer className="muted small">
        Unofficial. From the RDL "Tons of Newsletter", issue #{issue.issue}. Tap a team for its matches, players and stats.
      </footer>
    </main>
  );
}
