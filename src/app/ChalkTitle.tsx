/**
 * A title written on the board as the page opens: one letter at a time, with a stick of chalk
 * travelling along under the hand, then laid down after the last word. Follows line wraps.
 * With reduced motion (or before fonts load) it shows finished, the stick already resting.
 */
import { useEffect, useRef } from "react";
import { ChalkStick } from "./ui";

const LETTER_MS = 125; // time to chalk one letter
const SPACE_MS = 70; // lifting the chalk between words
const SETTLE_MS = 450; // laying the stick down

/**
 * Resolves once the opening screen (index.html) has finished: its logo has landed and `splash`
 * has come off <html>. Straight away when there was no opening screen. The chalk waits for this,
 * so the title isn't written behind the logo (owner, 2026-11-19).
 */
const splashGone = () => new Promise<void>((resolve) => {
  const html = document.documentElement;
  if (!html.classList.contains("splash")) return resolve();
  const watch = new MutationObserver(() => {
    if (!html.classList.contains("splash")) { watch.disconnect(); resolve(); }
  });
  watch.observe(html, { attributes: true, attributeFilter: ["class"] });
});

export function ChalkTitle({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const timings = [...text].reduce<{ start: number; ms: number }[]>((acc, ch) => {
    const prev = acc.at(-1);
    acc.push({ start: prev ? prev.start + prev.ms : 0, ms: ch === " " ? SPACE_MS : LETTER_MS });
    return acc;
  }, []);

  useEffect(() => {
    const h1 = ref.current;
    const stick = h1?.querySelector<SVGSVGElement>(".chalk-stick");
    if (!h1 || !stick) return;
    let cancelled = false;
    let anim: Animation | undefined;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

    Promise.all([document.fonts.ready, splashGone()]).then(() => {
      if (cancelled) return;
      const box = h1.getBoundingClientRect();
      const letters = [...h1.querySelectorAll<HTMLSpanElement>(".ch")].map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left - box.left, right: r.right - box.left, mid: r.top - box.top + r.height * 0.55, bottom: r.top - box.top + r.height * 0.8 };
      });
      const last = letters.at(-1);
      if (!last) return;
      // Resting: lying after the last letter, on the line.
      const rest = `translate(${last.right + 8}px, ${last.bottom - 6}px) rotate(-14deg)`;
      if (still || typeof stick.animate !== "function") {
        stick.style.transform = rest;
        stick.style.opacity = "1";
        h1.classList.add("done");
        return;
      }
      // Writing: held at a steep angle, the tip moving across each letter with a little bob.
      const total = timings.at(-1)!.start + timings.at(-1)!.ms;
      const end = total + SETTLE_MS;
      const held = (x: number, y: number) => `translate(${x}px, ${y}px) rotate(-58deg)`;
      const frames: Keyframe[] = [{ offset: 0, opacity: 0, transform: held(letters[0].left - 10, letters[0].mid - 14) }];
      letters.forEach((l, i) => {
        const t = timings[i];
        frames.push({ offset: t.start / end, opacity: 1, transform: held(l.left, l.mid + (i % 2 ? 3 : -3)) });
        frames.push({ offset: (t.start + t.ms) / end, opacity: 1, transform: held(l.right, l.mid + (i % 2 ? -3 : 3)) });
      });
      frames.push({ offset: 1, opacity: 1, transform: rest });
      h1.classList.add("go");
      anim = stick.animate(frames, { duration: end, easing: "linear", fill: "forwards" });
      anim.onfinish = () => h1.classList.add("done");
    });
    return () => { cancelled = true; anim?.cancel(); };
  }, [text]);

  return (
    <h1 ref={ref} className={className ? `chalk-title ${className}` : "chalk-title"} aria-label={text}>
      {[...text].map((ch, i) => (
        <span key={i} className="ch" aria-hidden="true" style={{ animationDelay: `${timings[i].start}ms`, animationDuration: `${timings[i].ms}ms` }}>
          {ch}
        </span>
      ))}
      <ChalkStick />
    </h1>
  );
}
