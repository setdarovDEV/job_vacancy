# syntax=docker/dockerfile:1.7
# nginx for jobvacancy.uz (TZ OPS-02): the official image plus Google's brotli module, built
# against the very same nginx version (dynamic modules must match it byte for byte), with the
# config from this directory baked in. Build context: nginx/.
#
#   docker build -t jobvacancy-nginx nginx/
#
# Bumping nginx: change NGINX_IMAGE (tag + digest) and NGINX_SHA256 (sha256 of
# nginx-<version>.tar.gz from nginx.org) together.
ARG NGINX_IMAGE=nginx:1.30.5-alpine@sha256:bf3201ab56f23e5954646379c775d511fc466e9f11376d9725361064ad07ed35

FROM ${NGINX_IMAGE} AS brotli
ARG NGINX_SHA256=6c20565aa2325cb82216ae804f4a4ff1875179014759a381c42ddc8e11c4906d
ARG NGX_BROTLI_COMMIT=a71f9312c2deb28875acc7bacfdd5695a111aa53
RUN set -eux; \
    apk add --no-cache --virtual .build-deps gcc libc-dev make pcre2-dev zlib-dev openssl-dev \
      linux-headers cmake git curl; \
    mkdir -p /build; cd /build; \
    curl -fsSL -o nginx.tar.gz "https://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz"; \
    echo "${NGINX_SHA256}  nginx.tar.gz" | sha256sum -c -; \
    tar -xzf nginx.tar.gz; \
    git clone --quiet https://github.com/google/ngx_brotli; \
    cd ngx_brotli; git checkout --quiet "${NGX_BROTLI_COMMIT}"; git submodule update --init --depth 1 --quiet; \
    mkdir deps/brotli/out; cd deps/brotli/out; \
    cmake -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
      -DCMAKE_C_FLAGS="-O2 -fPIC" -DCMAKE_INSTALL_PREFIX=./installed ..; \
    cmake --build . --config Release --target brotlienc -j"$(nproc)"; \
    cd "/build/nginx-${NGINX_VERSION}"; \
    ./configure --with-compat --add-dynamic-module=/build/ngx_brotli; \
    make modules -j"$(nproc)"; \
    mkdir -p /out; cp objs/ngx_http_brotli_filter_module.so objs/ngx_http_brotli_static_module.so /out/

FROM ${NGINX_IMAGE}
ARG VERSION=dev
ARG COMMIT=unknown
LABEL org.opencontainers.image.title="jobvacancy-nginx" \
      org.opencontainers.image.source="https://github.com/setdarovDEV/job_vacancy" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${COMMIT}"
# openssl: self-signed placeholder until Let's Encrypt; curl: Cloudflare range updates.
RUN apk add --no-cache openssl curl \
 && rm -f /etc/nginx/conf.d/default.conf \
 && mkdir -p /etc/nginx/tls /etc/nginx/runtime /var/www/certbot /var/cache/nginx/ssr /var/cache/nginx/static
COPY --from=brotli /out/ /usr/lib/nginx/modules/
COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d/ /etc/nginx/conf.d/
COPY snippets/ /etc/nginx/snippets/
COPY html/ /usr/share/nginx/html/jv/
COPY bin/ /usr/local/bin/
COPY entrypoint.d/ /docker-entrypoint.d/
EXPOSE 80 443 443/udp
STOPSIGNAL SIGQUIT
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -fsS -o /dev/null http://127.0.0.1:8082/healthz || exit 1
