/**
 * A team page's Team tab: things about the team rather than this week's game. Its home bar (a
 * photo, the address and landmark, map links, its home nights still to come), how its season went
 * (place, record, the tournament), and its top three players in each game and in all-star points per game. Laid out photo first so
 * it doesn't read like the match card above the tabs.
 */
import type { Standing, TeamWeek } from "../parser/types";
import { resolveVenue, type Venue } from "../parser/venueMatch";
import { norm } from "../parser/names";
import { PHOTOS_ON } from "../photos/core";
import { BarPhoto } from "./BarPhoto";
import { isFinal, type TournamentState } from "./league";
import { mapsUrls, shortDate, type FixtureRow } from "./model";
import { Link, teamPath } from "./route";
import { ClinchBadge, ordinal } from "./ui";
import barWebsites from "../../data/bar-websites.json";
import barPhotos from "../../data/bar-photos.json";

/** Each bar's own website, else its Facebook or Instagram page, by its name in the league's directory (hand-kept). */
const BAR_WEBSITES: Record<string, string> = barWebsites.sites;
/** Each bar's food menu, where it has one online. */
const BAR_MENUS: Record<string, string> = barWebsites.menus;
/** A bar's link says where it goes: its own site, or its Facebook, Instagram or Yelp page. */
export const siteLabel = (url: string) =>
  /facebook\.com/.test(url) ? "Facebook" : /instagram\.com/.test(url) ? "Instagram" : /yelp\.com/.test(url) ? "Yelp" : "Website";

/**
 * A picture of each bar's front (public/bars/): a Google Street View screenshot, credited to Google with
 * its capture date (`taken`), or the owner's own photo (`source: "own"`), which needs no credit.
 */
const BAR_PHOTOS: Record<string, { file: string; taken?: string; source?: "own" }> = barPhotos.photos as Record<string, { file: string; taken?: string; source?: "own" }>;

const same = (a: string, b: string) => norm(a) === norm(b);

