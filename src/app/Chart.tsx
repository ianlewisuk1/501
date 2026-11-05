/**
 * The Form tab: one line chart, easy to read. Pick a player (or the whole team) and a game; the
 * line is their season-so-far win % in that game, week by week, so a climbing line means they've
 * been winning lately. A sentence above says it in words (hot, cold or steady). Reference lines
 * switch on and off underneath: the team's average, the division's best, the 50% mark, and any
 * other player in the division to compare with.
 */
import { useMemo, useState } from "react";
import type { DivisionWeek, TeamWeek } from "../parser/types";
import { divisionBest, GAMES, playerLine, RECENT, teamLine, verdict, type GameKey, type LinePoint, type Verdict } from "./form";
import { fmtPct, fmtWL } from "./model";

const TEAM = -1;

interface Line { id: string; label: string; points: LinePoint[]; className: string }

export function PerformanceChart({ current, divisions }: { current: TeamWeek; divisions: DivisionWeek[] }) {
  const roster = current.players;
  const [who, setWho] = useState<number>(roster[0]?.number ?? TEAM);
  const [game, setGame] = useState<GameKey>("total");
  const [on, setOn] = useState({ team: true, best: false, half: false, compare: false });
  const season = current.season;
  const code = current.team.code;

  // Everyone in the division, for the "compare with" list: teammates first, then the other teams.
  const latest = useMemo(() => divisions.filter((d) => d.season === season).sort((a, b) => b.week - a.week)[0], [divisions, season]);
  const others = useMemo(() => {
    const teams = [...(latest?.teams ?? [])].sort((a, b) => (a.code === code ? -1 : b.code === code ? 1 : a.name.localeCompare(b.name)));
    return teams.map((t) => ({ team: t.name, players: t.players.filter((p) => p.total.w + p.total.l > 0) }));
  }, [latest, code]);
  const firstOther = others.flatMap((t) => t.players).find((p) => p.number !== who)?.number ?? null;
  const [compareWith, setCompareWith] = useState<number | null>(null);
  const compareNum = compareWith ?? firstOther;

  const name = who === TEAM ? "The team" : roster.find((p) => p.number === who)?.name ?? "";
  const gameLabel = GAMES.find((g) => g.key === game)!.label;
  const main = who === TEAM ? teamLine(divisions, season, code, game) : playerLine(divisions, season, who, game);
  const best = divisionBest(divisions, season, game);
  const compareName = others.flatMap((t) => t.players.map((p) => ({ ...p, team: t.team }))).find((p) => p.number === compareNum);

  const extras: Line[] = [];
  if (on.team && who !== TEAM) extras.push({ id: "team", label: "Team average", points: teamLine(divisions, season, code, game), className: "ref-team" });
  if (on.best && best) extras.push({ id: "best", label: `Division's best: ${best.name}`, points: playerLine(divisions, season, best.number, game), className: "ref-best" });
  if (on.compare && compareName) extras.push({ id: "compare", label: compareName.name, points: playerLine(divisions, season, compareName.number, game), className: "ref-compare" });
  const lines: Line[] = [...extras, { id: "main", label: name, points: main, className: "ref-main" }];

  const toggle = (k: keyof typeof on) => setOn((s) => ({ ...s, [k]: !s[k] }));

  return (
    <section className="form" aria-labelledby="form-h">
      <h2 id="form-h" className="sr-only">Form</h2>

      <div className="form-pick" role="group" aria-label="Player">
        {roster.map((p) => (
          <button key={p.number} type="button" aria-pressed={who === p.number} onClick={() => setWho(p.number)}>{shortName(p.name)}</button>
        ))}
        <button type="button" aria-pressed={who === TEAM} onClick={() => setWho(TEAM)}>Whole team</button>
      </div>

      <div className="form-games" role="group" aria-label="Game">
        <button type="button" className="g-all" aria-pressed={game === "total"} onClick={() => setGame("total")}>All games</button>
        <span className="g-group">
          <span className="g-head">Singles</span>
          <span className="g-row">
            <button type="button" aria-pressed={game === "singles301"} onClick={() => setGame("singles301")}>301</button>
            <button type="button" aria-pressed={game === "singlesCricket"} onClick={() => setGame("singlesCricket")}>Cricket</button>
          </span>
        </span>
        <span className="g-group">
          <span className="g-head">Doubles</span>
          <span className="g-row">
            <button type="button" aria-pressed={game === "doubles501"} onClick={() => setGame("doubles501")}>501</button>
            <button type="button" aria-pressed={game === "doublesCricket"} onClick={() => setGame("doublesCricket")}>Cricket</button>
          </span>
        </span>
      </div>

      <Sentence who={name} game={gameLabel} v={verdict(main)} />

      <FormChart lines={lines} half={on.half} title={`${name}, ${gameLabel}: season win % so far`} />

      <div className="form-refs" role="group" aria-label="Lines to compare with">
        {who !== TEAM && <button type="button" className="ref-team" aria-pressed={on.team} onClick={() => toggle("team")}><i className="sw" />Team average</button>}
        {best && <button type="button" className="ref-best" aria-pressed={on.best} onClick={() => toggle("best")}><i className="sw" />Division's best</button>}
        <button type="button" className="ref-half" aria-pressed={on.half} onClick={() => toggle("half")}><i className="sw" />50% line</button>
        <button type="button" className="ref-compare" aria-pressed={on.compare} onClick={() => toggle("compare")}><i className="sw" />Compare a player</button>
      </div>
      {on.best && best && <p className="form-note">Division's best in {gameLabel.toLowerCase()}: {best.name} ({best.team}), {fmtWL(best[game])}.</p>}
      {on.compare && (
        <label className="form-compare">
          <span>Compare with</span>
          <select value={compareNum ?? ""} onChange={(e) => setCompareWith(Number(e.target.value))}>
            {others.map((t) => (
              <optgroup key={t.team} label={t.team}>
                {t.players.map((p) => <option key={p.number} value={p.number}>{p.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      <p className="muted small">
        The line is the season so far, added up week by week: rising means winning lately, falling means losing.
        Through week {current.week - 1}.
      </p>
    </section>
  );
}

/** The verdict in one plain sentence, so nobody has to read the chart to get the answer. */
function Sentence({ who, game, v }: { who: string; game: string; v: Verdict }) {
  const g = game.toLowerCase();
  if (v.kind === "few") {
    return (
      <p className="form-verdict few">
        {v.season ? <>Not enough {g} games in the last {RECENT} weeks to call it. Season: {fmtWL(v.season)} ({fmtPct(v.now)}).</>
          : <>No {g} games yet this season.</>}
      </p>
    );
  }
  const word = v.kind === "hot" ? "Hot" : v.kind === "cold" ? "Cold" : "Steady";
  // A point or two either way is noise: only a real move gets "up" or "down".
  const diff = v.then === null ? 0 : v.now - v.then;
  const move = v.then === null ? "" : Math.abs(diff) < 0.02 ? ", about the same as 3 weeks ago" : `, ${diff > 0 ? "up" : "down"} from ${fmtPct(v.then)}`;
  return (
    <p className={`form-verdict ${v.kind}`}>
      <b className="form-word">{word}</b> {who}, {g}: {fmtWL(v.recent)} in the last {RECENT} weeks.
      Season {fmtPct(v.now)} ({fmtWL(v.season)}){move}.
    </p>
  );
}

function FormChart({ lines, half, title }: { lines: Line[]; half: boolean; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const weeks = lines[0]?.points.map((p) => p.week) ?? [];
  const W = 340, H = 210, PAD = { l: 40, r: 12, t: 12, b: 30 };
  const slot = (W - PAD.l - PAD.r) / Math.max(1, weeks.length);
  const x = (i: number) => PAD.l + slot * (i + 0.5);
  const y = (v: number) => PAD.t + (1 - v) * (H - PAD.t - PAD.b);
  const path = (pts: LinePoint[]) => {
    let d = "";
    pts.forEach((p, i) => { if (p.pct !== null) d += `${d && pts[i - 1]?.pct != null ? "L" : "M"}${x(i)},${y(p.pct)}`; });
    return d;
  };
  if (!weeks.length) return <p className="muted">No weeks to chart yet.</p>;
  return (
    <figure className="chart form-chart">
      <div className="plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} onPointerLeave={() => setHover(null)}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
              <text className="tick" x={PAD.l - 6} y={y(t)} dy="0.32em" textAnchor="end">{fmtPct(t)}</text>
            </g>
          ))}
          {half && <line className="ref-half-line" x1={PAD.l} x2={W - PAD.r} y1={y(0.5)} y2={y(0.5)} />}
          {weeks.map((w, i) => <text key={w} className="tick" x={x(i)} y={H - PAD.b + 14} textAnchor="middle">{w}</text>)}
          <text className="tick axis" x={PAD.l - 6} y={H - PAD.b + 14} textAnchor="end">Week</text>
          {hover !== null && <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} />}
          {lines.map((l) => (
            <g key={l.id} className={`fline ${l.className}`}>
              <path d={path(l.points)} />
              {l.id === "main" && l.points.map((p, i) => p.pct !== null && <circle key={p.week} cx={x(i)} cy={y(p.pct)} r={3.5} />)}
            </g>
          ))}
          {weeks.map((w, i) => (
            <rect key={w} className="hit" x={x(i) - slot / 2} width={slot} y={0} height={H - PAD.b} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
          ))}
        </svg>
        {hover !== null && (
          <div className="tip" style={{ left: `${Math.min(75, Math.max(25, (x(hover) / W) * 100))}%` }}>
            <b>After week {weeks[hover]}</b>
            {[...lines].reverse().map((l) => {
              const p = l.points[hover];
              return <div key={l.id} className={l.className}><i className="sw" /> {l.label}: {p.wl ? `${fmtPct(p.pct)} (${fmtWL(p.wl)})` : "–"}</div>;
            })}
          </div>
        )}
      </div>
    </figure>
  );
}

/** "John Geraghty" -> "John G.", so the player buttons fit across a phone. */
const shortName = (name: string) => {
  const parts = name.split(" ");
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]}.` : name;
};
