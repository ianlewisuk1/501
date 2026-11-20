/**
 * One division, on black like the lander: a short header with the neighbouring divisions, then
 * tabs: the standings written up as a chalk ladder, every week's matches, the players, and the
 * division's records. A team picked with "This is my team" is starred wherever it appears.
 */
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { LeagueDivision, LeagueWeek, Match, PerfectThrow, Pick, Standing } from "../parser/types";
import { Fold, SectionHead } from "./Fold";
import { bracketView, divisionRounds, withBracketFile, currentWeek, headlineStories, isFinal, resultsLabel, teamForm, titleFeat, type BracketEntry, type BracketGame, type DivisionRound } from "./league";
import { shortDate, teamSlug, todayIso, withClinchedFirst, type DivisionPlayer } from "./model";
import { divisionPath, Link, teamPath } from "./route";
import type { SeasonData } from "./store";
import { PlayerBoard } from "./PlayerBoard";
import { Tabs } from "./Tabs";
import { TeamText } from "./TeamText";
import { useMyTeams } from "./myTeam";
import { Arrow, TeamName, ClinchBadge, chalkFor, FitName, NewsletterLink, ordinal, PageHead, useBlackStatusBar } from "./ui";

export function DivisionPage({ data, issue, division }: { data: SeasonData; issue: LeagueWeek; division: LeagueDivision }) {
  const d = division.division;
  const players = useMemo<DivisionPlayer[]>(
    () => division.teams.flatMap((t) => t.players.map((p) => ({ ...p, team: t.name, code: t.code }))), [division]);
  const rounds = useMemo(() => divisionRounds(data, d), [data, d]);
  const seasonWeeks = data.schedule?.season === issue.season ? data.schedule.weeks.length : null;
  const throws = useMemo(() => issue.perfectThrows.filter((p) => p.division === d), [issue, d]);
  const hasRecords = division.records.length > 0 || throws.length > 0 || division.hotDarts.length > 0;
  useBlackStatusBar();
  // The divisions either side, wrapping round (H's next is A), so both arrows always work.
  const n = issue.divisions.length;
  const i = issue.divisions.findIndex((x) => x.division === d);
  const prev = issue.divisions[(i - 1 + n) % n].division;
  const next = issue.divisions[(i + 1) % n].division;
  // Atop the Standings tab: which week's results the table is from ("Final standings, after week 14, Nov 11").
  const results = division.results;
  const final = isFinal(results?.week, seasonWeeks);
  const week = currentWeek(data, issue, todayIso());
  // Once the regular season's last night has passed, the tournament is the news: its tab goes first.
  const lastNight = data.schedule?.season === issue.season ? data.schedule.weeks.at(-1)?.date : undefined;
  const seasonOver = !!lastNight && todayIso() > lastNight;
  const bracketTab = {
    id: "bracket", label: "Bracket", show: !!division.bracket,
    body: division.bracket ? <BracketBoard division={division} data={data} /> : null,
  };
  return (
    <main className="division-page">
      <div className="div-head">
        {n > 1 && <Link className="div-step" to={divisionPath(prev)} aria-label={`Previous: ${prev} Division`}><Arrow dir="left" /></Link>}
        <PageHead chalk title={`${d} Division`}>
          {/* The league's match night, the same for every division ("Week 13 of 14", "Quarterfinals tonight"). */}
          {week && <p className="week-pill">{week}</p>}
        </PageHead>
        {n > 1 && <Link className="div-step" to={divisionPath(next)} aria-label={`Next: ${next} Division`}><Arrow dir="right" /></Link>}
      </div>
      <Tabs label="Division sections" tabs={[
        ...(seasonOver ? [bracketTab] : []),
        {
          id: "standings", label: "Standings", show: true,
          body: (
            <section aria-labelledby="standings">
              <SectionHead id="standings" title="Standings" detail={results ? resultsLabel(results, seasonWeeks) : undefined} />
              <Ladder standings={final ? withChampion(division.standings) : withClinchedFirst(division.standings, seasonWeeks)} division={d} final={final} rounds={rounds} />
              {division.titleRace && <TitleRace text={division.titleRace} week={issue.week} division={division} />}
              {division.headline && <Headlines text={division.headline} week={issue.week - 1} division={division} />}
            </section>
          ),
        },
        { id: "matches", label: "Matches", show: rounds.length > 0, body: <Matches rounds={rounds} now={issue.week} division={division} /> },
        { id: "leaderboard", label: "Players", show: players.length > 0, body: <Leaderboard week={issue.week} division={d} players={players} /> },
        { id: "records", label: "Records", show: hasRecords, body: <Records division={division} throws={throws} week={issue.week - 1} /> },
        ...(seasonOver ? [] : [bracketTab]),
      ]} />
      <footer className="muted small">
        <NewsletterLink />
      </footer>
    </main>
  );
}

