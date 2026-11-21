/**
 * The division's Players tab (rebuilt 2026-11-19, owner: "the most important tab, but the least
 * aesthetically pleasing and navigable"). Every stat is still here, but one category at a time:
 * chips pick the category (and rank by it), the list is four narrow columns that never scroll
 * sideways, and tapping a player opens their whole line underneath. A "Regulars only" switch,
 * on by default, hides anyone with half the busiest player's games or fewer (owner, 2026-11-21: over 50%) in that category, so a
 * 2–0 sub can't top a win % list.
 */
import { useState } from "react";
import type { WL } from "../parser/types";
import { fmtPct, fmtWL, pct, type DivisionPlayer } from "./model";
import { Link, teamPath } from "./route";
import { ShareButtons, ShareHead } from "./Share";
import { Chevron } from "./ui";

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

/**
 * Higher is better: win %, then wins; all-star points per game, then total. Win % is scaled far
 * above any win count, so wins only break ties (at x1000, 27–15 outranked 11–6: 64% over 65%).
 */
const score = (c: Category, p: DivisionPlayer) => {
  if (!c.wl) return (p.aspAverage ?? -1) * 1e6 + p.allStarPoints;
  const r = c.wl(p);
  return (pct(r) ?? -1) * 1e6 + r.w;
};

const TOP = 25;
/** How many players a shared leaderboard picture shows. */
const SHARE_TOP = 10;

/** What the list is ranked by, in words: "Overall win %", "All-star points per game". */
const rankedBy = (c: Category) => (c.wl ? `${c.label} win %` : "All-star points per game");

/**
 * `team`: one team's players only (its team page), with a team total at the foot (of everyone, regulars
 * or not), and no team name under each player.
 */
export function PlayerBoard({ division, players, mine, week, team }: { division: string; players: DivisionPlayer[]; mine: string | null; week: number; team?: string }) {
  const [catKey, setCatKey] = useState("total");
  const [regulars, setRegulars] = useState(true);
  const [everyone, setEveryone] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const cat = CATEGORIES.find((c) => c.key === catKey)!;

  const played = players.filter((p) => cat.games(p) > 0);
  const busiest = Math.max(0, ...played.map(cat.games));
  const pool = regulars ? played.filter((p) => cat.games(p) * 2 > busiest) : played;
  const rows = [...pool].sort((a, b) => score(cat, b) - score(cat, a) || a.name.localeCompare(b.name));
  // The same record (or average) shares a place; the next one skips (1st, 2nd, 2nd, 4th).
  const places = rows.map((_, i) => i);
  rows.forEach((p, i) => { if (i && score(cat, p) === score(cat, rows[i - 1])) places[i] = places[i - 1]; });
  const listed = everyone ? rows : rows.slice(0, TOP);
  const idOf = (p: DivisionPlayer) => `${p.code}-${p.number}`;
  // The newsletter lists each team's captain first on page 10.
  const captains = new Set<string>();
  const seen = new Set<string>();
  for (const p of players) if (!seen.has(p.code)) { seen.add(p.code); captains.add(idOf(p)); }
  const shareRows = team ? rows : rows.slice(0, SHARE_TOP);
  const shareTitle = team ? `${team} Players` : `${division} Division Top ${SHARE_TOP}`;

  return (
    <div className="pboard">
      <div className="pb-chips" role="group" aria-label="Category">
        {CATEGORIES.map((c) => (
          <button key={c.key} type="button" className="pb-chip" aria-pressed={c.key === catKey}
            onClick={() => { setCatKey(c.key); setEveryone(false); }}>{c.label}</button>
        ))}
      </div>
      <div className="share-row">
        <label className="pb-regulars">
          <input type="checkbox" checked={regulars} onChange={(e) => { setRegulars(e.target.checked); setEveryone(false); }} />
          <span>Regulars only <span className="muted">(&gt;50% games played)</span></span>
        </label>
        <ShareButtons title={`${shareTitle}, ${rankedBy(cat).toLowerCase()}`}
          filename={`rdl-${team ? team.toLowerCase().replace(/[^a-z0-9]+/g, "-") : `${division.toLowerCase()}-top-${SHARE_TOP}`}-${cat.key}.png`}
          version={`${division}-${team ?? ""}-${week}-${cat.key}-${regulars}`}
          card={<>
            <ShareHead title={shareTitle} detail={`${team ? `${division} Division, ` : ""}${rankedBy(cat)}, through week ${week - 1}${regulars ? ", regulars only" : ""}`} />
            <Head cat={cat} still />
            <ol className="pb-list">
              {shareRows.map((p, i) => (
                <li key={idOf(p)} className="pb-item"><div className="pb-row"><Cells p={p} place={places[i]} cat={cat} rows={rows} captain={captains.has(idOf(p))} hideTeam={!!team} /></div></li>
              ))}
            </ol>
            {team && <TeamTotal players={players} cat={cat} />}
          </>} />
      </div>

      <Head cat={cat} />
      <ol className="pb-list" aria-label={`${cat.label}, best first`}>
        {listed.map((p, i) => {
          const id = idOf(p);
          const isOpen = open === id;
          return (
            <li key={id} className={`pb-item${p.team === mine ? " mine" : ""}${isOpen ? " open" : ""}`}>
              <button type="button" className="pb-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : id)}>
                <Cells p={p} place={places[i]} cat={cat} rows={rows} captain={captains.has(idOf(p))} hideTeam={!!team} />
                <Chevron open={isOpen} />
              </button>
              {isOpen && <PlayerLine p={p} division={division} week={week} teamView={!!team} />}
            </li>
          );
        })}
      </ol>
      {team && <TeamTotal players={players} cat={cat} />}
      {rows.length > TOP && (
        <button className="showall" aria-expanded={everyone} onClick={() => setEveryone(!everyone)}>
          {everyone ? `Show top ${TOP} only` : `Show all ${rows.length} players`}
        </button>
      )}
    </div>
  );
}

