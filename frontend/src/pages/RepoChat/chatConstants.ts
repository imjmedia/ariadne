import type { AnalyzeCodeMode } from '@/types';

export const ANALYSIS_MODE_LABELS: Record<string, string> = {
  diagnostico: 'Diagnóstico',
  duplicados: 'Duplicados',
  reingenieria: 'Reingeniería',
  codigo_muerto: 'Código muerto',
  seguridad: 'Seguridad',
  agents: 'AGENTS',
  skill: 'SKILL',
};

export const ANALYSIS_RESULT_TITLES: Record<string, string> = {
  diagnostico: 'Deuda técnica',
  duplicados: 'Código duplicado',
  codigo_muerto: 'Código muerto',
  reingenieria: 'Reingeniería',
  seguridad: 'Auditoría de seguridad',
  agents: 'AGENTS.md',
  skill: 'SKILL.md',
};

export type AnalysisAction = {
  mode: AnalyzeCodeMode;
  label: string;
  description: string;
  title?: string;
};

/** Acciones visibles de un vistazo (máx. 3 — Hick's law). */
export const PRIMARY_ANALYSIS_ACTIONS: AnalysisAction[] = [
  {
    mode: 'diagnostico',
    label: 'Diagnóstico',
    description: 'Deuda técnica y antipatrones',
  },
  {
    mode: 'duplicados',
    label: 'Duplicados',
    description: 'Código repetido en el grafo',
  },
  {
    mode: 'reingenieria',
    label: 'Reingeniería',
    description: 'Plan priorizado de mejora',
  },
];

export const SECONDARY_ANALYSIS_ACTIONS: AnalysisAction[] = [
  {
    mode: 'codigo_muerto',
    label: 'Código muerto',
    description: 'Símbolos sin referencias',
  },
  {
    mode: 'seguridad',
    label: 'Seguridad',
    description: 'Heurística de secretos en fuentes',
    title: 'No sustituye SAST ni pentest',
  },
  {
    mode: 'agents',
    label: 'AGENTS.md',
    description: 'Protocolo para agentes AI',
  },
  {
    mode: 'skill',
    label: 'SKILL.md',
    description: 'Skill para Cursor / Claude',
  },
];
