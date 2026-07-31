/**
 * Parse and detect NEW-LEG integration handoff seed messages (The Forge → Ariadne chat).
 */

export interface ParsedIntegrationHandoff {
  handoffId: string | null;
  title: string | null;
  sourceProject: string | null;
  actor: string | null;
  description: string;
  acceptanceCriteria: string[];
}

export interface IntegrationHandoffDetectOptions {
  integrationHandoffId?: string | null;
  chatMode?: string | null;
}

function normalizeForMatch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** True when the chat should use the integration-handoff pipeline (not generic reengineering). */
export function wantsIntegrationHandoffQuestion(
  message: string,
  opts?: IntegrationHandoffDetectOptions,
): boolean {
  if (opts?.integrationHandoffId?.trim()) return true;
  if (opts?.chatMode === 'integration_handoff') return true;
  return parseIntegrationHandoffMessage(message) !== null;
}

/** Extract structured fields from the markdown seed produced by `buildHandoffSeedMessage`. */
export function parseIntegrationHandoffMessage(message: string): ParsedIntegrationHandoff | null {
  const raw = message?.trim() ?? '';
  if (!raw) return null;
  const norm = normalizeForMatch(raw);
  if (!norm.includes('handoff de integracion')) return null;

  const idMatch = raw.match(/##\s*Handoff de integraci[oó]n\s*`([^`]+)`/i);
  const handoffId = idMatch?.[1]?.trim() || null;

  const titleMatch = raw.match(/\*\*T[ií]tulo:\*\*\s*(.+)/i);
  const title = titleMatch?.[1]?.trim() || null;

  const sourceMatch = raw.match(/\*\*Proyecto origen \(NEW\):\*\*\s*(.+)/i);
  const sourceProject = sourceMatch?.[1]?.trim() || null;

  const actorMatch = raw.match(/\*\*Actor:\*\*\s*(.+)/i);
  const actor = actorMatch?.[1]?.trim() || null;

  let description = '';
  const descStart = raw.search(/###\s*Descripci[oó]n/i);
  if (descStart >= 0) {
    const afterDesc = raw.slice(descStart).replace(/^###\s*Descripci[oó]n\s*/i, '');
    const acSplit = afterDesc.search(/\n###\s*Criterios de aceptaci[oó]n/i);
    const untilHr = afterDesc.search(/\n---\n/);
    let end = afterDesc.length;
    if (acSplit >= 0) end = Math.min(end, acSplit);
    if (untilHr >= 0) end = Math.min(end, untilHr);
    description = afterDesc.slice(0, end).trim();
  }

  const acceptanceCriteria: string[] = [];
  const acSection = raw.match(/###\s*Criterios de aceptaci[oó]n\s*([\s\S]*?)(?:\n---|\n##\s|$)/i);
  if (acSection?.[1]) {
    for (const line of acSection[1].split('\n')) {
      const m = line.match(/^\s*[-*]\s*(.+)/);
      if (m?.[1]?.trim()) acceptanceCriteria.push(m[1].trim());
    }
  }

  if (!description && !title && !handoffId) return null;

  return {
    handoffId,
    title,
    sourceProject,
    actor,
    description,
    acceptanceCriteria,
  };
}
