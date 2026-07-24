# syntax=docker/dockerfile:1.4
# Build desde la raíz del repo: docker build -f services/api/Dockerfile .
FROM node:20-alpine

WORKDIR /app

COPY packages/ariadne-common/package.json packages/ariadne-common/tsconfig.json /packages/ariadne-common/
COPY packages/ariadne-common/src /packages/ariadne-common/src
RUN --mount=type=cache,target=/root/.npm \
    cd /packages/ariadne-common && npm install && npm run build

COPY services/api/package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install

COPY services/api/tsconfig.json services/api/nest-cli.json ./
COPY services/api/src ./src
RUN npm run build && npm prune --omit=dev

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
