/**
 * Where photo records live. On Vercel it's Upstash Redis (api/photos.ts); on `npm run dev` and in
 * tests it's memory. Keys: photo:<id> (the record, as JSON), photos:pending (ids awaiting approval),
 * photos:bar:<bar> (approved ids, newest first), photos:rate:<hash>:<hour> (a sender's count this hour).
 */
import type { PhotoRecord } from "./core";

export interface PhotoStore {
  get(id: string): Promise<PhotoRecord | null>;
  getMany(ids: string[]): Promise<PhotoRecord[]>;
  save(photo: PhotoRecord): Promise<void>;
  remove(id: string): Promise<void>;
  pending(): Promise<string[]>;
  setPending(id: string, on: boolean): Promise<void>;
  bar(bar: string): Promise<string[]>;
  setInBar(bar: string, id: string, on: boolean): Promise<void>;
  /** Adds one to this sender's count for the hour and returns it. */
  hit(sender: string): Promise<number>;
}

export interface FileStore {
  put(name: string, body: Blob, type: string): Promise<string>;
  del(url: string): Promise<void>;
}

/** Memory versions, for the dev server and tests. Files become data: URLs. */
export function memoryStores(): { store: PhotoStore; files: FileStore } {
  const photos = new Map<string, PhotoRecord>();
  let pending: string[] = [];
  const bars = new Map<string, string[]>();
  const hits = new Map<string, number>();
  const store: PhotoStore = {
    async get(id) { return photos.get(id) ?? null; },
    async getMany(ids) { return ids.map((id) => photos.get(id)).filter((p): p is PhotoRecord => !!p); },
    async save(p) { photos.set(p.id, { ...p }); },
    async remove(id) { photos.delete(id); },
    async pending() { return [...pending]; },
    async setPending(id, on) { pending = pending.filter((x) => x !== id); if (on) pending.unshift(id); },
    async bar(bar) { return [...(bars.get(bar) ?? [])]; },
    async setInBar(bar, id, on) {
      const list = (bars.get(bar) ?? []).filter((x) => x !== id);
      bars.set(bar, on ? [id, ...list] : list);
    },
    async hit(sender) {
      const key = `${sender}:${new Date().toISOString().slice(0, 13)}`;
      const n = (hits.get(key) ?? 0) + 1;
      hits.set(key, n);
      return n;
    },
  };
  const files: FileStore = {
    async put(_name, body, type) {
      const b64 = Buffer.from(await body.arrayBuffer()).toString("base64");
      return `data:${type};base64,${b64}`;
    },
    async del() {},
  };
  return { store, files };
}
