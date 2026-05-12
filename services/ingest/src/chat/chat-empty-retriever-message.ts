/**
 * Texto de ayuda cuando el retrieve no devolvió contexto (no implica grafo vacío).
 */
import type { ChatScope } from './chat-scope.util';

export function buildEmptyRetrieverAnswerCopy(params: {
  projectScope: boolean;
  scope?: ChatScope;
}): string {
  const repoIds = (params.scope?.repoIds ?? []).map((x) => String(x).trim()).filter(Boolean);
  const lines: string[] = [
    '**sin datos en índice para este alcance** — el retrieve (Cypher / archivos / RAG) no aportó filas ni contenido útil en esta petición.',
    '',
    '**Qué revisar** (el sync puede estar correcto y el grafo poblado):',
  ];
  if (params.projectScope) {
    lines.push(
      '- **Chat por proyecto:** con varios repos, elige el repo en la UI, envía `scope.repoIds`, activa **chat amplio** (`strictChatScope: false`) o abre el chat desde la ruta **/repos/:id/chat** del repositorio deseado.',
    );
  }
  if (repoIds.length > 0) {
    lines.push(
      `- **scope.repoIds:** llevas **${repoIds.length}** id(s); confirma que incluyen el repositorio donde indexaste.`,
    );
  }
  lines.push(
    '- **Verificar grafo:** `GET /api/repositories/:id/graph-summary?full=1` (multi-root: prueba también el query `repoScoped=1`).',
    '- **RAG:** si esperas `semantic_search` útil, ejecuta **embed-index** en el repo.',
    '- **Operadores:** `CHAT_TELEMETRY_LOG=true` en ingest (y orchestrator si aplica) para ver `chat_scope_effective` en logs.',
  );
  return lines.join('\n');
}
