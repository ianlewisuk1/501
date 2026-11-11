/**
 * Upstash Redis over its REST API, for the Vercel functions (no npm package). The Vercel Marketplace
 * integration sets KV_REST_API_URL/KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*). Files starting with
 * "_" in api/ are not routes. Returns null when the database isn't connected or the call fails.
 */
export const redisReady = () =>
  !!(process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL) &&
  !!(process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN);

export async function redis(command: (string | number)[]): Promise<unknown> {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command.map(String)),
  });
  if (!res.ok) return null;
  const { result } = (await res.json()) as { result: unknown };
  return result;
}
