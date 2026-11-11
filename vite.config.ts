/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * The day the league data last changed, for the lander's "last updated" line. scripts/write.ts
 * stamps it in data/updated.json; failing that, the newest commit touching data/; failing that, today.
 */
function dataUpdated(): string {
  try {
    const { date } = JSON.parse(readFileSync("data/updated.json", "utf8"));
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  } catch { /* not written yet */ }
  try {
    const iso = execSync("git log -1 --format=%cI -- data/", { encoding: "utf8" }).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
  } catch { /* no git */ }
  return new Date().toISOString().slice(0, 10);
}

/**
 * On the local dev server only, a stand-in for the Vercel function api/views.ts: a page view
 * count kept in memory (starts at 1,000 so the number's look can be checked), so the counter shows.
 */
function devViews(): Plugin {
  let views = 1000;
  return {
    name: "dev-views",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/views", (req, res) => {
        if (req.method === "POST") views++;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ views }));
      });
    },
  };
}

// Served from the root of https://raleighdarts.com (Vercel).
export default defineConfig({
  plugins: [react(), devViews()],
  define: { __DATA_UPDATED__: JSON.stringify(dataUpdated()) },
  // Let an ngrok tunnel reach the dev and preview servers, for trying the site on a real phone.
  server: { allowedHosts: [".ngrok-free.app", ".ngrok.app"] },
  preview: { allowedHosts: [".ngrok-free.app", ".ngrok.app"] },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
