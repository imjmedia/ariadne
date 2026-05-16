/**
 * @fileoverview Punto de entrada del **Orchestrator** (NestJS + LangGraph, puerto por defecto 3001).
 *
 * Coordina flujos de agentes, estado en Redis y módulos de chat/legacy documentados en el monorepo.
 * No contiene la ingesta de repositorios; consume APIs y grafos ya materializados por ingest/API.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 * @author Jorge Correa <jcorrea@e-personal.net>
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import { createLogger, extractRequestId } from 'ariadne-common';
import { register, collectDefaultMetrics } from 'prom-client';

// Activar métricas por defecto (CPU, memoria, etc.)
collectDefaultMetrics();

const logger = createLogger('orchestrator');

/** Inicia el servidor del Orchestrator. */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Correlation ID middleware (antes que cualquier middleware NestJS)
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const requestId = extractRequestId(req.headers);
    res.locals.requestId = requestId;
    next();
  });
  // Healthcheck endpoint
  app.use('/health', (_req: express.Request, res: express.Response) => {
    res.json({ status: 'ok', service: 'orchestrator' });
  });
  // Métricas Prometheus
  app.use('/metrics', async (_req: express.Request, res: express.Response) => {
    try {
      const metrics = await register.metrics();
      res.set('Content-Type', register.contentType);
      res.end(metrics);
    } catch (err) {
      res.status(500).end(String(err));
    }
  });
  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port);
  logger.info(`Orchestrator (NestJS + LangGraph) listening on port ${port}`);
}
bootstrap().catch((err) => {
  logger.error(err);
  process.exit(1);
});
