/**
 * @fileoverview Punto de entrada del **API AriadneSpecs** (NestJS, puerto por defecto 3000).
 *
 * Expone prefijo global `/api`, middleware OTP (`AuthService`), RBAC y un proxy HTTP
 * hacia **ingest** para rutas de proyectos, dominios, repositorios, credenciales, proveedores y webhooks.
 * El grafo Falkor y OpenAPI viven aquí; la mutación de metadatos de repos suele delegarse en ingest.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 * @author Jorge Correa <jcorrea@e-personal.net>
 */
import { NestFactory } from '@nestjs/core';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { register, collectDefaultMetrics } from 'prom-client';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { createOtpAuthMiddleware } from './auth/otp.middleware';
import { createRbacMiddleware } from './auth/rbac.middleware';
import { createLogger, extractRequestId } from 'ariadne-common';

/** Inicia el servidor, configura CORS, prefijo /api, auth OTP, RBAC y proxy a ingest. */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // CORS debe registrarse **antes** del middleware OTP: el preflight OPTIONS no lleva Bearer;
  // si OTP corre primero responde 401 sin cabeceras CORS y el navegador bloquea (Failed to fetch).
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true,
    credentials: true,
  });

  const authService = app.get(AuthService);

  // Correlation ID middleware (must run BEFORE OTP so all logs carry requestId)
  const logger = createLogger('api');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = extractRequestId(req.headers);
    (req as any).requestId = requestId;
    res.locals.requestId = requestId;
    logger.info({ requestId, method: req.method, url: req.originalUrl ?? req.url }, 'incoming request');
    next();
  });

  collectDefaultMetrics();

  app.use(createOtpAuthMiddleware(authService));
  // RBAC después de auth: bloquea operaciones no permitidas según rol
  app.use(createRbacMiddleware());

  // Proxy /api/projects, /api/repositories, /api/credentials, /api/webhooks al ingest (quita /api al reenviar)
  const ingestUrl = process.env.INGEST_URL ?? 'http://localhost:3002';
  const ingestProxy = createProxyMiddleware({
    pathFilter: (pathname) =>
      pathname.startsWith('/api/projects') ||
      pathname.startsWith('/api/domains') ||
      pathname.startsWith('/api/repositories') ||
      pathname.startsWith('/api/credentials') ||
      pathname.startsWith('/api/providers') ||
      pathname.startsWith('/api/webhooks') ||
      pathname.startsWith('/api/users') ||
      pathname.startsWith('/api/internal'),
    target: ingestUrl,
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
    on: {
      proxyReq: (proxyReq, req, res) => {
        const response = res as Response;
        const requestId = response.locals.requestId || extractRequestId(req.headers);
        if (requestId) proxyReq.setHeader('X-Request-Id', requestId);
        const user = (req as import('express').Request & { user?: { userId?: string; role?: string } })
          .user;
        if (user?.userId) proxyReq.setHeader('X-User-Id', user.userId);
        if (user?.role) proxyReq.setHeader('X-User-Role', user.role);
      },
    },
  });
  app.use(ingestProxy);

  // Endpoint Prometheus /metrics
  app.use('/metrics', async (_req: Request, res: Response) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
  logger.info({ port }, 'AriadneSpecs API (NestJS + OpenAPI 3.1) listening');
}

bootstrap().catch((err) => {
  const logger = createLogger('api');
  logger.error(err, 'Failed to bootstrap API');
  process.exit(1);
});
