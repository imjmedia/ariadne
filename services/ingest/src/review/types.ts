/**
 * @fileoverview Tipos del Review Engine: estados, hallazgos, artifact, pipeline.
 */

/** Disposición de un finding tras el pipeline de revisión. */
export enum FindingDisposition {
  BELOW_GATE = 'below_gate',
  PENDING_VALIDATION = 'pending_validation',
  DISPROVEN = 'disproven',
  UNCERTAIN = 'uncertain',
  CONFIRMED = 'confirmed',
}

/** Categoría del lente que detectó el finding. */
export type LensType =
  | 'correctness'
  | 'security'
  | 'legacy_safety'
  | 'data_integrity'
  | 'architecture';

/** Severidad sugerida del hallazgo. */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Estado del finding en el artifact. */
export type FindingState = 'open' | 'attempted' | 'resolved';

/** Información de impacto legacy obtenida del grafo Ariadne. */
export interface LegacyImpact {
  /** Número de dependientes directos. */
  dependents: number;
  /** Archivos que dependen del nodo modificado. */
  files: string[];
  /** Riesgo estimado de ruptura. */
  breakingRisk: 'low' | 'medium' | 'high';
}

/** Un hallazgo individual generado por el pipeline. */
export interface Finding {
  /** ID único dentro del review (F001, F002…). */
  id: string;
  /** Lente que detectó el hallazgo. */
  type: LensType;
  /** Severidad sugerida. */
  severity: Severity;
  /** Archivo donde se encuentra el problema. */
  filePath: string;
  /** Línea de inicio (1-indexed). */
  lineStart: number;
  /** Línea de fin. */
  lineEnd: number;
  /** Título corto del hallazgo. */
  title: string;
  /** Descripción detallada. */
  description: string;
  /** Puntaje de confianza compuesto 0-100. */
  confidence: number;
  /** Disposición determinada por el pipeline. */
  disposition: FindingDisposition;
  /** Estado actual. */
  currentState: FindingState;
  /** Indica si el finding es auto-fixable. */
  isActionable: boolean;
  /** Contexto de impacto legacy (desde Ariadne graph). */
  legacyImpact: LegacyImpact;
  /** Indica si el archivo modificado carece de tests. */
  testGap: boolean;
  /** Acción sugerida al desarrollador. */
  suggestedAction: string;
  /** Código de fix sugerido (opcional). */
  fixHint?: string;
  /** Familias fuente que detectaron este finding. */
  sourceFamilies: LensType[];
  /** Score de la Fase 3 (evaluación rápida). */
  scorePhase3?: number;
  /** Score de la Fase 4 (validación profunda). */
  scorePhase4?: number;
}

/** Resumen ejecutivo del review. */
export interface ReviewSummary {
  /** Total de hallazgos. */
  totalFindings: number;
  /** Hallazgos críticos (severity = critical o high). */
  critical: number;
  /** Hallazgos moderados (severity = medium). */
  moderate: number;
  /** Hallazgos informativos (severity = low o info). */
  info: number;
  /** Riesgo legacy general: bajo | medio | alto. */
  legacyRisk: string;
  /** Cobertura de tests en archivos modificados. */
  testCoverage: string;
}

/** Archivo modificado en el diff. */
export interface ChangedFile {
  /** Ruta del archivo. */
  path: string;
  /** Líneas agregadas. */
  added: number;
  /** Líneas eliminadas. */
  removed: number;
  /** Cambios por línea (para análisis detallado). */
  hunks: DiffHunk[];
  /** Contexto del grafo Ariadne para este archivo. */
  legacyContext?: LegacyImpact;
  /** Indica si tiene cobertura de tests. */
  hasTests: boolean;
}

/** Hunk de un diff unificado. */
export interface DiffHunk {
  /** Línea de inicio en el archivo original. */
  oldStart: number;
  /** Línea de inicio en el archivo nuevo. */
  newStart: number;
  /** Líneas del hunk (con prefijo +, -, espacio). */
  lines: string[];
}

/** Estado del pipeline de revisión. */
export type ReviewStatus = 'queued' | 'running' | 'completed' | 'failed';

/** Artifact de revisión completo (persistente). */
export interface ReviewArtifact {
  /** ID único del review (rev_<ULID>). */
  reviewId: string;
  /** Estado actual del pipeline. */
  status: ReviewStatus;
  /** Timestamp ISO de creación. */
  createdAt: string;
  /** Timestamp ISO de finalización. */
  completedAt?: string;
  /** ID del proyecto Ariadne. */
  projectId: string;
  /** Rama analizada. */
  branch: string;
  /** Archivos modificados en el diff. */
  files: ChangedFile[];
  /** Hallazgos del review. */
  findings: Finding[];
  /** Resumen ejecutivo. */
  summary: ReviewSummary;
  /** Confianza general del review (0-100). */
  overallConfidence: number;
  /** Reporte en Markdown (renderizado). */
  reportMarkdown: string;
  /** Mensaje de error si status = failed. */
  error?: string;
}

/** Payload de entrada para iniciar un review. */
export interface ReviewRequest {
  /** Texto del diff en formato unificado (git diff). */
  diff?: string;
  /** URL del PR (alternativa a diff). */
  prUrl?: string;
  /** Rama base para comparación (default: main). */
  branch?: string;
  /** ID del proyecto Ariadne. */
  projectId?: string;
  /** Ruta absoluta del repo local. */
  repoPath?: string;
}

/** Respuesta del endpoint de review. */
export interface ReviewResponse {
  reviewId: string;
  status: ReviewStatus;
  overallConfidence?: number;
  summary?: ReviewSummary;
  findings?: Finding[];
  reportMarkdown?: string;
  error?: string;
}

/** Resultado del parseo de un diff. */
export interface ParsedDiff {
  files: ChangedFile[];
  totalAdded: number;
  totalRemoved: number;
  totalFiles: number;
}
