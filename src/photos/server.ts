/**
 * The photo handler, one function for Vercel (api/photos.ts) and the dev server (vite.config.ts):
 *
 *   GET  /api/photos?bar=<key>          approved photos of a bar, newest first
 *   POST /api/photos  (form data)       send a photo: photo, bar, word, agree, credit, website (trap)
 *   POST /api/photos  {action:"report", id}            puts a shown photo back in the queue
 *   GET  /api/photos?pending=1          the approval queue        (admin passphrase)
 *   POST /api/photos  {action:"approve"|"reject", id}  approve or delete a photo  (admin passphrase)
 *
 * The admin passphrase comes in an Authorization: Bearer header and is set on Vercel as
 * PHOTO_ADMIN_PASSPHRASE. Nothing about the sender is kept except the optional credit name; their
 * network address is only hashed into an hourly counter that expires.
 */
import { barKey, cleanCredit, PER_HOUR, publicPhoto, uploadProblem, type PhotoCheck, type PhotoRecord } from "./core.js";
import type { FileStore, PhotoStore } from "./store.js";

export interface PhotoDeps {
  store: PhotoStore;
  files: FileStore;
  check: PhotoCheck;
  /** Unset means the admin pages answer 503: approval isn't set up. */
  adminPassphrase: string | undefined;
  now?: () => Date;
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function sha256(s: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

/** Compares without stopping at the first wrong letter, so the time taken gives nothing away. */
function sameSecret(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function isAdmin(req: Request, deps: PhotoDeps): boolean | null {
  if (!deps.adminPassphrase) return null;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return given.length > 0 && sameSecret(given, deps.adminPassphrase);
}

const sender = (req: Request) => (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

export async function handlePhotos(req: Request, deps: PhotoDeps): Promise<Response> {
  const url = new URL(req.url);
  const { store } = deps;
  const now = deps.now ?? (() => new Date());

  if (req.method === "GET") {
    if (url.searchParams.has("pending")) {
      const admin = isAdmin(req, deps);
      if (admin === null) return json({ error: "Approval isn't set up yet." }, 503);
      if (!admin) return json({ error: "Wrong passphrase." }, 401);
      const photos = await store.getMany(await store.pending());
      return json({ photos: photos.map((p) => ({ ...p, barName: deps.check.bars[p.bar] ?? p.bar })) });
    }
    const bar = url.searchParams.get("bar") ?? "";
    const photos = (await store.getMany(await store.bar(bar))).filter((p) => p.status === "approved");
    return json({ photos: photos.map(publicPhoto) });
  }

  if (req.method !== "POST") return json({ error: "Not allowed." }, 405);

  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { action?: string; id?: string };
    const photo = body.id ? await store.get(body.id) : null;
    if (!photo) return json({ error: "No such photo." }, 404);
    if (body.action === "report") {
      // Anyone can send a shown photo back for another look; it stays hidden until approved again.
      if ((await store.hit(await sha256(sender(req)))) > PER_HOUR * 2) return json({ error: "Too many tries. Please try again later." }, 429);
      if (photo.status === "approved") {
        await store.save({ ...photo, status: "pending" });
        await store.setInBar(photo.bar, photo.id, false);
        await store.setPending(photo.id, true);
      }
      return json({ ok: true });
    }
    const admin = isAdmin(req, deps);
    if (admin === null) return json({ error: "Approval isn't set up yet." }, 503);
    if (!admin) return json({ error: "Wrong passphrase." }, 401);
    if (body.action === "approve") {
      await store.save({ ...photo, status: "approved" });
      await store.setPending(photo.id, false);
      await store.setInBar(photo.bar, photo.id, true);
      return json({ ok: true });
    }
    if (body.action === "reject") {
      await store.setPending(photo.id, false);
      await store.setInBar(photo.bar, photo.id, false);
      await store.remove(photo.id);
      await deps.files.del(photo.url);
      return json({ ok: true });
    }
    return json({ error: "Unknown action." }, 400);
  }

  // A photo being sent in.
  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: "Please pick a photo." }, 400);
  const file = form.get("photo");
  const upload = {
    bar: String(form.get("bar") ?? ""),
    word: String(form.get("word") ?? ""),
    agree: form.get("agree") === "yes",
    trap: String(form.get("website") ?? ""),
    type: file instanceof Blob ? file.type : "",
    size: file instanceof Blob ? file.size : 0,
  };
  const problem = uploadProblem(upload, deps.check);
  if (problem) return json({ error: problem }, 400);
  if ((await store.hit(await sha256(sender(req)))) > PER_HOUR) return json({ error: "That's a lot of photos for one hour. Please try again later." }, 429);

  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const ext = upload.type === "image/png" ? "png" : upload.type === "image/webp" ? "webp" : "jpg";
  const stored = await deps.files.put(`bars/${barKey(upload.bar)}/${id}.${ext}`, file as Blob, upload.type);
  const record: PhotoRecord = {
    id, bar: upload.bar, url: stored, credit: cleanCredit(String(form.get("credit") ?? "")),
    at: now().toISOString(), status: "pending",
  };
  await store.save(record);
  await store.setPending(id, true);
  return json({ ok: true }, 201);
}
