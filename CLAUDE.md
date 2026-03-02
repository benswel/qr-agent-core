# QR Agent Core — Context for Claude

## On arrival

**Before starting any work**, read the project status memory file to get up to speed on what's been done and what's pending:
`~/.claude/projects/-Users-benjaminturc-Library-CloudStorage-GoogleDrive-benjamin-swel-fr-Mon-Drive-Claude-Code/memory/qr-for-agent-status.md`

**After pushing new features**, update that same memory file: move completed items, add new TODOs, bump versions if applicable.

## What is this project?

QR Agent Core is a **QR-as-a-Service API** built for AI agents. It lets agents create, update, and track dynamic QR codes programmatically. The QR image never changes — but its destination URL can be retargeted at any time.

**Live API:** deployed on Railway (Docker-based)
**MCP package:** `qr-for-agent` on npm (`packages/mcp/`)
**Marketing site:** separate repo `benswel/qr-for-agent-site`, deployed on Cloudflare Pages at qrforagent.com

## Architecture

```
src/
├── server.ts              # Entry point — starts Fastify on configured port
├── app.ts                 # App builder: CORS, Swagger, auth plugin, route registration
├── config/index.ts        # Env vars: PORT, HOST, BASE_URL, DATABASE_URL, SHORT_ID_LENGTH, ADMIN_SECRET
├── db/
│   ├── schema.ts          # Drizzle schema: api_keys, qr_codes, scan_events
│   ├── index.ts           # better-sqlite3 + drizzle-orm init (WAL mode)
│   └── migrate.ts         # Auto-migration on startup
├── shared/
│   ├── types.ts           # QrFormat, PaginatedResponse, Plan, PLAN_LIMITS, Fastify augmentation
│   └── errors.ts          # Structured errors with code + hint (agent-friendly)
├── modules/
│   ├── auth/              # X-API-Key auth plugin + key management
│   ├── qr/                # CRUD routes, service, schemas, custom SVG renderer
│   ├── redirect/          # GET /r/:shortId — public redirect + scan recording + webhook dispatch
│   ├── analytics/         # GET /api/analytics/:shortId — scan stats
│   ├── webhooks/          # Webhook CRUD + HMAC delivery + delivery logging
│   ├── stripe/            # Stripe Checkout, Customer Portal, webhook handler
│   ├── image/             # GET /i/:shortId — public QR image (cacheable)
│   └── well-known/        # /.well-known/ai-plugin.json + mcp.json
├── cli/                   # key:create, key:list scripts
packages/
└── mcp/                   # Standalone MCP server (published as qr-for-agent on npm)
```

## Tech stack

- **Runtime:** Node.js + TypeScript (ES2022, ESM)
- **Framework:** Fastify 5
- **Database:** SQLite via better-sqlite3 + Drizzle ORM
- **QR generation:** `qrcode` (matrix) + custom SVG renderer (dot/corner styles) + `sharp` (PNG conversion + logo)
- **Auth:** API key (`X-API-Key` header, `qr_` prefix + 32-char nanoid)
- **Validation:** Zod + Fastify JSON Schema
- **Tests:** Vitest (72 integration tests)
- **Deploy:** Docker + Railway

## Key commands

```bash
npm run dev            # Dev server with auto-reload (tsx watch)
npm run build          # TypeScript compilation
npm start              # Production server
npm test               # Run all tests
npm run db:generate    # Generate migration from schema changes
npm run db:migrate     # Apply migrations
npm run db:studio      # Open Drizzle Studio
npm run key:create     # Create new API key
npm run key:list       # List API keys
```

## Key design decisions

