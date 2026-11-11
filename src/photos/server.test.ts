import { describe, expect, it } from "vitest";
import { barKey, cleanCredit, normWord, PER_HOUR, type PhotoCheck } from "./core";
import { handlePhotos, type PhotoDeps } from "./server";
import { memoryStores } from "./store";

const check: PhotoCheck = { words: ["JK958", "JK957"], bars: { "high-park": "High Park" } };
const deps = (): PhotoDeps => ({ ...memoryStores(), check, adminPassphrase: "secret" });
const URL_ = "http://x/api/photos";

function send(d: PhotoDeps, over: Record<string, string | Blob> = {}, ip = "1.2.3.4") {
  const form = new FormData();
  const fields: Record<string, string | Blob> = {
    photo: new Blob([new Uint8Array(1000)], { type: "image/jpeg" }), bar: "high-park", word: "jk958", agree: "yes", credit: "Sam", website: "", ...over,
  };
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return handlePhotos(new Request(URL_, { method: "POST", body: form, headers: { "x-forwarded-for": ip } }), d);
}
const act = (d: PhotoDeps, body: object, pass?: string) => handlePhotos(new Request(URL_, {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...(pass ? { authorization: `Bearer ${pass}` } : {}) },
}), d);
const shown = async (d: PhotoDeps) => (await (await handlePhotos(new Request(`${URL_}?bar=high-park`), d)).json()).photos;
const queue = async (d: PhotoDeps, pass = "secret") => handlePhotos(new Request(`${URL_}?pending=1`, { headers: { authorization: `Bearer ${pass}` } }), d);

describe("bar photos", () => {
  it("keys bars and reads photo words and credits forgivingly", () => {
    expect(barKey("Brass Tap & Billiards")).toBe("brass-tap-billiards");
    expect(barKey("Benny's Billiards")).toBe("bennys-billiards");
    expect(normWord(" #jk 958")).toBe("JK958");
    expect(cleanCredit("  Sam <b>  ")).toBe("Sam b");
    expect(cleanCredit("   ")).toBeNull();
  });

  it("takes a photo with this week's or last week's word, and shows it only once approved", async () => {
    const d = deps();
    expect((await send(d)).status).toBe(201);
    expect((await send(d, { word: "#JK957" })).status).toBe(201);
    expect(await shown(d)).toEqual([]);
    const pending = (await (await queue(d)).json()).photos;
    expect(pending).toHaveLength(2);
    expect(pending[0]).toMatchObject({ bar: "high-park", barName: "High Park", credit: "Sam", status: "pending" });
    expect((await act(d, { action: "approve", id: pending[0].id }, "secret")).status).toBe(200);
    expect(await shown(d)).toEqual([{ id: pending[0].id, url: pending[0].url, credit: "Sam" }]);
    // Rejecting deletes it for good.
    expect((await act(d, { action: "reject", id: pending[1].id }, "secret")).status).toBe(200);
    expect((await (await queue(d)).json()).photos).toEqual([]);
  });

  it("turns photos away with a reason the sender can act on", async () => {
    const d = deps();
    const reason = async (over: Record<string, string | Blob>) => (await (await send(d, over)).json()).error;
    expect(await reason({ word: "JK900" })).toMatch(/photo word/);
    expect(await reason({ agree: "" })).toMatch(/tick the box/);
    expect(await reason({ bar: "nowhere" })).toMatch(/isn't in this season's list/);
    expect(await reason({ photo: new Blob(["x"], { type: "text/plain" }) })).toMatch(/doesn't look like a photo/);
    expect(await reason({ website: "http://spam" })).toMatch(/went wrong/);
  });

  it("limits how many photos one sender can send in an hour", async () => {
    const d = deps();
    for (let i = 0; i < PER_HOUR; i++) expect((await send(d)).status).toBe(201);
    expect((await send(d)).status).toBe(429);
    expect((await send(d, {}, "5.6.7.8")).status).toBe(201);
  });

  it("keeps the queue and decisions behind the passphrase", async () => {
    const d = deps();
    await send(d);
    expect((await queue(d, "wrong")).status).toBe(401);
    const id = (await (await queue(d)).json()).photos[0].id;
    expect((await act(d, { action: "approve", id })).status).toBe(401);
    expect((await act(d, { action: "approve", id }, "wrong")).status).toBe(401);
    expect((await queue({ ...d, adminPassphrase: undefined })).status).toBe(503);
  });

  it("lets anyone send a shown photo back for another look", async () => {
    const d = deps();
    await send(d);
    const id = (await (await queue(d)).json()).photos[0].id;
    await act(d, { action: "approve", id }, "secret");
    expect(await shown(d)).toHaveLength(1);
    expect((await act(d, { action: "report", id })).status).toBe(200);
    expect(await shown(d)).toEqual([]);
    expect((await (await queue(d)).json()).photos.map((p: { id: string }) => p.id)).toEqual([id]);
  });
});
