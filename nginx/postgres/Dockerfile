# syntax=docker/dockerfile:1.7
# PostgreSQL 18 + WAL-G for jobvacancy.uz (TZ OPS-03). Build context: nginx/postgres/.
# The same image runs the database (postgres service) and the backup scheduler (pg-backup).
ARG PG_IMAGE=postgres:18.6-trixie@sha256:86c951e05bf56c93d95d397747fb8820ac76cc3bedb78f43abd83eedbe3666ae
FROM ${PG_IMAGE}
ARG TARGETARCH
ARG WALG_VERSION=v3.0.9
# sha256 of wal-g-pg-24.04-<arch>.tar.gz from the GitHub release (glibc build; trixie is newer)
ARG WALG_SHA256_AMD64=444ce216230c254edef803e098a59a1746806da3e0d55671d7b0f0082db14ef4
ARG WALG_SHA256_ARM64=cb37c5f8391bd8ef2efceeb9c6995059c0abf2fa74b9b717b42a16a7c93cfde1
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl jq; \
    rm -rf /var/lib/apt/lists/*; \
    case "${TARGETARCH:-amd64}" in \
      amd64) arch=amd64; sum=$WALG_SHA256_AMD64 ;; \
      arm64) arch=aarch64; sum=$WALG_SHA256_ARM64 ;; \
      *) echo "unsupported arch $TARGETARCH"; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/walg.tgz "https://github.com/wal-g/wal-g/releases/download/${WALG_VERSION}/wal-g-pg-24.04-${arch}.tar.gz"; \
    echo "${sum}  /tmp/walg.tgz" | sha256sum -c -; \
    tar -xzf /tmp/walg.tgz -C /tmp; \
    install -m 0755 "/tmp/wal-g-pg-24.04-${arch}" /usr/local/bin/wal-g; \
    rm -f /tmp/walg.tgz "/tmp/wal-g-pg-24.04-${arch}"; \
    wal-g --version
COPY postgresql.conf /etc/postgresql/postgresql.conf
COPY initdb/ /docker-entrypoint-initdb.d/
COPY bin/ /usr/local/bin/
CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]
