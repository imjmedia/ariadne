/** User-facing hint for integration handoff audit failures (orchestrator LangGraph node). */
export function formatHandoffAuditFailureAnswer(detail: string): string {
  return `No pude completar el análisis del handoff: ${detail}. ${formatHandoffAuditErrorHint(detail)}`;
}

export function formatHandoffAuditErrorHint(detail: string): string {
  const d = detail.toLowerCase();

  if (d.includes('llm sin api key') || d.includes('api key llm no configurada')) {
    return 'Guarda la API key en Ajustes → Proveedores IA y verifica que orchestrator alcance ingest (INGEST_URL).';
  }
  if (d.includes('llm-runtime') || d.includes('cargar llm desde ingest')) {
    return 'Verifica que ingest esté levantado y orchestrator tenga INGEST_URL=http://ingest:3002.';
  }
  if (d.includes('proveedor llm') || d.includes('openrouter') || d.includes('fetch failed')) {
    return 'Fallo de red o configuración del proveedor LLM: revisa Ajustes → Proveedores IA (base URL + API key) y salida HTTPS del contenedor orchestrator.';
  }
  if (d.includes('429') || d.includes('rate limit') || d.includes('límite de tasa')) {
    return 'Cuota del proveedor LLM agotada; espera unos minutos o cambia de modelo en Ajustes.';
  }
  if (d.includes('auth failed') || d.includes('401') || d.includes('403')) {
    return 'API key LLM inválida; revisa Ajustes → Proveedores IA.';
  }
  if (d.includes('ingest ') && (d.includes('failed') || d.includes('timed out'))) {
    return 'El servicio ingest no respondió; revisa logs de ingest y el sync del índice.';
  }

  return 'Revisa logs de orchestrator e ingest; si el grafo está vacío, ejecuta sync en el repositorio.';
}
