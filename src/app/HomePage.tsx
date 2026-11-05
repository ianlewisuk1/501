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
import { addDays, shortDate, todayIso } from "./model";
import { divisionPath, Link, navigate, teamPath } from "./route";
import type { SeasonData } from "./store";
import { sameTeam, type TeamRef } from "./myTeam";
import { useBlackStatusBar } from "./ui";
import { setTheme, useThemeSetting } from "./theme";
import { promptInstall, useInstalled, useInstallPrompt, usePlatform } from "./install";

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
      <ThemeToggle />
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

      <AddToHome />
    </main>
  );
}

/**
 * Light or dark, top right of the lander: the whiteboard or the chalkboard. It says what tapping
 * does ("Light" on the chalkboard, "Dark" on the whiteboard), with a sun or a moon, and the choice
 * is remembered on this device.
 */
function ThemeToggle() {
  const theme = useThemeSetting();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className="theme-toggle" onClick={() => setTheme(next)} aria-label={`Switch to ${next} mode`}>
      {next === "light" ? (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        </svg>
      )}
      <span>{next === "light" ? "Light" : "Dark"}</span>
    </button>
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

/**
 * The team picked with "This is my team", as one big link back to it, saying plainly that it's
 * the visitor's pick and what its next match is. Once this issue's match night has passed (its
 * result waits for the next newsletter), the next match is the following week's.
 */
function YourTeam({ data, mine }: { data: SeasonData; mine: TeamRef }) {
  const latest = teamHistory(data, mine.team).at(-1);
  const played = !!latest && latest.issueDate < todayIso();
  const fixture = latest ? (played ? latest.nextWeek : latest.thisWeek) : null;
  const date = latest && (played ? addDays(latest.issueDate, 7) : latest.issueDate);
  const next = !fixture || !date ? null
    : "bye" in fixture ? `Next: a bye week, ${shortDate(date, false)}`
    : `Next: ${shortDate(date, false)}, ${fixture.home ? "home to" : "away at"} ${fixture.opponent}`;
  return (
    <div className="your-team">
      <Link className="your-team-link" to={teamPath(mine.division, mine.team)}>
        <span className="your-team-top">
          <span className="your-team-name">{mine.team}</span>
          <span className="your-team-label"><Star />Your team</span>
        </span>
        {next && <span className="your-team-now">{next}</span>}
        <span className="your-team-why">You picked this team. Change it on any team's page.</span>
      </Link>
    </div>
  );
}

function Star() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8z" fill="currentColor" />
    </svg>
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

/**
 * How to put RDL on your phone's home screen, for everyone (it can't be done for them on an
 * iPhone): a plain two-column table, iPhone and Android, three taps each with the button to look
 * for drawn in. The visitor's own phone's column is marked. Hidden once RDL is opened from the
 * home screen. On Android, when Chrome offers it, a button does it in one tap.
 */
function AddToHome() {
  const env = usePlatform();
  const prompt = useInstallPrompt();
  const installed = useInstalled();
  if (env?.standalone || installed) return null;
  const mine = env?.platform;
  const native = mine === "android" ? prompt : null;
  return (
    <section className="add-home" aria-labelledby="add-home-h">
      <h2 id="add-home-h">Add RDL to your phone</h2>
      <p className="add-home-why">It goes on your home screen like an app and opens straight to the league.</p>
      <table className="add-home-table">
        <thead>
          <tr>
            <th scope="col" className={mine === "ios" ? "mine" : undefined}>iPhone{mine === "ios" && <span className="your-phone">your phone</span>}</th>
            <th scope="col" className={mine === "android" ? "mine" : undefined}>Android{mine === "android" && <span className="your-phone">your phone</span>}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span className="step-n">1</span>In Safari, tap <b>Share</b> <ShareIcon /> at the bottom</td>
            <td><span className="step-n">1</span>In Chrome, tap the <b>menu</b> <DotsIcon /> at the top right</td>
          </tr>
          <tr>
            <td><span className="step-n">2</span>Scroll down, tap <b>Add to Home Screen</b> <PlusBoxIcon /></td>
            <td><span className="step-n">2</span>Tap <b>Add to Home screen</b> or <b>Install app</b> <PlusBoxIcon /></td>
          </tr>
          <tr>
            <td><span className="step-n">3</span>Tap <b>Add</b> at the top right</td>
            <td><span className="step-n">3</span>Tap <b>Add</b> or <b>Install</b></td>
          </tr>
        </tbody>
      </table>
      {native && (
        <button type="button" className="add-home-btn" onClick={() => promptInstall()}>
          <PhoneIcon />Add it now
        </button>
      )}
    </section>
  );
}

/** The "Add to Home Screen" icon both phones use: a square with a plus. */
function PlusBoxIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 24 24" width="20" height="20" role="img" aria-label="Add" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="4" y="4" width="16" height="16" rx="3.5" /><path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10.5 18.5h3" /><path d="M12 7v6M9 10h6" />
    </svg>
  );
}
/** The iPhone's Share icon: a box with an arrow out of the top. */
function ShareIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 24 24" width="20" height="20" role="img" aria-label="Share" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M8 7l4-4 4 4" /><path d="M8 11H6.5A1.5 1.5 0 0 0 5 12.5v7A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 17.5 11H16" />
    </svg>
  );
}
/** Chrome's menu: three dots stacked. */
function DotsIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 24 24" width="20" height="20" role="img" aria-label="menu (three dots)" fill="currentColor">
      <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
    </svg>
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