/** The list's heading row. `still`: in a shared picture, with no column for the ⌄. */
function Head({ cat, still = false }: { cat: Category; still?: boolean }) {
  return (
    <div className="pb-head" aria-hidden="true">
      <span>#</span><span>Player</span><span>{cat.wl ? "W–L" : "Points"}</span><span>{cat.wl ? "Win %" : "Per game"}</span>{!still && <span />}
    </div>
  );
}

/** One player's place, name and team, record and win % (or all-star points and average) with its bar. */
function Cells({ p, place, cat, rows, captain = false, hideTeam = false }: {
  p: DivisionPlayer; place: number; cat: Category; rows: DivisionPlayer[]; captain?: boolean; hideTeam?: boolean;
}) {
  const r = cat.wl?.(p);
  const value = r ? pct(r) : p.aspAverage;
  // Bar length: win % out of 100, or all-star average against the division's best.
  const best = cat.wl ? 1 : Math.max(...rows.map((x) => x.aspAverage ?? 0)) || 1;
  return (
    <>
      <span className="pb-rank">{place + 1}</span>
      <span className="pb-who">
        <span className="pb-name">{p.name}{captain && <> <abbr className="captain" title="Captain">(C)</abbr></>}</span>
        {!hideTeam && <span className="pb-team">{p.team}</span>}
      </span>
      <span className="pb-rec">{r ? fmtWL(r) : p.allStarPoints}</span>
      <span className="pb-val">
        <span className="pb-bar" style={{ width: `${Math.max(0, Math.min(1, (value ?? 0) / best)) * 100}%` }} />
        <span className="pb-num">{r ? fmtPct(value) : (p.aspAverage?.toFixed(2) ?? "–")}</span>
      </span>
    </>
  );
}

/** The whole team's figure in this category, under a team's list: every player's games added up. */
function TeamTotal({ players, cat }: { players: DivisionPlayer[]; cat: Category }) {
  const add = (f: (p: DivisionPlayer) => WL) => players.reduce((t, p) => ({ w: t.w + f(p).w, l: t.l + f(p).l }), { w: 0, l: 0 });
  const r = cat.wl ? add(cat.wl) : null;
  const points = players.reduce((n, p) => n + p.allStarPoints, 0);
  const played = players.reduce((n, p) => n + p.gamesPlayed, 0);
  const value = r ? pct(r) : played ? points / played : null;
  return (
    <div className="pb-row pb-total">
      <span />
      <span className="pb-who"><span className="pb-name">Team</span></span>
      <span className="pb-rec">{r ? fmtWL(r) : points}</span>
      <span className="pb-val">
        <span className="pb-bar" style={{ width: `${r ? Math.max(0, Math.min(1, value ?? 0)) * 100 : 0}%` }} />
        <span className="pb-num">{r ? fmtPct(value) : (value?.toFixed(2) ?? "–")}</span>
      </span>
      <span />
    </div>
  );
}

/** A player's whole line: every category's record and win %, then all-star points. */
function LineGrid({ p }: { p: DivisionPlayer }) {
  const cell = (label: string, r: WL) => (
    <div className="pl-cell"><span className="pl-label">{label}</span><span className="pl-nums"><span className="pl-val">{fmtWL(r)}</span><span className="pl-pct">{fmtPct(pct(r))}</span></span></div>
  );
  return (
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
  );
}

const playedLine = (p: DivisionPlayer) => `${p.gamesPlayed} games in ${p.matchesPlayed} ${p.matchesPlayed === 1 ? "match" : "matches"}`;

/** Everything the newsletter has on one player, opened under their row, with a share for it. */
function PlayerLine({ p, division, week, teamView = false }: { p: DivisionPlayer; division: string; week: number; teamView?: boolean }) {
  return (
    <div className="pl">
      <LineGrid p={p} />
      <div className="share-row pl-foot-row">
        <p className="pl-foot">{playedLine(p)}{!teamView && <> for <Link to={teamPath(division, p.team)}>{p.team}</Link></>}</p>
        <ShareButtons title={p.name} filename={`rdl-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`}
          version={`${p.code}-${p.number}-${week}`}
          card={<>
            <ShareHead title={p.name} detail={`${p.team}, ${division} Division, through week ${week - 1}`} />
            <LineGrid p={p} />
            <p className="share-note">{playedLine(p)}</p>
          </>} />
      </div>
    </div>
  );
}
