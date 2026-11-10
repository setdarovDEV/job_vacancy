import http from 'k6/http';
import { check, sleep } from 'k6';

// Load test for public catalog endpoints.
// Run: k6 run tests/load/vacancies.js

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // ramp up
    { duration: '3m', target: 50 },   // steady state
    { duration: '1m', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://jobvacancy.uz/api/v1';

export default function () {
  const listRes = http.get(`${BASE_URL}/vacancies?limit=20`);
  check(listRes, {
    'vacancy list status is 200': (r) => r.status === 200,
    'vacancy list p95 < 500ms': (r) => r.timings.duration < 500,
  });

  const searchRes = http.get(`${BASE_URL}/search/vacancies?q=flutter`);
  check(searchRes, {
    'search status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
