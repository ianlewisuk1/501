/**
 * The site's page view counter: one running total for the whole site, kept in Upstash Redis
 * (connected to the Vercel project through the Marketplace, which sets the env vars below).
 * POST counts a view and returns the new total; GET just reads it. Nothing about the visitor is
 * sent or stored, only the number. Without the database connected it answers 503, and the page
 * simply doesn't show a count.
 */
import { redis as call } from "./_redis.js";

const KEY = "rdl:views";

async function redis(command: string[]): Promise<number | null> {
  const result = await call(command);
  return result == null ? null : Number(result);
}

const reply = (views: number | null) =>
  views == null
    ? Response.json({ error: "counter not set up" }, { status: 503, headers: { "Cache-Control": "no-store" } })
    : Response.json({ views }, { headers: { "Cache-Control": "no-store" } });

export async function POST(): Promise<Response> {
  return reply(await redis(["INCR", KEY]).catch(() => null));
}

export async function GET(): Promise<Response> {
  return reply(await redis(["GET", KEY]).catch(() => null));
}
