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

The server exposes 6 tools:

| Tool                    | Description                                                                 |
| ----------------------- | --------------------------------------------------------------------------- |
| `create_qr_code`       | Create a new dynamic QR code pointing to a target URL (SVG or PNG)          |
| `get_qr_code`          | Retrieve details of an existing QR code by short ID                         |
| `update_qr_destination`| Change where a QR code redirects — the image stays the same                 |
| `list_qr_codes`        | List all QR codes with pagination                                           |
| `delete_qr_code`       | Permanently delete a QR code and its analytics                              |
| `get_qr_analytics`     | Get scan count and recent scan events for a QR code                         |

## How It Works

This MCP server is a thin HTTP client. It forwards tool calls to your QR Agent Core API server, which handles QR generation, storage, redirects, and analytics. The QR codes are "dynamic" — you can change the destination URL at any time without regenerating the QR image.

## License

MIT
