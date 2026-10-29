import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { createApp } from "../src/server/app.ts";
import { FileEnquiryStore } from "../src/server/store.ts";

let base = "";
let dataDir = "";
let close: () => void = () => {};

const NOCODB_FORM = "https://app.nocodb.com/nc/form/5500795e-dd8f-4758-ae46-6c3625a4bdee";

// Two enquiries saved by the old built-in form.
const saved = [
  { id: "1", createdAt: "2026-10-01T10:00:00.000Z", name: "Ravi Kumar", phone: "+919502318939", email: "ravi@example.com", program: "Specialist", status: "Working professional" },
  { id: "2", createdAt: "2026-10-02T10:00:00.000Z", name: "Asha", phone: "+919502318940", email: "asha@example.com", program: "Foundation", status: "Student" },
];

before(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "iautomatia-test-"));
  await writeFile(path.join(dataDir, "enquiries.jsonl"), saved.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
  const app = createApp({
    publicDir: path.resolve("public"),
    store: new FileEnquiryStore(dataDir),
    adminToken: "secret-token",
  });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});

after(async () => {
  close();
  await rm(dataDir, { recursive: true, force: true });
});

test("serves the landing page with security headers", async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /iAutomatia/);
  assert.match(res.headers.get("content-security-policy") ?? "", /default-src 'self'/);
});

test("embeds the NocoDB registration form instead of the old form", async () => {
  const res = await fetch(`${base}/`);
  const html = await res.text();
  assert.match(html, new RegExp(`<iframe[^>]+src="${NOCODB_FORM}`));
  assert.match(html, /Open Registration Form/);
  assert.doesNotMatch(html, /id="enquiry-form"|<form\b/);
  assert.match(res.headers.get("content-security-policy") ?? "", /frame-src [^;]*https:\/\/app\.nocodb\.com/);
});

test("no longer accepts enquiries itself", async () => {
  const res = await fetch(`${base}/api/enquiries`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(res.status, 404);
});

test("lists past enquiries only with the admin token", async () => {
  assert.equal((await fetch(`${base}/api/enquiries`)).status, 401);
  const res = await fetch(`${base}/api/enquiries`, { headers: { Authorization: "Bearer secret-token" } });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { enquiries: { id: string }[] };
  assert.deepEqual(body.enquiries.map((e) => e.id), ["2", "1"]); // newest first
});
