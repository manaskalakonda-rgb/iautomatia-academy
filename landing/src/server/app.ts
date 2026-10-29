import { timingSafeEqual } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import type { EnquiryStore } from "./store.js";

export interface AppOptions {
  /** Serve the static site from here (local/Node hosting). On Vercel the CDN serves public/ instead. */
  publicDir?: string;
  store: EnquiryStore;
  /** When set, GET /api/enquiries returns saved enquiries to requests with "Authorization: Bearer <token>". */
  adminToken?: string;
}

// The page loads its own scripts/styles/images, the YouTube thumbnail and player, and the NocoDB registration form.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: https://i.ytimg.com",
  "frame-src https://www.youtube-nocookie.com https://app.nocodb.com",
  "connect-src 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
].join("; ");

function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
}

function tokenMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createApp(options: AppOptions): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // New enquiries go to the NocoDB form; this lists the ones the site's own form saved before.
  app.get("/api/enquiries", async (req, res, next) => {
    if (!options.adminToken) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    const auth = req.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!tokenMatches(token, options.adminToken)) {
      res.status(401).json({ message: "Unauthorised" });
      return;
    }
    try {
      res.json({ enquiries: await options.store.list() });
    } catch (err) {
      next(err);
    }
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  // No long-lived caching: file names are not versioned, so browsers revalidate (ETag) and see edits right away.
  if (options.publicDir) app.use(express.static(options.publicDir, { extensions: ["html"], maxAge: 0 }));

  // Malformed JSON and unexpected errors.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number }).status;
    if (status === 400 || status === 413) {
      res.status(status).json({ message: "Invalid request." });
      return;
    }
    console.error(err);
    res.status(500).json({ message: "Sorry, something went wrong. Please try again." });
  });

  return app;
}
