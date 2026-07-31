/**
 * Heuristic schema / architecture intent detection for chat fast-paths and LLM router fallback.
 * Prefer orchestrator `ChatIntentRouterAgent` when Ajustes tienen `chatIntentRouterEnabled`.
 */

import { wantsIntegrationHandoffQuestion } from './integration-handoff-message.util.js';

export const SCHEMA_MODEL_SOURCES = ['prisma', 'typeorm'] as const;

function normalizeMessage(message: string): string {
  return (message ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Architecture, domain coupling, or reengineering proposals — not a raw schema dump request.
 */
export function wantsArchitectureDomainQuestion(message: string): boolean {
  const m = normalizeMessage(message);
  if (!m) return false;

  const architectureSignals =
    /\b(acoplad[oa]s?|desacoplar|reingenier|refactoriz|arquitectura|brownfield|deuda\s+tecnica)\b/.test(m) ||
    /\b(nuevo\s+medio|nuevos?\s+medios|flexibilidad|parametriz|generaliz)\b/.test(m) ||
    /\b(propone|propones|que\s+propones|como\s+lo\s+har[ií]as)\b/.test(m);

  const domainWork =
    /\b(medio|medios|dominio|modulo|cotizador|pauta|inventario)\b/.test(m) &&
    /\b(crear|creacion|agregar|meter|soportar|vender)\b/.test(m);

  return architectureSignals || domainWork;
}

/**
 * true when the user wants a database schema / ERD listing, not domain architecture advice.
 */
export function wantsSchemaDatabaseQuestion(message: string): boolean {
  const t = (message ?? '').trim();
  if (!t) return false;
  if (wantsArchitectureDomainQuestion(t)) return false;

  const m = normalizeMessage(t);

  const strongPhrase =
    /\bdiagrama\s+(de\s+)?(base\s+de\s+datos|bd|entidad(?:es)?[- ]relacion|er\b|e-?r\b)/.test(m) ||
    /\b(esquema|estructura|modelo)\s+(de\s+)?(la\s+)?(base\s+de\s+datos|bd)\b/.test(m) ||
    /\bmodelo\s+de\s+datos\b/.test(m) ||
    /\bmodelo\s+entidad[- ]relacion\b/.test(m) ||
    /\b(database|db)\s+(schema|diagram|model|erd?)\b/.test(m) ||
    /\bentity[- ]relationship\b/.test(m) ||
    /\berd\b/.test(m) ||
    /\bcontent[- ]?types?\b/.test(m) ||
    /\b(lista|listar|mostrar|dame|muestra)\b.*\b(content[- ]?types?|tablas?)\b/.test(m);

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

  if (!dbNoun || !schemaTerm) return false;

  // Weak pairing (e.g. "entidad de bd" in an architecture sentence) needs explicit schema verbs
  // or ORM/tooling context (prisma/typeorm/strapi + entidad/tabla).
  const explicitSchemaAsk =
    /\b(diagrama|esquema|erd|modelo\s+de\s+datos|content[- ]?types?|tablas?|migracion|migraciones)\b/.test(m) ||
    /\b(lista|listar|mostrar|dame|muestra|volcar|inventario)\b/.test(m) ||
    (/\b(prisma|typeorm|strapi)\b/.test(m) &&
      /\b(entidad|entidades|tabla|tablas|modelo|content)\b/.test(m));

  return explicitSchemaAsk;
}

/** Keyword fallback for reengineering / architecture proposals. */
export function wantsReengineeringQuestion(message: string): boolean {
  if (wantsIntegrationHandoffQuestion(message)) return false;
  return wantsArchitectureDomainQuestion(message);
}
