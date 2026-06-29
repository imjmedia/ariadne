#!/usr/bin/env node
/**
 * End-to-end smoke test for ariadne-docs-mcp (services/mcp-docs).
 * Uses URIs from this repo's docs_mcp/ corpus.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = dirname(fileURLToPath(import.meta.url));
const serverEntry = resolve(here, "../dist/index.js");
const docsDir = resolve(here, "../../../docs_mcp");

function assert(cond, msg) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log(`✓ ${msg}`);
}

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    env: { ...process.env, DOCS_MCP_DIR: docsDir },
  });
  const client = new Client({ name: "ariadne-docs-mcp-smoke", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);

  const { resources } = await client.listResources();
  assert(resources.some((r) => r.uri === "docs://manifest"), "manifest resource is listed");
  assert(
    resources.some((r) => r.uri === "docs://arquitectura/mcp-ariadne-overview"),
    "mcp-ariadne-overview page is listed",
  );

  const manifestRes = await client.readResource({ uri: "docs://manifest" });
  const manifest = JSON.parse(manifestRes.contents[0].text);
  assert(manifest.totalPages >= 8, `manifest reports pages (got ${manifest.totalPages})`);
  assert(
    manifest.sections.some((s) => s.section === "arquitectura"),
    "manifest has an 'arquitectura' section",
  );
  assert(
    manifest.sections.some((s) => s.section === "guias"),
    "manifest has a 'guias' section",
  );

  const page = await client.readResource({ uri: "docs://arquitectura/mcp-ariadne-overview" });
  assert(/MCP AriadneSpecs/.test(page.contents[0].text), "overview page renders markdown body");

  const search = await client.callTool({
    name: "search_docs",
    arguments: { query: "validate_before_edit grafo" },
  });
  assert(/docs:\/\//.test(search.content[0].text), "search_docs returns matching URIs");

  const api = await client.callTool({
    name: "get_component_api",
    arguments: { componentName: "mcp-ariadne-overview" },
  });
  assert(/API|Uso Básico|validate_before_edit/.test(api.content[0].text), "get_component_api extracts sections");

  const missing = await client.readResource({ uri: "docs://nope/nope" }).then(
    () => null,
    (err) => err,
  );
  assert(missing instanceof Error, "reading a missing page rejects with an error");

  await client.close();
  console.log("\nAll smoke checks passed.");
}

main().catch((err) => {
  console.error("\nSmoke test failed:", err?.message ?? err);
  process.exit(1);
});
