const express = require('express');
const router = express.Router();
const { all, get, run } = require('../database');

router.post('/', (req, res) => {
  const { userId, date, bedtime, wakeTime, hours, quality } = req.body;
  if (!userId || !date) return res.status(400).json({ error: 'userId and date required' });
  try {
    // Upsert: delete existing then insert
    run('DELETE FROM sleep_logs WHERE user_id = ? AND date = ?', [userId, date]);
    run('INSERT INTO sleep_logs (user_id, date, bedtime, wake_time, hours, quality) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, date, bedtime, wakeTime, hours, quality]);
    res.json({ success: true });
  } catch (err) {
    console.error('Save sleep error:', err);
    res.status(500).json({ error: 'Failed to save sleep data' });
  }
});

router.get('/:userId', (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  try {
    const data = all('SELECT * FROM sleep_logs WHERE user_id = ? ORDER BY date DESC LIMIT ?', [req.params.userId, limit]);
    res.json(data);
  } catch (err) {
    console.error('Get sleep error:', err);
    res.status(500).json({ error: 'Failed to get sleep data' });
  }
});

router.get('/:userId/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const data = get('SELECT * FROM sleep_logs WHERE user_id = ? AND date = ?', [req.params.userId, today]);
    res.json(data || null);
  } catch (err) {
    console.error('Get today sleep error:', err);
    res.status(500).json({ error: 'Failed to get today sleep' });
  }
});

module.exports = router;
