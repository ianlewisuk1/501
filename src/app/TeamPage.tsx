/** One team's page: tonight's match, the opponent, standings, fixtures, players and charts. */
import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { fullTeamName } from "../parser/names";
import type { DivisionWeek, TeamWeek } from "../parser/types";
import { PerformanceChart } from "./Chart";
import { Fold, SectionHead, Unfolded } from "./Fold";
import { divisionWeeks, scheduleFor } from "./league";
import {
  breakingNews, buildFixtures, findStanding, fmtPct, fmtWL, isIOS, mapsUrl, mapsUrls, pct, scoutReport, shortDate, teamTotals, todayIso,
  type FixtureRow, type ScoutRow, type SeasonSchedule,
} from "./model";
import { divisionPath, Link, navigate, teamPath } from "./route";
import type { SeasonData } from "./store";
import { groupSpans, GROUPS, ordinal, Pin, PLAYER_COLUMNS, pctCol, StandingsTable, useSort, wlCol, type Column } from "./ui";

export function TeamPage({ data, week, history }: { data: SeasonData; week: TeamWeek; history: TeamWeek[] }) {
  const division = week.team.division;
  const teamSchedule = useMemo(() => scheduleFor(data, week.team.name, division), [data, week, division]);
  const divisions = useMemo(() => divisionWeeks(data, division), [data, division]);
  const fixtures = useMemo(() => buildFixtures(week, history, teamSchedule), [week, history, teamSchedule]);
  const ios = useMemo(() => isIOS(), []);
  const maps = (venue: string) => mapsUrl(venue, data.schedule, ios);
  const today = todayIso();
  const current = fixtures.find((f) => f.status === "current");
  const news = breakingNews(week, teamSchedule?.weeks.length ?? 0, data.news);
  const scout = current && !current.bye ? scoutReport(current.opponent, week, divisions) : null;

  return (
    <>
      {news && <ClinchBanner news={news} />}
      <main className={news ? "under-banner" : undefined}>
        <header className="brand">
          <div>
            <h1 className={week.team.name.length > 10 ? "long" : undefined}>{week.team.name}</h1>
            <p className="meta">{division} Division, week {week.week}{teamSchedule?.weeks.length ? ` of ${teamSchedule.weeks.length}` : ""}</p>
          </div>
          <TeamPicker team={week.team.name} division={division} names={week.standings.map((s) => s.team)} />
        </header>
        <Tonight week={week} fixture={current} today={today} schedule={data.schedule} />
        <Tabs tabs={[
          { id: "opponent", label: "Opponent", show: !!scout?.rows.length, body: <Scouting week={week} fixture={current} divisions={divisions} /> },
          { id: "standings", label: "Standings", show: true, body: <Standings week={week} /> },
          { id: "fixtures", label: "Fixtures", show: fixtures.length > 0, body: <Fixtures rows={fixtures} maps={maps} names={week.standings.map((s) => s.team)} division={division} expanded /> },
          { id: "players", label: "Players", show: week.players.length > 0, body: <Players week={week} /> },
          { id: "form", label: "Form", show: week.players.length > 0, body: <PerformanceChart current={week} history={history} fixtures={fixtures} /> },
        ]} />
        <footer className="muted small">
          Unofficial. From the RDL "Tons of Newsletter", issue #{week.issue}. Stats through week {week.week - 1}.
        </footer>
      </main>
    </>
  );
}

