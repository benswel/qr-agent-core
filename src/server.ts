import { buildApp } from "./app.js";
import { config } from "./config/index.js";

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`
╔══════════════════════════════════════════════════╗
║           QR Agent Core — v0.1.0                 ║
╠══════════════════════════════════════════════════╣
║  API:          ${config.baseUrl}/api/qr${" ".repeat(Math.max(0, 33 - `${config.baseUrl}/api/qr`.length))}║
║  Docs:         ${config.baseUrl}/documentation${" ".repeat(Math.max(0, 33 - `${config.baseUrl}/documentation`.length))}║
║  OpenAPI JSON: ${config.baseUrl}/documentation/json${" ".repeat(Math.max(0, 33 - `${config.baseUrl}/documentation/json`.length))}║
║  Health:       ${config.baseUrl}/health${" ".repeat(Math.max(0, 33 - `${config.baseUrl}/health`.length))}║
║  MCP:          npx tsx src/mcp/server.ts         ║
╚══════════════════════════════════════════════════╝
    `);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
