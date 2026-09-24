// Zero-downtime guard for deploys (TZ OPS-06: "deploy davomida 5xx yo'q, k6 fonda ishlab
// turadi"). Steady, light traffic against the public entry point while a deploy rolls; the
// run fails if any response is a 5xx or a connection error. 4xx (staging basic auth, rate
// limits) are not failures here.
//
//   k6 run --address 127.0.0.1:6565 -e BASE=https://staging.jobvacancy.uz k6/zero-downtime.js &
//   make deploy-staging ...                     # or the CI deploy step
//   curl -X PATCH 127.0.0.1:6565/v1/status -d '{"data":{"attributes":{"stopped":true}}}'; wait
//   jq -e .ok zero-downtime-summary.json        # the verdict (a REST stop exits k6 with 103)
//
// Env: BASE (required), RATE (requests/s, default 10), DURATION (upper bound, default 20m),
//      AUTH ("user:password" for staging basic auth, optional), SUMMARY (verdict file,
//      default zero-downtime-summary.json).
import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import encoding from "k6/encoding";

const BASE = (__ENV.BASE || "").replace(/\/$/, "");
if (!BASE) throw new Error("set BASE, e.g. -e BASE=https://staging.jobvacancy.uz");

const serverErrors = new Counter("server_errors");

export const options = {
  scenarios: {
    steady: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.RATE || 10),
      timeUnit: "1s",
      duration: __ENV.DURATION || "20m",
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    server_errors: ["count==0"],
    "http_req_duration{kind:api}": ["p(95)<500"],
  },
  // Keep-alive like browsers; a deploy must not break reused connections either.
  noConnectionReuse: false,
  summaryTrendStats: ["avg", "p(95)", "p(99)", "max"],
};

const headers = __ENV.AUTH ? { Authorization: `Basic ${encoding.b64encode(__ENV.AUTH)}` } : {};
// jv_auth=1 bypasses nginx's anonymous SSR micro-cache, so every page request reaches web-1/2.
const pageHeaders = Object.assign({ Cookie: "jv_auth=1" }, headers);

const targets = [
  { url: "/api/v1/catalog/regions", kind: "api", h: headers },
  { url: "/api/v1/vacancies?limit=5", kind: "api", h: headers },
  { url: "/", kind: "page", h: pageHeaders },
  { url: "/vacancies", kind: "page", h: pageHeaders },
];

export default function () {
  const t = targets[Math.floor(Math.random() * targets.length)];
  const res = http.get(BASE + t.url, { headers: t.h, tags: { kind: t.kind, name: t.url }, timeout: "15s" });
  const ok = res.status !== 0 && res.status < 500;
  if (!ok) {
    serverErrors.add(1, { status: String(res.status), name: t.url });
    console.error(`${new Date().toISOString()} ${res.status || "connection error"} ${t.url} ${res.error || ""}`);
  }
  check(res, { "no 5xx": () => ok });
}

// The verdict as a file, because a run stopped through the REST API exits with 103 even when
// every threshold passed.
export function handleSummary(data) {
  const m = data.metrics;
  const requests = m.http_reqs ? m.http_reqs.values.count : 0;
  const errors = m.server_errors ? m.server_errors.values.count : 0;
  const api = m["http_req_duration{kind:api}"];
  const p95 = api ? api.values["p(95)"] : null;
  const verdict = { requests, server_errors: errors, api_p95_ms: p95, ok: requests > 0 && errors === 0 };
  const line = `zero-downtime: ${requests} requests, ${errors} 5xx or connection errors, API p95 ` +
    `${p95 === null ? "-" : p95.toFixed(1) + " ms"} → ${verdict.ok ? "PASS" : "FAIL"}\n`;
  return { stdout: line, [__ENV.SUMMARY || "zero-downtime-summary.json"]: JSON.stringify(verdict) + "\n" };
}
