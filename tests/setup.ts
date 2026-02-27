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
let testApiKey2: string;
let testFreeApiKey: string;

export async function getApp() {
  if (!app) {
    const { buildApp } = await import("../src/app.js");
    const { generateApiKey, setApiKeyPlan } = await import("../src/modules/auth/auth.service.js");

    app = await buildApp();
    await app.ready();

    // Main test keys are "pro" so existing tests don't hit limits
    const { key, id } = generateApiKey("test-agent");
    testApiKey = key;
    setApiKeyPlan(id, "pro");

    const { key: key2, id: id2 } = generateApiKey("test-agent-2");
    testApiKey2 = key2;
    setApiKeyPlan(id2, "pro");

    // A dedicated free-tier key for quota tests
    const { key: freeKey } = generateApiKey("test-free-agent");
    testFreeApiKey = freeKey;
  }
  return app;
}

export function getFreeApiKey() {
  return testFreeApiKey;
}

export function getApiKey() {
  return testApiKey;
}

export function getApiKey2() {
  return testApiKey2;
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
