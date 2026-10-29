import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const ORIGIN = process.env.APP_ORIGIN || BASE_URL;
const PASSWORD = process.env.DEMO_PASSWORD || 'AtlasDemo!2026';
const futureDate = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const marker = `IT-${randomUUID().slice(0, 8)}`;

/** Independent cookie jars model separate signed-in browser sessions. */
class Actor {
  constructor(name) {
    this.name = name;
    this.cookies = new Map();
    this.csrf = '';
  }
  async request(path, { method = 'GET', body, csrf = true, origin = ORIGIN, headers = {} } = {}) {
    const requestHeaders = { accept: 'application/json', ...headers };
    if (this.cookies.size)
      requestHeaders.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (origin !== null) requestHeaders.origin = origin;
    if (csrf && this.csrf) requestHeaders['x-csrf-token'] = this.csrf;
    if (body !== undefined) requestHeaders['content-type'] = 'application/json';
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    const setCookies = response.headers.getSetCookie();
    for (const cookie of setCookies) {
      const pair = cookie.split(';', 1)[0],
        split = pair.indexOf('=');
      const key = pair.slice(0, split),
        value = pair.slice(split + 1);
      if (!value || /max-age=0(?:;|$)/i.test(cookie)) this.cookies.delete(key);
      else this.cookies.set(key, value);
    }
    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw;
    }
    return { status: response.status, data, headers: response.headers, cookies: setCookies };
  }
  async login() {
    const response = await this.request('/api/auth/login', {
      method: 'POST',
      body: { email: `${this.name}@atlas.example`, password: PASSWORD },
    });
    assert.ok(
      [200, 201].includes(response.status),
      `${this.name} login: ${response.status} ${JSON.stringify(response.data)}`,
    );
    assert.equal(typeof response.data.csrfToken, 'string');
    assert.ok(response.data.csrfToken.length >= 24);
    assert.ok(
      response.cookies.some((c) => /httponly/i.test(c) && /samesite=strict/i.test(c)),
      'session cookie must be HttpOnly and SameSite=Strict',
    );
    this.csrf = response.data.csrfToken;
    this.user = response.data.user;
    return response;
  }
}
const actors = Object.fromEntries(
  ['admin', 'customer', 'second', 'provider', 'competitor', 'pending'].map((name) => [
    name,
    new Actor(name),
  ]),
);

const ok = (response, message = '') => {
  assert.ok(
    response.status >= 200 && response.status < 300,
    `${message}: ${response.status} ${JSON.stringify(response.data)}`,
  );
  return response.data;
};
const denied = (response, allowed = [403, 404]) =>
  assert.ok(
    allowed.includes(response.status),
    `expected denial ${allowed}, got ${response.status} ${JSON.stringify(response.data)}`,
  );
async function createRequest(actor = actors.customer, overrides = {}) {
  return ok(
    await actor.request('/api/requests', {
      method: 'POST',
      body: {
        origin: 'Algiers',
        destination: 'Oran',
        cargo: `${marker} equipment`,
        weightKg: 850,
        pickupDate: futureDate(14),
        notes: 'Synthetic integration test shipment',
        ...overrides,
      },
    }),
    'create request',
  );
}
async function createQuote(request, actor = actors.provider, overrides = {}) {
  return ok(
    await actor.request(`/api/requests/${request.id}/quotes`, {
      method: 'POST',
      body: {
        amountDzd: 24000,
        estimatedDays: 2,
        validUntil: futureDate(7),
        notes: `${marker} signed offer`,
        ...overrides,
      },
    }),
    'create quote',
  );
}
async function createBooking() {
  const request = await createRequest();
  const quote = await createQuote(request);
  const booking = ok(
    await actors.customer.request(`/api/quotes/${quote.id}/accept`, { method: 'POST' }),
    'accept quote',
  );
  return { request, quote, booking };
}
async function move(booking, status, actor, extra = {}) {
  return ok(
    await actor.request(`/api/bookings/${booking.id}/status`, {
      method: 'PATCH',
      body: { status, version: booking.version, ...extra },
    }),
    `transition ${status}`,
  );
}

before(async () => {
  const health = await fetch(`${BASE_URL}/health/ready`);
  assert.equal(health.status, 200, 'real database-backed API must be ready before tests');
  for (const actor of Object.values(actors)) await actor.login();
});

