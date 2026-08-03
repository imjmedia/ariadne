/**
 * Validation, normalization and deterministic fallback for Cursor # Tasks markdown.
 */
import type { ChangePlanTask } from '../plan-validation/change-plan-validation.types';
import type { ChangePromotionPackV1 } from './change-promotion-pack.types';

const REQUIRED_H2 = [
  '## Backend tasks',
  '## Frontend tasks',
  '## Infraestructura tasks',
  '## Testing tasks',
  '## Deploy tasks',
] as const;

const ALT_INFRA = '## Infra tasks';

export interface CursorTasksValidation {
  valid: boolean;
  errors: string[];
}

export function normalizeCursorTasksMarkdown(raw: string): string {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:markdown|md)?\s*\n?/i, '').replace(/\n?```\s*$/, '');
  }
  const hashIdx = text.indexOf('# Tasks');
  if (hashIdx > 0) {
    text = text.slice(hashIdx);
  }
  if (!text.startsWith('#')) {
    text = `# Tasks\n\n${text}`;
  }
  if (!text.startsWith('# Tasks')) {
    text = text.replace(/^#\s+/, '# Tasks\n\n# ');
  }
  return text.trimEnd() + '\n';
}

export function validateCursorTasksMarkdown(md: string): CursorTasksValidation {
  const errors: string[] = [];
  const text = md.trim();

  if (!text.startsWith('#')) {
    errors.push('El documento debe empezar con #');
  }
  if (!text.includes('# Tasks')) {
    errors.push('Falta encabezado # Tasks');
  }

  for (const h2 of REQUIRED_H2) {
    if (h2 === '## Infraestructura tasks') {
      if (!text.includes(h2) && !text.includes(ALT_INFRA)) {
        errors.push(`Falta sección ${h2} o ${ALT_INFRA}`);
      }
    } else if (!text.includes(h2)) {
      errors.push(`Falta sección ${h2}`);
    }
  }

  const yamlBlocks = (text.match(/^---\n[\s\S]*?\n---/gm) ?? []).length;
  if (yamlBlocks === 0) {
    errors.push('No hay bloques YAML (--- … ---)');
  }

  const checklistItems = (text.match(/^- \[ \]/gm) ?? []).length;
  if (checklistItems < yamlBlocks) {
    errors.push('Faltan líneas checklist - [ ] debajo de bloques YAML');
  }

  return { valid: errors.length === 0, errors };
}

function inferSection(path: string): 'Backend' | 'Frontend' | 'Infra' | 'QA' | 'Deploy' {
  const p = path.replace(/\\/g, '/').toLowerCase();
  if (
    p.includes('/frontend/') ||
    p.includes('/web/') ||
    p.includes('/pages/') ||
    p.endsWith('.tsx') ||
    p.endsWith('.jsx') ||
    p.includes('/components/')
  ) {
    return 'Frontend';
  }
  if (
    p.includes('docker') ||
    p.includes('.github/') ||
    p.includes('/infra/') ||
    p.includes('docker-compose') ||
    p.includes('/k8s/')
  ) {
    return 'Infra';
  }
  if (p.includes('.spec.') || p.includes('.test.') || p.includes('/__tests__/')) {
    return 'QA';
  }
  return 'Backend';
}

function sectionH2(section: string): string {
  switch (section) {
    case 'Frontend':
      return '## Frontend tasks';
    case 'Infra':
      return '## Infraestructura tasks';
    case 'QA':
      return '## Testing tasks';
    case 'Deploy':
      return '## Deploy tasks';
    default:
      return '## Backend tasks';
  }
}

