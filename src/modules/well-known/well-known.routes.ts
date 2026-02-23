import type { FastifyInstance } from "fastify";
import { config } from "../../config/index.js";

export async function wellKnownRoutes(app: FastifyInstance) {
  // AI Plugin manifest — allows AI agents to discover this service's capabilities
  app.get(
    "/.well-known/ai-plugin.json",
    {
      schema: {
        tags: ["Discovery"],
        summary: "AI Plugin manifest for agent discovery",
        description:
          "Returns a manifest following the OpenAI plugin specification format. AI agents and crawlers use this endpoint to discover what this service does and how to interact with it.",
        hide: true,
      },
    },
    async () => {
      return {
        schema_version: "v1",
        name_for_human: "QR Agent Core",
        name_for_model: "qr_agent_core",
        description_for_human:
          "Generate, manage, and track dynamic QR codes via API.",
        description_for_model:
          "A QR-as-a-Service API that creates managed QR codes with dynamic short URLs. You can create a QR code for any URL, update where it points without changing the image, and track scan analytics. Use POST /api/qr to create, PATCH /api/qr/:shortId to update the destination, GET /api/analytics/:shortId for scan stats. All QR codes use short redirect URLs so the destination can be changed at any time.",
        auth: { type: "none" },
        api: {
          type: "openapi",
          url: `${config.baseUrl}/documentation/json`,
        },
        logo_url: `${config.baseUrl}/logo.png`,
        contact_email: "support@qr-agent-core.dev",
        legal_info_url: `${config.baseUrl}/legal`,
      };
    }
  );

  // MCP discovery — points agents to the MCP server
  app.get(
    "/.well-known/mcp.json",
    {
      schema: {
        tags: ["Discovery"],
        summary: "MCP server discovery manifest",
        description:
          "Indicates that this service provides a Model Context Protocol (MCP) server for direct tool integration with AI agents.",
        hide: true,
      },
    },
    async () => {
      return {
        name: "qr-agent-core",
        version: "0.1.0",
        description:
          "MCP server for QR code generation, management, and analytics. Provides tools for creating dynamic QR codes, updating destinations, and tracking scans.",
        transport: {
          type: "stdio",
          command: "npx",
          args: ["tsx", "src/mcp/server.ts"],
        },
      };
    }
  );
}
