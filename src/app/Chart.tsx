import { useState } from "react";
import type { Player, TeamWeek } from "../parser/types";
import { fmtPct, fmtWL, form, pct, playerIn, weeklyGames, WHOLE_TEAM, type FixtureRow, type FormPoint } from "./model";

const CATEGORIES: [keyof Player, string][] = [
  ["singles301", "Singles 301"],
  ["singlesCricket", "Singles cricket"],
  ["doublesCricket", "Doubles cricket"],
  ["doubles501", "Doubles 501"],
  ["tiebreaker", "1001 tiebreaker"],
];

export function PerformanceChart({ current, history, fixtures }: { current: TeamWeek; history: TeamWeek[]; fixtures: FixtureRow[] }) {
  const [who, setWho] = useState(WHOLE_TEAM);
  const [view, setView] = useState<"compare" | "breakdown">("compare");
  const player = playerIn(current, who) ?? playerIn(current, WHOLE_TEAM)!;
  const hasWeekly = weeklyGames(current, history, fixtures, WHOLE_TEAM).some((w) => w.won !== null);
  const shown = hasWeekly ? view : "breakdown";

  return (
    <section aria-labelledby="perf">
      <h2 id="perf">Performance</h2>
      <div className="controls">
        {hasWeekly && (
          <div className="seg" role="group" aria-label="Chart view">
            <button aria-pressed={shown === "compare"} onClick={() => setView("compare")}>Compare</button>
            <button aria-pressed={shown === "breakdown"} onClick={() => setView("breakdown")}>Breakdown</button>
          </div>
        )}
        <label hidden={shown !== "breakdown"}>
          <span className="sr-only">Player</span>
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            <option>{WHOLE_TEAM}</option>
            {current.players.map((p) => <option key={p.number}>{p.name}</option>)}
          </select>
        </label>
      </div>
      {shown === "breakdown" ? <Breakdown player={player} />
        : <CompareChart
            players={current.players.map((p) => ({ name: p.name, pts: form(weeklyGames(current, history, fixtures, p.name)) }))}
            team={form(weeklyGames(current, history, fixtures, WHOLE_TEAM))}
          />}
      <p className="muted small">Through week {current.week - 1}.</p>
    </section>
  );
}

function Breakdown({ player }: { player: Player }) {
  const max = Math.max(1, ...CATEGORIES.map(([k]) => (player[k] as { w: number; l: number }).w + (player[k] as { w: number; l: number }).l));
  return (
    <div className="breakdown">
      <div className="legend" aria-hidden>
        <span><i className="sw won" /> Won</span>
        <span><i className="sw lost" /> Lost</span>
      </div>
      {CATEGORIES.map(([k, label]) => {
        const r = player[k] as { w: number; l: number };
        if (k === "tiebreaker" && r.w + r.l === 0) return null;
        return (
          <div className="brow" key={k} title={`${label}: won ${r.w}, lost ${r.l} (${fmtPct(pct(r))})`}>
            <span className="blabel">{label}</span>
            <span className="btrack">
              {r.w > 0 && <span className="bar won" style={{ width: `${(r.w / max) * 100}%` }} />}
              {r.l > 0 && <span className="bar lost" style={{ width: `${(r.l / max) * 100}%` }} />}
            </span>
            <span className="bval">{fmtWL(r)}</span>
          </div>
        );
      })}
      <p className="small">
        All-star points <b>{player.allStarPoints}</b> in {player.gamesPlayed} games · average{" "}
        <b>{player.aspAverage?.toFixed(2) ?? "–"}</b>
      </p>
    </div>
  );
}

/** Picked when the page loads. Falls back to the first player if he leaves the roster. */
const DEFAULT_PICK = "Russell Riley";

type Series = { name: string; pts: FormPoint[]; color: number };

/**
 * Pick players, then see them on two charts: each night's own win %, and the season win % so far.
 * Colours follow newsletter order, so a player keeps theirs however many are picked.
 */
