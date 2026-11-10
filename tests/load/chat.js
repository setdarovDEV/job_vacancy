import ws from 'k6/ws';
import { check, sleep } from 'k6';
import http from 'k6/http';

// WebSocket load test: open a ticket, connect, ping/pong a few times.
// Requires a valid access token in ACCESS_TOKEN env var.

export const options = {
  vus: 10,
  duration: '2m',
  thresholds: {
    ws_session_duration: ['p(95)<60000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://jobvacancy.uz/api/v1';
const TOKEN = __ENV.ACCESS_TOKEN || '';

export default function () {
  const ticketRes = http.post(
    `${BASE_URL}/ws/ticket`,
    JSON.stringify({}),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
    }
  );

  const ticket = ticketRes.json('ticket');
  if (!ticket) {
    console.warn('no ticket');
    return;
  }

  const wsUrl = BASE_URL.replace(/^http/, 'ws').replace('/api/v1', '/ws') + `?ticket=${ticket}`;
  const res = ws.connect(wsUrl, null, function (socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'ping' }));
    });
    socket.on('message', (msg) => {
      const data = JSON.parse(msg);
      if (data.type === 'pong') {
        socket.close();
      }
    });
    socket.setTimeout(() => socket.close(), 10000);
  });

  check(res, {
    'ws status is 101': (r) => r && r.status === 101,
  });

  sleep(1);
}
