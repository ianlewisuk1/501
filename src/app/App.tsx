import { useEffect, useMemo } from "react";
import { DivisionPage } from "./DivisionPage";
import { HomePage } from "./HomePage";
import { TeamPage } from "./TeamPage";
import { divisionIn, teamBySlug, teamHistory } from "./league";
import { divisionPath, Link, navigate, teamPath, useRoute, type Route } from "./route";
import { useSeason, type SeasonData } from "./store";

import { chalkFor } from "./ui";

export { ClinchBadge, PLAYER_COLUMNS } from "./ui";

const MY_TEAM = "rdl.myTeam";

/** The team page last opened on this device, for the lander's shortcut. Storage can be blocked. */
function readMyTeam(): { division: string; team: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(MY_TEAM) ?? "null");
    return v && typeof v.division === "string" && typeof v.team === "string" ? v : null;
  } catch {
    return null;
  }
}
function saveMyTeam(v: { division: string; team: string }) {
  try { localStorage.setItem(MY_TEAM, JSON.stringify(v)); } catch { /* private mode */ }
}

export function App() {
  const route = useRoute();
  // A team page needs the whole season (fixtures, charts, recent form); the others just the newest issue.
  const data = useSeason(route.page === "team");
  // Old ?team= links move to the team's own address.
  useEffect(() => {
    if (route.page === "team" && location.search.includes("team=")) navigate(`/c/${route.team}`, true);
  }, [route]);
  if (data === undefined) return <main className="loading" aria-busy="true"><p className="muted">Loading…</p></main>;
  if (data === null) return <main><h1>Raleigh Dart League</h1><p>No newsletter parsed yet.</p></main>;
  return <Screen data={data} route={route} myTeam={readMyTeam()} />;
}

/** Everything below the loader: picks the page for a route. Rendered directly by tests. */
export function Screen({ data, route, myTeam = null }: { data: SeasonData; route: Route; myTeam?: { division: string; team: string } | null }) {
  const issue = data.issues.at(-1)!;
  const division = route.page === "home" ? undefined : divisionIn(issue, route.division);
  const team = route.page === "team" ? teamBySlug(issue, route.division, route.team) : undefined;
  const history = useMemo(() => (team ? teamHistory(data, team) : []), [data, team]);
  const week = history.at(-1);

  useTheme(team);
  useEffect(() => {
    document.title = team ? `${team}, ${division!.division} Division | RDL` : division ? `${division.division} Division | RDL` : "Raleigh Dart League";
    if (team && division) saveMyTeam({ division: division.division, team });
  }, [team, division]);

  let page;
  if (route.page === "home") page = <HomePage data={data} issue={issue} myTeam={myTeam} />;
  else if (!division) page = <NotFound />;
  else if (route.page === "division") page = <DivisionPage issue={issue} division={division} />;
  else if (!team || !week) page = <NotFound />;
  else page = <TeamPage key={team} data={data} week={week} history={history} />;

  return (
    <>
      <Crumbs division={division?.division} team={team} />
      {page}
    </>
  );
}

/** League › C Division › Area 501, along the top of every page. */
function Crumbs({ division, team }: { division?: string; team?: string }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        <li><Link to="/">RDL</Link></li>
        {division && <li><Link to={divisionPath(division)} aria-current={team ? undefined : "page"}>{division} Division</Link></li>}
        {division && team && <li><Link to={teamPath(division, team)} aria-current="page">{team}</Link></li>}
      </ol>
    </nav>
  );
}

function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p><Link to="/">Back to the league</Link></p>
    </main>
  );
}

/** A team page writes that team's name and highlights in its own chalk colour. */
function useTheme(team: string | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    if (team) root.style.setProperty("--team", chalkFor(team));
    else root.style.removeProperty("--team");
  }, [team]);
}
