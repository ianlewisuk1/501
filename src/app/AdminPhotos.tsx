/**
 * Ian's approval page for bar photos, at /admin/photos (not linked from anywhere). The passphrase is
 * the PHOTO_ADMIN_PASSPHRASE set on Vercel; it's kept for this browser tab only (sessionStorage) and
 * sent with each request. Each photo waiting shows big, with its bar, who sent it and when, and two
 * buttons: Show it (approve) or Delete it (reject, which removes the file too).
 */
import { useEffect, useState, type FormEvent } from "react";
import { decide, pendingPhotos, type PendingPhoto } from "./photos";

const KEY = "rdl.photoAdmin";
const remembered = () => { try { return sessionStorage.getItem(KEY) ?? ""; } catch { return ""; } };
const remember = (v: string) => { try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch { /* private mode */ } };

export function AdminPhotos() {
  const [pass, setPass] = useState(remembered);
  const [photos, setPhotos] = useState<PendingPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async (p: string) => {
    const r = await pendingPhotos(p);
    if (typeof r === "string") { setError(r); setPhotos(null); if (/passphrase/i.test(r)) { remember(""); setPass(""); } return; }
    setError(null);
    setPhotos(r);
    remember(p);
  };
  // Opens straight onto the queue if this tab already has the passphrase.
  useEffect(() => { if (pass) void load(pass); }, []);

  if (!photos) {
    const submit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const p = String(new FormData(e.currentTarget).get("pass") ?? "");
      setPass(p);
      void load(p);
    };
    return (
      <main className="admin-photos">
        <h1>Photos to check</h1>
        <form className="bar-send" onSubmit={submit}>
          <label htmlFor="admin-pass">Passphrase</label>
          <input id="admin-pass" name="pass" type="password" autoComplete="current-password" required />
          {error && <p className="bar-error" role="alert">{error}</p>}
          <p className="bar-send-actions"><button type="submit" className="big-btn">Open</button></p>
        </form>
      </main>
    );
  }

  const act = async (id: string, action: "approve" | "reject") => {
    setBusy(id);
    const ok = await decide(pass, id, action);
    setBusy(null);
    if (ok) setPhotos((list) => list?.filter((p) => p.id !== id) ?? null);
    else setError("That didn't work. Try again, or reload the page.");
  };
  return (
    <main className="admin-photos">
      <h1>Photos to check</h1>
      <p className="muted">{photos.length ? `${photos.length} waiting. Oldest last.` : "Nothing waiting."}</p>
      {error && <p className="bar-error" role="alert">{error}</p>}
      <ul className="admin-list">
        {photos.map((p) => (
          <li key={p.id}>
            <img src={p.url} alt={`Sent in for ${p.barName}`} />
            <p><strong>{p.barName}</strong></p>
            <p className="muted">{p.credit ? `From ${p.credit}` : "No name given"}, {new Date(p.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
            <p className="bar-send-actions">
              <button type="button" className="big-btn" disabled={busy === p.id} onClick={() => act(p.id, "approve")}>Show it</button>
              <button type="button" className="text-btn" disabled={busy === p.id} onClick={() => act(p.id, "reject")}>Delete it</button>
            </p>
          </li>
        ))}
      </ul>
      <p><button type="button" className="text-btn" onClick={() => load(pass)}>Check again</button></p>
    </main>
  );
}
