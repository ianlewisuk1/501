import { useMemo, useState } from "react";
import { fullTeamName } from "../parser/names";
import type { MatchResult, Player, TeamWeek } from "../parser/types";
import { PerformanceChart } from "./Chart";
import { current, history, schedule } from "./data";
import {
  buildFixtures, findStanding, fmtPct, fmtWL, isIOS, mapsUrl, pct, shortDate, todayIso, type FixtureRow,
} from "./model";

const NEWSLETTER_URL = "https://raleighdartleague.org/newsletter/";
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
      <header>
        <h1>{week.team.name}</h1>
        <p className="muted">{week.team.division} Division · Week {week.week} · {shortDate(week.issueDate)}</p>
      </header>
      <Tonight week={week} fixture={fixtures.find((f) => f.status === "current")} maps={maps} today={today} />
      <LastResult week={week} />
      <Standings week={week} />
      <Fixtures rows={fixtures} maps={maps} names={week.standings.map((s) => s.team)} />
      <Players week={week} />
      <PerformanceChart current={week} history={history} />
      <Bragging week={week} />
      <KeyDates today={today} />
      <Newsletter week={week} />
      <footer className="muted small">
        Unofficial. From the RDL "Tons of Newsletter", issue #{week.issue}. Stats through week {week.week - 1}.
      </footer>
    </main>
  );
}

function Tonight({ week, fixture, maps, today }: {
  week: TeamWeek; fixture: FixtureRow | undefined; maps: (v: string) => string; today: string;
}) {
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
      <p>
        {fixture.home ? "Home" : "Away"} · {fixture.venue}{" "}
        <a className="btn" href={maps(fixture.venue)} target="_blank" rel="noopener">Directions</a>
      </p>
      {week.prediction && (
        <blockquote>
          <span className="muted small">Editor's pick</span>
          <p>{pickLine(week.prediction)}</p>
        </blockquote>
      )}
    </section>
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

type SortKey = "name" | "record" | "pct" | "asp";

function Players({ week }: { week: TeamWeek }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "pct", desc: true });
  const [open, setOpen] = useState<number | null>(null);
  const value = (p: Player): number | string =>
    sort.key === "name" ? p.name : sort.key === "record" ? p.total.w : sort.key === "pct" ? pct(p.total) ?? -1 : p.aspAverage ?? -1;
  const rows = [...week.players].sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    const c = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number);
    return sort.desc ? -c : c;
  });
  const head = (key: SortKey, label: string, cls?: string) => (
    <th className={cls} aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== "name" }))}>
        {label}{sort.key === key ? (sort.desc ? " ▾" : " ▴") : ""}
      </button>
    </th>
  );
  return (
    <section aria-labelledby="players">
      <h2 id="players">Players <span className="muted">· through week {week.week - 1}</span></h2>
      <table className="players">
        <thead><tr>{head("name", "Player")}{head("record", "W–L", "num")}{head("pct", "Win %", "num")}{head("asp", "ASP avg", "num")}</tr></thead>
        <tbody>
          {rows.map((p) => (
            <PlayerRow key={p.number} p={p} open={open === p.number} toggle={() => setOpen(open === p.number ? null : p.number)} />
          ))}
        </tbody>
      </table>
      <p className="muted small">Tap a player for the breakdown.</p>
    </section>
  );
}

export function PlayerRow({ p, open, toggle }: { p: Player; open: boolean; toggle: () => void }) {
  const detail: [string, string][] = [
    ["Singles", `${fmtWL(p.singles)} (${fmtPct(pct(p.singles))})`],
    ["Doubles", `${fmtWL(p.doubles)} (${fmtPct(pct(p.doubles))})`],
    ["Singles 301", fmtWL(p.singles301)],
    ["Singles cricket", fmtWL(p.singlesCricket)],
    ["Doubles cricket", fmtWL(p.doublesCricket)],
    ["Doubles 501", fmtWL(p.doubles501)],
    ["1001 tiebreaker", fmtWL(p.tiebreaker)],
    ["All-star points", `${p.allStarPoints} in ${p.gamesPlayed} games`],
    ["Matches played", String(p.matchesPlayed)],
  ];
  return (
    <>
      <tr className="prow" onClick={toggle} aria-expanded={open}>
        <td><button className="link" onClick={(e) => { e.stopPropagation(); toggle(); }} aria-expanded={open}>{p.name}</button> <span className="muted small">#{p.number}</span></td>
        <td className="num">{fmtWL(p.total)}</td>
        <td className="num">{fmtPct(pct(p.total))}</td>
        <td className="num">{p.aspAverage?.toFixed(2) ?? "–"}</td>
      </tr>
      {open && (
        <tr className="pdetail"><td colSpan={4}>
          <dl>{detail.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </td></tr>
      )}
    </>
  );
}

function Bragging({ week }: { week: TeamWeek }) {
  const { singles, singlesPlusDoubles, allStarAverage } = week.leaderboards;
  const boards = [
    { title: "Singles win %", rows: singles.map((r) => ({ rank: r.rank, player: r.player, detail: `${r.w}–${r.l} · ${fmtPct(r.pct, 1)}` })) },
    { title: "Singles + doubles win %", rows: singlesPlusDoubles.map((r) => ({ rank: r.rank, player: r.player, detail: `${r.w}–${r.l} · ${fmtPct(r.pct, 1)}` })) },
    { title: "All-star point average", rows: allStarAverage.map((r) => ({ rank: r.rank, player: r.player, detail: `${r.average.toFixed(2)} (${r.asp} in ${r.gamesPlayed})` })) },
  ].filter((b) => b.rows.length);
  const { trophyDarts, hotDarts, perfectThrows } = week;
  if (!boards.length && !trophyDarts.length && !hotDarts.length && !perfectThrows.length) return null;
  return (
    <section aria-labelledby="brag">
      <h2 id="brag">Bragging rights</h2>
      {boards.length > 0 && (
        <div className="boards">
          {boards.map((b) => (
            <div key={b.title}>
              <h3>{b.title} <span className="muted small">· C Division ranks</span></h3>
              <ol className="plain">{b.rows.map((r) => <li key={r.player}><span className="rank">{ordinal(r.rank)}</span> {r.player} <span className="muted small">{r.detail}</span></li>)}</ol>
            </div>
          ))}
        </div>
      )}
      {trophyDarts.length > 0 && (
        <>
          <h3>Trophy darts <span className="muted small">· season leaders</span></h3>
          <ul className="plain">
            {trophyDarts.map((t) => (
              <li key={t.category}><b>{t.category}</b>: {t.value} · {t.players.join(" & ")}{t.date && <span className="muted small"> · {shortDate(t.date, false)}</span>}</li>
            ))}
          </ul>
        </>
      )}
      {hotDarts.length > 0 && (
        <>
          <h3>Hot darts <span className="muted small">· week {week.week - 1}</span></h3>
          <ul className="plain">{hotDarts.map((h, i) => <li key={i}>{h.players.join(" & ")} · <b>{h.feat}</b></li>)}</ul>
        </>
      )}
      {perfectThrows.length > 0 && (
        <>
          <h3>Perfect throws</h3>
          <ul className="plain">{perfectThrows.map((p) => <li key={p}>{p}</li>)}</ul>
        </>
      )}
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

function Newsletter({ week }: { week: TeamWeek }) {
  return (
    <section aria-labelledby="news">
      <h2 id="news">From the newsletter</h2>
      {week.headline && <blockquote><p>{week.headline}</p></blockquote>}
      <p><a href={NEWSLETTER_URL} target="_blank" rel="noopener">Read the full newsletter ↗</a></p>
    </section>
  );
}
