# iAutomatia Academy – landing page

TypeScript + Node.js (Express 5). The server serves the page and handles the "Book a free demo" enquiry form.

## Run it

Needs Node.js 20 or newer.

```bash
cd landing
npm install
npm run build     # compiles src/ -> public/js (browser) and dist/ (server)
npm start         # http://localhost:3000
```

While editing:

```bash
npm run dev         # builds the browser code once, then runs the server and restarts it on changes
npm run dev:client  # (second terminal) recompiles the browser code on changes
npm test            # validation + API tests
npm run typecheck
```

Open the site through the server (`http://localhost:3000`). Opening `public/index.html` straight from disk no longer works, because the page loads ES modules and calls the API.

## Project layout

```
landing/
├── public/              static site served as-is
│   ├── index.html
│   ├── styles.css
│   ├── assets/          logo, favicon, photos (see assets/photos/README.txt)
│   └── js/              compiled browser code (generated, not committed)
├── api/index.js         Vercel serverless entry (uses dist/)
├── scripts/             build helpers (photo manifest)
├── vercel.json          Vercel build, routing and security headers
├── src/
│   ├── client/main.ts   page interactions: menu, form, photo slots, slideshow, video
│   ├── shared/enquiry.ts  form validation used by both browser and server
│   └── server/
│       ├── index.ts     entry point (reads environment variables)
│       ├── app.ts       Express app: security headers, API routes, static files
│       ├── store.ts     saves enquiries: file locally, Postgres when DATABASE_URL is set
│       └── rateLimit.ts per-IP limit for the enquiry endpoint
├── test/                node:test suites (run with tsx)
└── data/                saved enquiries (generated, not committed)
```

## Deploy on Vercel

The repo is ready for Vercel: `vercel.json` builds the project, serves `public/` from Vercel's CDN and sends `/api/*` to the serverless function in `api/index.js`.

1. **Import the repo** – vercel.com → *Add New… → Project* → import `iautomatia-academy` from GitHub.
2. **Root Directory: `landing`** (click *Edit* next to Root Directory). Leave Framework Preset as *Other*; build settings come from `vercel.json`.
3. **Deploy.** The site goes live at `https://<project>.vercel.app`.
4. **Connect a database** (needed to save enquiries – Vercel functions cannot keep files): project → *Storage* → *Create Database* → **Neon (Postgres)** → connect it to the project. This adds `DATABASE_URL`; the `enquiries` table is created automatically on the first enquiry.
5. **Set `ADMIN_TOKEN`** – project → *Settings → Environment Variables* → add a long random value (lets your team read enquiries).
6. **Redeploy** (*Deployments → ⋯ → Redeploy*) so the new variables take effect.
7. Optional: *Settings → Domains* to add your own domain (e.g. `academy.iautomatia.com`).

After that, every `git push` to `main` deploys automatically.

On Vercel the rate limit is kept per function instance, so it is a soft limit; the honeypot and validation still apply.

## API

| Method & path | What it does |
|---|---|
| `POST /api/enquiries` | Validates and saves an enquiry (`name`, `phone`, `email`, `program`, `status`). Returns `201`, or `400` with field errors. Limited to 5 requests per 10 minutes per IP; a hidden honeypot field filters spam bots. |
| `GET /api/enquiries` | Lists saved enquiries, newest first. Only when `ADMIN_TOKEN` is set, and only with `Authorization: Bearer <ADMIN_TOKEN>`. |
| `GET /api/health` | Health check. |

Example: read the enquiries

```bash
curl -H "Authorization: Bearer <your token>" http://localhost:3000/api/enquiries
```

## Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port to listen on |
| `DATABASE_URL` | *(unset)* | Postgres connection string (e.g. Neon). When set, enquiries go to the `enquiries` table instead of the file. `POSTGRES_URL` also works. |
| `DATA_DIR` | `landing/data` | Where `enquiries.jsonl` is written when no database is set |
| `ADMIN_TOKEN` | *(unset)* | Enables `GET /api/enquiries`; use a long random value |
| `TRUST_PROXY` | `false` | Set to `true` behind a reverse proxy / load balancer so rate limiting sees the real visitor IP |

## Notes

- Enquiries contain personal data (name, phone, email). Keep `data/` out of git (already in `.gitignore`), back it up, and restrict who can read it.
- Locally, enquiries go to `data/enquiries.jsonl`; set `DATABASE_URL` to use Postgres anywhere.
- Email/WhatsApp notifications for new enquiries are not set up yet.
