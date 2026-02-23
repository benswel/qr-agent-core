import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { validateApiKey } from "./auth.service.js";
import { sendError } from "../../shared/errors.js";

/**
 * Authentication plugin.
 * Protects all routes under /api/* with X-API-Key header validation.
 * Public routes (redirect, health, docs, .well-known) are NOT protected.
 */
async function authPlugin(app: FastifyInstance) {
  const envKey = process.env.API_KEY;
  if (envKey) {
    app.log.info("API_KEY env var is configured (%d chars)", envKey.length);
  } else {
    app.log.warn("No API_KEY env var set — only DB-managed keys will work");
  }

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    // Public routes — no auth required
    const publicPrefixes = ["/r/", "/i/", "/health", "/documentation", "/.well-known"];
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

    // Accept key from API_KEY env var (for production without DB-managed keys)
    const envKey = process.env.API_KEY;
    if (envKey && apiKey === envKey) return;

    if (!validateApiKey(apiKey)) {
      return sendError(reply, 403, {
        error: "Invalid or expired API key.",
        code: "AUTH_INVALID_KEY",
        hint: "The provided API key does not exist or has expired. Verify the key is correct and has not been revoked. Generate a new key with: npm run key:create",
      });
    }
  });
}

export default fp(authPlugin, { name: "auth" });
