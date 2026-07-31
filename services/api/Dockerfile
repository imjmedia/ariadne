# syntax=docker/dockerfile:1.4
# Build desde la raíz del repo: docker build -f services/api/Dockerfile .
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

COPY --from=ariadne-common /packages/ariadne-common /packages/ariadne-common

COPY services/api/package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install

COPY services/api/tsconfig.json services/api/nest-cli.json ./
COPY services/api/src ./src
RUN npm run build && npm prune --omit=dev

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
