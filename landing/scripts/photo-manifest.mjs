// Writes public/assets/photos/manifest.json listing the photo files, so the page
// knows which photos exist without probing for each one. Runs as part of `npm run build`.
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "assets", "photos");
const files = (await readdir(dir, { withFileTypes: true }))
  .filter((e) => e.isFile() && /\.(jpe?g|png|webp)$/i.test(e.name))
  .map((e) => e.name)
  .sort();

await writeFile(path.join(dir, "manifest.json"), JSON.stringify({ files }, null, 2) + "\n");
console.log(`photo manifest: ${files.length} file(s) – ${files.join(", ") || "none"}`);
