/**
 * @fileoverview Orquesta MDD fusionado a nivel proyecto (multi-root → Forge import).
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { MddPersistenceService } from './mdd-persistence.service';
import { ChatService } from '../chat/chat.service';
import { ProjectsService } from '../projects/projects.service';
import type { MddEvidenceDocument, MddMultiRootBlock } from '../chat/mdd-document.types';
import { mergeMddEvidenceDocuments, type MddMergeSource } from '../chat/mdd-merge.util';

export type MddProjectMergeResult = {
  projectId: string;
  projectName: string | null;
  mdd: MddEvidenceDocument;
  sources: MddMergeSource[];
};

@Injectable()
export class MddProjectMergeService {
  constructor(
    private readonly projects: ProjectsService,
    private readonly mddPersistence: MddPersistenceService,
    private readonly chat: ChatService,
  ) {}

  async buildMergedForProject(
    projectId: string,
    userDescription = 'Brownfield merged MDD (project multi-root)',
    options?: { preferSnapshots?: boolean; live?: boolean },
  ): Promise<MddProjectMergeResult> {
    const project = await this.projects.findOne(projectId);
    if (project.repositories.length === 0) {
      throw new NotFoundException(`Project ${projectId} has no indexed repositories`);
    }

    const preferSnapshots = options?.preferSnapshots !== false && options?.live !== true;
    const sources: MddMergeSource[] = [];

    for (const repo of project.repositories) {
      const slug = `${repo.projectKey}/${repo.repoSlug}`;
      let mdd: MddEvidenceDocument;
      let fromSnapshot = false;
      let snapshotId: string | undefined;

      const snap = preferSnapshots ? await this.mddPersistence.getLatest(repo.id) : null;
      if (snap?.mddJson) {
        mdd = snap.mddJson as unknown as MddEvidenceDocument;
        fromSnapshot = true;
        snapshotId = snap.id;
      } else {
        mdd = await this.chat.buildMddEvidenceForRepository(
          repo.id,
          projectId,
          userDescription,
          '',
          [],
          false,
        );
      }

      sources.push({
        repositoryId: repo.id,
        slug,
        mdd,
        fromSnapshot,
        snapshotId,
      });
    }

    const allRepoIds = project.repositories.map((r) => r.id);
    const multiRoot = await this.chat.buildMultiRootBlockForProject(projectId, allRepoIds);

    const mdd = mergeMddEvidenceDocuments(sources, multiRoot);
    return {
      projectId: project.id,
      projectName: project.name,
      mdd,
      sources,
    };
  }
}
