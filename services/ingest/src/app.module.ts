/**
 * @fileoverview Módulo raíz **AppModule** del servicio Ingest: Postgres (TypeORM), dominios, repos,
 * credenciales, sync BullMQ, webhooks Bitbucket/GitHub, chat NL→Cypher, análisis, métricas y shadow SDD.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RepositoryEntity } from './repositories/entities/repository.entity';
import { SyncJob } from './repositories/entities/sync-job.entity';
import { IndexedFile } from './repositories/entities/indexed-file.entity';
import { CredentialEntity } from './credentials/entities/credential.entity';
import { ProjectEntity } from './projects/entities/project.entity';
import { ProjectRepositoryEntity } from './repositories/entities/project-repository.entity';
import { DomainEntity } from './domains/entities/domain.entity';
import { ProjectDomainDependencyEntity } from './domains/entities/project-domain-dependency.entity';
import { DomainDomainVisibilityEntity } from './domains/entities/domain-domain-visibility.entity';
import { EmbeddingSpaceEntity } from './embedding/entities/embedding-space.entity';
import { UserEntity } from './users/entities/user.entity';
import { BitbucketModule } from './bitbucket/bitbucket.module';
import { ChatModule } from './chat/chat.module';
import { CredentialsModule } from './credentials/credentials.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { ProvidersModule } from './providers/providers.module';
import { ProjectsModule } from './projects/projects.module';
import { RepositoriesModule } from './repositories/repositories.module';
import { ShadowModule } from './shadow/shadow.module';
import { SyncModule } from './sync/sync.module';
import { UsersModule } from './users/users.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ReviewModule } from './review/review.module';
import { MetricsModule } from './metrics/metrics.module';
import { SharedBullModule } from './shared-bull/shared-bull.module';
import { FalkorClientModule } from './pipeline/falkor-client.module';
import { AnalysisModule } from './analysis/analysis.module';
import { LlmSettingsModule } from './llm-settings/llm-settings.module';
import { LlmSettingsEntity } from './llm-settings/entities/llm-settings.entity';
import { MddSnapshotEntity } from './mdd-persistence/entities/mdd-snapshot.entity';
import { ChatConversationEntity } from './chat/entities/chat-conversation.entity';
import { ChatIntegrationBatchEntity } from './chat/entities/chat-integration-batch.entity';
import { ChatMessageEntity } from './chat/entities/chat-message.entity';
import { MddPersistenceModule } from './mdd-persistence/mdd-persistence.module';
import { BrownfieldModule } from './brownfield/brownfield.module';
import { TheForgeIntegrationEntity } from './theforge/entities/theforge-integration.entity';
import { SystemSettingsEntity } from './system-settings/entities/system-settings.entity';
import { SystemSettingsModule } from './system-settings/system-settings.module';

@Module({
  imports: [
    MetricsModule,
    EmbeddingModule,
    FalkorClientModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.PGHOST ?? 'localhost',
      port: parseInt(process.env.PGPORT ?? '5432', 10),
      username: process.env.PGUSER ?? 'falkorspecs',
      password: process.env.PGPASSWORD ?? 'falkorspecs',
      database: process.env.PGDATABASE ?? 'falkorspecs',
      entities: [
        ProjectEntity,
        ProjectRepositoryEntity,
        RepositoryEntity,
        EmbeddingSpaceEntity,
        SyncJob,
        IndexedFile,
        CredentialEntity,
        DomainEntity,
        ProjectDomainDependencyEntity,
        DomainDomainVisibilityEntity,
        UserEntity,
        LlmSettingsEntity,
        MddSnapshotEntity,
        ChatConversationEntity,
        ChatMessageEntity,
        ChatIntegrationBatchEntity,
        TheForgeIntegrationEntity,
        SystemSettingsEntity,
      ],
      synchronize: true,
      logging: process.env.NODE_ENV === 'development',
    }),
    BitbucketModule,
    ChatModule,
    CredentialsModule,
    ProjectsModule,
    ProvidersModule,
    SharedBullModule,
    RepositoriesModule,
    ShadowModule,
    SyncModule,
    UsersModule,
    WebhooksModule,
    ReviewModule,
    AnalysisModule,
    LlmSettingsModule,
    SystemSettingsModule,
    MddPersistenceModule,
    BrownfieldModule,
  ],
})
/** Módulo principal del microservicio Ingest. */
export class AppModule { }
