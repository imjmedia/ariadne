# syntax=docker/dockerfile:1.4
# Build desde la raíz del repo: docker build -f services/ingest/Dockerfile .
# CI: --build-arg ARIADNE_COMMON_IMAGE=ghcr.io/kreodevs/ariadne-common:<sha>
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
RUN apk add --no-cache python3 make g++ git

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