test('health, OpenAPI and fixed server-side roles are available', async () => {
  const live = await fetch(`${BASE_URL}/health/live`);
  assert.equal(live.status, 200);
  assert.equal((await fetch(`${BASE_URL}/api/docs`)).status, 200);
  assert.equal(actors.admin.user.role, 'admin');
  assert.equal(actors.customer.user.role, 'customer');
  assert.equal(actors.provider.user.role, 'provider');
  assert.notEqual(actors.customer.user.companyId, actors.second.user.companyId);
});

test('anonymous access and invalid credentials are rejected without account enumeration', async () => {
  const guest = new Actor('guest');
  assert.equal((await guest.request('/api/requests')).status, 401);
  const wrong = await guest.request('/api/auth/login', {
    method: 'POST',
    body: { email: 'customer@atlas.example', password: 'wrong-password-123' },
  });
  const unknown = await guest.request('/api/auth/login', {
    method: 'POST',
    body: { email: 'nobody@atlas.example', password: 'wrong-password-123' },
  });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(
    { statusCode: wrong.data.statusCode, message: wrong.data.message },
    { statusCode: unknown.data.statusCode, message: unknown.data.message },
    'unknown account and wrong password should have the same public error; request IDs may differ',
  );
});

test('session response does not expose password hashes or stored token hashes', async () => {
  const session = ok(await actors.customer.request('/api/auth/session'));
  assert.equal(session.user.id, actors.customer.user.id);
  assert.equal(session.csrfToken, actors.customer.csrf);
  assert.doesNotMatch(
    JSON.stringify(session),
    /passwordHash|password_hash|tokenHash|token_hash|scrypt\$/i,
  );
});

test('missing CSRF, incorrect CSRF and cross-origin mutations are rejected', async () => {
  const body = {
    origin: 'Algiers',
    destination: 'Oran',
    cargo: marker,
    weightKg: 500,
    pickupDate: futureDate(14),
  };
  assert.equal(
    (await actors.customer.request('/api/requests', { method: 'POST', body, csrf: false })).status,
    403,
  );
  const before = actors.customer.csrf;
  actors.customer.csrf = 'incorrect-csrf-token';
  try {
    assert.equal(
      (await actors.customer.request('/api/requests', { method: 'POST', body })).status,
      403,
    );
  } finally {
    actors.customer.csrf = before;
  }
  assert.equal(
    (
      await actors.customer.request('/api/requests', {
        method: 'POST',
        body,
        origin: 'https://untrusted.example',
      })
    ).status,
    403,
  );
});

test('malformed JSON and oversized request bodies receive safe client errors', async () => {
  const cookie = [...actors.customer.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
  const response = await fetch(`${BASE_URL}/api/requests`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      cookie,
      'x-csrf-token': actors.customer.csrf,
    },
    body: '{"cargo":',
  });
  assert.equal(response.status, 400);
  const raw = await response.text();
  assert.doesNotMatch(raw, /SyntaxError|node_modules|\bat .*\.js:\d|<html/i);
  const oversized = await actors.customer.request('/api/requests', {
    method: 'POST',
    body: { notes: 'x'.repeat(40000) },
  });
  assert.equal(oversized.status, 413);
  assert.doesNotMatch(JSON.stringify(oversized.data), /PayloadTooLargeError|node_modules|<html/i);
  assert.equal(
    (await actors.customer.request('/api/auth/session')).status,
    200,
    'invalid input must not corrupt the existing session',
  );
});

test('validation rejects invalid numbers, dates, and privilege escalation fields', async () => {
  const body = {
    origin: 'Algiers',
    destination: 'Oran',
    cargo: marker,
    weightKg: 500,
    pickupDate: futureDate(14),
  };
  for (const changes of [
    { weightKg: -1 },
    { weightKg: '500 OR 1=1' },
    { pickupDate: '2026-02-31' },
    { companyId: actors.second.user.companyId },
    { role: 'admin' },
  ]) {
    const response = await actors.customer.request('/api/requests', {
      method: 'POST',
      body: { ...body, ...changes },
    });
    assert.equal(response.status, 400, JSON.stringify(changes));
  }
  const injection = await actors.customer.request("/api/requests/'%20OR%201=1--");
  denied(injection, [400, 404]);
});

