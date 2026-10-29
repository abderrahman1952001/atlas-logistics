import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock(482914701)');
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, sha256 char(64) NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const dir = fileURLToPath(new URL('../migrations/', import.meta.url));
  for (const name of (await readdir(dir)).filter((n) => /^\d+.*\.sql$/.test(n)).sort()) {
    const sql = await readFile(`${dir}/${name}`, 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    const prior = await client.query('SELECT sha256 FROM schema_migrations WHERE name=$1', [name]);
    if (prior.rows.length) {
      if (prior.rows[0].sha256 !== hash) throw new Error(`Applied migration changed: ${name}`);
      continue;
    }
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)', [name, hash]);
      await client.query('COMMIT');
      console.log(`Applied ${name}`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  }
} finally {
  await client.query('SELECT pg_advisory_unlock(482914701)');
  client.release();
  await pool.end();
}
