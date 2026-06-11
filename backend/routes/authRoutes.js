const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide both email and password' });
    }

    const result = await pool.query('SELECT * FROM auth_users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret_key_here',
      { expiresIn: '24h' }
    );

    // If the user has a temporary password, signal the frontend to force a change
    if (user.is_temp_password) {
      return res.json({ 
        requirePasswordChange: true, 
        token: token,
        message: "Password change required" 
      });
    }

    res.json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Internal server error during signin' });
  }
});

// PUT /api/auth/change-password
// Requires a valid JWT in Authorization header; updates password and clears temp flag.
router.put('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication token is missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { newPassword } = req.body;
    if (!newPassword || newPassword.trim().length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE auth_users
       SET password_hash = $1, is_temp_password = false, temp_password_expires_at = NULL
       WHERE email = $2`,
      [passwordHash, decoded.email]
    );

    // Also activate the user profile
    await pool.query(
      `UPDATE users SET status = 'Active' WHERE email = $1`,
      [decoded.email]
    );

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change-password error:', error);
    res.status(500).json({ error: 'Internal server error during password change' });
  }
});

module.exports = router;
