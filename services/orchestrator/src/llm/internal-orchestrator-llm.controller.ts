import { Controller, Post } from '@nestjs/common';
import {
  invalidateOrchestratorLlmRuntimeCache,
  prefetchOrchestratorLlmRuntime,
} from './llm-settings.client';

/**
 * POST /internal/llm-runtime/invalidate — tras guardar Ajustes LLM en ingest.
 */
@Controller('internal')
export class InternalOrchestratorLlmController {
  @Post('llm-runtime/invalidate')
  invalidate(): { ok: true } {
    invalidateOrchestratorLlmRuntimeCache();
    prefetchOrchestratorLlmRuntime();
    return { ok: true };
  }
}
