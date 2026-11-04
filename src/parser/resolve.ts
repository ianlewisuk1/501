import { escapeRe, norm } from "./names";

/** A trailing "(9/9)" or "(9/9/26)" date, as record and perfect-throw team lines carry. */
export const DATE_TAIL = /\s*\((\d{1,2})\/(\d{1,2})(?:\/(\d{2}))?\)\s*$/;

/** Drop a trailing date and the ellipses the newsletter uses to shorten names. */
export function cleanTeamText(s: string): string {
  return s.replace(DATE_TAIL, "").replace(/…|\.\.\./g, " ").replace(/\s+/g, " ").trim();
}

const plain = (s: string) => norm(s).replace(/[‘’]/g, "'");
const words = (s: string) => plain(s).split(/[^a-z0-9']+/).filter(Boolean);
const letters = (s: string) => plain(s).replace(/[^a-z0-9]/g, "");

/** Every word of `short` starts a word of `full`, in order ("Inflation. Element" in "The Inflationary Element"). */
function prefixWords(short: string[], full: string[]): boolean {
  let j = 0;
  for (const w of short) {
    while (j < full.length && !full[j].startsWith(w)) j++;
    if (j++ >= full.length) return false;
  }
  return true;
}

/** Every letter of `short` appears in `full`, in order ("Projetile" in "Projectile Dysfunction"). */
function subsequence(short: string, full: string): boolean {
  let j = 0;
  for (const ch of short) {
    j = full.indexOf(ch, j);
    if (j++ < 0) return false;
  }
  return true;
}

/**
 * The one candidate team a shortened or misspelt name refers to, or null when no single team fits.
 * Tries, strictest first: exact, whole-word phrase, word prefixes in order, letters in order.
 * Stops at the first rule that finds anything, so a looser rule never overrides a stricter one.
 */
export function resolveTeam(raw: string, candidates: readonly string[]): string | null {
  const text = cleanTeamText(raw);
  if (!text) return null;
  const t = plain(text);
  const rules: ((c: string) => boolean)[] = [
    (c) => plain(c) === t,
    (c) => new RegExp(`(^|\\s)${escapeRe(t)}(\\s|$)`).test(plain(c)),
    (c) => prefixWords(words(text), words(c)),
    (c) => letters(text).length >= 4 && subsequence(letters(text), letters(c)),
  ];
  for (const rule of rules) {
    const hits = candidates.filter(rule);
    if (hits.length) return hits.length === 1 ? hits[0] : null;
  }
  return null;
}
