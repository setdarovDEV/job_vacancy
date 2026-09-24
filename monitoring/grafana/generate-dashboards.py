#!/usr/bin/env python3
"""Generates the three provisioned Grafana dashboards (RED, USE, business) as JSON (TZ OPS-04).

The JSON in dashboards/ is generated: edit this file, then
    python3 monitoring/grafana/generate-dashboards.py
CI (deploy.yml, monitoring lint) fails when the committed JSON differs from the output.

Design rules (dataviz method): one y-axis per panel, 2px lines, light fill, legends for
>= 2 series (table with mean/max), single-series panels named by their title, categorical
colours by series *name* (palette-classic-by-name: colour follows the entity, never its
rank), status colours (good/warning/serious/critical) reserved for state: HTTP status
classes and thresholds only. Headline numbers are stat tiles, not charts.
"""
import json
import os
import sys

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "dashboards")
DS = {"type": "prometheus", "uid": "prometheus"}
GOOD, WARN, SERIOUS, CRIT = "#0ca30c", "#fab219", "#ec835a", "#d03b3b"
BLUE = "#2a78d6"
MUTED = "#8a8985"
# Categorical slots in the validated fixed order (dataviz reference palette, light steps):
# blue, orange, aqua, yellow, magenta, green, violet, red. Known entities get a fixed slot
# so a colour always means the same thing on every board.
SLOTS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"]
# Ordinal (p50 < p95 < p99): one hue, light to dark (blue ramp steps 300 / 450 / 600).
RAMP = ["#6da7ec", "#2a78d6", "#184f95"]


def slots(*names, colours=SLOTS):
    return [fixed(n, c) for n, c in zip(names, colours)]


def fixed(name, colour):
    return {"matcher": {"id": "byName", "options": name},
            "properties": [{"id": "color", "value": {"mode": "fixed", "fixedColor": colour}}]}


class Board:
    def __init__(self, uid, title, description, tags):
        self.uid, self.title, self.description, self.tags = uid, title, description, tags
        self.panels, self.y, self.next_id = [], 0, 1

    def _id(self):
        self.next_id += 1
        return self.next_id - 1

    def row(self, title):
        self.panels.append({"type": "row", "id": self._id(), "title": title, "collapsed": False,
                            "gridPos": {"h": 1, "w": 24, "x": 0, "y": self.y}, "panels": []})
        self.y += 1

    def add(self, panels, h):
        """Places panels side by side on one grid line; widths must sum to 24."""
        x = 0
        for p, w in panels:
            if p["title"] in RIGHT_LEGEND:
                p["options"]["legend"] = {"showLegend": True, "displayMode": "table", "placement": "right",
                                          "calcs": ["mean", "max"], "width": 460 if w >= 12 else 260}
            p["id"] = self._id()
            p["gridPos"] = {"h": h, "w": w, "x": x, "y": self.y}
            self.panels.append(p)
            x += w
        assert x == 24, (self.title, x)
        self.y += h

    def json(self):
        return {
            "uid": self.uid, "title": self.title, "description": self.description, "tags": self.tags,
            "editable": False, "graphTooltip": 1, "schemaVersion": 41, "version": 1,
            "time": {"from": "now-6h", "to": "now"}, "refresh": "30s", "timezone": "browser",
            "timepicker": {"refresh_intervals": ["15s", "30s", "1m", "5m", "15m"]},
            "templating": {"list": []},
            "annotations": {"list": [{
                "builtIn": 1, "datasource": {"type": "grafana", "uid": "-- Grafana --"}, "enable": True,
                "hide": True, "iconColor": "rgba(0, 211, 255, 1)", "name": "Annotations & Alerts", "type": "dashboard"}]},
            "links": [
                {"title": "RED", "type": "link", "url": "/d/jv-red", "icon": "dashboard"},
                {"title": "USE", "type": "link", "url": "/d/jv-use", "icon": "dashboard"},
                {"title": "Business", "type": "link", "url": "/d/jv-business", "icon": "dashboard"},
            ],
            "panels": self.panels,
        }


