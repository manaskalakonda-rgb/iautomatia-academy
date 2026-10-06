// Writes public/assets/photos/manifest.json so the page knows which media files exist
// without probing for each one (no 404s). Runs as part of `npm run build`.
//   files: photos in public/assets/photos (placeholder slots, hero slideshow)
//   media: section background media in public/assets (hero-bg-*, lab-bg-*: .mp4 video + .jpg poster)
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const assets = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "assets");
const photosDir = path.join(assets, "photos");

const list = async (dir, pattern) =>
  (await readdir(dir, { withFileTypes: true }))
    .filter((e) => e.isFile() && pattern.test(e.name))
    .map((e) => e.name)
    .sort();

const files = await list(photosDir, /\.(jpe?g|png|webp)$/i);
const media = await list(assets, /^(hero|lab)-.*\.(jpe?g|png|webp|mp4|webm)$/i);

await writeFile(path.join(photosDir, "manifest.json"), JSON.stringify({ files, media }, null, 2) + "\n");
console.log(`photo manifest: ${files.length} photo(s), background media: ${media.join(", ") || "none"}`);
