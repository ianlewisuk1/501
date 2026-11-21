/** One team's page: tonight's match, then the opponent, fixtures, players and form. (The standings are on the division page.) */
import { useEffect, useMemo, useState } from "react";
import { fullTeamName } from "../parser/names";
import type { DivisionWeek, TeamWeek } from "../parser/types";
import { PerformanceChart } from "./Chart";
import { Fold, SectionHead } from "./Fold";
import { divisionWeeks, scheduleFor, tournamentMatch, type TournamentState } from "./league";
import {
  breakingNews, buildFixtures, nextTournament, fmtPct, fmtWL, isIOS, mapsUrl, mapsUrls, pct, scoutReport, shortDate, readableMapsUrls, teamTotals, todayIso,
  type DivisionPlayer, type FixtureRow, type ScoutRow,
} from "./model";
import { divisionPath, Link, teamPath } from "./route";
import type { SeasonData } from "./store";
import { pickTeam, sameTeam, useMyTeams } from "./myTeam";
import { resolveVenue, type Venue } from "../parser/venueMatch";
import { Tabs } from "./Tabs";
import { TextShareButtons } from "./Share";
import { PlayerBoard } from "./PlayerBoard";
import { TeamInfo } from "./TeamInfo";
import { BarPhoto } from "./BarPhoto";
import { PHOTOS_ON } from "../photos/core";
import { Arrow, groupSpans, TeamName, NewsletterLink, ordinal, PageHead, Pin, pctCol, useBlackStatusBar, useSort, wlCol, type Column } from "./ui";

export function TeamPage({ data, week, history }: { data: SeasonData; week: TeamWeek; history: TeamWeek[] }) {
  const division = week.team.division;
  const teamSchedule = useMemo(() => scheduleFor(data, week.team.name, division), [data, week, division]);
  const divisions = useMemo(() => divisionWeeks(data, division), [data, division]);
  const today = todayIso();
  const fixtures = useMemo(() => buildFixtures(week, history, teamSchedule, today), [week, history, teamSchedule, today]);
  const ios = useMemo(() => isIOS(), []);
  const maps = (venue: string) => mapsUrl(venue, data.venues, ios);
  const current = fixtures.find((f) => f.status === "current");
  const news = breakingNews(week, teamSchedule?.weeks.length ?? 0, data.news);
  const scout = current && !current.bye ? scoutReport(current.opponent, week, divisions) : null;
  // Page 2's short names for the division's teams ("Menace", "Projectile"), for names that won't fit.
  const shorts = useMemo(() => new Map(data.issues.flatMap((i) => i.divisions.find((d) => d.division === division)?.results?.matches
    .flatMap((m) => [[m.away.team, m.away.short], [m.home.team, m.home.short]] as [string, string][]) ?? [])), [data, division]);
  const cup = useMemo(() => tournamentMatch(data, division, week.team.name, today), [data, division, week, today]);
  useBlackStatusBar();
  // Under the name: its place in the division ("2nd in C Division"), the division a link back to it.
  const place = week.standings.find((s) => s.team === week.team.name);
  const standings = `${divisionPath(division)}?tab=standings`;

  return (
    <>
      {news && <ClinchBanner news={news} />}
      <main className={news ? "team-page under-banner" : "team-page"}>
        {/* Left-aligned, with the way back spelled out (owner, 2026-11-20: the ‹ › arrows to the
            teams either side read as a back button). */}
        <Link className="back-link" to={standings}><Arrow dir="left" />{division} Division standings</Link>
        <PageHead team chalk title={week.team.name}
          meta={<>{place && `${ordinal(place.rank)} in `}<Link className="meta-link" to={standings}>{division} Division</Link></>}>
          <MyTeamButton team={week.team.name} division={division} />
        </PageHead>
        {current ? <Tonight week={week} fixture={current} today={today} venues={data.venues} seasonWeeks={teamSchedule?.weeks.length ?? null} />
          : <Tournament next={nextTournament(data.schedule?.season === week.season ? data.schedule : undefined, today)}
              game={cup} week={week} today={today} venues={data.venues} />}
        <Tabs label="Team sections" tabs={[
          { id: "players", label: "Players", show: week.players.length > 0, body: <Players week={week} /> },
          { id: "form", label: "Form", show: week.players.length > 0, body: <PerformanceChart current={week} divisions={divisions} /> },
          { id: "opponent", label: "Opponent", show: !!scout?.rows.length, body: <Scouting week={week} fixture={current} divisions={divisions} /> },
          { id: "fixtures", label: "Fixtures", show: fixtures.length > 0, body: <Fixtures rows={fixtures} maps={maps} names={week.standings.map((s) => s.team)} shorts={shorts} division={division} expanded /> },
          { id: "info", label: "Info", show: true, body: <TeamInfo week={week} rows={fixtures} venues={data.venues}
              seasonWeeks={teamSchedule?.weeks.length ?? null} tournament={cup} today={today} /> },
        ]} />
        <footer className="muted small">
          <NewsletterLink />
        </footer>
      </main>
    </>
  );
}

