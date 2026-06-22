# apex-mcp-server

A read-only [Model Context Protocol](https://modelcontextprotocol.io) server for
the Apex Rides API, deployed as a Cloudflare Worker. It authenticates against AWS
Cognito with a service account and exposes four read-only tools over MCP's
Streamable HTTP transport.

## Tools

| Tool | Description |
| --- | --- |
| `popular_classes` | Top popular workouts by session count in a date range. |
| `search_classes` | Search workouts with filters (paginated). |
| `get_class` | Detailed info for a single on-demand class. |
| `list_instructors` | List all instructors (including archived). |

All tools are `GET`-based. There are no write operations and no generic passthrough.

## Setup & Deploy

### 1. Install

```bash
npm install
```

### 2. Set secrets

```bash
npx wrangler secret put APEX_SERVICE_PASSWORD   # the Cognito service user password
npx wrangler secret put MCP_SHARED_SECRET       # a strong random string
```

For local development, create a `.dev.vars` file (git-ignored) with the same keys:

```
APEX_SERVICE_PASSWORD=...
MCP_SHARED_SECRET=...
```

### 3. Deploy

```bash
npx wrangler deploy
```

## Usage

Connect an MCP client to the worker's MCP endpoint:

```
https://<worker>.workers.dev/mcp
```

with the header:

```
Authorization: Bearer <MCP_SHARED_SECRET>
```

The `/sse` path is also accepted as an alias for backward compatibility, but the
transport is MCP **Streamable HTTP** (the legacy Node-only SSE transport does not
run on Cloudflare Workers).

## Notes & Guardrails

- **No client secret.** `SECRET_HASH` is omitted entirely since the Cognito app
  client has no secret.
- **Token caching.** The access token is cached in module scope and refreshed via
  `REFRESH_TOKEN_AUTH` when near expiry.
- **Date validation.** `popular_classes` validates `from`/`to` against `YYYY-MM-DD`
  and appends `T23:59:59Z` to include the full final day.
- **Name search.** Since the Apex API has no text search, `search_classes` fetches
  up to 500 results and filters client-side when `name` is provided.
- **Read-only enforcement.** Only the four `GET`-based tools above are implemented.
