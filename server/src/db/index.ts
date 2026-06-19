import { Pool } from 'pg';
import { config } from '../config';

// Managed Postgres (Railway, Supabase Mumbai, RDS, etc.) all require SSL;
// only a local dev DB doesn't. Enable SSL for anything that isn't localhost.
const isLocalDb = /@(localhost|127\.0\.0\.1)[:/]/.test(config.databaseUrl);
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
});

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function one<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// Run a set of writes atomically (ACID): all succeed and COMMIT, or any error
// ROLLBACKs the lot. The callback gets a `q` bound to the same transaction
// connection — use it for every write inside instead of the global `query`.
export type Tx = <T = any>(text: string, params?: any[]) => Promise<T[]>;
export async function withTransaction<R>(fn: (q: Tx) => Promise<R>): Promise<R> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const q: Tx = async (text, params = []) => (await client.query(text, params)).rows;
    const result = await fn(q);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}