def target(expr, legend="", ref="A", instant=False):
    t = {"datasource": DS, "expr": expr, "refId": ref, "legendFormat": legend or "__auto", "range": not instant,
         "instant": instant}
    return t


def thresholds(*steps):
    """steps: (value or None, colour) ascending."""
    return {"mode": "absolute", "steps": [{"value": v, "color": c} for v, c in steps]}


def timeseries(title, targets, unit="short", desc="", legend="list", threshold=None, overrides=None,
               stack=False, fill=8, min0=True, decimals=None, by_name=True, max_=None):
    defaults = {
        "unit": unit,
        "color": {"mode": "palette-classic-by-name" if by_name else "palette-classic"},
        "custom": {
            "drawStyle": "line", "lineWidth": 2, "fillOpacity": fill, "gradientMode": "none",
            "showPoints": "auto", "pointSize": 6, "spanNulls": 60000, "lineInterpolation": "linear",
            "axisPlacement": "auto", "axisBorderShow": False, "axisSoftMin": 0 if min0 else None,
            "stacking": {"mode": "normal" if stack else "none", "group": "A"},
            "thresholdsStyle": {"mode": "dashed" if threshold is not None else "off"},
        },
        "thresholds": thresholds((None, "transparent"), (threshold, CRIT)) if threshold is not None
        else thresholds((None, GOOD)),
    }
    if decimals is not None:
        defaults["decimals"] = decimals
    if max_ is not None:
        defaults["max"] = max_
    return {
        "type": "timeseries", "title": title, "description": desc, "datasource": DS,
        "targets": targets,
        "fieldConfig": {"defaults": defaults, "overrides": overrides or []},
        "options": {
            # list: compact, bottom (few series). right: a table with mean/max/last beside the
            # plot for top-N panels, so ten series never squeeze the plot away.
            "legend": {"showLegend": bool(legend), "displayMode": "table" if legend == "right" else "list",
                       "placement": "right" if legend == "right" else "bottom",
                       "calcs": ["mean", "max", "lastNotNull"] if legend == "right" else [],
                       **({"width": 360} if legend == "right" else {})},
            "tooltip": {"mode": "multi", "sort": "desc"},
        },
    }


def stat(title, expr, unit="short", desc="", steps=None, decimals=None, mappings=None, text_mode="value",
         graph=True):
    fd = {"unit": unit, "color": {"mode": "thresholds"},
          "thresholds": thresholds(*(steps or [(None, BLUE)])), "mappings": mappings or []}
    if decimals is not None:
        fd["decimals"] = decimals
    return {
        "type": "stat", "title": title, "description": desc, "datasource": DS,
        "targets": [target(expr)],
        "fieldConfig": {"defaults": fd, "overrides": []},
        "options": {"reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                    "colorMode": "value", "graphMode": "area" if graph else "none", "justifyMode": "auto",
                    "textMode": text_mode, "orientation": "auto", "wideLayout": True, "showPercentChange": False},
    }


def table(title, expr, columns, desc="", unit_overrides=None):
    """Instant query rendered as a table; columns: {label: display name}."""
    return {
        "type": "table", "title": title, "description": desc, "datasource": DS,
        "targets": [dict(target(expr, instant=True), format="table")],
        "fieldConfig": {"defaults": {"custom": {"align": "auto", "cellOptions": {"type": "auto"}}},
                        "overrides": unit_overrides or []},
        "options": {"showHeader": True, "cellHeight": "sm", "footer": {"show": False},
                    "sortBy": [{"displayName": "Value", "desc": True}]},
        "transformations": [{"id": "organize", "options": {
            "excludeByName": {"Time": True, "__name__": True, "job": True, "target": True},
            "renameByName": columns}}],
    }



