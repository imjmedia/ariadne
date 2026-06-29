import { describe, expect, it } from 'vitest';
import {
  buildNodeKey,
  parseJsonl,
  serializeRecords,
  sha256Hex,
  zstdLevelForTier,
} from './graph-artifact-serialize';
import { buildImportCypherStatements } from './graph-artifact-cypher';
import type { GraphArtifactRecord } from './graph-artifact.types';

describe('graph-artifact serialize', () => {
  it('buildNodeKey is stable for File nodes', () => {
    const key = buildNodeKey(['File'], {
      path: 'src/app.ts',
      projectId: 'proj-1',
      repoId: 'repo-1',
    });
    expect(key).toBe('File|path=src/app.ts|projectId=proj-1|repoId=repo-1');
  });

  it('roundtrips JSONL serialize/parse', () => {
    const records: GraphArtifactRecord[] = [
      {
        kind: 'node',
        key: 'File|path=a.ts|projectId=p|repoId=r',
        labels: ['File'],
        props: { path: 'a.ts', projectId: 'p', repoId: 'r' },
      },
      {
        kind: 'edge',
        type: 'IMPORTS',
        fromKey: 'File|path=a.ts|projectId=p|repoId=r',
        toKey: 'File|path=b.ts|projectId=p|repoId=r',
        props: {},
      },
    ];
    const parsed = parseJsonl(serializeRecords(records));
    expect(parsed).toEqual(records);
  });

  it('uses zstd tier levels', () => {
    expect(zstdLevelForTier('fast')).toBe(3);
    expect(zstdLevelForTier('best')).toBe(9);
  });

  it('sha256Hex matches known vector', () => {
    expect(sha256Hex('test')).toBe(
      '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    );
  });
});

describe('graph-artifact import cypher', () => {
  it('builds MERGE statements for nodes and edges', () => {
    const records: GraphArtifactRecord[] = [
      {
        kind: 'node',
        key: 'Function|name=foo|path=a.ts|projectId=p|repoId=r',
        labels: ['Function'],
        props: { path: 'a.ts', name: 'foo', projectId: 'p', repoId: 'r', loc: 3 },
      },
      {
        kind: 'node',
        key: 'Function|name=bar|path=b.ts|projectId=p|repoId=r',
        labels: ['Function'],
        props: { path: 'b.ts', name: 'bar', projectId: 'p', repoId: 'r' },
      },
      {
        kind: 'edge',
        type: 'CALLS',
        fromKey: 'Function|name=foo|path=a.ts|projectId=p|repoId=r',
        toKey: 'Function|name=bar|path=b.ts|projectId=p|repoId=r',
        props: {},
      },
    ];
    const stmts = buildImportCypherStatements(records);
    expect(stmts.some((s) => s.includes('MERGE (n:Function'))).toBe(true);
    expect(stmts.some((s) => s.includes('MERGE (a)-[:CALLS]->(b)'))).toBe(true);
  });
});
