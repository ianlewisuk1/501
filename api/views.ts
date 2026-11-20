/**
 * The site's page view counter, kept in Upstash Redis (connected to the Vercel project through the
 * Marketplace, which sets the env vars _redis.ts reads). Two figures: the all-time total
 * (`rdl:views`) and this week's, the last 7 days counted by day in Raleigh time
 * (`rdl:views:day:YYYY-MM-DD`, each kept 9 days), so the weekly figure rolls rather than
 * dropping to zero on a set day. POST counts a view and returns both; GET just reads them.
 * Nothing about the visitor is sent or stored, only the numbers. Without the database connected
 * it answers 503, and the page simply doesn't show a count.
 */
import { redis } from "./_redis.js";

const KEY = "rdl:views";
const DAY_KEY = (day: string) => `${KEY}:day:${day}`;
const KEEP_SECONDS = 9 * 24 * 60 * 60;

/** The calendar day in Raleigh, n days before `now`, as YYYY-MM-DD. */
export function raleighDay(now: Date, daysBack = 0): string {
  const d = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** The last 7 days' keys, today first. */
const weekKeys = (now: Date) => Array.from({ length: 7 }, (_, i) => DAY_KEY(raleighDay(now, i)));

async function lastWeek(now: Date): Promise<number | null> {
  const counts = await redis(["MGET", ...weekKeys(now)]);
  if (!Array.isArray(counts)) return null;
  return counts.reduce((sum: number, n) => sum + (Number(n) || 0), 0);
}

type Counts = { views: number; week: number };

const reply = (counts: Counts | null) =>
  counts == null
    ? Response.json({ error: "counter not set up" }, { status: 503, headers: { "Cache-Control": "no-store" } })
    : Response.json(counts, { headers: { "Cache-Control": "no-store" } });

async function count(now: Date): Promise<Counts | null> {
  const today = DAY_KEY(raleighDay(now));
  const [total, day] = await Promise.all([redis(["INCR", KEY]), redis(["INCR", today])]);
  if (total == null || day == null) return null;
  if (Number(day) === 1) await redis(["EXPIRE", today, KEEP_SECONDS]);
  const week = await lastWeek(now);
  return week == null ? null : { views: Number(total), week };
}

async function read(now: Date): Promise<Counts | null> {
  const [total, week] = await Promise.all([redis(["GET", KEY]), lastWeek(now)]);
  if (week == null) return null;
  return { views: Number(total) || 0, week };
}

export async function POST(): Promise<Response> {
  return reply(await count(new Date()).catch(() => null));
}

export async function GET(): Promise<Response> {
  return reply(await read(new Date()).catch(() => null));
}
