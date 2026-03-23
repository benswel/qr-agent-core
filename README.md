# QR Agent Core

[![benswel/qr-agent-core MCP server](https://glama.ai/mcp/servers/benswel/qr-agent-core/badges/score.svg)](https://glama.ai/mcp/servers/benswel/qr-agent-core)

QR-as-a-Service API built for AI agents. Create, update, and track dynamic QR codes programmatically via REST API or MCP (37 tools).

QR codes point to short URLs (`/r/:shortId`) that you can retarget at any time — the QR image never changes, but scanning it goes to the new destination. Multi-tenant by design, with full scan analytics.

**Live API:** [api.qragentcore.com](https://api.qragentcore.com) &nbsp;|&nbsp; **Site:** [qrforagent.com](https://qrforagent.com) &nbsp;|&nbsp; **MCP:** [`qr-for-agent`](https://www.npmjs.com/package/qr-for-agent)

## Features

- **Dynamic QR codes** — change the destination URL without regenerating the image
- **11 QR types** — URL, vCard, WiFi, Email, SMS, Phone, Event, Text, Location, Social, App Store
- **Custom styling** — dot shapes (square, rounded, dots, classy-rounded), corner styles, colors, gradients, logo embedding, frames with CTA text
- **SVG & PNG** — vector and bitmap output
- **Enriched analytics** — device type, browser, OS, country, city, referrer, scans-by-day
- **Real-time webhooks** — HMAC-SHA256 signed payloads with delivery logging
- **UTM tracking** — auto-append UTM parameters to redirect URLs
- **GTM support** — intermediate page with Google Tag Manager snippets
- **Conditional redirects** — route by device, OS, country, language, time range, or A/B split
- **Custom domains** — Pro users brand short URLs with their own domain (`qr.yourbrand.com/r/abc123`)
- **Expiration & scheduling** — auto-expire QR codes or schedule URL swaps
- **Conversion tracking** — tracking pixel + API for post-scan events (purchases, signups) with ROI analytics
- **Frames & templates** — decorative frames around QR codes (banner_top, banner_bottom, rounded) with CTA text
- **Bulk operations** — create, update, or delete up to 50 QR codes per request, or up to 500 via CSV upload (Pro)
- **Multi-tenant** — each API key sees only its own data
- **MCP server** — [`qr-for-agent`](https://www.npmjs.com/package/qr-for-agent) with 37 tools for Claude Desktop, Cursor, etc.
- **Plan-based quotas** — Free (10 QR, 1K scans/month) and Pro ($19/month, unlimited)
- **Self-service registration** — `POST /api/register` with email, no credit card
- **Stripe integration** — checkout, billing portal, webhook-driven plan management
- **OpenAPI docs** — Swagger UI at `/documentation`
- **AI-discoverable** — `/.well-known/ai-plugin.json` and `/.well-known/mcp.json`
- **Open source** — MIT license, self-hostable via Docker

## Quick Start

```bash
git clone https://github.com/benswel/qr-agent-core.git
cd qr-agent-core
npm install
npm run dev
```

On first startup, an API key is auto-generated and printed to the console.

```bash
curl -X POST http://localhost:3100/api/qr \
  -H "Content-Type: application/json" \
  -H "X-API-Key: qr_YOUR_KEY_HERE" \
  -d '{"target_url": "https://example.com", "label": "My first QR"}'
```

## API Endpoints

### QR Code Management (`X-API-Key` required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/qr` | Create a QR code (11 types, custom styling) |
| `GET` | `/api/qr` | List all QR codes (paginated) |
| `GET` | `/api/qr/:shortId` | Get QR code details |
| `PATCH` | `/api/qr/:shortId` | Update target URL, label, UTM, GTM, redirect rules |
| `DELETE` | `/api/qr/:shortId` | Delete QR code and its analytics |
| `GET` | `/api/qr/:shortId/image` | Download QR image (regenerated with stored style) |
| `POST` | `/api/qr/bulk` | Create up to 50 QR codes (all-or-nothing) |
| `PATCH` | `/api/qr/bulk` | Update up to 50 QR codes (partial success) |
| `DELETE` | `/api/qr/bulk` | Delete up to 50 QR codes (partial success) |
| `POST` | `/api/qr/bulk/csv` | Create up to 500 QR codes from CSV (Pro only) |

### Analytics (`X-API-Key` required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/analytics/:shortId` | Scan stats with device, browser, OS, country, city breakdowns + conversions |

### Conversions (`X-API-Key` required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/conversions` | Record a conversion event for a QR code you own |
| `GET` | `/api/conversions/:shortId` | Get conversion stats (totals, by_event, by_day, recent) |

### Webhooks (`X-API-Key` required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/webhooks` | Register webhook endpoint (returns HMAC secret) |
| `GET` | `/api/webhooks` | List all webhooks |
| `DELETE` | `/api/webhooks/:id` | Delete a webhook |

### Custom Domain (`X-API-Key` required, Pro only)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/domain` | Get current custom domain and DNS status |
| `PUT` | `/api/domain` | Set custom domain |
| `DELETE` | `/api/domain` | Remove custom domain |

### Account (`X-API-Key` required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/usage` | Current usage and quota |
| `POST` | `/api/stripe/checkout` | Create Stripe Checkout session (upgrade to Pro) |
| `POST` | `/api/stripe/portal` | Open Stripe billing portal |

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/register` | Self-service API key registration (rate-limited) |
| `GET` | `/r/:shortId` | Redirect to target URL (records scan) |
| `GET` | `/t/:shortId` | Conversion tracking pixel (returns 1×1 GIF) |
| `GET` | `/i/:shortId` | Serve QR image (cacheable) |
| `GET` | `/health` | Health check |
| `GET` | `/documentation` | Swagger UI |
| `GET` | `/.well-known/ai-plugin.json` | AI plugin manifest |
| `GET` | `/.well-known/mcp.json` | MCP discovery manifest |

### Admin (`X-Admin-Secret` header required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/keys` | List all registered API keys |
| `GET` | `/api/admin/stats` | Dashboard metrics |

## Authentication

All `/api/*` endpoints require an `X-API-Key` header.

- **Format**: `qr_` + 32-character random string
- **Auto-generated**: on first startup if no keys exist
- **Multi-tenant**: each key only sees its own QR codes
- **Create a key**: `npm run key:create "my-label"`
- **List keys**: `npm run key:list`

Public endpoints (`/r/*`, `/i/*`, `/health`, `/documentation`, `/.well-known/*`) don't require auth.

## MCP Server

Published as [`qr-for-agent`](https://www.npmjs.com/package/qr-for-agent) on npm. 37 tools for AI agents to manage QR codes natively.

```bash
npx qr-for-agent
```

### Claude Desktop / Cursor

Add to your MCP config (`claude_desktop_config.json` or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "qr-for-agent": {
      "command": "npx",
      "args": ["-y", "qr-for-agent"],
      "env": {
        "API_KEY": "your-api-key",
        "BASE_URL": "https://api.qragentcore.com"
      }
    }
  }
}
```

### Available Tools (37)

| Tool | Description |
|------|-------------|
| `create_qr_code` | Create a URL QR code with optional custom styling |
| `get_qr_code` | Get QR code details by short ID |
| `update_qr_destination` | Change where a QR code redirects |
| `list_qr_codes` | List all QR codes with pagination |
| `delete_qr_code` | Delete a QR code and its analytics |
| `get_qr_analytics` | Get scan stats and breakdowns |
| `bulk_create_qr_codes` | Create up to 50 QR codes at once |
| `bulk_update_qr_codes` | Update up to 50 QR codes at once |
| `bulk_delete_qr_codes` | Delete up to 50 QR codes at once |
| `create_vcard_qr` | Create a vCard contact QR code |
| `create_wifi_qr` | Create a WiFi credentials QR code |
| `create_email_qr` | Create an email (mailto:) QR code |
| `create_sms_qr` | Create an SMS QR code |
| `create_phone_qr` | Create a phone call QR code |
| `create_event_qr` | Create a calendar event QR code |
| `create_text_qr` | Create a plain text QR code |
| `create_location_qr` | Create a geo-location QR code |
| `create_social_qr` | Create a social media links QR code |
| `create_app_store_qr` | Create a smart app store redirect QR code |
| `update_vcard_qr` | Update a vCard QR code |
| `update_wifi_qr` | Update a WiFi QR code |
| `update_social_qr` | Update a social media QR code |
| `update_app_store_qr` | Update an app store QR code |
| `create_webhook` | Register a webhook endpoint |
| `list_webhooks` | List all registered webhooks |
| `delete_webhook` | Delete a webhook |
| `register` | Register for an API key |
| `get_usage` | Get current usage and quota |
| `upgrade_to_pro` | Create a Stripe Checkout session |
| `manage_billing` | Open Stripe billing portal |
| `set_utm_params` | Set UTM tracking parameters on a QR code |
| `set_redirect_rules` | Set conditional redirect rules on a QR code |
| `set_custom_domain` | Set or remove custom domain (Pro) |
| `get_custom_domain` | Get current custom domain and DNS status |
| `bulk_create_from_csv` | Create up to 500 QR codes from CSV data (Pro) |
| `record_conversion` | Record a post-scan conversion event |
| `get_conversions` | Get conversion stats for a QR code |

## Configuration

Copy `.env.example` to `.env` and edit:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `BASE_URL` | `http://localhost:3100` | Public URL (used in short URLs) |
| `DATABASE_URL` | `./data/qr-agent.db` | SQLite file path |
| `SHORT_ID_LENGTH` | `8` | Length of generated short IDs |
| `ADMIN_SECRET` | *(none)* | Secret for admin endpoints (`X-Admin-Secret` header) |
| `STRIPE_SECRET_KEY` | *(none)* | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | *(none)* | Stripe webhook signing secret |
| `STRIPE_PRICE_ID` | *(none)* | Stripe Price ID for Pro plan |

## Database

SQLite with [Drizzle ORM](https://orm.drizzle.team/). Six tables:

- **`api_keys`** — key storage with label, email, plan (free/pro), Stripe IDs, custom domain
- **`qr_codes`** — QR metadata, target URLs, type/type_data, style options, UTM, GTM, redirect rules, expiration/scheduling
- **`scan_events`** — scan tracking: timestamp, user-agent, referer, IP, device, browser, OS, country, city
- **`webhooks`** — webhook endpoints per API key, HMAC secret, subscribed events
- **`webhook_deliveries`** — delivery log: status, response code, error messages
- **`conversion_events`** — conversion tracking: event name, value, metadata, referer, IP, timestamp

```bash
npm run db:generate   # Generate migration from schema changes
npm run db:migrate    # Apply pending migrations
npm run db:studio     # Open Drizzle Studio (web UI)
```

Migrations run automatically on server startup.

## Deployment

### Docker

```bash
docker compose up -d
```

The database is persisted in a Docker volume.

### Railway

The project includes `railway.toml` and a multi-stage `Dockerfile`. Connect your GitHub repo to Railway — it builds and deploys automatically with health checks on `/health`.

## Tests

195 integration tests covering all endpoints, auth, multi-tenant isolation, QR types, webhooks, bulk operations, custom domains, frames, conversions, CSV upload, and analytics.

```bash
npm test           # Run all tests
npm run test:watch # Watch mode
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with auto-reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production server |
| `npm test` | Run test suite |
| `npm run test:watch` | Tests in watch mode |
| `npm run key:create` | Create API key |
| `npm run key:list` | List API keys |
| `npm run db:generate` | Generate migration |
| `npm run db:migrate` | Run migrations |
| `npm run db:studio` | Open Drizzle Studio |

## License

MIT
