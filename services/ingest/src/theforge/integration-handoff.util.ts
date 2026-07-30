/**
 * Parse The Forge integrationHandoff payloads.
 */
import type {
  ForgeIntegrationHandoffDocument,
  ForgeIntegrationHandoffItem,
} from './integration-handoff.types';
import { readForgeProjectId, readForgeProjectName, readForgeProjectType } from './forge-project-list.util';

export function isForgeNewProject(row: Record<string, unknown>): boolean {
  const type = readForgeProjectType(row);
  return type === 'NEW' || type === 'GREENFIELD';
}

export function readForgeIntegrationHandoff(row: Record<string, unknown>): ForgeIntegrationHandoffDocument | null {
  const raw = row.integrationHandoff ?? row.integration_handoff;
  if (!raw || typeof raw !== 'object') return null;
  const doc = raw as Record<string, unknown>;
  const itemsRaw = doc.items;
  if (!Array.isArray(itemsRaw)) return null;

  const items: ForgeIntegrationHandoffItem[] = [];
  for (const entry of itemsRaw) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const id = String(item.id ?? '').trim();
    const title = String(item.title ?? '').trim();
    const description = String(item.description ?? '').trim();
    if (!id || !title) continue;
    items.push({
      id,
      title,
      description,
      actor: item.actor != null ? String(item.actor) : undefined,
      status: item.status != null ? String(item.status) : undefined,
      acceptanceCriteria: Array.isArray(item.acceptanceCriteria)
        ? item.acceptanceCriteria.map((c) => String(c))
        : Array.isArray(item.acceptance_criteria)
          ? item.acceptance_criteria.map((c) => String(c))
          : undefined,
      legacyStageId:
        item.legacyStageId != null
          ? String(item.legacyStageId)
          : item.legacy_stage_id != null
            ? String(item.legacy_stage_id)
            : undefined,
    });
  }

  return items.length > 0 ? { items } : null;
}

export function filterSentHandoffs(doc: ForgeIntegrationHandoffDocument): ForgeIntegrationHandoffItem[] {
  return doc.items.filter((item) => {
    const status = (item.status ?? 'sent').trim().toLowerCase();
    return status === 'sent';
  });
}

export function buildHandoffSeedMessage(item: ForgeIntegrationHandoffItem, sourceProjectName: string): string {
  const lines = [
    `## Handoff de integración \`${item.id}\``,
    '',
    `**Proyecto origen (NEW):** ${sourceProjectName}`,
    `**Título:** ${item.title}`,
  ];
  if (item.actor?.trim()) {
    lines.push(`**Actor:** ${item.actor.trim()}`);
  }
  lines.push('', '### Descripción', '', item.description.trim());
  if (item.acceptanceCriteria?.length) {
    lines.push('', '### Criterios de aceptación');
    for (const criterion of item.acceptanceCriteria) {
      lines.push(`- ${criterion}`);
    }
  }
  lines.push(
    '',
    '---',
    '',
    'Analiza qué cambios se requieren en el **codebase brownfield de este proyecto Ariadne** para implementar esta integración. Identifica archivos a tocar, riesgos, dependencias con el sistema NEW y un plan de modificación concreto.',
  );
  return lines.join('\n');
}

export function readForgeProjectSummary(row: Record<string, unknown>): {
  id: string;
  name: string;
  linkedLegacyProjectId: string | null;
} {
  const linked = row.linkedLegacyProjectId ?? row.linked_legacy_project_id;
  const linkedObj = row.linkedLegacyProject;
  const linkedFromObj =
    linkedObj && typeof linkedObj === 'object' && 'id' in linkedObj
      ? String((linkedObj as { id?: unknown }).id ?? '').trim() || null
      : null;
  return {
    id: readForgeProjectId(row),
    name: readForgeProjectName(row),
    linkedLegacyProjectId:
      linked != null ? String(linked).trim() || null : linkedFromObj,
  };
}
