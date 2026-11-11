/**
 * Bar photos sent in by players: the rules, kept pure so they can be tested. Nobody signs up. A
 * photo needs this week's photo word (the issue code at the top of page 1 of the newsletter, like
 * JK958), a tick to say the sender took it and the site may show it, and Ian's approval before
 * anyone sees it. See src/photos/server.ts for the handler and api/photos.ts for the Vercel function.
 */

/** What the server checks a photo against: written by scripts/write.ts as data/photo-check.json. */
export interface PhotoCheck {
  /** The newest issue's code and the one before, so changeover day doesn't lock anyone out. */
  words: string[];
  /** Every host bar this season, by key, with its name as the league writes it. */
  bars: Record<string, string>;
}

export type PhotoStatus = "pending" | "approved";

export interface PhotoRecord {
  id: string;
  bar: string;
  url: string;
  credit: string | null;
  at: string;
  status: PhotoStatus;
}

/** What visitors see of an approved photo. */
export type PublicPhoto = Pick<PhotoRecord, "id" | "url" | "credit">;

/** Phone photos are shrunk in the browser first (about 1600px, well under 1 MB); this is a backstop. */
export const MAX_BYTES = 4_000_000;
/** Photos one sender (by network address, hashed) can send in an hour. */
export const PER_HOUR = 5;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** "Brass Tap & Billiards" -> "brass-tap-billiards". */
export const barKey = (name: string) =>
  name.toLowerCase().replace(/&/g, " ").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** "#jk 958" -> "JK958". */
export const normWord = (s: string) => s.replace(/[#\s]/g, "").toUpperCase();

/** A first name or nickname for the credit line: letters, spaces, apostrophes, dots and hyphens, 30 at most. */
export function cleanCredit(s: string | null | undefined): string | null {
  const t = (s ?? "").replace(/[^\p{L}\s'’.\-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 30).trim();
  return t || null;
}

export interface Upload {
  bar: string;
  word: string;
  agree: boolean;
  /** A form field people never see; bots fill it in. */
  trap: string;
  type: string;
  size: number;
}

/** Why a photo can't be taken, in words for the sender, or null if it's fine. */
export function uploadProblem(u: Upload, check: PhotoCheck): string | null {
  if (u.trap) return "Something went wrong. Please try again.";
  if (!check.bars[u.bar]) return "That bar isn't in this season's list.";
  if (!check.words.map(normWord).includes(normWord(u.word))) {
    return "That's not this week's photo word. It's the issue code at the top of page 1 of the newsletter.";
  }
  if (!u.agree) return "Please tick the box to say you took the photo and the site may show it.";
  if (!IMAGE_TYPES.includes(u.type)) return "That doesn't look like a photo.";
  if (u.size > MAX_BYTES) return "That photo is too big.";
  if (u.size === 0) return "Please pick a photo.";
  return null;
}

export const publicPhoto = ({ id, url, credit }: PhotoRecord): PublicPhoto => ({ id, url, credit });
