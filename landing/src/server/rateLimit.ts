// Minimal in-memory, per-IP rate limiter for the enquiry endpoint.
// Good enough for a single server; use a shared store (e.g. Redis) if you run several instances.
import type { NextFunction, Request, Response } from "express";

export function rateLimit(options: { windowMs: number; max: number }) {
  const hits = new Map<string, number[]>();

  // Drop stale entries now and then so the map does not grow without bound.
  setInterval(() => {
    const cutoff = Date.now() - options.windowMs;
    for (const [key, times] of hits) {
      const recent = times.filter((t) => t > cutoff);
      if (recent.length) hits.set(key, recent);
      else hits.delete(key);
    }
  }, options.windowMs).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => t > now - options.windowMs);

    if (recent.length >= options.max) {
      res.setHeader("Retry-After", String(Math.ceil(options.windowMs / 1000)));
      res.status(429).json({ message: "Too many requests. Please try again in a few minutes or message us on WhatsApp." });
      return;
    }

    recent.push(now);
    hits.set(key, recent);
    next();
  };
}
