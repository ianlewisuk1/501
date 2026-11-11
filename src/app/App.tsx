import { useEffect, useMemo } from "react";
import { DivisionPage } from "./DivisionPage";
import { HomePage } from "./HomePage";
import { TeamPage } from "./TeamPage";
import { divisionIn, teamBySlug, teamHistory } from "./league";
import { divisionPath, Link, navigate, teamPath, useRoute, type Route } from "./route";
import { useSeason, type SeasonData } from "./store";
import { sawTeam, useMyTeams, type TeamRef } from "./myTeam";

import { chalkFor } from "./ui";
import { syncStatusBar } from "./theme";
import { countView } from "./views";

export { ClinchBadge, PLAYER_COLUMNS } from "./ui";

export function App() {
  const route = useRoute();
  // A team page needs the whole season (fixtures, charts, recent form); the others just the newest issue.
  const data = useSeason(route.page === "team");
  const mine = useMyTeams();
  // Each page opened counts once toward the site's page view total (switching tabs doesn't).
  useEffect(() => { countView(location.pathname); });
  // Old ?team= links move to the team's own address.
  useEffect(() => {
    if (route.page === "team" && location.search.includes("team=")) navigate(`/c/${route.team}`, true);
  }, [route]);
  if (data === undefined) return <main className="loading" aria-busy="true"><p className="muted">Loading…</p></main>;
  if (data === null) return <main><h1>Raleigh Dart League</h1><p>No newsletter parsed yet.</p></main>;
  return <Screen data={data} route={route} myTeam={mine.picked} lastTeam={mine.last} />;
}

/** Everything below the loader: picks the page for a route. Rendered directly by tests. */
export function Screen({ data, route, myTeam = null, lastTeam = null }: {
  data: SeasonData; route: Route; myTeam?: TeamRef | null; lastTeam?: TeamRef | null;
}) {
  const issue = data.issues.at(-1)!;
  const division = route.page === "home" ? undefined : divisionIn(issue, route.division);
  const team = route.page === "team" ? teamBySlug(issue, route.division, route.team) : undefined;
  const history = useMemo(() => (team ? teamHistory(data, team) : []), [data, team]);
  const week = history.at(-1);

  useTheme(team);
  useEffect(() => { syncStatusBar(); }, [route]);
  useEffect(() => {
    document.title = team ? `${team}, ${division!.division} Division | RDL` : division ? `${division.division} Division | RDL` : "Raleigh Dart League";
    if (team && division) sawTeam({ division: division.division, team });
  }, [team, division]);

  let page;
  if (route.page === "home") page = <HomePage data={data} issue={issue} myTeam={myTeam} lastTeam={lastTeam} />;
  else if (!division) page = <NotFound />;
  else if (route.page === "division") page = <DivisionPage data={data} issue={issue} division={division} />;
  else if (!team || !week) page = <NotFound />;
  else page = <TeamPage key={team} data={data} week={week} history={history} />;

  return (
    <>
      {route.page !== "home" && <SiteBar division={division?.division} team={team} />}
      {page}
    </>
  );
}

/**
 * The black strip across the top of every page but the lander (which is all black already):
 * the league's logo and name, going home, then the trail down to this page.
 */
function SiteBar({ division, team }: { division?: string; team?: string }) {
  return (
    <div className="site-bar">
      <nav className="site-bar-inner" aria-label="Breadcrumb">
        <Link to="/" className="site-home">
          <img src={`${import.meta.env.BASE_URL}rdl-logo.png`} alt="" width={34} height={34} />
          <span className="site-name">{division ? "RDL" : "Raleigh Dart League"}</span>
        </Link>
        {division && (
          <ol className="crumbs">
            <li><Link to={divisionPath(division)} aria-current={team ? undefined : "page"}>{division} Division</Link></li>
            {team && <li><Link to={teamPath(division, team)} aria-current="page">{team}</Link></li>}
          </ol>
        )}
      </nav>
    </div>
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
