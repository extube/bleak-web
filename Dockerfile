# bleak-web container image.
#
# Build: docker build -t bleak-web .
# Run:   docker compose up -d        (serves the SPA on host port 3000)
#
# Multi-stage build:
#   1. node:22-alpine — installs the npm workspace and builds the SvelteKit
#      SPA (adapter-static output in apps/web/build).
#   2. nginx:alpine — serves the static site with an SPA fallback for
#      every route. TLS and /api routing live on the host's nginx
#      (https -> http:3000 for the site, https -> http:8989 for the API).

FROM node:22-alpine AS build
WORKDIR /app

# svelte-check/vite need more than Node's default heap (Node sizes it by
# detected RAM — on small VPSes ~500 MB, which OOMs: exit 134).
ENV NODE_OPTIONS="--max-old-space-size=2048"

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
