/**
 * @fileoverview The Forge integration (brownfield converge + optional chat promotion).
 */
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatConversationEntity } from '../chat/entities/chat-conversation.entity';
import { ChatMessageEntity } from '../chat/entities/chat-message.entity';
import { ChatModule } from '../chat/chat.module';
import { MddPersistenceModule } from '../mdd-persistence/mdd-persistence.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { ProjectRepositoryEntity } from '../repositories/entities/project-repository.entity';
import { ProjectEntity } from '../projects/entities/project.entity';
import { ChangePromotionPackService } from './change-promotion-pack.service';
import { CursorTasksDocumentService } from './cursor-tasks-document.service';
import { TheForgeBrownfieldCatalogService } from './theforge-brownfield-catalog.service';
import { TheForgeIntegrationEntity } from './entities/theforge-integration.entity';
import { TheForgeConvergeService } from './theforge-converge.service';
import { TheForgeIntegrationController } from './theforge-integration.controller';
import { TheForgeIntegrationService } from './theforge-integration.service';
import { TheForgeProjectLinkService } from './theforge-project-link.service';
import { TheForgeProjectStageService } from './theforge-project-stage.service';
import { TheForgePromotionService } from './theforge-promotion.service';
import {
  TheForgeClient,
  TheForgeClientHttp,
  TheForgeClientMock,
} from './theforge-client.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RepositoryEntity,
      ProjectEntity,
      ProjectRepositoryEntity,
      ChatConversationEntity,
      ChatMessageEntity,
      TheForgeIntegrationEntity,
    ]),
    RepositoriesModule,
    forwardRef(() => MddPersistenceModule),
    forwardRef(() => ChatModule),
  ],
  controllers: [TheForgeIntegrationController],
  providers: [
    TheForgeConvergeService,
    TheForgeIntegrationService,
    TheForgeBrownfieldCatalogService,
    TheForgeProjectLinkService,
    ChangePromotionPackService,
    CursorTasksDocumentService,
    TheForgePromotionService,
    TheForgeProjectStageService,
    TheForgeClientMock,
    TheForgeClientHttp,
    {
      provide: TheForgeClient,
      useFactory: (integration: TheForgeIntegrationService, http: TheForgeClientHttp, mock: TheForgeClientMock) => {
        if (integration.isMockMode()) return mock;
        return http;
      },
      inject: [TheForgeIntegrationService, TheForgeClientHttp, TheForgeClientMock],
    },
  ],
  exports: [
    TheForgeConvergeService,
    TheForgeIntegrationService,
    TheForgeBrownfieldCatalogService,
    TheForgeProjectLinkService,
    ChangePromotionPackService,
    CursorTasksDocumentService,
    TheForgePromotionService,
    TheForgeProjectStageService,
  ],
})
export class TheForgeModule {}
