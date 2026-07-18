import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Put,
} from '@nestjs/common';
import { actorFromHeaders, isAdmin } from '../credentials/credential-actor';
import type { UpdateTheForgeIntegrationDto } from './theforge-integration.types';
import { TheForgeIntegrationService } from './theforge-integration.service';

@Controller('theforge-integration')
export class TheForgeIntegrationController {
  constructor(private readonly integration: TheForgeIntegrationService) {}

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

  /** Estado público para UI (chat): ¿mostrar promoción? */
  @Get('status')
  getStatus(@Headers() headers: Record<string, string | string[] | undefined>) {
    this.requireAuth(headers);
    return this.integration.getStatus();
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
