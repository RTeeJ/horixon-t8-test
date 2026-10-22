# Build context is the repository root: docker compose builds with `context: .`.
FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/domain/package.json packages/domain/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY packages/domain packages/domain
COPY apps/api apps/api
# The API imports @coffee/domain from its built output, so build it first.
RUN npm run build -w @coffee/domain && npm run build -w @coffee/api

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev -w @coffee/api -w @coffee/domain
COPY --from=build /repo/packages/domain/dist packages/domain/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
WORKDIR /repo/apps/api
# The node image's unprivileged user; the app only reads its files.
USER node
EXPOSE 3000
# Apply migrations (schema + seed data), add demo orders when SEED_DEMO=true (dev only), then start the server.
CMD ["sh", "-c", "npm run migration:run && if [ \"$SEED_DEMO\" = true ]; then npm run seed:demo; fi && node dist/main.js"]
