/**
 * Loads and indexes the docs_mcp/ Markdown corpus and answers the MCP queries:
 * manifest, single-page lookup, keyword search, and component-API extraction.
 *
 * Pages are cached in memory and transparently reloaded when any file under the
 * root changes (mtime-based), so editing docs does not require restarting the server.
 */

import { type Dirent, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parseFrontmatter } from "./frontmatter.js";
import type {
  ComponentApiResult,
  DocFrontmatter,
  DocPage,
  DocsManifest,
  ManifestSection,
  SearchHit,
} from "./types.js";

/** File names that are never served as documentation pages. */
const IGNORED_FILES = new Set(["DOCUMENTATION_TEMPLATE.md", "README.md"]);
const MAX_SNIPPET = 280;

/** Section folders mapped to a readable title when there is no better source. */
function humanizeSegment(segment: string): string {
  const cleaned = segment.replace(/[-_]+/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** lowercases, strips accents and non-alphanumerics for fuzzy matching. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(text: string): string {
  return normalize(text).replace(/\s+/g, "-");
}

export class DocsStore {
  private readonly rootDir: string;
  private pages: DocPage[] = [];
  private byUri = new Map<string, DocPage>();
  private lastSignature = "";
  private loadedOnce = false;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  get root(): string {
    return this.rootDir;
  }

  /** Reload pages if the corpus changed on disk (or on first access). */
  private ensureFresh(): void {
    const files = this.listMarkdownFiles();
    const signature = files
      .map((f) => {
        try {
          return `${f}:${statSync(f).mtimeMs}`;
        } catch {
          return `${f}:0`;
        }
      })
      .join("|");
    if (this.loadedOnce && signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.loadedOnce = true;
    this.reload(files);
  }

  private listMarkdownFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
      let entries: Dirent[] = [];
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return; // root missing → no pages (handled gracefully upstream)
      }
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules") continue;
          walk(full);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
          if (IGNORED_FILES.has(entry.name)) continue;
          out.push(full);
        }
      }
    };
    walk(this.rootDir);
    return out.sort();
  }

  private reload(files: string[]): void {
    const pages: DocPage[] = [];
    const byUri = new Map<string, DocPage>();

    for (const filePath of files) {
      const page = this.parsePage(filePath);
      if (!page) continue;
      // Last write wins on URI collision; keep deterministic by file order.
      pages.push(page);
      byUri.set(page.uri, page);
    }

    this.pages = pages;
    this.byUri = byUri;
  }

  private parsePage(filePath: string): DocPage | null {
    let raw: string;
    try {
      raw = readFileSync(filePath, "utf-8");
    } catch {
      return null;
    }

    const { data, body } = parseFrontmatter(raw);
    const rel = relative(this.rootDir, filePath);
    const parts = rel.split(sep);
    const fileName = parts[parts.length - 1]!.replace(/\.md$/i, "");
    const sectionRaw = parts.length > 1 ? parts[0]! : "general";
    const section = slugify(sectionRaw);

    const title = (data.title || fileName).trim();
    const id = slugify(data.id || fileName);
    const frontmatter: DocFrontmatter = {
      id,
      title,
      category: (data.category || humanizeSegment(sectionRaw)).trim(),
      lastUpdated: data.last_updated || data.lastUpdated || undefined,
    };

    return {
      section,
      topic: id,
      uri: `docs://${section}/${id}`,
      filePath,
      frontmatter,
      brief: extractBrief(body),
      body,
      headings: extractHeadings(body),
    };
  }

  /** All pages (fresh). */
  getPages(): DocPage[] {
    this.ensureFresh();
    return this.pages;
  }

  /** Full documentation map for the `docs://manifest` resource. */
  getManifest(): DocsManifest {
    this.ensureFresh();
    const sectionsMap = new Map<string, ManifestSection>();

    for (const page of this.pages) {
      let entry = sectionsMap.get(page.section);
      if (!entry) {
        entry = { section: page.section, title: humanizeSegment(page.section), topics: [] };
        sectionsMap.set(page.section, entry);
      }
      entry.topics.push({
        id: page.topic,
        title: page.frontmatter.title,
        category: page.frontmatter.category,
        uri: page.uri,
        lastUpdated: page.frontmatter.lastUpdated,
        summary: page.brief,
      });
    }

    const sections = [...sectionsMap.values()].sort((a, b) => a.section.localeCompare(b.section));
    for (const s of sections) s.topics.sort((a, b) => a.title.localeCompare(b.title));

    return {
      generatedAt: new Date().toISOString(),
      root: this.rootDir,
      totalPages: this.pages.length,
      sections,
    };
  }

  /** Resolve a page by its URI parts. Returns undefined if not found. */
  getPage(section: string, topic: string): DocPage | undefined {
    this.ensureFresh();
    return this.byUri.get(`docs://${slugify(section)}/${slugify(topic)}`);
  }

  /** Keyword search across title, brief, headings and body. */
  search(query: string, limit = 6): SearchHit[] {
    this.ensureFresh();
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    const hits: SearchHit[] = [];
    for (const page of this.pages) {
      const haystackTitle = normalize(page.frontmatter.title);
      const haystackBrief = normalize(page.brief);
      const haystackHeadings = normalize(page.headings.join(" "));
      const haystackBody = normalize(page.body);

      let score = 0;
      for (const term of terms) {
        score += occurrences(haystackTitle, term) * 5;
        score += occurrences(haystackBrief, term) * 3;
        score += occurrences(haystackHeadings, term) * 2;
        score += occurrences(haystackBody, term) * 1;
      }
      if (score <= 0) continue;

      hits.push({
        uri: page.uri,
        title: page.frontmatter.title,
        section: page.section,
        category: page.frontmatter.category,
        score,
        snippet: buildSnippet(page.body, terms),
      });
    }

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, Math.max(1, limit));
  }

  /** Extract only Quick Start + API table + Design rules for a component. */
  getComponentApi(componentName: string): ComponentApiResult {
    this.ensureFresh();
    const target = normalize(componentName);
    if (!target) return { found: false, suggestions: this.componentTitles() };

    // 1) exact id/title, 2) startsWith, 3) includes.
    const exact = this.pages.find(
      (p) => normalize(p.frontmatter.title) === target || p.topic === slugify(componentName),
    );
    const partial =
      exact ??
      this.pages.find((p) => normalize(p.frontmatter.title).startsWith(target)) ??
      this.pages.find((p) => normalize(p.frontmatter.title).includes(target));

    if (!partial) {
      return { found: false, suggestions: this.suggestComponents(target) };
    }

    const sections = splitBodySections(partial.body);
    const quickStart = pickSection(sections, /uso\s+b[aá]sico|quick\s*start/i);
    const api = pickSection(sections, /api|contrato|tipos|props|specs/i);
    const rules = pickSection(sections, /decisi[oó]n|restriccion|reglas|constraint/i);

    return {
      found: true,
      uri: partial.uri,
      title: partial.frontmatter.title,
      quickStart,
      api,
      rules,
    };
  }

  private componentTitles(): string[] {
    return this.pages.map((p) => p.frontmatter.title).sort();
  }

  private suggestComponents(target: string): string[] {
    const scored = this.pages
      .map((p) => ({ title: p.frontmatter.title, n: normalize(p.frontmatter.title) }))
      .filter((p) => p.n.includes(target.split(" ")[0] ?? target) || target.includes(p.n))
      .map((p) => p.title);
    return (scored.length > 0 ? scored : this.componentTitles()).slice(0, 8);
  }
}

