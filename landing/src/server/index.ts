// Entry point: node dist/server/index.js (or `npm run dev` with tsx).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { EnquiryStore } from "./store.js";

// Same depth from src/server (dev) and dist/server (build), so these resolve in both.
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");

const port = Number(process.env.PORT ?? 3000);
const dataDir = process.env.DATA_DIR ?? path.join(root, "data");

const app = createApp({
  publicDir: path.join(root, "public"),
  store: new EnquiryStore(dataDir),
  adminToken: process.env.ADMIN_TOKEN || undefined,
  trustProxy: process.env.TRUST_PROXY === "true",
});

app.listen(port, () => {
  console.log(`iAutomatia Academy site running at http://localhost:${port}`);
  console.log(`Enquiries are saved to ${path.join(dataDir, "enquiries.jsonl")}`);
});