function yamlQuote(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildTaskBlock(opts: {
  id: string;
  section: string;
  title: string;
  changeType: string;
  parallel: boolean;
  dependsOn: string[];
  mddRef: string;
  why: string;
  include: string[];
  exclude: string[];
  requirements: string[];
  verificationRun: string;
  symbols?: string[];
  path: string;
}): string {
  const pTag = opts.parallel ? '[P] ' : '';
  const symLine = opts.symbols?.length
    ? `\n  - **Función:** ${opts.symbols.slice(0, 3).join(', ')}`
    : '';
  return `---
id: ${opts.id}
section: ${opts.section}
title: ${yamlQuote(opts.title.slice(0, 80))}
status: pending
change_type: ${opts.changeType}
parallel: ${opts.parallel}
depends_on: ${JSON.stringify(opts.dependsOn)}
context:
  mdd_ref: ${yamlQuote(opts.mddRef)}
  story_ref: ""
  why: ${yamlQuote(opts.why)}
scope:
  include:
${opts.include.map((p) => `    - ${yamlQuote(p)}`).join('\n')}
  exclude:
${opts.exclude.map((p) => `    - ${yamlQuote(p)}`).join('\n')}
requirements:
${opts.requirements.map((r) => `  - ${yamlQuote(r)}`).join('\n')}
verification:
  - run: ${yamlQuote(opts.verificationRun)}
    expect_exit: 0
done_when:
  - ${yamlQuote('Cambio aplicado sin errores de compilación')}
---
- [ ] ${pTag}${opts.id} — ${opts.title}
  - **Archivo:** ${opts.path}${symLine}
  - **MDD:** ${opts.mddRef}
  - **Cambio:** ${opts.title}`;
}

function mapSeedTask(task: ChangePlanTask, index: number): {
  section: 'Backend' | 'Frontend' | 'Infra' | 'QA' | 'Deploy';
  block: string;
  id: string;
} {
  const path = task.files[0] ?? 'unknown';
  const section = inferSection(path);
  const id =
    task.id && /^T-\d+$/.test(task.id) ? task.id : `T-${String(index + 1).padStart(3, '0')}`;
  const title = task.title.slice(0, 80);
  const block = buildTaskBlock({
    id,
    section,
    title,
    changeType: 'modify',
    parallel: section === 'Frontend',
    dependsOn: task.dependsOn ?? [],
    mddRef: task.evidence?.[0]?.ref ? `§ grafo ${task.evidence[0].ref}` : '§ plan modificación Ariadne',
    why: task.criterion?.slice(0, 120) ?? 'Tarea derivada del plan de modificación brownfield',
    include: task.files,
    exclude: section === 'Backend' ? ['frontend/**'] : section === 'Frontend' ? ['services/**'] : [],
    requirements: [
      task.criterion ?? `Actualizar ${path}`,
      ...(task.endpoints?.map((e) => `Endpoint: ${e}`) ?? []),
    ],
    verificationRun: section === 'Frontend' ? 'pnpm --filter frontend exec tsc -b --pretty false' : 'pnpm build',
    symbols: task.symbols,
    path,
  });
  return { section, block, id };
}

/** Deterministic fallback when LLM is unavailable or output invalid. */
export function cursorTasksFromChangePlanSeed(pack: ChangePromotionPackV1): string {
  const seeds = pack.changePlanSeed?.tasks ?? [];
  const implTasks =
    seeds.length > 0
      ? seeds.map((t, i) => mapSeedTask(t, i))
      : pack.modificationPlan.filesToModify.slice(0, 20).map((f, i) =>
          mapSeedTask(
            {
              id: `T-${String(i + 1).padStart(3, '0')}`,
              title: `Modificar ${f.path.split('/').pop() ?? f.path}`,
              files: [f.path],
              phase: '1-core',
              criterion: 'Aplicar cambio según plan Ariadne',
            },
            i,
          ),
        );

  const bySection = new Map<string, string[]>();
  for (const t of implTasks) {
    const h2 = sectionH2(t.section);
    if (!bySection.has(h2)) bySection.set(h2, []);
    bySection.get(h2)!.push(t.block);
  }

  const implIds = implTasks.map((t) => t.id);
  const testBlocks: string[] = implTasks.slice(0, 5).map((t, i) => {
    const testId = `T-${String(implTasks.length + i + 1).padStart(3, '0')}`;
    const specPath = t.block.includes('.tsx')
      ? t.block.match(/include:\n\s+- "([^"]+\.tsx)"/)?.[1]?.replace(/\.tsx$/, '.spec.tsx')
      : undefined;
    return buildTaskBlock({
      id: testId,
      section: 'QA',
      title: `Tests para ${t.id}`,
      changeType: 'modify',
      parallel: false,
      dependsOn: [t.id],
      mddRef: '§ testing brownfield',
      why: 'Verificar regresión del cambio',
      include: specPath ? [`**/${specPath.split('/').pop()}`] : ['**/*.spec.ts'],
      exclude: [],
      requirements: ['Cubrir caso feliz y error del cambio'],
      verificationRun: 'pnpm test --passWithNoTests',
      path: specPath ?? '**/*.spec.ts',
    });
  });

  const deployId = `T-${String(implTasks.length + testBlocks.length + 1).padStart(3, '0')}`;
  const deployBlock = buildTaskBlock({
    id: deployId,
    section: 'Deploy',
    title: 'Verificar build de despliegue',
    changeType: 'run',
    parallel: false,
    dependsOn: implIds.slice(0, 3),
    mddRef: '§ deploy',
    why: 'Confirmar que el cambio no rompe CI/CD',
    include: ['docker-compose.yml', '.github/workflows/**', 'Dockerfile'],
    exclude: [],
    requirements: ['Build Docker/CI exitoso'],
    verificationRun: 'pnpm build',
    path: 'Dockerfile',
  });

  const infraBlock = buildTaskBlock({
    id: `T-${String(implTasks.length + testBlocks.length + 2).padStart(3, '0')}`,
    section: 'Infra',
    title: 'Revisar impacto infra (si aplica)',
    changeType: 'run',
    parallel: true,
    dependsOn: [],
    mddRef: '§ infra',
    why: 'Brownfield: confirmar si hay cambios de infra',
    include: ['docker-compose.yml', 'infra/**'],
    exclude: [],
    requirements: ['Documentar si no hay cambios de infra'],
    verificationRun: 'echo ok',
    path: 'docker-compose.yml',
  });

  const sections: Array<[string, string[]]> = [
    ['## Backend tasks', bySection.get('## Backend tasks') ?? []],
    ['## Frontend tasks', bySection.get('## Frontend tasks') ?? []],
    ['## Infraestructura tasks', [infraBlock]],
    ['## Testing tasks', testBlocks],
    ['## Deploy tasks', [deployBlock]],
  ];

  const lines = ['# Tasks', ''];
  for (const [h2, blocks] of sections) {
    lines.push(h2);
    lines.push('### Fase 1 — Implementación');
    lines.push('');
    if (blocks.length === 0) {
      lines.push('_Sin tareas en esta categoría para el alcance actual._');
      lines.push('');
    } else {
      lines.push(blocks.join('\n\n'));
      lines.push('');
    }
  }

  return normalizeCursorTasksMarkdown(lines.join('\n'));
}