/** "> **AI Context Brief:** …" blockquote → plain one-liner. */
function extractBrief(body: string): string {
  const match = /^>\s*(?:\*\*\s*)?(?:AI Context Brief\s*:?\s*\*\*?\s*)?(.+)$/im.exec(body);
  if (!match) return "";
  return match[1]!
    .replace(/\*\*/g, "")
    .replace(/^AI Context Brief\s*:?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeadings(body: string): string[] {
  const out: string[] = [];
  const re = /^#{2,4}\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out.push(m[1]!.replace(/[#*`]/g, "").trim());
  }
  return out;
}

function occurrences(haystack: string, term: string): number {
  if (!term) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(term, from);
    if (idx === -1) break;
    count++;
    from = idx + term.length;
  }
  return count;
}

function buildSnippet(body: string, terms: string[]): string {
  const flat = body.replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, " ").trim();
  const normalized = normalize(flat);
  let pos = -1;
  for (const term of terms) {
    const idx = normalized.indexOf(term);
    if (idx !== -1 && (pos === -1 || idx < pos)) pos = idx;
  }
  if (pos === -1) return flat.slice(0, MAX_SNIPPET).trim();
  const start = Math.max(0, pos - 80);
  const slice = flat.slice(start, start + MAX_SNIPPET).trim();
  return (start > 0 ? "…" : "") + slice + (start + MAX_SNIPPET < flat.length ? "…" : "");
}

interface BodySection {
  heading: string;
  content: string;
}

/** Split a page body into `##`-level sections (heading + content). */
function splitBodySections(body: string): BodySection[] {
  const lines = body.split(/\r?\n/);
  const sections: BodySection[] = [];
  let current: BodySection | null = null;
  for (const line of lines) {
    const h = /^##\s+(.+)$/.exec(line);
    if (h) {
      if (current) sections.push(current);
      current = { heading: h[1]!.trim(), content: "" };
    } else if (current) {
      current.content += line + "\n";
    }
  }
  if (current) sections.push(current);
  return sections;
}

function pickSection(sections: BodySection[], matcher: RegExp): string | undefined {
  const found = sections.find((s) => matcher.test(s.heading));
  if (!found) return undefined;
  const content = found.content.trim();
  return content ? `## ${found.heading}\n\n${content}` : `## ${found.heading}`;
}
