/**
 * One division, on black like the lander: a short header with the neighbouring divisions, then
 * tabs: the standings written up as a chalk ladder, every week's matches, the players, and the
 * division's records. A team picked with "This is my team" is starred wherever it appears.
 */
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { LeagueDivision, LeagueWeek, Match, PerfectThrow, Pick, Standing } from "../parser/types";
import { Fold, SectionHead } from "./Fold";
import { bracketView, divisionRounds, withBracketFile, currentWeek, headlineStories, isFinal, resultsLabel, type BracketEntry, type BracketGame, type DivisionRound } from "./league";
import { shortDate, todayIso, withClinchedFirst, type DivisionPlayer } from "./model";
import { divisionPath, Link, teamPath } from "./route";
import type { SeasonData } from "./store";
import { Tabs } from "./Tabs";
import { TeamText } from "./TeamText";
import { useMyTeams } from "./myTeam";
import { Arrow, ClinchBadge, chalkFor, GROUPS, NewsletterLink, ordinal, PageHead, PLAYER_COLUMNS, useBlackStatusBar, useSort } from "./ui";

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
              <Ladder standings={final ? withChampion(division.standings) : withClinchedFirst(division.standings, seasonWeeks)} division={d} final={final} />
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
        Unofficial. From the RDL "Tons of Newsletter", week {issue.week}. Stats through week {issue.week - 1}.
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

