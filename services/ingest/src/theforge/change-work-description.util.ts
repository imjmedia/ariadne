/**
 * Deterministic work description markdown from a ChangePromotionPack (brownfield handoff).
 */
import type { ChangePromotionPackV1 } from './change-promotion-pack.types';

export function buildChangeWorkDescription(pack: ChangePromotionPackV1): string {
  const lines: string[] = [];
  lines.push(`# ${pack.change.title}`);
  lines.push('');
  if (pack.promotionScope === 'integration_handoff') {
    lines.push(
      '> **Alcance:** integración NEW→LEG — solo wiring en el brownfield existente; no reimplementar features ya presentes (login, auth, layout, etc.).',
    );
    lines.push('');
    if (pack.integrationHandoff?.handoffId || pack.integrationHandoff?.sourceProject) {
      lines.push('## Handoff');
      if (pack.integrationHandoff.handoffId) {
        lines.push(`- Id: \`${pack.integrationHandoff.handoffId}\``);
      }
      if (pack.integrationHandoff.sourceProject) {
        lines.push(`- Proyecto NEW origen: ${pack.integrationHandoff.sourceProject}`);
      }
      if (pack.integrationHandoff.acceptanceCriteria?.length) {
        lines.push('- Criterios de aceptación:');
        for (const ac of pack.integrationHandoff.acceptanceCriteria) {
          lines.push(`  - ${ac}`);
        }
      }
      lines.push('');
    }
  }
  lines.push('## Descripción del cambio');
  lines.push(pack.change.userDescription.trim() || '_Sin descripción._');
  lines.push('');

  if (pack.change.decisions.length > 0) {
    lines.push('## Decisiones');
    for (const d of pack.change.decisions) {
      lines.push(`- ${d}`);
    }
    lines.push('');
  }

  if (pack.change.migrationNotes?.trim()) {
    lines.push('## Notas de migración');
    lines.push(pack.change.migrationNotes.trim());
    lines.push('');
  }

  const files = pack.modificationPlan.filesToModify;
  lines.push('## Archivos a modificar');
  if (files.length === 0) {
    lines.push('_Sin archivos concretos en el plan; Forge/Ariadne inferirán alcance._');
  } else {
    lines.push('| Archivo | Repo |');
    lines.push('| --- | --- |');
    for (const f of files.slice(0, 80)) {
      lines.push(`| \`${f.path}\` | ${f.repoId ?? '—'} |`);
    }
    if (files.length > 80) {
      lines.push(`| _… y ${files.length - 80} más_ | |`);
    }
  }
  lines.push('');

  if (pack.modificationPlan.questionsToRefine?.length) {
    lines.push('## Preguntas abiertas');
    for (const q of pack.modificationPlan.questionsToRefine) {
      lines.push(`- ${q}`);
    }
    lines.push('');
  }

  if (pack.changePlanSeed?.tasks?.length) {
    lines.push('## Tareas semilla (ChangePlan)');
    for (const t of pack.changePlanSeed.tasks.slice(0, 40)) {
      const syms = t.symbols?.length ? ` · símbolos: ${t.symbols.join(', ')}` : '';
      lines.push(`- **${t.id}** — ${t.title} (\`${t.files.join('`, `')}\`${syms})`);
    }
    lines.push('');
  }

  if (pack.graphEvidenceBundle?.files?.length) {
    lines.push('## Evidencia del grafo (resumen)');
    for (const f of pack.graphEvidenceBundle.files.slice(0, 25)) {
      const deps = f.dependents?.reduce((s, d) => s + d.count, 0) ?? 0;
      const syms = f.symbols?.slice(0, 4).join(', ') || '—';
      lines.push(
        `- \`${f.path}\` · impacto=${f.impactScore ?? '—'} · dependents=${deps} · símbolos: ${syms}`,
      );
    }
    lines.push('');
  }

  if (pack.change.erDiagramMermaid?.trim()) {
    lines.push('## Modelo de datos (ERD)');
    lines.push('```mermaid');
    lines.push(pack.change.erDiagramMermaid.trim());
    lines.push('```');
    lines.push('');
  }

  lines.push('## Contexto Ariadne');
  lines.push(`- Proyecto: \`${pack.ariadne.projectId}\``);
  if (pack.ariadne.repositoryId) lines.push(`- Repo: \`${pack.ariadne.repositoryId}\``);
  if (pack.ariadne.conversationId) {
    lines.push(`- Conversación: \`${pack.ariadne.conversationId}\``);
  }
  lines.push(
    `- Índice: ${pack.ariadne.indexFresh ? 'actualizado' : 'desactualizado'}${pack.ariadne.indexStaleHours != null ? ` (~${pack.ariadne.indexStaleHours}h)` : ''}`,
  );
  lines.push(`- Stage key sugerido: \`${pack.change.stageKey}\``);
  lines.push('');

  return lines.join('\n').slice(0, 48_000);
}
