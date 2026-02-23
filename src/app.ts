import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { config } from "./config/index.js";
import { runMigrations } from "./db/migrate.js";
import { qrRoutes } from "./modules/qr/qr.routes.js";
import { redirectRoutes } from "./modules/redirect/redirect.routes.js";
import { analyticsRoutes } from "./modules/analytics/analytics.routes.js";
import { wellKnownRoutes } from "./modules/well-known/well-known.routes.js";
import { imageRoutes } from "./modules/image/image.routes.js";
import authPlugin from "./modules/auth/auth.plugin.js";
import type { FastifyError } from "fastify";
import { Errors, sendError } from "./shared/errors.js";

export async function buildApp() {
  const isTest = process.env.NODE_ENV === "test";

  const app = Fastify({
    logger: isTest
      ? false
      : {
          level: "info",
          transport: {
            target: "pino-pretty",
            options: { colorize: true },
          },
        },
  });

  // CORS — open by default for agent access
  await app.register(cors, { origin: true });

  // Swagger / OpenAPI — the self-documentation layer
  await app.register(swagger, {
    openapi: {
      info: {
        title: "QR Agent Core",
        description:
          "QR-as-a-Service API designed for AI agents. Create managed QR codes with dynamic short URLs, update destinations without regenerating images, and track scan analytics. Every response is structured for machine consumption with actionable error messages.",
        version: "0.1.0",
        contact: {
          name: "QR Agent Core",
          url: config.baseUrl,
        },
      },
      components: {
        securitySchemes: {
          apiKey: {
            type: "apiKey",
            name: "X-API-Key",
            in: "header",
            description:
              'API key for authentication. Generate one with "npm run key:create". Include in every request to /api/* endpoints.',
          },
        },
      },
      security: [{ apiKey: [] }],
      servers: [{ url: config.baseUrl, description: "Current server" }],
      tags: [
        {
          name: "QR Codes",
          description:
            "Create, read, update, and delete managed QR codes. Each QR code points to a short URL that can be retargeted at any time.",
        },
        {
          name: "Analytics",
          description:
            "Scan tracking and statistics. Every time a QR code is scanned (short URL visited), a scan event is recorded.",
        },
        {
          name: "Redirect",
          description:
            "The redirect endpoint that QR codes point to. Agents should not call this directly.",
        },
        {
          name: "Discovery",
          description:
            "Machine-readable manifests for AI agent and crawler discovery (.well-known endpoints).",
        },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/documentation",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });

  // Run DB migrations on startup
  runMigrations();

  // Auth — protects /api/* routes, public routes pass through
  await app.register(authPlugin);

  // Register route modules
  await app.register(qrRoutes, { prefix: "/api/qr" });
  await app.register(redirectRoutes);
  await app.register(analyticsRoutes, { prefix: "/api/analytics" });
  await app.register(imageRoutes);
  await app.register(wellKnownRoutes);

  // Global error handler — agent-friendly errors
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      return sendError(
        reply,
        400,
        Errors.validationFailed(
          error.validation.map((v: { instancePath?: string; message?: string }) => `${v.instancePath || ""} ${v.message || ""}`).join("; ")
        )
      );
    }

    request.log.error(error);
    return sendError(reply, 500, {
      error: "An internal server error occurred.",
      code: "INTERNAL_ERROR",
      hint: "This is a server-side issue. Retry the request. If the problem persists, check the server logs or contact the service administrator.",
    });
  });

  // Health check
  app.get(
    "/health",
    {
      schema: {
        tags: ["Discovery"],
        summary: "Health check",
        description: "Returns service status. Agents can poll this to verify the service is operational.",
      },
    },
    async () => ({
      status: "ok",
      service: "qr-agent-core",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
    })
  );

  return app;
}