# Top-N and per-instance panels: a table legend beside the plot (never squeezes it).
RIGHT_LEGEND = {"Top routes by request rate", "5xx by route", "Slowest routes (p95)", "CPU by service",
                "Memory by service", "New rows per hour", "River jobs waiting / running", "Disk used",
                "Disk busy (I/O utilisation)"}

UP_MAP = [{"type": "value", "options": {"0": {"text": "DOWN", "color": CRIT}, "1": {"text": "UP", "color": GOOD}}}]
API = 'job="api", route!~"/healthz|/readyz"'
LAT = 'job="api", route!~"/healthz|/readyz|/api/v1/ws.*|.*/pdf"'

# ---- RED -------------------------------------------------------------------------------------
red = Board("jv-red", "jobvacancy · RED (API and site)",
            "Rate, errors, duration of the Go API and the site probes (TZ OPS-04). Alerts: ApiHigh5xxRate "
            "(> 1 %), ApiLatencyP95High (> 200 ms for 5 m).", ["jobvacancy", "red"])
red.row("Now")
red.add([
    (stat("Requests / s", "jv:api_requests:rate5m", "reqps", "API requests per second, 5 m average (probes excluded).",
          decimals=1), 4),
    (stat("5xx ratio", "sum(jv:api_errors_5xx:ratio_rate5m) or vector(0)", "percentunit",
          "Share of API responses with status 5xx over 5 m. Alert at 1 %.",
          steps=[(None, GOOD), (0.005, WARN), (0.01, CRIT)], decimals=2), 4),
    (stat("p95 latency", "jv:api_request_duration_seconds:p95_5m", "s",
          "95th percentile, 5 m, without WebSocket and PDF. Target < 50 ms; alert at 200 ms for 5 m.",
          steps=[(None, GOOD), (0.05, WARN), (0.2, CRIT)]), 4),
    (stat("p99 latency", "jv:api_request_duration_seconds:p99_5m", "s", "99th percentile, 5 m.",
          steps=[(None, GOOD), (0.25, WARN), (1, CRIT)]), 4),
    (stat("Site (origin)", 'min(probe_success{job="blackbox-origin"})', "none",
          "All origin probes (/, /vacancies, API) succeed through nginx.", steps=[(None, CRIT), (1, GOOD)],
          mappings=UP_MAP, graph=False), 4),
    (stat("API cache hit ratio", 'sum(rate(respcache_requests_total{result=~"hit|stale"}[5m])) / sum(rate(respcache_requests_total[5m]))',
          "percentunit", "Response cache (vacancy list/detail, suggest, company): hits + stale over all lookups.",
          steps=[(None, SERIOUS), (0.5, WARN), (0.8, GOOD)], decimals=1), 4),
], 4)
red.row("Rate and errors")
red.add([
    (timeseries("Requests by status class",
                [target(f'sum by (class) (label_replace(rate(http_requests_total{{{API}}}[$__rate_interval]), "class", "${{1}}xx", "status", "(.).."))', "{{class}}")],
                "reqps", "API responses per second by status class (1xx = WebSocket upgrades). Status colours: 2xx good, 4xx warning, 5xx critical.",
                overrides=[fixed("1xx", MUTED), fixed("2xx", GOOD), fixed("3xx", BLUE), fixed("4xx", WARN), fixed("5xx", CRIT)],
                stack=True, fill=20, by_name=False), 12),
    (timeseries("5xx ratio",
                [target("sum(jv:api_errors_5xx:ratio_rate2m) or vector(0)", "5xx ratio (2 m)")],
                "percentunit", "Alert ApiHigh5xxRate fires above the dashed 1 % line for 1 minute.",
                legend=None, threshold=0.01, overrides=[fixed("5xx ratio (2 m)", CRIT)], by_name=False), 12),
], 8)
red.add([
    (timeseries("Top routes by request rate",
                [target(f'topk(10, sum by (method, route) (rate(http_requests_total{{{API}}}[$__rate_interval])) > 0)', "{{method}} {{route}}")],
                "reqps", "Ten busiest API routes."), 12),
    (timeseries("5xx by route",
                [target(f'sum by (method, route, status) (rate(http_requests_total{{{API}, status=~"5.."}}[$__rate_interval])) > 0', "{{status}} {{method}} {{route}}")],
                "reqps", "Which routes fail. Empty is good."), 12),
], 8)
red.row("Duration")
red.add([
    (timeseries("API latency percentiles",
                [target("jv:api_request_duration_seconds:p50_5m", "p50", "A"),
                 target("jv:api_request_duration_seconds:p95_5m", "p95", "B"),
                 target("jv:api_request_duration_seconds:p99_5m", "p99", "C")],
                "s", "All routes except WebSocket and PDF. Dashed line: 200 ms p95 alert threshold.",
                threshold=0.2, fill=0, overrides=slots("p50", "p95", "p99", colours=RAMP), by_name=False), 12),
    (timeseries("Slowest routes (p95)",
                [target("topk(10, route:api_request_duration_seconds:p95_5m > 0)", "{{method}} {{route}}")],
                "s", "p95 per route over 5 m, ten slowest.", fill=0), 12),
], 8)
red.add([
    (timeseries("Requests per API instance",
                [target(f'sum by (instance) (rate(http_requests_total{{{API}}}[$__rate_interval]))', "{{instance}}")],
                "reqps", "nginx least_conn should keep the instances even; a flat line is a drained or dead instance."), 8),
    (timeseries("DB pool acquire wait p95",
                [target('histogram_quantile(0.95, sum by (le, pool, instance) (rate(db_pool_acquire_duration_seconds_bucket[$__rate_interval])))', "{{instance}} {{pool}}")],
                "s", "Time to get a Postgres connection. Growing = pool too small or slow queries (TZ BE-07: p95 < 1 ms).",
                fill=0), 8),
    (timeseries("Probe duration (origin)",
                [target('probe_duration_seconds{job="blackbox-origin"}', "{{instance}}")],
                "s", "Full request time through nginx from inside the server, per probed URL (TLS + SSR/API).",
                fill=0), 8),
], 8)
red.row("nginx")
red.add([
    (timeseries("nginx connections",
                [target('nginx_connections_active', "active", "A"), target('nginx_connections_waiting', "waiting (keep-alive)", "B")],
                "short", "Client connections: WebSockets stay active for hours, so this includes online chat users."), 12),
    (timeseries("nginx requests / s",
                [target('rate(nginx_http_requests_total[$__rate_interval])', "requests")],
                "reqps", "Everything nginx served (site, assets, media, API), including cache hits.", legend=None), 12),
], 7)

