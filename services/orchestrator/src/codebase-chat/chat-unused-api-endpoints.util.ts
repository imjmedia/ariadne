/**
 * Detector alineado con ingest `chat-unused-api-endpoints.util.ts` (orchestrator early-return).
 */
export function wantsUnusedBackendApiEndpointsAnalysis(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  const lower = t.toLowerCase();

  const explicit =
    /qu[eé]\s+(endpoints?|rutas?)\b/i.test(t) &&
    /\b(no|sin)\b/i.test(lower) &&
    /\b(us|uso|usad|consum|referencia)/i.test(lower) ||
    /(endpoints?|rutas?)\s+(del|de)\s+(back|backend|strapi|servidor)/i.test(lower) &&
      /\b(no|sin)\b/i.test(lower) &&
      /\b(us|front|frontend|cliente)/i.test(lower) ||
    /\bunused\b/i.test(lower) &&
      /\b(endpoints?|routes?|api)\b/i.test(lower) &&
      /\b(front|frontend|client)/i.test(lower);

  if (explicit) return true;

  const backendApi =
    (/\b(endpoints?|rutas?)\b/i.test(t) &&
      /\b(back|backend|strapi|nestjs|nest|servidor|api\s+rest)\b/i.test(lower)) ||
    /\bstrapi\s*rout/i.test(lower) ||
    /\bnest\s*(js)?\s*(route|controller|endpoint)/i.test(lower);

  const unusedIntent =
    /\b(no\s+(se\s+)?us|sin\s+uso|no\s+usad|no\s+utilizad|huérfan|huerfan|sin\s+referencia|no\s+consum)/i.test(lower) ||
    /\ben\s+el\s+front/i.test(lower) ||
    /\bfront.*no\s+us/i.test(lower) ||
    /\bendpoints?\s+no\s+(utilizad|usad)/i.test(lower);

  if (backendApi && unusedIntent) return true;

  const coverage =
    /\b(endpoints?|rutas?)\b/i.test(t) &&
    /\b(declarad|indexad|strapi|backend|back)\b/i.test(lower) &&
    /\b(cruce|compar|cobertura|invocad|consum|referencia)/i.test(lower);
  return coverage;
}
