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

  it("counts a view with INCR and reads the total with GET, never caching", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://redis.example");
    vi.stubEnv("KV_REST_API_TOKEN", "t0ken");
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const [cmd] = JSON.parse(String(init.body));
      return Response.json({ result: cmd === "INCR" ? 42 : "41" });
    });
    vi.stubGlobal("fetch", fetch);
    const post = await POST();
    expect(await post.json()).toEqual({ views: 42 });
    expect(post.headers.get("Cache-Control")).toBe("no-store");
    expect(fetch.mock.calls[0][0]).toBe("https://redis.example");
    expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toEqual(["INCR", "rdl:views"]);
    expect((fetch.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe("Bearer t0ken");
    expect(await (await GET()).json()).toEqual({ views: 41 });
  });

  it("answers 503 if Redis errors", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://redis.example");
    vi.stubEnv("KV_REST_API_TOKEN", "t0ken");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    expect((await POST()).status).toBe(503);
  });
});