/**
 * "This is my team": remembers this team on this device so the front page leads with it.
 * Once picked it says so, with a plain way to undo it. Picking another team replaces it.
 */
function MyTeamButton({ team, division }: { team: string; division: string }) {
  const { picked } = useMyTeams();
  const me = { division, team };
  const mine = sameTeam(picked, me);
  return (
    <button type="button" className={mine ? "my-team-btn is-mine" : "my-team-btn"} aria-pressed={mine}
      title={mine ? "Tap to stop following this team" : "Show this team first on the front page"}
      onClick={() => pickTeam(mine ? null : me)}>
      <Star filled={mine} />{mine ? "My team" : "This is my team"}
    </button>
  );
}

function Star({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8z"
        fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}


/** A slim news ticker strip announcing a clinched title. */
function ClinchBanner({ news }: { news: { headline: string; detail: string } }) {
  return (
    <aside className="breaking" role="status">
      <div className="breaking-inner">
        <span className="breaking-tag"><span className="breaking-dot" aria-hidden="true" />Breaking</span>
        <div className="breaking-track">
          <p className="breaking-scroll">
            <span className="breaking-item"><strong>{news.headline}</strong>{news.detail && `. ${news.detail}`}</span>
            <span className="breaking-item" aria-hidden="true"><strong>{news.headline}</strong>{news.detail && `. ${news.detail}`}</span>
          </p>
        </div>
      </div>
    </aside>
  );
}

/**
 * The next match, laid out the same in the league and the tournament (owner, 2026-11-21): "Next match"
 * with the date (and time, when known) and the share buttons, then what it is (week or round), the
 * opponent, the bar, its address and the map links. The opponent's place is on the Opponent tab.
 */
/** "Dec 2": match nights are always Wednesdays, and the weekday won't fit beside "Next match" on a phone. */
const dayMonth = (iso: string) => shortDate(iso).replace(/^\w+, /, "");

function Tonight({ week, fixture, today, venues, seasonWeeks }: {
  week: TeamWeek; fixture: FixtureRow | undefined; today: string; venues: Venue[] | undefined; seasonWeeks: number | null;
}) {
  if (!fixture) return null;
  const what = <p className="hero-round">Week {fixture.week}{seasonWeeks ? ` of ${seasonWeeks}` : ""}</p>;
  if (fixture.bye) {
    return <section className="card hero"><h2>Next match <span className="hero-when">{dayMonth(fixture.date)}</span></h2>{what}<p className="big">Bye week</p></section>;
  }
  return (
    <section className="card hero" aria-labelledby="tonight">
      <div className="share-row">
        <h2 id="tonight">Next match <span className="hero-when">{fixture.date === today ? "Tonight" : dayMonth(fixture.date)}</span></h2>
        <MatchShare week={week} date={fixture.date} opponent={fixture.opponent} venue={fixture.venue} venues={venues}
          where={`${fixture.home ? "Home" : "Away"} at ${fixture.venue}`} />
      </div>
      {what}
      <p className="big">vs <Link to={teamPath(week.team.division, fixture.opponent)}>{fixture.opponent}</Link></p>
      {/* The bar's photo sits beside the address; it opens (or its send form does) full width below. */}
      <div className="hero-venue">
        <div>
          <p className="hero-where">{fixture.home ? "Home" : "Away"} at {fixture.venue}</p>
          <VenueAddress venue={fixture.venue} venues={venues} />
          <Directions venue={fixture.venue} venues={venues} />
        </div>
        {PHOTOS_ON && <BarPhoto barName={resolveVenue(fixture.venue, venues ?? [])?.name ?? null} />}
      </div>
    </section>
  );
}

/**
 * After the regular season's last night, where the team stands in the bracket, certain facts only:
 * its next game (opponent, or everyone it could still be; seeds, bar and map links); a game played
 * whose result is still to come, with the next round's date; knocked out; or champions. Else the
 * next division tournament night, if the schedule has one.
 */
function Tournament({ next, game, week, today, venues }: {
  next: { date: string; label: string } | null; game: TournamentState | null; week: TeamWeek; today: string; venues: Venue[] | undefined;
}) {
  const division = week.team.division;
  const link = (t: string) => <Link to={teamPath(division, t)}>{t}</Link>;
  if (game?.kind === "pending") {
    return (
      <section className="card hero" aria-labelledby="tonight">
        <h2 id="tonight">Awaiting result of</h2>
        <p className="big">{game.round}{game.opponent && <> vs {link(game.opponent)}</>}</p>
        {game.next && <p className="hero-opp">{game.next.round === "Final" ? "The final is" : `${game.next.round} are`} {shortDate(game.next.date)}</p>}
      </section>
    );
  }
  if (game?.kind === "out") {
    return (
      <section className="card hero" aria-labelledby="tonight">
        <h2 id="tonight">Tournament</h2>
        <p className="big">Out in the {game.round === "Final" ? "final" : `${game.round.toLowerCase()}s`}</p>
        <p className="hero-opp muted">Beaten by {link(game.beatenBy)}</p>
      </section>
    );
  }
  if (game?.kind === "champion") {
    return (
      <section className="card hero" aria-labelledby="tonight">
        <h2 id="tonight">Tournament</h2>
        <p className="big">{division} Division champions</p>
      </section>
    );
  }
  if (game) {
    return (
      <section className="card hero" aria-labelledby="tonight">
        <div className="share-row">
          <h2 id="tonight">Next match <span className="hero-when">{game.date === today ? "Tonight" : dayMonth(game.date)}, 7:00 pm</span></h2>
          {game.venue && (
            <MatchShare week={week} date={game.date} venue={game.venue} venues={venues}
              opponent={game.opponents.length ? game.opponents.join(" or ") : game.opponentText ?? "to be decided"}
              where={`At ${game.venue}`} when={`7:00 pm, ${game.round.toLowerCase()}`} />
          )}
        </div>
        <p className="hero-round">Tournament {game.round}</p>
        <p className="big">vs {game.opponents.length
          ? game.opponents.map((t, i) => <span key={t}>{i > 0 && (i === game.opponents.length - 1 ? " or " : ", ")}{link(t)}</span>)
          : game.opponentText ?? "to be decided"}</p>
        {game.venue && (
          <div className="hero-venue">
            <div>
              <p className="hero-where">At {game.venue}</p>
              <VenueAddress venue={game.venue} venues={venues} />
              <Directions venue={game.venue} venues={venues} />
            </div>
          </div>
        )}
      </section>
    );
  }
  if (!next) return null;
  return (
    <section className="card hero" aria-labelledby="tonight">
      <h2 id="tonight">{next.date === today ? "Tonight" : "Next up"} <span className="muted">{shortDate(next.date)}</span></h2>
      <p className="big">{next.label.replace(/^RDL /, "").replace(/^d/, "D")}</p>
      <p className="hero-opp muted">The regular season is over. Pairings and venues come from the league.</p>
    </section>
  );
}

/**
 * Share the next match as a message (2026-11-20, owner): who, when, where, and both map links
 * written readably, so the team's group chat can tap straight into directions.
 */
function MatchShare({ week, date, opponent, venue, venues, where, when }: {
  week: TeamWeek; date: string; opponent: string; venue: string; venues: Venue[] | undefined; where: string; when?: string;
}) {
  const v = resolveVenue(venue, venues ?? []);
  const urls = readableMapsUrls(venue, venues);
  const us = week.team.name;
  const text = [
    `${us} vs ${opponent}`,
    `${shortDate(date)}${when ? `, ${when}` : ""}`,
    `${where}${v ? `, ${v.street}, ${v.area}` : ""}`,
    "",
    `Google Maps: ${urls.google}`,
  ].join("\n");
  return <TextShareButtons title={`${us} vs ${opponent}`} text={text} />;
}

/** The street address and the league's how-to-find-it note, so the map pin can be checked by eye. */
function VenueAddress({ venue, venues }: { venue: string; venues: Venue[] | undefined }) {
  const v = resolveVenue(venue, venues ?? []);
  if (!v) return null;
  return <p className="venue-addr muted">{v.street}, {v.area}{v.landmark && <span className="venue-landmark">, {v.landmark}</span>}</p>;
}

/** Directions: two chalk links, one per maps app. */
function Directions({ venue, venues }: { venue: string; venues: Venue[] | undefined }) {
  const urls = mapsUrls(venue, venues);
  return (
    <div className="maps">
      <a className="map-link" href={urls.apple} target="_blank" rel="noopener">Map (Apple)</a>
      <a className="map-link" href={urls.google} target="_blank" rel="noopener">Map (Google)</a>
    </div>
  );
}

/** True on a phone-width screen; false in the server-rendered tests and on wider screens. */
function useNarrow(width = 480): boolean {
  const query = `(max-width: ${width}px)`;
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = matchMedia(query);
    setNarrow(m.matches);
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return narrow;
}

/** On a phone the opponent table keeps record, win % and the last few weeks, so it fits without scrolling sideways. */
const scoutColumns = (recentLabel: string | null, narrow = false): Column<ScoutRow>[] => {
  const season: Column<ScoutRow>[] = [
    wlCol("record", "Record", "Season", (p) => p.total),
    // Ties on win % go to whoever has played more, so "best record first" holds by default.
    { key: "pct", label: "Win %", group: "Season", sort: (p) => (pct(p.total) ?? -1) * 1e4 + p.matches, show: (p) => fmtPct(pct(p.total)) },
    { ...pctCol("singles", "Season", (p) => p.singles), label: "Singles" },
    { ...pctCol("doubles", "Season", (p) => p.doubles), label: "Doubles" },
    { key: "matches", label: "Matches", group: "Season", sort: (p) => p.matches, show: (p) => String(p.matches) },
  ];
  const shown = narrow ? season.filter((c) => c.key === "record" || c.key === "pct") : season;
  if (!recentLabel) return shown;
  const recent = wlCol<ScoutRow>("recent", "W–L", recentLabel, (p) => p.recent ?? { w: 0, l: 0 });
  return [...shown, { ...recent, show: (p) => (p.recent ? fmtWL(p.recent) : "–") }];
};

/** Tonight's opponent's players, so we know who to watch for. */
function Scouting({ week, fixture, divisions }: { week: TeamWeek; fixture: FixtureRow | undefined; divisions: DivisionWeek[] }) {
  const report = fixture && !fixture.bye ? scoutReport(fixture.opponent, week, divisions) : null;
  const [from, to] = report?.recentWeeks ?? [0, 0];
  const narrow = useNarrow();
  const columns = scoutColumns(report?.recentWeeks ? `Last ${to - from + 1} wks` : null, narrow);
  const { rows, sortKey, toggle, arrow, ariaSort } = useSort(report?.rows ?? [], columns, "pct");
  const start = (i: number) => i > 0 && columns[i - 1].group !== columns[i].group;
  if (!report?.rows.length) return null;
  return (
    <section aria-labelledby="scouting">
      <SectionHead id="scouting" title={`This Week's Opponent (Week ${fixture!.week})`} detail={<>Week {fixture!.week}: {report.team}</>} />
      <div className="scroll-x" tabIndex={0} role="region" aria-label="Opponent player stats, scrolls sideways">
        <table className="players wide scout">
          <thead>
            <tr className="groups">
              <th className="sticky" rowSpan={2} aria-sort={ariaSort("name")}>
                <button onClick={() => toggle("name")}>Player{arrow("name")}</button>
              </th>
              {groupSpans(columns).map((g) => <th key={g.group} colSpan={g.span} className="group">{g.group}</th>)}
            </tr>
            <tr>
              {columns.map((c, i) => (
                <th key={c.key} className={`num${start(i) ? " gstart" : ""}`} aria-sort={ariaSort(c.key)}>
                  <button onClick={() => toggle(c.key)}>{c.label}{arrow(c.key)}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.number}>
                <th scope="row" className="sticky">{p.name}{p.captain && <> <abbr className="captain" title="Captain">(C)</abbr></>}</th>
                {columns.map((c, i) => (
                  <td key={c.key} className={`num${start(i) ? " gstart" : ""}${c.key === sortKey ? " sorted" : ""}`}>{c.show(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Season stats through week {report.through}
        {report.recentWeeks && <>; "Last {to - from + 1} wks" is weeks {from}–{to} only</>}. Tap a heading to sort.
      </p>
    </section>
  );
}

function Fixtures({ rows, maps, names, shorts, division, expanded = false }: {
  rows: FixtureRow[]; maps: (v: string) => string; names: string[]; shorts: Map<string, string>; division: string; expanded?: boolean;
}) {
  const [more, setAll] = useState(false);
  const all = expanded || more;
  if (!rows.length) return null;
  // Collapsed: last week, this week and next week. Before or after the season, the nearest three.
  const now = rows.findIndex((f) => f.status !== "past");
  const mid = now === -1 ? rows.length - 1 : now;
  const start = Math.max(0, Math.min(mid - 1, rows.length - 3));
  const shown = all ? rows : rows.slice(start, start + 3);
  // The night just played has no score until the next newsletter says so.
  const lastPast = rows.filter((r) => r.status === "past").at(-1)?.week;
  return (
    <section aria-labelledby="fixtures">
      <SectionHead id="fixtures" title="Fixtures" />
      <ol className="fixtures">
        {shown.map((f) => (
          <li key={f.week} className={f.status}>
            <span className="fwk">{f.week}</span>
            <span className="fdate">{shortDate(f.date, false)}</span>
            <span className="fopp">
              {f.bye ? "Bye" : (() => {
                const opp = f.result ? fullTeamName(f.result.opponentShort, names) : f.opponent;
                // One line always, same size: the full name if it fits, else a short one ("Calm", "Blonde Leading").
                return <span className="fname">vs <Link to={teamPath(division, opp)} title={opp}><TeamName team={opp} short={shorts.get(opp)} className="fname-text" /></Link></span>;
              })()}
              {!f.bye && (
                <span className="fwhere">
                  {f.home ? "Home" : "Away"}
                  {f.status !== "past" && (
                    <>, <a className="fvenue" href={maps(f.venue)} target="_blank" rel="noopener"><Pin size={14} />{f.venue}</a></>
                  )}
                </span>
              )}
            </span>
            {/* A fixed column, badge then score, so every W and L lines up down the list. */}
            <span className="fres">
              {f.score ? (
                <><Outcome f={f} /><span className="fscore">{f.score.us}–{f.score.them}</span></>
              ) : f.status === "current" ? <span className="tag">Next</span> : f.status === "past" ? <span className="muted small">{f.week === lastPast ? "Score to come" : "–"}</span> : null}
            </span>
          </li>
        ))}
      </ol>
      {!expanded && rows.length > 3 && (
        <button className="showall" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "Show fewer weeks" : `Show all ${rows.length} weeks`}
        </button>
      )}
    </section>
  );
}

function Players({ week }: { week: TeamWeek }) {
  const team = teamTotals(week.players);
  // The same list as the division's Players tab (2026-11-20, owner), for this team's players only.
  const players = useMemo<DivisionPlayer[]>(() => week.players.map((p) => ({ ...p, team: week.team.name, code: week.team.code })), [week]);
  return (
    <section aria-labelledby="players">
      <SectionHead id="players" title="Players" detail={`Through week ${week.week - 1}. Tap a player for their whole season.`} />
      <Fold show="Show player stats" hide="Hide player stats"
        summary={<>{week.players.length} players. The team is {fmtWL(team.total)} in games, {fmtPct(pct(team.total))} won.</>}>
        <PlayerBoard division={week.team.division} players={players} mine={null} week={week.week} team={week.team.name} />
      </Fold>
    </section>
  );
}


/** W or L, with a 12–12 night going to whoever won the 1001 tiebreaker. */
function Outcome({ f }: { f: FixtureRow }) {
  const { us, them } = f.score!;
  const tb = f.result?.tiebreaker1001;
  const r = us > them || (us === them && tb === "W") ? "W" : us < them || (us === them && tb === "L") ? "L" : "T";
  return <span className={`badge ${r === "W" ? "win" : r === "L" ? "loss" : "tie"}`} title={us === them && r !== "T" ? "Decided by the 1001 tiebreaker" : undefined}>{r}</span>;
}

