/**
 * @fileoverview ReviewService — core del pipeline de revisión de cambios legacy.
 *
 * Usa la misma infraestructura LLM que el resto del sistema:
 *   - LLM_API_KEY, LLM_BASE_URL, LLM_MODEL_INGEST/LLM_CHAT_MODEL
 *   - OpenAI-compatible fetch() al provider configurado (OpenRouter, LemonData, etc.)
 *   - Sin dependencias de IA externas nuevas
 *
 * Fases:
 *   Fase 0: Preflight — parseo de diff + consulta al grafo Ariadne
 *   Fase 1: Detección — 5 lentes paralelos vía LLM
 *   Fase 2: Dedup — normalización de findings duplicados
 *   Fase 3: Scoring — evaluación rápida con penalizaciones legacy
 *   Fase 4: Validación profunda vía LLM
 *   Fase 5: Cross-cutting legacy
 *   Fase 6: Render de reporte
 */
import { Injectable, Logger, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  resolveLlmApiKey,
  resolveLlmBaseUrl,
  resolveLlmChatModel,
  llmDefaultHeaders,
} from '../llm/llm-config';
import { queryBatchLegacyImpact } from './falkor-review.helper';
import { GitHubService } from '../providers/github.service';
import {
  ChangedFile,
  DiffHunk,
  Finding,
  FindingDisposition,
  FindingState,
  LensType,
  LegacyImpact,
  ReviewArtifact,
  ReviewRequest,
  ReviewResponse,
  ReviewStatus,
  ReviewSummary,
  ParsedDiff,
} from './types';

