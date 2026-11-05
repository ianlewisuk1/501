import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Keeps a long section folded behind one big button so the page stays short. Folded content
 * is still in the page (just hidden), and "Hide" sits at the bottom, where the reader is.
 */
export function Fold({ show, hide, summary, children }: { show: string; hide: string; summary?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (useContext(Unfolded)) return <>{children}</>;
  return (
    <>
      {!open && summary && <p className="muted">{summary}</p>}
      <div hidden={!open}>{children}</div>
      <button className="showall" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? hide : show}</button>
    </>
  );
}

/** Inside a tab the reader has already asked for the section, so folds there open flat. */
export const Unfolded = createContext(false);

/**
 * A section's heading. Inside a tab the tab already names the section, so the title is kept for
 * screen readers only and any detail ("17 pts clear of 2nd") shows as a short line instead.
 */
export function SectionHead({ id, title, detail }: { id: string; title: ReactNode; detail?: ReactNode }) {
  if (useContext(Unfolded)) {
    return (
      <>
        <h2 id={id} className="sr-only">{title}</h2>
        {detail && <p className="tab-note">{detail}</p>}
      </>
    );
  }
  return <h2 id={id}>{title} {detail && <span className="muted">{detail}</span>}</h2>;
}
