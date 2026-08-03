/**
 * Hash + fingerprint for cached integration-batch Forge preview packs.
 */
import { createHash } from 'crypto';
import type { ForgeDeliverableKind } from './change-promotion-pack.types';

export interface IntegrationPreviewParams {
  batchId: string;
  stageName: string;
  stageKey?: string;
  deliverables: ForgeDeliverableKind[];
  contentFingerprint: string;
}

export function buildIntegrationPreviewParamsHash(params: IntegrationPreviewParams): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        batchId: params.batchId,
        stageName: params.stageName.trim(),
        stageKey: params.stageKey?.trim() ?? '',
        deliverables: [...params.deliverables].sort(),
        contentFingerprint: params.contentFingerprint,
      }),
    )
    .digest('hex')
    .slice(0, 32);
}

export function buildBatchContentFingerprint(
  rows: Array<{ conversationId: string; messageCount: number; lastMessageAt: string | null }>,
): string {
  const normalized = [...rows]
    .sort((a, b) => a.conversationId.localeCompare(b.conversationId))
    .map((row) => ({
      conversationId: row.conversationId,
      messageCount: row.messageCount,
      lastMessageAt: row.lastMessageAt,
    }));
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 16);
}

/** Align preview vs promote cache keys when preview omits explicit stageKey. */
export function resolveIntegrationPreviewStageKey(
  explicitStageKey: string | undefined,
  packStageKey: string,
): string {
  const explicit = explicitStageKey?.trim();
  if (explicit) return explicit;
  return packStageKey.trim();
}
