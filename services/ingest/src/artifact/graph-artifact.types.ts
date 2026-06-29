/** Compression tier for graph artifact export. */
export type GraphArtifactCompressionTier = 'fast' | 'best';

/** Sidecar manifest written beside the compressed JSONL artifact. */
export interface GraphArtifactManifest {
  version: 1;
  projectId: string;
  repoId: string;
  artifactFile: string;
  sha256: string;
  nodeCount: number;
  edgeCount: number;
  exportedAt: string;
  commitSha?: string | null;
  compressionTier: GraphArtifactCompressionTier;
  zstdLevel: number;
}

/** One JSONL record — node or relationship. */
export type GraphArtifactRecord =
  | {
      kind: 'node';
      key: string;
      labels: string[];
      props: Record<string, unknown>;
    }
  | {
      kind: 'edge';
      type: string;
      fromKey: string;
      toKey: string;
      props: Record<string, unknown>;
    };

export interface GraphArtifactExportResult {
  manifest: GraphArtifactManifest;
  artifactPath: string;
  manifestPath: string;
  workDir: string;
}

export interface GraphArtifactBootstrapResult {
  imported: boolean;
  reason?: string;
  nodeCount?: number;
  edgeCount?: number;
  skipGraphWrite?: boolean;
  manifest?: GraphArtifactManifest;
}
