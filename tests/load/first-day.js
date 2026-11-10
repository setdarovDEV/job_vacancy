// First-day traffic: visitors browsing the server-rendered site (home, search, filters, a
// vacancy, companies). Runs ON the host against the local web container so the per-IP rate
// limit doesn't turn it into a 429 test: each virtual user sends its own X-Forwarded-For, which
// the stack trusts only from private peers (as it does for Caddy).
//
//   docker run --rm --network host -v "$PWD/tests/load:/s:ro" grafana/k6:0.57.0 run /s/first-day.js
//   (env: WEB=http://127.0.0.1:3000 API=http://127.0.0.1:8090/api/v1 PEAK=200)
//
// Stops itself early if pages get slow, so a shared host isn't pushed over the edge.
import http from "k6/http";
import { check, sleep } from "k6";

const WEB = __ENV.WEB || "http://127.0.0.1:3000";
const API = __ENV.API || "http://127.0.0.1:8090/api/v1";
const PEAK = Number(__ENV.PEAK || 200);

export const options = {
  stages: [
    { duration: "1m", target: Math.round(PEAK / 8) },
    { duration: "1m", target: Math.round(PEAK / 4) },
    { duration: "1m", target: Math.round(PEAK / 2) },
    { duration: "2m", target: PEAK },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    // Abort (not just fail) when the site gets slow: it shares the host with other projects.
    http_req_duration: [{ threshold: "p(95)<4000", abortOnFail: true, delayAbortEval: "30s" }],
    http_req_failed: [{ threshold: "rate<0.05", abortOnFail: true, delayAbortEval: "30s" }],
    "http_req_duration{page:home}": ["p(95)<1500"],
    "http_req_duration{page:list}": ["p(95)<1500"],
    "http_req_duration{page:search}": ["p(95)<2000"],
    "http_req_duration{page:vacancy}": ["p(95)<1500"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "max"],
};

const QUERIES = ["dasturchi", "kassir", "haydovchi", "sotuv", "buxgalter", "oshpaz", "менеджер", "flutter"];

export function setup() {
  const res = http.get(`${API}/vacancies?limit=50`);
  const slugs = (res.json("data") || []).map((v) => v.slug);
  const regions = (http.get(`${API}/catalog/regions`).json("data") || []).map((r) => r.id);
  return { slugs, regions };
}

function ip() {
  // A stable public-looking address per virtual user (documentation range 198.18.0.0/15).
  return `198.18.${(__VU >> 8) & 255}.${__VU & 255}`;
}

function page(path, name) {
  const res = http.get(`${WEB}${path}`, {
    headers: { "X-Forwarded-For": ip(), "User-Agent": "k6-first-day" },
    tags: { page: name },
  });
  check(res, { [`${name} 200`]: (r) => r.status === 200 });
  sleep(1 + Math.random() * 2);
}

export default function (data) {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  page("/", "home");
  page("/vacancies", "list");
  page(`/vacancies?q=${encodeURIComponent(pick(QUERIES))}`, "search");
  if (data.regions.length) page(`/vacancies?region_id=${pick(data.regions)}`, "filter");
  if (data.slugs.length) page(`/vacancies/${pick(data.slugs)}`, "vacancy");
  if (Math.random() < 0.3) page("/companies", "companies");
}
