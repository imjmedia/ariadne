import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  Put,
} from '@nestjs/common';
import { actorFromHeaders, isAdmin } from '../credentials/credential-actor';
import { UpdateLlmSettingsBodyDto } from './dto/update-llm-settings.dto';
import { LlmSettingsService } from './llm-settings.service';

@Controller('llm-settings')
export class LlmSettingsController {
  constructor(private readonly llmSettings: LlmSettingsService) {}

  private requireAdmin(headers: Record<string, string | string[] | undefined>): void {
    const actor = actorFromHeaders(headers);
    if (!isAdmin(actor)) {
      throw new ForbiddenException('Solo administradores pueden gestionar la configuración LLM');
    }
  }

  /** GET /llm-settings/catalog — catálogo de proveedores (admin). */
  @Get('catalog')
  getCatalog(@Headers() headers: Record<string, string | string[] | undefined>) {
    this.requireAdmin(headers);
    return this.llmSettings.getCatalog();
  }

  /** GET /llm-settings — configuración efectiva enmascarada (admin). */
  @Get()
  getSettings(@Headers() headers: Record<string, string | string[] | undefined>) {
    this.requireAdmin(headers);
    return this.llmSettings.getMasked();
  }

  /** PUT /llm-settings — guardar configuración global (admin). */
  @Put()
  updateSettings(
    @Body() body: UpdateLlmSettingsBodyDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.requireAdmin(headers);
    const actor = actorFromHeaders(headers);
    return this.llmSettings.update(body, actor.userId);
  }

  /** POST /llm-settings/test — probar conexión con proveedor (admin). */
  @Post('test')
  testConnection(
    @Body() body: UpdateLlmSettingsBodyDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.requireAdmin(headers);
    return this.llmSettings.testConnection(body);
  }
}
