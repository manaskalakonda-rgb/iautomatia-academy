// Vercel serverless entry: every /api/* request is routed here (see vercel.json).
// Uses the compiled server from dist/, produced by `npm run build`.
import { createApp } from "../dist/server/app.js";
import { createStore } from "../dist/server/store.js";

const { store } = createStore(process.env, "/tmp/data");

export default createApp({
  store,
  adminToken: process.env.ADMIN_TOKEN || undefined,
  trustProxy: true, // Vercel sits in front of the function and sets X-Forwarded-For
});
