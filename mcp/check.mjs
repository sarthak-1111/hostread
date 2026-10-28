// Smoke test: start server.mjs over stdio, list its tools, and call them on
// shows and brands the demo has cached (so it costs no new Qloo calls).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "hostread-check", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [new URL("./server.mjs", import.meta.url).pathname.replace(/^\/(\w:)/, "$1")], env: process.env }));

const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => t.name).join(", "));

const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 330_000, resetTimeoutOnProgress: true });
  const body = r.content.map((c) => c.text).join("\n");
  console.log(`\n--- ${name} ${JSON.stringify(args)}${r.isError ? " (error)" : ""}\n${body.split("\n").slice(0, 14).join("\n")}${body.split("\n").length > 14 ? "\n…" : ""}`);
};
await call("search_podcasts", { query: "Crime Junkie" });
await call("sponsor_deck", { podcast_name: "Crime Junkie" });
await call("search_brands", { query: "Allbirds" });
await call("podcasts_for_brand", { brand_name: "Allbirds" });
await call("sponsor_deck", {});
await client.close();
