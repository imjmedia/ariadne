/**
 * Modo único para documentación legacy (TheForge / SDD): evidencia MDD determinista desde el grafo.
 * No usar `ask_codebase` con distintos `responseMode` para doc. de partida — este contrato es la fuente de verdad.
 */

/** Pregunta fija: el builder MDD no depende del wording; el retrieve acota por scope multi-root. */
export const LEGACY_DOCUMENTATION_FIXED_QUESTION =
  "Documentación de partida (MDD) del código indexado en el ámbito actual: propósito del repo, " +
  "superficie API y rutas, modelo de datos y persistencia, lógica de negocio deducible del grafo, infraestructura relevante, " +
  "riesgos y lagunas del índice, y rutas de evidencia. Respeta **solo** el alcance de `scope.repoIds` de esta petición (multi-root: no mezcles archivos de otros roots del mismo workspace Ariadne). " +
  "`evidence_paths` debe contener únicamente rutas verificadas en ese alcance; si una ruta no pertenece al árbol fuente acotado, no la incluyas. " +
  "No inventes artefactos que no aparezcan en el índice; si algo no consta, dilo explícitamente por sección. " +
  "Cumple el contrato MDD `evidence_first` del orchestrator/ingest.";

export type LegacyDocumentationScope = {
  repoIds?: string[];
  includePathPrefixes?: string[];
  excludePathGlobs?: string[];
};

export type LegacyDocumentationInvokeResult =
  | { ok: true; answer: string; cypher?: string }
  | { ok: false; error: string; status?: number };

/**
 * POST ingest chat con `responseMode: evidence_first` + retrieve determinista.
 * Usado por la tool MCP `generate_legacy_documentation` (y no replicar flags en otros modos).
 */
export async function invokeIngestLegacyDocumentation(params: {
  ingestUrl: string;
  projectId: string;
  scope?: LegacyDocumentationScope;
  currentFilePath?: string;
  timeoutMs?: number;
}): Promise<LegacyDocumentationInvokeResult> {
  const base = params.ingestUrl.replace(/\/$/, "");
  const body = JSON.stringify({
    message: LEGACY_DOCUMENTATION_FIXED_QUESTION,
    responseMode: "evidence_first",
    deterministicRetriever: true,
    twoPhase: true,
    ...(params.scope && Object.keys(params.scope).length > 0 ? { scope: params.scope } : {}),
  });
  const timeoutMs = params.timeoutMs ?? 900_000;
  const opts: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  };
  let res = await fetch(`${base}/projects/${encodeURIComponent(params.projectId)}/chat`, opts);
  if (res.status === 404) {
    res = await fetch(`${base}/repositories/${encodeURIComponent(params.projectId)}/chat`, opts);
  }
  if (!res.ok) {
    const msg = await res.text();
    return { ok: false, error: msg || res.statusText, status: res.status };
  }
  const data = (await res.json()) as { answer?: string; cypher?: string };
  const answer = typeof data.answer === "string" ? data.answer : "";
  if (!answer.trim()) {
    return { ok: false, error: "Ingest devolvió answer vacío (índice vacío o pipeline sin evidencia)." };
  }
  return { ok: true, answer, cypher: data.cypher };
}
