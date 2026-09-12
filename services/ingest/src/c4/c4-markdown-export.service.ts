/**
 * @fileoverview Export documental C4 estilo Litho (6 markdowns).
 */
import { Injectable } from '@nestjs/common';
import { buildC4MarkdownBundle, type C4MarkdownFile, type C4Model } from 'ariadne-common';
import { ProjectsService } from '../projects/projects.service';
import { C4SnapshotService } from './c4-snapshot.service';
import { C4SequenceExtractor } from './c4-sequence.extractor';

@Injectable()
export class C4MarkdownExportService {
  constructor(
    private readonly projects: ProjectsService,
    private readonly snapshots: C4SnapshotService,
    private readonly sequence: C4SequenceExtractor,
  ) {}

  async buildBundle(projectId: string): Promise<{ files: C4MarkdownFile[]; merged: string }> {
    const project = await this.projects.findOne(projectId);
    const projectName = project.name?.trim() || projectId;

    const context = (await this.snapshots.getLatest(projectId, 'context'))?.modelJson ?? null;
    const container = (await this.snapshots.getLatest(projectId, 'container'))?.modelJson ?? null;
    const component = (await this.snapshots.getLatest(projectId, 'component'))?.modelJson ?? null;

    let sequenceTitle: string | undefined;
    let sequenceSteps: string[] | undefined;
    try {
      const { spec } = await this.sequence.buildRepresentativeFlow(projectId);
      sequenceTitle = spec.title;
      sequenceSteps = spec.steps.map((s) => `${s.from} → ${s.to}: ${s.label}`);
    } catch {
      /* optional */
    }

    const files = buildC4MarkdownBundle({
      projectName,
      projectId,
      context,
      container,
      component,
      sequenceTitle,
      sequenceSteps,
    });

    const merged = files.map((f) => `<!-- ${f.name} -->\n\n${f.content}`).join('\n\n---\n\n');
    return { files, merged };
  }

  summarizeModels(models: {
    context?: C4Model | null;
    container?: C4Model | null;
  }): string {
    const parts: string[] = [];
    if (models.container) {
      const containers = models.container.elements.filter((e) => e.kind === 'container');
      parts.push(
        `**Container:** ${containers.map((c) => c.name).join(', ') || '—'} (${containers.length} nodos)`,
      );
    }
    if (models.context) {
      const ext = models.context.elements.filter((e) => e.kind === 'external');
      parts.push(`**Context:** ${ext.length} sistema(s) externo(s)`);
    }
    return parts.join('\n');
  }
}
