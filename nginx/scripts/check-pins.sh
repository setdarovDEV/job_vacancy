#!/usr/bin/env bash
# Supply-chain pins (TZ SEC-08): fails when something we run is referenced by a moving name.
#   * third-party images in compose files and Dockerfiles: tag@sha256:<digest>
#   * GitHub Actions: a full 40-character commit SHA (the tag goes in a comment)
#   * `docker run` in workflows: no :latest
# Our own images (${IMAGE_PREFIX...}, jobvacancy-*:e2e) are built from this repository.
# Dependabot (.github/dependabot.yml) proposes the digest and SHA bumps.
#   nginx/scripts/check-pins.sh        # make check-pins; CI: security.yml
set -euo pipefail
cd "$(dirname "$0")/../.."
bad=0
fail() { printf '  %s\n' "$*" >&2; bad=1; }

# Compose files: every image: line.
while IFS= read -r line; do
  file=${line%%:*}
  rest=${line#*:}
  n=${rest%%:*}
  ref=$(printf '%s' "${rest#*:}" | sed -E 's/^[[:space:]]*image:[[:space:]]*//; s/[[:space:]]+#.*$//; s/^"//; s/"$//')
  # shellcheck disable=SC2016  # a literal ${IMAGE_PREFIX...}: our own images, built here
  case $ref in
    '${IMAGE_PREFIX'* | '${E2E_'* | jobvacancy-*) continue ;;
    *@sha256:[0-9a-f]*) continue ;;
  esac
  fail "$file:$n image not pinned by digest: $ref"
done < <(grep -nE '^[[:space:]]+image:' nginx/docker-compose*.yml monitoring/docker-compose*.yml e2e/docker-compose*.yml 2>/dev/null || true)

# Dockerfiles: FROM an external image (not a build stage or an ARG) and ARG *_IMAGE defaults.
while IFS= read -r df; do
  stages=$({ grep -oiE '^FROM .* AS [a-z0-9_-]+' "$df" || true; } | awk '{print tolower($NF)}' | tr '\n' ' ')
  while IFS= read -r line; do
    n=${line%%:*}
    ref=$(printf '%s' "${line#*:}" | sed -E 's/^FROM[[:space:]]+(--platform=[^[:space:]]+[[:space:]]+)?//I; s/[[:space:]].*$//')
    case $ref in
      '$'*) continue ;;                                           # FROM ${ARG}: checked below
      *@sha256:[0-9a-f]*) continue ;;
    esac
    [[ " $stages " == *" ${ref,,} "* ]] && continue               # FROM <earlier stage>
    fail "$df:$n FROM not pinned by digest: $ref"
  done < <(grep -niE '^FROM ' "$df")
  while IFS= read -r line; do
    n=${line%%:*}
    ref=${line#*=}
    [[ $ref == *@sha256:* ]] || fail "$df:$n base image ARG not pinned by digest: ${line#*:}"
  done < <(grep -nE '^ARG [A-Z_]*IMAGE=' "$df")
done < <(git ls-files '*Dockerfile' 'Dockerfile*' | grep -v node_modules)

# GitHub Actions: uses: owner/repo@<40 hex>.
while IFS= read -r line; do
  file=${line%%:*}
  rest=${line#*:}
  n=${rest%%:*}
  ref=$(printf '%s' "${rest#*:}" | sed -E 's/^[[:space:]-]*uses:[[:space:]]*//; s/[[:space:]]+#.*$//')
  case $ref in
    ./*) continue ;;
    *@[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]) continue ;;
  esac
  fail "$file:$n action not pinned to a commit SHA: $ref"
done < <(grep -nE '^[[:space:]-]*uses:' .github/workflows/*.yml)

# docker run in workflows: never :latest.
if grep -nE 'docker run[^#]*:latest' .github/workflows/*.yml >&2; then
  fail "workflow runs a :latest image (see above)"
fi

if [ "$bad" = 1 ]; then
  echo "pin check failed: pin by digest / commit SHA (Dependabot keeps them fresh)" >&2
  exit 1
fi
echo "pins OK: compose images, Dockerfile bases and GitHub Actions are pinned"
