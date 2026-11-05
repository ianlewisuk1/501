/** One division: standings, this week's matches, last week's results and the player leaderboard. */
import { useMemo, useState } from "react";
import type { LeagueDivision, LeagueWeek, Match } from "../parser/types";
import { Fold } from "./Fold";
import { seasonLabel } from "./league";
import { shortDate, type DivisionPlayer } from "./model";
import { divisionPath, Link, navigate, teamPath } from "./route";
import { GROUPS, PLAYER_COLUMNS, StandingsTable, useSort } from "./ui";

export function DivisionPage({ issue, division }: { issue: LeagueWeek; division: LeagueDivision }) {
  const d = division.division;
  const players = useMemo<DivisionPlayer[]>(
    () => division.teams.flatMap((t) => t.players.map((p) => ({ ...p, team: t.name, code: t.code }))), [division]);
  return (
    <main className="division-page">
      <header className="page-head">
        <h1>{d} Division</h1>
        <p className="meta">{seasonLabel(issue.season)}, week {issue.week}</p>
        <label className="pick-inline">
          <span className="sr-only">Division</span>
          <select value={d} onChange={(e) => navigate(divisionPath(e.target.value))}>
            {issue.divisions.map((x) => <option key={x.division} value={x.division}>{x.division} Division</option>)}
          </select>
        </label>
      </header>
      <section aria-labelledby="standings">
        <h2 id="standings">Standings</h2>
        <StandingsTable standings={division.standings} division={d} />
      </section>
      {division.thisWeek && (
        <section aria-labelledby="matches">
          <h2 id="matches">Week {division.thisWeek.week} matches <span className="muted">{shortDate(issue.issueDate)}</span></h2>
          <ul className="matches">
            {division.thisWeek.matches.map((m) => (
              <li key={m.home}>
                <span className="teams"><Link to={teamPath(d, m.away)}>{m.away}</Link> <span className="muted">at</span> <Link to={teamPath(d, m.home)}>{m.home}</Link></span>
                <span className="muted small">{m.venue}{m.date ? `, played ${shortDate(m.date)}` : ""}</span>
              </li>
            ))}
            {division.thisWeek.byes.map((b) => <li key={b}><span className="teams"><Link to={teamPath(d, b)}>{b}</Link> <span className="muted">has a bye</span></span></li>)}
          </ul>
        </section>
      )}
      {division.results && (
        <section aria-labelledby="results">
          <h2 id="results">Week {division.results.week} results <span className="muted">{shortDate(division.results.date)}</span></h2>
          <ul className="matches">
            {division.results.matches.map((m) => <Result key={m.home.team} match={m} division={d} />)}
            {division.results.byes.map((b) => <li key={b}><span className="teams"><Link to={teamPath(d, b)}>{b}</Link> <span className="muted">has a bye</span></span></li>)}
          </ul>
          <p className="muted small">Home team second. Out of 24 games.</p>
        </section>
      )}
      <Leaderboard week={issue.week} division={d} players={players} />
      <footer className="muted small">
        Unofficial. From the RDL "Tons of Newsletter", issue #{issue.issue}. Stats through week {issue.week - 1}.
      </footer>
    </main>
  );
}

/** "Pints and Points 5 – 19 Area 501", the winner in bold; a forfeit or missing sheet says so. */
function Result({ match, division }: { match: Match; division: string }) {
  const { away, home } = match;
  const winner = away.score === null || home.score === null ? null
    : away.score > home.score || (away.score === home.score && away.tiebreaker1001 === "W") ? away.team
    : home.score > away.score || (away.score === home.score && home.tiebreaker1001 === "W") ? home.team : null;
  const side = (t: typeof away) => (
    <span className={t.team === winner ? "won" : undefined}><Link to={teamPath(division, t.team)}>{t.team}</Link></span>
  );
  return (
    <li>
      <span className="teams">{side(away)} <span className="muted">at</span> {side(home)}</span>
      <span className="score">
        {away.score === null || home.score === null
          ? <span className="muted small">{match.note ?? "no score yet"}</span>
          : <>
              {away.score}–{home.score}
              {away.score === home.score && <span className="muted small">, won on the 1001</span>}
              {match.note && <span className="muted small">, {match.note}</span>}
            </>}
      </span>
    </li>
  );
}

