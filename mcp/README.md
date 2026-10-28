# HostRead MCP server

A small [Model Context Protocol](https://modelcontextprotocol.io) server that lets any MCP client (Claude Desktop, Claude Code, other agents) use HostRead as a tool. It calls the hosted HostRead API over HTTPS and holds no keys: the Qloo key and the LLM stay on the HostRead server, behind its rate limits and caches.

## Tools

| Tool | What it does |
| --- | --- |
| `search_podcasts` | Find podcasts in the Qloo taste graph by name; returns IDs. |
| `sponsor_deck` | The ranked sponsor deck for a podcast: fit scores, the tastes listeners share with each brand's fans, and pitch emails and ad scripts for the top brands. Cached shows return instantly; a new show takes 1 to 2 minutes (the server sends progress notifications while the agent works). |
| `write_pitch` | The pitch email and host-read ad script for one brand in a deck. |
| `search_brands` | Find brands by name; returns IDs. |
| `podcasts_for_brand` | Brand-side mode: the podcasts whose listeners already love a brand, with fit scores and shared tastes. No LLM; about 10 to 20 seconds when not cached. |

## Run it

Requires Node 18 or newer.

```bash
cd mcp
npm install
npm run check   # lists the tools and calls them on cached examples
```

### Claude Code

```bash
claude mcp add hostread -- node /absolute/path/to/hostread/mcp/server.mjs
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hostread": {
      "command": "node",
      "args": ["/absolute/path/to/hostread/mcp/server.mjs"]
    }
  }
}
```

Set `HOSTREAD_URL` in the server's environment to point it at your own deployment (default `https://hostread.vercel.app`).

Then ask, for example: "Who should sponsor Darknet Diaries, and write me the pitch for the top surprise fit?" or "Which podcasts should Patagonia advertise on?"
