/**
 * @fileoverview Indexa embeddings en Function, Component, Document (chunks legado), StorybookDoc, MarkdownDoc, Model (Prisma/TypeORM), Enum (Prisma), OpenApiOperation, StrapiContentType y StrapiRoute para RAG.
 * Requiere EMBEDDING_PROVIDER + FalkorDB con soporte vectorial (`vecf32`, CREATE VECTOR INDEX), p. ej. FalkorDB 4.x según docs.
 * Si ves `Unknown function 'vecf32'`, actualiza FalkorDB o desactiva embed post-sync con SYNC_SKIP_EMBED_INDEX=1.
 *
 * Vars de entorno para ajustar rendimiento:
 *   EMBED_INDEX_BATCH_SIZE   - nodos por llamada al proveedor de embeddings (default 32)
 *   EMBED_INDEX_CONCURRENCY  - batches simultáneos (default 5)
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FalkorDB } from 'falkordb';
import { FALKOR_EMBEDDABLE_NODE_LABELS } from 'ariadne-common';
import {
  getFalkorConfig,
  effectiveShardMode,
  listGraphNamesForProjectRouting,
} from '../pipeline/falkor';
import { ProjectEntity } from '../projects/entities/project.entity';
import { RepositoriesService } from '../repositories/repositories.service';
import { FileContentService } from '../repositories/file-content.service';
import { EmbeddingSpaceService } from './embedding-space.service';

async function pMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  { concurrency = 5 }: { concurrency?: number } = {},
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  const next = async (): Promise<void> => {
    const idx = i++;
    if (idx >= items.length) return;
    results[idx] = await fn(items[idx]);
    await next();
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
  return results;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function parsePosInt(raw: string | undefined, fallback: number): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

type FalkorDbClient = Awaited<ReturnType<typeof FalkorDB.connect>>;

function rowAsRecord(row: unknown, keys: string[]): Record<string, unknown> {
  if (row !== null && typeof row === 'object' && !Array.isArray(row)) {
    return row as Record<string, unknown>;
  }
  const arr = Array.isArray(row) ? row : [row];
  const out: Record<string, unknown> = {};
  for (let i = 0; i < keys.length; i++) out[keys[i]] = arr[i];
  return out;
}

type EmbedProvider = {
  embed: (t: string) => Promise<number[]>;
  embedBatch?: (ts: string[]) => Promise<number[][]>;
  getDimension: () => number;
};

/**
 * Embeds a batch of texts using embedBatch if available, falling back to
 * per-item embed with per-node error isolation when it is not.
 * Returns an array parallel to `texts`: ok items carry the vector; failed
 * items carry the error message.
 */
async function embedAll(
  texts: string[],
  provider: EmbedProvider,
  batchSize: number,
  concurrency: number,
): Promise<Array<{ ok: true; vec: number[] } | { ok: false; error: string }>> {
  if (texts.length === 0) return [];

  if (provider.embedBatch) {
    const chunks = chunkArray(texts, batchSize);
    const chunkResults = await pMap(
      chunks,
      async (chunk) => {
        try {
          const vecs = await provider.embedBatch!(chunk);
          return vecs.map(vec => ({ ok: true as const, vec }));
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          return chunk.map(() => ({ ok: false as const, error }));
        }
      },
      { concurrency },
    );
    return chunkResults.flat();
  }

  // Fallback: per-item with per-node error isolation (preserves original behaviour)
  return pMap(
    texts,
    async (text) => {
      try {
        return { ok: true as const, vec: await provider.embed(text) };
      } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
      }
    },
    { concurrency },
  );
}

@Injectable()
export class EmbedIndexService {
  constructor(
    private readonly repos: RepositoriesService,
    private readonly fileContent: FileContentService,
    private readonly embeddingSpaces: EmbeddingSpaceService,
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
  ) {}

