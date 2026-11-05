import "@fontsource/cabin-sketch/latin-700.css";
import "@fontsource/patrick-hand/latin-400.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
// Listens for Android's install prompt from the very start (it can fire before the page draws).
import "./install";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
