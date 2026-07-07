import { Controller, Get } from '@nestjs/common';
import { LlmSettingsService } from './llm-settings.service';
import type { LlmRuntimeConfig } from './llm-settings.types';

/**
 * Runtime LLM para orchestrator (red Docker interna, sin auth admin).
 * GET /internal/llm-runtime
 */
@Controller('internal')
export class InternalLlmRuntimeController {
  constructor(private readonly llmSettings: LlmSettingsService) {}

  @Get('llm-runtime')
  async getRuntime(): Promise<LlmRuntimeConfig> {
    return this.llmSettings.getEffective();
  }
}
