/**
 * @fileoverview Brownfield parity pack export for The Forge import.
 */
import { Injectable } from '@nestjs/common';
import { MddPersistenceService } from '../mdd-persistence/mdd-persistence.service';
import { MddProjectMergeService } from '../mdd-persistence/mdd-project-merge.service';
import { ChatService } from '../chat/chat.service';
import { ScaffoldFromMddService } from '../scaffold/scaffold-from-mdd.service';
import type { MddEvidenceDocument } from '../chat/mdd-document.types';

export interface BrownfieldParityPack {
  schemaVersion: '1.0';
  source: 'ariadne';
  generatedAt: string;
  /** Repo ancla (single-repo o primero del merge). */
  repositoryId: string;
  projectId: string;
  /** Todos los repos incluidos cuando `mergeMode=project_multi_root`. */
  repositoryIds?: string[];
  mergeMode?: 'single_repo' | 'project_multi_root';
  mddSources?: Array<{
    repositoryId: string;
    slug: string;
    fromSnapshot: boolean;
    snapshotId: string | null;
  }>;
  mdd: Record<string, unknown>;
  navigationMapHint: string;
  scaffoldPreview: { fileCount: number; paths: string[] };
  modificationPlanSeed: string;
}

@Injectable()
export class BrownfieldParityPackService {
  constructor(
    private readonly mddPersistence: MddPersistenceService,
    private readonly mddMerge: MddProjectMergeService,
    private readonly chat: ChatService,
    private readonly scaffold: ScaffoldFromMddService,
  ) {}

  async build(
    repositoryId: string,
    projectId: string,
    userDescription = 'Brownfield parity baseline',
  ): Promise<BrownfieldParityPack> {
    const snap = await this.mddPersistence.getLatest(repositoryId);
    let mdd: Record<string, unknown>;
    if (snap?.mddJson) {
      mdd = snap.mddJson;
    } else {
      const doc = await this.chat.buildMddEvidenceForRepository(
        repositoryId,
        projectId,
        userDescription,
        '',
        [],
        false,
      );
      mdd = doc as unknown as Record<string, unknown>;
    }
    const mod = await this.chat.getModificationPlanFilesOnlyByProject(
      projectId,
      userDescription.slice(0, 2000),
      { repoIds: [repositoryId] },
    );
    const scaffold = await this.scaffold.generate(repositoryId, projectId, ['react', 'nest'], undefined);
    return {
      schemaVersion: '1.0',
      source: 'ariadne',
      generatedAt: new Date().toISOString(),
      repositoryId,
      projectId,
      mdd,
      navigationMapHint:
        'Call MCP generate_navigation_map(projectId) for full route/form/API map; import into Forge UX/UI sections.',
      scaffoldPreview: {
        fileCount: scaffold.files.length,
        paths: scaffold.files.map((f) => f.path).slice(0, 30),
      },
      modificationPlanSeed: JSON.stringify({ filesToModify: mod.slice(0, 50) }),
    };
  }

  /** Parity pack con MDD fusionado de todos los roots del proyecto Ariadne. */
  async buildForProject(
    projectId: string,
    userDescription = 'Brownfield parity baseline (project multi-root)',
    options?: { preferSnapshots?: boolean; live?: boolean },
  ): Promise<BrownfieldParityPack> {
    const merged = await this.mddMerge.buildMergedForProject(projectId, userDescription, options);
    const primaryRepoId = merged.sources[0]!.repositoryId;
    const mod = await this.chat.getModificationPlanFilesOnlyByProject(
      projectId,
      userDescription.slice(0, 2000),
      undefined,
    );
    const scaffold = await this.scaffold.generate(
      primaryRepoId,
      projectId,
      ['react', 'nest'],
      merged.mdd as MddEvidenceDocument,
    );
    const multiRoot = merged.sources.length > 1;
    return {
      schemaVersion: '1.0',
      source: 'ariadne',
      generatedAt: new Date().toISOString(),
      repositoryId: primaryRepoId,
      projectId: merged.projectId,
      repositoryIds: merged.sources.map((s) => s.repositoryId),
      mergeMode: multiRoot ? 'project_multi_root' : 'single_repo',
      mddSources: merged.sources.map((s) => ({
        repositoryId: s.repositoryId,
        slug: s.slug,
        fromSnapshot: s.fromSnapshot,
        snapshotId: s.snapshotId ?? null,
      })),
      mdd: merged.mdd as unknown as Record<string, unknown>,
      navigationMapHint:
        'Call MCP generate_navigation_map(projectId) for full route/form/API map across all roots; import into Forge UX/UI sections.',
      scaffoldPreview: {
        fileCount: scaffold.files.length,
        paths: scaffold.files.map((f) => f.path).slice(0, 30),
      },
      modificationPlanSeed: JSON.stringify({ filesToModify: mod.slice(0, 80) }),
    };
  }
}
