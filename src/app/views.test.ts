import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../../api/views";

describe("page view counter function", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("answers 503 when the database isn't connected, so the page shows no count", async () => {
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    expect((await POST()).status).toBe(503);
  });

  it("counts a view in the total and today's key, and sums the last 7 days, never caching", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://redis.example");
    vi.stubEnv("KV_REST_API_TOKEN", "t0ken");
    vi.setSystemTime(new Date("2026-11-20T03:00:00Z")); // 10 pm Nov 19 in Raleigh
    const calls: string[][] = [];
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const cmd = JSON.parse(String(init.body)) as string[];
      calls.push(cmd);
      if (cmd[0] === "INCR") return Response.json({ result: cmd[1] === "rdl:views" ? 42 : 1 });
      if (cmd[0] === "MGET") return Response.json({ result: ["1", null, "5", "3", null, null, "2"] });
      if (cmd[0] === "GET") return Response.json({ result: "41" });
      return Response.json({ result: 1 });
    });
    vi.stubGlobal("fetch", fetch);
    const post = await POST();
    expect(await post.json()).toEqual({ views: 42, week: 11 });
    expect(post.headers.get("Cache-Control")).toBe("no-store");
    expect(fetch.mock.calls[0][0]).toBe("https://redis.example");
    expect((fetch.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe("Bearer t0ken");
    expect(calls).toContainEqual(["INCR", "rdl:views"]);
    expect(calls).toContainEqual(["INCR", "rdl:views:day:2026-11-19"]);
    expect(calls).toContainEqual(["EXPIRE", "rdl:views:day:2026-11-19", String(9 * 86400)]);
    const mget = calls.find((c) => c[0] === "MGET")!;
    expect(mget.slice(1, 3)).toEqual(["rdl:views:day:2026-11-19", "rdl:views:day:2026-11-18"]);
    expect(mget).toHaveLength(8);
    expect(await (await GET()).json()).toEqual({ views: 41, week: 11 });
    vi.useRealTimers();
  });

  it("answers 503 if Redis errors", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://redis.example");
    vi.stubEnv("KV_REST_API_TOKEN", "t0ken");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    expect((await POST()).status).toBe(503);
  });
});
