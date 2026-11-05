import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Unfolded } from "./Fold";

export interface Tab { id: string; label: string; show: boolean; body: ReactNode }

/** The tab in the link (?tab=fixtures), so a shared link opens on the same one. */
const tabFromUrl = (): string | null => (typeof location === "undefined" ? null : new URLSearchParams(location.search).get("tab"));

/**
 * Big chalk tabs (team and division pages): one section at a time, so the page stays about a screen
 * tall. Every panel is in the page (hidden ones too), so find-in-page and screen readers still work.
 */
export function Tabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const shown = tabs.filter((t) => t.show);
  const [picked, setPicked] = useState(() => tabFromUrl());
  const active = shown.find((t) => t.id === picked)?.id ?? shown[0]?.id;
  const pick = (id: string) => {
    setPicked(id);
    const url = new URL(location.href);
    if (id === shown[0]?.id) url.searchParams.delete("tab");
    else url.searchParams.set("tab", id);
    history.replaceState(null, "", url);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = shown.findIndex((t) => t.id === active);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
    if (next === null) return;
    const t = shown[(next + shown.length) % shown.length];
    pick(t.id);
    document.getElementById(`tab-${t.id}`)?.focus();
  };
  if (!shown.length) return null;
  return (
    <div className="tabs">
      <div className="tab-row" role="tablist" aria-label={label} onKeyDown={onKey}>
        {shown.map((t) => (
          <button key={t.id} id={`tab-${t.id}`} role="tab" aria-selected={t.id === active} aria-controls={`panel-${t.id}`}
            tabIndex={t.id === active ? 0 : -1} onClick={() => pick(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <Unfolded.Provider value={true}>
        {shown.map((t) => (
          <div key={t.id} id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`} hidden={t.id !== active} className="tab-panel">
            {t.body}
          </div>
        ))}
      </Unfolded.Provider>
    </div>
  );
}
