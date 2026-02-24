# QR Agent Core

QR-as-a-Service infrastructure for AI agents — generate, manage, and track dynamic QR codes programmatically.

QR codes point to short URLs that you can retarget at any time. The QR image never changes, but scanning it goes to the new destination. Built for AI agents with MCP support, REST API, and multi-tenant isolation.

## Features

- **Dynamic QR codes** — change the destination URL without regenerating the image
- **SVG & PNG** — vector and bitmap output
- **Scan analytics** — track scans with timestamps, user agents, and referrers
- **Multi-tenant** — each API key sees only its own QR codes
- **MCP server** — [`qr-for-agent`](https://www.npmjs.com/package/qr-for-agent) npm package for Claude Desktop, Cursor, etc.
- **OpenAPI docs** — Swagger UI at `/documentation`
- **AI-discoverable** — `/.well-known/ai-plugin.json` and `/.well-known/mcp.json`
- **SQLite** — zero-config database, single file

## Quick Start

```bash
git clone https://github.com/benswel/qr-agent-core.git
cd qr-agent-core
npm install
npm run dev
```

On first startup, an API key is auto-generated and printed to the console. Use it to create your first QR code:

```bash
curl -X POST http://localhost:3100/api/qr \
  -H "Content-Type: application/json" \
  -H "X-API-Key: qr_YOUR_KEY_HERE" \
  -d '{"target_url": "https://example.com", "label": "My first QR"}'
```

## API Endpoints

### QR Code Management (requires `X-API-Key`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/qr` | Create a new QR code |
| `GET` | `/api/qr` | List all QR codes (paginated) |
| `GET` | `/api/qr/:shortId` | Get QR code details |
| `PATCH` | `/api/qr/:shortId` | Update target URL or label |
| `DELETE` | `/api/qr/:shortId` | Delete QR code and analytics |
| `GET` | `/api/qr/:shortId/image` | Download QR image |

### Analytics (requires `X-API-Key`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/analytics/:shortId` | Scan count and recent events |

### Public Endpoints (no auth)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/r/:shortId` | Redirect to target URL (records scan) |
| `GET` | `/i/:shortId` | Serve QR image (cacheable) |
| `GET` | `/health` | Health check |
| `GET` | `/documentation` | Swagger UI |
| `GET` | `/.well-known/ai-plugin.json` | AI plugin manifest |
| `GET` | `/.well-known/mcp.json` | MCP discovery manifest |

### Example: Create a QR code

```bash
curl -X POST http://localhost:3100/api/qr \
  -H "Content-Type: application/json" \
  -H "X-API-Key: qr_YOUR_KEY" \
  -d '{"target_url": "https://example.com", "format": "svg"}'
```

Response:

```json
{
  "id": 1,
  "short_id": "wkQ5W-fm",
  "short_url": "http://localhost:3100/r/wkQ5W-fm",
  "target_url": "https://example.com",
  "format": "svg",
  "image_data": "<svg>...</svg>",
  "created_at": "2025-02-24T10:00:00.000Z"
}
```

### Example: Update destination (dynamic link)

```bash
curl -X PATCH http://localhost:3100/api/qr/wkQ5W-fm \
  -H "Content-Type: application/json" \
  -H "X-API-Key: qr_YOUR_KEY" \
  -d '{"target_url": "https://new-destination.com"}'
```

## Authentication

All `/api/*` endpoints require an `X-API-Key` header.

- **Format**: `qr_` + 32-character random string
- **Auto-generated**: on first startup if no keys exist
- **Multi-tenant**: each key only sees its own QR codes
- **Create a key**: `npm run key:create "my-label"`
- **List keys**: `npm run key:list`

Public endpoints (`/r/*`, `/i/*`, `/health`, `/documentation`, `/.well-known/*`) don't require auth.

## MCP Server

The MCP server is published as [`qr-for-agent`](https://www.npmjs.com/package/qr-for-agent) on npm. It lets AI agents manage QR codes as native tools.

```bash
npx qr-for-agent
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "qr-for-agent": {
      "command": "npx",
      "args": ["-y", "qr-for-agent"],
      "env": {
        "API_KEY": "your-api-key",
        "BASE_URL": "https://your-instance.example.com"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "qr-for-agent": {
      "command": "npx",
      "args": ["-y", "qr-for-agent"],
      "env": {
        "API_KEY": "your-api-key",
        "BASE_URL": "https://your-instance.example.com"
      }
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `create_qr_code` | Create a new dynamic QR code (SVG or PNG) |
| `get_qr_code` | Get QR code details by short ID |
| `update_qr_destination` | Change where a QR code redirects |
| `list_qr_codes` | List all QR codes with pagination |
| `delete_qr_code` | Delete a QR code and its analytics |
| `get_qr_analytics` | Get scan count and recent events |

## Configuration

Copy `.env.example` to `.env` and edit:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `BASE_URL` | `http://localhost:3100` | Public URL (used in short URLs) |
| `DATABASE_URL` | `./data/qr-agent.db` | SQLite file path |
| `SHORT_ID_LENGTH` | `8` | Length of generated short IDs |

## Database

SQLite with [Drizzle ORM](https://orm.drizzle.team/). Three tables:

- **`api_keys`** — API key storage with labels and expiration
- **`qr_codes`** — QR code metadata, target URLs, tenant isolation via `api_key_id`
- **`scan_events`** — scan tracking with timestamps, user agents, IPs

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

The project includes `railway.toml` and a multi-stage `Dockerfile`. Deploy by connecting your GitHub repo to Railway — it will build and deploy automatically with health checks on `/health`.

## Tests

37+ integration tests covering CRUD, auth, multi-tenant isolation, redirects, and analytics.

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
