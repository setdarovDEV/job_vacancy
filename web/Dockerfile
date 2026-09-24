# syntax=docker/dockerfile:1.7
# Web (React Router SSR) served by react-router-serve on Node 22, as a non-root user.
# Build context: web/ (needs ../backend/api/openapi.yaml only for `pnpm api:types`, which is
# checked in CI, not here).
#
#   docker build --build-arg VITE_GOOGLE_CLIENT_ID=... -t jobvacancy-web web/
#
# VITE_* values are compiled into the client bundle, so one image serves staging and
# production (canonical URLs point at production; staging is noindex).
ARG NODE_IMAGE=node:22.23.3-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
ARG PNPM_VERSION=10.33.0

FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN npm install -g "pnpm@${PNPM_VERSION}" --no-fund --no-audit --loglevel=error
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --store-dir /pnpm/store

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --prod --store-dir /pnpm/store

FROM deps AS build
ARG VITE_SITE_URL=https://jobvacancy.uz
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_TELEGRAM_BOT=jobvacancy_uz_bot
# Browser error reporting (OPS-05): https://<key>@<site>/errors/<project>; the release name
# ties events to the uploaded source maps.
ARG VITE_SENTRY_DSN=
ARG VERSION=dev
ENV NODE_ENV=production VITE_SITE_URL=${VITE_SITE_URL} VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID} VITE_TELEGRAM_BOT=${VITE_TELEGRAM_BOT} \
    VITE_SENTRY_DSN=${VITE_SENTRY_DSN} VITE_APP_VERSION=${VERSION}
COPY . .
RUN pnpm build
# Source maps (TZ OPS-05): if the build emitted them (vite build.sourcemap "hidden"), upload
# them to GlitchTip for this release and never ship them. The API token is a BuildKit secret
# (id=glitchtip_token, never in a layer); without it, or without GLITCHTIP_URL, the maps are
# only deleted. sentry-cli speaks GlitchTip's Sentry-compatible API.
ARG GLITCHTIP_URL=
ARG GLITCHTIP_ORG=jobvacancy
ARG GLITCHTIP_PROJECT=web
ARG SENTRY_CLI_VERSION=2.58.6
RUN --mount=type=secret,id=glitchtip_token,required=false \
    set -eu; \
    if ls build/client/assets/*.map >/dev/null 2>&1; then \
      if [ -s /run/secrets/glitchtip_token ] && [ -n "$GLITCHTIP_URL" ]; then \
        export SENTRY_AUTH_TOKEN="$(cat /run/secrets/glitchtip_token)" SENTRY_URL="$GLITCHTIP_URL" \
          SENTRY_ORG="$GLITCHTIP_ORG" SENTRY_PROJECT="$GLITCHTIP_PROJECT"; \
        npx --yes "@sentry/cli@${SENTRY_CLI_VERSION}" sourcemaps inject build/client/assets; \
        npx --yes "@sentry/cli@${SENTRY_CLI_VERSION}" sourcemaps upload --release "$VERSION" build/client/assets; \
      fi; \
      find build -name '*.map' -delete; \
    fi

FROM ${NODE_IMAGE}
ARG VERSION=dev
ARG COMMIT=unknown
LABEL org.opencontainers.image.title="jobvacancy-web" \
      org.opencontainers.image.source="https://github.com/setdarovDEV/job_vacancy" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${COMMIT}"
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 APP_VERSION=${VERSION}
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/build ./build
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "node_modules/@react-router/serve/bin.cjs", "./build/server/index.js"]
