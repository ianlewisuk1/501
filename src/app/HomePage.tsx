/**
 * The league lander: chalk on a black board. Its one job is getting someone to their team's page.
 * A dartboard drawn in chalk has one segment per division; tapping a letter opens that division's
 * page. Someone who knows their team's name can type it instead. Someone who has picked their team
 * ("This is my team" on its page) gets a shortcut back to it at the top, and the team page looked at
 * last gets a quieter link.
 */
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { LeagueWeek } from "../parser/types";
import { ChalkTitle } from "./ChalkTitle";
import { divisionIn, seasonLabel, teamHistory } from "./league";
import { shortDate, todayIso } from "./model";
import { divisionPath, Link, navigate, teamPath } from "./route";
import type { SeasonData } from "./store";
import { sameTeam, type TeamRef } from "./myTeam";

/** A remembered team, if it is still in this season's standings (teams change between seasons). */
const current = (issue: LeagueWeek, t: TeamRef | null) =>
  t && divisionIn(issue, t.division)?.standings.some((s) => s.team === t.team) ? t : null;

export function HomePage({ data, issue, myTeam, lastTeam }: { data?: SeasonData; issue: LeagueWeek; myTeam: TeamRef | null; lastTeam: TeamRef | null }) {
  const known = current(issue, myTeam);
  const last = current(issue, lastTeam);
  // The regular season's length, from the hand-entered schedule.
  const seasonWeeks = data?.schedule?.season === issue.season ? data.schedule.weeks.length : null;
  useBlackStatusBar();

  return (
    <main className="lander">
      {/* Everything that matters fits on the first screen: the dartboard takes whatever height is left. */}
      <div className="lander-fold">
      <img className="board-logo" src={`${import.meta.env.BASE_URL}rdl-logo.png`} alt="" width={104} height={104} />
      <ChalkTitle text="Raleigh Dart League" />
      <p className="board-when">
        {seasonLabel(issue.season)}, week {issue.week}{seasonWeeks ? ` of ${seasonWeeks}` : ""}
      </p>
      <p className="board-updated">Last updated {shortDate(__DATA_UPDATED__)}</p>

      {known && data && <YourTeam data={data} mine={known} />}
      {last && !sameTeam(last, known) && (
        <p className="last-looked">
          Last looked at <Link to={teamPath(last.division, last.team)}>{last.team}</Link>
        </p>
      )}

      <section className="aim" aria-labelledby="aim-h">
        <h2 id="aim-h">Throw for your division</h2>
        <p className="aim-hint">Tap a letter on the board</p>
        <div className="board-wrap">
          <Dartboard issue={issue} />
        </div>
      </section>
      <MoreBelow />
      </div>

      <FindTeam issue={issue} />

      <KeyDates dates={data?.schedule?.season === issue.season ? data.schedule.keyDates : []} />
    </main>
  );
}

/**
 * A chalk arrow under the board, bobbing gently, saying there is more below the first screen.
 * Tapping it scrolls down to the team search; it fades away once the page has been scrolled.
 */
function MoreBelow() {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const onScroll = () => setGone(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <button
      type="button"
      className={gone ? "more-below gone" : "more-below"}
      tabIndex={gone ? -1 : undefined}
      onClick={() => document.getElementById("find")?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" })}
    >
      <svg viewBox="0 0 40 30" width="34" height="26" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 4.5 L20 13.5 L35 4" />
          <path d="M7 16 L20 24.5 L33 15.5" opacity="0.55" />
        </g>
      </svg>
      <span>Search by name, and what's coming up</span>
    </button>
  );
}

/** The phone's status bar goes black with the board, and back to slate when leaving it. */
function useBlackStatusBar() {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const was = meta.content;
    meta.content = "#000000";
    return () => { meta.content = was; };
  }, []);
}

