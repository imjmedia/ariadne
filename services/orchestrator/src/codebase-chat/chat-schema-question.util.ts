/**
 * Detector alineado con ingest `chat-schema-question.util.ts` (orchestrator early-return).
 * Mantener en sync con la copia de ingest.
 */
export function wantsSchemaDatabaseQuestion(message: string): boolean {
  const t = (message ?? '').trim();
  if (!t) return false;
  const m = t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const strongPhrase =
    /\bdiagrama\s+(de\s+)?(base\s+de\s+datos|bd|entidad(?:es)?[- ]relacion|er\b|e-?r\b)/.test(m) ||
    /\b(esquema|estructura|modelo)\s+(de\s+)?(la\s+)?(base\s+de\s+datos|bd)\b/.test(m) ||
    /\bmodelo\s+de\s+datos\b/.test(m) ||
    /\bmodelo\s+entidad[- ]relacion\b/.test(m) ||
    /\b(database|db)\s+(schema|diagram|model|erd?)\b/.test(m) ||
    /\bentity[- ]relationship\b/.test(m) ||
    /\berd\b/.test(m) ||
    /\bcontent[- ]?types?\b/.test(m);

  if (strongPhrase) return true;

  const dbNoun =
    /\bbase\s+de\s+datos\b/.test(m) ||
    /\bbd\b/.test(m) ||
    /\bdatabase\b/.test(m) ||
    /\bprisma\b/.test(m) ||
    /\btypeorm\b/.test(m) ||
    /\bstrapi\b/.test(m);

  const schemaTerm =
    /\besquema\b/.test(m) ||
    /\bdiagrama\b/.test(m) ||
    /\bestructura\b/.test(m) ||
    /\bentidad(es)?\b/.test(m) ||
    /\btabla(s)?\b/.test(m) ||
    /\brelacion(es)?\b/.test(m) ||
    /\bschema\b/.test(m) ||
    /\bmigracion(es)?\b/.test(m);

  return dbNoun && schemaTerm;
}
