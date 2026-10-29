# iAutomatia Academy – landing page

TypeScript + Node.js (Express 5). The server serves the page. Enquiries are collected by a NocoDB form embedded in the "Visit our Hyderabad Center" section.

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
npm test            # API and store tests
npm run typecheck
```

Open the site through the server (`http://localhost:3000`). Opening `public/index.html` straight from disk no longer works, because the page loads ES modules.

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
│   ├── client/main.ts   page interactions: menu, photo slots, slideshow, video
│   └── server/
│       ├── index.ts     entry point (reads environment variables)
│       ├── app.ts       Express app: security headers, API routes, static files
│       └── store.ts     reads enquiries saved by the old built-in form: file locally, Postgres when DATABASE_URL is set
├── test/                node:test suites (run with tsx)
└── data/                enquiries saved by the old built-in form (not committed)
```

## Deploy on Vercel

The repo is ready for Vercel: `vercel.json` builds the project, serves `public/` from Vercel's CDN and sends `/api/*` to the serverless function in `api/index.js`.

1. **Import the repo** – vercel.com → *Add New… → Project* → import `iautomatia-academy` from GitHub.
2. **Root Directory: `landing`** (click *Edit* next to Root Directory). Leave Framework Preset as *Other*; build settings come from `vercel.json`.
3. **Deploy.** The site goes live at `https://<project>.vercel.app`.
4. Optional: *Settings → Domains* to add your own domain (e.g. `academy.iautomatia.com`).

After that, every `git push` to `main` deploys automatically.

New enquiries go to NocoDB, so the site needs no database. To keep reading enquiries the old built-in form saved to Neon, leave `DATABASE_URL` connected and set `ADMIN_TOKEN` (*Settings → Environment Variables*, a long random value), then redeploy.

## API

| Method & path | What it does |
|---|---|
| `GET /api/enquiries` | Lists enquiries saved by the old built-in form, newest first. Only when `ADMIN_TOKEN` is set, and only with `Authorization: Bearer <ADMIN_TOKEN>`. |
| `GET /api/health` | Health check. |

Example: read the old enquiries

```bash
curl -H "Authorization: Bearer <your token>" http://localhost:3000/api/enquiries
```

## Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port to listen on |
| `DATABASE_URL` | *(unset)* | Postgres connection string (e.g. Neon). When set, old enquiries are read from the `enquiries` table instead of the file. `POSTGRES_URL` also works. |
| `DATA_DIR` | `landing/data` | Where `enquiries.jsonl` is read from when no database is set |
| `ADMIN_TOKEN` | *(unset)* | Enables `GET /api/enquiries`; use a long random value |

## Notes

- The registration form lives in NocoDB and is embedded with an iframe; the CSP allows it through `frame-src https://app.nocodb.com` (in both `src/server/app.ts` and `vercel.json`). A link under the form opens it in a new tab in case the embed is blocked.
- The iframe has a fixed height (`.enquiry-frame` in `styles.css`) because a cross-origin page can't size it; raise it if you add fields to the NocoDB form.
- Old enquiries contain personal data (name, phone, email). Keep `data/` out of git (already in `.gitignore`), back it up, and restrict who can read it.
