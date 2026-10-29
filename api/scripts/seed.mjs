import pg from 'pg';
import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
if (process.env.DEMO_MODE !== 'true')
  throw new Error('Seeding requires explicit DEMO_MODE=true; never run against customer data.');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12)
  throw new Error('Set DEMO_PASSWORD to at least 12 characters.');
const hash = () => {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex')}`;
};
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const c = await pool.connect();
const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
try {
  await c.query('BEGIN');
  await c.query('SELECT pg_advisory_xact_lock(482914702)');
  const companies = [
    [1, 'Northline Distribution', 'customer', 'verified', 'Algiers'],
    [2, 'Atlas Freight', 'provider', 'verified', 'Oran'],
    [3, 'Sahara Logistics', 'provider', 'verified', 'Constantine'],
    [4, 'New Horizon Transport', 'provider', 'pending', 'Sétif'],
    [5, 'Coastal Supply', 'customer', 'verified', 'Annaba'],
  ];
  for (const [n, name, kind, status, city] of companies)
    await c.query(
      'INSERT INTO companies(id,name,kind,status,city) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING',
      [id(n), name, kind, status, city],
    );
  const users = [
    [11, null, 'Atlas Administrator', 'admin@atlas.example', 'admin'],
    [12, 1, 'Amine Benali', 'customer@atlas.example', 'customer'],
    [13, 2, 'Nadia Merabet', 'provider@atlas.example', 'provider'],
    [14, 3, 'Yacine Hamdi', 'competitor@atlas.example', 'provider'],
    [15, 4, 'Omar Saidi', 'pending@atlas.example', 'provider'],
    [16, 5, 'Karim Saadi', 'second@atlas.example', 'customer'],
  ];
  for (const [n, company, name, email, role] of users)
    await c.query(
      'INSERT INTO users(id,company_id,name,email,role,password_hash) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING',
      [id(n), company ? id(company) : null, name, email, role, hash()],
    );
  const future = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const requests = [
    [
      21,
      'AT-2026-001',
      1,
      'Algiers',
      'Oran',
      'Packaged household goods',
      12500,
      7,
      'Palletized shipment. Covered trailer required. Loading window 08:00–12:00.',
    ],
    [
      22,
      'AT-2026-002',
      1,
      'Sétif',
      'Constantine',
      'Industrial spare parts',
      4200,
      10,
      'Forklift available at pickup and delivery.',
    ],
    [
      23,
      'AT-2026-003',
      5,
      'Annaba',
      'Algiers',
      'Textile cartons',
      8600,
      14,
      'Synthetic customer shipment for company isolation review.',
    ],
  ];
  for (const [n, reference, company, origin, destination, cargo, weight, days, notes] of requests)
    await c.query(
      'INSERT INTO requests(id,reference,customer_company_id,origin,destination,cargo,weight_kg,pickup_date,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING',
      [id(n), reference, id(company), origin, destination, cargo, weight, future(days), notes],
    );
  for (const [n, provider, amount, days] of [
    [31, 2, 48000, 2],
    [32, 3, 44500, 3],
  ])
    await c.query(
      'INSERT INTO quotes(id,request_id,provider_company_id,amount_dzd,estimated_days,valid_until,notes) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING',
      [
        id(n),
        id(21),
        id(provider),
        amount,
        days,
        future(5),
        'Includes loading coordination. Synthetic quotation.',
      ],
    );
  await c.query(
    'INSERT INTO audit_events(id,actor_id,company_id,action,entity_type,entity_id,detail) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING',
    [
      id(41),
      id(12),
      id(1),
      'request.created',
      'request',
      id(21),
      'Synthetic seed request Algiers → Oran',
    ],
  );
  await c.query(
    'INSERT INTO notifications(id,user_id,title,body) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING',
    [
      id(51),
      id(12),
      'Two quotations ready',
      'Compare Atlas Freight and Sahara Logistics for your Algiers → Oran request.',
    ],
  );
  await c.query('COMMIT');
  console.log(
    'Synthetic Atlas data seeded idempotently. Existing account passwords and records were not overwritten.',
  );
} catch (e) {
  await c.query('ROLLBACK');
  throw e;
} finally {
  c.release();
  await pool.end();
}
