# syntax=docker/dockerfile:1

FROM docker.io/node:24-alpine AS base

FROM base AS builder
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm clean-install --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build


FROM base AS production
WORKDIR /app

COPY --chown=node:node package.json package-lock.json .npmrc ./
RUN npm clean-install --omit=dev --ignore-scripts

COPY --chown=node:node locales ./locales
COPY --chown=node:node --from=builder /app/dist/ ./dist/

USER node
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "./dist/index.js"]