  async runEmbedIndex(repositoryId: string): Promise<{ indexed: number; errors: number }> {
    await this.repos.findOne(repositoryId);
    const linked = await this.repos.getProjectIdsForRepo(repositoryId);
    const falkorProjectIds = linked.length > 0 ? linked : [repositoryId];
    let indexed = 0;
    let errors = 0;
    for (const falkorProjectId of falkorProjectIds) {
      const r = await this.runEmbedIndexForFalkorProject(falkorProjectId, repositoryId);
      indexed += r.indexed;
      errors += r.errors;
    }
    if (errors > 0) {
      console.warn(
        `[embed-index] ${indexed} indexed, ${errors} errors. ` +
          `Check: EMBEDDING_PROVIDER, API keys, FalkorDB con vecf32/vector index (upgrade si Unknown function 'vecf32'), rate limits. ` +
          `Para omitir embed en sync: SYNC_SKIP_EMBED_INDEX=1.`,
      );
    }
    return { indexed, errors };
  }

  async runEmbedIndexForFalkorProject(
    falkorProjectId: string,
    repositoryIdForFileContent: string,
  ): Promise<{ indexed: number; errors: number }> {
    const writeBinding =
      await this.embeddingSpaces.getWriteBindingForRepository(repositoryIdForFileContent);
    const embed = writeBinding.provider;
    if (!embed?.isAvailable()) {
      throw new Error(
        'Embedding provider not configured for write. Set EMBEDDING_PROVIDER + keys, OLLAMA_HOST for ollama, or link repository write/read embedding space via PATCH.',
      );
    }
    const prop = writeBinding.graphProperty;
    const dim = embed.getDimension();

    const projRow = await this.projectRepo.findOne({ where: { id: falkorProjectId } });
    const shardMode = projRow ? effectiveShardMode(projRow.falkorShardMode) : 'project';
    const segments = Array.isArray(projRow?.falkorDomainSegments) ? projRow!.falkorDomainSegments! : [];
    const graphNames = listGraphNamesForProjectRouting(
      falkorProjectId,
      shardMode === 'domain' ? 'domain' : 'project',
      segments,
    );

    const config = getFalkorConfig();
    const client = await FalkorDB.connect({
      socket: { host: config.host, port: config.port },
    });
    let indexed = 0;
    let errors = 0;

    if (graphNames.length > 0) {
      const probeGraph = client.selectGraph(graphNames[0]);
      const vectorsOk = await this.falkorSupportsVecf32(probeGraph, dim);
      if (!vectorsOk) {
        console.warn(
          '[embed-index] FalkorDB no expone vecf32 (soporte vector). Se omite embed-index; el sync de código sigue siendo válido. ' +
            'Opciones: actualizar FalkorDB a una versión con vectores, o SYNC_SKIP_EMBED_INDEX=1 para no intentar embed tras cada sync.',
        );
        await client.close();
        return { indexed: 0, errors: 0 };
      }
    }

    for (const gName of graphNames) {
      const graph = client.selectGraph(gName);
      try {
        const part = await this.embedOneGraph(
          graph,
          falkorProjectId,
          repositoryIdForFileContent,
          embed,
          prop,
          dim,
        );
        indexed += part.indexed;
        errors += part.errors;
      } catch {
        /* grafo vacío o nombre legacy sin datos */
      }
    }

    await client.close();
    return { indexed, errors };
  }

  private async falkorSupportsVecf32(
    graph: ReturnType<FalkorDbClient['selectGraph']>,
    dim: number,
  ): Promise<boolean> {
    if (!Number.isFinite(dim) || dim < 1) return false;
    const vec = new Array(dim).fill(0);
    try {
      await graph.query(`RETURN vecf32($vec) AS v`, { params: { vec } });
      return true;
    } catch {
      return false;
    }
  }

