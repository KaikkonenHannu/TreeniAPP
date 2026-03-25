const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const { all, get, run } = require('../database');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@treeni-ai.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

router.get('/vapid-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
});

router.post('/subscribe', (req, res) => {
  const { userId, subscription } = req.body;
  if (!userId || !subscription) return res.status(400).json({ error: 'userId and subscription required' });
  try {
    run('INSERT INTO push_subscriptions (user_id, subscription) VALUES (?, ?)', [userId, JSON.stringify(subscription)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

router.post('/send/:userId', async (req, res) => {
  const { title, body, icon } = req.body;
  if (!process.env.VAPID_PUBLIC_KEY) return res.status(500).json({ error: 'VAPID not configured' });
  try {
    const subs = all('SELECT * FROM push_subscriptions WHERE user_id = ?', [req.params.userId]);
    const payload = JSON.stringify({ title: title || 'TreeniAI', body: body || '', icon: icon || '/icon-192.png' });
    const results = await Promise.allSettled(
      subs.map(sub => webpush.sendNotification(JSON.parse(sub.subscription), payload).catch(err => {
        if (err.statusCode === 410) run('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
        throw err;
      }))
    );
    res.json({ sent: results.filter(r => r.status === 'fulfilled').length, total: subs.length });
  } catch (err) {
    console.error('Push send error:', err);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

router.post('/cron/notifications', async (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) return res.json({ skipped: true });
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers['x-cron-secret'] !== cronSecret) return res.status(401).json({ error: 'Invalid cron secret' });

  try {
    const now = new Date();
    const hour = now.getHours();
    const today = now.toISOString().split('T')[0];
    const allSubs = all('SELECT ps.*, ps.user_id as uid FROM push_subscriptions ps');
    let sent = 0;

    for (const sub of allSubs) {
      const subscription = JSON.parse(sub.subscription);
      if (hour === 7) {
        const todaySleep = get('SELECT id FROM sleep_logs WHERE user_id = ? AND date = ?', [sub.uid, today]);
        if (!todaySleep) {
          try {
            await webpush.sendNotification(subscription, JSON.stringify({ title: 'TreeniAI', body: 'Huomenta! Kirjaa viime yon uni.', icon: '/icon-192.png' }));
            sent++;
          } catch(e) { if (e.statusCode === 410) run('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]); }
        }
      }
      if (hour === 17) {
        const program = get('SELECT data FROM programs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [sub.uid]);
        if (program) {
          const progData = JSON.parse(program.data);
          if (progData.weekdays && progData.weekdays.includes(now.getDay())) {
            const todaySession = all('SELECT id FROM workout_sessions WHERE user_id = ? AND date = ?', [sub.uid, today]);
            if (!todaySession.length) {
              try {
                await webpush.sendNotification(subscription, JSON.stringify({ title: 'TreeniAI', body: 'Tanaan on treenipaiva! 💪', icon: '/icon-192.png' }));
                sent++;
              } catch(e) { if (e.statusCode === 410) run('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]); }
            }
          }
        }
      }
    }
    res.json({ sent, checked: allSubs.length });
  } catch (err) {
    console.error('Cron notification error:', err);
    res.status(500).json({ error: 'Cron failed' });
  }
});

module.exports = router;
