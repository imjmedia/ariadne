/**
 * Bloque `multi_root` del MDD: composición del workspace Ariadne y enlaces cross-repo en Falkor.
 */
import type { MddMultiRootBlock, MddMultiRootRepository } from './mdd-document.types';

export type MddMultiRootProjectRepoInput = {
  id: string;
  projectKey: string;
  repoSlug: string;
  status: string;
  lastSyncAt: string | null;
  role?: string | null;
};

export type MddMultiRootBuildInput = {
  projectId: string;
  projectName: string | null;
  repositories: MddMultiRootProjectRepoInput[];
  /** Repos incluidos en el alcance de este MDD (undefined = todos los del proyecto). */
  mddScopeRepoIds?: string[];
  /** Repo ancla del snapshot (post-sync / parity pack por repo). */
  primaryRepositoryId?: string;
};

type CypherExecutor = (
  projectId: string,
  cypher: string,
  params?: Record<string, unknown>,
) => Promise<unknown[]>;

const CROSS_REPO_REL_TYPES = [
  'CALLS_API',
  'CALLS_STRAPI_ROUTE',
  'CALLS_NEST_ROUTE',
  'CALLS_GRAPHQL_QUERY',
] as const;

type CrossRepoRelType = (typeof CROSS_REPO_REL_TYPES)[number];

function slugForRepo(r: MddMultiRootProjectRepoInput): string {
  return `${r.projectKey}/${r.repoSlug}`;
}

function resolveScopeRepoIds(
  repositories: MddMultiRootProjectRepoInput[],
  mddScopeRepoIds?: string[],
): string[] {
  if (mddScopeRepoIds?.length) {
    return [...new Set(mddScopeRepoIds.filter(Boolean))];
  }
  return repositories.map((r) => r.id);
}

export function buildMddMultiRootRepositories(
  input: MddMultiRootBuildInput,
): MddMultiRootRepository[] {
  const scopeSet = new Set(resolveScopeRepoIds(input.repositories, input.mddScopeRepoIds));
  const primaryId = input.primaryRepositoryId?.trim() || null;
  return input.repositories.map((r) => ({
    repoId: r.id,
    slug: slugForRepo(r),
    role: r.role?.trim() ? r.role.trim() : null,
    status: r.status,
    lastSyncAt: r.lastSyncAt,
    in_mdd_scope: scopeSet.has(r.id),
    is_primary: primaryId ? r.id === primaryId : scopeSet.size === 1 && scopeSet.has(r.id),
  }));
}

