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

// Finnish to English exercise name mapping
const exerciseTranslations = {
  'penkkipunnerrus': 'bench press', 'vinopenkki punnerrus': 'incline bench press', 'vinopenkki': 'incline bench press',
  'kapea penkkipunnerrus': 'close grip bench press', 'pystypunnerrus': 'overhead press', 'olkapääpunnerrus': 'shoulder press',
  'military press': 'military press', 'arnoldin punnerrus': 'arnold press',
  'kyykky': 'squat', 'takakyykky': 'barbell squat', 'etukyykky': 'front squat', 'goblet kyykky': 'goblet squat',
  'bulgarialainen kyykky': 'bulgarian split squat', 'hack kyykky': 'hack squat', 'smith kyykky': 'smith machine squat',
  'jalkaprässi': 'leg press', 'jalkapressi': 'leg press',
  'maastaveto': 'deadlift', 'suorajalkainen maastaveto': 'stiff leg deadlift', 'romanian maastaveto': 'romanian deadlift',
  'leuanveto': 'pull up', 'leuat': 'pull up', 'alatalja': 'seated cable row', 'ylätalja': 'lat pulldown',
  'soutu': 'barbell row', 'kulmasoutu': 'bent over row', 'penkkisoutu': 'dumbbell row', 't-soutu': 't bar row',
  'käsipainosoutu': 'dumbbell row', 'vipusoutu': 'cable row',
  'hauiskääntö': 'bicep curl', 'hauiscurl': 'bicep curl', 'vasarakääntö': 'hammer curl',
  'ojentajapunnerrus': 'tricep pushdown', 'ranskalainen punnerrus': 'skull crusher', 'dippi': 'dip', 'dipit': 'dips',
  'vipunosto eteen': 'front raise', 'vipunosto sivulle': 'lateral raise', 'sivuvipunosto': 'lateral raise',
  'peck deck': 'pec deck', 'ristikkäistaljavedot': 'cable crossover', 'ristitalja': 'cable crossover',
  'punnerrus': 'push up', 'etunojapunnerrus': 'push up',
  'vatsarutistus': 'crunch', 'istumaan nousu': 'sit up', 'lankku': 'plank',
  'askelkyykky': 'lunge', 'kävelevä askelkyykky': 'walking lunge',
  'pohjenostot': 'calf raise', 'pohjenosto': 'calf raise',
  'reiden ojennus': 'leg extension', 'jalkojen ojennus': 'leg extension',
  'reiden koukistus': 'leg curl', 'jalkojen koukistus': 'leg curl',
  'lantionnosto': 'hip thrust', 'hip thrust': 'hip thrust',
  'face pull': 'face pull', 'shrug': 'shrug', 'olankohautus': 'shrug',
  'chest press': 'chest press', 'pystysoutu': 'upright row',
  'pullover': 'pullover', 'cable fly': 'cable fly',
  'käsipainopunnerrus': 'dumbbell press', 'käsipainofly': 'dumbbell fly',
  'smith punnerrus': 'smith machine bench press',
  'lat pulldown': 'lat pulldown', 'leg press': 'leg press', 'leg curl': 'leg curl', 'leg extension': 'leg extension',
  'shoulder press': 'shoulder press', 'chest press kone': 'machine chest press',
  'reverse fly': 'reverse fly', 'takareisi': 'leg curl'
};

function translateExerciseName(name) {
  const lower = name.toLowerCase().trim();
  // Direct match
  if (exerciseTranslations[lower]) return exerciseTranslations[lower];
  // Partial match
  for (const [fi, en] of Object.entries(exerciseTranslations)) {
    if (lower.includes(fi) || fi.includes(lower)) return en;
  }
  // Already English? Return as-is
  return name;
}

// Exercise info - combines ExerciseDB (GIF) + Wger (text instructions)
router.get('/exercise-info', async (req, res) => {
  const exerciseName = req.query.name || '';
  const englishName = translateExerciseName(exerciseName);
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
      const searchName = englishName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      const exerciseDbUrl = `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(searchName)}?limit=5`;
      console.log('ExerciseDB search:', searchName, exerciseDbUrl);
      const response = await fetch(exerciseDbUrl, {
        headers: {
          'X-RapidAPI-Key': exerciseDbKey,
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
        }
      });
      const exercises = await response.json();
      console.log('ExerciseDB response:', response.status, Array.isArray(exercises) ? exercises.length + ' results' : JSON.stringify(exercises).substring(0, 200));
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
    const q = encodeURIComponent(englishName);
    const wgerRes = await fetch(`https://wger.de/api/v2/exercise/search/?term=${q}&language=english&format=json`);
    const wgerData = await wgerRes.json();

    if (wgerData.suggestions && wgerData.suggestions.length > 0) {
      const exercise = wgerData.suggestions[0].data;
      const baseId = exercise.base_id || exercise.id;
      const infoRes = await fetch(`https://wger.de/api/v2/exerciseinfo/${baseId}/?format=json`);
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
        const imgPath = info.images[0].image;
        gifUrl = imgPath.startsWith('http') ? imgPath : 'https://wger.de' + imgPath;
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

// Debug: test ExerciseDB directly
router.get('/exercise-debug', async (req, res) => {
  const exerciseDbKey = process.env.EXERCISEDB_API_KEY;
  if (!exerciseDbKey) return res.json({ error: 'EXERCISEDB_API_KEY not set', keyLength: 0 });

  const name = req.query.name || 'squat';
  try {
    const url = `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(name)}?limit=3`;
    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': exerciseDbKey,
        'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
      }
    });
    const data = await response.json();
    res.json({ status: response.status, keyPrefix: exerciseDbKey.substring(0, 8) + '...', resultCount: Array.isArray(data) ? data.length : 'not array', data: Array.isArray(data) ? data.slice(0, 2) : data });
  } catch(err) {
    res.json({ error: err.message });
  }
});

module.exports = router;
