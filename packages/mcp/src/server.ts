#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { tools } from "./tools.js";

/**
 * Standalone MCP server for QR Agent Core.
 *
 * Run with: npx qr-for-agent
 *
 * This exposes all QR management tools via the Model Context Protocol,
 * allowing agents like Claude to call them directly as tools
 * rather than making HTTP requests.
 */
const server = new McpServer({
  name: "qr-for-agent",
  version: "0.5.0",
});

// Register each tool from our definitions
for (const [name, tool] of Object.entries(tools)) {
  server.tool(
    name,
    tool.description,
    tool.inputSchema.shape,
    async (input: Record<string, unknown>) => {
      try {
        const result = await tool.handler(input as any);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: message,
                hint: "Check the input parameters and try again. Use list_qr_codes to verify available QR codes.",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("QR Agent Core MCP server running on stdio");
}

main().catch(console.error);
