/**
 * Cliente ingest para brownfield / MDD fusionado multi-root (The Forge, Cursor).
 */

export type BrownfieldParityPackMode = "repo" | "project";

export type BrownfieldMcpFetchBody = {
  projectId?: string;
  userDescription?: string;
  preferSnapshots?: boolean;
  live?: boolean;
};

export type BrownfieldMcpFetchResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; status?: number };

function ingestBase(): string {
  return (process.env.INGEST_URL ?? process.env.ARIADNESPEC_INGEST_URL ?? "http://localhost:3002").replace(
    /\/$/,
    "",
  );
}

export async function fetchBrownfieldParityPack(opts: {
  mode: BrownfieldParityPackMode;
  projectId: string;
  repositoryId?: string;
  body?: BrownfieldMcpFetchBody;
}): Promise<BrownfieldMcpFetchResult> {
  const base = ingestBase();
  const url =
    opts.mode === "project"
      ? `${base}/internal/projects/${encodeURIComponent(opts.projectId)}/brownfield-parity-pack`
      : `${base}/internal/repositories/${encodeURIComponent(opts.repositoryId ?? opts.projectId)}/brownfield-parity-pack`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: opts.projectId,
        userDescription: opts.body?.userDescription,
        preferSnapshots: opts.body?.preferSnapshots,
        live: opts.body?.live,
      }),
      signal: AbortSignal.timeout(900_000),
    });
    if (!res.ok) {
      return { ok: false, error: await res.text(), status: res.status };
    }
    return { ok: true, data: await res.json() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function fetchMergedProjectMdd(opts: {
  projectId: string;
  body?: BrownfieldMcpFetchBody;
}): Promise<BrownfieldMcpFetchResult> {
  const base = ingestBase();
  const url = `${base}/internal/projects/${encodeURIComponent(opts.projectId)}/mdd-evidence-merged`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userDescription: opts.body?.userDescription,
        preferSnapshots: opts.body?.preferSnapshots,
        live: opts.body?.live,
      }),
      signal: AbortSignal.timeout(900_000),
    });
    if (!res.ok) {
      return { ok: false, error: await res.text(), status: res.status };
    }
    return { ok: true, data: await res.json() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export function formatBrownfieldMcpEnvelope(
  toolName: string,
  data: unknown,
): string {
  return JSON.stringify(
    {
      format: "brownfield_mcp_v1",
      source: toolName,
      data,
    },
    null,
    2,
  );
}
