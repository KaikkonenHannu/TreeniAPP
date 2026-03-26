const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'treeni.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let db = null;

// Auto-save to disk periodically and on changes
let saveTimeout = null;
function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (db) {
      const data = db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    }
  }, 1000);
}

async function initDb() {
  const SQL = await initSqlJs();
  try {
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }
  } catch(e) {
    console.error('Failed to load existing DB, creating new:', e.message);
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT UNIQUE NOT NULL,
    name TEXT,
    pin_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Add columns if upgrading from older schema
  try { db.run('ALTER TABLE users ADD COLUMN name TEXT'); } catch(e) {}
  try { db.run('ALTER TABLE users ADD COLUMN pin_hash TEXT'); } catch(e) {}

  db.run(`CREATE TABLE IF NOT EXISTS programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    start_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS workout_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    week_index INTEGER,
    day_index INTEGER,
    day_title TEXT,
    focus TEXT,
    duration_mins INTEGER,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS set_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    exercise_name TEXT NOT NULL,
    set_num INTEGER NOT NULL,
    weight_kg REAL,
    reps INTEGER,
    completed INTEGER DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES workout_sessions(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sleep_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    bedtime TEXT,
    wake_time TEXT,
    hours REAL,
    quality INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subscription TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exercise_prs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    exercise_name TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    reps INTEGER NOT NULL,
    achieved_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_set_logs_session ON set_logs(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_set_logs_exercise ON set_logs(exercise_name)',
    'CREATE INDEX IF NOT EXISTS idx_workout_sessions_user ON workout_sessions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_sleep_logs_user_date ON sleep_logs(user_id, date)',
    'CREATE INDEX IF NOT EXISTS idx_exercise_prs_user ON exercise_prs(user_id, exercise_name)'
  ];
  indexes.forEach(sql => db.run(sql));

  scheduleSave();
  console.log('Database initialized');
  return db;
}

// Helper: run query and return rows as objects
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  scheduleSave();
  return { lastId: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] };
}

// Save to disk before exit
process.on('SIGINT', () => {
  if (db) { fs.writeFileSync(DB_PATH, Buffer.from(db.export())); }
  process.exit();
});
process.on('SIGTERM', () => {
  if (db) { fs.writeFileSync(DB_PATH, Buffer.from(db.export())); }
  process.exit();
});

module.exports = { initDb, all, get, run, getDb: () => db };
