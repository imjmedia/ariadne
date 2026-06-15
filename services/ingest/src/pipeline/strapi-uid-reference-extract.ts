/**
 * UIDs Strapi (`api::foo.bar`) en lifecycles, cron y otros JS del backend.
 * Post-sync enlaza `(File)-[:INVOKES_STRAPI_ROUTE]->(StrapiRoute)` vía content-type.
 */

const STRAPI_UID_CALL_RE =
  /strapi\.(?:service|controller|db\.query)\s*\(\s*['"](api::[^'"]+)['"]/g;

export function extractStrapiUidReferences(source: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  STRAPI_UID_CALL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = STRAPI_UID_CALL_RE.exec(source)) !== null) {
    const uid = m[1]!.trim();
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    out.push(uid);
  }
  return out;
}

/** `api::campania.campania` → `campania` (folder API Strapi). */
export function apiNameFromStrapiUid(uid: string): string | null {
  const m = uid.trim().match(/^api::([^.]+)\./i);
  return m?.[1] ?? null;
}
