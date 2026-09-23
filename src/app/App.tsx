import { useMemo, useState } from "react";
import { fullTeamName } from "../parser/names";
import type { MatchResult, Player, TeamWeek, WL } from "../parser/types";
import { PerformanceChart } from "./Chart";
import { current, history, schedule } from "./data";
import {
  buildFixtures, findStanding, fmtPct, fmtWL, isIOS, mapsUrl, mapsUrls, pct, shortDate, teamTotals, todayIso, type FixtureRow,
} from "./model";

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 >> 3 ^ 1 && n % 10] || "th"}`;

export function App() {
  if (!current) return <main><h1>Area 501</h1><p>No newsletter parsed yet.</p></main>;
  return <Page week={current} />;
}

function Page({ week }: { week: TeamWeek }) {
  const fixtures = useMemo(() => buildFixtures(week, history, schedule), [week]);
  const ios = useMemo(() => isIOS(), []);
  const maps = (venue: string) => mapsUrl(venue, schedule, ios);
  const today = todayIso();

  return (
    <main>
      <header className="brand">
        <img className="art" src={`${import.meta.env.BASE_URL}area501-art.webp`} alt="" width={360} height={287} />
        <h1>{week.team.name}</h1>
        <dl className="meta">
          <div><dt>Division:</dt> <dd>{week.team.division} Division</dd></div>
          <div><dt>Current week:</dt> <dd>Week {week.week}</dd></div>
          <div><dt>Date:</dt> <dd>{shortDate(week.issueDate)}</dd></div>
        </dl>
      </header>
      <Tonight week={week} fixture={fixtures.find((f) => f.status === "current")} today={today} />
      <LastResult week={week} />
      <Standings week={week} />
      <Fixtures rows={fixtures} maps={maps} names={week.standings.map((s) => s.team)} />
      <Players week={week} />
      <PerformanceChart current={week} history={history} />
      <KeyDates today={today} />
      <footer className="muted small">
        Unofficial. From the RDL "Tons of Newsletter", issue #{week.issue}. Stats through week {week.week - 1}.
      </footer>
    </main>
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
      <p className="big">{fixture.home ? "vs" : "@"} {fixture.opponent}</p>
      {opp && <p className="muted">{ordinal(opp.rank)} in C · {opp.wins}–{opp.losses} · {opp.points} pts</p>}
      <p>{fixture.home ? "Home" : "Away"} · {fixture.venue}</p>
      <Directions venue={fixture.venue} />
      {week.prediction && (
        <blockquote>
          <span className="muted small">Editor's pick</span>
          <p>{pickLine(week.prediction)}</p>
        </blockquote>
      )}
    </section>
  );
}

const Pin = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
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

/** The featured write-up is long; keep its final call, which ends with the score. */
function pickLine(p: { featured: boolean; text: string }): string {
  if (!p.featured) return p.text;
  const sentences = p.text.replace(/^Match(?:es)? #[^:]+:\s*\([A-H] Div\.\)\s*/, "").split(/(?<=[.!?])\s+/);
  return sentences.slice(-2).join(" ");
}

function LastResult({ week }: { week: TeamWeek }) {
  const r = week.lastResult;
  if (!r) return null;
  if ("bye" in r) return <section className="card"><h2>Last week <span className="muted">· Week {r.week}</span></h2><p>Bye</p></section>;
  return <ResultCard r={r} names={week.standings.map((s) => s.team)} />;
}

function ResultCard({ r, names }: { r: MatchResult; names: string[] }) {
  const won = r.score.us > r.score.them;
  const cats: [string, number][] = [
    ["301", r.gamesWon.singles301],
    ["Cricket", r.gamesWon.singlesCricket],
    ["Dbl cricket", r.gamesWon.doublesCricket],
    ["Dbl 501", r.gamesWon.doubles501],
  ];
  return (
    <section className="card" aria-labelledby="last">
      <h2 id="last">Last week <span className="muted">· Week {r.week} · {shortDate(r.date)}</span></h2>
      <p className="big">
        <span className={`badge ${won ? "win" : r.score.us === r.score.them ? "tie" : "loss"}`}>{won ? "W" : r.score.us === r.score.them ? "T" : "L"}</span>{" "}
        {r.score.us}–{r.score.them} {r.home ? "vs" : "@"} {fullTeamName(r.opponentShort, names)}
      </p>
      <ul className="chips">
        {cats.map(([k, v]) => <li key={k}>{k} <b>{v}/6</b></li>)}
        {r.tiebreaker1001 && <li>1001 <b>{r.tiebreaker1001}</b></li>}
        <li>ASPs <b>{r.allStarPoints}</b></li>
      </ul>
      {(r.shortHanded || r.penalties) && (
        <p className="muted small">{[r.shortHanded && `Short-handed: ${r.shortHanded}`, r.penalties && `Penalties: ${r.penalties}`].filter(Boolean).join(" · ")}</p>
      )}
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
              <td className="num">{s.rank}</td><td>{s.team}</td><td className="num">{s.wins}–{s.losses}</td><td className="num">{s.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Fixtures({ rows, maps, names }: { rows: FixtureRow[]; maps: (v: string) => string; names: string[] }) {
  if (!rows.length) return null;
  return (
    <section aria-labelledby="fixtures">
      <h2 id="fixtures">Fixtures</h2>
      <ol className="fixtures">
        {rows.map((f) => (
          <li key={f.week} className={f.status}>
            <span className="fwk">{f.week}</span>
            <span className="fdate">{shortDate(f.date, false)}</span>
            <span className="fopp">
              {f.bye ? "Bye" : <>{f.home ? "vs" : "@"} {f.result ? fullTeamName(f.result.opponentShort, names) : f.opponent}</>}
              {!f.bye && f.status !== "past" && (
                <a className="fvenue" href={maps(f.venue)} target="_blank" rel="noopener">{f.venue}</a>
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
    </section>
  );
}

interface Column {
  key: string;
  label: string;
  group: string;
  /** Sort value; higher is better. */
  sort: (p: Player) => number;
  show: (p: Player) => string;
}

const wlCol = (key: string, label: string, group: string, get: (p: Player) => WL): Column => ({
  key, label, group,
  sort: (p) => { const r = get(p); return (pct(r) ?? -1) * 1000 + r.w; },
  show: (p) => fmtWL(get(p)),
});
const pctCol = (key: string, group: string, get: (p: Player) => WL): Column => ({
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
  wlCol("tiebreaker", "1001", "Tiebreak", (p) => p.tiebreaker),
  { key: "asp", label: "Points", group: "All-star", sort: (p) => p.allStarPoints, show: (p) => String(p.allStarPoints) },
  { key: "aspAvg", label: "Avg", group: "All-star", sort: (p) => p.aspAverage ?? -1, show: (p) => p.aspAverage?.toFixed(2) ?? "–" },
  { key: "games", label: "Games", group: "Played", sort: (p) => p.gamesPlayed, show: (p) => String(p.gamesPlayed) },
  { key: "matches", label: "Matches", group: "Played", sort: (p) => p.matchesPlayed, show: (p) => String(p.matchesPlayed) },
];

/** Consecutive columns sharing a group, for the top header row. */
const GROUPS = PLAYER_COLUMNS.reduce<{ group: string; span: number }[]>((acc, c) => {
  const last = acc.at(-1);
  if (last?.group === c.group) last.span++;
  else acc.push({ group: c.group, span: 1 });
  return acc;
}, []);

function Players({ week }: { week: TeamWeek }) {
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: "totalPct", desc: true });
  const col = PLAYER_COLUMNS.find((c) => c.key === sort.key);
  const rows = [...week.players].sort((a, b) => {
    const c = col ? col.sort(a) - col.sort(b) : a.name.localeCompare(b.name);
    return sort.desc ? -c : c;
  });
  const toggle = (key: string) => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== "name" }));
  const arrow = (key: string) => (sort.key === key ? (sort.desc ? " ▾" : " ▴") : "");
  const ariaSort = (key: string) => (sort.key === key ? (sort.desc ? "descending" : "ascending") : "none");
  const team = teamTotals(week.players);
  const start = (i: number) => PLAYER_COLUMNS[i - 1]?.group !== PLAYER_COLUMNS[i].group;

  return (
    <section aria-labelledby="players">
      <h2 id="players">Players <span className="muted">· through week {week.week - 1}</span></h2>
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
                  <td key={c.key} className={`num${start(i) ? " gstart" : ""}${c.key === sort.key ? " sorted" : ""}`}>{c.show(p)}</td>
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
