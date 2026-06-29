/**
 * Unified diff parsing and blast-radius risk classification for detect_changes / analyze_local_changes.
 */

export type DiffMode = 'staged' | 'unstaged' | 'all';

export type SymbolChangeKind = 'Eliminación' | 'Modificación' | 'Nuevo';

export type ParsedDiffSymbols = {
  removed: string[];
  added: string[];
  edited: string[];
};

export type SymbolImpactRow = {
  name: string;
  changeType: SymbolChangeKind;
  impact: string;
  risk: 'ALTO' | 'MEDIO' | 'BAJO';
  dependentCount: number;
};

export type DetectChangesSummary = {
  high: number;
  medium: number;
  low: number;
};

export type DetectChangesResult = {
  mode: DiffMode;
  changedFiles: string[];
  affectedSymbols: SymbolImpactRow[];
  summary: DetectChangesSummary;
};

const SYMBOL_PATTERNS = [
  /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g,
  /(?:export\s+)?const\s+(\w+)\s*=\s*(?:\(|function|async)/g,
  /(?:export\s+)?(?:default\s+)?class\s+(\w+)\b/g,
  /<([A-Z][a-zA-Z0-9]*)[\s\/>]/g,
  /(?:export\s+)?(?:function|const)\s+(\w+)\s*\(/g,
];

/** Git command for the requested diff mode. */
export function gitDiffCommand(mode: DiffMode): string {
  switch (mode) {
    case 'staged':
      return 'git diff --cached';
    case 'unstaged':
      return 'git diff';
    case 'all':
      return 'git diff HEAD';
    default:
      return 'git diff --cached';
  }
}

/** Parses `mode` from user input; defaults to staged. */
export function parseDiffMode(raw: string | undefined): DiffMode {
  const m = (raw ?? 'staged').trim().toLowerCase();
  if (m === 'unstaged' || m === 'all') return m;
  return 'staged';
}

function extractSymbolsFromLine(line: string): string[] {
  const symbols: string[] = [];
  for (const re of SYMBOL_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const name = m[1];
      if (name && !symbols.includes(name)) symbols.push(name);
    }
  }
  return symbols;
}

/** Extracts changed file paths from unified diff headers. */
export function parseChangedFilesFromDiff(diff: string): string[] {
  const files = new Set<string>();
  for (const line of diff.split(/\r?\n/)) {
    const m = /^diff --git a\/(.+?) b\/(.+?)$/.exec(line);
    if (m) {
      files.add(m[2]);
      continue;
    }
    const plus = /^\+{3} b\/(.+)$/.exec(line);
    if (plus) files.add(plus[1]);
  }
  return [...files];
}

/** Parses unified diff and returns removed, added, and edited symbol names. */
export function parseDiffSymbols(diff: string): ParsedDiffSymbols {
  const inMinus = new Set<string>();
  const inPlus = new Set<string>();

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('-') && !line.startsWith('---')) {
      for (const s of extractSymbolsFromLine(line.slice(1))) inMinus.add(s);
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      for (const s of extractSymbolsFromLine(line.slice(1))) inPlus.add(s);
    }
  }

  const removed: string[] = [];
  const added: string[] = [];
  const edited: string[] = [];
  for (const s of inMinus) {
    if (inPlus.has(s)) edited.push(s);
    else removed.push(s);
  }
  for (const s of inPlus) {
    if (!inMinus.has(s)) added.push(s);
  }
  return { removed, added, edited };
}

/** Classifies blast-radius risk for a symbol change given dependent count from the graph. */
export function classifySymbolImpact(
  changeType: SymbolChangeKind,
  dependentCount: number,
): { impact: string; risk: 'ALTO' | 'MEDIO' | 'BAJO' } {
  if (changeType === 'Eliminación') {
    if (dependentCount > 0) {
      return {
        impact: `${dependentCount} componente(s) o función(es) quedaron huérfanos (aún dependen de este símbolo).`,
        risk: 'ALTO',
      };
    }
    return {
      impact: 'No aparece en el grafo o sin dependientes (código muerto o no indexado).',
      risk: 'BAJO',
    };
  }
  if (changeType === 'Modificación') {
    if (dependentCount > 0) {
      return {
        impact: `${dependentCount} pantalla(s) o función(es) verán el cambio.`,
        risk: dependentCount >= 10 ? 'ALTO' : 'MEDIO',
      };
    }
    return { impact: 'Sin dependientes directos en el grafo.', risk: 'BAJO' };
  }
  return { impact: 'Sin dependencias entrantes aún.', risk: 'BAJO' };
}

/** Builds structured detect_changes result from parsed diff + per-symbol dependent counts. */
export function buildDetectChangesResult(
  mode: DiffMode,
  diff: string,
  dependentCounts: Map<string, number>,
): DetectChangesResult {
  const { removed, added, edited } = parseDiffSymbols(diff);
  const changedFiles = parseChangedFilesFromDiff(diff);
  const affectedSymbols: SymbolImpactRow[] = [];

  const entries: Array<{ name: string; changeType: SymbolChangeKind }> = [
    ...removed.map((name) => ({ name, changeType: 'Eliminación' as const })),
    ...edited.map((name) => ({ name, changeType: 'Modificación' as const })),
    ...added.map((name) => ({ name, changeType: 'Nuevo' as const })),
  ];

  const summary: DetectChangesSummary = { high: 0, medium: 0, low: 0 };

  for (const { name, changeType } of entries) {
    const dependentCount = dependentCounts.get(name) ?? 0;
    const { impact, risk } = classifySymbolImpact(changeType, dependentCount);
    affectedSymbols.push({ name, changeType, impact, risk, dependentCount });
    if (risk === 'ALTO') summary.high += 1;
    else if (risk === 'MEDIO') summary.medium += 1;
    else summary.low += 1;
  }

  return { mode, changedFiles, affectedSymbols, summary };
}
