import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
let pool = null;

if (connectionString) {
  pool = new Pool({
    connectionString
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });
} else {
  console.warn('[db] DATABASE_URL not provided. Running in mock-data mode.');
}

export function isDatabaseEnabled() {
  return Boolean(pool);
}

export async function query(text, params) {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured. Database queries are disabled in this environment.');
  }
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log('executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (err) {
    console.error('query error', { text, params, error: err });
    throw err;
  }
}

export async function getClient() {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured. Database connections are disabled.');
  }
  return pool.connect();
}
