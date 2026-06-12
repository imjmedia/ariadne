/**
 * Carga extractos de Markdown complementarios referenciados en openapi_spec (inventarios de API, etc.).
 */

export type SupplementaryDocExcerpt = {
  path: string;
  excerpt: string;
  truncated: boolean;
  total_chars: number;
};

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (raw === undefined || raw === '') return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function getSupplementaryDocLimits(): { maxDocs: number; maxCharsPerDoc: number } {
  return {
    maxDocs: intEnv('MDD_MAX_SUPPLEMENTARY_DOCS', 3, 1, 10),
    maxCharsPerDoc: intEnv('MDD_SUPPLEMENTARY_DOC_EXCERPT_CHARS', 12_000, 500, 100_000),
  };
}

export async function loadSupplementaryDocExcerpts(
  paths: string[],
  getFileSnippet: (relPath: string) => Promise<string | null>,
  options?: { maxDocs?: number; maxCharsPerDoc?: number },
): Promise<SupplementaryDocExcerpt[]> {
  const limits = getSupplementaryDocLimits();
  const maxDocs = options?.maxDocs ?? limits.maxDocs;
  const maxCharsPerDoc = options?.maxCharsPerDoc ?? limits.maxCharsPerDoc;
  const out: SupplementaryDocExcerpt[] = [];

  for (const p of paths.slice(0, maxDocs)) {
    if (!p?.trim()) continue;
    try {
      const content = (await getFileSnippet(p))?.trim();
      if (!content) continue;
      const total_chars = content.length;
      const truncated = total_chars > maxCharsPerDoc;
      const excerpt = truncated
        ? `${content.slice(0, maxCharsPerDoc)}\n\n… _(extracto truncado; ${total_chars} caracteres en índice)._`
        : content;
      out.push({ path: p, excerpt, truncated, total_chars });
    } catch {
      /* archivo no legible en este alcance */
    }
  }

  return out;
}
