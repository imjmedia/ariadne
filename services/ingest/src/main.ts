/**
 * @fileoverview Punto de entrada del microservicio **Ingest** (NestJS, puerto por defecto 3002).
 *
 * Responsabilidades en arranque: ejecutar migraciones TypeORM opcionales (`INGEST_SKIP_MIGRATIONS`),
 * aplicar `FALKOR_FLUSH_ALL_ONCE` si está configurado, backfill de `repoId` en Falkor cuando no hay
 * sharding por proyecto, y crear la app Nest con `rawBody` para verificación de webhooks.
 *
 * @see Archivo `LICENSE` en la raíz del monorepo (Apache-2.0).
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 * @author Jorge Correa <jcorrea@e-personal.net>
 */
import { DataSource } from 'typeorm';
import { NestFactory } from '@nestjs/core';
import { FalkorDB } from 'falkordb';
import { AppModule } from './app.module';
import { SystemSettingsService } from './system-settings/system-settings.service';
import { getFalkorConfig, GRAPH_NAME, isProjectShardingEnabled } from './pipeline/falkor';
import { runFalkorRepoIdBackfill } from './pipeline/producer';
import * as express from 'express';
import { createLogger, extractRequestId } from 'ariadne-common';
import client from 'prom-client';

const logger = createLogger('ingest');

/** Collect default Prometheus metrics. */
client.collectDefaultMetrics();

/** Clave en `ingest_runtime_flags`: evita repetir FLUSHALL en reinicios si el env sigue puesto. */
const FALKOR_FLUSH_FLAG_KEY = 'falkor_flushall_once';

function isTruthyEnv(v: string | undefined): boolean {
  if (!v?.trim()) return false;
  const s = v.trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

/**
 * Si `FALKOR_FLUSH_ALL_ONCE` está activo y la flag no está en Postgres: ejecuta FLUSHALL en FalkorDB
 * y registra la flag. Así el próximo deploy puede llevar el env una vez sin borrar el grafo en cada reinicio.
 */
async function runFalkorFlushAllOnceIfRequested(): Promise<void> {
  if (!isTruthyEnv(process.env.FALKOR_FLUSH_ALL_ONCE)) return;

  const pgDs = new DataSource({
    type: 'postgres',
    host: process.env.PGHOST ?? 'localhost',
    port: parseInt(process.env.PGPORT ?? '5432', 10),
    username: process.env.PGUSER ?? 'falkorspecs',
    password: process.env.PGPASSWORD ?? 'falkorspecs',
    database: process.env.PGDATABASE ?? 'falkorspecs',
  });
  await pgDs.initialize();
  try {
    const existing = await pgDs.query(
      `SELECT 1 AS x FROM ingest_runtime_flags WHERE flag_key = $1 LIMIT 1`,
      [FALKOR_FLUSH_FLAG_KEY],
    );
    if (Array.isArray(existing) && existing.length > 0) {
      logger.info(`FALKOR_FLUSH_ALL_ONCE omitido: ya aplicado (flag ${FALKOR_FLUSH_FLAG_KEY}). Quita el env si no lo necesitas.`);
      return;
    }
  } finally {
    await pgDs.destroy();
  }

  const config = getFalkorConfig();
  let falkor: Awaited<ReturnType<typeof FalkorDB.connect>> | null = null;
  try {
    falkor = await FalkorDB.connect({ socket: { host: config.host, port: config.port } });
    const redis = await falkor.connection;
    const flush = (redis as { flushAll?: () => Promise<unknown> }).flushAll;
    if (typeof flush !== 'function') {
      throw new Error('Cliente Redis sin método flushAll');
    }
    await flush.call(redis);
    logger.warn('FalkorDB: FLUSHALL ejecutado (FALKOR_FLUSH_ALL_ONCE). Re-sincroniza los repos.');
  } catch (err) {
    logger.error({ err }, 'FALKOR_FLUSH_ALL_ONCE falló');
    throw err;
  } finally {
    if (falkor) await falkor.close();
  }

  const pgInsert = new DataSource({
    type: 'postgres',
    host: process.env.PGHOST ?? 'localhost',
    port: parseInt(process.env.PGPORT ?? '5432', 10),
    username: process.env.PGUSER ?? 'falkorspecs',
    password: process.env.PGPASSWORD ?? 'falkorspecs',
    database: process.env.PGDATABASE ?? 'falkorspecs',
  });
  await pgInsert.initialize();
  try {
    await pgInsert.query(`INSERT INTO ingest_runtime_flags (flag_key) VALUES ($1)`, [FALKOR_FLUSH_FLAG_KEY]);
  } finally {
    await pgInsert.destroy();
  }
}

/**
 * Ejecuta migraciones TypeORM pendientes antes de arrancar (necesario en prod con synchronize=false).
 * Se llama en **cada** bootstrap: al desplegar una imagen nueva con `.js` en `dist/migrations/`, Postgres queda al día sin paso manual.
 * Desactivar solo en emergencia: `INGEST_SKIP_MIGRATIONS=1` (riesgo de esquema desalineado).
 */
async function runMigrations(): Promise<void> {
  if (isTruthyEnv(process.env.INGEST_SKIP_MIGRATIONS)) {
    logger.warn('INGEST_SKIP_MIGRATIONS activo: no se ejecutan migraciones al arrancar.');
    return;
  }
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.PGHOST ?? 'localhost',
    port: parseInt(process.env.PGPORT ?? '5432', 10),
    username: process.env.PGUSER ?? 'falkorspecs',
    password: process.env.PGPASSWORD ?? 'falkorspecs',
    database: process.env.PGDATABASE ?? 'falkorspecs',
    migrations: [__dirname + '/migrations/*.js'],
    migrationsRun: false,
  });
  await ds.initialize();
  try {
    const executed = await ds.runMigrations();
    if (executed.length > 0) {
      logger.info(`Migraciones ejecutadas: ${executed.map((m) => m.name).join(', ')}`);
    } else {
      logger.info('Migraciones PostgreSQL: ninguna pendiente (tabla migrations al día).');
    }
  } finally {
    await ds.destroy();
  }
}

