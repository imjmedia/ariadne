/** Max concurrent fetch+parse tasks during full sync phase `indexing`. */
export function syncParseConcurrencyFromEnv(): number {
  const raw = process.env.SYNC_PARSE_CONCURRENCY?.trim();
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < 1) return 4;
  return Math.min(n, 32);
}
