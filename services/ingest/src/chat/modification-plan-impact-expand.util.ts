/**
 * Rank and merge modification-plan candidates after CALLS/IMPORTS/RENDERS expansion.
 */
import { normalizePathKey } from './chat-scope.util';

export interface ImpactRankedFile {
  path: string;
  repoId: string;
  impactScore: number;
  fromSeed: boolean;
}

export function mergeImpactExpandedFiles(
  seeds: Array<{ path: string; repoId: string }>,
  expanded: Array<{ path: string; repoId: string; hopBonus?: number }>,
  opts?: { maxFiles?: number },
): ImpactRankedFile[] {
  const maxFiles = opts?.maxFiles ?? 80;
  const map = new Map<string, ImpactRankedFile>();

  const keyOf = (path: string, repoId: string) => `${normalizePathKey(path)}\t${repoId}`;

  for (const s of seeds) {
    const path = normalizePathKey(s.path);
    if (!path) continue;
    map.set(keyOf(path, s.repoId), {
      path,
      repoId: s.repoId,
      impactScore: 1000,
      fromSeed: true,
    });
  }

  for (const e of expanded) {
    const path = normalizePathKey(e.path);
    if (!path) continue;
    const k = keyOf(path, e.repoId);
    const existing = map.get(k);
    const hopBonus = e.hopBonus ?? 50;
    if (existing) {
      existing.impactScore += hopBonus;
    } else {
      map.set(k, {
        path,
        repoId: e.repoId,
        impactScore: hopBonus,
        fromSeed: false,
      });
    }
  }

  return [...map.values()]
    .sort(
      (a, b) =>
        b.impactScore - a.impactScore ||
        a.path.localeCompare(b.path) ||
        a.repoId.localeCompare(b.repoId),
    )
    .slice(0, maxFiles);
}

export function applyDependentBoost(
  ranked: ImpactRankedFile[],
  dependentCounts: Map<string, number>,
): ImpactRankedFile[] {
  return ranked
    .map((r) => {
      const boost = dependentCounts.get(normalizePathKey(r.path)) ?? 0;
      return { ...r, impactScore: r.impactScore + Math.min(boost, 200) * 5 };
    })
    .sort(
      (a, b) =>
        b.impactScore - a.impactScore ||
        a.path.localeCompare(b.path) ||
        a.repoId.localeCompare(b.repoId),
    );
}

/** Suggest phase buckets by impact rank thirds. */
export function suggestPhaseForRank(index: number, total: number): string {
  if (total <= 1) return '1-core';
  const third = Math.max(1, Math.ceil(total / 3));
  if (index < third) return '1-core';
  if (index < third * 2) return '2-integrate';
  return '3-validate';
}
