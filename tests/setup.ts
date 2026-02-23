import { randomUUID } from "node:crypto";
import { unlinkSync } from "node:fs";
import type { FastifyInstance } from "fastify";

// Point to a temp DB file for test isolation
const testDbPath = `/tmp/qr-agent-test-${randomUUID()}.db`;
process.env.DATABASE_URL = testDbPath;

// Disable pino-pretty in tests
process.env.NODE_ENV = "test";

let app: FastifyInstance;
let testApiKey: string;

export async function getApp() {
  if (!app) {
    const { buildApp } = await import("../src/app.js");
    const { generateApiKey } = await import("../src/modules/auth/auth.service.js");

    app = await buildApp();
    await app.ready();

    const { key } = generateApiKey("test-agent");
    testApiKey = key;
  }
  return app;
}

export function getApiKey() {
  return testApiKey;
}

export async function closeApp() {
  if (app) {
    await app.close();
    // Cleanup temp DB
    try {
      unlinkSync(testDbPath);
      unlinkSync(testDbPath + "-wal");
      unlinkSync(testDbPath + "-shm");
    } catch {
      // Files may not exist
    }
  }
}
