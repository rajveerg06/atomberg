-- Goal Setting & Tracking Portal - Database Schema
-- SQLite compatible (production: PostgreSQL)

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- =============================================
-- USERS & ROLES
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('employee','manager','admin')),
  department TEXT NOT NULL,
  manager_id TEXT REFERENCES users(id),
  employee_id TEXT UNIQUE,
  is_active INTEGER DEFAULT 1,
  avatar_color TEXT DEFAULT '#6366f1',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- =============================================
-- GOAL CYCLES
-- =============================================
CREATE TABLE IF NOT EXISTS goal_cycles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  goal_setting_deadline TEXT NOT NULL,
  q1_start TEXT, q1_end TEXT,
  q2_start TEXT, q2_end TEXT,
  q3_start TEXT, q3_end TEXT,
  q4_start TEXT, q4_end TEXT,
  is_active INTEGER DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- =============================================
-- THRUST AREAS
-- =============================================
CREATE TABLE IF NOT EXISTS thrust_areas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- =============================================
-- GOALS
-- =============================================
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL REFERENCES goal_cycles(id),
  employee_id TEXT NOT NULL REFERENCES users(id),
  thrust_area_id TEXT NOT NULL REFERENCES thrust_areas(id),
  title TEXT NOT NULL,
  description TEXT,
  uom_type TEXT NOT NULL CHECK(uom_type IN ('numeric','percentage','timeline','zero')),
  min_max TEXT NOT NULL CHECK(min_max IN ('min','max')) DEFAULT 'max',
  target_value REAL,
  target_date TEXT,
  weightage REAL NOT NULL CHECK(weightage >= 10 AND weightage <= 100),
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected','locked')),
  is_shared INTEGER DEFAULT 0,
  shared_from_id TEXT REFERENCES goals(id),
  primary_owner_id TEXT REFERENCES users(id),
  manager_comment TEXT,
  rejection_reason TEXT,
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  locked_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- =============================================
-- SHARED GOAL RECIPIENTS
-- =============================================
CREATE TABLE IF NOT EXISTS shared_goal_recipients (
  id TEXT PRIMARY KEY,
  parent_goal_id TEXT NOT NULL REFERENCES goals(id),
  recipient_goal_id TEXT NOT NULL REFERENCES goals(id),
  recipient_id TEXT NOT NULL REFERENCES users(id),
  weightage REAL NOT NULL CHECK(weightage >= 10 AND weightage <= 100),
  created_at TEXT DEFAULT (datetime('now'))
);

-- =============================================
-- QUARTERLY ACHIEVEMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS quarterly_achievements (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id),
  quarter TEXT NOT NULL CHECK(quarter IN ('Q1','Q2','Q3','Q4')),
  actual_value REAL,
  actual_date TEXT,
  status TEXT DEFAULT 'not_started' CHECK(status IN ('not_started','on_track','completed','delayed')),
  progress_score REAL,
  employee_notes TEXT,
  submitted_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(goal_id, quarter)
);

-- =============================================
-- MANAGER CHECK-INS
-- =============================================
CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id),
  manager_id TEXT NOT NULL REFERENCES users(id),
  employee_id TEXT NOT NULL REFERENCES users(id),
  quarter TEXT NOT NULL CHECK(quarter IN ('Q1','Q2','Q3','Q4')),
  comment TEXT NOT NULL,
  rating TEXT CHECK(rating IN ('excellent','good','satisfactory','needs_improvement')),
  completed_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- =============================================
-- AUDIT TRAIL
-- =============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- =============================================
-- ESCALATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS escalations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('goal_not_submitted','approval_overdue','checkin_overdue')),
  employee_id TEXT NOT NULL REFERENCES users(id),
  manager_id TEXT REFERENCES users(id),
  cycle_id TEXT NOT NULL REFERENCES goal_cycles(id),
  days_overdue INTEGER,
  notified_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT,
  is_resolved INTEGER DEFAULT 0
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_goals_employee ON goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_goals_cycle ON goals(cycle_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_achievements_goal ON quarterly_achievements(goal_id);
CREATE INDEX IF NOT EXISTS idx_checkins_employee ON checkins(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
