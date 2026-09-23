/** npm run parse -- <file.xlsx> [...more]: parse newsletters into data/, even if already processed. */
import { parseFiles } from "./write";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: npm run parse -- <file.xlsx> [...]");
  process.exit(1);
}
parseFiles(files);
