/**
 * Read-only Cypher guard for MCP `query_graph` and similar tools.
 * Rejects write/destructive clauses and optionally scopes queries by projectId.
 */

/** Error thrown when a Cypher query fails the read-only guard. */
export class CypherGuardError extends Error {
  readonly clause: string;

  constructor(message: string, clause: string) {
    super(message);
    this.name = 'CypherGuardError';
    this.clause = clause;
  }
}

/** Write/destructive Cypher keywords blocked by the read-only guard. */
export const BLOCKED_CYPHER_CLAUSES = [
  'MERGE',
  'CREATE',
  'DELETE',
  'SET',
  'REMOVE',
  'DROP',
  'CALL {',
] as const;

export type BlockedCypherClause = (typeof BLOCKED_CYPHER_CLAUSES)[number];

export type CypherGuardResult = {
  query: string;
  params: Record<string, unknown>;
  injectedProjectScope: boolean;
  appendedLimit: boolean;
};

export type GuardCypherOptions = {
  projectId?: string;
  limit?: number;
  /** When true (default), inject projectId filter if the query does not reference it. */
  injectProjectScope?: boolean;
  /** When true (default), append LIMIT if missing. */
  appendLimit?: boolean;
};

const BLOCKED_PATTERNS: Array<{ clause: BlockedCypherClause; re: RegExp }> = [
  { clause: 'MERGE', re: /\bMERGE\b/i },
  { clause: 'CREATE', re: /\bCREATE\b/i },
  { clause: 'DELETE', re: /\bDELETE\b/i },
  { clause: 'SET', re: /\bSET\b/i },
  { clause: 'REMOVE', re: /\bREMOVE\b/i },
  { clause: 'DROP', re: /\bDROP\b/i },
  { clause: 'CALL {', re: /\bCALL\s*\{/i },
];

/**
 * Validates that a Cypher query is read-only. Throws {@link CypherGuardError} on blocked clauses.
 */
export function validateReadOnlyCypher(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new CypherGuardError('Cypher query is empty', 'EMPTY');
  }
  for (const { clause, re } of BLOCKED_PATTERNS) {
    if (re.test(trimmed)) {
      throw new CypherGuardError(
        `Blocked write/destructive Cypher clause: ${clause}. query_graph is read-only.`,
        clause,
      );
    }
  }
}

/** True when the query already references projectId (parameter or property). */
export function queryReferencesProjectId(query: string): boolean {
  return /\$?\bprojectId\b/i.test(query);
}

/**
 * Injects `AND n.projectId = $projectId` after the first MATCH/WHERE block when scope is missing.
 * Returns the original query unchanged when `projectId` is already referenced.
 */
export function injectProjectScope(
  query: string,
  projectId: string,
): { query: string; injected: boolean } {
  if (!projectId.trim() || queryReferencesProjectId(query)) {
    return { query, injected: false };
  }

  const scopeClause = 'n.projectId = $projectId';
  const upper = query.toUpperCase();
  const whereIdx = upper.indexOf(' WHERE ');
  if (whereIdx >= 0) {
    const insertAt = whereIdx + ' WHERE '.length;
    return {
      query: `${query.slice(0, insertAt)}(${scopeClause}) AND ${query.slice(insertAt)}`,
      injected: true,
    };
  }

  const matchRe = /\bMATCH\b/i;
  const match = matchRe.exec(query);
  if (match) {
    const afterMatch = match.index + match[0].length;
    const rest = query.slice(afterMatch);
    const clauseEnd = findClauseBoundary(rest);
    const before = query.slice(0, afterMatch + clauseEnd);
    const after = query.slice(afterMatch + clauseEnd);
    return {
      query: `${before} WHERE ${scopeClause}${after}`,
      injected: true,
    };
  }

  return { query, injected: false };
}

/** Index in `rest` where the first graph pattern clause ends (before RETURN/WITH/ORDER/LIMIT/SKIP). */
function findClauseBoundary(rest: string): number {
  const stopRe = /\b(RETURN|WITH|ORDER\s+BY|LIMIT|SKIP)\b/i;
  const m = stopRe.exec(rest);
  return m ? m.index : rest.length;
}

/** True when the query already contains a top-level LIMIT clause. */
export function queryHasLimit(query: string): boolean {
  return /\bLIMIT\s+\d+\b/i.test(query) || /\bLIMIT\s+\$/i.test(query);
}

/** Appends `LIMIT n` when no LIMIT is present. */
export function appendLimitIfMissing(query: string, limit: number): { query: string; appended: boolean } {
  const safeLimit = Math.max(1, Math.floor(limit));
  if (queryHasLimit(query)) {
    return { query, appended: false };
  }
  const trimmed = query.trim().replace(/;\s*$/, '');
  return { query: `${trimmed} LIMIT ${safeLimit}`, appended: true };
}

/**
 * Full guard pipeline: validate read-only, optional project scope, optional LIMIT.
 */
export function guardCypherQuery(rawQuery: string, opts: GuardCypherOptions = {}): CypherGuardResult {
  const injectScope = opts.injectProjectScope !== false;
  const appendLimit = opts.appendLimit !== false;
  const limit = opts.limit ?? 50;
  const params: Record<string, unknown> = {};

  validateReadOnlyCypher(rawQuery);

  let query = rawQuery.trim();
  let injectedProjectScope = false;
  let appendedLimit = false;

  if (injectScope && opts.projectId?.trim()) {
    params.projectId = opts.projectId.trim();
    const scoped = injectProjectScope(query, opts.projectId.trim());
    query = scoped.query;
    injectedProjectScope = scoped.injected;
  }

  if (appendLimit) {
    const limited = appendLimitIfMissing(query, limit);
    query = limited.query;
    appendedLimit = limited.appended;
  }

  return { query, params, injectedProjectScope, appendedLimit };
}
