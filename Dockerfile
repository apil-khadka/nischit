FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
RUN corepack enable
WORKDIR /workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/domain/package.json packages/domain/package.json
COPY packages/chains/package.json packages/chains/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
RUN pnpm install --frozen-lockfile
COPY . .

FROM base AS build
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @nischit/domain build
RUN pnpm --filter @nischit/chains build
RUN pnpm --filter @nischit/storage build
RUN pnpm --filter @nischit/api build
RUN pnpm --filter @nischit/worker build
RUN pnpm --filter @nischit/web build

FROM node:22-alpine AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /workspace/packages/domain/node_modules ./packages/domain/node_modules
COPY --from=build /workspace/packages/chains/node_modules ./packages/chains/node_modules
COPY --from=build /workspace/packages/storage/node_modules ./packages/storage/node_modules
COPY --from=build /workspace/packages/domain/dist ./packages/domain/dist
COPY --from=build /workspace/packages/chains/dist ./packages/chains/dist
COPY --from=build /workspace/packages/chains/package.json ./packages/chains/package.json
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/packages/domain/package.json ./packages/domain/package.json
COPY --from=build /workspace/packages/storage/dist ./packages/storage/dist
COPY --from=build /workspace/packages/storage/package.json ./packages/storage/package.json
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]

FROM node:22-alpine AS web
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /workspace/apps/web/.next/standalone ./
COPY --from=build /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /workspace/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

FROM node:22-alpine AS worker
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build /workspace/apps/worker/dist ./apps/worker/dist
COPY --from=build /workspace/apps/worker/package.json ./apps/worker/package.json
USER node
CMD ["node", "apps/worker/dist/main.js"]

FROM postgres:17-alpine AS migrate
COPY db/migrations /migrations
CMD ["sh", "-c", "for migration in /migrations/*.sql; do psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1 -f \"$migration\"; done"]
