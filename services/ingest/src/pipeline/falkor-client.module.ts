/**
 * Global FalkorDB shared client (Nest).
 */
import { Global, Module } from '@nestjs/common';
import { FalkorClientService } from './falkor-client.service';

@Global()
@Module({
  providers: [FalkorClientService],
  exports: [FalkorClientService],
})
export class FalkorClientModule {}
