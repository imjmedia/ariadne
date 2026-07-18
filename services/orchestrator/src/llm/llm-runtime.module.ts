import { Module } from '@nestjs/common';
import { InternalOrchestratorLlmController } from './internal-orchestrator-llm.controller';

@Module({
  controllers: [InternalOrchestratorLlmController],
})
export class LlmRuntimeModule {}
