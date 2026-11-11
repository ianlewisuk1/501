/**
 * A bar's photo on the team page's match card: a small square beside the address. With a photo,
 * tapping it opens it big, with who took it, "Send another" and "Report this photo". With none
 * yet, the square is a dashed chalk outline saying "Add a photo", which opens the send form.
 * Nothing shows while loading or when photos aren't set up, so the card never has a dead button.
 */
import { useId, useState, type FormEvent } from "react";
import { barKey } from "../photos/core";
import { reportPhoto, sendPhoto, useBarPhotos } from "./photos";

export function BarPhoto({ barName }: { barName: string | null }) {
  const bar = barName ? barKey(barName) : null;
  const { photos, ready, reload } = useBarPhotos(bar);
  const [open, setOpen] = useState<"photo" | "send" | null>(null);
  if (!bar || !barName || !ready || photos === null) return null;
  const photo = photos[0];
  return (
    <>
      <button type="button" className={`bar-thumb${photo ? "" : " empty"}`} aria-expanded={open !== null}
        onClick={() => setOpen(open ? null : photo ? "photo" : "send")}
        aria-label={photo ? `Photo of ${barName}` : `Add a photo of ${barName}`}>
        {photo ? <img src={photo.url} alt="" loading="lazy" /> : <span>Add a photo</span>}
      </button>
      {open === "photo" && photo && (
        <figure className="bar-photo">
          <img src={photo.url} alt={`Inside ${barName}`} />
          <figcaption>
            {photo.credit ? `Photo by ${photo.credit}` : "Sent in by a player"}
            <span className="bar-photo-links">
              <button type="button" className="text-btn" onClick={() => setOpen("send")}>Send another</button>
              <Report id={photo.id} onDone={() => { setOpen(null); reload(); }} />
            </span>
          </figcaption>
        </figure>
      )}
      {open === "send" && <SendForm bar={bar} barName={barName} onClose={() => setOpen(null)} />}
    </>
  );
}

function Report({ id, onDone }: { id: string; onDone: () => void }) {
  const [asked, setAsked] = useState(false);
  if (!asked) return <button type="button" className="text-btn" onClick={() => setAsked(true)}>Report this photo</button>;
  return (
    <span className="bar-report">
      Hide it until it's checked again?{" "}
      <button type="button" className="text-btn" onClick={async () => { await reportPhoto(id); onDone(); }}>Yes, hide it</button>{" "}
      <button type="button" className="text-btn" onClick={() => setAsked(false)}>No</button>
    </span>
  );
}

function SendForm({ bar, barName, onClose }: { bar: string; barName: string; onClose: () => void }) {
  const id = useId();
  const [state, setState] = useState<{ sending: boolean; error: string | null; sent: boolean }>({ sending: false, error: null, sent: false });
  if (state.sent) {
    return (
      <div className="bar-send" role="status">
        <p><strong>Thanks!</strong> It will show here once it's been checked.</p>
        <button type="button" className="text-btn" onClick={onClose}>Close</button>
      </div>
    );
  }
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const photo = f.get("photo");
    if (!(photo instanceof File) || !photo.size) { setState({ sending: false, error: "Please pick a photo.", sent: false }); return; }
    setState({ sending: true, error: null, sent: false });
    const error = await sendPhoto({
      photo, bar, word: String(f.get("word") ?? ""), credit: String(f.get("credit") ?? ""),
      agree: f.get("agree") === "on", trap: String(f.get("website") ?? ""),
    });
    setState({ sending: false, error, sent: !error });
  };
  return (
    <form className="bar-send" onSubmit={submit}>
      <p className="bar-send-title">Send a photo of {barName}</p>
      <p className="muted small">The boards and the room are best. Please keep faces out unless people say it's OK.</p>
      <label htmlFor={`${id}-photo`}>Photo</label>
      <input id={`${id}-photo`} name="photo" type="file" accept="image/*" required />
      <label htmlFor={`${id}-word`}>This week's photo word</label>
      <input id={`${id}-word`} name="word" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} required />
      <p className="muted small">It's the issue code at the top of page 1 of this week's newsletter, like AB123.</p>
      <label htmlFor={`${id}-credit`}>Your first name <span className="muted">(optional, for the credit)</span></label>
      <input id={`${id}-credit`} name="credit" type="text" autoComplete="given-name" maxLength={30} />
      {/* Hidden from people; bots fill it in. */}
      <div className="sr-only" aria-hidden="true">
        <label>Website <input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="bar-agree">
        <input name="agree" type="checkbox" required /> I took this photo, and the RDL site may show it.
      </label>
      {state.error && <p className="bar-error" role="alert">{state.error}</p>}
      <p className="bar-send-actions">
        <button type="submit" className="big-btn" disabled={state.sending}>{state.sending ? "Sending…" : "Send photo"}</button>
        <button type="button" className="text-btn" onClick={onClose}>Cancel</button>
      </p>
      <p className="muted small">Photos show after they've been checked.</p>
    </form>
  );
}
