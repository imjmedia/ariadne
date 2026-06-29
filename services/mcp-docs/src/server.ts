/**
 * Wires the {@link DocsStore} into an MCP {@link Server} (official SDK, low-level API).
 *
 * Resources:
 *  - `docs://manifest` (static)            → JSON index/hierarchy of all docs.
 *  - `docs://<section>/<topic>` (template) → clean Markdown of one page.
 *
 * Tools:
 *  - `search_docs(query)`              → ranked fragments across the corpus.
 *  - `get_component_api(componentName)`→ only Props/Types/Usage of one component.
 *
 * Transport-agnostic: the caller connects either a stdio or a Streamable HTTP transport.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { DocsStore } from "./docs-store.js";
import type { ComponentApiResult } from "./types.js";

export const SERVER_NAME = "docs-mcp";
export const SERVER_VERSION = "0.1.0";

const MANIFEST_URI = "docs://manifest";
const RESOURCE_TEMPLATE = "docs://{section}/{topic}";

const INSTRUCTIONS = [
  "Serves atomic project documentation from the docs_mcp/ folder.",
  "Start with the `docs://manifest` resource to discover sections and topics,",
  "then read a specific page via `docs://<section>/<topic>`.",
  "Use `search_docs` for keyword lookup and `get_component_api` to fetch only the",
  "Props/Types/Usage of a component without the surrounding prose.",
].join(" ");

/** Parse `docs://section/topic` → parts. Returns null for unrelated/invalid URIs. */
function parseDocUri(uri: string): { section: string; topic: string } | null {
  const match = /^docs:\/\/([^/]+)\/([^/]+)\/?$/.exec(uri.trim());
  if (!match) return null;
  return { section: decodeURIComponent(match[1]!), topic: decodeURIComponent(match[2]!) };
}

/** Build the MCP server instance with all resource/tool handlers registered. */
export function createDocsMcpServer(store: DocsStore): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { resources: {}, tools: {} }, instructions: INSTRUCTIONS },
  );

  // ── Resources: list concrete URIs (manifest + every page) ──
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const pages = store.getPages();
    return {
      resources: [
        {
          uri: MANIFEST_URI,
          name: "Documentation manifest",
          description: "JSON index and hierarchy of all available documentation.",
          mimeType: "application/json",
        },
        ...pages.map((p) => ({
          uri: p.uri,
          name: p.frontmatter.title,
          description: p.brief || `${p.frontmatter.category} · ${p.frontmatter.title}`,
          mimeType: "text/markdown",
        })),
      ],
    };
  });

  // ── Resource templates: the dynamic docs://{section}/{topic} pattern ──
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [
      {
        uriTemplate: RESOURCE_TEMPLATE,
        name: "Documentation page",
        description: "A single documentation page rendered as clean Markdown.",
        mimeType: "text/markdown",
      },
    ],
  }));

  // ── Read a resource ──
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    if (uri.trim() === MANIFEST_URI) {
      return {
        contents: [
          {
            uri: MANIFEST_URI,
            mimeType: "application/json",
            text: JSON.stringify(store.getManifest(), null, 2),
          },
        ],
      };
    }

    const parts = parseDocUri(uri);
    if (!parts) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unsupported resource URI "${uri}". Use docs://manifest or docs://<section>/<topic>.`,
      );
    }

    const page = store.getPage(parts.section, parts.topic);
    if (!page) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Documentation page not found: ${uri}. Read docs://manifest to list valid sections/topics.`,
      );
    }

    return {
      contents: [{ uri: page.uri, mimeType: "text/markdown", text: page.body.trim() }],
    };
  });

  // ── Tools ──
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "search_docs",
        description:
          "Keyword search across the documentation corpus. Returns the most relevant pages with a short fragment and their docs:// URI.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search terms (keywords or a question)." },
            limit: {
              type: "number",
              description: "Max number of results (default 6).",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_component_api",
        description:
          "Returns ONLY the Props/Types contract, Quick Start usage and design constraints of a component, ignoring the rest of the page.",
        inputSchema: {
          type: "object",
          properties: {
            componentName: {
              type: "string",
              description: "Component name or title (e.g. 'Button', 'MddSemaphore').",
            },
          },
          required: ["componentName"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === "search_docs") {
        const query = typeof args?.query === "string" ? args.query : "";
        if (!query.trim()) {
          return toolError("`query` is required and must be a non-empty string.");
        }
        const limit = typeof args?.limit === "number" ? args.limit : 6;
        const hits = store.search(query, limit);
        if (hits.length === 0) {
          return toolText(
            `No documentation matched "${query}". Read docs://manifest to see available topics.`,
          );
        }
        const rendered = hits
          .map(
            (h, i) =>
              `### ${i + 1}. ${h.title}\n- URI: \`${h.uri}\`\n- Section: ${h.section} · Category: ${h.category} · Score: ${h.score}\n\n${h.snippet}`,
          )
          .join("\n\n");
        return toolText(`Found ${hits.length} result(s) for "${query}":\n\n${rendered}`);
      }

      if (name === "get_component_api") {
        const componentName =
          typeof args?.componentName === "string" ? args.componentName : "";
        if (!componentName.trim()) {
          return toolError("`componentName` is required and must be a non-empty string.");
        }
        const result = store.getComponentApi(componentName);
        return toolText(renderComponentApi(componentName, result));
      }

      return toolError(`Unknown tool: ${name}`);
    } catch (err) {
      return toolError(`Tool "${name}" failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  return server;
}

function toolText(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function toolError(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

function renderComponentApi(componentName: string, result: ComponentApiResult): string {
  if (!result.found) {
    const suggestions =
      result.suggestions && result.suggestions.length > 0
        ? `\n\nDid you mean:\n${result.suggestions.map((s) => `- ${s}`).join("\n")}`
        : "";
    return `No component documentation found for "${componentName}". Read docs://manifest to list documented components.${suggestions}`;
  }

  const blocks: string[] = [`# ${result.title} — API\n\n(source: \`${result.uri}\`)`];
  if (result.quickStart) blocks.push(result.quickStart);
  if (result.api) blocks.push(result.api);
  if (result.rules) blocks.push(result.rules);
  if (!result.quickStart && !result.api && !result.rules) {
    blocks.push(
      "_This page does not use the standard template sections (Uso Básico / API & Contrato de Tipos / Decisiones de Diseño). Read the full page via its docs:// URI._",
    );
  }
  return blocks.join("\n\n");
}
