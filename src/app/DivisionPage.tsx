/** One division, in tabs: standings, matches (this week's and last week's results) and the player leaderboard. */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { LeagueDivision, LeagueWeek, Match } from "../parser/types";
import { Fold, SectionHead } from "./Fold";
import { divisionRounds, seasonLabel, type DivisionRound } from "./league";
import { shortDate, type DivisionPlayer } from "./model";
import { divisionPath, Link, navigate, teamPath } from "./route";
import type { SeasonData } from "./store";
import { Tabs } from "./Tabs";
import { chalkFor, GROUPS, ordinal, PageHead, PLAYER_COLUMNS, StandingsTable, useSort } from "./ui";

export function DivisionPage({ data, issue, division }: { data: SeasonData; issue: LeagueWeek; division: LeagueDivision }) {
  const d = division.division;
  const players = useMemo<DivisionPlayer[]>(
    () => division.teams.flatMap((t) => t.players.map((p) => ({ ...p, team: t.name, code: t.code }))), [division]);
  const rounds = useMemo(() => divisionRounds(data, d), [data, d]);
  const seasonWeeks = data.schedule?.season === issue.season ? data.schedule.weeks.length : null;
  return (
    <main className="division-page">
      <PageHead title={`${d} Division`} meta={`${seasonLabel(issue.season)}, week ${issue.week}${seasonWeeks ? ` of ${seasonWeeks}` : ""}`}>
        <label className="page-pick">
          <span className="sr-only">Show another division</span>
          <select value={d} onChange={(e) => navigate(divisionPath(e.target.value))}>
            {issue.divisions.map((x) => <option key={x.division} value={x.division}>{x.division} Division</option>)}
          </select>
        </label>
      </PageHead>
      <Tabs label="Division sections" tabs={[
        {
          id: "standings", label: "Standings", show: true,
          body: (
            <section aria-labelledby="standings">
              <SectionHead id="standings" title="Standings" />
              <StandingsTable standings={division.standings} division={d} />
            </section>
          ),
        },
        { id: "matches", label: "Matches", show: rounds.length > 0, body: <Matches rounds={rounds} now={issue.week} division={division} /> },
        { id: "leaderboard", label: "Leaderboard", show: players.length > 0, body: <Leaderboard week={issue.week} division={d} players={players} /> },
      ]} />
      <footer className="muted small">
        Unofficial. From the RDL "Tons of Newsletter", issue #{issue.issue}. Stats through week {issue.week - 1}.
      </footer>
    </main>
  );
}

/** The week in the link (?week=12), so a shared link opens on the same week. */
const weekFromUrl = (): number | null => {
  const w = typeof location === "undefined" ? null : Number(new URLSearchParams(location.search).get("week"));
  return w || null;
};

/**
 * Every week's matches, one week at a time: big back and forward buttons either side of a plain
 * dropdown of the weeks. Opens on this week. Played weeks show scores, the rest show venues.
 */
function Matches({ rounds, now, division }: { rounds: DivisionRound[]; now: number; division: LeagueDivision }) {
  const [picked, setPicked] = useState(() => weekFromUrl() ?? now);
  // The picked week, else this week, else the latest one there is.
  const find = (w: number) => rounds.findIndex((r) => r.week === w);
  const at = [find(picked), find(now), rounds.length - 1].find((k) => k >= 0)!;
  const round = rounds[at];
  const go = (week: number) => {
    setPicked(week);
    const url = new URL(location.href);
    if (week === now) url.searchParams.delete("week");
    else url.searchParams.set("week", String(week));
    history.replaceState(null, "", url);
  };
  const label = (r: DivisionRound) => `Week ${r.week}${r.week === now ? " (this week)" : ""}`;
  return (
    <section aria-labelledby="matches">
      <h2 id="matches" className="sr-only">Matches</h2>
      <div className="week-step">
        <button type="button" aria-label="Previous week" disabled={at === 0} onClick={() => go(rounds[at - 1].week)}>‹</button>
        <label>
          <span className="sr-only">Week</span>
          <select value={round.week} onChange={(e) => go(Number(e.target.value))}>
            {rounds.map((r) => <option key={r.week} value={r.week}>{label(r)}</option>)}
          </select>
        </label>
        <button type="button" aria-label="Next week" disabled={at === rounds.length - 1} onClick={() => go(rounds[at + 1].week)}>›</button>
      </div>
      <p className="tab-note">{shortDate(round.date)}: {round.played ? "final scores" : round.week === now ? "this week's matches" : "still to play"}</p>
      <ul className="cards">
        {round.played
          ? round.matches.map((m) => <ResultCard key={m.home.team} match={m} division={division} />)
          : round.matches.map((m) => (
              <MatchCard key={m.home} division={division}
                rows={[{ team: m.away }, { team: m.home }]}
                status={shortDate(m.date ?? round.date)}
                aside={m.venue} />
            ))}
        {round.byes.map((b) => <MatchCard key={b} division={division} rows={[{ team: b }]} status="Bye" />)}
      </ul>
      <p className="muted small">Home team second.{round.played ? " Out of 24 games." : ""} Places and records are from the current standings.</p>
    </section>
  );
}

