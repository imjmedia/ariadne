/**
 * Shared types for the documentation MCP server.
 *
 * A "doc page" is a single Markdown file under the docs_mcp/ folder that follows
 * DOCUMENTATION_TEMPLATE.md (YAML frontmatter + AI Context Brief + numbered sections).
 */

/** Parsed YAML frontmatter of a doc page (only the fields the template defines). */
export interface DocFrontmatter {
  /** Stable slug used in the resource URI (`docs://<section>/<id>`). */
  id: string;
  /** Human-readable title. */
  title: string;
  /** High-level bucket: Componentes / Arquitectura / Guías / … */
  category: string;
  /** ISO-ish date string (free text, e.g. 2026-06-29). */
  lastUpdated?: string;
}

/** A single documentation page loaded from disk. */
export interface DocPage {
  /** URI section segment — the folder under docs_mcp/ (e.g. "componentes"). */
  section: string;
  /** URI topic segment — the frontmatter `id` (falls back to the file name). */
  topic: string;
  /** Canonical resource URI: `docs://<section>/<topic>`. */
  uri: string;
  /** Absolute path on disk. */
  filePath: string;
  frontmatter: DocFrontmatter;
  /** One-sentence "AI Context Brief" extracted from the `>` blockquote. */
  brief: string;
  /** Markdown body without the frontmatter block. */
  body: string;
  /** All `##`/`###` heading texts (used for search ranking). */
  headings: string[];
}

/** Manifest entry for one topic. */
export interface ManifestTopic {
  id: string;
  title: string;
  category: string;
  uri: string;
  lastUpdated?: string;
  /** AI Context Brief (one-liner) so the agent can pick pages without reading them. */
  summary: string;
}

/** Manifest entry for one section (folder). */
export interface ManifestSection {
  section: string;
  title: string;
  topics: ManifestTopic[];
}

/** Full documentation map returned by the `docs://manifest` resource. */
export interface DocsManifest {
  generatedAt: string;
  /** Absolute root folder the docs were loaded from. */
  root: string;
  totalPages: number;
  sections: ManifestSection[];
}

/** A single search hit returned by `search_docs`. */
export interface SearchHit {
  uri: string;
  title: string;
  section: string;
  category: string;
  score: number;
  /** Short contextual fragment around the first matched term. */
  snippet: string;
}

/** Structured result of `get_component_api` (only API-relevant slices of a page). */
export interface ComponentApiResult {
  found: boolean;
  uri?: string;
  title?: string;
  /** Quick Start code block(s). */
  quickStart?: string;
  /** Props / types contract section (markdown table). */
  api?: string;
  /** Design decisions and constraints. */
  rules?: string;
  /** Set when `found` is false: candidate page titles to retry with. */
  suggestions?: string[];
}
