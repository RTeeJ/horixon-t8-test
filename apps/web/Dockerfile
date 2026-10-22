# Build context is the repository root: docker compose builds with `context: .`.
FROM node:24-alpine AS build
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
# "true" shows the demo-account buttons on the login page; leave unset for a real deployment.
ARG VITE_DEMO_LOGIN=
ENV VITE_DEMO_LOGIN=$VITE_DEMO_LOGIN
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/domain/package.json packages/domain/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY packages/domain packages/domain
COPY apps/web apps/web
RUN npm run build -w @coffee/domain && npm run build -w @coffee/web

# The official nginx image built to run as an unprivileged user (uid 101).
FROM nginxinc/nginx-unprivileged:alpine
ARG VITE_API_URL=http://localhost:3000
# Allowed in the page's CSP connect-src; defaults to the API URL the app was built with, overridable at run time.
ENV API_ORIGIN=$VITE_API_URL
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 5173
