/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { handlePhotos } from "./src/photos/server";
import { memoryStores } from "./src/photos/store";

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

/**
 * On the local dev server only, a stand-in for api/photos.ts: the same handler, with photos kept in
 * memory (gone on restart) and the admin passphrase "dev". The photo word is this week's issue code.
 */
function devPhotos(): Plugin {
  const deps = {
    ...memoryStores(),
    check: existsSync("data/photo-check.json") ? JSON.parse(readFileSync("data/photo-check.json", "utf8")) : { words: [], bars: {} },
    adminPassphrase: "dev",
  };
  return {
    name: "dev-photos",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/photos", async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
        const request = new Request(`http://localhost${req.originalUrl ?? req.url}`, {
          method: req.method, headers, body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks),
        });
        const response = await handlePhotos(request, deps);
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await response.arrayBuffer()));
      });
    },
  };
}

// Served from the root of https://raleighdarts.com (Vercel).
export default defineConfig({
  plugins: [react(), devViews(), devPhotos()],
  define: { __DATA_UPDATED__: JSON.stringify(dataUpdated()) },
  // Let an ngrok tunnel reach the dev and preview servers, for trying the site on a real phone.
  server: { allowedHosts: [".ngrok-free.app", ".ngrok.app"] },
  preview: { allowedHosts: [".ngrok-free.app", ".ngrok.app"] },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
