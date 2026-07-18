import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSettingsEntity } from './entities/system-settings.entity';
import { InternalSystemSettingsController } from './internal-system-settings.controller';
import { SystemSettingsController } from './system-settings.controller';
import { SystemSettingsService } from './system-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSettingsEntity])],
  controllers: [SystemSettingsController, InternalSystemSettingsController],
  providers: [SystemSettingsService],
  exports: [SystemSettingsService],
})
export class SystemSettingsModule {}
