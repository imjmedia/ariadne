/** Mensaje de error Archify para la UI (generate / sequence / compare). */
export function formatC4ArchifyFailure(opts: {
  htmlReady?: boolean;
  archifyError?: string | null;
  archifyBin?: string | null;
  fallback: string;
}): string {
  if (opts.htmlReady) return '';
  const lines = [opts.fallback];
  if (opts.archifyBin) lines.push(`CLI: ${opts.archifyBin}`);
  const detail = opts.archifyError?.trim();
  if (detail) lines.push(detail);
  return lines.join('\n');
}
