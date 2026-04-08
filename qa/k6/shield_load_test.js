/**
 * Shield Platform — k6 Load Test
 * 5 scenarios: auth ramp, DNS burst, analytics load, mixed gateway, WebSocket
 *
 * Usage:
 *   k6 run --out json=/tmp/k6_results.json shield_load_test.js
 *   k6 run --out json=/tmp/k6_results.json -e BASE_URL=http://localhost:8280 shield_load_test.js
 */

import http   from 'k6/http';
import ws     from 'k6/ws';
import { check, sleep }  from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Config from environment ────────────────────────────────────────────────
const BASE_URL     = __ENV.BASE_URL     || 'http://localhost:8280';
const DNS_URL      = __ENV.DNS_URL      || 'http://localhost:8292/dns-query';
const WS_URL       = __ENV.WS_URL       || 'ws://localhost:8280/ws';
const ADMIN_EMAIL  = __ENV.ADMIN_EMAIL  || 'admin@rstglobal.in';
const ADMIN_PASS   = __ENV.ADMIN_PASS   || 'Shield@Admin2026#';

// ── Custom metrics ─────────────────────────────────────────────────────────
const authErrors       = new Counter('auth_errors');
const dnsErrors        = new Counter('dns_errors');
const apiErrors        = new Counter('api_errors');
const wsConnectErrors  = new Counter('ws_connect_errors');
const authDuration     = new Trend('auth_duration_ms',    true);
const dnsDuration      = new Trend('dns_duration_ms',     true);
const apiDuration      = new Trend('api_duration_ms',     true);

// ── Scenarios ──────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // Scenario 1: Auth endpoint ramp — 0→20→0 VUs
    auth_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 20 },
        { duration: '30s', target: 20 },
        { duration: '10s', target: 0  },
      ],
      gracefulRampDown: '5s',
      tags: { scenario: 'auth_ramp' },
      exec: 'authScenario',
    },

    // Scenario 2: DNS burst — 50 VUs for 30s
    dns_burst: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30s',
      startTime: '65s',   // start after auth ramp finishes
      tags: { scenario: 'dns_burst' },
      exec: 'dnsScenario',
    },

    // Scenario 3: Analytics load — 10 VUs for 30s
    analytics_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      startTime: '100s',
      tags: { scenario: 'analytics_load' },
      exec: 'analyticsScenario',
    },

    // Scenario 4: Mixed gateway — 20 VUs simulating real user session
    mixed_gateway: {
      executor: 'constant-vus',
      vus: 20,
      duration: '40s',
      startTime: '135s',
      tags: { scenario: 'mixed_gateway' },
      exec: 'mixedScenario',
    },

    // Scenario 5: WebSocket connections — 10 concurrent WS connections
    websocket_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '20s',
      startTime: '180s',
      tags: { scenario: 'websocket_load' },
      exec: 'wsScenario',
    },
  },

  thresholds: {
    // Auth: p95 < 500ms, error rate < 2%
    'http_req_duration{scenario:auth_ramp}':       ['p(95)<500'],
    'http_req_failed{scenario:auth_ramp}':         ['rate<0.02'],
    // DNS: p95 < 300ms, error rate < 1%
    'http_req_duration{scenario:dns_burst}':       ['p(95)<300'],
    'http_req_failed{scenario:dns_burst}':         ['rate<0.01'],
    // Analytics: p95 < 2000ms, error rate < 2%
    'http_req_duration{scenario:analytics_load}':  ['p(95)<2000'],
    'http_req_failed{scenario:analytics_load}':    ['rate<0.02'],
    // Mixed: p95 < 2000ms overall
    'http_req_duration{scenario:mixed_gateway}':   ['p(95)<2000'],
  },
};

