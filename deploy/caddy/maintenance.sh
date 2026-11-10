#!/usr/bin/env bash
# Planned maintenance page for jobvacancy.uz:  maintenance.sh on | off | status
set -euo pipefail
FLAG=/srv/jobvacancy-maintenance/enabled
case "${1:-status}" in
  on) touch "$FLAG"; echo "maintenance ON (jobvacancy.uz answers 503 with the maintenance page)";;
  off) rm -f "$FLAG"; echo "maintenance OFF";;
  status) [ -f "$FLAG" ] && echo "maintenance ON" || echo "maintenance OFF";;
  *) echo "usage: $0 on|off|status" >&2; exit 2;;
esac
