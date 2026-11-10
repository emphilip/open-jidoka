# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS deps
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/integrations/package.json packages/integrations/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/admin/package.json apps/admin/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY packages packages
COPY examples examples
COPY apps apps

FROM deps AS api
ENV NODE_ENV=production
WORKDIR /app/apps/api
USER node
EXPOSE 3000
CMD ["node_modules/.bin/tsx", "src/main.ts"]

FROM deps AS worker
ENV NODE_ENV=production
WORKDIR /app/apps/worker
USER node
CMD ["node_modules/.bin/tsx", "src/main.ts"]

FROM deps AS admin-build
RUN pnpm --filter @openjidoka/admin build

FROM nginx:1.29-alpine AS admin
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=admin-build /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 8080