/** Leaderboard categories for the "Rank by" dropdown: plain words for the table's sort keys. */
const RANK_BY: [string, string][] = [
  ["totalPct", "Overall win %"],
  ["singlesPct", "Singles win %"],
  ["doublesPct", "Doubles win %"],
  ["s301", "Singles 301"],
  ["sCricket", "Singles cricket"],
  ["d501", "Doubles 501"],
  ["dCricket", "Doubles cricket"],
  ["aspAvg", "All-star points per game"],
  ["asp", "All-star points, total"],
  ["games", "Games played"],
];
const TOP = 25;

/** Who to list, by games played: everyone who's played, or regulars only, so a 2–0 sub can't top a win % table. */
const GAME_FILTERS: [number, string][] = [[0, "All players"], [5, "More than 5 games"], [20, "More than 20 games"]];

/** Every player in the division: a top 25 for any category, like the newsletter's leaderboards. */
export function Leaderboard({ week, division, players }: { week: number; division: string; players: DivisionPlayer[] }) {
  const all = players;
  // Starts at "more than 20 games" once enough players have that many; early in the season, more than 5.
  const [minGames, setMinGames] = useState<number>(() => (all.filter((p) => p.gamesPlayed > 20).length >= 10 ? 20 : 5));
  const shown = all.filter((p) => p.gamesPlayed > minGames);
  const { rows, sortKey, toggle, sortBy, arrow, ariaSort } = useSort<DivisionPlayer>(shown, PLAYER_COLUMNS, "totalPct");
  const [everyone, setEveryone] = useState(false);
  const start = (i: number) => PLAYER_COLUMNS[i - 1]?.group !== PLAYER_COLUMNS[i].group;
  if (!all.length) return null;
  const listed = everyone ? rows : rows.slice(0, TOP);
  const teams = new Set(all.map((p) => p.code)).size;

  return (
    <section aria-labelledby="division">
      <h2 id="division">Leaderboard <span className="muted">through week {week - 1}</span></h2>
      <Fold show="Show leaderboard" hide="Hide leaderboard"
        summary={<>Top {TOP} of {all.length} players on {teams} teams, in any category: singles, doubles, all-star points per game and more.</>}>
        <label className="rank-by">
          <span>Rank by</span>
          <select value={RANK_BY.some(([k]) => k === sortKey) ? sortKey : ""} onChange={(e) => sortBy(e.target.value)}>
            {!RANK_BY.some(([k]) => k === sortKey) && <option value="">(table heading)</option>}
            {RANK_BY.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
        <fieldset className="games-filter">
          <legend>Show</legend>
          <div className="seg">
            {GAME_FILTERS.map(([n, label]) => (
              <button key={n} type="button" aria-pressed={minGames === n} onClick={() => setMinGames(n)}>{label}</button>
            ))}
          </div>
        </fieldset>
        <div className="scroll-x" tabIndex={0} role="region" aria-label="Division player stats, scrolls sideways">
          <table className="players wide">
            <thead>
              <tr className="groups">
                <th className="sticky" rowSpan={2} aria-sort={ariaSort("name")}>
                  <button onClick={() => toggle("name")}>Player{arrow("name")}</button>
                </th>
                {GROUPS.map((g) => <th key={g.group} colSpan={g.span} className="group">{g.group}</th>)}
              </tr>
              <tr>
                {PLAYER_COLUMNS.map((c, i) => (
                  <th key={c.key} className={`num${start(i) ? " gstart" : ""}`} aria-sort={ariaSort(c.key)}>
                    <button onClick={() => toggle(c.key)}>{c.label}{arrow(c.key)}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listed.map((p, i) => (
                <tr key={`${p.code}-${p.number}`}>
                  <th scope="row" className="sticky">
                    <span className="muted small">{i + 1}.</span> {p.name}
                    <Link className="team small muted" to={teamPath(division, p.team)}>{p.team}</Link>
                  </th>
                  {PLAYER_COLUMNS.map((c, i) => (
                    <td key={c.key} className={`num${start(i) ? " gstart" : ""}${c.key === sortKey ? " sorted" : ""}`}>{c.show(p)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > TOP && (
          <button className="showall" aria-expanded={everyone} onClick={() => setEveryone(!everyone)}>
            {everyone ? `Show top ${TOP} only` : `Show all ${rows.length} players`}
          </button>
        )}
        <p className="muted small">Swipe sideways for every category, or tap a heading to sort by it.</p>
      </Fold>
    </section>
  );
}

