/**
 * The league lander, drawn as a bar's cricket scoreboard: "___ vs ___" across the top, then
 * "1st | Division | 2nd" where the board has "01 | Cricket | 01", with the divisions A to H
 * down the middle in place of 20 to 15 and the bull. Tap a division to list its teams.
 */
import { Fragment, useState } from "react";
import type { LeagueDivision, LeagueWeek, Standing } from "../parser/types";
import { ChalkTitle } from "./ChalkTitle";
import { divisionIn, seasonLabel, teamHistory } from "./league";
import { shortDate, todayIso } from "./model";
import { divisionPath, Link, teamPath } from "./route";
import type { SeasonData } from "./store";

export function HomePage({ data, issue, myTeam }: { data?: SeasonData; issue: LeagueWeek; myTeam: { division: string; team: string } | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const mine = myTeam && divisionIn(issue, myTeam.division)?.standings.find((s) => s.team === myTeam.team);
  // The regular season's length, from the hand-entered schedule.
  const seasonWeeks = data?.schedule?.season === issue.season ? data.schedule.weeks.length : null;
  return (
    <main className="lander">
      <div className="board">
        <Corners />
        <img className="board-logo" src={`${import.meta.env.BASE_URL}rdl-logo.png`} alt="" width={96} height={96} />
        <ChalkTitle text="Raleigh Dart League" />
        <p className="board-when">
          {seasonLabel(issue.season)}, week {issue.week}{seasonWeeks ? ` of ${seasonWeeks}` : ""}
          <span className="muted">{shortDate(issue.issueDate)}</span>
        </p>
        {mine && myTeam && <VsLine data={data} mine={{ ...myTeam, standing: mine }} />}
        <div className="cricket" role="table" aria-label="Divisions: the top two teams in each">
          <div className="cricket-head" role="row">
            <span role="columnheader">1st</span>
            <span role="columnheader" className="mid">Division</span>
            <span role="columnheader">2nd</span>
          </div>
          {issue.divisions.map((d) => (
            <Fragment key={d.division}>
              <DivisionRow d={d} open={open === d.division} onToggle={() => setOpen(open === d.division ? null : d.division)} />
              {open === d.division && <TeamList d={d} />}
            </Fragment>
          ))}
        </div>
        <KeyDates dates={data?.schedule?.season === issue.season ? data.schedule.keyDates : []} />
        <p className="board-foot muted small">⊗ clinched. Unofficial, from the RDL newsletter, issue #{issue.issue}.</p>
      </div>
    </main>
  );
}

/** "Area 501 vs Pints and Points": your team and this week's opponent, on the board's vs line. */
function VsLine({ data, mine }: { data?: SeasonData; mine: { division: string; team: string; standing: Standing } }) {
  const now = data ? teamHistory(data, mine.team).at(-1)?.thisWeek : null;
  const opponent = now && !("bye" in now) ? now.opponent : null;
  return (
    <p className="vs-line">
      <Link className="vs-name you" to={teamPath(mine.division, mine.team)}>{mine.team}</Link>
      <span className="vs">{opponent ? "vs" : now ? "bye" : ""}</span>
      {opponent ? <Link className="vs-name" to={teamPath(mine.division, opponent)}>{opponent}</Link> : <span className="vs-name" />}
    </p>
  );
}

const closed = (s?: Standing) => s?.clinched === "C" || s?.clinched === "G";

function DivisionRow({ d, open, onToggle }: { d: LeagueDivision; open: boolean; onToggle: () => void }) {
  const [first, second] = d.standings;
  const side = (s: Standing | undefined) => s && (
    <span className="side-team">
      <span className="side-name">{s.team}{closed(s) && <span className="mark" title="Clinched"> ⊗</span>}</span>
      <span className="side-pts">{s.wins}–{s.losses}</span>
    </span>
  );
  return (
    <button className="cricket-row" aria-expanded={open} aria-label={`${d.division} Division: ${first?.team ?? ""} first, ${second?.team ?? ""} second. Show its teams`} onClick={onToggle}>
      <span className="side left">{side(first)}</span>
      <span className="mid num-chalk">{d.division}</span>
      <span className="side right">{side(second)}</span>
    </button>
  );
}

function TeamList({ d }: { d: LeagueDivision }) {
  return (
    <div className="cricket-teams">
      <ul className="team-list">
        {d.standings.map((s) => (
          <li key={s.team}>
            <Link to={teamPath(d.division, s.team)}>
              <span className="team-rank">{s.rank}</span>
              <span className="team-name">{s.team}</span>
              <span className="muted small">{s.wins}–{s.losses}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="more-link"><Link to={divisionPath(d.division)}>{d.division} Division standings, results and leaderboard</Link></p>
    </div>
  );
}

/** The little curls a printed scoreboard has inside each corner of its border. */
function Corners() {
  const curl = <path d="M2 30 V8 Q2 2 8 2 H30 M2 14 Q8 14 8 8 Q8 4 12 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />;
  return (
    <>
      {(["tl", "tr", "bl", "br"] as const).map((c) => (
        <svg key={c} className={`corner ${c}`} viewBox="0 0 32 32" aria-hidden="true">{curl}</svg>
      ))}
    </>
  );
}

/** Tournaments and the banquet, written along the bottom of the board. Past dates drop off. */
function KeyDates({ dates }: { dates: { date: string; label: string }[] }) {
  const today = todayIso();
  const ahead = dates.filter((d) => d.date >= today);
  if (!ahead.length) return null;
  return (
    <div className="key-dates">
      <h2>Coming up</h2>
      <ul>
        {ahead.map((d) => (
          <li key={d.date}><span className="kd-date">{shortDate(d.date)}</span><span>{d.label}</span></li>
        ))}
      </ul>
    </div>
  );
}