/**
 * The standings written up as a chalk ladder, one line a team: its name in its own chalk (shrunk to
 * fit rather than wrapped), then its record and its points big on the right. The leader is ringed,
 * with its record and how far clear it is on a second line.
 */
/** After the season: the first-place team is the champion, whether or not the newsletter marked it. */
function withChampion(standings: Standing[]): Standing[] {
  if (standings.some((s) => s.clinched === "G")) return standings;
  return standings.map((s, i) => (i === 0 ? { ...s, clinched: "G" as const } : s));
}

function Ladder({ standings, division, final, rounds }: { standings: Standing[]; division: string; final: boolean; rounds: DivisionRound[] }) {
  const mine = useMine(division);
  const [open, setOpen] = useState<string | null>(null);
  // "Clinched" needs a key; after the season the leader's pill says "Season champs", which doesn't.
  const clinched = !final && standings.some((s) => s.clinched === "G");
  return (
    <>
    {/* Laid out like the Players list (owner, 2026-11-20): same row height and lettering, a small
        heading row, place | team | W–L | points. Tapping a team opens its form (2026-11-20). */}
    <div className="ladder-head" aria-hidden="true"><span>#</span><span>Team</span><span>W–L</span><span>Pts</span><span /></div>
    <ol className="ladder">
      {standings.map((s, i) => {
        const isOpen = open === s.team;
        const panel = `form-${teamSlug(s.team)}`;
        return (
        <li key={s.team} className={[i === 0 && "ladder-top", s.team === mine && "ladder-mine", isOpen && "open"].filter(Boolean).join(" ") || undefined}>
          <button type="button" className="ladder-row" aria-expanded={isOpen} aria-controls={panel} onClick={() => setOpen(isOpen ? null : s.team)}>
            <span className="ladder-rank">{s.rank}</span>
            <span className="ladder-team">
              <span className="ladder-line" style={{ color: chalkFor(s.team) }}><FitName name={s.team} className="ladder-name" />{s.team === mine && <MyStar />}{i > 0 && <ClinchBadge mark={s.clinched} final={final} />}</span>
              {/* The leader's clinch mark gets a line of its own, leaving the name the whole width. */}
              {i === 0 && s.clinched === "G" && <span className="ladder-clear"><ClinchBadge mark={s.clinched} final={final} /></span>}
            </span>
            <span className="ladder-rec" aria-label={`${s.wins} wins, ${s.losses} losses`}>{s.wins}–{s.losses}</span>
            <span className="ladder-pts" aria-label={`${s.points} points`}>{s.points}</span>
            <Chevron open={isOpen} />
          </button>
          {isOpen && <TeamFormStrip id={panel} team={s.team} division={division} rounds={rounds} />}
        </li>
        );
      })}
    </ol>
    {/* What the clinch mark means, only when one shows: a tooltip never appears on a phone. */}
    {clinched && <p className="ladder-key"><b>✓ Clinched</b> means sure to finish 1st.</p>}
    </>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`ladder-chev${open ? " up" : ""}`} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A team's season under its standings row: one small card a week, oldest on the left, in a strip
 * that scrolls sideways and opens at the newest week. Then a link to the team's page.
 */
function TeamFormStrip({ id, team, division, rounds }: { id: string; team: string; division: string; rounds: DivisionRound[] }) {
  const form = useMemo(() => teamForm(rounds, team), [rounds, team]);
  const strip = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    const el = strip.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [form]);
  return (
    <div className="ladder-form" id={id}>
      {form.length ? (
        <ol className="form-strip" ref={strip} aria-label={`${team}, week by week`}>
          {form.map((f) => (
            <li key={f.week} className="form-night">
              <span className="fn-week">Week {f.week}</span>
              {f.bye ? <span className="fn-bye">Bye</span> : (
                <>
                  <span className="fn-res">
                    {f.result ? <span className={`badge ${f.result === "W" ? "win" : "loss"}`}>{f.result}</span> : <span className="badge tie">–</span>}
                    {f.us != null && f.them != null && <span className="fn-score">{f.us}–{f.them}</span>}
                  </span>
                  <span className="fn-opp" title={f.opponent}><span className="fn-where">{f.home ? "vs" : "at"}</span><TeamName team={f.opponent} short={f.opponentShort} className="fn-team" /></span>
                  {f.tiebreak && f.result && <span className="fn-note">On the 1001</span>}
                  {f.note && <span className="fn-note">{f.note.includes("forfeit") ? "Forfeit" : "Score to come"}</span>}
                </>
              )}
            </li>
          ))}
        </ol>
      ) : <p className="muted small fn-none">No matches played yet.</p>}
      <Link className="fn-link" to={teamPath(division, team)}>Team page</Link>
    </div>
  );
}

