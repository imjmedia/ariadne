/**
 * Build Cypher MERGE statements from serialized graph artifact records.
 */
import { cypherSafe, runCypherBatch, type GraphClient } from 'ariadne-common';
import type { GraphArtifactRecord } from './graph-artifact.types';
import { buildNodeKey } from './graph-artifact-serialize';

function labelClause(labels: string[]): string {
  const safe = labels.filter(Boolean);
  if (safe.length === 0) return '';
  return safe.map((l) => `:${l.replace(/[^a-zA-Z0-9_]/g, '_')}`).join('');
}

function mergeMatchProps(props: Record<string, unknown>, keys: string[]): string {
  const pairs = keys
    .filter((k) => props[k] !== undefined && props[k] !== null)
    .map((k) => `${k}: ${formatCypherValue(props[k])}`);
  return pairs.length ? `{${pairs.join(', ')}}` : '{}';
}

function formatCypherValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'string') return cypherSafe(value);
  return cypherSafe(JSON.stringify(value));
}

function setPropsClause(props: Record<string, unknown>, exclude: Set<string>): string | null {
  const entries = Object.entries(props).filter(([k]) => !exclude.has(k));
  if (entries.length === 0) return null;
  const sets = entries.map(([k, v]) => `n.${k} = ${formatCypherValue(v)}`);
  return ` SET ${sets.join(', ')}`;
}

const MERGE_KEYS_BY_LABEL: Record<string, string[]> = {
  Project: ['projectId'],
  File: ['path', 'projectId', 'repoId'],
  Component: ['name', 'projectId', 'repoId'],
  Function: ['path', 'name', 'projectId', 'repoId'],
  Hook: ['name', 'projectId', 'repoId'],
  Route: ['path', 'projectId', 'repoId'],
  Prop: ['name', 'componentName', 'projectId', 'repoId'],
  Model: ['path', 'name', 'projectId', 'repoId'],
  Context: ['name', 'projectId', 'repoId'],
  NestController: ['path', 'name', 'projectId', 'repoId'],
  NestEndpoint: ['path', 'name', 'projectId', 'repoId'],
  StrapiContentType: ['path', 'name', 'projectId', 'repoId'],
  StorybookDoc: ['path', 'projectId', 'repoId'],
  MarkdownDoc: ['path', 'projectId', 'repoId'],
};

function mergeKeysFor(labels: string[]): string[] {
  const primary = [...labels].sort().find((l) => MERGE_KEYS_BY_LABEL[l]) ?? labels[0] ?? 'Node';
  return MERGE_KEYS_BY_LABEL[primary] ?? ['projectId', 'repoId', 'name', 'path'];
}

export function buildImportCypherStatements(records: GraphArtifactRecord[]): string[] {
  const statements: string[] = [];
  const nodeKeys = new Set<string>();

  for (const rec of records) {
    if (rec.kind !== 'node') continue;
    nodeKeys.add(rec.key);
    const keys = mergeKeysFor(rec.labels);
    const match = mergeMatchProps(rec.props, keys);
    const exclude = new Set(keys);
    const setClause = setPropsClause(rec.props, exclude);
    statements.push(`MERGE (n${labelClause(rec.labels)} ${match})${setClause ?? ''}`);
  }

  for (const rec of records) {
    if (rec.kind !== 'edge') continue;
    if (!nodeKeys.has(rec.fromKey) || !nodeKeys.has(rec.toKey)) continue;
    const relType = rec.type.replace(/[^A-Z0-9_]/gi, '_').toUpperCase() || 'RELATED';
    const relProps =
      Object.keys(rec.props).length > 0
        ? ` {${Object.entries(rec.props)
            .map(([k, v]) => `${k}: ${formatCypherValue(v)}`)
            .join(', ')}}`
        : '';
    statements.push(
      `MATCH (a) WHERE ${nodeWhere('a', rec.fromKey)} MATCH (b) WHERE ${nodeWhere('b', rec.toKey)} MERGE (a)-[:${relType}${relProps}]->(b)`,
    );
  }

  return statements;
}

/** Fallback WHERE using exported node key parts (labels + merge props). */
function nodeWhere(alias: string, nodeKey: string): string {
  const parts = nodeKey.split('|');
  const label = parts[0] ?? 'Node';
  const props: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const [k, ...rest] = parts[i]!.split('=');
    if (k) props[k] = rest.join('=');
  }
  const keys = mergeKeysFor([label]);
  const clauses = keys
    .filter((k) => props[k] !== undefined)
    .map((k) => `${alias}.${k} = ${cypherSafe(props[k]!)}`);
  const labelClause = `${alias}:${label.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  return clauses.length ? `${labelClause} AND ${clauses.join(' AND ')}` : labelClause;
}

export function recordsFromGraphQuery(
  nodeRows: Array<{ labels: unknown; props: unknown }>,
  edgeRows: Array<{
    type: unknown;
    props: unknown;
    fromLabels: unknown;
    fromProps: unknown;
    toLabels: unknown;
    toProps: unknown;
  }>,
): GraphArtifactRecord[] {
  const records: GraphArtifactRecord[] = [];
  const keyByIndex = new Map<number, string>();

  nodeRows.forEach((row, idx) => {
    const labels = normalizeLabels(row.labels);
    const props = normalizeProps(row.props);
    const key = buildNodeKey(labels, props);
    keyByIndex.set(idx, key);
    records.push({ kind: 'node', key, labels, props });
  });

  for (const row of edgeRows) {
    const fromLabels = normalizeLabels(row.fromLabels);
    const fromProps = normalizeProps(row.fromProps);
    const toLabels = normalizeLabels(row.toLabels);
    const toProps = normalizeProps(row.toProps);
    records.push({
      kind: 'edge',
      type: String(row.type ?? 'RELATED'),
      fromKey: buildNodeKey(fromLabels, fromProps),
      toKey: buildNodeKey(toLabels, toProps),
      props: normalizeProps(row.props),
    });
  }

  return records;
}

function normalizeLabels(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string') return [raw];
  return [];
}

function normalizeProps(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

export async function importRecordsToGraph(
  client: GraphClient,
  records: GraphArtifactRecord[],
): Promise<{ nodeCount: number; edgeCount: number }> {
  const statements = buildImportCypherStatements(records);
  await runCypherBatch(client, statements);
  const nodeCount = records.filter((r) => r.kind === 'node').length;
  const edgeCount = records.filter((r) => r.kind === 'edge').length;
  return { nodeCount, edgeCount };
}
