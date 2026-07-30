/** Handoff NEW→LEG item from The Forge `integrationHandoff.items`. */
export interface ForgeIntegrationHandoffItem {
  id: string;
  title: string;
  description: string;
  actor?: string;
  status?: string;
  acceptanceCriteria?: string[];
  legacyStageId?: string;
}

export interface ForgeIntegrationHandoffDocument {
  items: ForgeIntegrationHandoffItem[];
}

export interface ForgeIntegrationHandoffSourceOption {
  forgeProjectId: string;
  forgeProjectName: string;
  groupName?: string | null;
  sentHandoffCount: number;
  linkedLegacyProjectId?: string | null;
}

export interface ImportIntegrationHandoffsResult {
  batchId: string;
  batchLabel: string;
  sourceForgeProjectId: string;
  sourceForgeProjectName: string;
  created: Array<{ conversationId: string; handoffId: string; title: string }>;
  skipped: Array<{ handoffId: string; title: string; reason: string }>;
}

export interface ChatIntegrationBatchDto {
  id: string;
  label: string;
  sourceForgeProjectId: string;
  sourceForgeProjectName: string | null;
  conversationCount: number;
  forgePromotionStatus: string | null;
  forgeStageId: string | null;
  forgeStageUrl: string | null;
  createdAt: string;
}
