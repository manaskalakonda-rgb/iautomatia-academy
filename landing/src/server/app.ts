import { timingSafeEqual } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import { validateEnquiry } from "../shared/enquiry.js";
import { rateLimit } from "./rateLimit.js";
import type { EnquiryStore } from "./store.js";

export interface AppOptions {
  publicDir: string;
  store: EnquiryStore;
  /** When set, GET /api/enquiries returns saved enquiries to requests with "Authorization: Bearer <token>". */
  adminToken?: string;
  trustProxy?: boolean;
}

// The page loads its own scripts/styles/images plus the YouTube thumbnail and player.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: https://i.ytimg.com",
  "frame-src https://www.youtube-nocookie.com",
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
  if (options.trustProxy) app.set("trust proxy", 1);
  app.use(securityHeaders);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Lists the photos in public/assets/photos so the page only requests files that exist.
  app.get("/api/photos", async (_req, res, next) => {
    try {
      const entries = await readdir(path.join(options.publicDir, "assets", "photos"), { withFileTypes: true }).catch(() => []);
      const files = entries.filter((e) => e.isFile() && /\.(jpe?g|png|webp)$/i.test(e.name)).map((e) => e.name);
      res.setHeader("Cache-Control", "no-cache");
      res.json({ files });
    } catch (err) {
      next(err);
    }
  });

  app.post(
    "/api/enquiries",
    rateLimit({ windowMs: 10 * 60 * 1000, max: 5 }),
    express.json({ limit: "10kb" }),
    async (req, res, next) => {
      try {
        // Honeypot: real visitors never see or fill the "website" field.
        if (typeof req.body?.website === "string" && req.body.website.trim() !== "") {
          res.status(201).json({ ok: true });
          return;
        }

        const result = validateEnquiry(req.body);
        if (!result.ok) {
          res.status(400).json({ message: "Please correct the highlighted fields.", errors: result.errors });
          return;
        }

        const saved = await options.store.add(result.value);
        console.log(`[enquiry] ${saved.createdAt} ${saved.program} – ${saved.status}`);
        res.status(201).json({ ok: true, id: saved.id });
      } catch (err) {
        next(err);
      }
    },
  );

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

  app.use(express.static(options.publicDir, { extensions: ["html"], maxAge: "1h" }));

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
