/**
 * Share a section as a picture (2026-11-20, owner): a tidy card drawn off screen (logo, title,
 * the table, raleighdarts.com at the foot), always on the dark board, turned into a PNG with
 * modern-screenshot. Two buttons: Share opens the phone's share sheet (Messages, WhatsApp, Save
 * Image...), Copy puts the picture on the clipboard. Where a browser can do neither, Copy
 * downloads the picture instead.
 *
 * The picture is made as soon as the buttons come on screen (the share sheet must open straight from the
 * tap; iPhone Safari refuses it after a long wait), and again whenever the card changes.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Status = "idle" | "copied" | "saved" | "failed";

async function makePng(node: HTMLElement): Promise<Blob> {
  const { domToBlob } = await import("modern-screenshot");
  await document.fonts?.ready;
  return domToBlob(node, { scale: 2, type: "image/png" });
}

const canShareFiles = () => {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare
      && navigator.canShare({ files: [new File([new Uint8Array(1)], "x.png", { type: "image/png" })] });
  } catch { return false; }
};
const canCopy = () => typeof navigator !== "undefined" && !!navigator.clipboard?.write && typeof ClipboardItem !== "undefined";

/** `version` changes when the card's content does, so the picture is redrawn only then. */
export function ShareButtons({ title, filename, version, card }: { title: string; filename: string; version: string; card: ReactNode }) {
  const node = useRef<HTMLDivElement>(null);
  const png = useRef<Promise<Blob> | null>(null);
  const [mounted, setMounted] = useState(false);
  const [share, setShare] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  const box = useRef<HTMLDivElement>(null);
  // Only once the buttons are on screen (a hidden tab draws nothing), then for good.
  useEffect(() => {
    setShare(canShareFiles());
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") { setMounted(true); return; }
    const watch = new IntersectionObserver((seen) => {
      if (seen.some((e) => e.isIntersecting)) { setMounted(true); watch.disconnect(); }
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  // Draw the picture once the card is on the page (and again if it changes).
  useEffect(() => {
    if (!mounted || !node.current) return;
    const el = node.current;
    png.current = new Promise((resolve, reject) => requestAnimationFrame(() => makePng(el).then(resolve, reject)));
    png.current.catch(() => {});
  }, [mounted, version]);
  useEffect(() => {
    if (status === "idle") return;
    const t = setTimeout(() => setStatus("idle"), 2000);
    return () => clearTimeout(t);
  }, [status]);

  const blob = () => png.current ?? (png.current = node.current ? makePng(node.current) : Promise.reject(new Error("not ready")));

  const onShare = async () => {
    try {
      const file = new File([await blob()], filename, { type: "image/png" });
      await navigator.share({ files: [file], title });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setStatus("failed");
    }
  };

  const onCopy = async () => {
    try {
      if (canCopy()) {
        // Safari wants the clipboard write started inside the tap, with the picture still coming.
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob() })]);
        setStatus("copied");
        return;
      }
      const url = URL.createObjectURL(await blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: filename });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("saved");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <div className="share-buttons" ref={box}>
      <span className="share-status" role="status">
        {status === "copied" ? "Copied to clipboard" : status === "saved" ? "Downloaded" : status === "failed" ? "Couldn't copy, try again" : ""}
      </span>
      {share && (
        <button type="button" className="share-btn" onClick={onShare} aria-label={`Share ${title} as a picture`} title="Share">
          <ShareIcon />
        </button>
      )}
      <button type="button" className={`share-btn${status === "copied" || status === "saved" ? " done" : ""}`} onClick={onCopy} aria-label={`Copy ${title} as a picture`} title="Copy picture">
        {status === "copied" || status === "saved" ? <TickIcon /> : <CopyIcon />}
      </button>
      {mounted && createPortal(
        <div className="share-stage" aria-hidden="true">
          <div ref={node} className="share-card board-dark">
            {card}
            <p className="share-foot">raleighdarts.com</p>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/** The top of a shared picture: the league's logo, the title, and a line under it. */
export function ShareHead({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="share-head">
      <img src={`${import.meta.env.BASE_URL}rdl-logo-512.png`} alt="" width={46} height={46} />
      <div>
        <p className="share-title">{title}</p>
        {detail && <p className="share-detail">{detail}</p>}
      </div>
    </div>
  );
}

/**
 * Share or copy a message rather than a picture: the next match, whose map links must be tappable
 * (owner, 2026-11-20: a picture's links can't be tapped, and WhatsApp drops a picture sent with text).
 */
export function TextShareButtons({ title, text }: { title: string; text: string }) {
  const [share, setShare] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  useEffect(() => { setShare(typeof navigator !== "undefined" && !!navigator.share); }, []);
  useEffect(() => {
    if (status === "idle") return;
    const t = setTimeout(() => setStatus("idle"), 2000);
    return () => clearTimeout(t);
  }, [status]);
  const onShare = async () => {
    // Text only: given a title too, some apps paste it in front of the message (owner, 2026-11-21:
    // a stray space before the first team name); the message's first line already says it.
    try { await navigator.share({ text: text.trim() }); }
    catch (e) { if ((e as Error)?.name !== "AbortError") setStatus("failed"); }
  };
  const onCopy = async () => {
    try { await navigator.clipboard.writeText(text.trim()); setStatus("copied"); }
    catch { setStatus("failed"); }
  };
  return (
    <div className="share-buttons">
      <span className="share-status" role="status">{status === "copied" ? "Copied to clipboard" : status === "failed" ? "Couldn't copy, try again" : ""}</span>
      {share && <button type="button" className="share-btn" onClick={onShare} aria-label={`Share ${title}`} title="Share"><ShareIcon /></button>}
      <button type="button" className={`share-btn${status === "copied" ? " done" : ""}`} onClick={onCopy} aria-label={`Copy ${title}`} title="Copy">
        {status === "copied" ? <TickIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
      <path d="M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
      <path d="M15.5 5.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8.5a2 2 0 0 0 2 2h.5" />
    </svg>
  );
}

function TickIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
