# syntax=docker/dockerfile:1
FROM docker.io/library/node:24.19.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json ./api/package.json
COPY web/package.json ./web/package.json
RUN npm ci --ignore-scripts
COPY api ./api
COPY web ./web
ARG VITE_DEMO_MODE=false
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE
RUN npm run build

FROM docker.io/library/node:24.19.0-alpine AS api
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json ./api/package.json
COPY web/package.json ./web/package.json
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build --chown=node:node /app/api/dist ./api/dist
COPY --chown=node:node api/scripts ./api/scripts
COPY --chown=node:node api/migrations ./api/migrations
USER node
WORKDIR /app/api
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM docker.io/nginxinc/nginx-unprivileged:1.28-alpine AS web
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 8080
