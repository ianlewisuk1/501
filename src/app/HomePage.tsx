/**
 * The league lander, built to get anyone to their team in two taps: your team (once you've
 * opened one), then a big button per division that lists its teams.
 */
import { useState } from "react";
import type { LeagueWeek } from "../parser/types";
import { divisionIn, seasonLabel } from "./league";
import { shortDate } from "./model";
import { divisionPath, Link, teamPath } from "./route";

export function HomePage({ issue, myTeam }: { issue: LeagueWeek; myTeam: { division: string; team: string } | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const mine = myTeam && divisionIn(issue, myTeam.division)?.standings.find((s) => s.team === myTeam.team);
  const shown = open ? divisionIn(issue, open) : undefined;
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
      <h2 className="find">{mine ? "Find another team" : "Find your team"}</h2>
      <div className="div-grid">
        {issue.divisions.map((d) => {
          const leader = d.standings[0];
          return (
            <button key={d.division} className="div-btn" aria-expanded={open === d.division} aria-controls="div-teams"
              onClick={() => setOpen(open === d.division ? null : d.division)}>
              <span className="div-letter">{d.division}</span>
              <span className="div-label">Division</span>
              {leader && <span className="div-leader small">1st: {leader.team}</span>}
            </button>
          );
        })}
      </div>
      {shown && (
        <section id="div-teams" aria-labelledby="div-teams-head">
          <h2 id="div-teams-head">{shown.division} Division</h2>
          <ul className="team-list">
            {shown.standings.map((s) => (
              <li key={s.team}>
                <Link to={teamPath(shown.division, s.team)}>
                  <span className="team-rank">{s.rank}</span>
                  <span className="team-name">{s.team}</span>
                  <span className="muted small">{s.wins}–{s.losses}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="more-link"><Link to={divisionPath(shown.division)}>Standings, results and leaderboard ›</Link></p>
        </section>
      )}
      <footer className="muted small">
        Unofficial. From the RDL "Tons of Newsletter", issue #{issue.issue}.
      </footer>
    </main>
  );
}