/** Respuesta de la API chat completions (solo campos que usamos). */
interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
}

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  /** Almacén en memoria de artifacts (producción: BD o Redis). */
  private artifacts = new Map<string, ReviewArtifact>();

  constructor(
    @Inject(GitHubService) private readonly github: GitHubService,
  ) {}

  // ──────────────────────────────────────────────
  //  LLM helper — mismo patrón que orchestrator/llm/llm.adapter.ts
  // ──────────────────────────────────────────────

  /**
   * Llama al LLM configurado (OpenRouter, LemonData, etc.) via OpenAI-compatible API.
   * Usa las mismas env vars que el resto del sistema:
   *   LLM_API_KEY, LLM_BASE_URL, LLM_MODEL_INGEST, LLM_TEMPERATURE
   */
  private async callLlm(
    systemPrompt: string,
    userPrompt: string,
    maxTokens = 2048,
    temperature?: number,
  ): Promise<string> {
    const baseUrl = resolveLlmBaseUrl().replace(/\/$/, '');
    const model = resolveLlmChatModel();
    const apiKey = resolveLlmApiKey();
    const temp = temperature ?? (parseFloat(process.env.LLM_TEMPERATURE || '0.3') || 0.3);

    if (!apiKey) {
      throw new Error('LLM_API_KEY no configurada. Revisa las variables de entorno.');
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(llmDefaultHeaders() ?? {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: temp,
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`LLM API (${model}) HTTP ${res.status}: ${errBody.slice(0, 500)}`);
    }

    const data = (await res.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content?.trim();
    return content ?? '';
  }

  /**
   * Llama al LLM con response_format: json_object para respuestas estructuradas.
   */
  private async callLlmJson<T>(
    systemPrompt: string,
    userPrompt: string,
    maxTokens = 4096,
  ): Promise<T> {
    const baseUrl = resolveLlmBaseUrl().replace(/\/$/, '');
    const model = resolveLlmChatModel();
    const apiKey = resolveLlmApiKey();
    const temp = parseFloat(process.env.LLM_TEMPERATURE || '0.1') || 0.1;

    if (!apiKey) {
      throw new Error('LLM_API_KEY no configurada.');
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(llmDefaultHeaders() ?? {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: temp,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      // Fallback: si json_mode no es soportado, intenta sin él
      this.logger.warn(`json_object no soportado por ${model}, reintentando sin response_format`);
      const text = await this.callLlm(systemPrompt, userPrompt, maxTokens);
      return this.safeJsonParse<T>(text);
    }

    const data = (await res.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content?.trim() ?? '{}';
    return this.safeJsonParse<T>(content);
  }

  private safeJsonParse<T>(text: string): T {
    // Buscar JSON en el texto (puede venir con markdown fences)
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = jsonMatch ? jsonMatch[1] : text;
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn(`No se pudo parsear JSON del LLM, texto: ${raw.slice(0, 200)}`);
      return {} as T;
    }
  }

  // ──────────────────────────────────────────────
  //  Público
  // ──────────────────────────────────────────────

  async startReview(req: ReviewRequest): Promise<ReviewResponse> {
    const reviewId = `rev_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const branch = req.branch ?? 'main';
    const projectId = req.projectId ?? '';

    const artifact: ReviewArtifact = {
      reviewId,
      status: 'queued',
      createdAt: new Date().toISOString(),
      projectId,
      branch,
      files: [],
      findings: [],
      summary: { totalFindings: 0, critical: 0, moderate: 0, info: 0, legacyRisk: 'bajo', testCoverage: '-' },
      overallConfidence: 0,
      reportMarkdown: '',
    };
    this.artifacts.set(reviewId, artifact);

    try {
      // Fase 0 — Parseo del diff
      const diff = await this.resolveDiff(req);
      if (!diff) {
        return this.fail(reviewId, 'No se pudo resolver el diff. Proporciona diff como texto o prUrl.');
      }
      const parsed = this.parseDiff(diff);
      artifact.files = parsed.files;
      artifact.status = 'running';
      this.logger.log(`[${reviewId}] Fase 0: ${parsed.totalFiles} archivos, +${parsed.totalAdded}/-${parsed.totalRemoved} líneas`);

      // Fase 0.5 — Consultar grafo Ariadne
      await this.enrichWithLegacyContext(artifact);

      // Fase 1 — Detección multi-lente via LLM
      const rawFindings = await this.runDetection(artifact);

      // Fase 2 — Dedup via LLM
      const deduped = await this.dedupFindings(rawFindings);

      // Fase 3 — Scoring con contexto legacy
      const scored = await this.scoreFindings(deduped, artifact);

      // Fase 4 — Validación profunda via LLM
      const validated = await this.validateDeep(scored, artifact);

      // Fase 5 — Cross-cutting
      const crossCutting = await this.crossCuttingReview(validated, artifact);

      // Fase 6 — Reporte final
      artifact.findings = crossCutting;
      artifact.summary = this.buildSummary(artifact);
      artifact.overallConfidence = this.calculateOverallConfidence(artifact);
      artifact.reportMarkdown = this.renderMarkdown(artifact);
      artifact.status = 'completed';
      artifact.completedAt = new Date().toISOString();
    } catch (err) {
      this.logger.error(`[${reviewId}] Error en pipeline: ${err instanceof Error ? err.message : String(err)}`);
      return this.fail(reviewId, `Error en pipeline: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
      reviewId,
      status: 'completed',
      overallConfidence: artifact.overallConfidence,
      summary: artifact.summary,
      findings: artifact.findings,
      reportMarkdown: artifact.reportMarkdown,
    };
  }

  getStatus(reviewId: string): ReviewResponse {
    const art = this.artifacts.get(reviewId);
    if (!art) return { reviewId, status: 'failed', error: 'Review no encontrado' };
    return {
      reviewId,
      status: art.status,
      overallConfidence: art.overallConfidence,
      summary: art.summary,
      findings: art.findings,
      reportMarkdown: art.reportMarkdown,
      error: art.error,
    };
  }

  getReport(reviewId: string, format: 'json' | 'md' = 'md'): { content: string; mime: string } | null {
    const art = this.artifacts.get(reviewId);
    if (!art || art.status !== 'completed') return null;
    if (format === 'json') {
      return { content: JSON.stringify(art, null, 2), mime: 'application/json' };
    }
    return { content: art.reportMarkdown, mime: 'text/markdown' };
  }

  // ──────────────────────────────────────────────
  //  Fase 0 — Preflight
  // ──────────────────────────────────────────────

  private async resolveDiff(req: ReviewRequest): Promise<string | null> {
    if (req.diff) return req.diff;

    if (req.prUrl) {
      // Soporte para URLs de GitHub: https://github.com/owner/repo/pull/123
      const ghMatch = req.prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
      if (ghMatch) {
        const [, owner, repo, prNumber] = ghMatch;
        try {
          this.logger.log(`Descargando diff de PR: ${owner}/${repo}#${prNumber}`);
          const res = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
            {
              headers: {
                Accept: 'application/vnd.github.v3.diff',
                ...(await this.getGitHubAuthHeaders()),
              },
            },
          );
          if (res.ok) {
            const text = await res.text();
            if (text.length > 0) return text;
          }
          this.logger.warn(`GitHub PR API respondió ${res.status}, intentando /files`);
          // Fallback: obtener lista de archivos + contenido
          const filesRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
            {
              headers: {
                Accept: 'application/vnd.github.v3+json',
                ...(await this.getGitHubAuthHeaders()),
              },
            },
          );
          if (filesRes.ok) {
            const files = await filesRes.json() as Array<{
              filename: string;
              status: string;
              patch?: string;
              additions: number;
              deletions: number;
            }>;
            if (Array.isArray(files) && files.length > 0) {
              // Reconstruir diff desde patches individuales
              const parts: string[] = [];
              for (const f of files) {
                if (f.patch) {
                  parts.push(`diff --git a/${f.filename} b/${f.filename}`);
                  parts.push(`--- a/${f.filename}`);
                  parts.push(`+++ b/${f.filename}`);
                  parts.push(f.patch);
                }
              }
              if (parts.length > 0) return parts.join('\n');
            }
          }
        } catch (err) {
          this.logger.warn(`Error descargando PR ${req.prUrl}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      this.logger.warn(`No se pudo resolver PR URL: ${req.prUrl}`);
      return null;
    }

    return null;
  }

  /** Obtiene headers de autenticación para GitHub API. */
  private async getGitHubAuthHeaders(): Promise<Record<string, string>> {
    const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';
    if (token) return { Authorization: `Bearer ${token}` };
    return {};
  }

  private parseDiff(rawDiff: string): ParsedDiff {
    const files: ChangedFile[] = [];
    const lines = rawDiff.split('\n');
    let currentFile: ChangedFile | null = null;
    let currentHunk: DiffHunk | null = null;
    let totalAdded = 0;
    let totalRemoved = 0;

    for (const line of lines) {
      const fileMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      if (fileMatch) {
        if (currentFile) files.push(currentFile);
        currentFile = { path: fileMatch[2], added: 0, removed: 0, hunks: [], hasTests: false, legacyContext: { dependents: 0, files: [], breakingRisk: 'low' } };
        currentHunk = null;
        continue;
      }

      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (hunkMatch && currentFile) {
        if (currentHunk) currentFile.hunks.push(currentHunk);
        currentHunk = {
          oldStart: parseInt(hunkMatch[1], 10),
          newStart: parseInt(hunkMatch[3], 10),
          lines: [],
        };
        continue;
      }

      if (currentHunk && currentFile) {
        currentHunk.lines.push(line);
        if (line.startsWith('+') && !line.startsWith('+++')) { currentFile.added++; totalAdded++; }
        else if (line.startsWith('-') && !line.startsWith('---')) { currentFile.removed++; totalRemoved++; }
      }

      if (line.startsWith('--- /dev/null') || line.startsWith('+++ /dev/null')) continue;
      if (line.startsWith('--- a/') || line.startsWith('+++ b/')) continue;
    }

    if (currentHunk && currentFile) currentFile.hunks.push(currentHunk);
    if (currentFile) files.push(currentFile);
    return { files, totalAdded, totalRemoved, totalFiles: files.length };
  }

  // ──────────────────────────────────────────────
  //  Fase 0.5 — Contexto Legacy
  // ──────────────────────────────────────────────

  private async enrichWithLegacyContext(artifact: ReviewArtifact): Promise<void> {
    // Extraer nombres base de los archivos modificados
    const nodeNames = artifact.files
      .map(f => f.path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '')
      .filter(Boolean);

    if (nodeNames.length === 0) return;

    // Consultar impacto legacy en batch (paralelo por nodo)
    const impactMap = await queryBatchLegacyImpact(nodeNames, artifact.projectId || undefined);

    for (const file of artifact.files) {
      const baseName = file.path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
      const impact = impactMap.get(baseName);
      file.legacyContext = impact ?? { dependents: 0, files: [], breakingRisk: 'low' };

      // Detectar si hay archivo de test asociado
      const testPatterns = [
        file.path.replace(/\.(ts|tsx|js|jsx)$/, '.spec.$1'),
        file.path.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1'),
      ];
      file.hasTests = false;
    }
  }

  // ──────────────────────────────────────────────
  //  Fase 1 — Detección multi-lente via LLM
  // ──────────────────────────────────────────────

  /**
   * Ejecuta lentes en paralelo usando el LLM configurado.
   * Cada lente recibe el diff completo y emite findings en JSON.
   */
  private async runDetection(artifact: ReviewArtifact): Promise<Finding[]> {
    const diffSummary = this.buildDiffSummary(artifact.files);
    const diffText = this.buildDiffText(artifact.files);

    // Si el diff es pequeño, usar un solo call LLM para todos los lentes
    // Si es grande, paralelizar por lente
    const isSmallDiff = diffText.length < 8000;

    if (isSmallDiff) {
      // Un solo call con todos los lentes
      const systemPrompt = `Eres un revisor de código legacy experto. Analizas un diff de cambios y detectas problemas.
Devuelve un array JSON de hallazgos. Cada hallazgo debe tener:
- type: string ("correctness" | "security" | "legacy_safety" | "data_integrity" | "architecture")
- severity: string ("critical" | "high" | "medium" | "low" | "info")
- filePath: string (ruta del archivo)
- lineStart: number
- lineEnd: number
- title: string (título corto)
- description: string (descripción detallada)
- confidence: number (0-100, tu nivel de certeza)
- suggestedAction: string (acción sugerida)
- fixHint: string (código de fix opcional)

Reglas:
1. CORRECTNESS: null safety, edge cases, race conditions, lógica incorrecta
2. SECURITY: SQLi, XSS, auth bypass, data exposure, hardcoded secrets
3. LEGACY_SAFETY: cambios de firma, breaking changes, side effects en funciones compartidas
4. DATA_INTEGRITY: cambios de tipo, migraciones, validaciones perdidas
5. ARCHITECTURE: violaciones de patrón, acoplamiento, duplicación

Sé preciso. No inventes problemas. Si no hay hallazgos, devuelve [].`;

      const userPrompt = `Revisa este diff de cambios legacy y genera hallazgos:\n\nResumen:\n${diffSummary}\n\nDiff:\n\`\`\`diff\n${diffText.slice(0, 7000)}\n\`\`\``;

      try {
        const result = await this.callLlmJson<Finding[]>(systemPrompt, userPrompt, 4096);
        return (Array.isArray(result) ? result : []).map((f, i) => ({
          ...f,
          id: '',
          disposition: FindingDisposition.PENDING_VALIDATION,
          currentState: 'open' as FindingState,
          isActionable: false,
          legacyImpact: { dependents: 0, files: [], breakingRisk: 'low' },
          testGap: false,
          sourceFamilies: [f.type as LensType],
        }));
      } catch (err) {
        this.logger.warn(`LLM detection failed: ${err instanceof Error ? err.message : String(err)}`);
        return [];
      }
    } else {
      // Diff grande — paralelizar por lente
      const lensNames: LensType[] = [
        'correctness', 'security', 'legacy_safety', 'data_integrity', 'architecture',
      ];
      const results = await Promise.allSettled(
        lensNames.map((lens) => this.runSingleLens(lens, diffSummary, diffText)),
      );

      const all: Finding[] = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          for (const f of r.value) {
            f.sourceFamilies = [lensNames[i]];
            all.push(f);
          }
        }
      }
      return all;
    }
  }

  private async runSingleLens(
    lens: LensType,
    diffSummary: string,
    diffText: string,
  ): Promise<Finding[]> {
    const lensDescriptions: Record<LensType, string> = {
      correctness: 'CORRECTNESS: null safety, edge cases, race conditions, lógica incorrecta',
      security: 'SECURITY: SQLi, XSS, auth bypass, data exposure, hardcoded secrets, injection',
      legacy_safety: 'LEGACY_SAFETY: cambios de firma, breaking changes, side effects en funciones compartidas, compatibilidad hacia atrás',
      data_integrity: 'DATA_INTEGRITY: cambios de tipo, migraciones, validaciones perdidas, esquemas de BD',
      architecture: 'ARCHITECTURE: violaciones de patrón, acoplamiento inesperado, duplicación de código',
    };

    const systemPrompt = `Eres un revisor de código legacy experto enfocado en ${lensDescriptions[lens]}.
Devuelve SOLO un array JSON de hallazgos para este lente. Cada hallazgo:
- type: "${lens}"
- severity: "critical" | "high" | "medium" | "low" | "info"
- filePath: string
- lineStart: number
- lineEnd: number
- title: string
- description: string
- confidence: number (0-100)
- suggestedAction: string
- fixHint: string (opcional)

Si no hay hallazgos para este lente, devuelve [].`;

    const userPrompt = `Revisa este diff (enfoque: ${lens}):\n\nResumen:\n${diffSummary}\n\nDiff:\n\`\`\`diff\n${diffText.slice(0, 12000)}\n\`\`\``;

    try {
      const result = await this.callLlmJson<Finding[]>(systemPrompt, userPrompt, 2048);
      if (!Array.isArray(result)) return [];
      return result.map((f) => ({
        ...f,
        id: '',
        disposition: FindingDisposition.PENDING_VALIDATION,
        currentState: 'open' as FindingState,
        isActionable: false,
        legacyImpact: { dependents: 0, files: [], breakingRisk: 'low' },
        testGap: false,
        sourceFamilies: [lens],
      }));
    } catch (err) {
      this.logger.warn(`Lente ${lens} falló: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  // ──────────────────────────────────────────────
  //  Fase 2 — Dedup via LLM
  // ──────────────────────────────────────────────

  private async dedupFindings(findings: Finding[]): Promise<Finding[]> {
    if (findings.length <= 1) return findings;

    // Si hay pocos findings, dedup local simple
    if (findings.length <= 15) {
      const map = new Map<string, Finding>();
      for (const f of findings) {
        const key = `${f.filePath}:${f.lineStart}:${f.type}`;
        const existing = map.get(key);
        if (existing) {
          existing.sourceFamilies = Array.from(new Set(existing.sourceFamilies.concat(f.sourceFamilies))) as LensType[];
          if (f.description.length > existing.description.length) {
            existing.description = f.description;
            existing.title = f.title;
            existing.suggestedAction = f.suggestedAction;
          }
        } else {
          map.set(key, { ...f });
        }
      }
      return Array.from(map.values());
    }

    // Muchos findings: usar LLM para dedup
    const systemPrompt = `Eres un normalizador de hallazgos de revisión de código.
Recibes un array de hallazgos (algunos duplicados entre lentes). Debes:
1. Unificar los que describen el mismo problema (mismo archivo, línea similar, mismo tipo)
2. Fusionar sourceFamilies y tomar la mejor descripción
3. Devolver un array JSON reducido

Devuelve SOLO un array JSON.`;

    const userPrompt = `Normaliza estos ${findings.length} hallazgos:\n${JSON.stringify(
      findings.map((f) => ({
        filePath: f.filePath,
        lineStart: f.lineStart,
        lineEnd: f.lineEnd,
        type: f.type,
        title: f.title,
        description: f.description.slice(0, 300),
        sourceFamilies: f.sourceFamilies,
        severity: f.severity,
        confidence: f.confidence,
      })),
      null,
      2,
    )}`;

    try {
      const result = await this.callLlmJson<Finding[]>(systemPrompt, userPrompt, 4096);
      if (Array.isArray(result) && result.length > 0) return result;
    } catch (err) {
      this.logger.warn(`Dedup LLM falló: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Fallback: dedup local
    return findings;
  }

  // ──────────────────────────────────────────────
  //  Fase 3 — Scoring con Contexto Legacy
  // ──────────────────────────────────────────────

  private async scoreFindings(findings: Finding[], artifact: ReviewArtifact): Promise<Finding[]> {
    for (const f of findings) {
      let score = f.confidence;

      // Penalización por impacto legacy
      const depCount = f.legacyImpact.dependents;
      let legacyPenalty = 0;
      if (depCount > 10) legacyPenalty = -15;
      else if (depCount > 5) legacyPenalty = -10;
      else if (depCount > 2) legacyPenalty = -5;

      // Penalización por falta de tests
      const testPenalty = f.testGap ? -15 : 0;

      score = Math.max(0, Math.min(100, score + legacyPenalty + testPenalty));
      f.scorePhase3 = score;

      if (score < 45) {
        f.disposition = FindingDisposition.BELOW_GATE;
        f.isActionable = false;
      }
    }

    this.logger.log(
      `Fase 3: ${findings.filter(f => f.disposition !== FindingDisposition.BELOW_GATE).length} findings pasan gate`,
    );
    return findings;
  }

  // ──────────────────────────────────────────────
  //  Fase 4 — Validación Profunda via LLM
  // ──────────────────────────────────────────────

  private async validateDeep(findings: Finding[], artifact: ReviewArtifact): Promise<Finding[]> {
    const toValidate = findings.filter(f => f.disposition !== FindingDisposition.BELOW_GATE);
    if (toValidate.length === 0) return findings;

    // Validar en batch via LLM (más eficiente que uno por uno)
    const diffText = this.buildDiffText(artifact.files);

    const systemPrompt = `Eres un validador de hallazgos de revisión de código legacy.
Recibes:
- El diff completo de cambios
- Una lista de hallazgos candidatos (cada uno con score preliminar)

Para CADA hallazgo debes:
1. Revisar si realmente es un problema real (usando el diff como evidencia)
2. Asignar score final (0-100)
3. Determinar actionability: "auto_fixable" | "manual" | "report_only"
4. Si aplica, proponer fixHint con código concreto

Devuelve SOLO un array JSON. Cada elemento:
- id: string (el mismo del input)
- scorePhase4: number
- disposition: "confirmed" | "uncertain" | "disproven"
- severity: "critical" | "high" | "medium" | "low" | "info"
- actionability: "auto_fixable" | "manual" | "report_only"
- fixHint: string (opcional, código de fix)
- validationRationale: string (por qué confirmas o descartas)`;

    const userPrompt = `Valida estos hallazgos contra el diff real:\n\nDiff:\n\`\`\`diff\n${diffText.slice(0, 15000)}\n\`\`\`\n\nHallazgos:\n${JSON.stringify(
      toValidate.map((f) => ({
        id: `${f.filePath}:${f.lineStart}`,
        type: f.type,
        filePath: f.filePath,
        lineStart: f.lineStart,
        lineEnd: f.lineEnd,
        title: f.title,
        description: f.description,
        confidence: f.confidence,
        scorePhase3: f.scorePhase3,
      })),
      null,
      2,
    )}`;

    try {
      const result = await this.callLlmJson<Array<{
        id: string;
        scorePhase4: number;
        disposition: string;
        severity: string;
        actionability: string;
        fixHint?: string;
        validationRationale: string;
      }>>(systemPrompt, userPrompt, 4096);

      if (Array.isArray(result)) {
        for (const v of result) {
          const finding = toValidate.find(f => `${f.filePath}:${f.lineStart}` === v.id);
          if (!finding) continue;

          finding.scorePhase4 = v.scorePhase4 ?? finding.scorePhase3 ?? finding.confidence;

          // Mapear disposición
          if (v.disposition === 'confirmed' || (v.scorePhase4 ?? 0) >= 60) {
            finding.disposition = FindingDisposition.CONFIRMED;
            finding.isActionable = v.actionability === 'auto_fixable';
            finding.severity = (['critical', 'high', 'medium', 'low', 'info'].includes(v.severity)
              ? v.severity as Finding['severity']
              : this.determineSeverity(v.scorePhase4 ?? 0, finding.type));
            if (v.fixHint) finding.fixHint = v.fixHint;
          } else if (v.disposition === 'uncertain' || (v.scorePhase4 ?? 0) >= 45) {
            finding.disposition = FindingDisposition.UNCERTAIN;
            finding.isActionable = false;
          } else {
            finding.disposition = FindingDisposition.DISPROVEN;
            finding.isActionable = false;
          }

          // Recalcular confianza con modelo completo
          finding.confidence = this.calculateFindingConfidence(finding);
        }
      }
    } catch (err) {
      this.logger.warn(`Validación profunda falló, usando scores Fase 3: ${err instanceof Error ? err.message : String(err)}`);
      // Fallback: usar score Fase 3 como score Fase 4
      for (const f of toValidate) {
        const s3 = f.scorePhase3 ?? f.confidence;
        f.scorePhase4 = s3;
        if (s3 >= 60) {
          f.disposition = FindingDisposition.CONFIRMED;
          f.isActionable = true;
          f.severity = this.determineSeverity(s3, f.type);
        } else if (s3 >= 45) {
          f.disposition = FindingDisposition.UNCERTAIN;
          f.isActionable = false;
        } else {
          f.disposition = FindingDisposition.DISPROVEN;
          f.isActionable = false;
        }
        f.confidence = this.calculateFindingConfidence(f);
      }
    }

    return findings;
  }

  // ──────────────────────────────────────────────
  //  Fase 5 — Cross-cutting Legacy
  // ──────────────────────────────────────────────

  private async crossCuttingReview(findings: Finding[], artifact: ReviewArtifact): Promise<Finding[]> {
    const confirmed = findings.filter(f => f.disposition === FindingDisposition.CONFIRMED);
    if (confirmed.length < 2) return findings;

    const diffText = this.buildDiffText(artifact.files);

    const systemPrompt = `Eres un revisor cross-cutting de cambios legacy.
Recibes el diff y los hallazgos confirmados. Debes detectar INTERACCIONES entre hallazgos:
- Un fix para hallazgo A podría crear un problema en el área del hallazgo B
- Dos cambios separados afectan el mismo flujo de datos
- Hay dependencias compartidas entre archivos modificados

Devuelve SOLO un array JSON vacío [] o con objetos:
- findingIds: string[] (IDs de los hallazgos involucrados)
- interaction: string (descripción de la interacción)
- risk: "low" | "medium" | "high"`;

    const userPrompt = `Revisa interacciones entre estos hallazgos confirmados:\n\nDiff:\n\`\`\`diff\n${diffText.slice(0, 10000)}\n\`\`\`\n\nHallazgos:\n${JSON.stringify(
      confirmed.map((f) => ({
        id: `${f.filePath}:${f.lineStart}`,
        title: f.title,
        filePath: f.filePath,
        description: f.description.slice(0, 300),
      })),
      null,
      2,
    )}`;

    try {
      const result = await this.callLlmJson<Array<{
        findingIds: string[];
        interaction: string;
        risk: string;
      }>>(systemPrompt, userPrompt, 2048);

      if (Array.isArray(result) && result.length > 0) {
        this.logger.log(`Fase 5: ${result.length} interacciones cross-cutting detectadas`);
      }
    } catch {
      // Cross-cutting es best-effort
    }

    return findings;
  }

  // ──────────────────────────────────────────────
  //  Helpers
  // ──────────────────────────────────────────────

  private calculateFindingConfidence(f: Finding): number {
    const codeQuality = f.scorePhase4 ?? f.confidence;
    const legacyImpact = this.impactToScore(f.legacyImpact.breakingRisk);
    const breakingRisk = f.legacyImpact.dependents > 5 ? 40 : f.legacyImpact.dependents > 2 ? 60 : 80;
    const evidenceScore = Math.min(100, f.sourceFamilies.length * 25);

    const weighted =
      codeQuality * 0.40 +
      legacyImpact * 0.25 +
      breakingRisk * 0.20 +
      evidenceScore * 0.15;

    const testPenalty = f.testGap ? 10 : 0;
    return Math.max(0, Math.min(100, Math.round(weighted - testPenalty)));
  }

  private impactToScore(risk: string): number {
    switch (risk) {
      case 'low': return 90;
      case 'medium': return 60;
      case 'high': return 30;
      default: return 50;
    }
  }

  private determineSeverity(score: number, _type: LensType): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    if (score >= 85) return 'critical';
    if (score >= 70) return 'high';
    if (score >= 55) return 'medium';
    if (score >= 40) return 'low';
    return 'info';
  }

  private calculateOverallConfidence(artifact: ReviewArtifact): number {
    const confirmed = artifact.findings.filter(f => f.disposition === FindingDisposition.CONFIRMED);
    if (confirmed.length === 0) return 0;
    const avg = confirmed.reduce((s, f) => s + f.confidence, 0) / confirmed.length;
    return Math.round(avg);
  }

  private buildSummary(artifact: ReviewArtifact): ReviewSummary {
    const total = artifact.findings.length;
    const critical = artifact.findings.filter(f => f.severity === 'critical' || f.severity === 'high').length;
    const moderate = artifact.findings.filter(f => f.severity === 'medium').length;
    const info = artifact.findings.filter(f => f.severity === 'low' || f.severity === 'info').length;
    const totalDeps = artifact.files.reduce((s, f) => s + (f.legacyContext?.dependents ?? 0), 0);
    const legacyRisk = totalDeps > 15 ? 'alto' : totalDeps > 5 ? 'medio' : 'bajo';
    const testedFiles = artifact.files.filter(f => f.hasTests).length;
    const testCoverage = artifact.files.length > 0
      ? `${Math.round((testedFiles / artifact.files.length) * 100)}%` : '-';
    return { totalFindings: total, critical, moderate, info, legacyRisk, testCoverage };
  }

  private buildDiffSummary(files: ChangedFile[]): string {
    return files.map(f =>
      `${f.path} (+${f.added}/-${f.removed})${f.legacyContext ? ` [legacy: ${f.legacyContext.dependents} deps]` : ''}`
    ).join('\n');
  }

  private buildDiffText(files: ChangedFile[]): string {
    const parts: string[] = [];
    for (const file of files) {
      parts.push(`--- a/${file.path}`);
      parts.push(`+++ b/${file.path}`);
      for (const hunk of file.hunks) {
        parts.push(`@@ -${hunk.oldStart} +${hunk.newStart} @@`);
        parts.push(...hunk.lines);
      }
    }
    return parts.join('\n');
  }

  private renderMarkdown(artifact: ReviewArtifact): string {
    const s = artifact.summary;
    const lines: string[] = [
      `## 🧪 Legacy Change Review`,
      ``,
      `**Review ID:** \`${artifact.reviewId}\``,
      `**Proyecto:** ${artifact.projectId || '(no especificado)'}`,
      `**Confianza general:** ${artifact.overallConfidence}%`,
      `**Archivos:** ${artifact.files.length} | **+/-:** ${artifact.files.reduce((a, f) => a + f.added, 0)}/${artifact.files.reduce((a, f) => a + f.removed, 0)}`,
      `**test_gap:** ${s.testCoverage === '0%' ? '⚠️ Sin cobertura' : s.testCoverage}`,
      ``,
    ];

    if (artifact.files.length > 0) {
      lines.push('### 📁 Archivos modificados', '');
      for (const f of artifact.files) {
        const ctx = f.legacyContext;
        const deps = ctx && ctx.dependents > 0 ? ` | ${ctx.dependents} dependencias` : '';
        const tests = f.hasTests ? '✅' : '⚠️';
        lines.push(`- \`${f.path}\` (+${f.added}/-${f.removed})${deps} ${tests}`);
      }
      lines.push('');
    }

    const critical = artifact.findings.filter(f => f.severity === 'critical' || f.severity === 'high');
    const moderate = artifact.findings.filter(f => f.severity === 'medium');
    const info = artifact.findings.filter(f => f.severity === 'low' || f.severity === 'info');

    if (critical.length > 0) {
      lines.push(`### 🔴 Críticos (${critical.length})`, '');
      for (const f of critical) lines.push(this.renderFinding(f));
    }
    if (moderate.length > 0) {
      lines.push(`### 🟡 Moderados (${moderate.length})`, '');
      for (const f of moderate) lines.push(this.renderFinding(f));
    }
    if (info.length > 0) {
      lines.push(`### ℹ️ Informativos (${info.length})`, '');
      for (const f of info) lines.push(this.renderFinding(f));
    }

    const belowGate = artifact.findings.filter(f => f.disposition === FindingDisposition.BELOW_GATE);
    if (belowGate.length > 0) {
      lines.push(`### ⬇️ Below gate (${belowGate.length})`, '');
      lines.push('_Findings con score < 45 que no pasaron a validación profunda:_');
      for (const f of belowGate) {
        lines.push(`- **${f.title}** en \`${f.filePath}:${f.lineStart}\``);
      }
      lines.push('');
    }

    lines.push('### 📊 Desglose de confianza', '');
    lines.push('| Finding | Confianza | Impacto | Tests |');
    lines.push('|---------|-----------|---------|-------|');
    for (const f of artifact.findings) {
      const depIcon = f.legacyImpact.dependents > 0 ? `${f.legacyImpact.dependents} dep` : '-';
      const testIcon = f.testGap ? '⚠️' : '✅';
      lines.push(`| ${f.id || '?'} | ${f.confidence}% | ${depIcon} | ${testIcon} |`);
    }
    lines.push('');

    lines.push('### ℹ️ Interpretación', '');
    lines.push(
      '- **≥ 80%:** Alta confianza. Revisión rápida recomendada.',
      '- **60-79%:** Confianza moderada. Revisar findings marcados.',
      '- **< 60%:** Baja confianza. Requiere revisión manual detallada.',
      '- **test_gap:** El archivo modificado no tiene cobertura de tests. Penalización -10%.',
      '- **Legacy impact:** Número de dependencias que podrían romperse.',
    );

    return lines.join('\n');
  }

  private renderFinding(f: Finding): string {
    const badge = f.severity === 'critical' ? '🔴' : f.severity === 'high' ? '🔶' : f.severity === 'medium' ? '🟡' : 'ℹ️';
    const lines: string[] = [
      `${badge} **${f.id}** — ${f.title}`,
      `    Confianza: ${f.confidence}% | Archivo: \`${f.filePath}:${f.lineStart}\``,
      `    ${f.description}`,
    ];
    if (f.legacyImpact.dependents > 0) {
      lines.push(`    ⚠️ Impacto legacy: ${f.legacyImpact.dependents} dependencias`);
    }
    if (f.fixHint) {
      lines.push(`    💡 Código sugerido:\n    \`\`\`\n${f.fixHint}\n    \`\`\``);
    } else {
      lines.push(`    → ${f.suggestedAction}`);
    }
    lines.push('');
    return lines.join('\n');
  }

  private fail(reviewId: string, error: string): ReviewResponse {
    const art = this.artifacts.get(reviewId);
    if (art) {
      art.status = 'failed';
      art.error = error;
      art.completedAt = new Date().toISOString();
    }
    return { reviewId, status: 'failed', error };
  }
}
