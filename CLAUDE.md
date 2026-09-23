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
| Hosting | GitHub Pages (public repo). If the repo is private, use Cloudflare Pages or Netlify instead. | free |
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
data/Fa26/week-07.json  +  data/latest.json  +  data/manifest.json (processed files)
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
data/              generated JSON (committed)
inbox/             downloaded or manually dropped .xlsx files
fixtures/          Fa26wk06.xlsx, Fa26wk07.xlsx
fixtures/expected/ Fa26wk06.area501.json, Fa26wk07.area501.json   (golden outputs)
reference/ref_parse.py   working Python reference parser. Port its logic; don't ship it.
.github/workflows/update.yml   (cron + manual dispatch + on push to inbox/)
.github/workflows/deploy.yml   (build + deploy to Pages)
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

## 6. What the page shows (top to bottom, one screen on a phone)

1. **Header:** Area 501 · C Division · Week 7 · Wed Sep 23
2. **Tonight:** opponent, home or away, venue, the opponent's rank and record (join with standings), and the editor's pick.
3. **Standings:** the C table with our row highlighted and the gap to 2nd place ("8 pts clear").
4. **Last week:** W/L, score, opponent's full name, and games won per category out of 6.
5. **Next week:** opponent and venue.
6. **Players:** name, W-L, win %, ASP average. Sortable, and tapping a row shows the category breakdown. Label it "through week N-1".
7. **Bragging rights:** leaderboard ranks, trophy darts, hot darts, perfect throws. Hide any empty section.
8. **From the newsletter:** the C Division headline and a link to the original post.

Keep it fast and plain: system fonts, no heavy UI kit, dark mode via `prefers-color-scheme`.

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

## 8. Build order for today

1. **Fetch spike** (section 3). Decide between a cron and a manual inbox. Don't block on it; everything below works from fixtures.
2. Scaffold: Vite + React + TS, Vitest, and SheetJS. Copy in the fixtures.
3. Parser, one page per module, test-first against the golden files: Page 2, then 5, then 10C (enough for the core page), then 6 to 8, then 3, then 1.
4. `npm run parse -- <file>` writes `data/{season}/week-NN.json` and `data/latest.json`.
5. UI reading `data/latest.json`, per section 6.
6. Deploy workflow to Pages, then the update workflow (cron, `workflow_dispatch`, and push to `inbox/**`).

## 9. Later, not v1

- Trends across weeks from `data/` history (win % and ASP average over the season).
- A team switcher, which only means changing the config.
- A short AI summary of the prose pages. This costs API money, so keep it optional.
- A match-day reminder (for example, a Wednesday afternoon message with tonight's opponent and venue).
- Edge cases not seen yet: the week 1 issue (no results yet), tournament and playoff weeks, forfeits, and unreported matches. For all of these, fail soft: `null` sections, never a crash.
