/**
 * Extrae la sección Markdown «Archivos a tocar» para renderizarla colapsable en el chat.
 */

export type ArchivosATocarSplit = {
  before: string;
  section: { title: string; body: string } | null;
  after: string;
};

export type ArchivoATocarRow = {
  path: string;
  repoId?: string;
  queTocar?: string;
  simbolo?: string;
};

export type ParsedArchivosATocar = {
  rows: ArchivoATocarRow[];
  /** Texto introductorio (p. ej. párrafos antes de tabla/lista) sin filas parseadas. */
  preamble: string;
};

const HEADING_RE = /^(#{1,3})\s+(Archivos a tocar\b[^\n]*)$/im;

const PATH_HEADER = /^(path|archivo|ruta|file)$/i;
const REPO_HEADER = /^(repoid|repo|repositorio)$/i;
const QUE_TOCAR_HEADER =
  /^(motivo|qué\s*tocar(?:\s*\/\s*modificar)?|que\s*tocar(?:\s*\/\s*modificar)?|qué\s*modificar|que\s*modificar|cambio|acción|accion|modificar)$/i;
const SIMBOLO_HEADER = /^(símbolo|simbolo|symbol)$/i;

const BULLET_RE = /^[-*]\s+(.+)$/;
const REPO_INLINE_RE = /\((?:repo(?:Id)?:\s*)([^)]+)\)/i;
const SEPARATOR_ROW_RE = /^:?-{3,}:?$/;

function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return [];
  const inner = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
  const withoutTrailing = inner.endsWith('|') ? inner.slice(0, -1) : inner;
  return withoutTrailing.split('|').map((c) => c.trim().replace(/^`|`$/g, ''));
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => SEPARATOR_ROW_RE.test(c) || c === '');
}

function normalizeCell(value: string | undefined): string {
  return (value ?? '').trim().replace(/^`|`$/g, '');
}

function mapTableColumns(headers: string[]): {
  path: number;
  repoId?: number;
  queTocar?: number;
  simbolo?: number;
} {
  const map: { path: number; repoId?: number; queTocar?: number; simbolo?: number } = {
    path: -1,
  };
  headers.forEach((h, i) => {
    const key = h.trim().toLowerCase();
    if (PATH_HEADER.test(key)) map.path = i;
    else if (REPO_HEADER.test(key)) map.repoId = i;
    else if (QUE_TOCAR_HEADER.test(key)) map.queTocar = i;
    else if (SIMBOLO_HEADER.test(key)) map.simbolo = i;
  });
  if (map.path < 0 && headers.length > 0) map.path = 0;
  if (map.queTocar == null && headers.length >= 2) {
    const fallback = headers.findIndex((_, i) => i !== map.path && i !== map.repoId && i !== map.simbolo);
    if (fallback >= 0) map.queTocar = fallback;
  }
  return map;
}

function rowFromTableCells(cells: string[], col: ReturnType<typeof mapTableColumns>): ArchivoATocarRow | null {
  const path = normalizeCell(cells[col.path]);
  if (!path || path === '—' || path === '-') return null;
  const row: ArchivoATocarRow = { path };
  if (col.repoId != null) {
    const v = normalizeCell(cells[col.repoId]);
    if (v) row.repoId = v;
  }
  if (col.queTocar != null) {
    const v = normalizeCell(cells[col.queTocar]);
    if (v && v !== '—' && v !== '-') row.queTocar = v;
  }
  if (col.simbolo != null) {
    const v = normalizeCell(cells[col.simbolo]);
    if (v && v !== '—' && v !== '-') row.simbolo = v;
  }
  return row;
}

function parseMarkdownTableRows(body: string): { rows: ArchivoATocarRow[]; tableBlock: string } | null {
  const lines = body.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const headerCells = splitTableRow(lines[i]);
    if (headerCells.length < 2) continue;
    const sepCells = splitTableRow(lines[i + 1] ?? '');
    if (!isSeparatorRow(sepCells)) continue;

    const col = mapTableColumns(headerCells);
    const rows: ArchivoATocarRow[] = [];
    let end = i + 2;
    for (; end < lines.length; end++) {
      const line = lines[end];
      if (!line.trim()) continue;
      if (/^#{1,6}\s/.test(line.trim())) break;
      const cells = splitTableRow(line);
      if (cells.length < 2) break;
      const row = rowFromTableCells(cells, col);
      if (row) rows.push(row);
    }
    if (rows.length === 0) continue;
    const tableBlock = lines.slice(i, end).join('\n');
    return { rows, tableBlock };
  }
  return null;
}

