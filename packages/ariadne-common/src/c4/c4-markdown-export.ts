import type { C4Model } from './c4-model.types.js';

export interface C4MarkdownFile {
  name: string;
  content: string;
}

function modelSection(model: C4Model | null, title: string): string {
  if (!model) return `## ${title}\n\n_(sin snapshot — ejecuta POST /c4/generate)_\n`;
  const lines = [
    `## ${title}`,
    '',
    `- **Nivel:** ${model.level}`,
    `- **Generador:** ${model.generator}`,
    `- **Hash:** \`${model.contentHash.slice(0, 16)}…\``,
    `- **Elementos:** ${model.elements.length}`,
    `- **Relaciones:** ${model.relationships.length}`,
    '',
    '### Elementos',
    '',
    '| Nombre | Tipo | Evidencia |',
    '| ------ | ---- | --------- |',
  ];
  for (const el of model.elements.slice(0, 80)) {
    const ev = el.evidence[0]?.source ?? '—';
    lines.push(`| ${el.name} | ${el.kind} | ${ev} |`);
  }
  if (model.elements.length > 80) {
    lines.push(`| … | … | +${model.elements.length - 80} más |`);
  }
  return lines.join('\n');
}

/** Genera bundle estilo Litho (6 markdowns) desde snapshots C4. */
export function buildC4MarkdownBundle(input: {
  projectName: string;
  projectId: string;
  context?: C4Model | null;
  container?: C4Model | null;
  component?: C4Model | null;
  sequenceTitle?: string;
  sequenceSteps?: string[];
}): C4MarkdownFile[] {
  const header = `# C4 — ${input.projectName}\n\nProyecto \`${input.projectId}\`. Generado por Ariadne.\n`;
  return [
    {
      name: '01-overview.md',
      content: [
        header,
        '## Overview',
        '',
        'Documentación C4 derivada del grafo y gobierno de dominios (no commitear por defecto).',
        '',
        '| Nivel | Disponible |',
        '| ----- | ---------- |',
        `| Context | ${input.context ? 'sí' : 'no'} |`,
        `| Container | ${input.container ? 'sí' : 'no'} |`,
        `| Component | ${input.component ? 'sí' : 'no'} |`,
        `| Sequence | ${input.sequenceSteps?.length ? 'sí' : 'no'} |`,
      ].join('\n'),
    },
    {
      name: '02-architecture-context.md',
      content: header + '\n' + modelSection(input.context ?? null, 'C4 Context'),
    },
    {
      name: '03-architecture-container.md',
      content: header + '\n' + modelSection(input.container ?? null, 'C4 Container'),
    },
    {
      name: '04-components.md',
      content: header + '\n' + modelSection(input.component ?? null, 'C4 Component'),
    },
    {
      name: '05-api-flows.md',
      content: [
        header,
        '## API flows',
        '',
        input.sequenceTitle ? `### ${input.sequenceTitle}` : '### Flujo representativo',
        '',
        ...(input.sequenceSteps?.length
          ? input.sequenceSteps.map((s, i) => `${i + 1}. ${s}`)
          : ['_(Genera secuencia con POST /c4/sequence/generate)_']),
      ].join('\n'),
    },
    {
      name: '06-evidence-index.md',
      content: [
        header,
        '## Índice de evidencias',
        '',
        'Cada elemento C4 incluye `evidence[]` con fuente `falkor`, `compose`, `domain` o `llm`.',
        '',
        'Nivel **code**: usar explorador de grafo (`/graph-explorer`) o MCP `get_component_graph`.',
      ].join('\n'),
    },
  ];
}
