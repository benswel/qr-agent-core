# qr-for-agent

MCP server for dynamic QR codes — create, track, and update QR codes from any AI agent.

This is a lightweight [Model Context Protocol](https://modelcontextprotocol.io/) server that wraps the QR Agent Core API. It lets AI agents (Claude Desktop, Cursor, Windsurf, etc.) manage QR codes as native tools.

## Quick Start

```bash
npx qr-for-agent
```

You need an API key. Set it via environment variable:

```bash
API_KEY=your-key-here npx qr-for-agent
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

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

Add to `.cursor/mcp.json` in your project:

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

## Environment Variables

| Variable   | Required | Default                  | Description                     |
| ---------- | -------- | ------------------------ | ------------------------------- |
| `API_KEY`  | Yes      | —                        | Your QR Agent Core API key      |
| `BASE_URL` | No       | `http://localhost:3100`  | URL of your QR Agent Core instance |

## Tools

The server exposes 12 tools:

### QR Code Management

| Tool                    | Description                                                                 |
| ----------------------- | --------------------------------------------------------------------------- |
| `create_qr_code`       | Create a custom QR code with styling options (colors, dot/corner shapes, logo) |
| `get_qr_code`          | Retrieve details of an existing QR code by short ID                         |
| `update_qr_destination`| Change where a QR code redirects — the image stays the same                 |
| `list_qr_codes`        | List all QR codes with pagination                                           |
| `delete_qr_code`       | Permanently delete a QR code and its analytics                              |
| `get_qr_analytics`     | Get scan count and recent scan events for a QR code                         |

### Webhooks

| Tool                    | Description                                                                 |
| ----------------------- | --------------------------------------------------------------------------- |
| `create_webhook`       | Register an endpoint to receive real-time scan notifications (HMAC-signed)  |
| `list_webhooks`        | List all registered webhook endpoints                                       |
| `delete_webhook`       | Remove a webhook endpoint                                                   |

### Account

| Tool                    | Description                                                                 |
| ----------------------- | --------------------------------------------------------------------------- |
| `register`             | Register for an API key with your email                                     |
| `get_usage`            | Get current usage and quota for your API key                                |
| `join_waitlist`        | Join the Pro plan waitlist                                                  |

### Custom QR Styling

The `create_qr_code` tool supports these styling options:

- **Colors:** `foreground_color`, `background_color` (hex)
- **Dot styles:** `square`, `rounded`, `dots`, `classy-rounded`
- **Corner styles:** `square`, `extra-rounded`, `dot`
- **Logo:** `logo_url` (URL or data:base64), `logo_size` (0.15-0.3)
- **Size:** `width` (200-2000px), `margin` (0-10), `error_correction` (L/M/Q/H)

## How It Works

This MCP server is a thin HTTP client. It forwards tool calls to your QR Agent Core API server, which handles QR generation, storage, redirects, and analytics. The QR codes are "dynamic" — you can change the destination URL at any time without regenerating the QR image.

## License

MIT