const joinNames = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/**
 * The division's best throws, as three boards (owner, 2026-11-19): the season's trophy darts (the
 * standing records) first, then last week's hot darts in the same plain style, then the perfect
 * throws as tallies.
 */
function Records({ division, throws, week }: { division: LeagueDivision; throws: PerfectThrow[]; week: number }) {
  const kinds = [...new Set(throws.map((t) => t.kind))];
  // The same feat by several players reads as one line: "4 ASPs" and everyone who threw it.
  const feats = [...new Set(division.hotDarts.map((h) => h.feat))].map((feat) => ({ feat, who: division.hotDarts.filter((h) => h.feat === feat) }));
  return (
    <>
      {division.records.length > 0 && (
        <section className="rec-section" aria-labelledby="rec-trophy-h">
          <h2 id="rec-trophy-h" className="rec-head">Trophy Darts<span className="rec-head-note">Best this season</span></h2>
          <ul className="rec-board rec-trophy">
            {division.records.map((r) => (
              <li key={r.category}>
                <h3 className="rec-cat">{r.category}</h3>
                <span className="rec-val">{r.holders.length ? r.value : "–"}</span>
                <span className="rec-body">
                  {r.holders.length ? r.holders.map((h, j) => (
                    <span key={j} className="rec-holder">
                      <span className="rec-name">{joinNames(h.players)}</span>{" "}
                      <span className="rec-team-date"><span className="rec-team" style={{ color: chalkFor(h.team) }}>{h.team}</span>
                      {h.date && <span className="rec-date">, {shortDate(h.date, false)}</span>}</span>
                    </span>
                  )) : <span className="rec-holder muted">None reported yet</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {feats.length > 0 && (
        <section className="rec-section" aria-labelledby="rec-hot-h">
          <h2 id="rec-hot-h" className="rec-head">Hot Darts<span className="rec-head-note">Week {week}</span></h2>
          <ul className="rec-board rec-hot">
            {feats.map(({ feat, who }) => (
              <li key={feat}>
                <span className="rec-val">{titleFeat(feat)}</span>
                <span className="rec-body">
                  {who.map((h, j) => (
                    <span key={j} className="rec-holder">
                      <span className="rec-name">{joinNames(h.players)}</span>{" "}
                      <span className="rec-team" style={{ color: chalkFor(h.team) }}>{h.team}</span>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {kinds.length > 0 && (
        <section className="rec-section" aria-labelledby="rec-perfect-h">
          <h2 id="rec-perfect-h" className="rec-head">Perfect Throws<span className="rec-head-note">This season</span></h2>
          {kinds.map((k) => {
            const who = throws.filter((t) => t.kind === k);
            const count = who.reduce((n, t) => n + Math.max(1, t.dates.length), 0);
            return (
              <div key={k} className="rec-kind-block">
                <h3 className="rec-kind"><span>{k}</span><Tally n={count} /></h3>
                <ul className="rec-throwers">
                  {who.map((t) => (
                    <li key={t.player + t.team}>
                      <span><span className="rec-name">{t.player}</span>{t.dates.length > 1 && <span className="rec-times"> ×{t.dates.length}</span>}</span>{" "}
                      <span className="rec-team" style={{ color: chalkFor(t.team) }}>{t.team}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

/** A count chalked up the way a scorer does it: four strokes and a fifth across. */
function Tally({ n }: { n: number }) {
  const groups = Array.from({ length: Math.ceil(n / 5) }, (_, g) => Math.min(5, n - g * 5));
  return (
    <span className="tally" role="img" aria-label={`${n} this season`}>
      {groups.map((k, g) => (
        <svg key={g} viewBox="0 0 30 22" width="30" height="22" aria-hidden="true">
          {Array.from({ length: Math.min(4, k) }, (_, i) => (
            <path key={i} d={`M${5 + i * 6} ${3 + (i % 2)} L${4.5 + i * 6 + (i % 2)} 19`} />
          ))}
          {k === 5 && <path d="M1 16 L28 5" />}
        </svg>
      ))}
    </span>
  );
}

/**
 * The editor's write-up of a week in this division, from page 1's RDL Headlines: one story a line
 * (the newsletter runs them together with semicolons), in his words.
 */
function Headlines({ text, week, division }: { text: string; week: number; division: LeagueDivision }) {
  const stories = headlineStories(text);
  const teams = division.standings.map((s) => s.team);
  return (
    <aside className="headlines" aria-label={`Kilt's headlines, week ${week}`}>
      <p className="headlines-label">Kilt's headlines <span>week {week}</span></p>
      <ul>{stories.map((t, i) => <li key={i}><TeamText text={t} division={division.division} teams={teams} /></li>)}</ul>
    </aside>
  );
}

/**
 * The last issue's "title possibilities": who can still finish first, or in the top two, on the
 * season's last night, in the editor's words. Styled like the headlines, under its own label.
 */
function TitleRace({ text, week, division }: { text: string; week: number; division: LeagueDivision }) {
  return (
    <aside className="headlines title-race" aria-label={`Kilt's title race, week ${week}`}>
      <p className="headlines-label">Title race <span>going into week {week}</span></p>
      <p><TeamText text={text} division={division.division} teams={division.standings.map((s) => s.team)} /></p>
    </aside>
  );
}

/** The team picked with "This is my team", if it's in this division. */
const useMine = (division: string) => {
  const { picked } = useMyTeams();
  return picked?.division === division ? picked.team : null;
};

/**
 * The picked team's row gets a yellow stripe down its left edge (CSS `.mine`); this only says so
 * to screen readers. It used to be a star after the name, but that took width from the name and
 * clipped "Area 501" in the bracket on an iPhone 13 (owner, 2026-11-19).
 */
const MyStar = () => <span className="sr-only">, your team</span>;

/** The week in the link (?week=12), so a shared link opens on the same week. */
const weekFromUrl = (): number | null => {
  const w = typeof location === "undefined" ? null : Number(new URLSearchParams(location.search).get("week"));
  return w || null;
};

/**
 * Every week's matches, one week at a time: big back and forward buttons either side of a plain
 * dropdown of the weeks. Opens on this week. Played weeks show scores, the rest show venues.
 */
function Matches({ rounds, now, division }: { rounds: DivisionRound[]; now: number; division: LeagueDivision }) {
  // Opens on the next match night still to come (a week just played shows no scores until the
  // next newsletter), else this issue's week.
  const today = todayIso();
  const start = rounds.find((r) => !r.played && r.date >= today)?.week ?? now;
  const [picked, setPicked] = useState(() => weekFromUrl() ?? start);
  // The picked week, else this week, else the latest one there is.
  const find = (w: number) => rounds.findIndex((r) => r.week === w);
  const at = [find(picked), find(start), rounds.length - 1].find((k) => k >= 0)!;
  const round = rounds[at];
  const go = (week: number) => {
    setPicked(week);
    const url = new URL(location.href);
    if (week === start) url.searchParams.delete("week");
    else url.searchParams.set("week", String(week));
    history.replaceState(null, "", url);
  };
  const label = (r: DivisionRound) => `Week ${r.week}${r.week === start ? " (next)" : ""}`;
  return (
    <section aria-labelledby="matches">
      <h2 id="matches" className="sr-only">Matches</h2>
      <div className="week-step">
        <button type="button" aria-label="Previous week" disabled={at === 0} onClick={() => go(rounds[at - 1].week)}><Arrow dir="left" /></button>
        <label>
          <span className="sr-only">Week</span>
          <select value={round.week} onChange={(e) => go(Number(e.target.value))}>
            {rounds.map((r) => <option key={r.week} value={r.week}>{label(r)}</option>)}
          </select>
        </label>
        <button type="button" aria-label="Next week" disabled={at === rounds.length - 1} onClick={() => go(rounds[at + 1].week)}><Arrow dir="right" /></button>
      </div>
      <p className="tab-note matches-note">{shortDate(round.date)}: {round.played ? "final scores" : round.week === start ? "next match night" : "still to play"}</p>
      {/* --k lets the cards share out the screen's height on short phones (styles.css). */}
      <ul className="cards" style={{ "--k": round.matches.length + round.byes.length } as CSSProperties}>
        {round.played
          ? round.matches.map((m) => <ResultCard key={m.home.team} match={m} division={division} pick={pickFor(round, m.away.team, m.home.team)} />)
          : round.matches.map((m) => (
              <MatchCard key={m.home} division={division}
                rows={[{ team: m.away }, { team: m.home }]}
                status={shortDate(m.date ?? round.date)}
                aside={m.venue}
                pick={pickFor(round, m.away, m.home)} />
            ))}
        {round.byes.map((b) => <MatchCard key={b} division={division} rows={[{ team: b }]} status="Bye" />)}
      </ul>
      <p className="muted small cards-note">Home team second.{round.played ? " Out of 24 games." : ""} Places and records are from the current standings.</p>
    </section>
  );
}

interface CardRow { team: string; score?: number | null; won?: boolean; lost?: boolean }

/**
 * A team name that always fits on one line: when it is too wide for its space, its text is
 * scaled down just enough (re-measured whenever the space changes size).
 */

/**
 * One match as a scoreboard card: a strip along the top with the status (Final, or the
 * day) and the venue, then a row per team: place, name and record, score, a mark by the winner.
 */
const pickFor = (round: DivisionRound, away: string, home: string) => round.picks.find((p) => p.away === away && p.home === home);

function MatchCard({ rows, status, aside, note, division, pick }: {
  rows: CardRow[]; status: string; aside?: string; note?: string; division: LeagueDivision; pick?: Pick;
}) {
  const mine = useMine(division.division);
  return (
    <li className={`card${rows.some((r) => r.score != null) ? "" : " unplayed"}`}>
      <p className="card-head"><span className="card-status">{status}</span>{aside && <span className="card-aside">{aside}</span>}</p>
      {rows.map((r) => {
        const s = division.standings.find((x) => x.team === r.team);
        return (
          <Link key={r.team} className={`card-row${r.won ? " won" : ""}${r.lost ? " lost" : ""}${r.team === mine ? " mine" : ""}`} to={teamPath(division.division, r.team)}>
            <span className="rank-tag" title={s ? `${ordinal(s.rank)} in the standings` : undefined}>{s?.rank}</span>
            <span className="card-name">
              <span className="card-line"><FitName name={r.team} />{r.team === mine && <MyStar />}</span>
              {s && <span className="card-rec">{s.wins}–{s.losses}</span>}
            </span>
            <span className="card-score">{r.score ?? ""}</span>
            <span className="card-mark" aria-label={r.won ? "won" : undefined}>{r.won ? "◂" : ""}</span>
          </Link>
        );
      })}
      {note && <p className="card-foot">{note}</p>}
      {pick && <PickNote pick={pick} division={division.division} />}
    </li>
  );
}

/** A played match: scores, the winner marked (a 12–12 goes to whoever won the 1001), any forfeit or missing-sheet note. */
function ResultCard({ match, division, pick }: { match: Match; division: LeagueDivision; pick?: Pick }) {
  const { away, home } = match;
  const scored = away.score !== null && home.score !== null;
  const winner = !scored ? null
    : away.score! > home.score! || (away.score === home.score && away.tiebreaker1001 === "W") ? away.team
    : home.score! > away.score! || (away.score === home.score && home.tiebreaker1001 === "W") ? home.team : null;
  const row = (t: typeof away): CardRow => ({ team: t.team, score: t.score, won: t.team === winner, lost: !!winner && t.team !== winner });
  const status = !scored ? "No score yet" : "Final";
  const aside = scored && away.score === home.score ? "Won on the 1001" : undefined;
  return <MatchCard rows={[row(away), row(home)]} status={status} aside={aside} note={match.note} division={division} pick={pick} />;
}

/**
 * Kilt's pick (the newsletter editor), along the bottom of a match card, in his own words. A
 * featured match shows its closing call and opens to the whole write-up; a listed one is its
 * score line. One line each, so a week of cards fits the screen; a long call ends in "…".
 * No winner is read into the prose.
 */
function PickNote({ pick, division }: { pick: Pick; division: string }) {
  if (!pick.featured) {
    return <p className="card-pick"><span className="card-pick-label">Kilt's pick</span><span className="card-pick-text">{pick.text}</span></p>;
  }
  const others = pick.together - 1;
  const summary = pick.call ?? `Written up with ${others} other ${division} ${others === 1 ? "match" : "matches"}`;
  return (
    <details className="card-pick">
      <summary><span className="card-pick-label">Kilt's pick</span><span className="card-pick-text">{summary}</span><span className="card-pick-more" aria-hidden="true" /></summary>
      <p>{pick.text}</p>
    </details>
  );
}

/** Every player in the division, one category at a time (PlayerBoard.tsx). */
export function Leaderboard({ week, division, players }: { week: number; division: string; players: DivisionPlayer[] }) {
  const mine = useMine(division);
  if (!players.length) return null;
  const teams = new Set(players.map((p) => p.code)).size;
  return (
    <section aria-labelledby="division">
      <SectionHead id="division" title="Leaderboard" detail={`Through week ${week - 1}`} />
      <Fold show="Show leaderboard" hide="Hide leaderboard"
        summary={<>All {players.length} players on {teams} teams, in any category: singles, doubles, all-star points per game and more.</>}>
        <PlayerBoard division={division} players={players} mine={mine} />
      </Fold>
    </section>
  );
}


/**
 * The divisional tournament, start to finish: quarterfinals, semifinals, the final and the winner,
 * left to right, with lines joining each pair of matches to the one they feed. The draw is fixed
 * before the first round, so every bar and night is known; teams fill in as they're decided.
 * On a phone it scrolls sideways inside its own box.
 */
function BracketBoard({ division, data }: { division: LeagueDivision; data: SeasonData }) {
  const view = useMemo(
    () => bracketView(withBracketFile(division.bracket!, data.bracket, division.division), division.standings), [division, data.bracket]);
  const [qf, sf, fin] = view.rounds;
  // Full names where they fit the box, else page 2's short names ("Menace", "Projectile").
  const short = useMemo(() => new Map(division.results?.matches.flatMap((m) => [[m.away.team, m.away.short], [m.home.team, m.home.short]]) ?? []), [division]);
  const ctx = { division, short };
  return (
    <section aria-labelledby="bracket">
      <SectionHead id="bracket" title="Tournament" />
      {/* Short facts, hyphen-bulleted (owner, 2026-11-19). */}
      <ul className="tab-note b-facts">
        <li>Matches start at 7:00 pm.</li>
        <li>Each match is best of three.</li>
        <li>Matches end when one team reaches 13 points.</li>
      </ul>
      <div className="scroll-x bracket-scroll">
        <div className="bracket">
          {view.rounds.map((r) => (
            <p key={r.name} className="b-head"><span>{r.name}</span>{r.date && <span className="muted">{shortDate(r.date, false)}</span>}</p>
          ))}
          <p className="b-head"><span>Champion</span></p>
          <div className="b-col b-qf">
            {[0, 1].map((p) => (
              <div key={p} className="b-pair">
                {qf.games.slice(p * 2, p * 2 + 2).map((g, i) => <BracketCell key={i} game={g} {...ctx} />)}
              </div>
            ))}
          </div>
          <div className="b-col b-sf">
            <div className="b-pair">{sf.games.map((g, i) => <BracketCell key={i} game={g} {...ctx} />)}</div>
          </div>
          <div className="b-col b-final"><BracketCell game={fin.games[0]} {...ctx} /></div>
          <div className="b-col b-champ">
            <div className={`b-trophy${view.champion ? " won" : ""}`}>
              {view.champion
                ? <Link to={teamPath(division.division, view.champion)} style={{ color: chalkFor(view.champion) }} title={view.champion}><TeamName team={view.champion} short={short.get(view.champion)} className="b-trophy-name" /></Link>
                : <span className="muted">{fin.date ? shortDate(fin.date, false) : ""}</span>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface BracketCtx { division: LeagueDivision; short: Map<string, string> }

function BracketCell({ game, division, short }: { game: BracketGame } & BracketCtx) {
  const bye = game.entries.some((e) => e.placeholder === "Bye");
  // Said in words along the strip, as on the match cards, rather than as "12+".
  const note = !game.score ? null : "forfeit" in game.score ? "Forfeit" : game.score.tiebreak ? "Won on the 1001" : null;
  return (
    <div className="b-cell">
      <div className={`b-match${bye ? " bye" : ""}`}>
        {game.entries.map((e, i) => <BracketLine key={i} entry={e} game={game} division={division} short={short} />)}
        {(game.venue || note) && (
          <p className="b-venue">
            {game.venue && <span className="b-bar">{game.venue.replace(/\*$/, "")}</span>}
            {note && <span className="b-note">{note}</span>}
          </p>
        )}
      </div>
    </div>
  );
}

function BracketLine({ entry, game, division, short }: { entry: BracketEntry; game: BracketGame } & BracketCtx) {
  const mine = useMine(division.division);
  const won = !!entry.team && game.winner === entry.team;
  const lost = !!entry.team && !!game.winner && game.winner !== entry.team;
  const cls = ["b-line", won && "won", lost && "lost", entry.projected && "projected", !entry.team && "open", !!mine && entry.team === mine && "mine"].filter(Boolean).join(" ");
  const seed = <span className="b-seed">{entry.seed ?? ""}</span>;
  if (!entry.team) return <p className={cls}>{seed}<span className="b-name">{entry.placeholder}</span></p>;
  return (
    <Link className={cls} to={teamPath(division.division, entry.team)} title={entry.projected ? `${entry.team}, if the standings hold` : entry.team}>
      {seed}
      <TeamName team={entry.team} short={short.get(entry.team)} className="b-name" style={entry.projected ? undefined : { color: chalkFor(entry.team) }} />
      {entry.team === mine && <MyStar />}
      {game.score && !("forfeit" in game.score) && (won || lost) && <span className="b-score">{won ? game.score.winner : game.score.loser}</span>}
      {won && <span className="sr-only">, went through</span>}
      {lost && <span className="sr-only">, knocked out</span>}
    </Link>
  );
}
