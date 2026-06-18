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
