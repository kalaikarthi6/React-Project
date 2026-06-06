const { pool } = require('./db');
const bcrypt = require('bcrypt');

async function restoreAdmin() {
  try {
    const email = 'victinet@gmail.com';
    const password = process.env.ADMIN_PASSWORD || 'Ammu@123';
    const role = 'admin';
    const name = 'Sriram Senthilkumar';
    const status = 'Active';

    console.log(`Hashing password for ${email}...`);
    const hash = await bcrypt.hash(password, 10);

    console.log('Inserting into auth_users...');
    await pool.query(`
      INSERT INTO auth_users (email, password_hash, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = $3;
    `, [email, hash, role]);
    
    console.log('Inserting into users...');
    await pool.query(`
      INSERT INTO users (name, email, role, status)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE SET name = $1, role = $3, status = $4;
    `, [name, email, role, status]);
    
    console.log("Admin user restored successfully! You can now login.");
    process.exit(0);
  } catch (err) {
    console.error('Error restoring admin:', err);
    process.exit(1);
  }
}

restoreAdmin();
