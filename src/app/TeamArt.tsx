import type { ReactElement } from "react";
import { TEAM } from "../parser/team";
import { teamSlug } from "./model";

// Hand-drawn header mascots for the other teams, in each team's own palette (themes.css).
const C = "var(--cream)";
const H = "var(--alien)";
const N = "var(--navy)";

/** A dart with its tip at (x, y); `angle` turns the tail (0 = tail to the right, -90 = tail straight up). */
const Dart = ({ x, y, angle, scale = 1 }: { x: number; y: number; angle: number; scale?: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
    <path d="M0 0 L7 -1 L7 1 Z" fill={C} />
    <rect x="7" y="-2.2" width="11" height="4.4" rx="1.5" fill={C} />
    <rect x="18" y="-0.8" width="13" height="1.6" fill={C} />
    <path d="M27 0 L38 -7 L36 0 L38 7 Z" fill={H} stroke={N} strokeWidth="0.8" />
  </g>
);

const Board = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <g>
    {[1, 0.78, 0.56, 0.34, 0.12].map((k, i) => <circle key={k} cx={x} cy={y} r={r * k} fill={i % 2 ? H : C} stroke={N} strokeWidth="0.8" />)}
  </g>
);

const ART: Record<string, ReactElement> = {
  "brutha-ducks": (
    <>
      <path d="M8 98 q8 -6 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0" fill="none" stroke={H} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M18 66 L4 54 L22 60 Z" fill={C} />
      <ellipse cx="60" cy="74" rx="44" ry="20" fill={C} />
      <path d="M38 70 q20 -18 46 -2 q-18 14 -46 2 Z" fill={H} opacity="0.85" />
      <circle cx="98" cy="42" r="20" fill={C} />
      <path d="M112 44 q18 -2 24 4 q-8 8 -24 4 Z" fill={H} />
      <circle cx="102" cy="37" r="3.5" fill={N} />
    </>
  ),
  "darty-little-secrets": (
    <>
      <rect x="14" y="34" width="104" height="66" rx="5" fill={C} />
      <path d="M14 38 L66 76 L118 38" fill="none" stroke={N} strokeWidth="3" strokeLinejoin="round" />
      <path d="M14 100 L52 68 M118 100 L80 68" stroke={N} strokeWidth="1.5" opacity="0.4" />
      <Board x={66} y={74} r={16} />
      <Dart x={67} y={73} angle={-145} scale={1.2} />
      <text x="96" y="24" fill={H} fontSize="16" fontWeight="700" fontStyle="italic">shh…</text>
    </>
  ),
  "menace-2-sobriety": (
    <>
      <Dart x={4} y={108} angle={-40} scale={3.4} />
      <Dart x={136} y={108} angle={-140} scale={3.4} />
      <circle cx="70" cy="50" r="30" fill={C} />
      <rect x="52" y="66" width="36" height="22" rx="7" fill={C} />
      <circle cx="58" cy="50" r="8.5" fill={N} />
      <circle cx="82" cy="50" r="8.5" fill={N} />
      <circle cx="58" cy="50" r="2.5" fill={H} />
      <circle cx="82" cy="50" r="2.5" fill={H} />
      <path d="M70 60 L65 69 L75 69 Z" fill={N} />
      {[60, 66, 72, 78].map((x) => <line key={x} x1={x + 2} y1="77" x2={x + 2} y2="88" stroke={N} strokeWidth="1.8" />)}
    </>
  ),
  "mulligans-mafia": (
    <>
      <ellipse cx="70" cy="80" rx="60" ry="12" fill={C} />
      <path d="M34 80 C30 40 46 26 70 30 C94 26 110 40 106 80 Z" fill={C} />
      <path d="M52 34 Q70 48 88 34" fill="none" stroke={N} strokeWidth="2" opacity="0.5" />
      <path d="M35 64 Q70 72 105 64 L106 77 Q70 85 34 77 Z" fill={H} />
      <Dart x={92} y={68} angle={-35} scale={1.3} />
    </>
  ),
  "pints-and-points": (
    <>
      <path d="M42 34 L98 34 L92 104 L48 104 Z" fill={H} />
      <path d="M42 34 L98 34 L92 104 L48 104 Z" fill="none" stroke={C} strokeWidth="3" strokeLinejoin="round" />
      {[[48, 30, 10], [62, 26, 12], [78, 27, 11], [92, 31, 9]].map(([x, y, r]) => <circle key={x} cx={x} cy={y} r={r} fill={C} />)}
      {[[60, 70], [74, 86], [80, 58]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2.5" fill={C} opacity="0.7" />)}
      <path d="M98 50 q20 4 16 26 q-4 12 -18 12" fill="none" stroke={C} strokeWidth="5" />
      <Dart x={70} y={34} angle={-40} scale={1.1} />
    </>
  ),
  "projectile-dysfunction": (
    <>
      <Board x={108} y={36} r={24} />
      <path d="M6 30 Q40 6 70 34 T76 92" fill="none" stroke={H} strokeWidth="2.5" strokeDasharray="5 6" strokeLinecap="round" />
      <Dart x={66} y={106} angle={-72} scale={1.4} />
      <text x="88" y="92" fill={H} fontSize="18" fontWeight="700">?!</text>
    </>
  ),
  "still-hump-n": (
    <>
      <ellipse cx="62" cy="62" rx="38" ry="17" fill={C} />
      <path d="M38 56 Q56 14 78 54 Z" fill={C} />
      <path d="M92 58 Q104 40 106 22 L118 20 Q114 46 100 66 Z" fill={C} />
      <ellipse cx="118" cy="22" rx="12" ry="7" fill={C} />
      <circle cx="120" cy="19" r="2" fill={N} />
      {[34, 46, 76, 88].map((x) => <rect key={x} x={x} y="72" width="6" height="32" rx="3" fill={C} />)}
      <path d="M26 58 q-8 6 -6 18" fill="none" stroke={C} strokeWidth="3" strokeLinecap="round" />
      <path d="M44 62 Q62 72 80 62" fill="none" stroke={H} strokeWidth="5" />
      <Dart x={56} y={40} angle={-135} scale={1.2} />
    </>
  ),
};

/** The header picture: our alien, or the team's drawn mascot. */
export function TeamArt({ team }: { team: string }) {
  if (team === TEAM.name) {
    return <img className="art" src={`${import.meta.env.BASE_URL}area501-art.webp`} alt="" width={360} height={287} />;
  }
  const art = ART[teamSlug(team)];
  if (!art) return null;
  return <svg className="art drawn" viewBox="0 0 140 110" aria-hidden="true">{art}</svg>;
}
