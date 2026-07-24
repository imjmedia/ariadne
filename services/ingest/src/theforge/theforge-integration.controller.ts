import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Put,
  ServiceUnavailableException,
} from '@nestjs/common';
import { actorFromHeaders, isAdmin } from '../credentials/credential-actor';
import type { UpdateTheForgeIntegrationDto } from './theforge-integration.types';
import { TheForgeIntegrationService } from './theforge-integration.service';
import { TheForgeBrownfieldCatalogService } from './theforge-brownfield-catalog.service';

@Controller('theforge-integration')
export class TheForgeIntegrationController {
  constructor(
    private readonly integration: TheForgeIntegrationService,
    private readonly brownfieldCatalog: TheForgeBrownfieldCatalogService,
  ) {}

  private requireAuth(headers: Record<string, string | string[] | undefined>): void {
    const actor = actorFromHeaders(headers);
    if (!actor.userId) {
      throw new ForbiddenException('Usuario no identificado');
    }
  }

  private requireAdmin(headers: Record<string, string | string[] | undefined>): void {
    const actor = actorFromHeaders(headers);
    if (!isAdmin(actor)) {
      throw new ForbiddenException('Solo administradores pueden gestionar The Forge');
    }
  }

  /** Estado público para UI (chat / vinculación proyecto): ¿Forge configurado? */
  @Get('status')
  getStatus(@Headers() headers: Record<string, string | string[] | undefined>) {
    this.requireAuth(headers);
    return this.integration.getStatus();
  }

  /** Proyectos brownfield (LEGACY) en The Forge para el selector de vinculación. */
  @Get('brownfield-projects')
  async listBrownfieldProjects(
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.requireAuth(headers);
    const status = await this.integration.getStatus();
    if (!status.enabled && !status.mock) {
      throw new ServiceUnavailableException({
        code: 'FORGE_NOT_CONFIGURED',
        message: 'The Forge no está activado. Habilítalo en Ajustes (admin).',
      });
    }
    if (!status.chatPromotionAvailable && !status.mock) {
      throw new ServiceUnavailableException({
        code: 'FORGE_NOT_CONFIGURED',
        message:
          'Falta la URL de la API de The Forge o el JWT de servicio. Configúralos en Ajustes → The Forge (o THEFORGE_API_URL / THEFORGE_SERVICE_JWT).',
      });
    }
    const result = await this.brownfieldCatalog.listBrownfieldProjects();
    return {
      projects: result.projects,
      ...(result.hint ? { hint: result.hint } : {}),
      ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
    };
  }

  @Get()
  getSettings(@Headers() headers: Record<string, string | string[] | undefined>) {
    this.requireAdmin(headers);
    return this.integration.getMasked();
  }

  @Put()
  updateSettings(
    @Body() body: UpdateTheForgeIntegrationDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.requireAdmin(headers);
    const actor = actorFromHeaders(headers);
    return this.integration.update(body, actor.userId);
  }
}
