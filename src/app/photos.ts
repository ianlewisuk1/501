/**
 * Bar photos, as the page sees them (the server side is src/photos/server.ts). Photos are shrunk in
 * the browser before sending: about 1600px on the long side, as a JPEG. Redrawing the photo also
 * leaves behind what the camera stored in the file, including where it was taken.
 */
import { useEffect, useState } from "react";
import type { PhotoRecord, PublicPhoto } from "../photos/core";

const LONG_SIDE = 1600;

export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that photo."))), "image/jpeg", 0.82));
}

/** Sends a photo; resolves to null when it went, or the reason it didn't, in words for the sender. */
export async function sendPhoto(f: { photo: File; bar: string; word: string; credit: string; agree: boolean; trap: string }): Promise<string | null> {
  let photo: Blob;
  try { photo = await shrinkPhoto(f.photo); } catch { return "Couldn't read that photo. Try another one."; }
  const form = new FormData();
  form.set("photo", photo, "photo.jpg");
  form.set("bar", f.bar);
  form.set("word", f.word);
  form.set("credit", f.credit);
  form.set("agree", f.agree ? "yes" : "");
  form.set("website", f.trap);
  try {
    const res = await fetch("/api/photos", { method: "POST", body: form });
    if (res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return body.error ?? "Couldn't send it. Please try again later.";
  } catch {
    return "Couldn't send it. Check the connection and try again.";
  }
}

const cache = new Map<string, PublicPhoto[] | null>();

/**
 * A bar's approved photos, newest first. Null while loading, and also when photos aren't set up
 * (the page then shows nothing about photos at all); an empty list means none yet.
 */
export function useBarPhotos(bar: string | null): { photos: PublicPhoto[] | null; ready: boolean; reload: () => void } {
  const [state, setState] = useState<{ photos: PublicPhoto[] | null; ready: boolean }>(() =>
    bar && cache.has(bar) ? { photos: cache.get(bar)!, ready: true } : { photos: null, ready: false });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!bar) return;
    let live = true;
    fetch(`/api/photos?bar=${encodeURIComponent(bar)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { photos?: PublicPhoto[] } | null) => {
        const photos = Array.isArray(body?.photos) ? body!.photos : null;
        cache.set(bar, photos);
        if (live) setState({ photos, ready: true });
      })
      .catch(() => { if (live) setState({ photos: null, ready: true }); });
    return () => { live = false; };
  }, [bar, n]);
  return { ...state, reload: () => setN((x) => x + 1) };
}

export async function reportPhoto(id: string): Promise<boolean> {
  const res = await fetch("/api/photos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "report", id }) }).catch(() => null);
  return !!res?.ok;
}

export type PendingPhoto = PhotoRecord & { barName: string };

/** The approval queue, or an error in words. */
export async function pendingPhotos(passphrase: string): Promise<PendingPhoto[] | string> {
  const res = await fetch("/api/photos?pending=1", { headers: { Authorization: `Bearer ${passphrase}` } }).catch(() => null);
  if (!res) return "Couldn't reach the site.";
  const body = (await res.json().catch(() => ({}))) as { photos?: PendingPhoto[]; error?: string };
  return res.ok && body.photos ? body.photos : body.error ?? "Something went wrong.";
}

export async function decide(passphrase: string, id: string, action: "approve" | "reject"): Promise<boolean> {
  const res = await fetch("/api/photos", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${passphrase}` },
    body: JSON.stringify({ action, id }),
  }).catch(() => null);
  return !!res?.ok;
}
