# syntax=docker/dockerfile:1.4
FROM node:20-alpine

WORKDIR /app

COPY packages/ariadne-common/package.json packages/ariadne-common/tsconfig.json /packages/ariadne-common/
COPY packages/ariadne-common/src /packages/ariadne-common/src
RUN --mount=type=cache,target=/root/.npm \
    cd /packages/ariadne-common && npm install && npm run build

COPY services/orchestrator/package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install

COPY services/orchestrator/tsconfig.json services/orchestrator/nest-cli.json ./
COPY services/orchestrator/src ./src
RUN npm run build && npm prune --omit=dev

ENV PORT=3001
ENV NODE_ENV=production
ENV FALKORSPEC_API_URL=http://api:3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

EXPOSE 3001
CMD ["node", "dist/main.js"]
