# syntax=docker/dockerfile:1.4
# Build desde la raíz del repo: docker build -f services/ingest/Dockerfile .
# CI: --build-arg ARIADNE_COMMON_IMAGE=ariadne-common:local (ver docker/deploy-build.sh)
FROM node:20-alpine AS ariadne-common-local
WORKDIR /packages/ariadne-common
COPY packages/ariadne-common/package.json packages/ariadne-common/tsconfig.json ./
COPY packages/ariadne-common/src ./src
RUN --mount=type=cache,target=/root/.npm \
    npm install && npm run build

ARG ARIADNE_COMMON_IMAGE
FROM ${ARIADNE_COMMON_IMAGE:-ariadne-common-local} AS ariadne-common

FROM node:20-alpine

WORKDIR /app

# tree-sitter y tree-sitter-* requieren compilación nativa; git para shallow clone (sync)
# Archify (MIT): pin de versión + comprobación de LICENSE en build (ver NOTICE).
ARG ARCHIFY_VERSION=v2.9.0
# v2.9+ ships CLI under archify/ subfolder; normalize to /opt/archify + npm deps (ajv).
RUN apk add --no-cache python3 make g++ git \
  && git clone --depth 1 --branch "${ARCHIFY_VERSION}" \
    https://github.com/tt-a1i/archify.git /tmp/archify-src \
  && mv /tmp/archify-src/archify /opt/archify \
  && rm -rf /tmp/archify-src \
  && cd /opt/archify && npm install --omit=dev \
  && test -f /opt/archify/LICENSE \
  && test -f /opt/archify/bin/archify.mjs

COPY --from=ariadne-common /packages/ariadne-common /packages/ariadne-common

COPY services/ingest/package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install

COPY services/ingest/tsconfig.json services/ingest/nest-cli.json ./
COPY services/ingest/src ./src
RUN npm run build && npm prune --omit=dev

ENV PORT=3002
ENV NODE_ENV=production

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

EXPOSE 3002
CMD ["node", "dist/main.js"]