# ---- USE -------------------------------------------------------------------------------------
use = Board("jv-use", "jobvacancy · USE (hosts, containers, data stores)",
            "Utilisation, saturation, errors of hosts, containers, Postgres, Redis, River and backups (TZ OPS-04).",
            ["jobvacancy", "use"])
use.row("Hosts")
use.add([
    (timeseries("CPU utilisation", [target("instance:node_cpu_utilisation:ratio", "{{host}}")], "percentunit",
                "Busy share of all cores. TZ §3: < 70 % at 300 RPS; alert above 85 % for 15 m.", threshold=0.85, max_=1), 8),
    (timeseries("Load per core (saturation)",
                [target('node_load5 / on(instance) group_left count by (instance) (node_cpu_seconds_total{mode="idle"})', "{{host}}")],
                "short", "5-minute load average divided by cores. Above 1 means work is queueing for CPU.", threshold=1,
                decimals=2), 8),
    (timeseries("Memory utilisation", [target("instance:node_memory_utilisation:ratio", "{{host}}")], "percentunit",
                "1 − MemAvailable / MemTotal. Alert above 92 %.", threshold=0.92, max_=1), 8),
], 8)
use.add([
    (timeseries("Disk used", [target("instance:node_filesystem_used:ratio", "{{host}} {{mountpoint}}")], "percentunit",
                "Per filesystem. Alert above 80 % (warning) and 90 % (critical).", threshold=0.8, max_=1), 8),
    (timeseries("Disk busy (I/O utilisation)",
                [target('rate(node_disk_io_time_seconds_total{device!~"loop.*|ram.*"}[$__rate_interval])', "{{host}} {{device}}")],
                "percentunit", "Share of time the device had I/O in flight. Near 100 % = disk-bound.", max_=1), 8),
    (timeseries("Network",
                [target('sum by (host) (rate(node_network_receive_bytes_total{device!~"lo|veth.*|br-.*|docker.*"}[$__rate_interval]))', "{{host}} in", "A"),
                 target('sum by (host) (rate(node_network_transmit_bytes_total{device!~"lo|veth.*|br-.*|docker.*"}[$__rate_interval]))', "{{host}} out", "B")],
                "Bps", "Physical interfaces only."), 8),
], 8)
use.row("Containers")
use.add([
    (timeseries("CPU by service",
                [target("service:container_cpu_usage:rate2m", "{{container_label_com_docker_compose_service}}")],
                "percentunit", "Cores used by each compose service (1 = one full core).", fill=0), 12),
    (timeseries("Memory by service",
                [target("service:container_memory_working_set:bytes", "{{container_label_com_docker_compose_service}}")],
                "bytes", "Working set (what the OOM killer counts) per compose service. Limits: docker-compose.prod.yml.",
                fill=0), 12),
], 8)
use.row("Postgres")
use.add([
    (stat("Postgres", 'max(pg_up)', "none", "Exporter can reach Postgres.", steps=[(None, CRIT), (1, GOOD)],
          mappings=UP_MAP, graph=False), 4),
    (stat("Connections used", 'sum(pg_stat_activity_count) / max(pg_settings_max_connections)', "percentunit",
          "Open backends over max_connections (200). Alert above 80 %.", steps=[(None, GOOD), (0.6, WARN), (0.8, CRIT)]), 4),
    (stat("Cache hit ratio", 'sum(rate(pg_stat_database_blks_hit{datname="jobvacancy"}[5m])) / (sum(rate(pg_stat_database_blks_hit{datname="jobvacancy"}[5m])) + sum(rate(pg_stat_database_blks_read{datname="jobvacancy"}[5m])))',
          "percentunit", "Share of block reads served from shared_buffers. Below 99 % on a hot OLTP set: raise shared_buffers or fix a scan.",
          steps=[(None, SERIOUS), (0.95, WARN), (0.99, GOOD)], decimals=2), 4),
    (stat("WAL archive age", 'pg_stat_archiver_last_archive_age', "s",
          "Seconds since the last WAL segment reached offsite S3 (RPO). archive_timeout is 60 s; alert at 15 min.",
          steps=[(None, GOOD), (300, WARN), (900, CRIT)]), 4),
    (stat("Last full backup", 'time() - max(jv_backup_last_success_timestamp_seconds)', "s",
          "Age of the newest successful wal-g full backup (daily 21:00 UTC). Alert at 26 h.",
          steps=[(None, GOOD), (26 * 3600, CRIT)]), 4),
    (stat("Backup size", 'max(jv_backup_last_size_bytes)', "bytes", "Compressed size of the newest full backup.",
          graph=False), 4),
], 4)
use.add([
    (timeseries("Connections by state",
                [target('sum by (state) (pg_stat_activity_count{datname="jobvacancy"})', "{{state}}")],
                "short", "idle in transaction for long = a leaked transaction (idle_in_transaction_session_timeout 10 s)."), 8),
    (timeseries("Transactions / s",
                [target('sum(rate(pg_stat_database_xact_commit{datname="jobvacancy"}[$__rate_interval]))', "commit", "A"),
                 target('sum(rate(pg_stat_database_xact_rollback{datname="jobvacancy"}[$__rate_interval]))', "rollback", "B")],
                "ops", "Commits and rollbacks on the app database."), 8),
    (timeseries("WAL archiver",
                [target('increase(pg_stat_archiver_archived_count[$__rate_interval])', "archived", "A"),
                 target('increase(pg_stat_archiver_failed_count[$__rate_interval])', "failed", "B")],
                "short", "WAL segments shipped to offsite S3 per interval. Any failed = WalArchiveFailing alert.",
                overrides=[fixed("failed", CRIT), fixed("archived", BLUE)], by_name=False), 8),
], 8)
use.add([
    (table("Heaviest queries (pg_stat_statements)",
           'topk(15, sum by (queryid) (rate(pg_stat_statements_seconds_total{datname="jobvacancy"}[15m])) * on(queryid) group_left(query) max by (queryid, query) (pg_stat_statements_query_id))',
           {"query": "Query (normalised)", "queryid": "Query id", "Value": "Seconds per second (15 m)"},
           "Where the database spends its time. Parameters are normalised ($1), no user data."), 16),
    (timeseries("Deadlocks, conflicts, temp files",
                [target('sum(increase(pg_stat_database_deadlocks{datname="jobvacancy"}[$__rate_interval]))', "deadlocks", "A"),
                 target('sum(increase(pg_stat_database_temp_files{datname="jobvacancy"}[$__rate_interval]))', "temp files", "B")],
                "short", "Errors and spills: temp files mean a sort or hash exceeded work_mem (16 MB)."), 8),
], 8)
use.row("Redis, pools, River")
use.add([
    (timeseries("Redis memory used",
                [target('redis_memory_used_bytes', "{{instance}}")], "bytes",
                "redis-cache evicts (allkeys-lru); redis-state never evicts (noeviction): writes fail when it is full.", fill=0), 6),
    (timeseries("Redis memory / maxmemory",
                [target('redis_memory_used_bytes / (redis_memory_max_bytes > 0)', "{{instance}}")], "percentunit",
                "Alert RedisStateMemoryHigh above 85 % for redis-state.", threshold=0.85, fill=0, max_=1), 6),
    (timeseries("Redis ops / s and evictions",
                [target('rate(redis_commands_processed_total[$__rate_interval])', "{{instance}} ops", "A"),
                 target('rate(redis_evicted_keys_total[$__rate_interval])', "{{instance}} evicted", "B")],
                "ops", "Evictions on redis-cache are normal under pressure; on redis-state they must be zero."), 6),
    (timeseries("DB pool in use",
                [target('pool:db_pool_utilisation:ratio', "{{instance}} {{pool}}")], "percentunit",
                "Acquired / max per process pool (api 20, worker 35). Alert above 90 % for 5 m.", threshold=0.9, max_=1,
                fill=0), 6),
], 8)
use.add([
    (timeseries("River jobs waiting / running",
                [target('sum by (queue, state) (jv_river_jobs)', "{{queue}} {{state}}")], "short",
                "available = waiting for a worker. Alert RiverQueueBacklog above 1000 for 5 m.", threshold=1000), 8),
    (timeseries("River queue wait (oldest runnable job)",
                [target('jv_river_queue_wait_seconds', "{{queue}}")], "s",
                "Queue latency. critical queue carries OTP e-mails: seconds matter there.", fill=0), 8),
    (timeseries("River jobs finalized (5 m)",
                [target('sum by (state) (jv_river_jobs_finalized_5m)', "{{state}}")], "short",
                "Throughput by final state. discarded = retries exhausted (RiverJobsDiscarded alert).",
                overrides=[fixed("completed", GOOD), fixed("discarded", CRIT), fixed("cancelled", MUTED)], by_name=False), 8),
], 8)

