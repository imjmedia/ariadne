/**
 * @fileoverview Brownfield parity pack export for The Forge import.
 */
import { Injectable } from '@nestjs/common';
import { MddPersistenceService } from '../mdd-persistence/mdd-persistence.service';
import { ChatService } from '../chat/chat.service';
import { ScaffoldFromMddService } from '../scaffold/scaffold-from-mdd.service';

export interface BrownfieldParityPack {
  schemaVersion: '1.0';
  source: 'ariadne';
  generatedAt: string;
  repositoryId: string;
  projectId: string;
  mdd: Record<string, unknown>;
  navigationMapHint: string;
  scaffoldPreview: { fileCount: number; paths: string[] };
  modificationPlanSeed: string;
}

@Injectable()
export class BrownfieldParityPackService {
  constructor(
    private readonly mddPersistence: MddPersistenceService,
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
}
