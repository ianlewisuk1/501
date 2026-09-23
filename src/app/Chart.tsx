import { useState } from "react";
import type { Player, TeamWeek } from "../parser/types";
import { fmtPct, fmtWL, pct, playerIn, trend, WHOLE_TEAM, type TrendPoint } from "./model";

const CATEGORIES: [keyof Player, string][] = [
  ["singles301", "Singles 301"],
  ["singlesCricket", "Singles cricket"],
  ["doublesCricket", "Doubles cricket"],
  ["doubles501", "Doubles 501"],
  ["tiebreaker", "1001 tiebreaker"],
];

export function PerformanceChart({ current, history }: { current: TeamWeek; history: TeamWeek[] }) {
  const [who, setWho] = useState(WHOLE_TEAM);
  const [view, setView] = useState<"breakdown" | "trend">("breakdown");
  const player = playerIn(current, who) ?? playerIn(current, WHOLE_TEAM)!;
  const { points, weekly } = trend(history, current.season, player.name);
  const hasTrend = points.length >= 2;
  const shown = hasTrend ? view : "breakdown";

  return (
    <section aria-labelledby="perf">
      <h2 id="perf">Performance</h2>
      <div className="controls">
        <label>
          <span className="sr-only">Player</span>
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            <option>{WHOLE_TEAM}</option>
            {current.players.map((p) => <option key={p.number}>{p.name}</option>)}
          </select>
        </label>
        {hasTrend && (
          <div className="seg" role="group" aria-label="Chart view">
            <button aria-pressed={shown === "breakdown"} onClick={() => setView("breakdown")}>Breakdown</button>
            <button aria-pressed={shown === "trend"} onClick={() => setView("trend")}>Season trend</button>
          </div>
        )}
      </div>
      {shown === "breakdown" ? <Breakdown player={player} /> : <Trend points={points} weekly={weekly} />}
      <p className="muted small">Through week {current.week - 1}.{!hasTrend && " The season trend appears once there are two or more newsletters."}</p>
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

const SERIES = [
  { key: "total", label: "Total", cls: "s1" },
  { key: "singles", label: "Singles", cls: "s2" },
  { key: "doubles", label: "Doubles", cls: "s3" },
] as const;

export function Trend({ points, weekly }: { points: TrendPoint[]; weekly: { label: string; record: { w: number; l: number } }[] }) {
  const pcts = points.flatMap((p) => SERIES.map((s) => p[s.key])).filter((v): v is number => v !== null);
  const pctMin = Math.max(0, Math.floor((Math.min(1, ...pcts) - 0.05) * 4) / 4);
  const aspTop = Math.max(0.25, Math.ceil(Math.max(0, ...points.map((p) => p.aspAverage ?? 0)) * 4) / 4);
  return (
    <div>
      <div className="legend" aria-hidden>
        {SERIES.map((s) => <span key={s.key}><i className={`sw ${s.cls}`} /> {s.label}</span>)}
      </div>
      <LineChart
        title="Win %"
        points={points}
        series={SERIES.map((s) => ({ ...s, value: (p: TrendPoint) => p[s.key] }))}
        yMin={pctMin}
        yMax={1}
        fmt={(v) => fmtPct(v)}
        ticks={niceTicks(pctMin, 1)}
      />
      <LineChart
        title="All-star point average"
        points={points}
        series={[{ key: "asp", label: "ASP avg", cls: "s1", value: (p) => p.aspAverage }]}
        yMin={0}
        yMax={aspTop}
        fmt={(v) => v.toFixed(2)}
        ticks={niceTicks(0, aspTop)}
      />
      {weekly.length > 0 && (
        <>
          <h3>Record by week</h3>
          <ul className="chips">
            {weekly.map((w) => <li key={w.label}>{w.label} <b>{fmtWL(w.record)}</b></li>)}
          </ul>
        </>
      )}
    </div>
  );
}

/** Ticks on multiples of 0.25 (or 0.5 when that would crowd the axis). */
function niceTicks(min: number, max: number): number[] {
  const step = (max - min) / 0.25 > 4 ? 0.5 : 0.25;
  const out: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) out.push(Number(t.toFixed(2)));
  return out;
}

interface Series {
  key: string;
  label: string;
  cls: string;
  value: (p: TrendPoint) => number | null;
}

const W = 340, H = 170, PAD = { l: 40, r: 56, t: 12, b: 26 };

function LineChart({ title, points, series, yMin, yMax, fmt, ticks }: {
  title: string; points: TrendPoint[]; series: Series[]; yMin: number; yMax: number; fmt: (v: number) => string; ticks: number[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const weeks = points.map((p) => p.throughWeek);
  const [x0, x1] = [Math.min(...weeks), Math.max(...weeks)];
  const x = (wk: number) => PAD.l + (x1 === x0 ? 0.5 : (wk - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const last = points.at(-1)!;
  // Direct labels at the last point, pushed apart so close lines stay readable.
  const labelY = new Map<string, number>();
  const ends = series
    .map((s) => ({ key: s.key, v: s.value(last) }))
    .filter((e): e is { key: string; v: number } => e.v !== null)
    .map((e) => ({ key: e.key, y: y(e.v) }))
    .sort((a, b) => a.y - b.y);
  ends.forEach((e, i) => labelY.set(e.key, i ? Math.max(e.y, labelY.get(ends[i - 1].key)! + 13) : e.y));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(x(p.throughWeek) - px) < Math.abs(x(points[best].throughWeek) - px)) best = i; });
    setHover(best);
  };

  const h = hover === null ? null : points[hover];
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <div className="plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} by week`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
              <text className="tick" x={PAD.l - 6} y={y(t)} dy="0.32em" textAnchor="end">{fmt(t)}</text>
            </g>
          ))}
          {points.map((p) => (
            <text key={p.throughWeek} className="tick" x={x(p.throughWeek)} y={H - 8} textAnchor="middle">Wk {p.throughWeek}</text>
          ))}
          {h && <line className="crosshair" x1={x(h.throughWeek)} x2={x(h.throughWeek)} y1={PAD.t} y2={H - PAD.b} />}
          {series.map((s) => {
            const pts = points.filter((p) => s.value(p) !== null);
            const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.throughWeek)},${y(s.value(p)!)}`).join("");
            const lv = s.value(last);
            return (
              <g key={s.key} className={s.cls}>
                <path className="line" d={d} />
                {pts.map((p) => <circle key={p.throughWeek} className="dot" cx={x(p.throughWeek)} cy={y(s.value(p)!)} r={4} />)}
                {lv !== null && series.length > 1 && (
                  <text className="dlabel" x={x(last.throughWeek) + 8} y={labelY.get(s.key)} dy="0.32em">{s.label}</text>
                )}
              </g>
            );
          })}
        </svg>
        {h && (
          <div className="tip" style={{ left: `${(x(h.throughWeek) / W) * 100}%` }}>
            <b>Through week {h.throughWeek}</b>
            {series.map((s) => {
              const v = s.value(h);
              return <div key={s.key}><i className={`sw ${s.cls}`} /> {s.label} {v === null ? "–" : fmt(v)}</div>;
            })}
          </div>
        )}
      </div>
    </figure>
  );
}
