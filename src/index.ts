import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Env } from "./types";
import { TOOL_DEFINITIONS, handleToolCall } from "./tools";

function buildServer(env: Env): Server {
  const server = new Server(
    {
      name: "apex-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOL_DEFINITIONS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return handleToolCall(
      request.params.name,
      request.params.arguments ?? {},
      env
    );
  });

  return server;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Guardrail: require MCP shared secret
    const authHeader = request.headers.get("Authorization") || "";
    const expected = `Bearer ${env.MCP_SHARED_SECRET}`;
    if (authHeader !== expected) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);

    // MCP Streamable HTTP endpoint
    if (url.pathname === "/mcp" || url.pathname === "/sse") {
      // Stateless mode: a fresh server + transport per request. This fits the
      // Workers execution model where there is no long-lived process to hold
      // session state between requests.
      const server = buildServer(env);
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      await server.connect(transport);

      const response = await transport.handleRequest(request);

      // Tidy up once the response stream is done.
      request.signal?.addEventListener("abort", () => {
        void server.close();
      });

      return response;
    }

    return new Response("Not Found", { status: 404 });
  },
};
