const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { all, get, run } = require('../database');

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin + '_treeni_salt').digest('hex');
}

// Verify family code
router.post('/verify-family-code', (req, res) => {
  const { code } = req.body;
  const familyCode = process.env.FAMILY_CODE;
  if (!familyCode) return res.json({ valid: true }); // no code set = open access
  res.json({ valid: code === familyCode });
});

// List profiles (names only, no sensitive data)
router.get('/profiles', (req, res) => {
  const familyCode = req.headers['x-family-code'];
  if (process.env.FAMILY_CODE && familyCode !== process.env.FAMILY_CODE) {
    return res.status(401).json({ error: 'Invalid family code' });
  }
  const users = all("SELECT id, name FROM users WHERE name IS NOT NULL AND name != ''");
  res.json(users);
});

// Create profile
router.post('/profiles', (req, res) => {
  const familyCode = req.headers['x-family-code'];
  if (process.env.FAMILY_CODE && familyCode !== process.env.FAMILY_CODE) {
    return res.status(401).json({ error: 'Invalid family code' });
  }
  const { name, pin } = req.body;
  if (!name || !pin || pin.length !== 4) return res.status(400).json({ error: 'Name and 4-digit PIN required' });

  const existing = get("SELECT id FROM users WHERE name = ?", [name.trim()]);
  if (existing) return res.status(409).json({ error: 'Name already exists' });

  const deviceId = 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  run('INSERT INTO users (device_id, name, pin_hash) VALUES (?, ?, ?)', [deviceId, name.trim(), hashPin(pin)]);
  const user = get('SELECT id, name FROM users WHERE device_id = ?', [deviceId]);
  res.json({ userId: user.id, name: user.name });
});

// Login with PIN
router.post('/login', (req, res) => {
  const familyCode = req.headers['x-family-code'];
  if (process.env.FAMILY_CODE && familyCode !== process.env.FAMILY_CODE) {
    return res.status(401).json({ error: 'Invalid family code' });
  }
  const { userId, pin } = req.body;
  if (!userId || !pin) return res.status(400).json({ error: 'userId and PIN required' });

  const user = get('SELECT id, name, pin_hash FROM users WHERE id = ?', [userId]);
  if (!user || !user.pin_hash) return res.status(404).json({ error: 'User not found' });
  if (user.pin_hash !== hashPin(pin)) return res.status(401).json({ error: 'Wrong PIN' });

  res.json({ userId: user.id, name: user.name });
});

// Reset PIN with family code
router.post('/reset-pin', (req, res) => {
  const { userId, familyCode, newPin } = req.body;
  if (!process.env.FAMILY_CODE) return res.status(400).json({ error: 'No family code configured' });
  if (familyCode !== process.env.FAMILY_CODE) return res.status(401).json({ error: 'Wrong family code' });
  if (!userId || !newPin || newPin.length !== 4) return res.status(400).json({ error: 'userId and 4-digit PIN required' });

  const user = get('SELECT id FROM users WHERE id = ?', [userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  run('UPDATE users SET pin_hash = ? WHERE id = ?', [hashPin(newPin), userId]);
  res.json({ success: true });
});

// Legacy register (keep for backward compat during transition)
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
