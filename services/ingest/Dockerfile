# Build desde la raíz del repo: docker build -f services/ingest/Dockerfile .
FROM node:20-alpine

WORKDIR /app

# tree-sitter y tree-sitter-* requieren compilación nativa; git para shallow clone (sync)
RUN apk add --no-cache python3 make g++ git

# ariadne-common: dependencia local file:../../packages/ariadne-common (debe existir en /packages/ariadne-common)
COPY packages/ariadne-common/package.json packages/ariadne-common/tsconfig.json /packages/ariadne-common/
COPY packages/ariadne-common/src /packages/ariadne-common/src
RUN cd /packages/ariadne-common && npm install && npm run build

COPY services/ingest/package.json ./
RUN npm install

COPY services/ingest/tsconfig.json services/ingest/nest-cli.json ./
COPY services/ingest/src ./src
RUN npm run build && npm prune --omit=dev

ENV PORT=3002
ENV NODE_ENV=production

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

EXPOSE 3002
CMD ["node", "dist/main.js"]
