const express = require('express');
const router = express.Router();
const { all, get, run } = require('../database');

router.post('/register', (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  try {
    let user = get('SELECT id FROM users WHERE device_id = ?', [deviceId]);
    if (!user) {
      run('INSERT INTO users (device_id) VALUES (?)', [deviceId]);
      user = get('SELECT id FROM users WHERE device_id = ?', [deviceId]);
    }
    res.json({ userId: user.id });
  } catch (err) {
    console.error('Register user error:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

module.exports = router;