test('SQL-like text remains literal data without changing query behavior', async () => {
  const cargo = `${marker} '; DROP TABLE requests; --`;
  const request = await createRequest(actors.customer, { cargo });
  assert.equal(request.cargo, cargo);
  const detail = ok(await actors.customer.request(`/api/requests/${request.id}`));
  assert.equal(detail.request.cargo, cargo);
  assert.ok(
    ok(await actors.customer.request('/api/requests')).some((row) => row.id === request.id),
  );
});

test('only customers can create transport requests; client company fields never choose ownership', async () => {
  const body = {
    origin: 'Algiers',
    destination: 'Oran',
    cargo: marker,
    weightKg: 500,
    pickupDate: futureDate(14),
  };
  denied(await actors.provider.request('/api/requests', { method: 'POST', body }), [403]);
  denied(await actors.admin.request('/api/requests', { method: 'POST', body }), [403]);
  const request = await createRequest();
  assert.equal(request.customerCompanyId, actors.customer.user.companyId);
});

test('customers cannot list or read another company’s requests', async () => {
  const request = await createRequest();
  denied(await actors.second.request(`/api/requests/${request.id}`));
  const list = ok(await actors.second.request('/api/requests'));
  assert.ok(Array.isArray(list));
  assert.ok(!list.some((item) => item.id === request.id));
  const own = ok(await actors.customer.request(`/api/requests/${request.id}`));
  assert.equal(own.request.id, request.id);
});

test('quotes are private to their provider, the owning customer and administrator', async () => {
  const request = await createRequest();
  const first = await createQuote(request);
  const second = await createQuote(request, actors.competitor, { amountDzd: 27000 });
  const providerView = ok(await actors.provider.request(`/api/requests/${request.id}`));
  assert.deepEqual(
    providerView.quotes.map((q) => q.id),
    [first.id],
  );
  assert.ok(!JSON.stringify(providerView).includes(second.id));
  const customerView = ok(await actors.customer.request(`/api/requests/${request.id}`));
  assert.deepEqual(new Set(customerView.quotes.map((q) => q.id)), new Set([first.id, second.id]));
  const adminView = ok(await actors.admin.request(`/api/requests/${request.id}`));
  assert.equal(adminView.quotes.length, 2);
  denied(await actors.second.request(`/api/quotes/${first.id}/accept`, { method: 'POST' }));
  denied(await actors.provider.request(`/api/quotes/${first.id}/accept`, { method: 'POST' }), [
    403,
  ]);
});

test('duplicate provider quotes are rejected and pending companies cannot quote', async () => {
  const request = await createRequest();
  await createQuote(request);
  assert.equal(
    (
      await actors.provider.request(`/api/requests/${request.id}/quotes`, {
        method: 'POST',
        body: { amountDzd: 25000, estimatedDays: 2, validUntil: futureDate(7) },
      })
    ).status,
    409,
  );
  denied(
    await actors.pending.request(`/api/requests/${request.id}/quotes`, {
      method: 'POST',
      body: { amountDzd: 25000, estimatedDays: 2, validUntil: futureDate(7) },
    }),
    [403],
  );
  denied(
    await actors.customer.request(`/api/companies/${actors.pending.user.companyId}/status`, {
      method: 'PATCH',
      body: { status: 'verified', reason: 'Attempted self verification' },
    }),
    [403],
  );
});

test('suspension immediately blocks an existing provider session and stale quotes', async () => {
  const request = await createRequest();
  const quote = await createQuote(request, actors.competitor);
  const companyId = actors.competitor.user.companyId;
  ok(
    await actors.admin.request(`/api/companies/${companyId}/status`, {
      method: 'PATCH',
      body: { status: 'suspended', reason: `${marker} suspend test` },
    }),
  );
  try {
    const another = await createRequest();
    denied(
      await actors.competitor.request(`/api/requests/${another.id}/quotes`, {
        method: 'POST',
        body: { amountDzd: 20000, estimatedDays: 1, validUntil: futureDate(7) },
      }),
      [403],
    );
    denied(
      await actors.customer.request(`/api/quotes/${quote.id}/accept`, { method: 'POST' }),
      [403, 409],
    );
  } finally {
    ok(
      await actors.admin.request(`/api/companies/${companyId}/status`, {
        method: 'PATCH',
        body: { status: 'verified', reason: `${marker} restore test company` },
      }),
    );
  }
});

