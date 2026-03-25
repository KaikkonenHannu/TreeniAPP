const express = require('express');
const router = express.Router();
const { all, get, run } = require('../database');

router.post('/', (req, res) => {
  const { userId, data, startDate } = req.body;
  if (!userId || !data) return res.status(400).json({ error: 'userId and data required' });
  try {
    run('INSERT INTO programs (user_id, data, start_date) VALUES (?, ?, ?)', [userId, JSON.stringify(data), startDate || new Date().toISOString().split('T')[0]]);
    res.json({ success: true });
  } catch (err) {
    console.error('Save program error:', err);
    res.status(500).json({ error: 'Failed to save program' });
  }
});

router.get('/:userId', (req, res) => {
  try {
    const program = get('SELECT * FROM programs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [req.params.userId]);
    if (!program) return res.json(null);
    res.json({ ...program, data: JSON.parse(program.data) });
  } catch (err) {
    console.error('Get program error:', err);
    res.status(500).json({ error: 'Failed to get program' });
  }
});

router.delete('/:userId', (req, res) => {
  try {
    run('DELETE FROM programs WHERE user_id = ?', [req.params.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete program error:', err);
    res.status(500).json({ error: 'Failed to delete program' });
  }
});

module.exports = router;
