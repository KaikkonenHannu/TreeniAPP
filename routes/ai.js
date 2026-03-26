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

// Exercise info - combines ExerciseDB (GIF) + Wger (text instructions)
router.get('/exercise-info', async (req, res) => {
  const exerciseName = req.query.name || '';
  let gifUrl = '';
  let description = '';
  let muscles = '';
  let musclesSecondary = '';
  let target = '';
  let secondaryMuscles = [];

  // 1. Try ExerciseDB for GIF animation
  const exerciseDbKey = process.env.EXERCISEDB_API_KEY;
  if (exerciseDbKey) {
    try {
      const searchName = exerciseName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      const response = await fetch(`https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(searchName)}?limit=5`, {
        headers: {
          'X-RapidAPI-Key': exerciseDbKey,
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
        }
      });
      const exercises = await response.json();
      if (Array.isArray(exercises) && exercises.length > 0) {
        const ex = exercises[0];
        gifUrl = ex.gifUrl || '';
        target = ex.target || '';
        secondaryMuscles = ex.secondaryMuscles || [];
        muscles = target;
        musclesSecondary = secondaryMuscles.join(', ');
      }
    } catch (err) {
      console.error('ExerciseDB error:', err.message);
    }
  }

  // 2. Try Wger for text description (always, as fallback for muscles too)
  try {
    const q = encodeURIComponent(exerciseName);
    const wgerRes = await fetch(`https://wger.de/api/v2/exercise/search/?term=${q}&language=english&format=json`);
    const wgerData = await wgerRes.json();

    if (wgerData.suggestions && wgerData.suggestions.length > 0) {
      const exercise = wgerData.suggestions[0].data;
      const infoRes = await fetch(`https://wger.de/api/v2/exerciseinfo/${exercise.id}/?format=json`);
      const info = await infoRes.json();

      const enTranslation = info.translations ? info.translations.find(t => t.language === 2) : null;
      if (enTranslation && enTranslation.description) {
        description = enTranslation.description.replace(/<[^>]*>/g, '');
      }

      // Use Wger muscles if ExerciseDB didn't provide them
      if (!muscles) {
        muscles = (info.muscles || []).map(m => m.name_en || m.name).join(', ');
        musclesSecondary = (info.muscles_secondary || []).map(m => m.name_en || m.name).join(', ');
      }

      // Use Wger images if no ExerciseDB GIF
      if (!gifUrl && info.images && info.images.length > 0) {
        gifUrl = info.images[0].image;
      }
    }
  } catch (err) {
    console.error('Wger API error:', err.message);
  }

  res.json({
    name: exerciseName,
    description,
    muscles,
    musclesSecondary,
    gifUrl,
    category: target || ''
  });
});

module.exports = router;
