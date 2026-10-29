import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const base = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const origin = process.env.APP_ORIGIN || base;
const proof = JSON.parse(
  await readFile(new URL('../artifacts/persistence.json', import.meta.url), 'utf8'),
);
const response = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin },
  body: JSON.stringify({
    email: 'customer@atlas.example',
    password: process.env.DEMO_PASSWORD || 'AtlasDemo!2026',
  }),
});
assert.ok(response.ok, `login after API restart failed: ${response.status}`);
const cookie = response.headers
  .getSetCookie()
  .map((value) => value.split(';')[0])
  .join('; ');
assert.ok(cookie, 'new session cookie missing');
const session = await response.json();
async function get(path) {
  const result = await fetch(`${base}${path}`, { headers: { cookie, origin } });
  assert.equal(result.status, 200, `read after restart: ${path}`);
  return result.json();
}
const detail = await get(`/api/requests/${proof.request.id}`);
for (const [key, value] of Object.entries(proof.request))
  assert.deepEqual(detail.request[key], value, `persisted request ${key}`);
const booking = (await get('/api/bookings')).find((item) => item.id === proof.booking.id);
assert.ok(booking, 'booking disappeared after restart');
for (const [key, value] of Object.entries(proof.booking))
  assert.deepEqual(booking[key], value, `persisted booking ${key}`);
assert.equal(detail.quotes.filter((item) => item.status === 'accepted').length, 1);
assert.ok(
  (await get('/api/activity')).some((item) => item.entityId === proof.request.id),
  'audit evidence disappeared after restart',
);
assert.equal(session.user.companyId, proof.request.customerCompanyId);
console.log(
  'PASS: real PostgreSQL request, quote acceptance, booking and audit survive API restart.',
);