export function summarizeMddForIntegrationHandoff(pack: ChangePromotionPackV1): Record<string, unknown> {
  const mdd = pack.mdd ?? {};
  const paths = pack.modificationPlan.filesToModify.map((f) => f.path);
  return {
    note: 'MDD legacy existente — NO implica backlog greenfield; solo contexto de lo ya implementado',
    summary: typeof mdd.summary === 'string' ? mdd.summary.slice(0, 2000) : undefined,
    stack: mdd.stack ?? mdd.tech_stack,
    pathsInHandoffScope: paths.slice(0, 40),
    endpointCount: Array.isArray(mdd.endpoints) ? mdd.endpoints.length : undefined,
  };
}

export function buildCursorTasksUserPrompt(pack: ChangePromotionPackV1): string {
  const isHandoff = pack.promotionScope === 'integration_handoff';
  const payload = {
    promotionScope: pack.promotionScope ?? 'brownfield_change',
    integrationHandoff: pack.integrationHandoff,
    changeTitle: pack.change.title,
    changeDescription: pack.change.userDescription,
    stageKey: pack.change.stageKey,
    decisions: pack.change.decisions,
    migrationNotes: pack.change.migrationNotes,
    filesToModify: pack.modificationPlan.filesToModify,
    questionsToRefine: pack.modificationPlan.questionsToRefine,
    mddSummary: isHandoff ? summarizeMddForIntegrationHandoff(pack) : pack.mdd,
    changePlanSeed: pack.changePlanSeed,
    graphEvidence: pack.graphEvidenceBundle,
  };
  const intro = isHandoff
    ? 'Genera el documento # Tasks SOLO para integrar el handoff NEW→LEG en el brownfield existente (no greenfield).'
    : 'Genera el documento # Tasks completo para este cambio brownfield.';
  return `${intro}\n\nContexto JSON:\n${JSON.stringify(payload, null, 2).slice(0, 90_000)}`;
}
