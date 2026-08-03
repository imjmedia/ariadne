/**
 * Generates Cursor-compatible # Tasks markdown from a ChangePromotionPack.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ChatLlmService } from '../chat/chat-llm.service';
import { hasIngestLlmConfigured } from '../chat/chat-llm-config';
import type { ChangePromotionPackV1 } from './change-promotion-pack.types';
import { buildChangeWorkDescription } from './change-work-description.util';
import { CURSOR_TASKS_INTEGRATION_HANDOFF_SUPPLEMENT } from './cursor-tasks-integration-handoff.prompt';
import { CURSOR_TASKS_SYSTEM_PROMPT } from './cursor-tasks-document.prompt';
import {
  buildCursorTasksUserPrompt,
  cursorTasksFromChangePlanSeed,
  normalizeCursorTasksMarkdown,
  validateCursorTasksMarkdown,
} from './cursor-tasks-document.util';

export interface CursorTasksGenerationResult {
  markdown: string;
  source: 'llm' | 'fallback';
  validationErrors: string[];
}

@Injectable()
export class CursorTasksDocumentService {
  private readonly logger = new Logger(CursorTasksDocumentService.name);

  constructor(private readonly llm: ChatLlmService) {}

  async generate(pack: ChangePromotionPackV1): Promise<CursorTasksGenerationResult> {
    const systemPrompt =
      pack.promotionScope === 'integration_handoff'
        ? `${CURSOR_TASKS_SYSTEM_PROMPT}\n\n${CURSOR_TASKS_INTEGRATION_HANDOFF_SUPPLEMENT}`
        : CURSOR_TASKS_SYSTEM_PROMPT;

    if (hasIngestLlmConfigured()) {
      try {
        const raw = await this.llm.callLlm(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: buildCursorTasksUserPrompt(pack) },
          ],
          12_000,
        );
        let markdown = normalizeCursorTasksMarkdown(raw);
        let validation = validateCursorTasksMarkdown(markdown);
        if (!validation.valid) {
          this.logger.warn(`Cursor tasks LLM output invalid (${validation.errors.join('; ')}); retrying once`);
          const retryRaw = await this.llm.callLlm(
            [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: `${buildCursorTasksUserPrompt(pack)}\n\nErrores previos a corregir:\n- ${validation.errors.join('\n- ')}`,
              },
            ],
            12_000,
          );
          markdown = normalizeCursorTasksMarkdown(retryRaw);
          validation = validateCursorTasksMarkdown(markdown);
        }
        if (validation.valid) {
          return { markdown, source: 'llm', validationErrors: [] };
        }
        this.logger.warn(`Cursor tasks LLM still invalid; using fallback (${validation.errors.join('; ')})`);
      } catch (err) {
        this.logger.warn(`Cursor tasks LLM failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const markdown = cursorTasksFromChangePlanSeed(pack);
    const validation = validateCursorTasksMarkdown(markdown);
    return {
      markdown,
      source: 'fallback',
      validationErrors: validation.valid ? [] : validation.errors,
    };
  }

  /** Attach work description + Cursor tasks markdown to a promotion pack. */
  async enrichPack(pack: ChangePromotionPackV1): Promise<{
    pack: ChangePromotionPackV1;
    cursorTasksSource: 'llm' | 'fallback';
  }> {
    const changeWorkDescription = buildChangeWorkDescription(pack);
    const tasksResult = await this.generate(pack);
    return {
      pack: {
        ...pack,
        changeWorkDescription,
        cursorTasksMarkdown: tasksResult.markdown,
      },
      cursorTasksSource: tasksResult.source,
    };
  }
}
