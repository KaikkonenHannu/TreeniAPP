const express = require('express');
const router = express.Router();
const { all, get } = require('../database');

router.get('/prs/:userId', (req, res) => {
  try {
    const prs = all('SELECT exercise_name, MAX(weight_kg) as max_weight, reps, achieved_at FROM exercise_prs WHERE user_id = ? GROUP BY exercise_name ORDER BY exercise_name', [req.params.userId]);
    res.json(prs);
  } catch (err) {
    console.error('Get PRs error:', err);
    res.status(500).json({ error: 'Failed to get PRs' });
  }
});

router.get('/weekly-volume/:userId', (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end dates required' });
    const data = all(
      `SELECT sl.exercise_name, SUM(sl.weight_kg * sl.reps) as volume, SUM(sl.reps) as total_reps, COUNT(DISTINCT ws.id) as sessions
       FROM set_logs sl JOIN workout_sessions ws ON sl.session_id = ws.id
       WHERE ws.user_id = ? AND ws.date BETWEEN ? AND ? GROUP BY sl.exercise_name`,
      [req.params.userId, start, end]
    );
    res.json(data);
  } catch (err) {
    console.error('Weekly volume error:', err);
    res.status(500).json({ error: 'Failed to get weekly volume' });
  }
});

router.get('/overview/:userId', (req, res) => {
  try {
    const userId = req.params.userId;
    const total = get('SELECT COUNT(*) as total_sessions, SUM(duration_mins) as total_minutes FROM workout_sessions WHERE user_id = ?', [userId]);
    const prs = all('SELECT exercise_name, MAX(weight_kg) as max_weight, reps, achieved_at FROM exercise_prs WHERE user_id = ? GROUP BY exercise_name ORDER BY exercise_name', [userId]);
    const firstSession = get('SELECT * FROM workout_sessions WHERE user_id = ? ORDER BY date ASC LIMIT 1', [userId]);

    let strengthImprovement = null;
    if (firstSession) {
      const firstSets = all('SELECT * FROM set_logs WHERE session_id = ?', [firstSession.id]);
      if (firstSets.length && prs.length) {
        const improvements = [];
        for (const pr of prs) {
          const firstSet = firstSets.find(s => s.exercise_name === pr.exercise_name && s.weight_kg > 0);
          if (firstSet && pr.max_weight > firstSet.weight_kg) {
            improvements.push({
              exercise: pr.exercise_name,
              startWeight: firstSet.weight_kg,
              currentWeight: pr.max_weight,
              improvement: Math.round(((pr.max_weight - firstSet.weight_kg) / firstSet.weight_kg) * 100)
            });
          }
        }
        if (improvements.length) {
          strengthImprovement = {
            avgPercent: Math.round(improvements.reduce((sum, i) => sum + i.improvement, 0) / improvements.length),
            exercises: improvements
          };
        }
      }
    }

    res.json({
      totalSessions: total?.total_sessions || 0,
      totalMinutes: total?.total_minutes || 0,
      prs,
      strengthImprovement,
      startDate: firstSession?.date || null
    });
  } catch (err) {
    console.error('Overview stats error:', err);
    res.status(500).json({ error: 'Failed to get overview stats' });
  }
});

module.exports = router;