export function CompareChart({ players, team }: { players: { name: string; pts: FormPoint[] }[]; team: FormPoint[] }) {
  const series: Series[] = players.map((p, i) => ({ ...p, color: i }));
  const [picked, setPicked] = useState(() => new Set([series.some((s) => s.name === DEFAULT_PICK) ? DEFAULT_PICK : series[0]?.name]));
  const shown = series.filter((s) => picked.has(s.name));
  const toggle = (name: string) => setPicked((prev) => {
    const next = new Set(prev);
    if (!next.delete(name)) next.add(name);
    return next;
  });

  return (
    <div className="compare">
      <WinChart title="Win % each night" note="How they did that night only." metric="night" shown={shown} team={team} />
      <WinChart title="Season win % so far" note="All their games this season, added up." metric="season" shown={shown} team={team} />
      <p className="pick-head"><b>Tap a name to show or hide it</b></p>
      <ul className="plegend">
        {series.map((s) => (
          <li key={s.name}>
            <button aria-pressed={picked.has(s.name)} aria-label={s.name} className={`p${s.color}`} onClick={() => toggle(s.name)}>
              <i className="sw" /> <span>{shortName(s.name)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WinChart({ title, note, metric, shown, team }: { title: string; note: string; metric: "night" | "season"; shown: Series[]; team: FormPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const weeks = team.map((p) => p.week);
  const W = 340, H = 200, PAD = { l: 40, r: 10, t: 12, b: 30 };
  const slot = (W - PAD.l - PAD.r) / Math.max(1, weeks.length);
  const x = (i: number) => PAD.l + slot * (i + 0.5);
  const y = (v: number) => PAD.t + (1 - v) * (H - PAD.t - PAD.b);
  const path = (pts: FormPoint[]) => {
    let d = "";
    pts.forEach((p, i) => { const v = p[metric]; if (v !== null) d += `${d && pts[i - 1]?.[metric] != null ? "L" : "M"}${x(i)},${y(v)}`; });
    return d;
  };
  const label = (p: FormPoint) => p.won === null ? "–" : p[metric] === null ? "didn't play" : metric === "night" ? `${p.won}–${p.lost} · ${fmtPct(p.night)}` : fmtPct(p.season);

  return (
    <figure className="chart">
      <figcaption>{title} <span className="muted">· {note}</span></figcaption>
      <div className="legend" aria-hidden>
        <span><i className="sw line-season" /> Whole team</span>
      </div>
      <div className="plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} for ${shown.map((s) => s.name).join(", ") || "no players"} and the whole team`} onPointerLeave={() => setHover(null)}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
              <text className="tick" x={PAD.l - 6} y={y(t)} dy="0.32em" textAnchor="end">{fmtPct(t)}</text>
            </g>
          ))}
          {weeks.map((w, i) => <text key={w} className="tick" x={x(i)} y={H - PAD.b + 14} textAnchor="middle">{w}</text>)}
          <text className="tick axis" x={PAD.l - 6} y={H - PAD.b + 14} textAnchor="end">Week</text>
          {hover !== null && <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} />}
          <path className="trend-season" d={path(team)} />
          {!shown.length && (
            <text className="empty-note" x={PAD.l + (W - PAD.l - PAD.r) / 2} y={y(0.25)} dy="-0.4em" textAnchor="middle">Tap a name below to show it.</text>
          )}
          {shown.map((s) => (
            <g key={s.name} className={`pline p${s.color}`}>
              <path d={path(s.pts)} />
              {s.pts.map((p, i) => { const v = p[metric]; return v !== null && <circle key={p.week} className="pdot" cx={x(i)} cy={y(v)} r={3.5} />; })}
            </g>
          ))}
          {weeks.map((w, i) => (
            <rect key={w} className="hit" x={x(i) - slot / 2} width={slot} y={0} height={H - PAD.b} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
          ))}
        </svg>
        {hover !== null && (
          <div className="tip" style={{ left: `${Math.min(75, Math.max(25, (x(hover) / W) * 100))}%` }}>
            <b>Week {weeks[hover]}</b>
            {[...shown].sort((a, b) => (b.pts[hover][metric] ?? -1) - (a.pts[hover][metric] ?? -1)).map((s) => (
              <div key={s.name}><i className={`sw p${s.color}`} /> {s.name} {label(s.pts[hover])}</div>
            ))}
            <div className="muted"><i className="sw line-season" /> Team {fmtPct(team[hover][metric])}</div>
          </div>
        )}
      </div>
    </figure>
  );
}

/** "John Geraghty" -> "John G.", so two chips fit across a phone. */
const shortName = (name: string) => {
  const parts = name.split(" ");
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]}.` : name;
};
