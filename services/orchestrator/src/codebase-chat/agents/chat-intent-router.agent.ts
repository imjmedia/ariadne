/**
 * LLM intent router — clasificación desde Ajustes (`chatIntentRouterEnabled` + router model).
 */
import { Injectable, Logger } from '@nestjs/common';
import type { ChatIntent, ChatIntentRouteResult } from 'ariadne-common';
import {
  wantsReengineeringQuestion,
  wantsSchemaDatabaseQuestion,
} from 'ariadne-common';
import { wantsUnusedBackendApiEndpointsAnalysis } from '../chat-unused-api-endpoints.util';
import { OrchestratorLlmService } from '../orchestrator-llm.service';
import { hasOrchestratorLlmConfigured } from '../../llm/orchestrator-llm-config';
import { getOrchestratorLlmRuntimeSync } from '../../llm/llm-settings.client';

const ROUTER_SYSTEM = `<rol>Clasificador de intención para chat sobre código indexado (Ariadne).</rol>

<intents>
- codebase_qa — Pregunta general: flujos, componentes, impacto, cómo está implementado X.
- schema_database — Volcado o diagrama del esquema de persistencia (ERD, content-types Strapi, tablas Prisma/TypeORM). NO usar si piden arquitectura, desacoplar dominio o propuesta de reingeniería aunque mencionen "entidad" o "bd".
- reengineering — Propuesta de arquitectura, desacoplar, nuevo tipo de negocio/medio, refactor brownfield, plan de cambio con reglas de negocio.
- unused_api_endpoints — Endpoints del backend (Strapi/Nest) sin uso en el frontend.
</intents>

<salida>JSON único sin markdown:
{"intent":"codebase_qa|schema_database|reengineering|unused_api_endpoints","confidence":0.0-1.0,"reasoning":"una frase","focusTerms":["término1"]}
</salida>`;

function intentRouterEnabled(): boolean {
  return getOrchestratorLlmRuntimeSync().chatIntentRouterEnabled !== false;
}

function parseRouterJson(raw: string): ChatIntentRouteResult | null {
  const t = raw.trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const o = JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
    const intent = String(o.intent ?? '').trim() as ChatIntent;
    const valid: ChatIntent[] = [
      'codebase_qa',
      'schema_database',
      'reengineering',
      'unused_api_endpoints',
    ];
    if (!valid.includes(intent)) return null;
    const confidence = Math.min(1, Math.max(0, Number(o.confidence) || 0.5));
    const reasoning = String(o.reasoning ?? '').trim() || 'Clasificación LLM';
    const focusTerms = Array.isArray(o.focusTerms)
      ? o.focusTerms.map((x) => String(x).trim()).filter(Boolean).slice(0, 12)
      : undefined;
    return { intent, confidence, reasoning, focusTerms, source: 'llm_router' };
  } catch {
    return null;
  }
}

function keywordFallback(message: string): ChatIntentRouteResult {
  if (wantsUnusedBackendApiEndpointsAnalysis(message)) {
    return {
      intent: 'unused_api_endpoints',
      confidence: 0.85,
      reasoning: 'Detector de endpoints no usados',
      source: 'keyword_fallback',
    };
  }
  if (wantsReengineeringQuestion(message)) {
    return {
      intent: 'reengineering',
      confidence: 0.8,
      reasoning: 'Arquitectura / desacoplamiento de dominio',
      source: 'keyword_fallback',
    };
  }
  if (wantsSchemaDatabaseQuestion(message)) {
    return {
      intent: 'schema_database',
      confidence: 0.85,
      reasoning: 'Esquema o diagrama de base de datos',
      source: 'keyword_fallback',
    };
  }
  return {
    intent: 'codebase_qa',
    confidence: 0.6,
    reasoning: 'Pregunta general sobre el código',
    source: 'keyword_fallback',
  };
}

@Injectable()
export class ChatIntentRouterAgent {
  private readonly logger = new Logger(ChatIntentRouterAgent.name);

  constructor(private readonly llm: OrchestratorLlmService) {}

  async classify(message: string, historyContent?: string): Promise<ChatIntentRouteResult> {
    if (!intentRouterEnabled() || !hasOrchestratorLlmConfigured()) {
      return keywordFallback(message);
    }

    const userBlock = historyContent?.trim()
      ? `${historyContent}\n\nMensaje actual:\n${message}`
      : message;

    try {
      const raw = await this.llm.callRouterLlm(
        [
          { role: 'system', content: ROUTER_SYSTEM },
          { role: 'user', content: userBlock.slice(0, 6000) },
        ],
        512,
      );
      const parsed = parseRouterJson(raw);
      if (parsed) {
        if (telemetryEnabled()) {
          this.logger.log(
            JSON.stringify({
              event: 'chat_intent_router',
              intent: parsed.intent,
              confidence: parsed.confidence,
              source: parsed.source,
            }),
          );
        }
        return parsed;
      }
    } catch (err) {
      this.logger.warn(
        `Intent router LLM failed, keyword fallback: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return keywordFallback(message);
  }
}

function telemetryEnabled(): boolean {
  return process.env.CHAT_TELEMETRY_LOG === '1' || process.env.CHAT_TELEMETRY_LOG === 'true';
}