async function countCrossRepoLinks(
  projectId: string,
  executeCypher: CypherExecutor,
): Promise<MddMultiRootBlock['cross_repo_links']> {
  const empty = {
    calls_api: 0,
    calls_strapi_route: 0,
    calls_nest_route: 0,
    calls_graphql_query: 0,
    total: 0,
  };
  try {
    const relUnion = CROSS_REPO_REL_TYPES.map((t) => `'${t}'`).join('|');
    const rows = (await executeCypher(
      projectId,
      `MATCH (a {projectId: $projectId})-[r:${relUnion}]->(b {projectId: $projectId})
       WHERE a.repoId IS NOT NULL AND b.repoId IS NOT NULL AND a.repoId <> b.repoId
       RETURN type(r) AS rel, count(r) AS c`,
      { projectId },
    )) as Array<{ rel?: string; c?: number | { low?: number; high?: number } }>;

    const counts: Record<CrossRepoRelType, number> = {
      CALLS_API: 0,
      CALLS_STRAPI_ROUTE: 0,
      CALLS_NEST_ROUTE: 0,
      CALLS_GRAPHQL_QUERY: 0,
    };
    for (const row of rows) {
      const rel = row.rel as CrossRepoRelType | undefined;
      if (!rel || !(rel in counts)) continue;
      const raw = row.c;
      const n =
        typeof raw === 'number'
          ? raw
          : raw && typeof raw === 'object' && 'low' in raw
            ? Number(raw.low ?? 0)
            : Number(raw ?? 0);
      counts[rel] = n;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return {
      calls_api: counts.CALLS_API,
      calls_strapi_route: counts.CALLS_STRAPI_ROUTE,
      calls_nest_route: counts.CALLS_NEST_ROUTE,
      calls_graphql_query: counts.CALLS_GRAPHQL_QUERY,
      total,
    };
  } catch {
    return empty;
  }
}

export function buildMddMultiRootNotes(
  repositories: MddMultiRootRepository[],
  scopeRepoIds: string[],
  crossRepoLinks: MddMultiRootBlock['cross_repo_links'],
): string | undefined {
  if (repositories.length <= 1) return undefined;
  const scoped = repositories.filter((r) => r.in_mdd_scope);
  const others = repositories.filter((r) => !r.in_mdd_scope);
  const parts: string[] = [
    `Workspace Ariadne multi-root: ${repositories.length} repositorios Git distintos asociados al mismo proyecto.`,
  ];
  if (scoped.length === repositories.length) {
    parts.push('Este MDD agrega evidencia de todos los roots del proyecto.');
  } else if (scoped.length === 1) {
    const primary = scoped[0];
    parts.push(
      `Este snapshot MDD está acotado al repo \`${primary.slug}\`${primary.role ? ` (rol: ${primary.role})` : ''}.`,
    );
    if (others.length > 0) {
      parts.push(
        `Otros roots del proyecto: ${others.map((r) => `\`${r.slug}\`${r.role ? ` (${r.role})` : ''}`).join(', ')}.`,
      );
    }
  } else {
    parts.push(
      `Alcance MDD: ${scoped.map((r) => `\`${r.slug}\``).join(', ')} (${scopeRepoIds.length} de ${repositories.length} repos).`,
    );
  }
  if (crossRepoLinks.total > 0) {
    parts.push(
      `Grafo Falkor: ${crossRepoLinks.total} enlace(s) cross-repo (front↔back) materializado(s) tras sync.`,
    );
  } else {
    parts.push(
      'Sin enlaces cross-repo en el grafo aún; ejecuta resync de todos los roots del proyecto si el front y el back están indexados por separado.',
    );
  }
  parts.push(
    'Multi-repo en Git no implica deploy independiente: revisar configuración Strapi/Docker en cada root para la topología runtime.',
  );
  return parts.join(' ');
}

/** Etiqueta de alcance para el `summary` del MDD según composición multi-root. */
export function mddSummaryScopeLabel(
  multiRoot: MddMultiRootBlock | undefined,
): string {
  if (!multiRoot?.is_multi_root) return 'el repositorio indexado';
  const scoped = multiRoot.repositories.filter((r) => r.in_mdd_scope);
  if (scoped.length === multiRoot.repository_count) {
    return `proyecto multi-root (${multiRoot.repository_count} repos: ${multiRoot.repositories.map((r) => r.slug).join(', ')})`;
  }
  const primary = multiRoot.repositories.find((r) => r.is_primary) ?? scoped[0];
  if (primary) {
    return `repo \`${primary.slug}\` (proyecto multi-root con ${multiRoot.repository_count} repos)`;
  }
  return `proyecto multi-root (${multiRoot.repository_count} repos)`;
}

export async function buildMddMultiRootBlock(
  input: MddMultiRootBuildInput,
  executeCypher: CypherExecutor,
): Promise<MddMultiRootBlock> {
  const repositories = buildMddMultiRootRepositories(input);
  const mddScopeRepoIds = resolveScopeRepoIds(input.repositories, input.mddScopeRepoIds);
  const crossRepoLinks = await countCrossRepoLinks(input.projectId, executeCypher);
  const isMultiRoot = repositories.length >= 2;
  const notes = buildMddMultiRootNotes(repositories, mddScopeRepoIds, crossRepoLinks);

  return {
    projectId: input.projectId,
    projectName: input.projectName,
    repository_count: repositories.length,
    is_multi_root: isMultiRoot,
    repositories,
    mdd_scope_repo_ids: mddScopeRepoIds,
    cross_repo_links: crossRepoLinks,
    ...(notes ? { notes } : {}),
  };
}
