import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmSettingsEntity } from './entities/llm-settings.entity';
import { InternalLlmRuntimeController } from './internal-llm-runtime.controller';
import { LlmSettingsController } from './llm-settings.controller';
import { LlmSettingsService } from './llm-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([LlmSettingsEntity])],
  controllers: [LlmSettingsController, InternalLlmRuntimeController],
  providers: [LlmSettingsService],
  exports: [LlmSettingsService],
})
export class LlmSettingsModule {}
