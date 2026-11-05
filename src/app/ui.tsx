/** Pieces shared by the league, division and team pages. */
import { useState, type ReactNode } from "react";
import type { Player, Standing, WL } from "../parser/types";
import { fmtPct, fmtWL, pct } from "./model";
import { Link, teamPath } from "./route";

/** Sticks of chalk a team can be written in. Losses keep the pink, so it isn't here. */
const CHALKS = ["#f3d36b", "#8fc7e8", "#f2a3b6", "#9fdcb8", "#f4b26b", "#c3a8ec", "#b9d97a", "#7fd6d0"];

/** A team's own chalk colour, the same every visit: picked from its name. */
export function chalkFor(team: string): string {
  let h = 0;
  for (const ch of team.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CHALKS[h % CHALKS.length];
}

/** A worn stick of chalk lying where it stopped writing: rounded, worn to a slant at the tip, with dust beneath. */
export const ChalkStick = () => (
  <svg className="chalk-stick" viewBox="0 0 60 24" aria-hidden="true">
    <ellipse cx="14" cy="21" rx="13" ry="1.6" fill="#ece8dc" opacity=".18" />
    <path d="M9 7.5 L50 4.2 Q55 3.9 55.6 9 Q56 14.2 51 14.6 L10.6 17.4 Q6.5 17.8 4.6 13.4 L3.4 10.6 Q4.4 8 9 7.5 Z" fill="#f2efe6" />
    <path d="M10.6 17.4 L51 14.6 Q55.4 14.2 55.8 10.6 Q54.6 13.3 50.8 13.5 L11 16 Z" fill="#c9c4b6" />
    <path d="M9 7.5 Q4.4 8 3.4 10.6 L4.6 13.4 Q6.5 17.8 10.6 17.4 Q7.8 13 9 7.5 Z" fill="#dcd7ca" />
    <path d="M18 7.2 L24 6.7 M30 6.4 L41 5.5" stroke="#fff" strokeOpacity=".7" strokeWidth=".9" strokeLinecap="round" />
  </svg>
);

export const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 >> 3 ^ 1 && n % 10] || "th"}`;

export const Pin = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
  </svg>
);

/** Page 2's clinch marker as a small pill; bottom-two clinches get none. */
export function ClinchBadge({ mark }: { mark: Standing["clinched"] }) {
  if (mark === "G") return <span className="clinch champ" title="Regular-season division champion">Champion</span>;
  if (mark === "C") return <span className="clinch" title="Clinched a top-two finish">Clinched</span>;
  return null;
}

/** A division's standings. Team names link to their pages; one team can be highlighted. */
export function StandingsTable({ standings, division, highlight }: { standings: Standing[]; division: string; highlight?: string }) {
  return (
    <table>
      <thead><tr><th className="num">#</th><th>Team</th><th className="num">W–L</th><th className="num">Pts</th></tr></thead>
      <tbody>
        {standings.map((s) => (
          <tr key={s.team} className={s.team === highlight ? "us" : undefined}>
            <td className="num">{s.rank}</td>
            <td><Link to={teamPath(division, s.team)}>{s.team}</Link><ClinchBadge mark={s.clinched} /></td>
            <td className="num">{s.wins}–{s.losses}</td>
            <td className="num">{s.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface Column<T = Player> {
  key: string;
  label: string;
  group: string;
  /** Sort value; higher is better. */
  sort: (p: T) => number;
  show: (p: T) => string;
}

export const wlCol = <T,>(key: string, label: string, group: string, get: (p: T) => WL): Column<T> => ({
  key, label, group,
  sort: (p) => { const r = get(p); return (pct(r) ?? -1) * 1000 + r.w; },
  show: (p) => fmtWL(get(p)),
});
export const pctCol = <T,>(key: string, group: string, get: (p: T) => WL): Column<T> => ({
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
export function useSort<T extends { name: string }>(items: T[], columns: Column<T>[], initial: string) {
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
export const groupSpans = <T,>(columns: Column<T>[]) => columns.reduce<{ group: string; span: number }[]>((acc, c) => {
  const last = acc.at(-1);
  if (last?.group === c.group) last.span++;
  else acc.push({ group: c.group, span: 1 });
  return acc;
}, []);
export const GROUPS = groupSpans(PLAYER_COLUMNS);

/**
 * The heading every division and team page opens with: the name in chalk, one plain line under it
 * (division or season, and the week), and a switcher to another division or team beside them.
 * A team's name is written in that team's own chalk.
 */
export function PageHead({ title, meta, team = false, children }: { title: string; meta: string; team?: boolean; children?: ReactNode }) {
  return (
    <header className={team ? "page-head team-head" : "page-head"}>
      <div>
        <h1 className={title.length > 10 ? "long" : undefined}>{title}</h1>
        <p className="meta">{meta}</p>
      </div>
      {children}
    </header>
  );
}
