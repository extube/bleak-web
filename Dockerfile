# bleak-web container image.
#
# Build: docker build -t bleak-web .
# Run:   docker compose up -d        (serves the SPA on host port 3000)
#
# Multi-stage build:
#   1. node:22-alpine — installs the npm workspace and builds the SvelteKit
#      SPA (adapter-static output in apps/web/build).
#   2. nginx:alpine — serves the static site, SPA-fallbacks every route to
#      index.html, and reverse-proxies /api to bleak-node so the SPA's
#      same-origin relative /api contract (Concept §5) works without CORS.

FROM node:22-alpine AS build
WORKDIR /app

# Install the exact workspace graph first (cacheable layer). Whole
# workspace directories are copied so the image matches whatever the
# workspaces currently are (e.g. apps/helper disappears with tz14 —
# nothing in this file hardcodes it).
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/ packages/
COPY apps/ apps/
RUN npm ci

# Root build script: typechecks and builds every workspace
# (@bleak/api-client, @bleak/web, and any other current workspace).
RUN npm run build

FROM nginx:1.27-alpine

# nginx official image: *.template files in /etc/nginx/templates are
# rendered with envsubst at startup (only *defined* env vars are
# substituted, so $host/$uri stay intact).
COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/build /usr/share/nginx/html

EXPOSE 80