- **Multi-tenant isolation:** Every QR code is scoped to an `apiKeyId`. All queries filter by key.
- **Agent-friendly errors:** Every error has `{ error, code, hint }` — the hint tells agents how to fix the issue.
- **Dynamic links:** The QR image encodes the short URL (`/r/:shortId`), not the target. Changing target = same QR.
- **Fire-and-forget analytics:** Scan recording doesn't block the redirect response.
- **Fire-and-forget webhooks:** Webhook dispatch on scan is async, never blocks redirect.
- **Custom QR rendering:** Custom SVG renderer with dot styles (square, rounded, dots, classy-rounded), corner styles (square, extra-rounded, dot), colors, logo embedding. Style options stored as JSON in DB for regeneration.
- **Webhook security:** HMAC-SHA256 signatures on all webhook deliveries. Secret only returned at creation time.
- **Public vs authenticated:** `/r/`, `/i/`, `/health`, `/.well-known` are public. `/api/*` requires auth.
- **MCP server is standalone:** The `packages/mcp/` package is a thin HTTP client. It doesn't import API code.
- **Plan-based quotas:** API keys have a `plan` column (free/pro). Limits defined in `PLAN_LIMITS` (shared/types.ts). Free: 10 QR, 1K scans/month, 1 webhook. Pro: unlimited.
- **Scan grace period:** 3 tiers — normal (0→limit), grace (limit→limit+100, still recorded), hard cap (>limit+100, redirect works but scan not recorded). Redirect `/r/:shortId` NEVER blocks.
- **Self-service registration:** `POST /api/register` creates API key with email. Rate-limited to 3/hour/IP.

## Database tables

| Table | Purpose |
|-------|---------|
| `api_keys` | Key storage with label, email, plan (free/pro), Stripe IDs, expiration, last-used tracking |
| `qr_codes` | QR metadata, target URLs, format, style_options (JSON), tenant isolation via `api_key_id` |
| `scan_events` | Scan tracking: timestamp, user-agent, referer, IP |
| `webhooks` | Webhook endpoints per API key, HMAC secret, subscribed events |
| `webhook_deliveries` | Delivery log: status, response code, error messages |

## API endpoints

**Authenticated** (`X-API-Key` required):
- `POST /api/qr` — create QR code (with optional style: colors, dot_style, corner_style, logo_url)
- `GET /api/qr` — list (paginated)
- `GET /api/qr/:shortId` — get details
- `PATCH /api/qr/:shortId` — update target/label
- `DELETE /api/qr/:shortId` — delete + cascade analytics
- `GET /api/qr/:shortId/image` — download image (regenerated with stored style)
- `GET /api/analytics/:shortId` — scan stats
- `POST /api/webhooks` — register webhook endpoint (returns HMAC secret)
- `GET /api/webhooks` — list webhooks
- `DELETE /api/webhooks/:id` — delete webhook
- `GET /api/usage` — current usage and quota for authenticated key
- `POST /api/stripe/checkout` — create Stripe Checkout session to upgrade to Pro ($19/month)
- `POST /api/stripe/portal` — open Stripe Customer Portal for billing management

**Public** (no auth):
- `POST /api/register` — self-service API key registration (rate-limited)
- `POST /api/stripe/webhook` — Stripe webhook handler (signature-verified)
- `GET /r/:shortId` — redirect (records scan)
- `GET /i/:shortId` — serve QR image
- `GET /health` — health check
- `GET /documentation` — Swagger UI

**Admin** (`X-Admin-Secret` header required):
- `GET /api/admin/keys` — list all registered API keys
- `GET /api/admin/stats` — dashboard metrics (users by plan, QR codes, scans, webhooks, recent activity)

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `BASE_URL` | `http://localhost:3100` | Public URL for short links |
| `DATABASE_URL` | `./data/qr-agent.db` | SQLite file path |
| `SHORT_ID_LENGTH` | `8` | Short ID length |
| `ADMIN_SECRET` | *(none)* | Secret for admin endpoints (`X-Admin-Secret` header) |
| `STRIPE_SECRET_KEY` | *(none)* | Stripe API secret key (live or test) |
| `STRIPE_WEBHOOK_SECRET` | *(none)* | Stripe webhook signing secret |
| `STRIPE_PRICE_ID` | *(none)* | Stripe Price ID for Pro plan ($19/month) |

## Conventions

- Modules are self-contained in `src/modules/<name>/` with routes, service, and schemas
- Route files register themselves as Fastify plugins
- Use Zod for validation, derive JSON Schema for Swagger
- Errors use the structured format from `shared/errors.ts`
- Tests are integration tests that spin up the full app
