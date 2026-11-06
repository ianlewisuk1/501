# Area 501 Dart Page

A small, phone-first site that turns the Raleigh Dart League's weekly "Tons of Newsletter" (an Excel workbook) into one simple page for **one team: Area 501, C Division**.

Owner: Ian Lewis (plays on Area 501). Goal: ship v1 today.

---

## 1. Stack and hosting (all free)

| Piece | Choice | Cost |
|---|---|---|
| Language | TypeScript everywhere (Node 20+) | free |
| xlsx parsing | SheetJS. Install from the SheetJS CDN tarball per their docs, because the `xlsx` copy on npm is stale. Plain `.v` cell values are all we need. | free |
| Front end | Vite + React + TS, built as a static site, mobile first | free |
| Data store | JSON files committed to the repo. No database. | free |
| Scheduler | GitHub Actions cron | free on public repos (private: 2,000 min/month) |
| Hosting | Vercel (Hobby), built from this repo on every push to `main` (`vercel.json`). Domain `raleighdarts.com` (from 2026-11-05; `www.` redirects to it or the other way, set in Vercel), registered at Namecheap, DNS pointed at Vercel (A `@` 216.198.79.1, CNAME `www` to Vercel's project address). The old `area501.lol` stays registered and should redirect to it. | free (domain ~$10/yr) |
| Tests | Vitest | free |
| Domain | Optional | about $10 to $15 a year |

Why this shape: the data changes once a week, so there is nothing to serve dynamically. A cron job does the work, commits JSON, and the static site rebuilds. Every week's JSON stays in git, so trends across weeks come for free later.

Heads-up: GitHub disables scheduled workflows on public repos after 60 days with no repo activity. The weekly data commits keep it alive during the season. Re-enable it after the winter break if needed.

---

## 2. How data flows

```
raleighdartleague.org (WordPress)
   │  scripts/fetch.ts   find the newest newsletter .xlsx, download it to inbox/
   ▼
inbox/Fa26wk07.xlsx
   │  scripts/parse.ts   pure parser: (workbook, teamConfig) -> TeamWeek JSON
   ▼
data/Fa26/week-07.json  +  division-week-07.json (every C team's players, for Scouting)  +  teams-week-07.json (every C team's TeamWeek, for the team picker)  +  league-week-07.json (every division, see section 10)  +  data/latest.json  +  data/manifest.json (processed files)
   │  git commit, then Pages deploy
   ▼
Static React page reads data/latest.json
```

`scripts/update.ts` runs fetch, then parse, then write. It must be idempotent: if the newest file is already in `manifest.json`, it exits without committing.

Keep fetch and parse decoupled. The parser only ever takes a local file path, so a manual upload fallback always works (see section 3).

### Suggested layout

```
CLAUDE.md
scripts/fetch.ts  scripts/parse.ts  scripts/update.ts
src/parser/        one module per newsletter page: page1.ts, page2.ts, page3.ts, page5.ts, leaderboards.ts, page10.ts, names.ts, index.ts
src/app/           React UI
data/              generated JSON (committed), plus hand-entered data/{season}/schedule.json
inbox/             downloaded or manually dropped .xlsx files
fixtures/          Fa26wk06.xlsx, Fa26wk07.xlsx
fixtures/expected/ Fa26wk06.area501.json, Fa26wk07.area501.json   (golden outputs)
reference/ref_parse.py   working Python reference parser. Port its logic; don't ship it.
.github/workflows/update.yml   (cron + manual dispatch + on push to inbox/)
vercel.json                    (Vercel build settings; Vercel deploys on push)
```

### Team config

```ts
export const TEAM = {
  name: "Area 501",
  division: "C",
  aliases: ["Area 501", "Area"], // for matching structured cells, case-insensitive
};
```

Hard-code this for v1. Supporting other teams later only means changing the config.

---

## 3. Getting the file (do this spike first, it takes 15 minutes)

The site is WordPress. Newsletter posts look like:
`https://raleighdartleague.org/2026/09/19/fall-2026-week-07-rdl-tons-newsletter/`
The archive page is `https://raleighdartleague.org/newsletter/`. Each week is a **new** .xlsx file named like `Fa26wk07.xlsx`.

**Spike result (2026-09-23):** every discovery route below (REST posts, REST media, `/newsletter/feed/`, `/feed/`, `/newsletter/`) returned 403 with a Cloudflare "Just a moment..." JS challenge, even from the owner's laptop with a browser user agent. Decision for v1: fallback B (manual drop into `inbox/`). Don't try to get around the challenge; pursue fallback C for a stable link.

**Bot protection is live.** An automated fetch of `/newsletter/` and the post page got blocked with a "bot detection" error, even though the homepage loaded. Test before building automation:

1. From your laptop: `curl -sIL -A "Mozilla/5.0 ..." <url>`, trying each of the discovery routes below.
2. From a GitHub Actions runner, using a throwaway workflow with `workflow_dispatch`. Runners use datacenter IPs, which bot protection often blocks even when your laptop works fine.

Discovery routes to try, in order:
- WP REST posts: `/wp-json/wp/v2/posts?search=tons%20newsletter&per_page=1&_fields=date,link,slug,content`, then regex `href="([^"]+\.xlsx)"` out of `content.rendered`.
- WP REST media: `/wp-json/wp/v2/media?search=Fa26wk&per_page=5&_fields=date,source_url,mime_type`
- RSS: `/newsletter/feed/` or `/feed/`. Take the newest item, fetch its page, and find the `.xlsx` link.
- Guessing the file path (`/wp-content/uploads/YYYY/MM/Fa26wkNN.xlsx`) is **unverified**. Confirm the real path from a post before relying on it.

Be polite: check at most once a day, and send a normal user agent.

**Fallbacks if Actions gets blocked:**
- A. Run `npm run update` on your laptop and push the result.
- B. Download the file by hand, drop it into `inbox/`, and push. `update.yml` also triggers on pushes to `inbox/**` and parses it.
- C. Ask the league webmaster (listed on page 4 of the newsletter) for a stable link, or for the bot rule to allow the fetcher.

**Timing:** the week 7 issue is dated for match night, Wed Sep 23, but was posted Sat Sep 19. A daily cron around 13:00 UTC is plenty.

---

## 4. What's in a workbook

- One sheet per printed page, named `{season}-Wk{week}-Pg{n}`, for example `Fa26-Wk7-Pg2`. Pages 1 to 9, then `Pg10A` to `Pg10H` (one per division). Take season and week from the first sheet name.
- There are **no formulas**. Every cell is a static value, and numbers are real numbers. Win percentages are decimals (0.9167). An empty percentage can be the string `"---"`.
- The newsletter uses `"-"` to mean "nothing". Map it to `null`.
- **Issue N timing:** results and stats run **through week N-1**. Matches are listed for **weeks N and N+1**. Label stats "through week 6" on the week 7 page.

### Pages we use (verified identical in structure across weeks 6 and 7)

**Page 1: issue info and headline**
- `B2`: `The Fall Session of the Raleigh Dart League, week #7, Wednesday, September 23, 2026    Issue #JK951` gives the match date and issue number.
- `H22` = `RDL HEADLINES`. Our line starts in column H with `"C" Division:`. Continuation lines start with spaces. Stop at the next line that doesn't. Rejoin words hyphenated across a line break ("leap-" + "frogs").

**Page 2: standings and last week's results**
- `A1`: `DIVISIONAL TEAM STANDINGS and MATCH RESULTS FROM WEEK 6 (9/16/26)` gives the results week and date.
- The C block starts on the row where column A = `"C" Division` (row 23 in both fixtures). It runs while column C (rank) is non-empty. C has 8 teams.
- Standings: C = rank, D = full team name, F = wins, G = losses, H = points.
- Results sit on the **same rows but in their own order**, not aligned with standings: K = short team name, L = score, M = 301 games won, N = singles cricket, O = doubles cricket, P = 501, Q = 1001 tiebreaker (`W`/`L`/`-`), R = all-star points (ASPs), S = short-handed, T = penalties.
- Consecutive non-BYE rows pair into one match. The **home team is listed second**. A BYE row has M = `(BYE)`. Each match is out of 24 (4 categories x 6 games).

**Page 3: Hot Darts, trophy darts, perfect throws** (the positions on this page move the most)
- Hot Darts (top of the sheet) uses three column groups: A to D, G to J, and M to P. Each group has name `Last, First`, team, value, unit. For example `6.5 | ASPs`, or a blank value with unit `15-dart 301`. A division's section can spill from one group into the next, so scan all three groups for our team.
- Doubles entries span two rows, for example `Massengill, Chad  &` then `  Phillips, Stevie`, with the team on the second row.
- Trophy darts: find `DIVISIONAL TROPHY DART CATEGORIES` in column A. The next row has headers like `C division`, which was column G in both weeks, but find it by text anyway. Categories start where column A is `High In`, `High Out` or `Fast`. The label spans several column A rows (`Fast`/`Singles`/`301`). In the C column you get: `value (m/d/yy)`, then player line(s) (`Ian Lewis &`, `Steve Massey`), then the team. `(none reported)` means the category is empty.
- Perfect Throws: below that, cells like `Name (Team, m/d)`.

**Page 5: matches and the editor's prediction**
- `A1` `THIS WEEK'S MATCHES  (Week 7)` and `H1` `NEXT WEEK'S MATCHES  (Week 8)`.
- Rows 2 to 33. Left side: A = away, B = `@`, C = home, E = `(venue)`. Right side: H, I, J, L. Bye rows: B or I = `BYE - Team Name`. Ignore the column F division labels and just scan every row for our team.
- Predictions start at `A35` `PREDICTIONS FOR THE WEEK`. Text runs down column A (rows 36 to 64), then down column H (35 to 64). Join and collapse whitespace.
  - Featured: `Match #4:  (C Div.)  Menace 2 Sobriety @ Area 501. ... Area it is, 14-10.` Capture up to the next `Match #` or `And the remaining`.
  - Otherwise our pick appears after `And the remaining 15 matches, sorted by division:` as `C Division:  X 15, Y 9;  ...`. Split on `;`. Week 6 exercises this path: `Area 501 16, Pints and Points 8`.

**Pages 6, 7, 8: division leaderboards**
- Two divisions sit side by side. Left: rank A, name C, team D (`C6/ Area 501`), values E, F, G. Right: rank J, name L, team M, values N, O, P. Find `"C" Division` in column C or L. It was on the left at row 36 in both fixtures.
- A blank rank means tied with the row above. Rows like `(four tied)` have no team, so skip them.
- Pg6 = singles W, L, %. Pg7 = singles + doubles W, L, %. Pg8 = ASP, total games played, average.

**Page 10C: every player's stats for C Division**
- Row 1 has headers. Team rows have column B = `C6/ Area 501` (team totals on that row). Player rows follow with B = `C`, C = player number, D = `Last, First`. The block ends at the next `C#/ ` row. Blocks shift by a row or two between weeks as rosters change.
- Column map (verified against the totals):

| Col | Meaning | Col | Meaning |
|---|---|---|---|
| E / F | singles 301 W / L | P / Q | doubles W / L |
| G / H | singles cricket W / L | R | doubles win % |
| I / J | singles W / L | S / T | singles + doubles W / L |
| K | singles win % | U | singles + doubles win % |
| L / M | doubles cricket W / L | V / W | tiebreaker W / L |
| N / O | doubles 501 W / L | X | all-star points |
| | | Y | games played |
| | | Z | all-star point average |
| | | AA | matches played |

### Team-name gotchas (the main source of bugs)

- Page 2 standings (D): full names such as `Menace 2 Sobriety` and `Pints and Points`.
- Page 2 results (K): short names such as `Menace`, `Pints`, `Hump'N`, `Ducks`, `Secrets`, `Mafia`, `Projectile`, and ours, `Area 501`.
- Page 5 sometimes abbreviates, mostly in other divisions: `Appetite for Destruc.`, `DoubleIn StumbleOut` (the standings say `Double In Stumble Out`), `Blonde Leading / Blind`.
- Pages 6 to 10 put a code in front of the name: `C6/ Area 501`, meaning division C, team number 6.
- Prose just says "Area".
- Capitalization drifts between weeks: `Wing & a Plaque` in week 6 became `Wing & A Plaque` in week 7.

Rules: normalize (trim, collapse spaces, lowercase) before comparing. To match our team, check against `TEAM.aliases`. To turn a short opponent name into a full one, find the single division standings name that contains the short name as a whole word. If there isn't exactly one match, keep the raw text.

**Locate everything by its text, never by a hard-coded row.** The only things that are safe to hard-code are the column letters within each section described above.

---

## 5. Output shape (`TeamWeek`)

The golden files in `fixtures/expected/` are the source of truth. Match them exactly: same keys, and `null` where the source shows `-`.

```ts
type WL = { w: number; l: number };

interface TeamWeek {
  season: string;            // "Fa26"
  week: number;              // 7 (issue week = match night)
  issueDate: string;         // "2026-09-23"
  issue: string;             // "JK951"
  team: { name: string; division: string; code: string }; // code "C6"
  standings: { rank: number; team: string; wins: number; losses: number; points: number }[];
  lastResult: null | { week: number; date: string; bye: true } | {
    week: number; date: string; opponentShort: string; home: boolean;
    score: { us: number; them: number };
    gamesWon: { singles301: number; singlesCricket: number; doublesCricket: number; doubles501: number };
    tiebreaker1001: "W" | "L" | null; allStarPoints: number;
    shortHanded: string | null; penalties: string | null;
  };
  thisWeek: null | { week: number; bye: true } | { week: number; home: boolean; opponent: string; venue: string };
  nextWeek: TeamWeek["thisWeek"];
  prediction: null | { featured: boolean; text: string };
  headline: string | null;
  players: {
    number: number; name: string;          // "Ian Lewis" (converted from "Lewis, Ian")
    singles: WL; doubles: WL; total: WL;
    singles301: WL; singlesCricket: WL; doublesCricket: WL; doubles501: WL; tiebreaker: WL;
    allStarPoints: number; gamesPlayed: number; aspAverage: number | null; matchesPlayed: number;
  }[];                                      // in newsletter order
  leaderboards: {
    singles: { rank: number; player: string; w: number; l: number; pct: number }[];            // our players only
    singlesPlusDoubles: { rank: number; player: string; w: number; l: number; pct: number }[];
    allStarAverage: { rank: number; player: string; asp: number; gamesPlayed: number; average: number }[];
  };
  hotDarts: { players: string[]; feat: string }[];   // e.g. { players: ["Steve Massey"], feat: "15-dart 301" }
  trophyDarts: { category: string; value: string; date: string | null; players: string[] }[];
  perfectThrows: string[];
}
```

Decimals in the golden files are rounded to 4 places (`aspAverage`, `pct`, `average`).

---

### Season schedule (hand-entered, not parsed)

The newsletter only ever lists weeks N and N+1 (Page 5), so the full season schedule comes from the owner once per season, as `data/{season}/schedule.json`. It is not part of `TeamWeek` and the golden files don't change.

```ts
interface SeasonSchedule {
  season: string;            // "Fa26"
  division: string;          // "C"
  weeks: ({ week: number; date: string; bye: true }
         | { week: number; date: string; home: boolean; opponent: string; venue: string;
             score?: { us: number; them: number } })[];   // hand-entered, for weeks with no parsed issue
  venues?: Record<string, { maps: string }>;    // no longer used: map links come from data/{season}/venues.json
  keyDates: { date: string; label: string }[];  // tournaments, banquet (from Page 4's calendar)
}
```

The venue is always the home team's bar. **Venue addresses (2026-11-05):** map links come from the league's own directory of host bars, "WHERE WE PLAY" on page 3 of a season's first issue. `src/parser/venues.ts` reads it into `data/{season}/venues.json` (written by `scripts/write.ts`; no phone numbers kept), and `src/parser/venueMatch.ts` matches every name page 5 prints (`Brass Tap 1&2`, `Amer. Legion F-V`) to exactly one bar: board numbers are dropped, a few shortenings are aliased, otherwise one name must start with the other. `npm run validate` fails on any venue that matches none or several. Links search the street address and town only (`3316 Capital Boulevard, Raleigh, NC`), never the bar's name, because names collide: the league's Brass Tap & Billiards (Capital Blvd) is not The Brass Tap beer bar downtown, and there are three Cleveland Draft Houses. Team pages show the address and the league's landmark under the venue. All 26 addresses were checked against OpenStreetMap on 2026-11-05 (22 exact; Cleveland Draft House found under its name; Mac's Tavern and Rally Point streets confirmed, no house numbers in OSM); the owner's tap-through checklist is the artifact "RDL Venue Check". Don't commit the captains' names or phone numbers from the printed schedule, because the repo and site are public.

Known facts for Fa26: C has 8 teams and no byes, and the regular season is 14 weeks (a double round robin), played on Wednesdays (week 1 = 2026-08-12, week 14 = 2026-11-11). Page 4 lists division tournaments on Nov 18 and Dec 2/9, and the banquet on Sat Dec 12.

**The current week follows the calendar (2026-11-06):** issue N's page 5 already lists week N+1, so the team page's match card, Opponent tab and the Fixtures "Next" row move on to next week's match the morning after match night (the visitor's own date), without waiting for the next newsletter (`buildFixtures(..., today)` in `model.ts`: the first fixture dated today or later, never before the issue's week). The night just played shows "Score next issue" until the newsletter brings it. After the season's last night, the card and the lander's "Your team" line point at the next division tournament night from `keyDates` (`nextTournament`). How to merge: for weeks N and N+1, Page 5 wins over `schedule.json` if they disagree (reschedules). A result for a past week comes from the `lastResult` of the issue for week+1 in `data/`. Weeks with no parsed issue use the hand-entered `score`, if there is one (weeks 1 to 4 of Fa26 came from the owner and add up to the standings' 94 points). A parsed result always wins. To get full detail, drop older newsletters into `inbox/`.

---

## 6. What the page shows

**One scrolling page.** No tabs, routes or links to other pages. The most important information goes at the top. Every section is compact, and any empty section is hidden.

1. **Header:** the team's name, then one line: "C Division · Week 7", then a "Show team" dropdown of every team in the division (A to Z; ours marked "(us)"). Picking a team re-renders the whole page from that team's point of view and sets `?team=<slug>` so the link can be shared; Area 501 is the default and has no param. Other teams' 14-week schedules are worked out from the newsletters (`teamSchedule` in `model.ts`): page 5 fixtures and page 2 results, with uncovered weeks mirrored from half a season away (double round robin) and venues taken from each home team's bar. "Ian's pick" shows only for Area 501. Each team gets its own palette (`src/app/themes.css`, set by `data-team` on `<html>`): header, highlight, background tints and accent change, while win/loss and chart colors stay the same everywhere. The phone status bar color follows the header. Each team also gets a hand-drawn SVG mascot in its palette in place of the Area 501 alien (`src/app/TeamArt.tsx`). The date lives in the Tonight card.
1a. **Breaking news banner** (above the header, only when Page 2's column B marks the shown team `G`, sure to finish first; parsed as `standings[].clinched`): a broadcast-style red "Breaking" strip with the headline and record, points clear and weeks still to play. `C` (top two) and `D` (bottom two) get no banner (owner, 2026-11-05: clinched means first only). The strip is slim, full width and scrolls like a TV ticker (static under reduced motion). A hand-entered item in `data/news.json` (`{ season, week, team, headline, detail? }`) replaces the clinch news for that team in that issue week only, so it drops off when the next issue lands.
2. **Tonight:** opponent (full name), home or away, venue, the opponent's rank and record (join with standings), and the editor's prediction on one line. Below the venue, show two chalk-underlined text links (2026-11-05: app-styled buttons read as template UI): **Map (Apple)** (`https://maps.apple.com/?q=<maps>`) and **Map (Google)** (`https://www.google.com/maps/search/?api=1&query=<maps>`), with the query URL-encoded. No logos or pin icons. Use the `maps` value from `venues`, or the venue name plus ", Raleigh, NC" if the venue isn't listed. In the Fixtures list, each upcoming venue gets one link: Apple Maps on iOS, Google Maps everywhere else.
2a. **Scouting** (headed "This Week's Opponent (Week N)", with the opponent's name after it): tonight's opponent's players from the same issue's Page 10, best season record first: record, win %, last 3 weeks' W–L (the difference from the issue 3 weeks earlier; the column hides if that issue is missing), singles %, doubles % and matches. Season columns sit under a "Season" header and the 3-week W–L under its own header at the right end, so it's clear only that column is recent. Every column sorts. Players with no matches are left out. Plain table, no charts. Hidden on a bye.
4. **Standings:** the C table with our row highlighted and the gap to 2nd place ("8 pts clear"). A team sure to finish first (`G`) gets a "Clinched" pill after its name, with a key under the table ("Clinched means sure to finish 1st"; worked out from wins in `withClinchedFirst` when the newsletter hasn't marked it: no one else can reach the leader's wins); top-two (`C`) and bottom-two (`D`) get none.
5. **Fixtures:** all 14 weeks in one compact list. Past weeks show W/L and the score where we have them, tonight is highlighted, and future weeks show the opponent, H/A and venue. This replaces a separate "next week" section. It starts collapsed to last week, this week and next week, with a big "Show all 14 weeks" button to expand it.
6. **Players:** folded by default behind a big "Show player stats" button, with a one-line summary (players, team W–L, win %). A wide table that scrolls sideways, with the player name pinned on the left. Columns are grouped Overall (W-L, win %), Singles (W-L, win %, 301, cricket), Doubles (W-L, win %, 501, cricket), All-star (points, average) and Played (games, matches). Every column sorts, and a team total row sits at the bottom. Label it "through week N-1".
6a. **Division leaderboard:** folded behind "Show leaderboard". Every player in the division from the same issue's Page 10, with the same columns as Players and the team name under each player. A plain "Rank by" dropdown picks the category (overall, singles and doubles win %, each game type, all-star points per game or total, games played), and tapping a column heading works too. Shows the top 25, with "Show all N players" below. A checkbox, on by default, hides players with fewer than half the weeks' matches, so a 2–0 sub doesn't top the win % list. The selected team's players are highlighted.
7. **Performance chart:** folded by default behind a big "Show charts" button. A single card with two views, Compare first and selected by default. Keep it simple: the audience is older and not tech-savvy, so use big tap targets and plain words.
   - **Compare:** two stacked charts that share one set of player name buttons (newsletter order, each player keeps one color, Russell Riley alone picked to start). The first chart, "Win % each night", shows each week's own win %. The second, "Season win % so far", shows the season-to-date win %. Both have a faint dashed whole-team line. A player's week is the difference between consecutive issues' season totals, so weeks with no issue are gaps, not zeros; team weeks come from match scores. The name buttons show no numbers, so they can't be confused with either chart.
   - **Breakdown** (works from a single issue): a dropdown picks a player or "Whole team" (the sum of all players), then shows won and lost bars for singles 301, singles cricket, doubles cricket and doubles 501. A separate "Week by week" view and a rolling 3-week average were both tried and dropped.

   The chart is hand-rolled SVG with no chart library. It must be readable at phone width and have labeled axes. The build step needs a `data/{season}/index.json`, or a glob import, so the UI can load every week.
8. **Key dates:** tournaments and the banquet from `schedule.json`. Hide dates that have passed.

Keep it fast and plain: system fonts, no heavy UI kit, dark mode via `prefers-color-scheme`.

**Removed at the owner's request (2026-09-23):** the Bragging rights and From the newsletter sections. Also removed (2026-10-15): the 1001 tiebreaker everywhere on the page (too rarely played to be worth a column; the parser still extracts `tiebreaker` and `tiebreaker1001`), and the Last result card; last week's W/L and score still show in Fixtures, and the parser still extracts `lastResult`. The parser still extracts `leaderboards`, `hotDarts`, `trophyDarts`, `perfectThrows` and `headline`, so either can come back.

**Out of scope for v1 (superseded by section 10):** other divisions, other teams beyond the Scouting table, the Page 9 team comparison, venue addresses and maps, and the prose pages apart from our headline and prediction.

---

## 7. Tests

Write parser tests first. Deep-equal each fixture against its golden file:

```ts
expect(parse("fixtures/Fa26wk07.xlsx", TEAM)).toEqual(expected07);
expect(parse("fixtures/Fa26wk06.xlsx", TEAM)).toEqual(expected06);
```

Spot checks worth their own tests (they cover the tricky paths):
- wk07 `thisWeek` = home vs `Menace 2 Sobriety` at `The Flying Saucer`. `nextWeek` = away at `Brutha Ducks`, `Snooker's 1&2`.
- wk07 `lastResult` = away at `Pints`, 19-5, gamesWon 4/5/4/6, `tiebreaker1001` null.
- wk06 `lastResult` = away at `Hump'N`, 19-5. This result pair sits on rows 25 and 26, **not** alongside our standings row.
- wk07 prediction is featured (`Match #4`). wk06 prediction comes from the "remaining matches" list: `Area 501 16, Pints and Points 8`.
- wk07 standings: Area 501 6-0 with 94 pts. Menace 5-1 with 86.
- wk07 players: 10 rows. Ian Lewis is #61, total 19-2, ASP average 0.9286.
- Pg7 wk07: Jamie Bender has a blank rank cell, so his rank inherits 10.
- wk06 hotDarts: Steve Massey `15-dart 301` and `6.5 ASPs`. wk07 hotDarts: empty.
- trophyDarts in both weeks: `Fast Singles 301` 9 darts (Ian Lewis, 2026-08-12) and `Fast Doubles 501` 21 darts (Ian Lewis + Steve Massey, 2026-09-02).

`reference/ref_parse.py` produced the golden files (`python3 reference/ref_parse.py fixtures/Fa26wk07.xlsx`). If you change the output shape, regenerate both golden files the same way.

---

## Weekly routine (as built)

1. Download the new `FaNNwkNN.xlsx` from the newsletter post and put it in `inbox/`.
2. Current routine: the owner sends Claude the file each week. Claude puts it in `inbox/`, runs `npm run update` (which parses only files not in `data/manifest.json`), runs `npm run validate` and reads any new failures or warnings, checks the result, commits `inbox/` and `data/`, and pushes after the owner approves. Vercel rebuilds and publishes `raleighdarts.com`. If a file is pushed to `inbox/` without being parsed, the **Update data** workflow (`.github/workflows/update.yml`) parses it and commits `data/`, and Vercel rebuilds again.
3. Or run it locally with `npm run update && npm run dev`, then push.

There is no cron, because the league site blocks automated downloads (section 3). If fallback C gets us a stable link, add `scripts/fetch.ts` and a `schedule:` trigger to `update.yml`.

Commands: `npm test`, `npm run dev`, `npm run build`, `npm run parse -- <file.xlsx>` (re-parse even if already seen), `npm run update`, `npm run validate` (parse every `inbox/` file league-wide and cross-check it).

Code map: the parser is in `src/parser/` (one module per page, `index.ts` is the entry point). The page is in `src/app/`: `model.ts` holds the pure view logic and is tested, `data.ts` bundles `data/*/week-*.json` and `schedule.json` at build time, `App.tsx` builds the sections, and `Chart.tsx` draws the performance chart as hand-rolled SVG.

---

## 8. Build order for today

1. **Fetch spike** (section 3). Decide between a cron and a manual inbox. Don't block on it; everything below works from fixtures.
2. Scaffold: Vite + React + TS, Vitest, and SheetJS. Copy in the fixtures.
3. Parser, one page per module, test-first against the golden files: Page 2, then 5, then 10C (enough for the core page), then 6 to 8, then 3, then 1.
4. `npm run parse -- <file>` writes `data/{season}/week-NN.json` and `data/latest.json`.
5. UI reading `data/latest.json`, `data/{season}/schedule.json` and past weeks, per section 6.
6. Deploy workflow to Pages, then the update workflow (cron, `workflow_dispatch`, and push to `inbox/**`).

## 9. Later, not v1

- (Now in v1 as the Performance chart, section 6.)
- A team switcher, which only means changing the config.
- A short AI summary of the prose pages. This costs API money, so keep it optional.
- A match-day reminder (for example, a Wednesday afternoon message with tonight's opponent and venue).
- Edge cases not seen yet: the week 1 issue (no results yet), tournament and playoff weeks, forfeits, and unreported matches. For all of these, fail soft: `null` sections, never a crash.

---

## 10. League-wide redesign (started 2026-11-04)

The site is opening up to the whole league: every division, every team, from its own point of view. Decisions from the owner:

- The league-neutral domain is `raleighdarts.com` (2026-11-05); `area501.lol` redirects to it.
- A league lander at `/` that isn't tied to any team. Then division, team and player pages, still one SPA with real URLs (`/c`, `/c/area-501`, `/records`, `/player/...`; Vercel rewrites every path to `index.html`).
- The whole site looks like a pub darts chalkboard (decided 2026-11-04): green slate, a black site bar across the top of every page but the lander (small RDL logo going home, then the trail, e.g. C Division / Area 501; `SiteBar` in `App.tsx`; added 2026-11-05), chalk-textured titles in Cabin Sketch, body in Patrick Hand set large, areas ruled off with hand-drawn chalk lines instead of cards, wins ringed in chalk, losses in pink chalk. Dark in light and dark mode alike. **Superseded 2026-11-05:** there is now a light mode, a whiteboard written in dry-erase marker in "dartboard colours" (picked from four palettes, 2026-11-05): crisp white, black writing, grey for faded notes, and only a dartboard's two colours, green where the chalkboard uses yellow (you are here, the leader, tabs) and red for losses. Team names are black (no rainbow on white). A real black-and-cream dartboard with solid red and green rings, a black site bar, cards lifted with a faint shadow, no chalk grain, and a marker instead of the chalk stick writing the title. It starts dark for everyone (the owner's call, 2026-11-05, over following the phone); a Light/Dark toggle at the top right of the lander switches it and is remembered (`rdl.theme`; `src/app/theme.ts`). `index.html` sets `<html data-theme>` before first paint, so there's no flash. Every colour in `styles.css` is a token with a dark value on `:root` and a light value under `:root[data-theme="light"]`; team colours are `--c0`…`--c7` (`chalkFor` returns `var(--cN)`), player chart colours `--p0`…`--p9`. The phone's status bar takes the page's background colour (`syncStatusBar`). Each team writes in its own chalk colour, picked from its name (`chalkFor` in `src/app/ui.tsx`). The hand-drawn mascots and per-team palettes are retired. Avoid template tells: no all-caps labels, no "A · B · C" strings, no arrows on links.
- The RDL logo (from the newsletter workbook, made chalk-white as `public/rdl-logo.png`) sits on the lander. It carries a ™: get the league's OK before publishing.
- The editor's prediction was removed everywhere on 2026-11-04 so the site would read as neutral; on 2026-11-05 the owner brought it back league-wide as "Kilt's pick" (Kilt is the newsletter's editor), on the division Matches tab only. `leaguePicks` (`src/parser/page5.ts`) reads page 5's "Predictions for the week" into `LeagueDivision.picks` for every one of the issue's matches (all 324 this season): featured write-ups keep the editor's text and a closing call (the last sentence, with the one before when the last is only a score; no call when one write-up covers several matches), and the "remaining matches" list becomes a score line in the standings' names ("12+" reads "wins the 1001"). No winner is read into the prose. Each card shows "Kilt's pick" along its bottom, a featured one opening to the whole write-up. `npm run validate` warns if a match has no pick. With picks on, a week of cards no longer fits the smallest phones without scrolling.
- Personal records: each division's trophy darts (Page 3), Perfect Throws and Hot Darts, shown on division, team and player pages.
- Lander (2026-11-05, third pass, picked from five mockups): the only black page (the rest stay slate) so the chalk pops. RDL logo, chalk-written title, "Fall 2026, week 13 of 14", then "Last updated <date>" (the date comes from `data/updated.json`, which `scripts/write.ts` stamps whenever it writes data; `vite.config.ts` bakes it in as `__DATA_UPDATED__`), then the "Your team" shortcut and a quieter "Last looked at <team>" link. Then "Throw for your division": a dartboard drawn in chalk (SVG with a chalk-grain filter), one segment per division, A at the top, each segment a link to its division page. The board starts clean every visit: no segment is marked from last time, and on touch screens there is no hover highlight (it would stick after a tap). Tapping one throws a dart that sticks in that segment's treble (only the treble turns yellow), then the division page opens (straight there under reduced motion or with a modifier key). Everything down to the board fits the first screen with no scrolling (`.lander-fold`, one `svh` tall): the logo and headings scale with screen height and the board takes what is left, 230 to 440px; checked at 360x640 to 430x932 with both the "Your team" box and the "Last looked at" line showing (on screens under 700px tall the "Your team" label and the board hint drop out and the logo shrinks). If the top ever gets taller than the screen, the first block grows rather than overlapping what follows. At the bottom of the first screen a bobbing yellow chalk double arrow, "Search by name, and what's coming up", scrolls down to the search when tapped and fades once the page is scrolled (`MoreBelow`). Below the fold, a "Find your team" search box over every team in the league. Key dates ("Coming up") at the bottom. No leaders or clinch marks.
- Form tab (rebuilt 2026-11-05, `src/app/Chart.tsx`, numbers in `src/app/form.ts`): pick a player (three buttons across, plus Whole team) and a game (All games, Singles 301/Cricket, Doubles 501/Cricket). One line chart of their season-so-far win % in that game, one point per issue: each player plays about one game of each type a week, so a single week is just 0% or 100%, and the running season figure is the honest line; its slope is the form. A sentence above says it in words: Hot or Cold when the last 3 weeks' record is 15+ points better or worse than everything before (and at least 3 recent games), else Steady, or "not enough games to call it". Toggles under the chart: Team average (on by default), Division's best (the highest win % in that game among regulars with at least half the busiest player's games), a 50% line, and Compare a player (anyone in the division). Division and league averages aren't offered: every game has a winner and a loser, so they're always 50%. The old Compare and Breakdown views are gone.
- Team page (2026-11-04; reworked 2026-11-05 to match the division page): black board like divisions; the team's name chalk-written and centred between ‹ › arrows to the teams either side in the standings (wrapping; the dropdown is gone), the week line, and one "This is my team" / "★ My team" toggle button under it. The match card is compact (who, their place and record, home or away at the venue, street and town, the two map links side by side; the landmark only on screens wider than 480px), so the tabs show on the first screen of every phone. On phones the Opponent table keeps Record, Win % and the last 3 weeks (Singles, Doubles and Matches drop, chosen in code so the column headings stay aligned), tonight's match, then tabs: Players | Form | Opponent | Fixtures (in that order since 2026-11-05; a Standings tab was dropped 2026-11-05: the division page has the same table, one tap away in the site bar). One tab at a time, folds open flat inside tabs, Fixtures lists all 14 weeks. `?tab=` keeps the tab in the link. The division leaderboard lives on the division page, filtered by games played (all, more than 5, more than 20).
- Division page (2026-11-05, reworked same day from mockups: D2's look with D4's tabs): black like the lander (team pages stay slate). Header: the title and week line centred between two round chalk arrows to the previous and next division, wrapping round (H's next is A); the chalk that writes the title is put away once it's done so it doesn't sit on the arrow. (Replaced the neighbouring-letter buttons, 2026-11-05.) A team picked with "This is my team" is starred in yellow wherever it appears on the page (its ladder row, its match card). The "Next" strip that once sat over the tabs was dropped (2026-11-05): it repeated the Matches tab, hid itself there (so the page jumped), and silently followed the picked team. Tabs: Standings | Matches | Players | Records (`?tab=`, ids `standings`, `matches`, `leaderboard`, `records`; same `Tabs` component as team pages, `src/app/Tabs.tsx`). Standings opens with a one-line note, "Tap a team to see its page: fixtures, players and form", then a chalk ladder (`Ladder`): each team in its own chalk, W–L under the name, points big on the right, the leader ringed in yellow, its record, "N points clear" and its clinch mark on a second line (so its name has the whole width). Standings are ordered by the newsletter's rank (wins first), so the leader can have fewer points than second; the "points clear" note only shows when it's ahead on points. **Kilt's headlines (2026-11-06):** page 1's RDL Headlines line for the division (parsed for every division as `LeagueDivision.headline`), one story a line (split on the newsletter's semicolons), sits under the Standings ladder for the week just played, and at the top of every played week on Matches (`DivisionRound.headline`, from the issue that brought that week's results). Division and team page footers end with "Read the full newsletter", linking the league's archive (`NEWSLETTER_URL` in `ui.tsx`). Records (reworked 2026-11-06, "it just blends together") is three boards, each its own shape: last week's **Hot darts** first, chalked round in yellow like a team page's Tonight, with a chalk star and "week N", one line per feat (big) listing everyone who threw it; **Trophy darts**, "best this season", the value big on the left and the category, holders (team in its chalk colour) and date beside it; **Perfect throws**, "this season", each kind counted in chalk tally marks, then who threw them (×N for repeats). On phones a name and its team share one line. The title is chalk-written on as the page opens, like the lander's (`PageHead chalk`). Standings and Matches fit the first screen without scrolling (checked 360x640 to 430x932, 7- and 8-team divisions): ladder rows share out the height left under the header (`--n`, 42 to 62px, names shrink to one line rather than wrap), and match cards do the same (`--k`, rows 30 to 48px; under 760px tall the cards drop the W–L line and the date note). Matches opens on the next match night still to come (the week just played has no scores until the next newsletter). Players and Records scroll. Matches shows every week of the season, one at a time: big ‹ › buttons either side of a plain week dropdown, opening on this week, `?week=` in the link (`divisionRounds` in `league.ts`: played weeks from page 2 of the following issue, later weeks from the newest page 5 that lists them, dates from `schedule.json`). Each match is a scoreboard card (decided 2026-11-05, "more professional and sports looking"): a dark panel on the slate, in the same handwriting as the rest of the site (the system sans and two-letter monogram crests were dropped the same day as AI-template tells), a row per team with its current place as a small faded number, its W–L under the name, and the score with ◂ by the winner; the loser is dimmed. A strip along the top says Final, the date for upcoming matches, or Bye, with the venue or "Won on the 1001" on the right; a forfeit note runs along the bottom. Team names always stay on one line: `FitName` shrinks a long name's text just enough to fit (floor 11px). No start times: we don't have them.
- Your team (decided 2026-11-05): no logins, nothing sent anywhere. Two things live in the browser's local storage (`src/app/myTeam.ts`): the team picked with the "This is my team" button on a team page (`rdl.pickedTeam`, changes only when the visitor says so, with a "Not my team" undo), and the team page looked at last (`rdl.lastTeam`, updated on every team page). The lander shows the pick as the "Your team" card (name, "★ Your team" on the same line, "Next: Nov 11, away at …" (the following week once this issue's match night has passed), and on taller screens "You picked this team. Change it on any team's page.") and the last-looked-at team as a small link, unless it's the same team. The old `rdl.myTeam` key (last opened, shown as "Your team" before this) carries over as last looked at, never as a pick. Known limit: iPhone Safari can clear site storage after 7 days without a visit; adding the site to the home screen avoids that.
- The site bar (logo and trail) stays fixed at the top while the page scrolls, on every page but the lander (2026-11-05).
- Pages never move sideways (2026-11-05): `html, body { overflow-x: clip }` (hidden as a fallback) and no sideways overscroll. Checked 14 pages at 320 and 360px: nothing wider than the screen at rest, and the dart throw can't push it either. Wide tables still scroll inside their own `.scroll-x` boxes; pinch-zoom is left alone for people who need it.
- Tabs never scroll sideways on a phone (2026-11-05): they share the row's width and their lettering shrinks with the screen; with five tabs (team pages) the spacing tightens too (`data-count` on `.tab-row`). Checked 320 to 430px wide.
- Add to home screen (2026-11-05, reworked same day): "Add RDL to your phone" at the very bottom of the lander, below Coming up, on every device: a two-column table, iPhone and Android, three numbered steps each with the button to tap drawn in (Share, the three-dot menu, the plus-in-a-square). The visitor's own phone's column is marked "your phone"; on Android, when Chrome offers it, an "Add it now" button opens the install prompt (`src/app/install.ts`). Hidden once RDL runs from the home screen. No service worker, on purpose: nothing gets cached, so the data is never stale.
- Icons (2026-11-05): favicon, apple-touch and PWA icons are the chalk-white RDL logo on black, made from `public/rdl-logo.png` (202px, the largest the newsletter has, so the 512px icons are a little soft; swap in a bigger original if the league has one). The web manifest is named Raleigh Dart League / RDL.
- Alternate rows carry a faint chalk stripe everywhere.
- Player pages are in scope: season line, rank in division, week-by-week form, honors (records, perfect throws, hot darts), game breakdown.

Phases: 1. league data model, records parser, validator (done). 2. routing and nav (lander, division, team pages). 3. records page and badges. 4. redesign pass. 5. player pages. 6. remove the old per-team files and parsers once nothing reads them.

### League data (`src/parser/league.ts`)

`parseLeague(workbook)` gives one `LeagueWeek` per issue, written as `data/{season}/league-week-NN.json` (compact, about 30 KB gzipped). Each fact is stored once: per division the standings, page 2 results (both sides of every match), page 5 rounds for weeks N and N+1, page 10 teams and players, trophy-dart records and hot darts, plus the league-wide Perfect Throws. `teamWeekOf(league, team)` derives the old `TeamWeek` shape (tests check it against the team parser for every C team).

Newsletter facts learned from all 13 Fa26 issues (the validator checks these):

- Team names are shortened differently on every page (`Element`, `Inflation. Element`, `…Element (10/21)`, `Projetile`, `We're Sexy / Throw It`). `resolveTeam` (`src/parser/resolve.ts`) tries exact, whole-word, word-prefix, then letters-in-order, and gives up if more than one team fits. Page 10 capitalization can drift from the standings (`Wing & a Plaque`); the standings name wins.
- Divisions with an odd team count have a bye every week (A, B, E, F, G in Fa26).
- Player numbers are unique within a division only, so a player's id is division + number. Page 10 can include quoted nicknames (`Denny "Wood" Williams`); `playerKey` strips them for matching.
- A 12-12 match is decided by the 1001 tiebreaker (page 2 column Q). Wk5 D has page 2's tiebreaker disagreeing with the standings: a newsletter error, reported as a warning.
- Forfeits and missing scoresheets replace the game counts with a note across both rows (`(match` / `forfeited)`, `(scoresheet not received` / `by press time)`). Scores are then null (missing) or 0/16 (forfeit). The late points show up in a later issue's standings, sometimes in pieces.
- A make-up match on page 5 is a single cell: `Still Hump'N @ Darty Little Secrets   (Aug. 30th, Brass Tap 5&6)`.
- Page 3 records: tied holders stack in one column, each with its own date on the team line. Team names and pairs wrap across lines. A record holder can be a sub from another division. The value line can wrap (`Ton-12 (twice! -` / `8/19/26 & 9/16/26)`).
- Page 3 hot darts flow through three column groups under `"X" Division` headers. Doubles and team names wrap. Whole-team feats look like `Jonesing for Mugs (Mike J., ...)`. The editor's notes sit in the same columns.
- Perfect Throws: sections (`9-Marks`, `Ton-80s`, `6-Bulls`) flow down one column into the next; a long entry wraps onto the next row a few columns to the right.
