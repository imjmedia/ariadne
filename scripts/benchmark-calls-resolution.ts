#!/usr/bin/env npx tsx
/**
 * Minimal CALLS resolution benchmark: Falkor CALLS edges vs grep/heuristic baseline.
 *
 * Usage:
 *   npx tsx scripts/benchmark-calls-resolution.ts \
 *     --project-id <uuid> --repo-id <uuid> \
 *     --sample scripts/benchmark-calls-resolution.sample.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { FalkorDB } from 'falkordb';

interface SampleSite {
  callerFile: string;
  callerFn: string;
  calleeName: string;
  expectedCalleeFile: string;
}

interface Args {
  projectId: string;
  repoId: string;
  samplePath: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const projectId = get('--project-id') ?? process.env.PROJECT_ID;
  const repoId = get('--repo-id') ?? process.env.REPO_ID;
  const samplePath = get('--sample') ?? 'scripts/benchmark-calls-resolution.sample.json';
  if (!projectId || !repoId) {
    console.error('Required: --project-id and --repo-id');
    process.exit(1);
  }
  return { projectId, repoId, samplePath };
}

function graphName(projectId: string): string {
  const shard =
    process.env.FALKOR_SHARD_BY_PROJECT === '1' ||
    process.env.FALKOR_SHARD_BY_PROJECT?.toLowerCase() === 'true';
  return shard ? `AriadneSpecs:${projectId.replace(/[^a-zA-Z0-9:_-]/g, '_')}` : 'AriadneSpecs';
}

/** Naive heuristic: callee file shares basename or appears in import path string. */
function heuristicHit(site: SampleSite, repoRoot: string | null): boolean {
  if (!repoRoot) return false;
  const callerAbs = path.join(repoRoot, site.callerFile);
  if (!fs.existsSync(callerAbs)) return false;
  const src = fs.readFileSync(callerAbs, 'utf8');
  const importLines = src
    .split('\n')
    .filter((l) => /^\s*import\s/.test(l) || /require\s*\(/.test(l));
  const calleeBase = path.basename(site.expectedCalleeFile).replace(/\.[^.]+$/, '');
  const importMentionsExpected = importLines.some(
    (l) => l.includes(site.expectedCalleeFile) || l.includes(calleeBase),
  );
  if (importMentionsExpected) return true;
  const guess = path.join(path.dirname(callerAbs), `${site.calleeName}.ts`);
  return fs.existsSync(guess);
}

async function falkorHit(
  graph: { query: (q: string, o?: { params?: Record<string, string> }) => Promise<unknown> },
  site: SampleSite,
  projectId: string,
  repoId: string,
): Promise<boolean> {
  const q = `MATCH (caller:Function {path: $callerFile, name: $callerFn, projectId: $projectId, repoId: $repoId})
             -[:CALLS]->(callee:Function)
             RETURN callee.path AS path LIMIT 5`;
  const res = (await graph.query(q, {
    params: {
      callerFile: site.callerFile,
      callerFn: site.callerFn,
      projectId,
      repoId,
    },
  })) as { data?: Array<{ path: string }> };
  const paths = (res.data ?? []).map((r) => r.path);
  return paths.includes(site.expectedCalleeFile);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const sample: SampleSite[] = JSON.parse(fs.readFileSync(args.samplePath, 'utf8'));
  const repoRoot = process.env.REPO_ROOT ?? null;

  const host = process.env.FALKORDB_HOST ?? 'localhost';
  const port = parseInt(process.env.FALKORDB_PORT ?? '6379', 10);
  const client = await FalkorDB.connect({ socket: { host, port } });
  const graph = client.selectGraph(graphName(args.projectId));

  let falkorHits = 0;
  let heuristicHits = 0;

  for (const site of sample) {
    if (await falkorHit(graph, site, args.projectId, args.repoId)) falkorHits++;
    if (heuristicHit(site, repoRoot)) heuristicHits++;
  }

  await client.close();

  const n = sample.length || 1;
  const report = {
    sampleSize: sample.length,
    falkorHits,
    heuristicHits,
    falkorMissRate: 1 - falkorHits / n,
    heuristicMissRate: 1 - heuristicHits / n,
    projectId: args.projectId,
    repoId: args.repoId,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
