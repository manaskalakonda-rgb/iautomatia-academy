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
├── src/
│   ├── client/main.ts   page interactions: menu, form, photo slots, slideshow, video
│   ├── shared/enquiry.ts  form validation used by both browser and server
│   └── server/
│       ├── index.ts     entry point (reads environment variables)
│       ├── app.ts       Express app: security headers, API routes, static files
│       ├── store.ts     saves enquiries to data/enquiries.jsonl
│       └── rateLimit.ts per-IP limit for the enquiry endpoint
├── test/                node:test suites (run with tsx)
└── data/                saved enquiries (generated, not committed)
```

## API

| Method & path | What it does |
|---|---|
| `POST /api/enquiries` | Validates and saves an enquiry (`name`, `phone`, `email`, `program`, `status`). Returns `201`, or `400` with field errors. Limited to 5 requests per 10 minutes per IP; a hidden honeypot field filters spam bots. |
| `GET /api/enquiries` | Lists saved enquiries, newest first. Only when `ADMIN_TOKEN` is set, and only with `Authorization: Bearer <ADMIN_TOKEN>`. |
| `GET /api/photos` | Lists the photo files in `public/assets/photos`, so the page only loads photos that exist. |
| `GET /api/health` | Health check. |

Example: read the enquiries

```bash
curl -H "Authorization: Bearer <your token>" http://localhost:3000/api/enquiries
```

## Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port to listen on |
| `DATA_DIR` | `landing/data` | Where `enquiries.jsonl` is written |
| `ADMIN_TOKEN` | *(unset)* | Enables `GET /api/enquiries`; use a long random value |
| `TRUST_PROXY` | `false` | Set to `true` behind a reverse proxy / load balancer so rate limiting sees the real visitor IP |

## Notes

- Enquiries contain personal data (name, phone, email). Keep `data/` out of git (already in `.gitignore`), back it up, and restrict who can read it.
- The JSON-lines file is fine for a single server. For multiple servers or more volume, replace `EnquiryStore` with a database or your CRM.
- Email/WhatsApp notifications for new enquiries are not set up yet.
