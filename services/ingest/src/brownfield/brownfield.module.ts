/**
 * @fileoverview Brownfield parity pack + scaffold exports.
 */
import { Module, forwardRef } from '@nestjs/common';
import { BrownfieldParityPackService } from './brownfield-parity-pack.service';
import { BrownfieldInternalController } from './brownfield-internal.controller';
import { MddPersistenceModule } from '../mdd-persistence/mdd-persistence.module';
import { ChatModule } from '../chat/chat.module';
import { ScaffoldFromMddService } from '../scaffold/scaffold-from-mdd.service';
import { RepositoriesModule } from '../repositories/repositories.module';

@Module({
  imports: [
    forwardRef(() => ChatModule),
    MddPersistenceModule,
    RepositoriesModule,
  ],
  controllers: [BrownfieldInternalController],
  providers: [BrownfieldParityPackService, ScaffoldFromMddService],
  exports: [BrownfieldParityPackService, ScaffoldFromMddService],
})
export class BrownfieldModule {}
