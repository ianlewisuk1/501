/** One team's page: tonight's match, then the opponent, fixtures, players and form. (The standings are on the division page.) */
import { useEffect, useMemo, useState } from "react";
import { fullTeamName } from "../parser/names";
import type { DivisionWeek, TeamWeek } from "../parser/types";
import { PerformanceChart } from "./Chart";
import { Fold, SectionHead } from "./Fold";
import { divisionWeeks, scheduleFor } from "./league";
import {
  breakingNews, buildFixtures, findStanding, fmtPct, fmtWL, isIOS, mapsUrl, mapsUrls, pct, scoutReport, shortDate, teamTotals, todayIso,
  type FixtureRow, type ScoutRow,
} from "./model";
import { Link, teamPath } from "./route";
import type { SeasonData } from "./store";
import { pickTeam, sameTeam, useMyTeams } from "./myTeam";
import { resolveVenue, type Venue } from "../parser/venueMatch";
import { Tabs } from "./Tabs";
import { Arrow, groupSpans, GROUPS, ordinal, PageHead, Pin, PLAYER_COLUMNS, pctCol, useBlackStatusBar, useSort, wlCol, type Column } from "./ui";

export function TeamPage({ data, week, history }: { data: SeasonData; week: TeamWeek; history: TeamWeek[] }) {
  const division = week.team.division;
  const teamSchedule = useMemo(() => scheduleFor(data, week.team.name, division), [data, week, division]);
  const divisions = useMemo(() => divisionWeeks(data, division), [data, division]);
  const fixtures = useMemo(() => buildFixtures(week, history, teamSchedule), [week, history, teamSchedule]);
  const ios = useMemo(() => isIOS(), []);
  const maps = (venue: string) => mapsUrl(venue, data.venues, ios);
  const today = todayIso();
  const current = fixtures.find((f) => f.status === "current");
  const news = breakingNews(week, teamSchedule?.weeks.length ?? 0, data.news);
  const scout = current && !current.bye ? scoutReport(current.opponent, week, divisions) : null;
  useBlackStatusBar();
  // The teams either side in the standings, wrapping round, for the arrows by the name.
  const order = week.standings.map((s) => s.team);
  const at = order.indexOf(week.team.name);
  const prev = order[(at - 1 + order.length) % order.length];
  const next = order[(at + 1) % order.length];

  return (
    <>
      {news && <ClinchBanner news={news} />}
      <main className={news ? "team-page under-banner" : "team-page"}>
        <div className="div-head">
          {order.length > 1 && <Link className="div-step" to={teamPath(division, prev)} aria-label={`Previous team: ${prev}`}><Arrow dir="left" /></Link>}
          <PageHead team chalk title={week.team.name} meta={`${division} Division, week ${week.week}${teamSchedule?.weeks.length ? ` of ${teamSchedule.weeks.length}` : ""}`}>
            <MyTeamButton team={week.team.name} division={division} />
          </PageHead>
          {order.length > 1 && <Link className="div-step" to={teamPath(division, next)} aria-label={`Next team: ${next}`}><Arrow dir="right" /></Link>}
        </div>
        <Tonight week={week} fixture={current} today={today} venues={data.venues} />
        <Tabs label="Team sections" tabs={[
          { id: "players", label: "Players", show: week.players.length > 0, body: <Players week={week} /> },
          { id: "form", label: "Form", show: week.players.length > 0, body: <PerformanceChart current={week} divisions={divisions} /> },
          { id: "opponent", label: "Opponent", show: !!scout?.rows.length, body: <Scouting week={week} fixture={current} divisions={divisions} /> },
          { id: "fixtures", label: "Fixtures", show: fixtures.length > 0, body: <Fixtures rows={fixtures} maps={maps} names={week.standings.map((s) => s.team)} division={division} expanded /> },
        ]} />
        <footer className="muted small">
          Unofficial. From the RDL "Tons of Newsletter", issue #{week.issue}. Stats through week {week.week - 1}.
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

function Tonight({ week, fixture, today, venues }: { week: TeamWeek; fixture: FixtureRow | undefined; today: string; venues: Venue[] | undefined }) {
  if (!fixture) return null;
  const heading = fixture.date === today ? "Tonight" : fixture.date > today ? "Next match" : "This week";
  if (fixture.bye) {
    return <section className="card hero"><h2>{heading}</h2><p className="big">Bye week</p></section>;
  }
  const opp = findStanding(fixture.opponent, week.standings);
  // Compact: who, where and the two map buttons, so the tabs still show on the first screen.
  return (
    <section className="card hero" aria-labelledby="tonight">
      <h2 id="tonight">{heading} <span className="muted">{shortDate(fixture.date)}</span></h2>
      <p className="big">vs <Link to={teamPath(week.team.division, fixture.opponent)}>{fixture.opponent}</Link></p>
      {opp && <p className="hero-opp muted">{ordinal(opp.rank)} in {week.team.division}, {opp.wins}–{opp.losses}</p>}
      <p className="hero-where">{fixture.home ? "Home" : "Away"} at {fixture.venue}</p>
      <VenueAddress venue={fixture.venue} venues={venues} />
      <Directions venue={fixture.venue} venues={venues} />
    </section>
  );
}

/** The street address and the league's how-to-find-it note, so the map pin can be checked by eye. */
function VenueAddress({ venue, venues }: { venue: string; venues: Venue[] | undefined }) {
  const v = resolveVenue(venue, venues ?? []);
  if (!v) return null;
  return <p className="venue-addr muted">{v.street}, {v.area}{v.landmark && <span className="venue-landmark">, {v.landmark}</span>}</p>;
}

/** Directions buttons styled after each maps app's own buttons (no logos: they're trademarks). */
function Directions({ venue, venues }: { venue: string; venues: Venue[] | undefined }) {
  const urls = mapsUrls(venue, venues);
  return (
    <div className="maps">
      <a className="map-btn apple" href={urls.apple} target="_blank" rel="noopener">
        <Pin /> Apple Maps
      </a>
      <a className="map-btn google" href={urls.google} target="_blank" rel="noopener">
        <span className="gpin"><Pin /></span> Google Maps
      </a>
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
                <th scope="row" className="sticky">{p.name}</th>
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

function Fixtures({ rows, maps, names, division, expanded = false }: { rows: FixtureRow[]; maps: (v: string) => string; names: string[]; division: string; expanded?: boolean }) {
  const [more, setAll] = useState(false);
  const all = expanded || more;
  if (!rows.length) return null;
  // Collapsed: last week, this week and next week. Before or after the season, the nearest three.
  const now = rows.findIndex((f) => f.status !== "past");
  const mid = now === -1 ? rows.length - 1 : now;
  const start = Math.max(0, Math.min(mid - 1, rows.length - 3));
  const shown = all ? rows : rows.slice(start, start + 3);
  return (
    <section aria-labelledby="fixtures">
      <SectionHead id="fixtures" title="Fixtures" />
      <ol className="fixtures">
        {shown.map((f) => (
          <li key={f.week} className={f.status}>
            <span className="fwk">{f.week}</span>
            <span className="fdate">{shortDate(f.date, false)}</span>
            <span className="fopp">
              {f.bye ? "Bye" : <>vs <Link to={teamPath(division, f.result ? fullTeamName(f.result.opponentShort, names) : f.opponent)}>{f.result ? fullTeamName(f.result.opponentShort, names) : f.opponent}</Link></>}
              {!f.bye && (
                <span className="fwhere">
                  {f.home ? "Home" : "Away"}
                  {f.status !== "past" && (
                    <>, <a className="fvenue" href={maps(f.venue)} target="_blank" rel="noopener"><Pin size={14} />{f.venue}</a></>
                  )}
                </span>
              )}
            </span>
            <span className="fres">
              {f.score ? (
                <><Outcome f={f} /> {f.score.us}–{f.score.them}</>
              ) : f.status === "current" ? <span className="tag">Next</span> : f.status === "past" ? <span className="muted">–</span> : null}
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
  const { rows, sortKey, toggle, arrow, ariaSort } = useSort(week.players, PLAYER_COLUMNS, "totalPct");
  const team = teamTotals(week.players);
  const start = (i: number) => PLAYER_COLUMNS[i - 1]?.group !== PLAYER_COLUMNS[i].group;

  return (
    <section aria-labelledby="players">
      <SectionHead id="players" title="Players" detail={`Through week ${week.week - 1}`} />
      <Fold show="Show player stats" hide="Hide player stats"
        summary={<>{week.players.length} players. The team is {fmtWL(team.total)} in games, {fmtPct(pct(team.total))} won.</>}>
        <div className="scroll-x" tabIndex={0} role="region" aria-label="Player stats, scrolls sideways">
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
              {rows.map((p) => (
                <tr key={p.number}>
                  <th scope="row" className="sticky">{p.name} <span className="muted small">#{p.number}</span></th>
                  {PLAYER_COLUMNS.map((c, i) => (
                    <td key={c.key} className={`num${start(i) ? " gstart" : ""}${c.key === sortKey ? " sorted" : ""}`}>{c.show(p)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="sticky">Team total</th>
                {PLAYER_COLUMNS.map((c, i) => (
                  <td key={c.key} className={`num${start(i) ? " gstart" : ""}`}>{c.key === "matches" ? "" : c.show(team)}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="muted small">Swipe sideways for every category. Tap a heading to sort.</p>
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