  private async embedOneGraph(
    graph: ReturnType<FalkorDbClient['selectGraph']>,
    falkorProjectId: string,
    repositoryIdForFileContent: string,
    embed: EmbedProvider,
    prop: string,
    dim: number,
  ): Promise<{ indexed: number; errors: number }> {
    const batchSize = parsePosInt(process.env.EMBED_INDEX_BATCH_SIZE, 32);
    const concurrency = parsePosInt(process.env.EMBED_INDEX_CONCURRENCY, 5);
    let indexed = 0;
    let errors = 0;

    // ── Functions ─────────────────────────────────────────────────────────
    const funcRes = (await graph.query(
      `MATCH (n:Function) WHERE n.projectId = $projectId RETURN n.path AS path, n.name AS name, n.description AS description, n.startLine AS startLine, n.endLine AS endLine`,
      { params: { projectId: falkorProjectId } },
    )) as { data?: unknown[] };

    // Sort by path so consecutive functions in the same file share cached content
    const funcRows = (funcRes.data ?? [])
      .map(r => rowAsRecord(r, ['path', 'name', 'description', 'startLine', 'endLine']))
      .sort((a, b) => String(a.path ?? '').localeCompare(String(b.path ?? '')));

    interface FuncItem { text: string; path: string; name: string }
    const funcItems: FuncItem[] = [];
    let cachedPath: string | null = null;
    let cachedContent: string | null = null;
    for (const r of funcRows) {
      const path = String(r.path ?? '');
      const name = String(r.name ?? '');
      const description = r.description != null ? String(r.description) : null;
      const startLine = typeof r.startLine === 'number' ? r.startLine : null;
      const endLine = typeof r.endLine === 'number' ? r.endLine : null;
      let text = [name, path, description].filter(Boolean).join(' ');
      if (startLine != null && endLine != null && endLine >= startLine) {
        if (path !== cachedPath) {
          cachedPath = path;
          cachedContent = await this.fileContent.getFileContentSafe(repositoryIdForFileContent, path);
        }
        if (cachedContent) {
          const lines = cachedContent.split(/\r?\n/);
          const slice = lines.slice(Math.max(0, startLine - 1), endLine).join('\n').trim();
          if (slice.length > 30) text = slice.slice(0, 4000);
        }
      }
      funcItems.push({ text, path, name });
    }

    const funcEmbeds = await embedAll(funcItems.map(i => i.text), embed, batchSize, concurrency);
    const funcSuccesses = funcItems
      .map((item, i) => ({ item, result: funcEmbeds[i] }))
      .filter(({ result }) => result.ok);
    const funcFailures = funcEmbeds.filter(r => !r.ok);

    if (funcSuccesses.length > 0) {
      const chunks = chunkArray(funcSuccesses, batchSize);
      for (const chunk of chunks) {
        const batch = chunk.map(({ item, result }) => ({
          path: item.path, name: item.name, vec: (result as { ok: true; vec: number[] }).vec,
        }));
        try {
          await graph.query(
            `UNWIND $batch AS item MATCH (n:Function {path: item.path, name: item.name, projectId: $projectId}) SET n.${prop} = vecf32(item.vec)`,
            { params: { batch, projectId: falkorProjectId } },
          );
          indexed += chunk.length;
        } catch (e) {
          errors += chunk.length;
          if (errors <= 3) console.warn(`[embed-index] Function UNWIND write failed:`, e instanceof Error ? e.message : String(e));
        }
      }
    }
    errors += funcFailures.length;
    if (funcFailures.length > 0 && errors <= 3) {
      console.warn(`[embed-index] ${funcFailures.length} Function embed error(s):`, (funcFailures[0] as { error: string }).error);
    }

    // ── Components ────────────────────────────────────────────────────────
    const compRes = (await graph.query(
      `MATCH (n:Component) WHERE n.projectId = $projectId RETURN n.name AS name, n.description AS description`,
      { params: { projectId: falkorProjectId } },
    )) as { data?: unknown[] };
    const compRows = (compRes.data ?? []).map(r => rowAsRecord(r, ['name', 'description']));
    interface CompItem { text: string; name: string }
    const compItems: CompItem[] = compRows.map(r => ({
      text: [String(r.name ?? ''), r.description != null ? String(r.description) : null].filter(Boolean).join(' '),
      name: String(r.name ?? ''),
    }));

    const compEmbeds = await embedAll(compItems.map(i => i.text), embed, batchSize, concurrency);
    const compSuccesses = compItems.map((item, i) => ({ item, result: compEmbeds[i] })).filter(({ result }) => result.ok);
    errors += compEmbeds.filter(r => !r.ok).length;

    for (const chunk of chunkArray(compSuccesses, batchSize)) {
      const batch = chunk.map(({ item, result }) => ({
        name: item.name, vec: (result as { ok: true; vec: number[] }).vec,
      }));
      try {
        await graph.query(
          `UNWIND $batch AS item MATCH (n:Component {name: item.name, projectId: $projectId}) SET n.${prop} = vecf32(item.vec)`,
          { params: { batch, projectId: falkorProjectId } },
        );
        indexed += chunk.length;
      } catch (e) {
        errors += chunk.length;
        if (errors <= 3) console.warn(`[embed-index] Component UNWIND write failed:`, e instanceof Error ? e.message : String(e));
      }
    }

    // ── Documents ─────────────────────────────────────────────────────────
    const docRes = (await graph.query(
      `MATCH (d:Document) WHERE d.projectId = $projectId AND d.chunkText IS NOT NULL AND trim(d.chunkText) <> '' RETURN d.path AS path, d.chunkIndex AS chunkIndex, d.heading AS heading, d.chunkText AS chunkText`,
      { params: { projectId: falkorProjectId } },
    )) as { data?: unknown[] };
    const docRows = (docRes.data ?? []).map(r => rowAsRecord(r, ['path', 'chunkIndex', 'heading', 'chunkText']));
    interface DocItem { text: string; path: string; chunkIndex: number }
    const docItems: DocItem[] = docRows
      .map(r => {
        const path = String(r.path ?? '');
        const chunkIndexRaw = r.chunkIndex;
        const chunkIndex = typeof chunkIndexRaw === 'number' ? chunkIndexRaw : Number(chunkIndexRaw);
        const heading = r.heading != null ? String(r.heading) : '';
        const chunkText = String(r.chunkText ?? '');
        const text = [heading, path, chunkText].filter(Boolean).join('\n').slice(0, 8000);
        return { text, path, chunkIndex };
      })
      .filter(i => i.text.length >= 20);

    const docEmbeds = await embedAll(docItems.map(i => i.text), embed, batchSize, concurrency);
    const docSuccesses = docItems.map((item, i) => ({ item, result: docEmbeds[i] })).filter(({ result }) => result.ok);
    errors += docEmbeds.filter(r => !r.ok).length;

    for (const chunk of chunkArray(docSuccesses, batchSize)) {
      const batch = chunk.map(({ item, result }) => ({
        path: item.path, chunkIndex: item.chunkIndex, vec: (result as { ok: true; vec: number[] }).vec,
      }));
      try {
        await graph.query(
          `UNWIND $batch AS item MATCH (d:Document {path: item.path, chunkIndex: item.chunkIndex, projectId: $projectId}) SET d.${prop} = vecf32(item.vec)`,
          { params: { batch, projectId: falkorProjectId } },
        );
        indexed += chunk.length;
      } catch (e) {
        errors += chunk.length;
        if (errors <= 3) console.warn(`[embed-index] Document UNWIND write failed:`, e instanceof Error ? e.message : String(e));
      }
    }

    // ── StorybookDocs ──────────────────────────────────────────────────────
    const sbRes = (await graph.query(
      `MATCH (n:StorybookDoc) WHERE n.projectId = $projectId AND n.repoId = $repoId AND n.documentationText IS NOT NULL AND trim(n.documentationText) <> '' RETURN n.sourcePath AS path, n.title AS title, n.documentationText AS documentationText`,
      { params: { projectId: falkorProjectId, repoId: repositoryIdForFileContent } },
    )) as { data?: unknown[] };
    const sbRows = (sbRes.data ?? []).map(r => rowAsRecord(r, ['path', 'title', 'documentationText']));
    interface DocNodeItem { text: string; path: string }
    const sbItems: DocNodeItem[] = sbRows
      .map(r => ({
        text: [r.title != null ? String(r.title) : '', String(r.path ?? ''), String(r.documentationText ?? '')].filter(Boolean).join('\n').slice(0, 12000),
        path: String(r.path ?? ''),
      }))
      .filter(i => i.text.length >= 20);

    const sbEmbeds = await embedAll(sbItems.map(i => i.text), embed, batchSize, concurrency);
    const sbSuccesses = sbItems.map((item, i) => ({ item, result: sbEmbeds[i] })).filter(({ result }) => result.ok);
    errors += sbEmbeds.filter(r => !r.ok).length;

    for (const chunk of chunkArray(sbSuccesses, batchSize)) {
      const batch = chunk.map(({ item, result }) => ({
        path: item.path, vec: (result as { ok: true; vec: number[] }).vec,
      }));
      try {
        await graph.query(
          `UNWIND $batch AS item MATCH (n:StorybookDoc {sourcePath: item.path, projectId: $projectId, repoId: $repoId}) SET n.${prop} = vecf32(item.vec)`,
          { params: { batch, projectId: falkorProjectId, repoId: repositoryIdForFileContent } },
        );
        indexed += chunk.length;
      } catch (e) {
        errors += chunk.length;
        if (errors <= 3) console.warn(`[embed-index] StorybookDoc UNWIND write failed:`, e instanceof Error ? e.message : String(e));
      }
    }

    // ── MarkdownDocs ───────────────────────────────────────────────────────
    const mdRes = (await graph.query(
      `MATCH (n:MarkdownDoc) WHERE n.projectId = $projectId AND n.repoId = $repoId AND n.documentationText IS NOT NULL AND trim(n.documentationText) <> '' RETURN n.sourcePath AS path, n.title AS title, n.documentationText AS documentationText`,
      { params: { projectId: falkorProjectId, repoId: repositoryIdForFileContent } },
    )) as { data?: unknown[] };
    const mdRows = (mdRes.data ?? []).map(r => rowAsRecord(r, ['path', 'title', 'documentationText']));
    const mdItems: DocNodeItem[] = mdRows
      .map(r => ({
        text: [r.title != null ? String(r.title) : '', String(r.path ?? ''), String(r.documentationText ?? '')].filter(Boolean).join('\n').slice(0, 12000),
        path: String(r.path ?? ''),
      }))
      .filter(i => i.text.length >= 20);

    const mdEmbeds = await embedAll(mdItems.map(i => i.text), embed, batchSize, concurrency);
    const mdSuccesses = mdItems.map((item, i) => ({ item, result: mdEmbeds[i] })).filter(({ result }) => result.ok);
    errors += mdEmbeds.filter(r => !r.ok).length;

    for (const chunk of chunkArray(mdSuccesses, batchSize)) {
      const batch = chunk.map(({ item, result }) => ({
        path: item.path, vec: (result as { ok: true; vec: number[] }).vec,
      }));
      try {
        await graph.query(
          `UNWIND $batch AS item MATCH (n:MarkdownDoc {sourcePath: item.path, projectId: $projectId, repoId: $repoId}) SET n.${prop} = vecf32(item.vec)`,
          { params: { batch, projectId: falkorProjectId, repoId: repositoryIdForFileContent } },
        );
        indexed += chunk.length;
      } catch (e) {
        errors += chunk.length;
        if (errors <= 3) console.warn(`[embed-index] MarkdownDoc UNWIND write failed:`, e instanceof Error ? e.message : String(e));
      }
    }

    // ── Models ─────────────────────────────────────────────────────────────
    const modelRes = (await graph.query(
      `MATCH (m:Model) WHERE m.projectId = $projectId AND m.repoId = $repoId RETURN m.path AS path, m.name AS name, m.description AS description, m.fieldSummary AS fieldSummary, m.source AS source`,
      { params: { projectId: falkorProjectId, repoId: repositoryIdForFileContent } },
    )) as { data?: unknown[] };
    const modelRows = (modelRes.data ?? []).map(r => rowAsRecord(r, ['path', 'name', 'description', 'fieldSummary', 'source']));
    interface ModelItem { text: string; path: string; name: string }
    const modelItems: ModelItem[] = modelRows
      .map(r => {
        const path = String(r.path ?? '');
        const name = String(r.name ?? '');
        const source = r.source != null ? String(r.source) : '';
        const text = [name, path, source && `source:${source}`, r.description != null ? String(r.description) : '', r.fieldSummary != null ? `fields:${String(r.fieldSummary)}` : '']
          .filter(Boolean).join('\n').slice(0, 12_000);
        return { text, path, name };
      })
      .filter(i => i.text.length >= 8);

    const modelEmbeds = await embedAll(modelItems.map(i => i.text), embed, batchSize, concurrency);
    const modelSuccesses = modelItems.map((item, i) => ({ item, result: modelEmbeds[i] })).filter(({ result }) => result.ok);
    errors += modelEmbeds.filter(r => !r.ok).length;

    for (const chunk of chunkArray(modelSuccesses, batchSize)) {
      const batch = chunk.map(({ item, result }) => ({
        path: item.path, name: item.name, vec: (result as { ok: true; vec: number[] }).vec,
      }));
      try {
        await graph.query(
          `UNWIND $batch AS item MATCH (m:Model {path: item.path, name: item.name, projectId: $projectId, repoId: $repoId}) SET m.${prop} = vecf32(item.vec)`,
          { params: { batch, projectId: falkorProjectId, repoId: repositoryIdForFileContent } },
        );
        indexed += chunk.length;
      } catch (e) {
        errors += chunk.length;
        if (errors <= 3) console.warn(`[embed-index] Model UNWIND write failed:`, e instanceof Error ? e.message : String(e));
      }
    }

    // ── Enums ──────────────────────────────────────────────────────────────
    const enumRes = (await graph.query(
      `MATCH (e:Enum) WHERE e.projectId = $projectId AND e.repoId = $repoId RETURN e.path AS path, e.name AS name, e.description AS description`,
      { params: { projectId: falkorProjectId, repoId: repositoryIdForFileContent } },
    )) as { data?: unknown[] };
    const enumRows = (enumRes.data ?? []).map(r => rowAsRecord(r, ['path', 'name', 'description']));
    const enumItems: ModelItem[] = enumRows
      .map(r => ({
        text: [String(r.name ?? ''), String(r.path ?? ''), r.description != null ? String(r.description) : ''].filter(Boolean).join('\n').slice(0, 8000),
        path: String(r.path ?? ''),
        name: String(r.name ?? ''),
      }))
      .filter(i => i.text.length >= 4);

    const enumEmbeds = await embedAll(enumItems.map(i => i.text), embed, batchSize, concurrency);
    const enumSuccesses = enumItems.map((item, i) => ({ item, result: enumEmbeds[i] })).filter(({ result }) => result.ok);
    errors += enumEmbeds.filter(r => !r.ok).length;

    for (const chunk of chunkArray(enumSuccesses, batchSize)) {
      const batch = chunk.map(({ item, result }) => ({
        path: item.path, name: item.name, vec: (result as { ok: true; vec: number[] }).vec,
      }));
      try {
        await graph.query(
          `UNWIND $batch AS item MATCH (e:Enum {path: item.path, name: item.name, projectId: $projectId, repoId: $repoId}) SET e.${prop} = vecf32(item.vec)`,
          { params: { batch, projectId: falkorProjectId, repoId: repositoryIdForFileContent } },
        );
        indexed += chunk.length;
      } catch (e) {
        errors += chunk.length;
        if (errors <= 3) console.warn(`[embed-index] Enum UNWIND write failed:`, e instanceof Error ? e.message : String(e));
      }
    }

    // ── OpenApiOperations ─────────────────────────────────────────────────
    const opRes = (await graph.query(
      `MATCH (op:OpenApiOperation) WHERE op.projectId = $projectId AND op.repoId = $repoId RETURN op.pathTemplate AS pathTemplate, op.method AS method, op.summary AS summary, op.specPath AS specPath`,
      { params: { projectId: falkorProjectId, repoId: repositoryIdForFileContent } },
    )) as { data?: unknown[] };
    interface OpItem { text: string; pathTemplate: string; method: string }
    const opItems: OpItem[] = (opRes.data ?? [])
      .map(r => rowAsRecord(r, ['pathTemplate', 'method', 'summary', 'specPath']))
      .map(r => {
        const pathTemplate = String(r.pathTemplate ?? '');
        const method = String(r.method ?? '');
        const text = [method, pathTemplate, r.summary != null ? String(r.summary) : '', r.specPath != null ? String(r.specPath) : ''].filter(Boolean).join(' ').slice(0, 8000);
        return { text, pathTemplate, method };
      })
      .filter(i => i.text.length >= 4);

    const opEmbeds = await embedAll(opItems.map(i => i.text), embed, batchSize, concurrency);
    const opSuccesses = opItems.map((item, i) => ({ item, result: opEmbeds[i] })).filter(({ result }) => result.ok);
    errors += opEmbeds.filter(r => !r.ok).length;

    for (const chunk of chunkArray(opSuccesses, batchSize)) {
      const batch = chunk.map(({ item, result }) => ({
        pathTemplate: item.pathTemplate, method: item.method, vec: (result as { ok: true; vec: number[] }).vec,
      }));
      try {
        await graph.query(
          `UNWIND $batch AS item MATCH (op:OpenApiOperation {pathTemplate: item.pathTemplate, method: item.method, projectId: $projectId, repoId: $repoId}) SET op.${prop} = vecf32(item.vec)`,
          { params: { batch, projectId: falkorProjectId, repoId: repositoryIdForFileContent } },
        );
        indexed += chunk.length;
      } catch (e) {
        errors += chunk.length;
        if (errors <= 3) console.warn(`[embed-index] OpenApiOperation UNWIND write failed:`, e instanceof Error ? e.message : String(e));
      }
    }

    // ── StrapiContentTypes ────────────────────────────────────────────────
    const ctRes = (await graph.query(
      `MATCH (ct:StrapiContentType) WHERE ct.projectId = $projectId AND ct.repoId = $repoId RETURN ct.path AS path, ct.name AS name, ct.displayName AS displayName, ct.strapiUid AS strapiUid, ct.attributesSummary AS attributesSummary, ct.apiName AS apiName`,
      { params: { projectId: falkorProjectId, repoId: repositoryIdForFileContent } },
    )) as { data?: unknown[] };
    interface CtItem { text: string; path: string; name: string }
    const ctItems: CtItem[] = (ctRes.data ?? [])
      .map(r => rowAsRecord(r, ['path', 'name', 'displayName', 'strapiUid', 'attributesSummary', 'apiName']))
      .map(r => {
        const path = String(r.path ?? '');
        const name = String(r.name ?? '');
        const text = [name, r.displayName != null ? String(r.displayName) : '', r.strapiUid != null ? String(r.strapiUid) : '', r.apiName != null ? String(r.apiName) : '', r.attributesSummary != null ? String(r.attributesSummary) : '', path].filter(Boolean).join('\n').slice(0, 12_000);
        return { text, path, name };
      })
      .filter(i => i.text.length >= 8);

    const ctEmbeds = await embedAll(ctItems.map(i => i.text), embed, batchSize, concurrency);
    const ctSuccesses = ctItems.map((item, i) => ({ item, result: ctEmbeds[i] })).filter(({ result }) => result.ok);
    errors += ctEmbeds.filter(r => !r.ok).length;

    for (const chunk of chunkArray(ctSuccesses, batchSize)) {
      const batch = chunk.map(({ item, result }) => ({
        path: item.path, name: item.name, vec: (result as { ok: true; vec: number[] }).vec,
      }));
      try {
        await graph.query(
          `UNWIND $batch AS item MATCH (ct:StrapiContentType {path: item.path, name: item.name, projectId: $projectId, repoId: $repoId}) SET ct.${prop} = vecf32(item.vec)`,
          { params: { batch, projectId: falkorProjectId, repoId: repositoryIdForFileContent } },
        );
        indexed += chunk.length;
      } catch (e) {
        errors += chunk.length;
        if (errors <= 3) console.warn(`[embed-index] StrapiContentType UNWIND write failed:`, e instanceof Error ? e.message : String(e));
      }
    }

    // ── StrapiRoutes ──────────────────────────────────────────────────────
    const srRes = (await graph.query(
      `MATCH (sr:StrapiRoute) WHERE sr.projectId = $projectId AND sr.repoId = $repoId RETURN sr.path AS path, sr.method AS method, sr.routePath AS routePath, sr.handler AS handler, sr.apiName AS apiName, sr.routeSource AS routeSource`,
      { params: { projectId: falkorProjectId, repoId: repositoryIdForFileContent } },
    )) as { data?: unknown[] };
    interface SrItem { text: string; path: string; method: string; routePath: string }
    const srItems: SrItem[] = (srRes.data ?? [])
      .map(r => rowAsRecord(r, ['path', 'method', 'routePath', 'handler', 'apiName', 'routeSource']))
      .map(r => {
        const path = String(r.path ?? '');
        const method = String(r.method ?? '');
        const routePath = String(r.routePath ?? '');
        const text = [method, routePath, r.handler != null ? String(r.handler) : '', r.apiName != null ? String(r.apiName) : '', r.routeSource != null ? String(r.routeSource) : '', path].filter(Boolean).join(' ').slice(0, 8000);
        return { text, path, method, routePath };
      })
      .filter(i => i.text.length >= 4);

    const srEmbeds = await embedAll(srItems.map(i => i.text), embed, batchSize, concurrency);
    const srSuccesses = srItems.map((item, i) => ({ item, result: srEmbeds[i] })).filter(({ result }) => result.ok);
    errors += srEmbeds.filter(r => !r.ok).length;

    for (const chunk of chunkArray(srSuccesses, batchSize)) {
      const batch = chunk.map(({ item, result }) => ({
        path: item.path, method: item.method, routePath: item.routePath, vec: (result as { ok: true; vec: number[] }).vec,
      }));
      try {
        await graph.query(
          `UNWIND $batch AS item MATCH (sr:StrapiRoute {path: item.path, method: item.method, routePath: item.routePath, projectId: $projectId, repoId: $repoId}) SET sr.${prop} = vecf32(item.vec)`,
          { params: { batch, projectId: falkorProjectId, repoId: repositoryIdForFileContent } },
        );
        indexed += chunk.length;
      } catch (e) {
        errors += chunk.length;
        if (errors <= 3) console.warn(`[embed-index] StrapiRoute UNWIND write failed:`, e instanceof Error ? e.message : String(e));
      }
    }

    // ── Vector indexes ────────────────────────────────────────────────────
    for (const label of FALKOR_EMBEDDABLE_NODE_LABELS) {
      try {
        await graph.query(
          `CREATE VECTOR INDEX FOR (n:${label}) ON (n.${prop}) OPTIONS {dimension: ${dim}, similarityFunction: 'cosine'}`,
        );
      } catch {
        /* index may already exist */
      }
    }

    return { indexed, errors };
  }
}
