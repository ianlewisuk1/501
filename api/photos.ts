/**
 * Bar photos sent in by players: the Vercel function. The logic is src/photos/server.ts; this file
 * only connects it to Upstash Redis (records, see src/photos/store.ts for the keys) and Vercel Blob
 * (the image files, BLOB_READ_WRITE_TOKEN, set when a Blob store is connected to the project).
 * Without Redis or Blob it answers 503 and the site shows no photos and no send form.
 */
import { del, put } from "@vercel/blob";
import check from "../data/photo-check.json" with { type: "json" };
import { PHOTOS_ON, type PhotoRecord } from "../src/photos/core.js";
import { handlePhotos } from "../src/photos/server.js";
import type { FileStore, PhotoStore } from "../src/photos/store.js";
import { redis, redisReady } from "./_redis.js";

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const parse = (v: unknown): PhotoRecord | null => {
  try { return typeof v === "string" ? (JSON.parse(v) as PhotoRecord) : null; } catch { return null; }
};

const store: PhotoStore = {
  async get(id) { return parse(await redis(["GET", `photo:${id}`])); },
  async getMany(ids) {
    if (!ids.length) return [];
    return strings(await redis(["MGET", ...ids.map((id) => `photo:${id}`)])).map(parse).filter((p): p is PhotoRecord => !!p);
  },
  async save(p) { await redis(["SET", `photo:${p.id}`, JSON.stringify(p)]); },
  async remove(id) { await redis(["DEL", `photo:${id}`]); },
  async pending() { return strings(await redis(["LRANGE", "photos:pending", 0, -1])); },
  async setPending(id, on) {
    await redis(["LREM", "photos:pending", 0, id]);
    if (on) await redis(["LPUSH", "photos:pending", id]);
  },
  async bar(bar) { return strings(await redis(["LRANGE", `photos:bar:${bar}`, 0, 49])); },
  async setInBar(bar, id, on) {
    await redis(["LREM", `photos:bar:${bar}`, 0, id]);
    if (on) await redis(["LPUSH", `photos:bar:${bar}`, id]);
  },
  async hit(sender) {
    const key = `photos:rate:${sender}:${new Date().toISOString().slice(0, 13)}`;
    const n = Number(await redis(["INCR", key]));
    if (n === 1) await redis(["EXPIRE", key, 3600]);
    return n;
  },
};

const files: FileStore = {
  async put(name, body, type) {
    return (await put(name, body, { access: "public", contentType: type, addRandomSuffix: true })).url;
  },
  async del(url) { await del(url); },
};

const handle = async (req: Request) => {
  if (!PHOTOS_ON) return Response.json({ error: "Photos are switched off." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!redisReady() || !process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: "Photos aren't set up yet." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return handlePhotos(req, { store, files, check, adminPassphrase: process.env.PHOTO_ADMIN_PASSPHRASE });
};

export const GET = handle;
export const POST = handle;
