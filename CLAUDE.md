# QR Agent Core — Context for Claude

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
├── config/index.ts        # Env vars: PORT, HOST, BASE_URL, DATABASE_URL, SHORT_ID_LENGTH
├── db/
│   ├── schema.ts          # Drizzle schema: api_keys, qr_codes, scan_events
│   ├── index.ts           # better-sqlite3 + drizzle-orm init (WAL mode)
│   └── migrate.ts         # Auto-migration on startup
├── shared/
│   ├── types.ts           # QrFormat, PaginatedResponse, Fastify augmentation
│   └── errors.ts          # Structured errors with code + hint (agent-friendly)
├── modules/
│   ├── auth/              # X-API-Key auth plugin + key management
│   ├── qr/                # CRUD routes, service, schemas, renderer (SVG/PNG)
│   ├── redirect/          # GET /r/:shortId — public redirect + scan recording
│   ├── analytics/         # GET /api/analytics/:shortId — scan stats
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
- **QR generation:** `qrcode` npm package (SVG + PNG)
- **Auth:** API key (`X-API-Key` header, `qr_` prefix + 32-char nanoid)
- **Validation:** Zod + Fastify JSON Schema
- **Tests:** Vitest (37+ integration tests)
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
- **Public vs authenticated:** `/r/`, `/i/`, `/health`, `/.well-known` are public. `/api/*` requires auth.
- **MCP server is standalone:** The `packages/mcp/` package is a thin HTTP client. It doesn't import API code.

## Database tables

| Table | Purpose |
|-------|---------|
| `api_keys` | Key storage with label, expiration, last-used tracking |
| `qr_codes` | QR metadata, target URLs, format, tenant isolation via `api_key_id` |
| `scan_events` | Scan tracking: timestamp, user-agent, referer, IP |

## API endpoints

**Authenticated** (`X-API-Key` required):
- `POST /api/qr` — create QR code
- `GET /api/qr` — list (paginated)
- `GET /api/qr/:shortId` — get details
- `PATCH /api/qr/:shortId` — update target/label
- `DELETE /api/qr/:shortId` — delete + cascade analytics
- `GET /api/qr/:shortId/image` — download image
- `GET /api/analytics/:shortId` — scan stats

**Public** (no auth):
- `GET /r/:shortId` — redirect (records scan)
- `GET /i/:shortId` — serve QR image
- `GET /health` — health check
- `GET /documentation` — Swagger UI

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `BASE_URL` | `http://localhost:3100` | Public URL for short links |
| `DATABASE_URL` | `./data/qr-agent.db` | SQLite file path |
| `SHORT_ID_LENGTH` | `8` | Short ID length |

## Conventions

- Modules are self-contained in `src/modules/<name>/` with routes, service, and schemas
- Route files register themselves as Fastify plugins
- Use Zod for validation, derive JSON Schema for Swagger
- Errors use the structured format from `shared/errors.ts`
- Tests are integration tests that spin up the full app
