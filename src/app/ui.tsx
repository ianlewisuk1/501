/** Pieces shared by the league, division and team pages. */
import { useEffect, useState, type ReactNode } from "react";
import type { Player, Standing, WL } from "../parser/types";
import { fmtPct, fmtWL, pct } from "./model";
import { ChalkTitle } from "./ChalkTitle";
import { syncStatusBar } from "./theme";

/** How many team colours there are: --c0 to --c7 in styles.css, a chalk on the chalkboard and a marker on the whiteboard. */
const TEAM_COLOURS = 8;

/** A team's own colour, the same every visit: picked from its name, as a CSS colour that follows the theme. */
export function chalkFor(team: string): string {
  let h = 0;
  for (const ch of team.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `var(--c${h % TEAM_COLOURS})`;
}

/**
 * What writes the title: on the chalkboard, a worn stick of chalk (rounded, worn to a slant at
 * the tip, dust beneath); on the whiteboard, a dry-erase marker with its cap posted on the end.
 * Both are drawn tip-left; the theme shows one (styles.css).
 */
export const ChalkStick = () => (
  <svg className="chalk-stick" viewBox="0 0 60 24" aria-hidden="true">
    <g className="stick-chalk">
      <ellipse cx="14" cy="21" rx="13" ry="1.6" fill="#ece8dc" opacity=".18" />
      <path d="M9 7.5 L50 4.2 Q55 3.9 55.6 9 Q56 14.2 51 14.6 L10.6 17.4 Q6.5 17.8 4.6 13.4 L3.4 10.6 Q4.4 8 9 7.5 Z" fill="#f2efe6" />
      <path d="M10.6 17.4 L51 14.6 Q55.4 14.2 55.8 10.6 Q54.6 13.3 50.8 13.5 L11 16 Z" fill="#c9c4b6" />
      <path d="M9 7.5 Q4.4 8 3.4 10.6 L4.6 13.4 Q6.5 17.8 10.6 17.4 Q7.8 13 9 7.5 Z" fill="#dcd7ca" />
      <path d="M18 7.2 L24 6.7 M30 6.4 L41 5.5" stroke="#fff" strokeOpacity=".7" strokeWidth=".9" strokeLinecap="round" />
    </g>
    <g className="stick-marker">
      <ellipse cx="30" cy="21.5" rx="24" ry="1.4" fill="#1f2328" opacity=".12" />
      {/* Felt tip, then the grey collar, the white barrel with its ink-colour band, and the cap posted at the back. */}
      <path d="M2.5 12 L8.5 9.8 L8.5 14.2 Z" fill="#1f2328" />
      <path d="M8.5 9.2 L13.5 7.4 L13.5 16.6 L8.5 14.8 Z" fill="#c9ccd0" stroke="#8a8f95" strokeWidth=".5" />
      <rect x="13.5" y="6.6" width="31" height="10.8" rx="1.6" fill="#f4f5f6" stroke="#8a8f95" strokeWidth=".6" />
      <rect x="17" y="6.6" width="7" height="10.8" fill="#1f2328" />
      <path d="M26 8.6 L43 8.6" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity=".9" />
      <rect x="44" y="5.4" width="13" height="13.2" rx="2.4" fill="#1f2328" />
      <rect x="46" y="7" width="9" height="1.4" rx=".7" fill="#4a4f55" />
    </g>
  </svg>
);

export const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 >> 3 ^ 1 && n % 10] || "th"}`;

export const Pin = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
  </svg>
);

/** Page 2's clinch marker as a small pill, only for a team sure to finish first; top-two and bottom-two clinches get none. */
export function ClinchBadge({ mark }: { mark: Standing["clinched"] }) {
  if (mark === "G") return <span className="clinch" title="Sure to finish 1st">Clinched</span>;
  return null;
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
/** Long names get smaller lettering so they stay on one or two lines ("Dirty Darts (Done Dirt Cheap)"). */
const titleSize = (title: string) => (title.length > 20 ? "longer" : title.length > 12 ? "long" : undefined);

export function PageHead({ title, meta, team = false, chalk = false, children }: {
  title: string; meta: string; team?: boolean; chalk?: boolean; children?: ReactNode;
}) {
  return (
    <header className={team ? "page-head team-head" : "page-head"}>
      <div>
        {/* chalk: written on letter by letter as the page opens, like the lander's title (keyed so a new page writes again). */}
        {chalk ? <ChalkTitle key={title} text={title} className={titleSize(title)} /> : <h1 className={titleSize(title)}>{title}</h1>}
        <p className="meta">{meta}</p>
      </div>
      {children}
    </header>
  );
}

/** The phone's status bar matches the page: black or whiteboard on the lander and division pages, slate elsewhere. */
export function useBlackStatusBar() {
  useEffect(() => {
    syncStatusBar();
    return () => syncStatusBar(); // the next page has rendered by the next frame
  }, []);
}


/** A chalk-drawn arrow for stepping between divisions, or between the teams in one. */
export function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === "left" ? "M15 4 L7 12 L15 20" : "M9 4 L17 12 L9 20"} />
    </svg>
  );
}


/** Where the newsletter itself lives: the league's archive of every issue, for everything this site leaves out. */
export const NEWSLETTER_URL = "https://raleighdartleague.org/newsletter/";
export function NewsletterLink() {
  return <> <a href={NEWSLETTER_URL} target="_blank" rel="noopener">Read the full newsletter</a></>;
}
