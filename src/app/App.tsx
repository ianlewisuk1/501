import { useEffect, useMemo, useState } from "react";
import { fullTeamName } from "../parser/names";
import { TEAM } from "../parser/team";
import type { Player, Standing, TeamWeek, WL } from "../parser/types";
import { PerformanceChart } from "./Chart";
import { Fold } from "./Fold";
import { TeamArt } from "./TeamArt";
import { current, divisions, historyOf, schedule, scheduleOf, teamNames } from "./data";
import {
  buildFixtures, clinchNews, divisionPlayers, editorPick, regularMatches, type DivisionPlayer, findStanding, teamSlug, fmtPct, fmtWL, isIOS, mapsUrl, mapsUrls, pct, scoutReport, shortDate, teamTotals, todayIso, type FixtureRow, type ScoutRow,
} from "./model";

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 >> 3 ^ 1 && n % 10] || "th"}`;

/** The team in the ?team= link, or ours. */
function teamFromUrl(): string {
  const slug = typeof location === "undefined" ? null : new URLSearchParams(location.search).get("team");
  return teamNames.find((t) => teamSlug(t) === slug) ?? TEAM.name;
}

export function App() {
  const [team, setTeam] = useState(teamFromUrl);
  const issues = useMemo(() => historyOf(team), [team]);
  useTeamTheme(team);
  const week = issues.at(-1);
  if (!current || !week) return <main><h1>Area 501</h1><p>No newsletter parsed yet.</p></main>;
  const pick = (name: string) => {
    setTeam(name);
    const url = new URL(location.href);
    if (name === TEAM.name) url.searchParams.delete("team");
    else url.searchParams.set("team", teamSlug(name));
    window.history.replaceState(null, "", url);
  };
  // Keyed by team so sorting, chart picks and the expanded fixtures list start fresh.
  return <Page key={team} week={week} history={issues} onTeam={pick} />;
}

/** Swap to the team's palette (themes.css) and tint the phone's status bar to match its header. */
function useTeamTheme(team: string) {
  useEffect(() => {
    const root = document.documentElement;
    if (team === TEAM.name) delete root.dataset.team;
    else root.dataset.team = teamSlug(team);
    const header = getComputedStyle(root).getPropertyValue("--navy").trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", header);
  }, [team]);
}

/** A big plain dropdown of every team in the division, A to Z. */
function TeamPicker({ team, onTeam }: { team: string; onTeam: (name: string) => void }) {
  if (teamNames.length < 2) return null;
  return (
    <label className="team-pick">
      <span>Show team</span>
      <select value={team} onChange={(e) => onTeam(e.target.value)}>
        {teamNames.map((t) => <option key={t} value={t}>{t}{t === TEAM.name ? " (us)" : ""}</option>)}
      </select>
    </label>
  );
}

function Page({ week, history, onTeam }: { week: TeamWeek; history: TeamWeek[]; onTeam: (name: string) => void }) {
  const teamSchedule = useMemo(() => scheduleOf(week.team.name), [week]);
  const fixtures = useMemo(() => buildFixtures(week, history, teamSchedule), [week, history, teamSchedule]);
  const ios = useMemo(() => isIOS(), []);
  const maps = (venue: string) => mapsUrl(venue, schedule, ios);
  const today = todayIso();

  return (
    <main>
      <ClinchBanner week={week} seasonWeeks={teamSchedule?.weeks.length ?? 0} />
      <header className="brand">
        <TeamArt team={week.team.name} />
        <h1 className={week.team.name.length > 10 ? "long" : undefined}>{week.team.name}</h1>
        <p className="meta">{week.team.division} Division · Week {week.week}</p>
        <TeamPicker team={week.team.name} onTeam={onTeam} />
      </header>
      <Tonight week={week} fixture={fixtures.find((f) => f.status === "current")} today={today} />
      <Scouting week={week} fixture={fixtures.find((f) => f.status === "current")} />
      <Standings week={week} />
      <Fixtures rows={fixtures} maps={maps} names={week.standings.map((s) => s.team)} />
      <Players week={week} />
      <Division week={week} />
      <PerformanceChart current={week} history={history} fixtures={fixtures} />
      <KeyDates today={today} />
      <footer className="muted small">
        Unofficial. From the RDL "Tons of Newsletter", issue #{week.issue}. Stats through week {week.week - 1}.
      </footer>
    </main>
  );
}

/** A news-style strip announcing a clinched title or top-two finish. */
function ClinchBanner({ week, seasonWeeks }: { week: TeamWeek; seasonWeeks: number }) {
  const news = clinchNews(week, seasonWeeks);
  if (!news) return null;
  return (
    <aside className="breaking" role="status">
      <span className="breaking-tag"><span className="breaking-dot" aria-hidden="true" />Breaking</span>
      <div className="breaking-body">
        <strong>{news.headline}</strong>
        <span>{news.detail}</span>
      </div>
    </aside>
  );
}

function Tonight({ week, fixture, today }: { week: TeamWeek; fixture: FixtureRow | undefined; today: string }) {
  if (!fixture) return null;
  const heading = fixture.date === today ? "Tonight" : fixture.date > today ? "Next match" : "This week";
  if (fixture.bye) {
    return <section className="card hero"><h2>{heading}</h2><p className="big">Bye week</p></section>;
  }
  const opp = findStanding(fixture.opponent, week.standings);
  return (
    <section className="card hero" aria-labelledby="tonight">
      <h2 id="tonight">{heading} <span className="muted">· {shortDate(fixture.date)}</span></h2>
      <p className="big">vs {fixture.opponent}</p>
      {opp && <p className="muted">{ordinal(opp.rank)} in C · {opp.wins}–{opp.losses} · {opp.points} pts</p>}
      <p>{fixture.home ? "Home" : "Away"} · {fixture.venue}</p>
      <Directions venue={fixture.venue} />
      {week.prediction && <EditorsPick prediction={week.prediction} us={week.team.name} opponent={fixture.opponent} />}
      {week.team.name === TEAM.name && (
        <blockquote>
          <span className="muted small">Ian's pick</span>
          <p>We win 24-0.</p>
        </blockquote>
      )}
    </section>
  );
}

const Pin = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
  </svg>
);

/** Directions buttons styled after each maps app's own buttons (no logos: they're trademarks). */
function Directions({ venue }: { venue: string }) {
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

/** "Area 501 to win 14–10", with the editor's full write-up a tap away. */
function EditorsPick({ prediction, us, opponent }: { prediction: { featured: boolean; text: string }; us: string; opponent: string }) {
  // Prose calls teams by a short word ("Area", "Menace"), so any longer word of the name counts.
  const team = us === TEAM.name ? TEAM : { name: us, aliases: [us, ...us.split(/\s+/).filter((w) => w.length > 3)] };
  const pick = editorPick(prediction, team, opponent);
  if (!pick) {
    return <blockquote><span className="muted small">Editor's pick</span><p>{prediction.text}</p></blockquote>;
  }
  const call = <p>{pick.winner ? `${pick.winner} to win ${pick.score}` : pick.score}</p>;
  return (
    <blockquote>
      <span className="muted small">Editor's pick</span>
      {pick.detail ? (
        <details className="pick">
          <summary>{call}<span className="more small">Read more</span></summary>
          <p className="small">{pick.detail}</p>
        </details>
      ) : call}
    </blockquote>
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
function Scouting({ week, fixture }: { week: TeamWeek; fixture: FixtureRow | undefined }) {
  const report = fixture && !fixture.bye ? scoutReport(fixture.opponent, week, divisions) : null;
  const [from, to] = report?.recentWeeks ?? [0, 0];
  const columns = scoutColumns(report?.recentWeeks ? `Last ${to - from + 1} wks` : null);
  const { rows, sortKey, toggle, arrow, ariaSort } = useSort(report?.rows ?? [], columns, "pct");
  const start = (i: number) => i > 0 && columns[i - 1].group !== columns[i].group;
  if (!report?.rows.length) return null;
  return (
    <section aria-labelledby="scouting">
      <h2 id="scouting">This Week's Opponent (Week {fixture!.week}) <span className="muted">· {report.team}</span></h2>
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
      <h2 id="standings">Standings {gap && <span className="muted">· {gap}</span>}</h2>
      <table>
        <thead><tr><th className="num">#</th><th>Team</th><th className="num">W–L</th><th className="num">Pts</th></tr></thead>
        <tbody>
          {week.standings.map((s) => (
            <tr key={s.team} className={s === us ? "us" : undefined}>
              <td className="num">{s.rank}</td><td>{s.team}<ClinchBadge mark={s.clinched} /></td><td className="num">{s.wins}–{s.losses}</td><td className="num">{s.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Page 2's clinch marker as a small pill; bottom-two clinches get none. */
export function ClinchBadge({ mark }: { mark: Standing["clinched"] }) {
  if (mark === "G") return <span className="clinch champ" title="Regular-season division champion">Champion</span>;
  if (mark === "C") return <span className="clinch" title="Clinched a top-two finish">Clinched</span>;
  return null;
}

function Fixtures({ rows, maps, names }: { rows: FixtureRow[]; maps: (v: string) => string; names: string[] }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return null;
  // Collapsed: last week, this week and next week. Before or after the season, the nearest three.
  const now = rows.findIndex((f) => f.status !== "past");
  const mid = now === -1 ? rows.length - 1 : now;
  const start = Math.max(0, Math.min(mid - 1, rows.length - 3));
  const shown = all ? rows : rows.slice(start, start + 3);
  return (
    <section aria-labelledby="fixtures">
      <h2 id="fixtures">Fixtures</h2>
      <ol className="fixtures">
        {shown.map((f) => (
          <li key={f.week} className={f.status}>
            <span className="fwk">{f.week}</span>
            <span className="fdate">{shortDate(f.date, false)}</span>
            <span className="fopp">
              {f.bye ? "Bye" : <>vs {f.result ? fullTeamName(f.result.opponentShort, names) : f.opponent}</>}
              {!f.bye && (
                <span className="fwhere">
                  {f.home ? "Home" : "Away"}
                  {f.status !== "past" && (
                    <> · <a className="fvenue" href={maps(f.venue)} target="_blank" rel="noopener"><Pin size={14} />{f.venue}</a></>
                  )}
                </span>
              )}
            </span>
            <span className="fres">
              {f.score ? (
                <><span className={`badge ${f.score.us > f.score.them ? "win" : f.score.us < f.score.them ? "loss" : "tie"}`}>{f.score.us > f.score.them ? "W" : f.score.us < f.score.them ? "L" : "T"}</span> {f.score.us}–{f.score.them}</>
              ) : f.status === "current" ? <span className="tag">Next</span> : f.status === "past" ? <span className="muted">–</span> : null}
            </span>
          </li>
        ))}
      </ol>
      {rows.length > 3 && (
        <button className="showall" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "Show fewer weeks" : `Show all ${rows.length} weeks`}
        </button>
      )}
    </section>
  );
}

interface Column<T = Player> {
  key: string;
  label: string;
  group: string;
  /** Sort value; higher is better. */
  sort: (p: T) => number;
  show: (p: T) => string;
}

const wlCol = <T,>(key: string, label: string, group: string, get: (p: T) => WL): Column<T> => ({
  key, label, group,
  sort: (p) => { const r = get(p); return (pct(r) ?? -1) * 1000 + r.w; },
  show: (p) => fmtWL(get(p)),
});
const pctCol = <T,>(key: string, group: string, get: (p: T) => WL): Column<T> => ({
  key, label: "Win %", group, sort: (p) => pct(get(p)) ?? -1, show: (p) => fmtPct(pct(get(p))),
});

export const PLAYER_COLUMNS: Column[] = [
  wlCol("total", "W–L", "Overall", (p) => p.total),
  pctCol("totalPct", "Overall", (p) => p.total),
  wlCol("singles", "W–L", "Singles", (p) => p.singles),
  pctCol("singlesPct", "Singles", (p) => p.singles),
  wlCol("s301", "301", "Singles", (p) => p.singles301),
  wlCol("sCricket", "Cricket", "Singles", (p) => p.singlesCricket),
  wlCol("doubles", "W–L", "Doubles", (p) => p.doubles),
  pctCol("doublesPct", "Doubles", (p) => p.doubles),
  wlCol("d501", "501", "Doubles", (p) => p.doubles501),
  wlCol("dCricket", "Cricket", "Doubles", (p) => p.doublesCricket),
  { key: "asp", label: "Points", group: "All-star", sort: (p) => p.allStarPoints, show: (p) => String(p.allStarPoints) },
  { key: "aspAvg", label: "Avg", group: "All-star", sort: (p) => p.aspAverage ?? -1, show: (p) => p.aspAverage?.toFixed(2) ?? "–" },
  { key: "games", label: "Games", group: "Played", sort: (p) => p.gamesPlayed, show: (p) => String(p.gamesPlayed) },
  { key: "matches", label: "Matches", group: "Played", sort: (p) => p.matchesPlayed, show: (p) => String(p.matchesPlayed) },
];

/** Table sorting shared by Players and Scouting: tap a heading to sort, tap again to flip. */
function useSort<T extends { name: string }>(items: T[], columns: Column<T>[], initial: string) {
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: initial, desc: true });
  const col = columns.find((c) => c.key === sort.key);
  const rows = [...items].sort((a, b) => {
    const c = col ? col.sort(a) - col.sort(b) : a.name.localeCompare(b.name);
    return sort.desc ? -c : c;
  });
  const toggle = (key: string) => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== "name" }));
  const arrow = (key: string) => (sort.key === key ? (sort.desc ? " ▾" : " ▴") : "");
  const ariaSort = (key: string) => (sort.key === key ? (sort.desc ? "descending" : "ascending") : "none") as "descending" | "ascending" | "none";
  const sortBy = (key: string) => setSort({ key, desc: true });
  return { rows, sortKey: sort.key, toggle, sortBy, arrow, ariaSort };
}

/** Consecutive columns sharing a group, for the top header row. */
const groupSpans = <T,>(columns: Column<T>[]) => columns.reduce<{ group: string; span: number }[]>((acc, c) => {
  const last = acc.at(-1);
  if (last?.group === c.group) last.span++;
  else acc.push({ group: c.group, span: 1 });
  return acc;
}, []);
const GROUPS = groupSpans(PLAYER_COLUMNS);

function Players({ week }: { week: TeamWeek }) {
  const { rows, sortKey, toggle, arrow, ariaSort } = useSort(week.players, PLAYER_COLUMNS, "totalPct");
  const team = teamTotals(week.players);
  const start = (i: number) => PLAYER_COLUMNS[i - 1]?.group !== PLAYER_COLUMNS[i].group;

  return (
    <section aria-labelledby="players">
      <h2 id="players">Players <span className="muted">· through week {week.week - 1}</span></h2>
      <Fold show="Show player stats" hide="Hide player stats"
        summary={<>{week.players.length} players · team {fmtWL(team.total)} ({fmtPct(pct(team.total))} of games won)</>}>
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

/** Every player in the division: a top 25 for any category, like the newsletter's leaderboards. */
function Division({ week }: { week: TeamWeek }) {
  const all = useMemo(() => divisionPlayers(week, divisions), [week]);
  const min = regularMatches(week);
  const [regulars, setRegulars] = useState(true);
  const shown = regulars ? all.filter((p) => p.matchesPlayed >= min) : all.filter((p) => p.matchesPlayed > 0);
  const { rows, sortKey, toggle, sortBy, arrow, ariaSort } = useSort<DivisionPlayer>(shown, PLAYER_COLUMNS, "totalPct");
  const [everyone, setEveryone] = useState(false);
  const start = (i: number) => PLAYER_COLUMNS[i - 1]?.group !== PLAYER_COLUMNS[i].group;
  if (!all.length) return null;
  const listed = everyone ? rows : rows.slice(0, TOP);
  const teams = new Set(all.map((p) => p.code)).size;

  return (
    <section aria-labelledby="division">
      <h2 id="division">{week.team.division} Division leaderboard <span className="muted">· through week {week.week - 1}</span></h2>
      <Fold show="Show leaderboard" hide="Hide leaderboard"
        summary={<>Top {TOP} of {all.length} players on {teams} teams, in any category: singles, doubles, all-star points per game and more.</>}>
        <label className="rank-by">
          <span>Rank by</span>
          <select value={RANK_BY.some(([k]) => k === sortKey) ? sortKey : ""} onChange={(e) => sortBy(e.target.value)}>
            {!RANK_BY.some(([k]) => k === sortKey) && <option value="">(table heading)</option>}
            {RANK_BY.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={regulars} onChange={(e) => setRegulars(e.target.checked)} />
          Only players with {min}+ matches
        </label>
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
                <tr key={`${p.code}-${p.number}`} className={p.team === week.team.name ? "us" : undefined}>
                  <th scope="row" className="sticky">
                    <span className="muted small">{i + 1}.</span> {p.name}
                    <span className="team small muted">{p.team}</span>
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
        <p className="muted small">{week.team.name} players are highlighted. Swipe sideways for every category, or tap a heading to sort by it.</p>
      </Fold>
    </section>
  );
}

function KeyDates({ today }: { today: string }) {
  const dates = (schedule?.keyDates ?? []).filter((d) => d.date >= today);
  if (!dates.length) return null;
  return (
    <section aria-labelledby="dates">
      <h2 id="dates">Key dates</h2>
      <ul className="plain">{dates.map((d) => <li key={d.date}><b>{shortDate(d.date)}</b> · {d.label}</li>)}</ul>
    </section>
  );
}