function stripInlineFormatting(text: string): string {
  return text.replace(/`([^`]+)`/g, '$1').trim();
}

function parseBulletRow(line: string): ArchivoATocarRow | null {
  const m = line.trim().match(BULLET_RE);
  if (!m) return null;
  let rest = m[1].trim();

  const repoInline = rest.match(REPO_INLINE_RE);
  let repoId: string | undefined;
  if (repoInline) {
    repoId = repoInline[1].trim();
    rest = rest.replace(REPO_INLINE_RE, '').trim();
  }

  const backtickPath = rest.match(/`([^`]+)`/);
  let path = backtickPath?.[1]?.trim();
  let remainder = backtickPath ? rest.replace(backtickPath[0], '').trim() : rest;

  if (!path) {
    const pipeParts = remainder.split('|').map((p) => p.trim());
    if (pipeParts.length >= 2 && pipeParts[0].includes('.')) {
      path = pipeParts[0];
      remainder = pipeParts.slice(1).join(' | ');
    } else {
      const pathLike = remainder.match(/^(\S+\.\w[\w./-]*|\S+\/[\w./-]+)/);
      if (!pathLike) return null;
      path = pathLike[1];
      remainder = remainder.slice(path.length).trim();
    }
  }

  remainder = remainder.replace(/^[-–—:|·]\s*/, '').trim();
  remainder = stripInlineFormatting(remainder);

  const row: ArchivoATocarRow = { path: stripInlineFormatting(path) };
  if (repoId) row.repoId = repoId;
  if (remainder && remainder !== '—' && remainder !== '-') row.queTocar = remainder;
  return row.path ? row : null;
}

function parseBulletRows(body: string): ArchivoATocarRow[] {
  const rows: ArchivoATocarRow[] = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || /^#{1,6}\s/.test(trimmed)) continue;
    const row = parseBulletRow(trimmed);
    if (row) rows.push(row);
  }
  return rows;
}

function dedupeRows(rows: ArchivoATocarRow[]): ArchivoATocarRow[] {
  const seen = new Set<string>();
  const out: ArchivoATocarRow[] = [];
  for (const row of rows) {
    const key = `${row.path}\t${row.repoId ?? ''}\t${row.queTocar ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/**
 * Parsea tablas GFM y viñetas de la sección «Archivos a tocar» en filas estructuradas.
 */
export function parseArchivosATocarSection(body: string): ParsedArchivosATocar {
  const text = (body ?? '').trim();
  if (!text) return { rows: [], preamble: '' };

  const tableParse = parseMarkdownTableRows(text);
  if (tableParse) {
    const preamble = text.replace(tableParse.tableBlock, '').trim();
    const bulletRows = parseBulletRows(preamble);
    return {
      rows: dedupeRows([...tableParse.rows, ...bulletRows]),
      preamble: preamble
        .split('\n')
        .filter((l) => !BULLET_RE.test(l.trim()) && l.trim())
        .join('\n')
        .trim(),
    };
  }

  const bulletRows = parseBulletRows(text);
  if (bulletRows.length > 0) {
    const preamble = text
      .split('\n')
      .filter((l) => !BULLET_RE.test(l.trim()) && !/^#{1,6}\s/.test(l.trim()))
      .join('\n')
      .trim();
    return { rows: dedupeRows(bulletRows), preamble };
  }

  return { rows: [], preamble: text };
}

/**
 * Parte el markdown en: contenido previo, sección «Archivos a tocar» y resto.
 * La sección termina en el siguiente heading del mismo nivel o superior (`#`…`#{level}`).
 */
export function splitArchivosATocarSection(markdown: string): ArchivosATocarSplit {
  const text = markdown ?? '';
  const match = HEADING_RE.exec(text);
  if (!match || match.index === undefined) {
    return { before: text, section: null, after: '' };
  }

  const level = match[1].length;
  const title = match[2].trim();
  const before = text.slice(0, match.index).trimEnd();
  const afterHeading = text.slice(match.index + match[0].length).replace(/^\r?\n+/, '');

  const nextHeadingRe = new RegExp(`^#{1,${level}}\\s+`, 'm');
  const endMatch = nextHeadingRe.exec(afterHeading);

  if (endMatch && endMatch.index !== undefined) {
    return {
      before,
      section: { title, body: afterHeading.slice(0, endMatch.index).trimEnd() },
      after: afterHeading.slice(endMatch.index),
    };
  }

  return {
    before,
    section: { title, body: afterHeading.trimEnd() },
    after: '',
  };
}
