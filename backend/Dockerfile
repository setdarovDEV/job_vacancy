# syntax=docker/dockerfile:1.7
# One image, four binaries: api, worker, migrate, ctl (compose picks the command; the
# default is the API). Build context: backend/.
#
#   docker build --build-arg VERSION=v1.4.0 --build-arg COMMIT=$(git rev-parse HEAD) \
#     -t jobvacancy-backend backend/
#
# Base images are pinned by digest (TZ SEC-08); bump tag and digest together.
ARG GO_IMAGE=golang:1.27.1-alpine@sha256:8a5910f31396cd4d89662f56c68b3ae31d374308270a1c3bd96672ee5ed43414
ARG RUNTIME_IMAGE=gcr.io/distroless/static-debian12:nonroot@sha256:afa5c872c891853ca7fcf1f12c3edb23f7eeef36189728842dd51042ff57f7ab

FROM --platform=$BUILDPLATFORM ${GO_IMAGE} AS build
ARG TARGETOS
ARG TARGETARCH
ENV CGO_ENABLED=0 GOTOOLCHAIN=local
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
# Version and commit are stamped into internal/platform/buildinfo (build_info metric, startup
# log, /version). BUILD_DATE is RFC 3339.
ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_DATE=
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    set -eu; \
    pkg=jobvacancy.uz/backend/internal/platform/buildinfo; \
    ldflags="-s -w -X ${pkg}.Version=${VERSION} -X ${pkg}.Commit=${COMMIT} -X ${pkg}.Date=${BUILD_DATE}"; \
    for cmd in api worker migrate ctl; do \
      GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="$ldflags" -o /out/$cmd ./cmd/$cmd; \
    done

# distroless/static: CA certificates + tzdata, no shell, non-root. Migrations, e-mail
# templates and PDF fonts are embedded in the binaries.
FROM ${RUNTIME_IMAGE}
ARG VERSION=dev
ARG COMMIT=unknown
LABEL org.opencontainers.image.title="jobvacancy-backend" \
      org.opencontainers.image.source="https://github.com/setdarovDEV/job_vacancy" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${COMMIT}"
COPY --from=build /out/ /app/
USER nonroot:nonroot
EXPOSE 8090
# No shell or curl here: the binary checks itself (GET /readyz). The worker overrides this
# with "/app/worker healthcheck" in compose; migrate/ctl runs disable it.
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 CMD ["/app/api", "healthcheck"]
CMD ["/app/api"]
