/**
 * Serialize/deserialize Falkor subgraph snapshots as JSONL + zstd.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { compress, decompress } from '@mongodb-js/zstd';
import type {
  GraphArtifactCompressionTier,
  GraphArtifactManifest,
  GraphArtifactRecord,
} from './graph-artifact.types';

export const ARIADNE_ARTIFACT_DIR = '.ariadne';
export const MANIFEST_FILENAME = 'manifest.json';
export const GITATTRIBUTES_LINES = ['.ariadne/*.zst merge=ours', '.ariadne/manifest.json merge=ours'];

/** MERGE-key properties per primary label (aligned with pipeline/producer). */
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

export function artifactFilename(repoId: string): string {
  return `graph-${repoId}.jsonl.zst`;
}

export function zstdLevelForTier(tier: GraphArtifactCompressionTier): number {
  return tier === 'best' ? 9 : 3;
}

export function normalizeLabels(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean).sort();
  if (typeof raw === 'string') return [raw];
  return [];
}

export function normalizeProps(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

/** Stable node key for roundtrip import/export. */
export function buildNodeKey(labels: string[], props: Record<string, unknown>): string {
  const sortedLabels = [...labels].sort();
  const primary = sortedLabels.find((l) => MERGE_KEYS_BY_LABEL[l]) ?? sortedLabels[0] ?? 'Node';
  const keys = MERGE_KEYS_BY_LABEL[primary] ?? ['projectId', 'repoId', 'name', 'path'];
  const parts: string[] = [primary];
  for (const k of keys) {
    const v = props[k];
    if (v !== undefined && v !== null) parts.push(`${k}=${String(v)}`);
  }
  if (parts.length === 1) {
    for (const k of Object.keys(props).sort()) {
      parts.push(`${k}=${String(props[k])}`);
    }
  }
  return parts.join('|');
}

export function serializeRecords(records: GraphArtifactRecord[]): string {
  return records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : '');
}

export function parseJsonl(content: string): GraphArtifactRecord[] {
  const out: GraphArtifactRecord[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = JSON.parse(trimmed) as GraphArtifactRecord;
    out.push(parsed);
  }
  return out;
}

export async function compressJsonl(
  jsonl: string,
  tier: GraphArtifactCompressionTier,
): Promise<Buffer> {
  const level = zstdLevelForTier(tier);
  return compress(Buffer.from(jsonl, 'utf8'), level);
}

export async function decompressJsonl(buffer: Buffer): Promise<string> {
  const out = await decompress(buffer);
  return out.toString('utf8');
}

export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

export function artifactPaths(workDir: string, repoId: string): {
  dir: string;
  artifactPath: string;
  manifestPath: string;
  gitAttributesPath: string;
} {
  const dir = path.join(workDir, ARIADNE_ARTIFACT_DIR);
  const file = artifactFilename(repoId);
  return {
    dir,
    artifactPath: path.join(dir, file),
    manifestPath: path.join(dir, MANIFEST_FILENAME),
    gitAttributesPath: path.join(workDir, '.gitattributes'),
  };
}

export function ensureArtifactDir(workDir: string): string {
  const dir = path.join(workDir, ARIADNE_ARTIFACT_DIR);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function ensureGitAttributesMergeOurs(workDir: string): void {
  const target = path.join(workDir, '.gitattributes');
  const block = GITATTRIBUTES_LINES.join('\n') + '\n';
  if (!fs.existsSync(target)) {
    fs.writeFileSync(target, block, 'utf8');
    return;
  }
  const existing = fs.readFileSync(target, 'utf8');
  if (GITATTRIBUTES_LINES.every((line) => existing.includes(line))) return;
  fs.appendFileSync(target, existing.endsWith('\n') ? block : `\n${block}`, 'utf8');
}

export function writeManifest(manifestPath: string, manifest: GraphArtifactManifest): void {
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export function readManifest(manifestPath: string): GraphArtifactManifest {
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as GraphArtifactManifest;
  if (raw.version !== 1) {
    throw new Error(`Unsupported graph artifact manifest version: ${String(raw.version)}`);
  }
  return raw;
}

export function verifyManifestSha256(manifest: GraphArtifactManifest, artifactPath: string): void {
  const bytes = fs.readFileSync(artifactPath);
  const actual = sha256Hex(bytes);
  if (actual !== manifest.sha256) {
    throw new Error(
      `Graph artifact SHA-256 mismatch: expected ${manifest.sha256}, got ${actual}`,
    );
  }
}