# ---- business --------------------------------------------------------------------------------
biz = Board("jv-business", "jobvacancy · Business",
            "Marketplace health: supply (vacancies), demand (seekers, applications), moderation, chat (TZ OPS-04).",
            ["jobvacancy", "business"])
biz.row("Today")
biz.add([
    (stat("Published vacancies", 'max(jv_vacancies_published)', "short", "Vacancies live on the site now."), 4),
    (stat("Waiting for moderation", 'max(jv_moderation_queue)', "short", "Vacancies submitted and not yet reviewed.",
          steps=[(None, GOOD), (20, WARN), (100, CRIT)]), 4),
    (stat("Oldest in moderation", 'max(jv_moderation_oldest_seconds)', "s",
          "How long the oldest submitted vacancy has waited for an admin.", steps=[(None, GOOD), (4 * 3600, WARN), (24 * 3600, CRIT)]), 4),
    (stat("New seekers (24 h)", 'sum(jv_signups_24h{role="seeker"})', "short", "Seeker accounts created in the last 24 hours."), 4),
    (stat("New employers (24 h)", 'sum(jv_signups_24h{role="employer"})', "short", "Employer accounts created in the last 24 hours."), 4),
    (stat("Applications (24 h)", 'sum(jv_created_24h{entity="applications"})', "short", "Applications sent in the last 24 hours."), 4),
], 5)
biz.row("Trends")
biz.add([
    (timeseries("New rows per hour",
                [target('sum by (relname) (increase(pg_stat_user_tables_n_tup_ins{datname="jobvacancy", relname=~"users|vacancies|applications|messages|companies|resumes"}[1h]))', "{{relname}}")],
                "short", "Inserts per hour by table (postgres_exporter). messages = chat activity; users = sign-ups.",
                fill=0, overrides=slots("applications", "vacancies", "companies", "resumes", "users", "messages"),
                by_name=False), 12),
    (timeseries("Created in the last 24 h",
                [target('sum by (entity) (jv_created_24h)', "{{entity}}", "A"),
                 target('sum by (role) (jv_signups_24h{role!="admin"})', "{{role}} sign-ups", "B")],
                "short", "Rolling 24-hour counts (UUIDv7 primary key ranges).", fill=0,
                overrides=slots("applications", "vacancies", "companies", "resumes", "seeker sign-ups", "employer sign-ups"),
                by_name=False), 12),
], 9)
biz.add([
    (timeseries("Published vacancies",
                [target('max(jv_vacancies_published)', "published")], "short", "Supply on the site.", legend=None,
                fill=15), 8),
    (timeseries("Moderation queue",
                [target('max(jv_moderation_queue)', "waiting")], "short",
                "Vacancies waiting for review. The admin moderation queue is at /admin.", legend=None, fill=15), 8),
    (timeseries("Accounts",
                [target('sum by (role) (jv_users{status="active"})', "{{role}}")], "short",
                "Active accounts by role (refreshed every 15 minutes).", fill=0,
                overrides=slots("seeker", "employer", "admin"), by_name=False), 8),
], 8)
biz.row("Realtime")
biz.add([
    (timeseries("WebSocket connections",
                [target('sum by (instance) (ws_connections)', "{{instance}}")], "short",
                "Open chat/badge sockets per API instance. Needs the ws_connections gauge from the API "
                "(core lane follow-up); nginx active connections on the RED board meanwhile.", fill=0), 12),
    (timeseries("Response cache hit ratio",
                [target('jv:respcache_hit:ratio_rate5m', "{{cache}}")], "percentunit",
                "Per cache: vacancy list and detail, suggest, company, popular searches. Low = TTL too short or invalidation storms.",
                fill=0, max_=1, overrides=slots("vacancy_list", "vacancy_detail", "suggest", "company", "popular"), by_name=False), 12),
], 8)

os.makedirs(OUT, exist_ok=True)
for b, name in ((red, "jobvacancy-red.json"), (use, "jobvacancy-use.json"), (biz, "jobvacancy-business.json")):
    with open(os.path.join(OUT, name), "w") as f:
        json.dump(b.json(), f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(name, len(b.panels), "panels")
