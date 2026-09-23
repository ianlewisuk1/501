/**
 * npm run update: parse any newsletter in inbox/ that data/manifest.json hasn't seen.
 * Idempotent: with nothing new it writes nothing, so there is nothing to commit.
 *
 * Automatic fetching is blocked by the league site's Cloudflare challenge (see CLAUDE.md, section 3),
 * so new files arrive by hand in inbox/.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { parseFiles, processedFiles } from "./write";

const seen = processedFiles();
const fresh = readdirSync("inbox")
  .filter((f) => f.toLowerCase().endsWith(".xlsx") && !seen.has(f))
  .sort()
  .map((f) => join("inbox", f));

if (!fresh.length) console.log("Nothing new in inbox/.");
else parseFiles(fresh);
