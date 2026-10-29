import assert from "node:assert/strict";
import { test } from "node:test";
import { FileEnquiryStore, PostgresEnquiryStore, createStore } from "../src/server/store.ts";

test("uses the file store locally", () => {
  assert.ok(createStore({}, "/tmp/x").store instanceof FileEnquiryStore);
});

test("uses Postgres when DATABASE_URL or POSTGRES_URL is set", () => {
  const url = "postgresql://user:pass@example.neon.tech/db?sslmode=require";
  assert.ok(createStore({ DATABASE_URL: url }, "/tmp/x").store instanceof PostgresEnquiryStore);
  assert.ok(createStore({ POSTGRES_URL: url }, "/tmp/x").store instanceof PostgresEnquiryStore);
});

test("on Vercel without a database, reading fails loudly", async () => {
  const { store } = createStore({ VERCEL: "1" }, "/tmp/x");
  await assert.rejects(store.list(), /DATABASE_URL/);
});

test("the file store reads nothing when no enquiries were saved", async () => {
  assert.deepEqual(await new FileEnquiryStore("/nonexistent-iautomatia-dir").list(), []);
});