/**
 * Backfill repoId en el grafo Falkor (nodos antiguos sin repoId). Idempotente.
 * Si Falkor no está disponible, solo se registra y se sigue (no bloquea arranque).
 */
async function runFalkorRepoIdMigration(): Promise<void> {
  if (isProjectShardingEnabled()) {
    logger.warn('Falkor repoId backfill omitido: FALKOR_SHARD_BY_PROJECT activo (migrar por shard si aplica).');
    return;
  }
  const config = getFalkorConfig();
  let falkorClient: Awaited<ReturnType<typeof FalkorDB.connect>> | null = null;
  try {
    falkorClient = await FalkorDB.connect({ socket: { host: config.host, port: config.port } });
    const graph = falkorClient.selectGraph(GRAPH_NAME);
    const graphClient = { query: (cypher: string) => graph.query(cypher) };
    await runFalkorRepoIdBackfill(graphClient);
  } catch (err) {
    logger.warn({ err }, 'Falkor repoId backfill omitido (Falkor no disponible o error)');
  } finally {
    if (falkorClient) await falkorClient.close();
  }
}

/** Arranca NestJS con body parser (rawBody para webhooks), CORS, healthcheck, metrics y correlation ID. */
async function bootstrap() {
  logger.info('Starting bootstrap (23b6f50)');
  await runMigrations();
  await runFalkorFlushAllOnceIfRequested();
  await runFalkorRepoIdMigration();
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    abortOnError: false,
  });

  // Correlation ID middleware (runs BEFORE body parser so all logs carry requestId)
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const requestId = extractRequestId(req.headers);
    (req as any).requestId = requestId;
    res.locals.requestId = requestId;
    logger.info({ requestId, method: req.method, url: req.originalUrl ?? req.url }, 'incoming request');
    next();
  });

  const bodyLimit = process.env.BODY_LIMIT ?? '10mb';
  app.use(
    express.json({
      limit: bodyLimit,
      verify: (req: express.Request & { rawBody?: Buffer }, _res: express.Response, buf: Buffer) => {
        req.rawBody = buf;
      },
    }),
  );
  const corsOrigin =
    (await app.get(SystemSettingsService).getEffective()).corsOrigin ?? process.env.CORS_ORIGIN;
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true,
    credentials: true,
  });
  // Healthcheck endpoint
  app.use('/health', (_req: express.Request, res: express.Response) => {
    res.json({ status: 'ok', service: 'ingest' });
  });
  // Prometheus /metrics endpoint
  app.use('/metrics', async (_req: express.Request, res: express.Response) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });
  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  logger.info({ port }, 'Ingest service (NestJS) listening');
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'FATAL bootstrap error');
  process.exit(1);
});
