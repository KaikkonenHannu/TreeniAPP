const express = require('express');
const router = express.Router();
const { all, get, run } = require('../database');

router.post('/sessions', (req, res) => {
  const { userId, date, weekIndex, dayIndex, dayTitle, focus, durationMins, sets } = req.body;
  if (!userId || !date) return res.status(400).json({ error: 'userId and date required' });
  try {
    const result = run('INSERT INTO workout_sessions (user_id, date, week_index, day_index, day_title, focus, duration_mins) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, date, weekIndex, dayIndex, dayTitle, focus, durationMins || null]);
    const sessionId = result.lastId;

    if (sets && Array.isArray(sets)) {
      for (const s of sets) {
        run('INSERT INTO set_logs (session_id, exercise_name, set_num, weight_kg, reps, completed) VALUES (?, ?, ?, ?, ?, ?)',
          [sessionId, s.exerciseName, s.setNum, s.weightKg || null, s.reps || null, s.completed ? 1 : 0]);

        if (s.completed && s.weightKg > 0) {
          const currentPR = get('SELECT MAX(weight_kg) as max_weight FROM exercise_prs WHERE user_id = ? AND exercise_name = ?', [userId, s.exerciseName]);
          if (!currentPR || !currentPR.max_weight || s.weightKg > currentPR.max_weight) {
            run('INSERT INTO exercise_prs (user_id, exercise_name, weight_kg, reps, achieved_at) VALUES (?, ?, ?, ?, ?)',
              [userId, s.exerciseName, s.weightKg, s.reps || 0, date]);
          }
        }
      }
    }
    res.json({ success: true, sessionId });
  } catch (err) {
    console.error('Save session error:', err);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

router.get('/sessions/:userId', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  try {
    const sessions = all('SELECT * FROM workout_sessions WHERE user_id = ? ORDER BY completed_at DESC LIMIT ?', [req.params.userId, limit]);
    const result = sessions.map(session => ({
      ...session,
      sets: all('SELECT * FROM set_logs WHERE session_id = ? ORDER BY exercise_name, set_num', [session.id])
    }));
    res.json(result);
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

router.get('/weight-suggestion/:userId/:exerciseName', (req, res) => {
  try {
    const exerciseName = decodeURIComponent(req.params.exerciseName);
    const history = all(
      `SELECT sl.weight_kg, sl.reps, sl.set_num, sl.completed, ws.date
       FROM set_logs sl JOIN workout_sessions ws ON sl.session_id = ws.id
       WHERE ws.user_id = ? AND sl.exercise_name = ?
       ORDER BY ws.date DESC, sl.set_num ASC LIMIT 20`,
      [req.params.userId, exerciseName]
    );

    if (!history.length) return res.json({ suggestion: null, lastWeight: null, history: [] });

    const lastDate = history[0].date;
    const lastSets = history.filter(h => h.date === lastDate);
    const lastWeight = lastSets[0].weight_kg;
    const allCompleted = lastSets.every(s => s.completed);
    const failedCount = lastSets.filter(s => !s.completed).length;

    let suggestedWeight = lastWeight;
    let reason = '';
    if (allCompleted && lastWeight > 0) { suggestedWeight = lastWeight + 2.5; reason = 'Kaikki sarjat onnistui - nosta painoa!'; }
    else if (failedCount >= 2) { suggestedWeight = Math.max(0, lastWeight - 2.5); reason = 'Useampi sarja jäi vajaaksi - kevennä hieman'; }
    else { reason = 'Pidä sama paino kunnes kaikki sarjat onnistuu'; }

    res.json({
      suggestion: suggestedWeight, lastWeight, reason, lastDate,
      lastSets: lastSets.map(s => ({ setNum: s.set_num, weight: s.weight_kg, reps: s.reps, completed: s.completed }))
    });
  } catch (err) {
    console.error('Weight suggestion error:', err);
    res.status(500).json({ error: 'Failed to get weight suggestion' });
  }
});

router.get('/exercise-history/:userId/:exerciseName', (req, res) => {
  try {
    const exerciseName = decodeURIComponent(req.params.exerciseName);
    const history = all(
      `SELECT sl.weight_kg, sl.reps, ws.date, sl.set_num, sl.completed
       FROM set_logs sl JOIN workout_sessions ws ON sl.session_id = ws.id
       WHERE ws.user_id = ? AND sl.exercise_name = ?
       ORDER BY ws.date DESC LIMIT 100`,
      [req.params.userId, exerciseName]
    );
    const byDate = {};
    for (const row of history) {
      if (!byDate[row.date]) byDate[row.date] = { date: row.date, maxWeight: 0, totalVolume: 0, sets: [] };
      if (row.weight_kg > byDate[row.date].maxWeight) byDate[row.date].maxWeight = row.weight_kg;
      byDate[row.date].totalVolume += (row.weight_kg || 0) * (row.reps || 0);
      byDate[row.date].sets.push(row);
    }
    res.json(Object.values(byDate).slice(0, 10).reverse());
  } catch (err) {
    console.error('Exercise history error:', err);
    res.status(500).json({ error: 'Failed to get exercise history' });
  }
});

router.get('/missed/:userId', (req, res) => {
  try {
    const { programStart, weekdays } = req.query;
    if (!programStart || !weekdays) return res.json({ missedCount: 0 });
    const wdays = weekdays.split(',').map(Number);
    const startDate = new Date(programStart);
    const today = new Date();
    let missed = 0, consecutive = 0, maxConsecutive = 0;
    const d = new Date(startDate);
    while (d <= today) {
      if (wdays.includes(d.getDay())) {
        const dateStr = d.toISOString().split('T')[0];
        const session = all('SELECT id FROM workout_sessions WHERE user_id = ? AND date = ?', [req.params.userId, dateStr]);
        if (session.length === 0 && dateStr < today.toISOString().split('T')[0]) {
          missed++; consecutive++; maxConsecutive = Math.max(maxConsecutive, consecutive);
        } else { consecutive = 0; }
      }
      d.setDate(d.getDate() + 1);
    }
    res.json({ missedCount: missed, consecutiveMissed: maxConsecutive });
  } catch (err) {
    console.error('Missed workouts error:', err);
    res.status(500).json({ error: 'Failed to check missed workouts' });
  }
});

module.exports = router;
