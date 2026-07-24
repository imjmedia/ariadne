# syntax=docker/dockerfile:1.4
# Build from repo root:
#   docker build -f services/mcp-docs/Dockerfile .

FROM node:20-alpine AS builder
WORKDIR /app
COPY services/mcp-docs/package.json services/mcp-docs/tsconfig.json ./
COPY services/mcp-docs/src ./src
RUN --mount=type=cache,target=/root/.npm \
    npm install --ignore-scripts && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY docs_mcp /docs_mcp

ENV NODE_ENV=production
ENV PORT=8081
ENV DOCS_MCP_DIR=/docs_mcp

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8081/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

EXPOSE 8081
USER node
CMD ["node", "dist/index.js", "--http"]
