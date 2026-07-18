import { Controller, Get, Post } from '@nestjs/common';
import { SystemSettingsService } from './system-settings.service';
import type { SystemSettingsEffective } from './system-settings.types';

/** Runtime de configuración del sistema para servicios internos (red Docker). */
@Controller('internal')
export class InternalSystemSettingsController {
  constructor(private readonly systemSettings: SystemSettingsService) {}

  @Get('system-settings')
  async getRuntime(): Promise<SystemSettingsEffective> {
    return this.systemSettings.getEffective();
  }

  @Post('system-settings/invalidate')
  invalidate(): { ok: true } {
    this.systemSettings.invalidateCache();
    return { ok: true };
  }
}