test('concurrent quote acceptance creates exactly one booking and accepts exactly one quote', async () => {
  const request = await createRequest();
  const first = await createQuote(request);
  const second = await createQuote(request, actors.competitor, { amountDzd: 26000 });
  const results = await Promise.all(
    [first, second].map((q) =>
      actors.customer.request(`/api/quotes/${q.id}/accept`, { method: 'POST' }),
    ),
  );
  assert.equal(
    results.filter((r) => r.status >= 200 && r.status < 300).length,
    1,
    JSON.stringify(results),
  );
  assert.equal(results.filter((r) => r.status === 409).length, 1);
  const bookings = ok(await actors.customer.request('/api/bookings')).filter(
    (b) => b.requestId === request.id,
  );
  assert.equal(bookings.length, 1);
  const detail = ok(await actors.customer.request(`/api/requests/${request.id}`));
  assert.equal(detail.request.status, 'booked');
  assert.equal(detail.quotes.filter((q) => q.status === 'accepted').length, 1);
  assert.equal(detail.quotes.filter((q) => q.status === 'rejected').length, 1);
});

test('only booking participants see it; role-invalid transitions and stale versions fail', async () => {
  let { booking } = await createBooking();
  assert.ok(!ok(await actors.second.request('/api/bookings')).some((b) => b.id === booking.id));
  assert.ok(!ok(await actors.competitor.request('/api/bookings')).some((b) => b.id === booking.id));
  denied(
    await actors.second.request(`/api/bookings/${booking.id}/status`, {
      method: 'PATCH',
      body: { status: 'cancelled', version: booking.version, reason: 'Not my booking' },
    }),
  );
  denied(
    await actors.customer.request(`/api/bookings/${booking.id}/status`, {
      method: 'PATCH',
      body: { status: 'in_transit', version: booking.version },
    }),
    [403],
  );
  denied(
    await actors.admin.request(`/api/bookings/${booking.id}/status`, {
      method: 'PATCH',
      body: { status: 'in_transit', version: booking.version },
    }),
    [403],
  );
  denied(
    await actors.provider.request(`/api/bookings/${booking.id}/status`, {
      method: 'PATCH',
      body: { status: 'delivered', version: booking.version },
    }),
    [403, 409],
  );
  const staleVersion = booking.version;
  booking = await move(booking, 'in_transit', actors.provider);
  assert.equal(booking.version, staleVersion + 1);
  assert.equal(
    (
      await actors.provider.request(`/api/bookings/${booking.id}/status`, {
        method: 'PATCH',
        body: { status: 'delivered', version: staleVersion },
      })
    ).status,
    409,
  );
});

test('full shipment lifecycle requires customer completion and permits one customer review', async () => {
  let { booking } = await createBooking();
  assert.equal(booking.status, 'confirmed');
  denied(
    await actors.customer.request(`/api/bookings/${booking.id}/review`, {
      method: 'POST',
      body: { rating: 5, comment: 'Too soon' },
    }),
    [400, 409],
  );
  booking = await move(booking, 'in_transit', actors.provider);
  booking = await move(booking, 'delivered', actors.provider);
  denied(
    await actors.provider.request(`/api/bookings/${booking.id}/status`, {
      method: 'PATCH',
      body: { status: 'completed', version: booking.version },
    }),
    [403],
  );
  booking = await move(booking, 'completed', actors.customer);
  assert.equal(booking.status, 'completed');
  const review = ok(
    await actors.customer.request(`/api/bookings/${booking.id}/review`, {
      method: 'POST',
      body: { rating: 5, comment: `${marker} receipt confirmed` },
    }),
  );
  assert.equal(review.rating, 5);
  assert.equal(
    (
      await actors.customer.request(`/api/bookings/${booking.id}/review`, {
        method: 'POST',
        body: { rating: 4, comment: 'Duplicate review' },
      })
    ).status,
    409,
  );
  denied(
    await actors.second.request(`/api/bookings/${booking.id}/review`, {
      method: 'POST',
      body: { rating: 1, comment: 'Foreign customer' },
    }),
  );
  denied(
    await actors.provider.request(`/api/bookings/${booking.id}/review`, {
      method: 'POST',
      body: { rating: 5, comment: 'Self review' },
    }),
    [403],
  );
});

