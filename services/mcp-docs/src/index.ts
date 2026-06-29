#!/usr/bin/env node
/**
 * @fileoverview Documentation MCP server entry point.
 *
 * Serves the docs_mcp/ corpus to AI agents over the official MCP SDK. Two transports:
 *   - stdio (default)  — plug directly into Cursor `.cursor/mcp.json`.
 *   - Streamable HTTP  — `--http` (stateless, one Server+transport per request).
 *
 * Docs folder resolution order:
 *   1. `--docs <dir>` CLI flag
 *   2. `DOCS_MCP_DIR` env var
 *   3. nearest `docs_mcp/` folder walking up from CWD, then from this module.
 *
 * IMPORTANT: in stdio mode stdout is the JSON-RPC channel — all logs go to stderr.
 *
 * @license Apache-2.0
 * @author Jorge Correa <jcorrea@e-personal.net>
 */

import { createServer } from "node:http";
import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { DocsStore } from "./docs-store.js";
import { createDocsMcpServer, SERVER_NAME, SERVER_VERSION } from "./server.js";

const MCP_PATH = "/mcp";
const DOCS_FOLDER_NAME = "docs_mcp";

interface CliOptions {
  http: boolean;
  port: number;
  docsDir: string;
}

function getArg(argv: string[], flag: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const idx = argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < argv.length) return argv[idx + 1];
  return undefined;
}

/** Walk up from `start` looking for a `docs_mcp/` directory. */
function findDocsUpward(start: string): string | undefined {
  let current = start;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(current, DOCS_FOLDER_NAME);
    if (isDir(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return undefined;
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function resolveDocsDir(argv: string[]): string {
  const explicit = getArg(argv, "--docs") ?? process.env.DOCS_MCP_DIR;
  if (explicit) return resolve(explicit);

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  return (
    findDocsUpward(process.cwd()) ??
    findDocsUpward(moduleDir) ??
    resolve(process.cwd(), DOCS_FOLDER_NAME)
  );
}

function parseOptions(argv: string[]): CliOptions {
  const portRaw = getArg(argv, "--port") ?? process.env.PORT ?? process.env.MCP_HTTP_PORT;
  return {
    http: argv.includes("--http"),
    port: Number.parseInt(portRaw ?? "8081", 10),
    docsDir: resolveDocsDir(argv),
  };
}

async function startStdio(store: DocsStore): Promise<void> {
  const server = createDocsMcpServer(store);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVER_NAME}] stdio transport ready (docs: ${store.root})`);
}

function startHttp(store: DocsStore, port: number): void {
  const httpServer = createServer((req, res) => {
    void (async () => {
      const url = req.url ?? "/";
      if (req.method === "GET" && (url === "/health" || url === "/healthz")) {
        const manifest = store.getManifest();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", server: SERVER_NAME, version: SERVER_VERSION, totalPages: manifest.totalPages }));
        return;
      }
      if (!url.startsWith(MCP_PATH)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found", path: url }));
        return;
      }
      // Stateless: a fresh Server + transport per request.
      const server = createDocsMcpServer(store);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    })().catch((err) => {
      console.error(`[${SERVER_NAME}] request error:`, err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal Server Error", message: String(err) }));
      }
    });
  });

  httpServer.listen(port, "0.0.0.0", () => {
    console.error(`[${SERVER_NAME}] HTTP transport listening on 0.0.0.0:${port}${MCP_PATH} (docs: ${store.root})`);
  });
  httpServer.on("error", (err) => {
    console.error(`[${SERVER_NAME}] server error:`, err);
    process.exit(1);
  });
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));

  if (!existsSync(options.docsDir)) {
    console.error(
      `[${SERVER_NAME}] WARNING: docs folder not found at "${options.docsDir}". ` +
        `The server will start but expose no pages. Set --docs <dir> or DOCS_MCP_DIR.`,
    );
  }

  const store = new DocsStore(options.docsDir);
  // Warm up + surface load errors early.
  store.getManifest();

  if (options.http) {
    startHttp(store, options.port);
  } else {
    await startStdio(store);
  }
}

main().catch((err) => {
  console.error(`[${SERVER_NAME}] fatal:`, err);
  process.exit(1);
});
