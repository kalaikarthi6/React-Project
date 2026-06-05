const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  database: process.env.DB_NAME || 'certis_db',
  user: process.env.DB_USER || 'postgres',
};
if (process.env.DB_PASSWORD !== undefined && process.env.DB_PASSWORD !== '') {
  poolConfig.password = process.env.DB_PASSWORD;
}
const pool = new Pool(poolConfig);

async function run() {
  const sqlFile = path.join(__dirname, 'postgres-schema.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Schema applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to apply schema:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