/** The bar a team plays its home matches at: the one its home fixtures name most often. */
export function homeBar(rows: FixtureRow[], venues: Venue[] | undefined): Venue | null {
  const counts = new Map<string, { venue: Venue; n: number }>();
  for (const r of rows) {
    if (r.bye || !r.home || !r.venue) continue;
    const v = resolveVenue(r.venue, venues ?? []);
    if (!v) continue;
    const c = counts.get(v.name) ?? { venue: v, n: 0 };
    counts.set(v.name, { venue: v, n: c.n + 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.venue ?? null;
}

export function TeamInfo({ week, rows, venues, seasonWeeks, tournament, today }: {
  week: TeamWeek; rows: FixtureRow[]; venues: Venue[] | undefined;
  seasonWeeks: number | null; tournament: TournamentState | null; today: string;
}) {
  const team = week.team.name;
  const bar = homeBar(rows, venues);
  const homeNights = rows.filter((r) => !r.bye && r.home && r.date >= today);
  const me = week.standings.find((s) => same(s.team, team));
  return (
    <div className="team-info">
      {bar && <HomeBar bar={bar} nights={homeNights} />}
      {me && <Season me={me} week={week} seasonWeeks={seasonWeeks} tournament={tournament} />}
      <TopPlayers week={week} />
    </div>
  );
}

function HomeBar({ bar, nights }: { bar: Venue; nights: FixtureRow[] }) {
  const urls = mapsUrls(bar.name, [bar]);
  const street = BAR_PHOTOS[bar.name];
  const site = BAR_WEBSITES[bar.name];
  const menu = BAR_MENUS[bar.name];
  return (
    <section className="ti-section" aria-labelledby="ti-bar">
      <h3 id="ti-bar" className="ti-head">Home Bar</h3>
      {PHOTOS_ON ? <BarPhoto barName={bar.name} /> : street ? (
        <figure className="ti-street">
          <img src={`/bars/${street.file}`} alt={`${bar.name} from the street`} width={800} height={450} loading="lazy" />
          {street.taken && <figcaption>Image © Google, Street View, {street.taken}</figcaption>}
        </figure>
      ) : (
        <div className="ti-photo" role="img" aria-label="Photo to come">
          <svg viewBox="0 0 120 60" width="96" height="48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="40" cy="30" r="24" /><circle cx="40" cy="30" r="15" /><circle cx="40" cy="30" r="4" />
            <path d="M44 27 L96 6" /><path d="M86 10 l14 -8 l-2 10 z" />
          </svg>
          <span>Photo to come</span>
        </div>
      )}
      <p className="ti-bar-name">{bar.name}</p>
      <p className="muted">{bar.street}, {bar.area}</p>
      {bar.landmark && <p className="muted">{bar.landmark[0].toUpperCase() + bar.landmark.slice(1)}</p>}
      <div className="maps">
        <a className="map-link" href={urls.apple} target="_blank" rel="noopener">Map (Apple)</a>
        <a className="map-link" href={urls.google} target="_blank" rel="noopener">Map (Google)</a>
        {site && <a className="map-link" href={site} target="_blank" rel="noopener">{siteLabel(site)}</a>}
        {menu && <a className="map-link" href={menu} target="_blank" rel="noopener">Menu</a>}
      </div>
      {nights.length > 0 && <p className="ti-nights">Home nights: {nights.map((r) => shortDate(r.date, false)).join(", ")}</p>}
    </section>
  );
}

/** Place and record, then where the team is in the tournament. */
function Season({ me, week, seasonWeeks, tournament }: { me: Standing; week: TeamWeek; seasonWeeks: number | null; tournament: TournamentState | null }) {
  const division = week.team.division;
  const through = week.week - 1;
  const final = isFinal(through, seasonWeeks);
  const link = (t: string) => <Link to={teamPath(division, t)}>{t}</Link>;
  const cup = !tournament ? null
    : tournament.kind === "champion" ? <>Won the {division} Division tournament</>
    : tournament.kind === "out" ? <>Out in the {tournament.round === "Final" ? "final" : `${tournament.round.toLowerCase()}s`}, beaten by {link(tournament.beatenBy)}</>
    : tournament.kind === "pending" ? <>Awaiting result of {tournament.round.toLowerCase()}{tournament.opponent && <> vs {link(tournament.opponent)}</>}</>
    : <>{tournament.round} {tournament.opponent ? <>vs {link(tournament.opponent)}</> : ""} on {shortDate(tournament.date, false)}{tournament.seed ? `, seed ${tournament.seed}` : ""}</>;
  return (
    <section className="ti-section" aria-labelledby="ti-season">
      <h3 id="ti-season" className="ti-head">This Season</h3>
      <p className="ti-big">
        {ordinal(me.rank)} in {division}, {me.wins}–{me.losses}
        {final && me.rank === 1 && <ClinchBadge mark="G" final />}
      </p>
      <p className="muted">{me.points} points, {final ? "final standings" : `through week ${through}${seasonWeeks ? ` of ${seasonWeeks}` : ""}`}</p>
      {cup && <p className="ti-cup">Tournament: {cup}</p>}
    </section>
  );
}

type Game = "singles301" | "singlesCricket" | "doubles501" | "doublesCricket";
const GAMES: [Game, string][] = [["singles301", "Singles 301"], ["singlesCricket", "Singles Cricket"], ["doubles501", "Doubles 501"], ["doublesCricket", "Doubles Cricket"]];
const TOP = 3;

/**
 * Ranks a sorted list the sports way: rows that tie share a place, and the next place skips
 * (1st, 2nd, 2nd, 4th). Keeps everyone placed within the top `n`, so a tie for 3rd shows both.
 */
function ranked<T>(sorted: T[], same: (a: T, b: T) => boolean, n: number): (T & { rank: number })[] {
  const out: (T & { rank: number })[] = [];
  sorted.forEach((row, i) => {
    const rank = i > 0 && same(sorted[i - 1], row) ? out[i - 1].rank : i + 1;
    out.push({ ...row, rank });
  });
  return out.filter((r) => r.rank <= n);
}

/**
 * The team's best players in each game: win % among those with at least half the busiest
 * player's games in it (so a 2–0 sub doesn't top the list), more wins breaking a tie. Players
 * with the same record share a place.
 */
export function topPlayers(players: TeamWeek["players"], game: Game, n = TOP): { name: string; w: number; l: number; rank: number }[] {
  const played = players.map((p) => ({ name: p.name, w: p[game].w, l: p[game].l })).filter((p) => p.w + p.l > 0);
  const most = Math.max(0, ...played.map((p) => p.w + p.l));
  const sorted = played.filter((p) => p.w + p.l >= most / 2)
    .sort((a, b) => b.w / (b.w + b.l) - a.w / (a.w + a.l) || b.w - a.w);
  return ranked(sorted, (a, b) => a.w === b.w && a.l === b.l, n);
}

/**
 * The team's best all-star points per game this season, among players with at least half the
 * busiest player's games (so one big night as a sub doesn't top it). The same average (to the two
 * places shown) shares a place.
 */
export function topAllStars(players: TeamWeek["players"], n = TOP): { name: string; average: number; rank: number }[] {
  const most = Math.max(0, ...players.map((p) => p.gamesPlayed));
  const sorted = players.filter((p) => p.aspAverage !== null && p.allStarPoints > 0 && p.gamesPlayed >= most / 2)
    .map((p) => ({ name: p.name, average: p.aspAverage!, points: p.allStarPoints }))
    .sort((a, b) => b.average - a.average || b.points - a.points);
  return ranked(sorted, (a, b) => a.average.toFixed(2) === b.average.toFixed(2), n);
}

function TopPlayers({ week }: { week: TeamWeek }) {
  const boards = [
    ...GAMES.map(([game, label]) => ({ label, top: topPlayers(week.players, game).map((p) => ({ name: p.name, rank: p.rank, value: `${p.w}–${p.l}` })) })),
    { label: "All-Star Points Per Game", top: topAllStars(week.players).map((p) => ({ name: p.name, rank: p.rank, value: p.average.toFixed(2) })) },
  ].filter((b) => b.top.length);
  if (!boards.length) return null;
  return (
    <section className="ti-section" aria-labelledby="ti-top">
      <h3 id="ti-top" className="ti-head">Top Players <span className="muted">through week {week.week - 1}</span></h3>
      <div className="ti-boards">
        {boards.map((b) => (
          <div key={b.label}>
            <p className="ti-sub">{b.label}</p>
            <ul className="ti-top">
              {b.top.map((p) => <li key={p.name}><span className="ti-top-rank">{ordinal(p.rank)}</span><span className="ti-top-name">{p.name}</span><span className="muted">{p.value}</span></li>)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
