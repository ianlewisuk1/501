/**
 * "Add to your home screen". Android's Chrome offers its own install prompt through the
 * beforeinstallprompt event, which can fire before the page has drawn, so it's caught here as soon
 * as the app loads and kept until the button asks for it. iPhones have no such prompt: Safari only
 * adds a site from its Share menu, so there the button shows those steps instead.
 */
import { useEffect, useState, useSyncExternalStore } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const changed = () => { for (const fn of listeners) fn(); };

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep Chrome's own banner away; the button shows it when asked
    deferred = e as InstallPromptEvent;
    changed();
  });
  window.addEventListener("appinstalled", () => { installed = true; deferred = null; changed(); });
}

const subscribe = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };

/** Android's install prompt, when Chrome is offering one right now. */
export const useInstallPrompt = () => useSyncExternalStore(subscribe, () => deferred, () => null);
export const useInstalled = () => useSyncExternalStore(subscribe, () => installed, () => false);

/** Shows Android's install prompt; true if the visitor said yes. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null;
  changed();
  await e.prompt();
  return (await e.userChoice).outcome === "accepted";
}

export type Platform = "ios" | "android" | "other";

/**
 * Which phone this is, and whether the site is already running from the home screen. Worked out
 * after the first render (the server-rendered tests have no phone), so the first frame shows nothing.
 */
export function usePlatform(): { platform: Platform; standalone: boolean } | null {
  const [state, setState] = useState<{ platform: Platform; standalone: boolean } | null>(null);
  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const platform: Platform = ios ? "ios" : /Android/i.test(ua) ? "android" : "other";
    const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    setState({ platform, standalone });
  }, []);
  return state;
}