test('cancellation needs a reason and is limited to confirmed bookings', async () => {
  let { booking } = await createBooking();
  assert.equal(
    (
      await actors.customer.request(`/api/bookings/${booking.id}/status`, {
        method: 'PATCH',
        body: { status: 'cancelled', version: booking.version },
      })
    ).status,
    400,
  );
  booking = await move(booking, 'cancelled', actors.customer, {
    reason: `${marker} no longer needed`,
  });
  assert.equal(booking.status, 'cancelled');
  denied(
    await actors.provider.request(`/api/bookings/${booking.id}/status`, {
      method: 'PATCH',
      body: { status: 'in_transit', version: booking.version },
    }),
    [403, 409],
  );
  let { booking: moving } = await createBooking();
  moving = await move(moving, 'in_transit', actors.provider);
  denied(
    await actors.customer.request(`/api/bookings/${moving.id}/status`, {
      method: 'PATCH',
      body: { status: 'cancelled', version: moving.version, reason: 'Too late' },
    }),
    [400, 409],
  );
});

test('audit history and notifications stay scoped and persisted', async () => {
  const request = await createRequest();
  const activity = ok(await actors.customer.request('/api/activity'));
  assert.ok(
    activity.some((a) => a.entityId === request.id),
    'request creation must have persisted audit evidence',
  );
  const other = ok(await actors.second.request('/api/activity'));
  assert.ok(
    !other.some((a) => a.entityId === request.id),
    'unrelated company must not read audit event',
  );
  const adminActivity = ok(await actors.admin.request('/api/activity'));
  assert.ok(adminActivity.some((a) => a.entityId === request.id));
  await createQuote(request);
  const notifications = ok(await actors.customer.request('/api/notifications'));
  assert.ok(notifications.length > 0, 'quote should create notification');
  const notice = notifications[0];
  denied(await actors.second.request(`/api/notifications/${notice.id}/read`, { method: 'PATCH' }));
  const marked = ok(
    await actors.customer.request(`/api/notifications/${notice.id}/read`, { method: 'PATCH' }),
  );
  assert.equal(marked.read, true);
  assert.equal(
    ok(await actors.customer.request('/api/notifications')).find((n) => n.id === notice.id).read,
    true,
  );
});

test('logout revokes the server-side session even if the old cookie is replayed', async () => {
  const temporary = new Actor('customer');
  await temporary.login();
  const stolenCookie = new Map(temporary.cookies);
  const response = await temporary.request('/api/auth/logout', { method: 'POST' });
  assert.equal(response.status, 204);
  temporary.cookies = stolenCookie;
  assert.equal((await temporary.request('/api/auth/session')).status, 401);
});

test('login throttling cannot be bypassed with client-supplied forwarding headers', async () => {
  const guest = new Actor('unknown');
  const email = `unknown-${randomUUID()}@atlas.example`;
  for (let attempt = 1; attempt <= 13; attempt += 1) {
    const response = await guest.request('/api/auth/login', {
      method: 'POST',
      headers: { 'x-forwarded-for': `192.0.2.${attempt}` },
      body: { email, password: 'incorrect-password-123' },
    });
    assert.equal(response.status, attempt <= 12 ? 401 : 429, `login attempt ${attempt}`);
  }
});

test('save a durable request and booking checkpoint for the restart verification', async () => {
  const { request, booking } = await createBooking();
  await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
  await writeFile(
    new URL('../artifacts/persistence.json', import.meta.url),
    JSON.stringify(
      {
        request: {
          id: request.id,
          origin: request.origin,
          destination: request.destination,
          cargo: request.cargo,
          weightKg: request.weightKg,
          customerCompanyId: request.customerCompanyId,
          status: 'booked',
        },
        booking: {
          id: booking.id,
          requestId: request.id,
          amountDzd: booking.amountDzd,
          status: booking.status,
          version: booking.version,
        },
      },
      null,
      2,
    ) + '\n',
  );
});
