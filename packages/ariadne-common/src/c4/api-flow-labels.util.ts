/** Formatea llamada HTTP sin duplicar método (`GET GET /api`). */
export function formatHttpCallLabel(method: string | undefined, path: string | undefined): string {
  const rawPath = path?.trim() ?? '';
  const methodUpper = method?.trim().toUpperCase() ?? '';
  if (!rawPath) return methodUpper || 'HTTP';
  if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/i.test(rawPath)) return rawPath;
  return methodUpper ? `${methodUpper} ${rawPath}` : rawPath;
}

/** `apps/attendee-app/...` → `Attendee App`; `services/ingest/...` → `Ingest`. */
export function inferMonorepoSegmentLabel(filePath: string | undefined, kind: 'app' | 'service'): string | undefined {
  if (!filePath?.trim()) return undefined;
  const pattern = kind === 'app' ? /(?:^|\/)apps\/([^/]+)/ : /(?:^|\/)services\/([^/]+)/;
  const match = filePath.match(pattern);
  if (!match?.[1]) return undefined;
  return humanizeSlug(match[1]);
}

function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
