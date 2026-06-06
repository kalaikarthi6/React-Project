const { pool } = require('./db');
const bcrypt = require('bcrypt');

async function seed() {
  try {
    // Step 1: Create auth_users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'agent',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Table auth_users created.");

    // Step 2: Insert first admin user
    const email = 'victinet@gmail.com';
    const password = 'Admin@123';
    const role = 'admin';

    const hash = await bcrypt.hash(password, 10);

    await pool.query(`
      INSERT INTO auth_users (email, password_hash, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO NOTHING;
    `, [email, hash, role]);
    
    console.log("Admin user seeded.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
