# syntax=docker/dockerfile:1.4
# Build — contexto: repo root (solo paths copiados abajo; no COPY . .)
FROM node:20-alpine AS ariadne-common
WORKDIR /packages/ariadne-common
COPY packages/ariadne-common/package.json packages/ariadne-common/tsconfig.json ./
COPY packages/ariadne-common/src ./src
RUN --mount=type=cache,target=/root/.npm \
    npm install && npm run build

# Tarball MCP estático (dist/mcp/) — capa aparte del bundle Vite
FROM node:20-alpine AS mcp-tarball
WORKDIR /app
COPY --from=ariadne-common /packages/ariadne-common /packages/ariadne-common
COPY services/mcp-ariadne/package.json services/mcp-ariadne/tsconfig.json ./
COPY services/mcp-ariadne/src ./src
RUN --mount=type=cache,target=/root/.npm \
    npm install --ignore-scripts && npm run build && \
    npm pack && mkdir -p /out && mv ariadne-mcp-*.tgz /out/ariadne-mcp.tgz

FROM node:20-alpine AS frontend-build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# Ayuda in-app (prebuild → copy-docs; SKILLS.md en raíz, no .cursor/ que no va al repo)
COPY docs ./docs
COPY SKILLS.md ./SKILLS.md

WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY frontend/ ./

ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm run build

COPY --from=mcp-tarball /out/ariadne-mcp.tgz /tmp/ariadne-mcp.tgz
RUN mkdir -p dist/mcp && cp /tmp/ariadne-mcp.tgz dist/mcp/ariadne-mcp.tgz

FROM nginx:alpine
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
