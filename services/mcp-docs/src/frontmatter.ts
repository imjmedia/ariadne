/**
 * Minimal YAML frontmatter parser.
 *
 * The template only uses simple `key: value` pairs (id, title, category, last_updated),
 * so a tiny parser avoids pulling a YAML dependency. It is intentionally forgiving:
 * unknown keys are ignored, quotes are stripped, and `[a / b]` style category values
 * are kept as raw text.
 */

export interface ParsedFrontmatter {
  data: Record<string, string>;
  body: string;
}

const FRONTMATTER_RE = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

/** Split a Markdown string into its frontmatter map and the remaining body. */
export function parseFrontmatter(raw: string): ParsedFrontmatter {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) return { data: {}, body: raw.replace(/^\uFEFF/, "") };

  const data: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    value = value.replace(/^["']|["']$/g, "").trim();
    if (key) data[key] = value;
  }

  return { data, body: raw.slice(match[0].length) };
}