// ── k6 setup() — runs once before all scenarios ───────────────────────────
export function setup() {
  const r = http.post(`${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (r.status === 200) {
    try {
      const jwt = JSON.parse(r.body).data?.accessToken || '';
      return { jwt };
    } catch (_) {}
  }
  return { jwt: '' };
}

// ── Auth: get JWT (called per VU in auth scenario; uses live login) ────────
function getJwt() {
  const r = http.post(`${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth_login' } }
  );
  if (r.status !== 200) return '';
  try {
    return JSON.parse(r.body).data?.accessToken || '';
  } catch (_) { return ''; }
}

// ── DNS query helper ──────────────────────────────────────────────────────
const DNS_DOMAINS = [
  'google.com', 'bbc.com', 'stackoverflow.com', 'github.com',
  'wikipedia.org', 'youtube.com', 'amazon.com', 'netflix.com',
];
const DNS_CLIENT_IDS = ['disha-0000', 'jakesmith-0000', 'sangeeta-0000'];
const DNS_HOST_SUFFIX = '.dns.shield.rstglobal.in';

function makeDnsWire(domain) {
  // Minimal DNS wire format for A record query (no dnspython needed)
  // Header: ID=0x1234, QR=0, OPCODE=0, RD=1, QDCOUNT=1
  const header = new Uint8Array([0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const labels = domain.split('.');
  const qParts = [];
  for (const label of labels) {
    qParts.push(label.length);
    for (let i = 0; i < label.length; i++) qParts.push(label.charCodeAt(i));
  }
  qParts.push(0x00); // end of QNAME
  qParts.push(0x00, 0x01); // QTYPE A
  qParts.push(0x00, 0x01); // QCLASS IN
  const wire = new Uint8Array(header.length + qParts.length);
  wire.set(header);
  wire.set(qParts, header.length);
  return wire.buffer;
}

// ── Scenario functions ────────────────────────────────────────────────────

export function authScenario() {
  const t0 = Date.now();
  const r = http.post(`${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth_login' } }
  );
  authDuration.add(Date.now() - t0);
  const ok = check(r, {
    'auth 200': res => res.status === 200,
    'auth has token': res => { try { return !!JSON.parse(res.body).data?.accessToken; } catch(_) { return false; } },
  });
  if (!ok) authErrors.add(1);
  sleep(0.1);
}

export function dnsScenario() {
  const vuIdx  = __VU % DNS_CLIENT_IDS.length;
  const dom    = DNS_DOMAINS[__ITER % DNS_DOMAINS.length];
  const cid    = DNS_CLIENT_IDS[vuIdx];
  const wire   = makeDnsWire(dom);

  const t0 = Date.now();
  const r  = http.post(DNS_URL, wire, {
    headers: {
      'Content-Type': 'application/dns-message',
      'Accept':       'application/dns-message',
      'Host':         `${cid}${DNS_HOST_SUFFIX}`,
    },
    tags: { name: 'dns_query' },
    timeout: '10s',
  });
  dnsDuration.add(Date.now() - t0);
  const ok = check(r, { 'dns 200': res => res.status === 200 });
  if (!ok) dnsErrors.add(1);
  sleep(0.05); // 50ms pause: prevent overwhelming the WebFlux event loop queue
}

export function analyticsScenario(data) {
  const jwt = (data && data.jwt) || getJwt();
  if (!jwt) { apiErrors.add(1); return; }
  const hdrs = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };

  const endpoints = [
    '/api/v1/analytics/platform/overview',
    '/api/v1/analytics/platform/daily',
    '/api/v1/dns/categories/full',
    '/api/v1/rewards/tasks',
  ];
  for (const ep of endpoints) {
    const t0 = Date.now();
    const r  = http.get(`${BASE_URL}${ep}`, { headers: hdrs, tags: { name: 'analytics' } });
    apiDuration.add(Date.now() - t0);
    const ok = check(r, { 'api 200': res => res.status === 200 });
    if (!ok) apiErrors.add(1);
    sleep(0.05);
  }
}

export function mixedScenario(data) {
  // Simulate a real user session: login → dashboard → analytics → DNS history
  const jwt = (data && data.jwt) || getJwt();
  if (!jwt) { apiErrors.add(1); return; }
  const hdrs = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };

  const session = [
    '/api/v1/tenants?page=0&size=5',
    '/api/v1/analytics/platform/overview',
    '/api/v1/dns/categories/full',
    '/api/v1/rewards/tasks',
    '/api/v1/admin/invoices?page=0&size=5',
  ];
  for (const path of session) {
    http.get(`${BASE_URL}${path}`, { headers: hdrs, tags: { name: 'mixed_session' } });
    sleep(0.2);
  }
}

export function wsScenario(data) {
  const jwt = (data && data.jwt) || getJwt();
  if (!jwt) { wsConnectErrors.add(1); return; }

  const url = `${WS_URL}?token=${jwt}`;
  const res = ws.connect(url, {}, (socket) => {
    socket.on('open', () => {
      // Send STOMP CONNECT frame
      socket.send(
        'CONNECT\naccept-version:1.2\nheart-beat:4000,4000\n\n\x00'
      );
    });
    socket.on('message', (data) => {
      if (data.startsWith('CONNECTED')) {
        check(data, { 'STOMP CONNECTED': d => d.includes('CONNECTED') });
        socket.close();
      }
    });
    socket.on('error', (e) => {
      wsConnectErrors.add(1);
    });
    socket.setTimeout(() => { socket.close(); }, 5000);
  });
  // WS connect errors are LOW severity — not all deployments have WS at /ws
  check(res, { 'ws_status_101_or_200': r => r && [101, 200].includes(r.status) });
}
