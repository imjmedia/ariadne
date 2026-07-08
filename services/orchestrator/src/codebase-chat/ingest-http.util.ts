export interface FetchIngestJsonOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Default 60_000 ms. Use longer values for heavy ingest endpoints. */
  timeoutMs?: number;
  /** Label for error messages (e.g. "analyze-prep"). */
  label?: string;
}

function getErrorCause(err: unknown): unknown {
  if (err instanceof Error && 'cause' in err) {
    return (err as Error & { cause?: unknown }).cause;
  }
  return undefined;
}

function formatFetchError(err: unknown, label: string, url: string): Error {
  const cause = getErrorCause(err);
  const causeMsg =
    cause instanceof Error
      ? cause.message
      : cause != null
        ? String(cause)
        : '';
  const base = err instanceof Error ? err.message : String(err);
  const detail = causeMsg && causeMsg !== base ? ` (${causeMsg})` : '';
  return new Error(`Ingest ${label} failed: ${base}${detail} [${url}]`);
}

/**
 * POST/GET JSON against ingest with timeout and clearer errors than raw undici "fetch failed".
 */
export async function fetchIngestJson<T>(
  url: string,
  options: FetchIngestJsonOptions = {},
): Promise<T> {
  const { method = 'POST', body, timeoutMs = 60_000, label = 'request' } = options;
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (body !== undefined && method !== 'GET') {
    init.body = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error(
        `Ingest ${label} timed out after ${Math.round(timeoutMs / 1000)}s [${url}]`,
      );
    }
    throw formatFetchError(err, label, url);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Ingest ${label} HTTP ${res.status}${text ? `: ${text.slice(0, 500)}` : ''} [${url}]`,
    );
  }

  return res.json() as Promise<T>;
}
