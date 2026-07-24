/**
 * @fileoverview API REST de proyectos (multi-root): listar, detalle, file, crear, actualizar, eliminar.
 */
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { FileContentService } from '../repositories/file-content.service';
import { JobAnalysisService } from '../repositories/job-analysis.service';
import { RepositoriesService } from '../repositories/repositories.service';
import { DomainsService } from '../domains/domains.service';
import { SyncStatusService } from './sync-status.service';
import { actorFromHeaders } from '../credentials/credential-actor';
import { TheForgeProjectLinkService } from '../theforge/theforge-project-link.service';
import { TheForgeProjectStageService } from '../theforge/theforge-project-stage.service';
import { TheForgeIntegrationService } from '../theforge/theforge-integration.service';
import type { ProjectTheForgeStageBody } from '../theforge/theforge-project-stage.service';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly service: ProjectsService,
    private readonly fileContent: FileContentService,
    private readonly jobAnalysis: JobAnalysisService,
    private readonly reposService: RepositoriesService,
    private readonly domains: DomainsService,
    private readonly syncStatus: SyncStatusService,
    private readonly forgeLink: TheForgeProjectLinkService,
    private readonly forgeStage: TheForgeProjectStageService,
    private readonly forgeIntegration: TheForgeIntegrationService,
  ) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id/domain-dependencies')
  listDomainDependencies(@Param('id') id: string) {
    return this.domains.listProjectDependencies(id);
  }

  @Post(':id/domain-dependencies')
  addDomainDependency(
    @Param('id') id: string,
    @Body()
    body: { dependsOnDomainId: string; connectionType?: string; description?: string | null },
  ) {
    return this.domains.addProjectDependency(id, body);
  }

  @Delete(':id/domain-dependencies/:depId')
  async removeDomainDependency(@Param('id') id: string, @Param('depId') depId: string) {
    await this.domains.removeProjectDependency(id, depId);
    return { ok: true };
  }

  /** Contenido de un archivo buscando en todos los repos del proyecto (multi-root). MCP y chat por proyecto. */
  /** Enrutamiento Falkor (sharding por proyecto / por dominio) para MCP y API. */
  @Get(':id/graph-routing')
  graphRouting(@Param('id') id: string) {
    return this.service.getGraphRouting(id);
  }

  /** Sync freshness for MCP get_sync_status and UI badges. */
  @Get(':id/sync-status')
  getSyncStatus(@Param('id') id: string) {
    return this.syncStatus.getStatusForProjectOrRepo(id);
  }

  /** Lista archivos del proyecto (multi-root). Filtra por pathPrefix opcional. */
  @Get(':id/tree')
  async listTree(
    @Param('id') projectId: string,
    @Query('path') path: string | undefined,
    @Query('ref') ref?: string,
  ) {
    const repos = await this.reposService.findAll(projectId);
    const allFiles: string[] = [];
    const prefix = path?.trim() || undefined;
    for (const repo of repos) {
      const files = await this.fileContent.listFiles(repo.id, prefix, ref ?? null);
      allFiles.push(...files);
    }
    return { files: [...new Set(allFiles)].sort() };
  }

  @Get(':id/file')
  async getFile(
    @Param('id') projectId: string,
    @Query('path') path: string,
    @Query('ref') ref?: string,
  ) {
    const content = await this.fileContent.getFileContentSafeByProject(projectId, path?.trim() ?? '');
    if (content == null) return { content: null };
    return { content };
  }

  /** Heurística multi-root: qué `repositories.id` encaja con la ruta local (IDE). */
  @Get(':id/resolve-repo-for-path')
  resolveRepoForPath(@Param('id') projectId: string, @Query('path') path: string) {
    return this.service.resolveRepoForPath(projectId, path?.trim() ?? '');
  }

  /**
   * Análisis de job incremental por **proyecto** + `jobId` (el job ya ancla `repositoryId`; se valida enlace `project_repositories`).
   * Alternativa: `GET /repositories/:repositoryId/jobs/:jobId/analysis`.
   */
  @Get(':id/jobs/:jobId/analysis')
  getJobAnalysis(@Param('id') projectId: string, @Param('jobId') jobId: string) {
    return this.jobAnalysis.analyzeJobForProject(projectId, jobId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: { name?: string | null; description?: string | null }) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string | null; description?: string | null; domainId?: string | null },
  ) {
    return this.service.update(id, body);
  }

  /** Vincula este proyecto Ariadne con un proyecto brownfield (LEGACY) en The Forge. */
  @Put(':id/theforge-link')
  async linkTheForge(
    @Param('id') id: string,
    @Body() body: { forgeProjectId: string; forgeProjectName?: string | null },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const actor = actorFromHeaders(headers);
    if (!actor.userId) throw new ForbiddenException('Usuario no identificado');
    const status = await this.forgeIntegration.getStatus();
    if (!status.enabled && !status.mock) {
      throw new ForbiddenException('The Forge no está configurado. Actívalo en Ajustes.');
    }
    await this.forgeLink.linkProject(id, body.forgeProjectId, body.forgeProjectName);
    return this.service.findOne(id);
  }

  /** Quita el vínculo con The Forge (proyecto y repos asociados con el mismo forgeProjectId). */
  @Delete(':id/theforge-link')
  async unlinkTheForge(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const actor = actorFromHeaders(headers);
    if (!actor.userId) throw new ForbiddenException('Usuario no identificado');
    await this.forgeLink.unlinkProject(id);
    return this.service.findOne(id);
  }

  /** Vista previa de documentos (descripción + # Tasks) antes de crear etapa en The Forge. */
  @Post(':id/theforge-stage/preview')
  async previewTheForgeStage(
    @Param('id') id: string,
    @Body() body: ProjectTheForgeStageBody,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const actor = actorFromHeaders(headers);
    return this.forgeStage.preview(actor, id, body);
  }

  /** Crea etapa en The Forge con documentos generados por Ariadne (proyecto vinculado). */
  @Post(':id/theforge-stage')
  async createTheForgeStage(
    @Param('id') id: string,
    @Body() body: ProjectTheForgeStageBody,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const actor = actorFromHeaders(headers);
    return this.forgeStage.createStage(actor, id, body);
  }

  /** Rol opcional del repo en el proyecto (chat multi-root: inferencia de alcance). */
  @Patch(':id/repositories/:repoId')
  setRepoRole(
    @Param('id') projectId: string,
    @Param('repoId') repoId: string,
    @Body() body: { role?: string | null },
  ) {
    return this.service.setRepositoryRole(projectId, repoId, body.role);
  }

  /**
   * Desasocia el repo del proyecto (quita project_repositories y nodos Falkor de ese slice).
   * No borra el repositorio en Postgres ni en /repositorios.
   */
  @Delete(':id/repositories/:repoId')
  async detachRepository(@Param('id') projectId: string, @Param('repoId') repoId: string) {
    return this.reposService.detachFromProject(projectId, repoId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
  }

  /** Regenera el ID del proyecto (sin perder datos). Redirigir al cliente al nuevo ID. */
  @Post(':id/regenerate-id')
  async regenerateId(@Param('id') id: string) {
    return this.service.regenerateId(id);
  }
}