/** A big plain dropdown of every team in the division, A to Z. */
function TeamPicker({ team, division, names }: { team: string; division: string; names: string[] }) {
  if (names.length < 2) return null;
  return (
    <label className="team-pick">
      <span className="sr-only">Show another team in the division</span>
      <select value={team} onChange={(e) => navigate(teamPath(division, e.target.value))}>
        {[...names].sort((a, b) => a.localeCompare(b)).map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </label>
  );
}

/** A slim news ticker strip announcing a clinched title or top-two finish. */
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

function Tonight({ week, fixture, today, schedule }: { week: TeamWeek; fixture: FixtureRow | undefined; today: string; schedule: SeasonSchedule | undefined }) {
  if (!fixture) return null;
  const heading = fixture.date === today ? "Tonight" : fixture.date > today ? "Next match" : "This week";
  if (fixture.bye) {
    return <section className="card hero"><h2>{heading}</h2><p className="big">Bye week</p></section>;
  }
  const opp = findStanding(fixture.opponent, week.standings);
  return (
    <section className="card hero" aria-labelledby="tonight">
      <h2 id="tonight">{heading} <span className="muted">{shortDate(fixture.date)}</span></h2>
      <p className="big">vs <Link to={teamPath(week.team.division, fixture.opponent)}>{fixture.opponent}</Link></p>
      {opp && <p className="muted">They're {ordinal(opp.rank)} in {week.team.division} at {opp.wins}–{opp.losses}, {opp.points} points</p>}
      <p>{fixture.home ? "Home" : "Away"}, at {fixture.venue}</p>
      <Directions venue={fixture.venue} schedule={schedule} />
    </section>
  );
}

/** Directions buttons styled after each maps app's own buttons (no logos: they're trademarks). */
function Directions({ venue, schedule }: { venue: string; schedule: SeasonSchedule | undefined }) {
  const urls = mapsUrls(venue, schedule);
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

const scoutColumns = (recentLabel: string | null): Column<ScoutRow>[] => {
  const season: Column<ScoutRow>[] = [
    wlCol("record", "Record", "Season", (p) => p.total),
    // Ties on win % go to whoever has played more, so "best record first" holds by default.
    { key: "pct", label: "Win %", group: "Season", sort: (p) => (pct(p.total) ?? -1) * 1e4 + p.matches, show: (p) => fmtPct(pct(p.total)) },
    { ...pctCol("singles", "Season", (p) => p.singles), label: "Singles" },
    { ...pctCol("doubles", "Season", (p) => p.doubles), label: "Doubles" },
    { key: "matches", label: "Matches", group: "Season", sort: (p) => p.matches, show: (p) => String(p.matches) },
  ];
  if (!recentLabel) return season;
  const recent = wlCol<ScoutRow>("recent", "W–L", recentLabel, (p) => p.recent ?? { w: 0, l: 0 });
  return [...season, { ...recent, show: (p) => (p.recent ? fmtWL(p.recent) : "–") }];
};

/** Tonight's opponent's players, so we know who to watch for. */
function Scouting({ week, fixture, divisions }: { week: TeamWeek; fixture: FixtureRow | undefined; divisions: DivisionWeek[] }) {
  const report = fixture && !fixture.bye ? scoutReport(fixture.opponent, week, divisions) : null;
  const [from, to] = report?.recentWeeks ?? [0, 0];
  const columns = scoutColumns(report?.recentWeeks ? `Last ${to - from + 1} wks` : null);
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

function Standings({ week }: { week: TeamWeek }) {
  const us = week.standings.find((s) => s.team === week.team.name);
  const leader = week.standings[0];
  const second = week.standings[1];
  const gap = !us || !leader ? null
    : us === leader ? (second ? `${us.points - second.points} pts clear of 2nd` : null)
    : `${leader.points - us.points} pts behind 1st`;
  return (
    <section aria-labelledby="standings">
      <SectionHead id="standings" title="Standings" detail={gap} />
      <StandingsTable standings={week.standings} division={week.team.division} highlight={week.team.name} />
      <p className="more-link"><Link to={divisionPath(week.team.division)}>All of {week.team.division} Division: results, matches and the player leaderboard</Link></p>
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

interface Tab { id: string; label: string; show: boolean; body: ReactNode }

/** The tab in the link (?tab=fixtures), so a shared link opens on the same one. */
const tabFromUrl = (): string | null => (typeof location === "undefined" ? null : new URLSearchParams(location.search).get("tab"));

/**
 * Big chalk tabs under tonight's match: one section at a time, so the page stays about a screen
 * tall. Every panel is in the page (hidden ones too), so find-in-page and screen readers still work.
 */
function Tabs({ tabs }: { tabs: Tab[] }) {
  const shown = tabs.filter((t) => t.show);
  const [picked, setPicked] = useState(() => tabFromUrl());
  const active = shown.find((t) => t.id === picked)?.id ?? shown[0]?.id;
  const pick = (id: string) => {
    setPicked(id);
    const url = new URL(location.href);
    if (id === shown[0]?.id) url.searchParams.delete("tab");
    else url.searchParams.set("tab", id);
    history.replaceState(null, "", url);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = shown.findIndex((t) => t.id === active);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
    if (next === null) return;
    const t = shown[(next + shown.length) % shown.length];
    pick(t.id);
    document.getElementById(`tab-${t.id}`)?.focus();
  };
  if (!shown.length) return null;
  return (
    <div className="tabs">
      <div className="tab-row" role="tablist" aria-label="Team sections" onKeyDown={onKey}>
        {shown.map((t) => (
          <button key={t.id} id={`tab-${t.id}`} role="tab" aria-selected={t.id === active} aria-controls={`panel-${t.id}`}
            tabIndex={t.id === active ? 0 : -1} onClick={() => pick(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <Unfolded.Provider value={true}>
        {shown.map((t) => (
          <div key={t.id} id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`} hidden={t.id !== active} className="tab-panel">
            {t.body}
          </div>
        ))}
      </Unfolded.Provider>
    </div>
  );
}