/** The team picked with "This is my team", with this week's match, as one big link back to it. */
function YourTeam({ data, mine }: { data: SeasonData; mine: TeamRef }) {
  const now = teamHistory(data, mine.team).at(-1)?.thisWeek;
  const tonight = !now ? null : "bye" in now ? "Bye this week" : `This week: ${now.home ? "home to" : "away at"} ${now.opponent}`;
  return (
    <div className="your-team">
      <Link className="your-team-link" to={teamPath(mine.division, mine.team)}>
        <span className="your-team-label">Your team</span>
        <span className="your-team-name">{mine.team}</span>
        {tonight && <span className="your-team-now">{tonight}</span>}
      </Link>
    </div>
  );
}

// The board's rings, as radii in a 340 by 340 drawing: bull, outer bull, treble, double.
const C = 170;
const R = { bull: 11, outerBull: 26, trebleIn: 84, trebleOut: 98, doubleIn: 148, doubleOut: 166, letter: 122 };

const point = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${(C + r * Math.cos(a)).toFixed(1)} ${(C + r * Math.sin(a)).toFixed(1)}`;
};
/** A ring segment between two radii and two angles (clockwise from the top). */
const band = (r1: number, r2: number, a1: number, a2: number) =>
  `M${point(r2, a1)}A${r2} ${r2} 0 0 1 ${point(r2, a2)}L${point(r1, a2)}A${r1} ${r1} 0 0 0 ${point(r1, a1)}Z`;

/**
 * A dartboard drawn in chalk, one segment per division, A at the top and on round clockwise.
 * Segments alternate shaded and bare, with red and green chalk on the treble and double rings,
 * like a real board. Each segment is a link to its division. The board starts clean every visit.
 * Tapping one throws a dart: it flies in, sticks in that division's treble, and the page opens.
 */
function Dartboard({ issue }: { issue: LeagueWeek }) {
  const n = issue.divisions.length;
  const step = 360 / n;
  const [hit, setHit] = useState<{ division: string; x: number; y: number } | null>(null);
  const dart = useRef<SVGGElement>(null);

  const throwAt = (division: string, angle: number) => (e: MouseEvent<HTMLAnchorElement>) => {
    // A modifier-click still opens a new tab, and reduced motion goes straight there.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    e.preventDefault();
    if (hit) return;
    const [x, y] = point((R.trebleIn + R.trebleOut) / 2, angle).split(" ").map(Number);
    setHit({ division, x, y });
  };

  useEffect(() => {
    const g = dart.current;
    if (!hit || !g) return;
    const at = `translate(${hit.x}px, ${hit.y}px)`;
    // In from over the thrower's shoulder, big and close, shrinking onto the board; then a shudder.
    const flight = g.animate(
      [
        { transform: `${at} translate(150px, 230px) scale(2.6) rotate(8deg)`, opacity: 0 },
        { opacity: 1, offset: 0.25 },
        { transform: `${at} scale(1) rotate(0deg)`, opacity: 1 },
      ],
      { duration: 380, easing: "cubic-bezier(.3,.1,.6,1)", fill: "forwards" },
    );
    flight.finished.then(() =>
      g.animate(
        [{ transform: `${at} rotate(0deg)` }, { transform: `${at} rotate(-5deg)` }, { transform: `${at} rotate(3deg)` }, { transform: `${at} rotate(0deg)` }],
        { duration: 220, easing: "ease-out", fill: "forwards" },
      ),
    ).catch(() => {});
    const go = setTimeout(() => navigate(divisionPath(hit.division)), 850);
    return () => { clearTimeout(go); flight.cancel(); };
  }, [hit]);

  return (
    <svg className="dartboard" viewBox="0 0 340 340" role="group" aria-label="Divisions">
      <defs>
        {/* Chalk: the edges roughened and the strokes speckled where the stick skipped. */}
        <filter id="chalk-grain" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3" result="d" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.8 1.6" result="m" />
          <feComposite in="d" in2="m" operator="in" />
        </filter>
      </defs>
      <g filter="url(#chalk-grain)">
        {issue.divisions.map((d, i) => {
          const a1 = i * step - step / 2;
          const a2 = a1 + step;
          const ring = i % 2 ? "seg-green" : "seg-red";
          const label = point(R.letter, i * step).split(" ").map(Number);
          return (
            <Link
              key={d.division}
              to={divisionPath(d.division)}
              className={`seg${i % 2 ? " seg-light" : ""}${hit?.division === d.division ? " seg-hit" : ""}`}
              aria-label={`${d.division} Division, ${d.standings.length} teams`}
              onClick={throwAt(d.division, i * step)}
            >
              <path className="seg-fill" d={band(R.outerBull, R.doubleIn, a1, a2)} />
              <path className={ring} d={band(R.doubleIn, R.doubleOut, a1, a2)} />
              <path className={`${ring} seg-treble`} d={band(R.trebleIn, R.trebleOut, a1, a2)} />
              <text className="seg-letter" x={label[0]} y={label[1] + 12} textAnchor="middle" aria-hidden="true">{d.division}</text>
            </Link>
          );
        })}
        <g className="wires" aria-hidden="true">
          {issue.divisions.map((d, i) => (
            <path key={d.division} d={`M${point(R.outerBull, i * step - step / 2)}L${point(R.doubleOut, i * step - step / 2)}`} />
          ))}
          {[R.doubleOut, R.doubleIn, R.trebleOut, R.trebleIn, R.outerBull, R.bull].map((r) => <circle key={r} cx={C} cy={C} r={r} />)}
        </g>
        <circle className="seg-green" cx={C} cy={C} r={R.outerBull - 1} aria-hidden="true" />
        <circle className="seg-red bull" cx={C} cy={C} r={R.bull} aria-hidden="true" />
      </g>
      {hit && <Dart ref={dart} />}
    </svg>
  );
}

/**
 * A dart in chalk, its point at (0, 0) and its flights trailing down to the right, the way it
 * looks stuck in a board from where the thrower stands. Moved into place by the throw.
 */
function Dart({ ref }: { ref: React.Ref<SVGGElement> }) {
  return (
    <g ref={ref} className="dart" aria-hidden="true" style={{ opacity: 0 }}>
      <g transform="rotate(42) scale(1.5)">
        <path className="dart-point" d="M0 0 L9 -1.2 L9 1.2 Z" />
        <rect className="dart-barrel" x="9" y="-3.2" width="17" height="6.4" rx="2.4" />
        <path className="dart-grip" d="M13 -3.2 V3.2 M17 -3.2 V3.2 M21 -3.2 V3.2" />
        <rect className="dart-shaft" x="26" y="-1.3" width="15" height="2.6" />
        <path className="dart-flight" d="M38 0 L46 -11 L56 -11 L52 0 L56 11 L46 11 Z" />
      </g>
    </g>
  );
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Type part of a team's name; matching teams across the league are listed as links. */
function FindTeam({ issue }: { issue: LeagueWeek }) {
  const [q, setQ] = useState("");
  const query = norm(q);
  const hits = !query ? [] : issue.divisions
    .flatMap((d) => d.standings.map((s) => ({ division: d.division, team: s.team })))
    .filter((t) => norm(t.team).includes(query))
    .sort((a, b) => a.team.localeCompare(b.team));
  return (
    <section className="find" id="find">
      <label htmlFor="find-team">Know your team's name? Find it here</label>
      <div className="find-box">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
        </svg>
        <input id="find-team" type="search" placeholder="Type a team name" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {query && (hits.length ? (
        <ul className="team-list">
          {hits.map((t) => (
            <li key={t.division + t.team}>
              <Link to={teamPath(t.division, t.team)}>
                <span className="team-name">{t.team}</span>
                <span className="team-div">{t.division} Division</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="find-none muted">No team by that name this season.</p>)}
    </section>
  );
}

/** Tournaments and the banquet, written along the bottom of the board. Past dates drop off. */
function KeyDates({ dates }: { dates: { date: string; label: string }[] }) {
  const today = todayIso();
  const ahead = dates.filter((d) => d.date >= today);
  if (!ahead.length) return null;
  return (
    <div className="key-dates">
      <h2>Coming up</h2>
      <ul>
        {ahead.map((d) => (
          <li key={d.date}><span className="kd-date">{shortDate(d.date)}</span><span>{d.label}</span></li>
        ))}
      </ul>
    </div>
  );
}
