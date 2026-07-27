/**
 * @fileoverview Brownfield parity pack + scaffold exports.
 */
import { Module, forwardRef } from '@nestjs/common';
import { BrownfieldParityPackService } from './brownfield-parity-pack.service';
import { BrownfieldInternalController } from './brownfield-internal.controller';
import { BrownfieldProjectInternalController } from './brownfield-project-internal.controller';
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
  controllers: [BrownfieldInternalController, BrownfieldProjectInternalController],
  providers: [BrownfieldParityPackService, ScaffoldFromMddService],
  exports: [BrownfieldParityPackService, ScaffoldFromMddService],
})
export class BrownfieldModule {}
