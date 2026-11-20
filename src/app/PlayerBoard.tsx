/**
 * The division's Players tab (rebuilt 2026-11-19, owner: "the most important tab, but the least
 * aesthetically pleasing and navigable"). Every stat is still here, but one category at a time:
 * chips pick the category (and rank by it), the list is four narrow columns that never scroll
 * sideways, and tapping a player opens their whole line underneath. A "Regulars only" switch,
 * on by default, hides anyone with under half the busiest player's games in that category, so a
 * 2–0 sub can't top a win % list.
 */
import { useState } from "react";
import type { WL } from "../parser/types";
import { fmtPct, fmtWL, pct, type DivisionPlayer } from "./model";
import { Link, teamPath } from "./route";

interface Category {
  key: string;
  label: string;
  /** The W–L this category ranks by, or none for all-star points. */
  wl?: (p: DivisionPlayer) => WL;
  /** Games counted towards "Regulars only". */
  games: (p: DivisionPlayer) => number;
}

const games = (r: WL) => r.w + r.l;
const wlCat = (key: string, label: string, wl: (p: DivisionPlayer) => WL): Category => ({ key, label, wl, games: (p) => games(wl(p)) });

export const CATEGORIES: Category[] = [
  wlCat("total", "Overall", (p) => p.total),
  wlCat("singles", "Singles", (p) => p.singles),
  wlCat("doubles", "Doubles", (p) => p.doubles),
  // 301 and 501 next to each other, so the chips pack into two rows on a phone.
  wlCat("s301", "301", (p) => p.singles301),
  wlCat("d501", "501", (p) => p.doubles501),
  wlCat("sCricket", "Singles cricket", (p) => p.singlesCricket),
  wlCat("dCricket", "Doubles cricket", (p) => p.doublesCricket),
  { key: "asp", label: "All-star", games: (p) => p.gamesPlayed },
];

/** Higher is better: win %, then wins; all-star points per game, then total. */
const score = (c: Category, p: DivisionPlayer) => {
  if (!c.wl) return (p.aspAverage ?? -1) * 1000 + p.allStarPoints;
  const r = c.wl(p);
  return (pct(r) ?? -1) * 1000 + r.w;
};

const TOP = 25;

export function PlayerBoard({ division, players, mine }: { division: string; players: DivisionPlayer[]; mine: string | null }) {
  const [catKey, setCatKey] = useState("total");
  const [regulars, setRegulars] = useState(true);
  const [everyone, setEveryone] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const cat = CATEGORIES.find((c) => c.key === catKey)!;

  const played = players.filter((p) => cat.games(p) > 0);
  const busiest = Math.max(0, ...played.map(cat.games));
  const pool = regulars ? played.filter((p) => cat.games(p) * 2 >= busiest) : played;
  const rows = [...pool].sort((a, b) => score(cat, b) - score(cat, a) || a.name.localeCompare(b.name));
  // The same record (or average) shares a place; the next one skips (1st, 2nd, 2nd, 4th).
  const places = rows.map((_, i) => i);
  rows.forEach((p, i) => { if (i && score(cat, p) === score(cat, rows[i - 1])) places[i] = places[i - 1]; });
  const listed = everyone ? rows : rows.slice(0, TOP);
  const idOf = (p: DivisionPlayer) => `${p.code}-${p.number}`;

  return (
    <div className="pboard">
      <div className="pb-chips" role="group" aria-label="Category">
        {CATEGORIES.map((c) => (
          <button key={c.key} type="button" className="pb-chip" aria-pressed={c.key === catKey}
            onClick={() => { setCatKey(c.key); setEveryone(false); }}>{c.label}</button>
        ))}
      </div>
      <label className="pb-regulars">
        <input type="checkbox" checked={regulars} onChange={(e) => { setRegulars(e.target.checked); setEveryone(false); }} />
        <span>Regulars only <span className="muted">(half the top player's games or more)</span></span>
      </label>

      <div className="pb-head" aria-hidden="true">
        <span>#</span><span>Player</span><span>{cat.wl ? "W–L" : "Points"}</span><span>{cat.wl ? "Win %" : "Per game"}</span>
      </div>
      <ol className="pb-list" aria-label={`${cat.label}, best first`}>
        {listed.map((p, i) => {
          const id = idOf(p);
          const isOpen = open === id;
          const r = cat.wl?.(p);
          const value = r ? pct(r) : p.aspAverage;
          // Bar length: win % out of 100, or all-star average against the division's best.
          const best = cat.wl ? 1 : Math.max(...rows.map((x) => x.aspAverage ?? 0)) || 1;
          return (
            <li key={id} className={`pb-item${p.team === mine ? " mine" : ""}${isOpen ? " open" : ""}`}>
              <button type="button" className="pb-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : id)}>
                <span className="pb-rank">{places[i] + 1}</span>
                <span className="pb-who">
                  <span className="pb-name">{p.name}</span>
                  <span className="pb-team">{p.team}</span>
                </span>
                <span className="pb-rec">{r ? fmtWL(r) : p.allStarPoints}</span>
                <span className="pb-val">
                  <span className="pb-bar" style={{ width: `${Math.max(0, Math.min(1, (value ?? 0) / best)) * 100}%` }} />
                  <span className="pb-num">{r ? fmtPct(value) : (p.aspAverage?.toFixed(2) ?? "–")}</span>
                </span>
              </button>
              {isOpen && <PlayerLine p={p} division={division} />}
            </li>
          );
        })}
      </ol>
      {rows.length > TOP && (
        <button className="showall" aria-expanded={everyone} onClick={() => setEveryone(!everyone)}>
          {everyone ? `Show top ${TOP} only` : `Show all ${rows.length} players`}
        </button>
      )}
      <p className="muted small">Tap a player for their whole season line.</p>
    </div>
  );
}

/** Everything the newsletter has on one player, opened under their row. */
function PlayerLine({ p, division }: { p: DivisionPlayer; division: string }) {
  const cell = (label: string, r: WL) => (
    <div className="pl-cell"><span className="pl-label">{label}</span><span className="pl-nums"><span className="pl-val">{fmtWL(r)}</span><span className="pl-pct">{fmtPct(pct(r))}</span></span></div>
  );
  return (
    <div className="pl">
      <div className="pl-grid">
        {cell("Overall", p.total)}
        {cell("Singles", p.singles)}
        {cell("Doubles", p.doubles)}
        {cell("Singles 301", p.singles301)}
        {cell("Doubles 501", p.doubles501)}
        {cell("Singles cricket", p.singlesCricket)}
        {cell("Doubles cricket", p.doublesCricket)}
        <div className="pl-cell"><span className="pl-label">All-star points</span><span className="pl-nums"><span className="pl-val">{p.allStarPoints}</span><span className="pl-pct">{p.aspAverage?.toFixed(2) ?? "–"} a game</span></span></div>
      </div>
      <p className="pl-foot">
        {p.gamesPlayed} games in {p.matchesPlayed} {p.matchesPlayed === 1 ? "match" : "matches"} for{" "}
        <Link to={teamPath(division, p.team)}>{p.team}</Link>
      </p>
    </div>
  );
}
