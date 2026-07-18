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
import { UpdateSystemSettingsBodyDto } from './dto/update-system-settings.dto';
import { SystemSettingsService } from './system-settings.service';

@Controller('system-settings')
export class SystemSettingsController {
  constructor(private readonly systemSettings: SystemSettingsService) {}

  private requireAdmin(headers: Record<string, string | string[] | undefined>): void {
    const actor = actorFromHeaders(headers);
    if (!isAdmin(actor)) {
      throw new ForbiddenException('Solo administradores pueden gestionar la configuración del sistema');
    }
  }

  @Get()
  getSettings(@Headers() headers: Record<string, string | string[] | undefined>) {
    this.requireAdmin(headers);
    return this.systemSettings.getMasked();
  }

  @Put()
  updateSettings(
    @Body() body: UpdateSystemSettingsBodyDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.requireAdmin(headers);
    const actor = actorFromHeaders(headers);
    return this.systemSettings.update(body, actor.userId);
  }

  @Post('invalidate-cache')
  invalidateCache(@Headers() headers: Record<string, string | string[] | undefined>) {
    this.requireAdmin(headers);
    this.systemSettings.invalidateCache();
    return { ok: true };
  }
}
