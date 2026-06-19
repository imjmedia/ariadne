/** When Ariadne should POST The Forge /converge/trigger after a successful index job. */
export type TheForgeConvergeTriggerMode = 'off' | 'full' | 'incremental' | 'all';

/** Sync job kind that completed (full resync vs webhook incremental). */
export type TheForgeConvergeSyncKind = 'full' | 'incremental';

export interface TheForgeConvergeTriggerResult {
  triggered: boolean;
  ok?: boolean;
  status?: number;
  reason?: string;
  mode?: TheForgeConvergeTriggerMode;
  theforgeProjectId?: string;
}
