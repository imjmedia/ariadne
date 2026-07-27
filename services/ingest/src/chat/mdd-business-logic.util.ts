/**
 * Enriquece business_logic del MDD desde evidence_paths (Strapi + frontend en multi-root).
 */
import type { MddEvidenceDocument } from './mdd-document.types';
import { dedupeBusinessLogic } from './mdd-merge.util';
import { collectFrontendBusinessLogicFromEvidencePaths } from './mdd-frontend-path-fallback';
import { collectStrapiBusinessLogicFromEvidencePaths } from './mdd-strapi-path-fallback';

export function enrichBusinessLogicFromEvidencePaths(
  business: MddEvidenceDocument['business_logic'],
  evidencePaths: string[],
  opts: {
    hasStrapiEvidencePaths: boolean;
    hasFrontendEvidencePaths: boolean;
    maxServices: number;
  },
): MddEvidenceDocument['business_logic'] {
  const parts: MddEvidenceDocument['business_logic'] = [...business];
  if (opts.hasStrapiEvidencePaths) {
    parts.push(...collectStrapiBusinessLogicFromEvidencePaths(evidencePaths, opts.maxServices));
  }
  if (opts.hasFrontendEvidencePaths) {
    parts.push(...collectFrontendBusinessLogicFromEvidencePaths(evidencePaths, opts.maxServices));
  }
  return dedupeBusinessLogic(parts).slice(0, opts.maxServices);
}

/** Condición Cypher (sin WHERE) para paths que alimentan business_logic. */
export const MDD_BUSINESS_LOGIC_FILE_PATH_CYPHER = `
  toLower(f.path) CONTAINS 'src/api/' OR
  toLower(f.path) CONTAINS '/services/' OR
  toLower(f.path) CONTAINS 'content-types/' OR
  toLower(f.path) CONTAINS '/routes/'
`.trim();