function Ladder({ standings, division, final }: { standings: Standing[]; division: string; final: boolean }) {
  const mine = useMine(division);
  // "Clinched" needs a key; after the season the leader's pill says "Season champs", which doesn't.
  const clinched = !final && standings.some((s) => s.clinched === "G");
  return (
    <>
    {/* --n lets the rows share out the screen's height (styles.css), so the table fits without scrolling. */}
    <ol className="ladder" data-key={clinched ? "" : undefined} style={{ "--n": standings.length } as CSSProperties}>
      {standings.map((s, i) => (
        <li key={s.team} className={[i === 0 && "ladder-top", s.team === mine && "ladder-mine"].filter(Boolean).join(" ") || undefined}>
          <Link to={teamPath(division, s.team)}>
            <span className="ladder-rank">{s.rank}</span>
            <span className="ladder-team">
              <span className="ladder-line" style={{ color: chalkFor(s.team) }}><FitName name={s.team} className="ladder-name" />{s.team === mine && <MyStar />}{i > 0 && <ClinchBadge mark={s.clinched} final={final} />}</span>
              {/* The leader's clinch mark gets a line of its own, leaving the name the whole width. */}
              {i === 0 && s.clinched === "G" && <span className="ladder-clear"><ClinchBadge mark={s.clinched} final={final} /></span>}
            </span>
            {/* The record ranks the table, so it's the big number; points sit small under it. */}
            <span className="ladder-score">
              <span className="ladder-rec" aria-label={`${s.wins} wins, ${s.losses} losses`}>{s.wins}–{s.losses}</span>
              <span className="ladder-pts" aria-label={`${s.points} points`}>{s.points}<span className="ladder-pts-unit"> pts</span></span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
    {/* What the clinch mark means, only when one shows: a tooltip never appears on a phone. */}
    {clinched && <p className="ladder-key"><b>✓ Clinched</b> means sure to finish 1st.</p>}
    </>
  );
}

/** "Fast Singles 301" reads as "Fast singles 301". */
const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const joinNames = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/**
 * The division's best throws, as three boards: last week's hot darts first and chalked round like
 * news, then the season's trophy darts (the standing records), then the perfect throws as tallies.
 */
function Records({ division, throws, week }: { division: LeagueDivision; throws: PerfectThrow[]; week: number }) {
  const kinds = [...new Set(throws.map((t) => t.kind))];
  // The same feat by several players reads as one line: "4 ASPs" and everyone who threw it.
  const feats = [...new Set(division.hotDarts.map((h) => h.feat))].map((feat) => ({ feat, who: division.hotDarts.filter((h) => h.feat === feat) }));
  return (
    <>
      {feats.length > 0 && (
        <section className="rec-section" aria-labelledby="rec-hot-h">
          <div className="rec-hot-board">
            <h2 id="rec-hot-h" className="rec-hot-title"><ChalkStar />Hot darts<span className="rec-hot-week">week {week}</span></h2>
            <ul className="rec-hot">
              {feats.map(({ feat, who }) => (
                <li key={feat}>
                  <span className="rec-feat">{feat}</span>
                  <span className="rec-names">
                    {who.map((h, j) => (
                      <span key={j} className="rec-person">
                        <span className="rec-name">{joinNames(h.players)}</span>{" "}
                        <span className="rec-team" style={{ color: chalkFor(h.team) }}>{h.team}</span>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      {division.records.length > 0 && (
        <section className="rec-section" aria-labelledby="rec-trophy-h">
          <h2 id="rec-trophy-h" className="rec-head">Trophy darts<span className="rec-head-note">best this season</span></h2>
          <ul className="rec-board">
            {division.records.map((r) => (
              <li key={r.category}>
                <span className="rec-val">{r.holders.length ? r.value : "–"}</span>
                <span className="rec-body">
                  <span className="rec-cat">{sentence(r.category)}</span>
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
      {kinds.length > 0 && (
        <section className="rec-section" aria-labelledby="rec-perfect-h">
          <h2 id="rec-perfect-h" className="rec-head">Perfect throws<span className="rec-head-note">this season</span></h2>
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

/** A star scribbled in chalk, the kind a teacher puts by good work. */
const ChalkStar = () => (
  <svg className="chalk-star" viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
    <path d="M20 3 L24.5 15.5 L37.5 15.8 L27 23.6 L31 36.5 L20 28.6 L9.2 36.2 L13.2 23.5 L2.6 15.6 L15.6 15.2 Z" />
  </svg>
);

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

/** A small yellow star after the picked team's name, read out as "your team". */
function MyStar() {
  return (
    <span className="my-star" title="Your team">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8z" fill="currentColor" />
      </svg>
      <span className="sr-only">, your team</span>
    </span>
  );
}

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
        <button type="button" aria-label="Previous week" disabled={at === 0} onClick={() => go(rounds[at - 1].week)}>‹</button>
        <label>
          <span className="sr-only">Week</span>
          <select value={round.week} onChange={(e) => go(Number(e.target.value))}>
            {rounds.map((r) => <option key={r.week} value={r.week}>{label(r)}</option>)}
          </select>
        </label>
        <button type="button" aria-label="Next week" disabled={at === rounds.length - 1} onClick={() => go(rounds[at + 1].week)}>›</button>
      </div>
      <p className="tab-note matches-note">{shortDate(round.date)}: {round.played ? "final scores" : round.week === start ? "next match night" : "still to play"}</p>
      {round.played && round.headline && <Headlines text={round.headline} week={round.week} division={division} />}
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
      <p className="muted small">Home team second.{round.played ? " Out of 24 games." : ""} Places and records are from the current standings.</p>
    </section>
  );
}

interface CardRow { team: string; score?: number | null; won?: boolean; lost?: boolean }

/**
 * A team name that always fits on one line: when it is too wide for its space, its text is
 * scaled down just enough (re-measured whenever the space changes size).
 */
/**
 * Hand-picked names for the bracket, tried in order after the full name and before page 2's short
 * one, where the newsletter's shortening reads badly ("the Point?", "Calm", "The Blind") or there
 * is none and the full name won't fit (owner, 2026-11-18). Mostly in Kilt's own words.
 */
export const BRACKET_NAMES: Record<string, string[]> = {
  "What's the Point?": ["What's the Point", "The Point"],
  "Banging the Wire": ["Banging Wire"],
  "Sharky's Machine": ["Sharky's"],
  "Calm Under Pressure": ["Under Pressure"],
  "Are You Afraid of the Dart": ["Are You Afraid"],
  "The Blonde Leading the Blind": ["Blonde Leading", "Blonde"],
  "Heart of Dartness": ["Dartness"],
  "Aim-ing For Trouble": ["Trouble"],
};

/**
 * A team's full name if it fits its box on one line, else the first of the hand-picked names and
 * page 2's short name that does ("Wing & A Plaque" or "Wing"); the last one if none fits.
 * Measured after layout and again when the box changes size or the lettering loads.
 */
function BracketName({ team, short, className, style }: { team: string; short?: string; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  const names = useMemo(() => [...new Set([team, ...(BRACKET_NAMES[team] ?? []), ...(short ? [short] : [])])], [team, short]);
  const [shown, setShown] = useState(team);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || names.length < 2) return;
    // Measure the full name in the box's own lettering, without touching what React rendered.
    const ctx = document.createElement("canvas").getContext("2d");
    const fit = () => {
      if (!ctx || !el.clientWidth) return;
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      setShown(names.find((n) => ctx.measureText(n).width <= el.clientWidth + 0.5) ?? names.at(-1)!);
    };
    fit();
    let live = true;
    document.fonts?.ready.then(() => { if (live) fit(); });
    const watch = new ResizeObserver(fit);
    watch.observe(el.parentElement ?? el);
    return () => { live = false; watch.disconnect(); };
  }, [names]);
  return <span ref={ref} className={className} style={style}>{names.includes(shown) ? shown : team}</span>;
}

function FitName({ name, className = "side-name" }: { name: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      // Text doesn't shrink exactly in proportion, so step down until it fits (or hits the floor).
      for (let i = 0; i < 6 && el.scrollWidth > el.clientWidth; i++) {
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size <= 11) break;
        el.style.fontSize = `${Math.max(11, Math.floor((size * el.clientWidth) / el.scrollWidth * 10) / 10 - 0.2)}px`;
      }
    };
    fit();
    // The chalk lettering arrives after first paint and is wider, so measure again once it's in.
    let live = true;
    document.fonts?.ready.then(() => { if (live) fit(); });
    const watch = new ResizeObserver(fit);
    watch.observe(el.parentElement ?? el);
    return () => { live = false; watch.disconnect(); };
  }, [name]);
  return <span ref={ref} className={className}>{name}</span>;
}

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
 * score line. No winner is read into the prose.
 */
function PickNote({ pick, division }: { pick: Pick; division: string }) {
  if (!pick.featured) {
    return <p className="card-pick"><span className="card-pick-label">Kilt's pick</span> {pick.text}</p>;
  }
  const others = pick.together - 1;
  const summary = pick.call ?? `Written up with ${others} other ${division} ${others === 1 ? "match" : "matches"}`;
  return (
    <details className="card-pick">
      <summary><span className="card-pick-label">Kilt's pick</span> {summary}</summary>
      <p>{pick.text}</p>
    </details>
  );
}

/** Leaderboard categories for the "Rank by" dropdown: plain words for the table's sort keys. */
const RANK_BY: [string, string][] = [
  ["totalPct", "Overall win %"],
  ["singlesPct", "Singles win %"],
  ["doublesPct", "Doubles win %"],
  ["s301", "Singles 301"],
  ["sCricket", "Singles cricket"],
  ["d501", "Doubles 501"],
  ["dCricket", "Doubles cricket"],
  ["aspAvg", "All-star points per game"],
  ["asp", "All-star points, total"],
  ["games", "Games played"],
];
const TOP = 25;

/** Who to list, by games played: everyone who's played, or regulars only, so a 2–0 sub can't top a win % table. */
const GAME_FILTERS: [number, string][] = [[0, "All players"], [5, "More than 5 games"], [20, "More than 20 games"]];

/** Every player in the division: a top 25 for any category, like the newsletter's leaderboards. */
export function Leaderboard({ week, division, players }: { week: number; division: string; players: DivisionPlayer[] }) {
  const all = players;
  // Starts at "more than 20 games" once enough players have that many; early in the season, more than 5.
  const [minGames, setMinGames] = useState<number>(() => (all.filter((p) => p.gamesPlayed > 20).length >= 10 ? 20 : 5));
  const shown = all.filter((p) => p.gamesPlayed > minGames);
  const { rows, sortKey, toggle, sortBy, arrow, ariaSort } = useSort<DivisionPlayer>(shown, PLAYER_COLUMNS, "totalPct");
  const [everyone, setEveryone] = useState(false);
  const start = (i: number) => PLAYER_COLUMNS[i - 1]?.group !== PLAYER_COLUMNS[i].group;
  if (!all.length) return null;
  const listed = everyone ? rows : rows.slice(0, TOP);
  const teams = new Set(all.map((p) => p.code)).size;

  return (
    <section aria-labelledby="division">
      <SectionHead id="division" title="Leaderboard" detail={`Through week ${week - 1}`} />
      <Fold show="Show leaderboard" hide="Hide leaderboard"
        summary={<>Top {TOP} of {all.length} players on {teams} teams, in any category: singles, doubles, all-star points per game and more.</>}>
        <label className="rank-by">
          <span>Rank by</span>
          <select value={RANK_BY.some(([k]) => k === sortKey) ? sortKey : ""} onChange={(e) => sortBy(e.target.value)}>
            {!RANK_BY.some(([k]) => k === sortKey) && <option value="">(table heading)</option>}
            {RANK_BY.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
        <fieldset className="games-filter">
          <legend>Show</legend>
          <div className="seg">
            {GAME_FILTERS.map(([n, label]) => (
              <button key={n} type="button" aria-pressed={minGames === n} onClick={() => setMinGames(n)}>{label}</button>
            ))}
          </div>
        </fieldset>
        <div className="scroll-x" tabIndex={0} role="region" aria-label="Division player stats, scrolls sideways">
          <table className="players wide">
            <thead>
              <tr className="groups">
                <th className="sticky" rowSpan={2} aria-sort={ariaSort("name")}>
                  <button onClick={() => toggle("name")}>Player{arrow("name")}</button>
                </th>
                {GROUPS.map((g) => <th key={g.group} colSpan={g.span} className="group">{g.group}</th>)}
              </tr>
              <tr>
                {PLAYER_COLUMNS.map((c, i) => (
                  <th key={c.key} className={`num${start(i) ? " gstart" : ""}`} aria-sort={ariaSort(c.key)}>
                    <button onClick={() => toggle(c.key)}>{c.label}{arrow(c.key)}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listed.map((p, i) => (
                <tr key={`${p.code}-${p.number}`}>
                  <th scope="row" className="sticky">
                    <span className="muted small">{i + 1}.</span> {p.name}
                    <Link className="team small muted" to={teamPath(division, p.team)}>{p.team}</Link>
                  </th>
                  {PLAYER_COLUMNS.map((c, i) => (
                    <td key={c.key} className={`num${start(i) ? " gstart" : ""}${c.key === sortKey ? " sorted" : ""}`}>{c.show(p)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > TOP && (
          <button className="showall" aria-expanded={everyone} onClick={() => setEveryone(!everyone)}>
            {everyone ? `Show top ${TOP} only` : `Show all ${rows.length} players`}
          </button>
        )}
        <p className="muted small">Swipe sideways for every category, or tap a heading to sort by it.</p>
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
      <SectionHead id="bracket" title="Tournament" detail="Matches start at 7:00 pm." />
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
                ? <Link to={teamPath(division.division, view.champion)} style={{ color: chalkFor(view.champion) }} title={view.champion}><BracketName team={view.champion} short={short.get(view.champion)} className="b-trophy-name" /></Link>
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
  return (
    <div className="b-cell">
      <div className={`b-match${bye ? " bye" : ""}`}>
        {game.entries.map((e, i) => <BracketLine key={i} entry={e} game={game} division={division} short={short} />)}
        {game.venue && <p className="b-venue">{game.venue.replace(/\*$/, "")}</p>}
      </div>
    </div>
  );
}

function BracketLine({ entry, game, division, short }: { entry: BracketEntry; game: BracketGame } & BracketCtx) {
  const mine = useMine(division.division);
  const won = !!entry.team && game.winner === entry.team;
  const lost = !!entry.team && !!game.winner && game.winner !== entry.team;
  const cls = ["b-line", won && "won", lost && "lost", entry.projected && "projected", !entry.team && "open", entry.team === mine && "mine"].filter(Boolean).join(" ");
  const seed = <span className="b-seed">{entry.seed ?? ""}</span>;
  if (!entry.team) return <p className={cls}>{seed}<span className="b-name">{entry.placeholder}</span></p>;
  return (
    <Link className={cls} to={teamPath(division.division, entry.team)} title={entry.projected ? `${entry.team}, if the standings hold` : entry.team}>
      {seed}
      <BracketName team={entry.team} short={short.get(entry.team)} className="b-name" style={entry.projected ? undefined : { color: chalkFor(entry.team) }} />
      {entry.team === mine && <MyStar />}
      {won && <span className="card-mark" aria-label="went through">◂</span>}
    </Link>
  );
}