/** Short words left out of a team's monogram. */
const SMALL = new Set(["and", "the", "a", "of", "&", "n", "'n"]);
/** Two letters for a team's chalk crest, where a sports site puts the logo: "Pints and Points" is PP. */
export const monogram = (team: string) => {
  const words = team.replace(/[^\p{L}\p{N}&'\- ]/gu, " ").split(/\s+/).filter(Boolean);
  const big = words.filter((w) => !SMALL.has(w.toLowerCase()));
  const use = big.length ? big : words;
  return (use.length > 1 ? use[0][0] + use[1][0] : use[0]?.slice(0, 2) ?? "").toUpperCase();
};

interface CardRow { team: string; score?: number | null; won?: boolean; lost?: boolean }

/**
 * A team name that always fits on one line: when it is too wide for its space, its text is
 * scaled down just enough (re-measured whenever the space changes size).
 */
function FitName({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      // Text doesn't shrink exactly in proportion, so step down until it fits (or hits the floor).
      for (let i = 0; i < 6 && el.scrollWidth > el.clientWidth; i++) {
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size <= 11) break;
        el.style.fontSize = `${Math.max(11, Math.floor((size * el.clientWidth) / el.scrollWidth * 10) / 10 - 0.2)}px`;
      }
    };
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(el.parentElement ?? el);
    return () => watch.disconnect();
  }, [name]);
  return <span ref={ref} className="side-name">{name}</span>;
}

/**
 * One match as a sports scoreboard card: a strip along the top with the status (Final, or the
 * day) and the venue, then a row per team: crest, place, name and record, score, a mark by the winner.
 */
function MatchCard({ rows, status, aside, note, division }: { rows: CardRow[]; status: string; aside?: string; note?: string; division: LeagueDivision }) {
  return (
    <li className={`card${rows.some((r) => r.score != null) ? "" : " unplayed"}`}>
      <p className="card-head"><span className="card-status">{status}</span>{aside && <span className="card-aside">{aside}</span>}</p>
      {rows.map((r) => {
        const s = division.standings.find((x) => x.team === r.team);
        return (
          <Link key={r.team} className={`card-row${r.won ? " won" : ""}${r.lost ? " lost" : ""}`} to={teamPath(division.division, r.team)}>
            <span className="crest" style={{ color: chalkFor(r.team) }} aria-hidden="true">{monogram(r.team)}</span>
            <span className="rank-tag" title={s ? `${ordinal(s.rank)} in the standings` : undefined}>{s?.rank}</span>
            <span className="card-name">
              <FitName name={r.team} />
              {s && <span className="card-rec">{s.wins}–{s.losses}</span>}
            </span>
            <span className="card-score">{r.score ?? ""}</span>
            <span className="card-mark" aria-label={r.won ? "won" : undefined}>{r.won ? "◂" : ""}</span>
          </Link>
        );
      })}
      {note && <p className="card-foot">{note}</p>}
    </li>
  );
}

/** A played match: scores, the winner marked (a 12–12 goes to whoever won the 1001), any forfeit or missing-sheet note. */
function ResultCard({ match, division }: { match: Match; division: LeagueDivision }) {
  const { away, home } = match;
  const scored = away.score !== null && home.score !== null;
  const winner = !scored ? null
    : away.score! > home.score! || (away.score === home.score && away.tiebreaker1001 === "W") ? away.team
    : home.score! > away.score! || (away.score === home.score && home.tiebreaker1001 === "W") ? home.team : null;
  const row = (t: typeof away): CardRow => ({ team: t.team, score: t.score, won: t.team === winner, lost: !!winner && t.team !== winner });
  const status = !scored ? "No score yet" : "Final";
  const aside = scored && away.score === home.score ? "Won on the 1001" : undefined;
  return <MatchCard rows={[row(away), row(home)]} status={status} aside={aside} note={match.note} division={division} />;
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
      <SectionHead id="division" title="Leaderboard" detail={`Through week ${week - 1}`} />
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

