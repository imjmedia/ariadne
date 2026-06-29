/**
 * Shared detect_changes / analyze_local_changes handler for MCP.
 */
import { execSync } from 'node:child_process';
import {
  buildDetectChangesResult,
  gitDiffCommand,
  parseDiffMode,
  parseDiffSymbols,
  type DetectChangesResult,
  type DiffMode,
} from 'ariadne-common';

export type DetectChangesArgs = {
  projectId?: string;
  workspaceRoot?: string;
  stagedDiff?: string;
  diff?: string;
  mode?: string;
  currentFilePath?: string;
};

export type GraphClient = {
  query: (cypher: string, opts?: { params?: Record<string, string> }) => Promise<unknown>;
};

export function getGitDiff(workspaceRoot: string, mode: DiffMode): string {
  try {
    const out = execSync(gitDiffCommand(mode), {
      encoding: 'utf-8',
      cwd: workspaceRoot,
      maxBuffer: 2 * 1024 * 1024,
    });
    return out ?? '';
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`No se pudo ejecutar ${gitDiffCommand(mode)} en ${workspaceRoot}: ${msg}`);
  }
}

async function countDependents(
  graph: GraphClient,
  symbolName: string,
  projectId: string,
): Promise<number> {
  const whereParts = [
    '(n.projectId = $projectId OR n.projectId IS NULL)',
    '(dep.projectId = $projectId OR dep.projectId IS NULL)',
  ];
  const countQ = `MATCH (n {name: $nodeName})<-[:CALLS|RENDERS*]-(dep) WHERE ${whereParts.join(' AND ')} RETURN count(dep) AS cnt`;
  try {
    const countRes = (await graph.query(countQ, {
      params: { nodeName: symbolName, projectId },
    })) as { data?: Array<Record<string, unknown>> };
    const first = (countRes.data ?? [])[0] as Record<string, unknown> | undefined;
    const val = first?.cnt;
    return typeof val === 'number' ? val : parseInt(String(val ?? '0'), 10) || 0;
  } catch {
    return 0;
  }
}

export async function analyzeDiffImpact(
  graph: GraphClient,
  projectId: string,
  rawDiff: string,
  mode: DiffMode,
): Promise<DetectChangesResult> {
  const { removed, added, edited } = parseDiffSymbols(rawDiff);
  const allNames = [...removed, ...added, ...edited];
  const dependentCounts = new Map<string, number>();
  for (const name of allNames) {
    dependentCounts.set(name, await countDependents(graph, name, projectId));
  }
  return buildDetectChangesResult(mode, rawDiff, dependentCounts);
}

export function formatDetectChangesMarkdown(result: DetectChangesResult): string {
  const tableHeader =
    '| Tipo de Cambio | Elemento | Impacto en el Sistema | Riesgo |\n|----------------|----------|------------------------|--------|';
  const tableRows = result.affectedSymbols
    .map(
      (r) =>
        `| ${r.changeType} | ${r.name} | ${r.impact} | ${r.risk} |`,
    )
    .join('\n');
  const modeLabel =
    result.mode === 'staged'
      ? 'stage'
      : result.mode === 'unstaged'
        ? 'working tree (unstaged)'
        : 'HEAD (staged + unstaged)';
  const lines = [
    '## Resumen de impacto (pre-flight check)',
    '',
    `Revisión de cambios en **${modeLabel}** contra el grafo FalkorDB.`,
    '',
    tableHeader,
    tableRows,
    '',
  ];
  if (result.summary.high > 0) {
    lines.push(
      '**Recomendación:** Revisa los elementos en riesgo ALTO antes de hacer push. Podrías romper el build en master.',
    );
  }
  return lines.join('\n');
}

export async function resolveDetectChangesDiff(
  args: DetectChangesArgs,
): Promise<{ rawDiff: string; mode: DiffMode } | { error: string }> {
  const mode = parseDiffMode(args.mode);
  const explicitDiff = (args.diff ?? args.stagedDiff ?? '').trim();
  const workspaceRoot = (args.workspaceRoot ?? '').trim();

  if (workspaceRoot) {
    try {
      return { rawDiff: getGitDiff(workspaceRoot, mode), mode };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        error: `**Error obteniendo diff:** ${msg}\n\nAlternativa: ejecuta \`${gitDiffCommand(mode)}\` en tu repo y pasa el resultado en \`diff\` o \`stagedDiff\` (útil cuando el MCP corre en remoto).`,
      };
    }
  }

  if (explicitDiff) {
    return { rawDiff: explicitDiff, mode };
  }

  return {
    error:
      '**Error:** Indica `workspaceRoot` (ruta del repo donde ejecutar git diff) o `diff` / `stagedDiff` (salida cruda del comando).',
  };
}

export function emptyDiffMessage(mode: DiffMode): string {
  if (mode === 'staged') {
    return 'No hay cambios en stage. Ejecuta `git add` en los archivos que quieras incluir y vuelve a llamar a esta herramienta antes del commit.';
  }
  if (mode === 'unstaged') {
    return 'No hay cambios unstaged en el working tree.';
  }
  return 'No hay cambios respecto a HEAD.';
}
