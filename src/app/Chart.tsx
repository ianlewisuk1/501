import { useState } from "react";
import type { Player, TeamWeek } from "../parser/types";
import { fmtPct, fmtWL, form, pct, playerIn, weeklyGames, WHOLE_TEAM, type FixtureRow, type FormPoint, type WeekGames } from "./model";

const CATEGORIES: [keyof Player, string][] = [
  ["singles301", "Singles 301"],
  ["singlesCricket", "Singles cricket"],
  ["doublesCricket", "Doubles cricket"],
  ["doubles501", "Doubles 501"],
  ["tiebreaker", "1001 tiebreaker"],
];

export function PerformanceChart({ current, history, fixtures }: { current: TeamWeek; history: TeamWeek[]; fixtures: FixtureRow[] }) {
  const [who, setWho] = useState(WHOLE_TEAM);
  const [view, setView] = useState<"breakdown" | "weekly" | "all">("breakdown");
  const player = playerIn(current, who) ?? playerIn(current, WHOLE_TEAM)!;
  const weeks = weeklyGames(current, history, fixtures, player.name);
  const hasWeekly = weeks.some((w) => w.won !== null);
  const shown = hasWeekly ? view : "breakdown";

  return (
    <section aria-labelledby="perf">
      <h2 id="perf">Performance</h2>
      <div className="controls">
        <label hidden={shown === "all"}>
          <span className="sr-only">Player</span>
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            <option>{WHOLE_TEAM}</option>
            {current.players.map((p) => <option key={p.number}>{p.name}</option>)}
          </select>
        </label>
        {hasWeekly && (
          <div className="seg" role="group" aria-label="Chart view">
            <button aria-pressed={shown === "breakdown"} onClick={() => setView("breakdown")}>Breakdown</button>
            <button aria-pressed={shown === "weekly"} onClick={() => setView("weekly")}>Week by week</button>
            <button aria-pressed={shown === "all"} onClick={() => setView("all")}>Compare</button>
          </div>
        )}
      </div>
      {shown === "breakdown" ? <Breakdown player={player} />
        : shown === "weekly" ? <WeeklyChart weeks={weeks} />
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

/**
 * Recent form (solid) against the season so far (dashed), as win %. A week's own record is too
 * noisy to plot (3 or 4 games a night), so it lives in the tooltip; games played sit under each week.
 */
export function WeeklyChart({ weeks }: { weeks: WeekGames[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = form(weeks);
  // Every team match is 24 games; only a player's games played varies.
  const showGames = new Set(pts.filter((p) => p.won !== null).map((p) => p.won! + p.lost!)).size > 1;
  const PAD = { l: 44, r: 10, t: 12, b: showGames ? 48 : 30 }, W = 340, H = 148 + PAD.b;
  const vals = pts.flatMap((p) => [p.night, p.season]).filter((v): v is number => v !== null);
  // Never zoom in past 50–100%: a tighter axis makes an 82% week look like a slump.
  const yMin = Math.min(0.5, Math.max(0, Math.floor((Math.min(...vals) - 0.05) * 4) / 4));
  const ticks = [0, 0.25, 0.5, 0.75, 1].filter((t) => t >= yMin);
  const slot = (W - PAD.l - PAD.r) / Math.max(1, pts.length);
  const x = (i: number) => PAD.l + slot * (i + 0.5);
  const y = (v: number) => PAD.t + (1 - (v - yMin) / (1 - yMin)) * (H - PAD.t - PAD.b);
  const baseY = H - PAD.b;
  const path = (key: "night" | "season") => {
    let d = "";
    pts.forEach((p, i) => { const v = p[key]; d += v === null ? "" : `${d && pts[i - 1]?.[key] != null ? "L" : "M"}${x(i)},${y(v)}`; });
    return d;
  };
  const h = hover === null ? null : pts[hover];

  return (
    <figure className="chart">
      <figcaption>Win % by week</figcaption>
      <div className="legend" aria-hidden>
        <span><i className="sw line-recent" /> That week</span>
        <span><i className="sw line-season" /> Season so far</span>
      </div>
      <div className="plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" onPointerLeave={() => setHover(null)}
          aria-label={`Win % by week. ${pts.filter((p) => p.night !== null).map((p) => `Week ${p.week}: that week ${fmtPct(p.night)}, season ${fmtPct(p.season)}`).join(". ")}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
              <text className="tick" x={PAD.l - 6} y={y(t)} dy="0.32em" textAnchor="end">{fmtPct(t)}</text>
            </g>
          ))}
          {h && <line className="crosshair" x1={x(hover!)} x2={x(hover!)} y1={PAD.t} y2={baseY} />}
          <path className="trend-season" d={path("season")} />
          <path className="trend-recent" d={path("night")} />
          {pts.map((p, i) => (
            <g key={p.week}>
              {p.night !== null && <circle className="dot-recent" cx={x(i)} cy={y(p.night)} r={hover === i ? 5 : 4} />}
              <text className="tick" x={x(i)} y={baseY + 14} textAnchor="middle">{p.week}</text>
              {showGames && <text className="tick played" x={x(i)} y={baseY + 30} textAnchor="middle">{p.won === null ? "–" : p.won + p.lost!}</text>}
              <rect className="hit" x={x(i) - slot / 2} width={slot} y={0} height={H} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
            </g>
          ))}
          <text className="tick axis" x={PAD.l - 6} y={baseY + 14} textAnchor="end">Week</text>
          {showGames && <text className="tick axis" x={PAD.l - 6} y={baseY + 30} textAnchor="end">Games</text>}
        </svg>
        {h && (
          <div className="tip" style={{ left: `${Math.min(78, Math.max(22, (x(hover!) / W) * 100))}%` }}>
            <b>Week {h.week}</b>{h.opponent && <> · vs {h.opponent}</>}
            {h.won === null ? <div>No stats for this week</div> : h.night === null ? <div>Didn't play</div> : (
              <>
                <div><i className="sw line-recent" /> That week {h.won}–{h.lost} · {fmtPct(h.night)}</div>
                <div><i className="sw line-season" /> Season {fmtPct(h.season)}</div>
              </>
            )}
          </div>
        )}
      </div>
    </figure>
  );
}

/**
 * Pick players to compare week by week, against a faint team line. Colours follow newsletter
 * order, so a player keeps theirs however many are picked. Starts with the top three for the season.
 */
export function CompareChart({ players, team }: { players: { name: string; pts: FormPoint[] }[]; team: FormPoint[] }) {
  const series = players.map((p, i) => ({ ...p, color: i, last: [...p.pts].reverse().find((x) => x.season !== null)?.season ?? null }));
  const ranked = [...series].sort((a, b) => (b.last ?? -1) - (a.last ?? -1));
  const [picked, setPicked] = useState(() => new Set(ranked.slice(0, 3).map((s) => s.name)));
  const [hover, setHover] = useState<number | null>(null);
  const shown = series.filter((s) => picked.has(s.name));
  const weeks = team.map((p) => p.week);
  const W = 340, H = 220, PAD = { l: 40, r: 10, t: 12, b: 30 };
  const slot = (W - PAD.l - PAD.r) / Math.max(1, weeks.length);
  const x = (i: number) => PAD.l + slot * (i + 0.5);
  const y = (v: number) => PAD.t + (1 - v) * (H - PAD.t - PAD.b);
  const path = (pts: FormPoint[]) => {
    let d = "";
    pts.forEach((p, i) => { if (p.night !== null) d += `${d && pts[i - 1]?.night != null ? "L" : "M"}${x(i)},${y(p.night)}`; });
    return d;
  };
  const toggle = (name: string) => setPicked((prev) => {
    const next = new Set(prev);
    if (!next.delete(name)) next.add(name);
    return next;
  });

  return (
    <figure className="chart">
      <figcaption>Win % by week</figcaption>
      <div className="legend" aria-hidden>
        <span><i className="sw line-season" /> Whole team</span>
      </div>
      <div className="plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Win % by week for ${shown.map((s) => s.name).join(", ") || "no players"} and the whole team`} onPointerLeave={() => setHover(null)}>
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
          {shown.map((s) => (
            <g key={s.name} className={`pline p${s.color}`}>
              <path d={path(s.pts)} />
              {s.pts.map((p, i) => p.night !== null && <circle key={p.week} className="pdot" cx={x(i)} cy={y(p.night)} r={3} />)}
            </g>
          ))}
          {weeks.map((w, i) => (
            <rect key={w} className="hit" x={x(i) - slot / 2} width={slot} y={0} height={H - PAD.b} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
          ))}
        </svg>
        {!shown.length && <p className="plot-empty muted small">Pick players below to compare.</p>}
        {hover !== null && (
          <div className="tip" style={{ left: `${Math.min(75, Math.max(25, (x(hover) / W) * 100))}%` }}>
            <b>Week {weeks[hover]}</b>
            {[...shown].sort((a, b) => (b.pts[hover].night ?? -1) - (a.pts[hover].night ?? -1)).map((s) => {
              const p = s.pts[hover];
              return <div key={s.name}><i className={`sw p${s.color}`} /> {s.name} {p.won === null ? "–" : p.night === null ? "didn't play" : `${p.won}–${p.lost} · ${fmtPct(p.night)}`}</div>;
            })}
            <div className="muted"><i className="sw line-season" /> Team {fmtPct(team[hover].night)}</div>
          </div>
        )}
      </div>
      <div className="pick-head">
        <span className="small"><b>Compare players</b> <span className="muted">· season win %</span></span>
        <span className="small">
          <button className="linkish" onClick={() => setPicked(new Set(series.map((s) => s.name)))}>All</button>
          {" · "}
          <button className="linkish" onClick={() => setPicked(new Set())}>None</button>
        </span>
      </div>
      <ul className="plegend">
        {ranked.map((s) => (
          <li key={s.name}>
            <button aria-pressed={picked.has(s.name)} aria-label={s.name} className={`p${s.color}`} onClick={() => toggle(s.name)}>
              <i className="sw" /> <span>{shortName(s.name)}</span> <b>{fmtPct(s.last)}</b>
            </button>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** "John Geraghty" -> "John G.", so two chips fit across a phone. */
const shortName = (name: string) => {
  const parts = name.split(" ");
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]}.` : name;
};
