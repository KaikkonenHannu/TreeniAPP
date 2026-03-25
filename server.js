require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://i.ytimg.com", "https://*.ytimg.com"],
      frameSrc: ["'self'", "https://www.youtube.com"],
      connectSrc: ["'self'"]
    }
  }
}));

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Rate limiting for AI endpoints: 20 requests per hour per IP
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Liian monta AI-pyyntöä. Yritä tunnin kuluttua.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip
});

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', generalLimiter);
app.use('/api/ai/', aiLimiter);

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/programs', require('./routes/programs'));
app.use('/api/workouts', require('./routes/workouts'));
app.use('/api/sleep', require('./routes/sleep'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/push', require('./routes/push'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database then start server
const { initDb } = require('./database');
initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TreeniAI server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
