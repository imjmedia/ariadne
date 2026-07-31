/**
 * Multi-query file discovery for NEW-LEG integration handoffs (UX journey + AC + path patterns).
 */
import type { ParsedIntegrationHandoff } from './integration-handoff-message.util.js';

export const INTEGRATION_HANDOFF_PATH_SEGMENTS = [
  'catalog',
  'catalogo',
  'Catalog',
  'preview',
  'Preview',
  'previsualiz',
  'Visualiz',
  'visualiza',
  'costo',
  'Costo',
  'pauta',
  'Pauta',
  'Medio',
  'medio',
] as const;

/** Focused search queries derived from handoff text (not the full seed boilerplate). */
export function buildIntegrationHandoffSearchQueries(
  parsed: ParsedIntegrationHandoff,
  fullMessage: string,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (q: string) => {
    const t = q.trim();
    if (t.length < 12 || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  if (parsed.title?.trim()) push(parsed.title.trim());
  if (parsed.description.trim()) push(parsed.description.trim().slice(0, 1200));

  const desc = parsed.description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (/catalogo/.test(desc) && /previsualiz/.test(desc)) {
    push('catálogo previsualizador medio preview modal detalle');
  }
  if (/costos?\s+asociados/.test(desc)) {
    push('costos asociados listado nombre concepto pauta');
  }
  if (/pauta/.test(desc)) {
    push('pauta costos asociados visualización nombres');
  }
  if (/campania/.test(desc) || /campaña/.test(parsed.description)) {
    push('campaña lista de precios medio catálogo');
  }
  if (/micro\s*servicio|microservicio/.test(desc) || /servicio de costos/i.test(fullMessage)) {
    push('API costos listas precios cliente query');
  }

  for (const ac of parsed.acceptanceCriteria.slice(0, 5)) {
    if (ac.length >= 20) push(ac);
  }

  push(fullMessage.slice(0, 1500));
  return out.slice(0, 10);
}

function pageFolderKey(path: string): string {
  const m = path.match(/(?:^|\/)pages\/([^/]+)/i);
  return m?.[1]?.toLowerCase() ?? '';
}

function handoffMentionsSingleMediaModule(parsed: ParsedIntegrationHandoff): boolean {
  const blob = `${parsed.title ?? ''} ${parsed.description}`.toLowerCase();
  return /\b(camion|camiones|urbano|valla|espectacular)\b/.test(blob);
}

/** Score a candidate file for handoff relevance. */
export function scoreIntegrationHandoffFile(
  path: string,
  hitCount: number,
  parsed: ParsedIntegrationHandoff,
): number {
  let score = hitCount * 12;
  const p = path.toLowerCase();

  for (const seg of INTEGRATION_HANDOFF_PATH_SEGMENTS) {
    if (p.includes(seg.toLowerCase())) score += 4;
  }

  const desc = parsed.description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const catalogScope = /catalogo/.test(desc) && /previsualiz/.test(desc);

  if (catalogScope && !handoffMentionsSingleMediaModule(parsed)) {
    if (/datacamion|datacami[oó]n|revisionunidades/i.test(p)) score -= 18;
    if (/catalog|catalogo/.test(p)) score += 10;
    if (/previsualiz|preview|visualiz/i.test(p)) score += 8;
  }

  if (/costos?\s+asociados/.test(desc) && /costo|pauta/i.test(p)) score += 6;

  return score;
}

export function mergeIntegrationHandoffFileCandidates(
  batches: Array<Array<{ path: string; repoId: string }>>,
  parsed: ParsedIntegrationHandoff,
  maxFiles: number,
): Array<{ path: string; repoId: string }> {
  const hitMap = new Map<string, { path: string; repoId: string; hits: number }>();
  for (const batch of batches) {
    for (const f of batch) {
      if (!f?.path) continue;
      const key = `${f.path}\t${f.repoId ?? ''}`;
      const cur = hitMap.get(key);
      if (cur) cur.hits += 1;
      else hitMap.set(key, { path: f.path, repoId: f.repoId ?? '', hits: 1 });
    }
  }

  const ranked = [...hitMap.values()]
    .map((f) => ({
      path: f.path,
      repoId: f.repoId,
      score: scoreIntegrationHandoffFile(f.path, f.hits, parsed),
      folder: pageFolderKey(f.path),
    }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  if (ranked.length === 0) return [];

  const folderCounts = new Map<string, number>();
  for (const r of ranked.slice(0, Math.min(12, ranked.length))) {
    if (r.folder) folderCounts.set(r.folder, (folderCounts.get(r.folder) ?? 0) + 1);
  }
  let dominantFolder = '';
  let dominantCount = 0;
  for (const [folder, count] of folderCounts) {
    if (count > dominantCount) {
      dominantCount = count;
      dominantFolder = folder;
    }
  }

  const descNorm = parsed.description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const needsDiversity =
    dominantCount >= 3 &&
    dominantFolder.length > 0 &&
    /catalogo/.test(descNorm) &&
    !handoffMentionsSingleMediaModule(parsed);

  const picked: typeof ranked = [];
  const pickedKeys = new Set<string>();

  if (needsDiversity) {
    for (const r of ranked) {
      if (r.folder && r.folder !== dominantFolder && picked.length < 4) {
        const k = `${r.path}\t${r.repoId}`;
        if (!pickedKeys.has(k)) {
          picked.push(r);
          pickedKeys.add(k);
        }
      }
    }
  }

  for (const r of ranked) {
    if (picked.length >= maxFiles) break;
    const k = `${r.path}\t${r.repoId}`;
    if (pickedKeys.has(k)) continue;
    picked.push(r);
    pickedKeys.add(k);
  }

  return picked.slice(0, maxFiles).map(({ path, repoId }) => ({ path, repoId }));
}

/** Cypher path segments for catalog/preview/cost patterns. */
export function integrationHandoffPathPatternTerms(): string[] {
  return [
    'catalog',
    'Catalog',
    'catalogo',
    'Catalogo',
    'previsualiz',
    'Previsualiz',
    'Preview',
    'preview',
    'Visualiz',
    'visualiza',
    'CostoAsociado',
    'costoAsociado',
    'costos-asociados',
    'CostosAsociados',
  ];
}

/** Component name fragments for cost-display patterns in pauta / preview. */
export function integrationHandoffComponentTerms(): string[] {
  return ['Costo', 'costo', 'Asociado', 'asociado', 'Pauta', 'Preview', 'Previsualiz', 'Catalog'];
}
