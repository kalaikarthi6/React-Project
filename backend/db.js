const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  database: process.env.DB_NAME || 'certis',
  user: process.env.DB_USER || 'postgres',
};
if (process.env.DB_PASSWORD !== undefined && process.env.DB_PASSWORD !== '') {
  poolConfig.password = process.env.DB_PASSWORD;
}
const pool = new Pool(poolConfig);

const defaultDate = () => new Date().toISOString();

async function init() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        avatar TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        subject TEXT NOT NULL,
        requester_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_to_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        source TEXT,
        type TEXT,
        group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
        dept TEXT,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS listings (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT,
        category TEXT,
        status TEXT,
        vendor TEXT,
        cost NUMERIC(12,2),
        department TEXT,
        assigned_to_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        expiry DATE,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sla_policies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        priority TEXT NOT NULL,
        first_response_hours INTEGER,
        resolution_hours INTEGER,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS workflow_automator (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        trigger_event TEXT,
        conditions JSONB,
        actions JSONB,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS email_notifications (
        id SERIAL PRIMARY KEY,
        event_type TEXT NOT NULL UNIQUE,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS workspace_settings (
        id SERIAL PRIMARY KEY,
        workspace_name TEXT,
        url TEXT,
        timezone TEXT,
        language TEXT,
        date_format TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets(requester_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
      CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
      CREATE INDEX IF NOT EXISTS idx_tickets_group ON tickets(group_id);
      CREATE INDEX IF NOT EXISTS idx_listings_assigned_to ON listings(assigned_to_id);
      CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
      CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
      CREATE INDEX IF NOT EXISTS idx_workflow_status ON workflow_automator(status);
      CREATE INDEX IF NOT EXISTS idx_workflow_trigger ON workflow_automator(trigger_event);
      CREATE INDEX IF NOT EXISTS idx_email_notifications_event_type ON email_notifications(event_type);
    `);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to initialize PostgreSQL schema', error);
    throw error;
  } finally {
    client.release();
  }
}

async function getUserByName(name) {
  if (!name) return null;
  const result = await pool.query('SELECT id, name FROM users WHERE name = $1 LIMIT 1', [name]);
  return result.rows[0] || null;
}

async function getGroupByName(name) {
  if (!name) return null;
  const result = await pool.query('SELECT id, name FROM groups WHERE name = $1 LIMIT 1', [name]);
  return result.rows[0] || null;
}

module.exports = { pool, defaultDate, init, getUserByName, getGroupByName };