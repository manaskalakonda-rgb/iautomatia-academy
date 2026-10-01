import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { createApp } from "../src/server/app.ts";
import { EnquiryStore } from "../src/server/store.ts";

let base = "";
let dataDir = "";
let close: () => void = () => {};

before(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "iautomatia-test-"));
  const app = createApp({
    publicDir: path.resolve("public"),
    store: new EnquiryStore(dataDir),
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

const post = (body: unknown) =>
  fetch(`${base}/api/enquiries`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const valid = { name: "Ravi Kumar", phone: "9502318939", email: "ravi@example.com", program: "Specialist", status: "Working professional" };

test("serves the landing page with security headers", async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /iAutomatia/);
  assert.match(res.headers.get("content-security-policy") ?? "", /default-src 'self'/);
});

test("saves a valid enquiry", async () => {
  const res = await post(valid);
  assert.equal(res.status, 201);
  const saved = (await readFile(path.join(dataDir, "enquiries.jsonl"), "utf8")).trim().split("\n");
  assert.equal(saved.length, 1);
  assert.equal(JSON.parse(saved[0]).phone, "+919502318939");
});

test("rejects an invalid enquiry with field errors", async () => {
  const res = await post({ ...valid, email: "not-an-email" });
  assert.equal(res.status, 400);
  const body = (await res.json()) as { errors: Record<string, string> };
  assert.ok(body.errors.email);
});

test("silently drops honeypot submissions", async () => {
  const res = await post({ ...valid, website: "http://spam.example" });
  assert.equal(res.status, 201);
  const saved = (await readFile(path.join(dataDir, "enquiries.jsonl"), "utf8")).trim().split("\n");
  assert.equal(saved.length, 1);
});

test("returns 400 for malformed JSON", async () => {
  const res = await fetch(`${base}/api/enquiries`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad" });
  assert.equal(res.status, 400);
});

test("rate-limits repeated submissions", async () => {
  // 4 requests so far; the limit is 5 per 10 minutes per IP.
  assert.equal((await post(valid)).status, 201);
  assert.equal((await post(valid)).status, 429);
});

test("lists enquiries only with the admin token", async () => {
  assert.equal((await fetch(`${base}/api/enquiries`)).status, 401);
  const res = await fetch(`${base}/api/enquiries`, { headers: { Authorization: "Bearer secret-token" } });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { enquiries: unknown[] };
  assert.equal(body.enquiries.length, 2);
});

test("lists available photos", async () => {
  const res = await fetch(`${base}/api/photos`);
  const body = (await res.json()) as { files: string[] };
  assert.ok(body.files.includes("hero-jaka-cobot.jpg"));
  assert.ok(!body.files.includes("README.txt"));
});
