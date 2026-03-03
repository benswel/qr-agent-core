# qr-for-agent

MCP server for dynamic QR codes — create, style, track, and update QR codes from any AI agent.

**37 tools** for [Claude Desktop](https://claude.ai/download), [Cursor](https://cursor.com), [Windsurf](https://codeium.com/windsurf), [VS Code](https://code.visualstudio.com), and any [MCP](https://modelcontextprotocol.io/)-compatible client.

**Website:** [qrforagent.com](https://qrforagent.com) &nbsp;|&nbsp; **Docs:** [qrforagent.com/docs](https://qrforagent.com/docs) &nbsp;|&nbsp; **GitHub:** [benswel/qr-agent-core](https://github.com/benswel/qr-agent-core)

## Why QR for Agent?

- **Dynamic** — change the destination URL anytime, the QR image stays the same
- **11 QR types** — URL, vCard, WiFi, Email, SMS, Phone, Event, Text, Location, Social, App Store
- **Custom styling** — dot shapes, corner styles, colors, gradients, logos, frames with CTA text
- **Analytics** — scan tracking with device, browser, OS, country, city breakdowns
- **Webhooks** — real-time scan notifications with HMAC-SHA256 signatures
- **Conversion tracking** — tracking pixel + API for post-scan events
- **Free tier** — 10 QR codes, 1K scans/month, no credit card required

## Quick Start

```bash
npx qr-for-agent --api-key YOUR_KEY
```

No API key yet? Get one free at [qrforagent.com/get-started](https://qrforagent.com/get-started) or ask the agent to `register` with your email.

## Configuration

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "qr-for-agent": {
      "command": "npx",
      "args": ["-y", "qr-for-agent"],
      "env": {
        "API_KEY": "qr_your-api-key"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add qr-for-agent -- npx -y qr-for-agent
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
        "API_KEY": "qr_your-api-key"
      }
    }
  }
}
```

### VS Code

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "qr-for-agent": {
      "command": "npx",
      "args": ["-y", "qr-for-agent"],
      "env": {
        "API_KEY": "qr_your-api-key"
      }
    }
  }
}
```

### Environment Variables

| Variable   | Required | Default                  | Description                          |
| ---------- | -------- | ------------------------ | ------------------------------------ |
| `API_KEY`  | Yes      | —                        | Your QR for Agent API key            |
| `BASE_URL` | No       | Production API           | Custom instance URL (self-hosting)   |

## Tools (37)

### QR Code Management (9)

| Tool | Description |
|------|-------------|
| `create_qr_code` | Create a URL QR code with custom styling (colors, dot/corner shapes, gradients, logo, frames) |
| `get_qr_code` | Get QR code details by short ID |
| `update_qr_destination` | Change where a QR code redirects — the image stays the same |
| `list_qr_codes` | List all QR codes with pagination |
| `delete_qr_code` | Delete a QR code and its analytics |
| `get_qr_analytics` | Get scan stats with device, browser, OS, country, city breakdowns |
| `bulk_create_qr_codes` | Create up to 50 QR codes at once |
| `bulk_update_qr_codes` | Update up to 50 QR codes at once |
| `bulk_delete_qr_codes` | Delete up to 50 QR codes at once |

### QR Types (14)

Create and update specialized QR code types with structured data:

| Tool | Description |
|------|-------------|
| `create_vcard_qr` | Contact card (name, phone, email, address) |
| `create_wifi_qr` | WiFi credentials (SSID, password, encryption) |
| `create_email_qr` | Pre-filled email (mailto: link) |
| `create_sms_qr` | Pre-filled SMS message |
| `create_phone_qr` | Phone call (tel: link) |
| `create_event_qr` | Calendar event (iCalendar) |
| `create_text_qr` | Plain text |
| `create_location_qr` | GPS coordinates (geo: URI) |
| `create_social_qr` | Multi-platform social media links |
| `create_app_store_qr` | Smart iOS/Android app store redirect |
| `update_vcard_qr` | Update a vCard QR code |
| `update_wifi_qr` | Update a WiFi QR code |
| `update_social_qr` | Update a social media QR code |
| `update_app_store_qr` | Update an app store QR code |

### Webhooks (3)

| Tool | Description |
|------|-------------|
| `create_webhook` | Register an endpoint for real-time scan/conversion notifications (HMAC-signed) |
| `list_webhooks` | List all registered webhook endpoints |
| `delete_webhook` | Remove a webhook endpoint |

### Redirect & Tracking (4)

| Tool | Description |
|------|-------------|
| `set_utm_params` | Set UTM tracking parameters (source, medium, campaign) on a QR code |
| `set_redirect_rules` | Set conditional redirects (by device, OS, country, language, time, A/B split) |
| `record_conversion` | Record a post-scan conversion event (purchase, signup, etc.) |
| `get_conversions` | Get conversion stats for a QR code (totals, by event, by day) |

### Custom Domains (2)

| Tool | Description |
|------|-------------|
| `set_custom_domain` | Set or remove a branded short URL domain (Pro only) |
| `get_custom_domain` | Get current custom domain and DNS verification status |

### CSV Bulk (1)

| Tool | Description |
|------|-------------|
| `bulk_create_from_csv` | Create up to 500 QR codes from CSV data (Pro only) |

### Account & Billing (4)

| Tool | Description |
|------|-------------|
| `register` | Register for a free API key with your email |
| `get_usage` | Get current usage and quota for your plan |
| `upgrade_to_pro` | Upgrade to Pro ($19/month) — returns a Stripe Checkout URL |
| `manage_billing` | Open Stripe billing portal to manage subscription |

## Custom QR Styling

The `create_qr_code` tool (and all `create_*_qr` tools) supports:

- **Colors:** `foreground_color`, `background_color` (hex)
- **Gradients:** linear or radial gradients for dots and finder patterns
- **Dot styles:** `square`, `rounded`, `dots`, `classy-rounded`
- **Corner styles:** `square`, `extra-rounded`, `dot`
- **Logo:** `logo_url` (URL or data:base64), `logo_size` (0.15–0.3)
- **Frames:** `banner_top`, `banner_bottom`, `rounded` with custom CTA text
- **Size:** `width` (200–2000px), `margin` (0–10), `error_correction` (L/M/Q/H)

## Plans

| | Free | Pro ($19/month) |
|---|---|---|
| QR codes | 10 | Unlimited |
| Scans/month | 1,000 | Unlimited |
| Webhooks | 1 | Unlimited |
| Custom domains | — | ✓ |
| CSV bulk upload | — | ✓ (500/batch) |

## How It Works

This MCP server is a thin HTTP client (~5 KB). It forwards tool calls to the QR Agent Core API, which handles QR generation, storage, redirects, and analytics. The QR codes are "dynamic" — you can change the destination URL at any time without regenerating the QR image.

## Self-Hosting

QR Agent Core is open source (MIT). You can self-host:

```bash
git clone https://github.com/benswel/qr-agent-core.git
cd qr-agent-core
npm install && npm run dev
```

Then point the MCP server to your instance:

```bash
BASE_URL=http://localhost:3100 API_KEY=your-key npx qr-for-agent
```

## License

MIT
