const express = require('express');
const router = express.Router();

// AI proxy - Anthropic
router.post('/anthropic', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Anthropic API key not configured' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: req.body.model || 'claude-sonnet-4-20250514',
        max_tokens: req.body.max_tokens || 16000,
        messages: req.body.messages
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Anthropic API error:', err);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// AI proxy - OpenAI
router.post('/openai', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OpenAI API key not configured' });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: req.body.model || 'gpt-4o',
        max_tokens: req.body.max_tokens || 16000,
        messages: req.body.messages
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('OpenAI API error:', err);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// YouTube proxy
router.get('/youtube', async (req, res) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'YouTube API key not configured' });

  try {
    const q = encodeURIComponent(req.query.q || '');
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&videoDuration=short&maxResults=4&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('YouTube API error:', err);
    res.status(500).json({ error: 'YouTube search failed' });
  }
});

// Wger Exercise API - exercise instructions
router.get('/exercise-info', async (req, res) => {
  try {
    const q = encodeURIComponent(req.query.name || '');
    const response = await fetch(`https://wger.de/api/v2/exercise/search/?term=${q}&language=english&format=json`);
    const data = await response.json();

    if (data.suggestions && data.suggestions.length > 0) {
      const exercise = data.suggestions[0].data;
      // Fetch full exercise info with description
      const infoRes = await fetch(`https://wger.de/api/v2/exerciseinfo/${exercise.id}/?format=json`);
      const info = await infoRes.json();

      // Get English translation
      const enTranslation = info.translations ? info.translations.find(t => t.language === 2) : null;
      const description = enTranslation ? enTranslation.description : '';
      const name = enTranslation ? enTranslation.name : exercise.name;

      // Get muscle info
      const muscles = (info.muscles || []).map(m => m.name_en || m.name).join(', ');
      const musclesSecondary = (info.muscles_secondary || []).map(m => m.name_en || m.name).join(', ');

      // Get images
      const images = (info.images || []).map(img => img.image);

      res.json({
        name,
        description: description.replace(/<[^>]*>/g, ''), // strip HTML
        muscles,
        musclesSecondary,
        images,
        category: info.category ? info.category.name : ''
      });
    } else {
      res.json({ name: req.query.name, description: '', muscles: '', musclesSecondary: '', images: [], category: '' });
    }
  } catch (err) {
    console.error('Wger API error:', err);
    res.json({ name: req.query.name, description: '', muscles: '', musclesSecondary: '', images: [], category: '' });
  }
});

module.exports = router;
