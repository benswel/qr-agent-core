import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { validateApiKey, ensureEnvKeyInDb, getApiKeyPlan } from "./auth.service.js";
import type { Plan } from "../../shared/types.js";
import { sendError } from "../../shared/errors.js";

/**
 * Authentication plugin.
 * Protects all routes under /api/* with X-API-Key header validation.
 * Public routes (redirect, health, docs, .well-known) are NOT protected.
 * Attaches apiKeyId to the request for multi-tenant scoping.
 */
async function authPlugin(app: FastifyInstance) {
  // Decorate request with apiKeyId and plan (defaults, overwritten in hook)
  app.decorateRequest("apiKeyId", 0);
  app.decorateRequest<Plan>("plan", "free");

  // If API_KEY env var is set, seed it in DB so it has a stable ID
  let envKeyId: number | null = null;
  const envKey = process.env.API_KEY;
  if (envKey) {
    envKeyId = ensureEnvKeyInDb(envKey);
    app.log.info("API_KEY env var is configured (%d chars), DB id=%d", envKey.length, envKeyId);
  } else {
    app.log.warn("No API_KEY env var set — only DB-managed keys will work");
  }

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    // Public routes — no auth required
    const publicPrefixes = ["/r/", "/i/", "/health", "/documentation", "/.well-known", "/api/register", "/api/admin/", "/api/stripe/webhook"];
    const isPublic = publicPrefixes.some((p) => request.url.startsWith(p));

    if (isPublic) return;

    // Only protect /api/* routes
    if (!request.url.startsWith("/api/")) return;

    const apiKey = request.headers["x-api-key"];

    if (!apiKey || typeof apiKey !== "string") {
      return sendError(reply, 401, {
        error: "Authentication required. No API key provided.",
        code: "AUTH_MISSING_KEY",
        hint: 'Include your API key in the X-API-Key header. Example: curl -H "X-API-Key: qr_your_key_here" . Generate a key with: npm run key:create',
      });
    }

    // Accept key from API_KEY env var
    if (envKey && apiKey === envKey && envKeyId !== null) {
      request.apiKeyId = envKeyId;
      request.plan = getApiKeyPlan(envKeyId);
      return;
    }

    const keyId = validateApiKey(apiKey);
    if (keyId === null) {
      return sendError(reply, 403, {
        error: "Invalid or expired API key.",
        code: "AUTH_INVALID_KEY",
        hint: "The provided API key does not exist or has expired. Verify the key is correct and has not been revoked. Generate a new key with: npm run key:create",
      });
    }

    request.apiKeyId = keyId;
    request.plan = getApiKeyPlan(keyId);
  });
}

export default fp(authPlugin, { name: "auth" });
