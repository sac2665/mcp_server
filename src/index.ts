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
    const url = new URL(request.url);
    const pathSegments = url.pathname.split("/").filter((s) => s.length > 0);

    // Guardrail: first path segment must be the shared secret.
    if (pathSegments.length === 0 || pathSegments[0] !== env.MCP_SHARED_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const remainingPath = "/" + pathSegments.slice(1).join("/");

    // MCP Streamable HTTP endpoint: /<secret>/mcp
    if (remainingPath === "/mcp") {
      // Stateless mode: a fresh server + transport per request. This fits the
      // Workers execution model where there is no long-lived process to hold
      // session state between requests.
      const server = buildServer(env);
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      await server.connect(transport);

      const response = await transport.handleRequest(request);

      // Tidy up once the client disconnects.
      request.signal?.addEventListener("abort", () => {
        void server.close();
      });

      return response;
    }

    return new Response("Not Found", { status: 404 });
  },
};
