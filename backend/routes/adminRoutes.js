const express = require('express');
const router = express.Router();

// Placeholder for future admin routes
router.get('/ping', (req, res) => res.json({ message: 'admin route alive' }));

module.exports = router;
