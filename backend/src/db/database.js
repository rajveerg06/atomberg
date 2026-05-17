const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = process.env.DB_PATH || './data/goaltrack.db';
const dataDir = path.dirname(DB_PATH);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const database = getDb();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  database.exec(schema);
  console.log('✅ Database schema initialized');
  seedData(database);
  return database;
}

function seedData(database) {
  const existingUsers = database.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existingUsers.count > 0) {
    console.log('📊 Database already seeded, skipping...');
    return;
  }

  console.log('🌱 Seeding initial data...');

  // Seed users
  const adminId = uuidv4();
  const managerId1 = uuidv4();
  const managerId2 = uuidv4();
  const emp1Id = uuidv4();
  const emp2Id = uuidv4();
  const emp3Id = uuidv4();
  const emp4Id = uuidv4();

  const insertUser = database.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, department, manager_id, employee_id, avatar_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const adminPassword = bcrypt.hashSync('admin123', 10);
  const managerPassword = bcrypt.hashSync('manager123', 10);
  const empPassword = bcrypt.hashSync('emp123', 10);

  const seedUsers = database.transaction(() => {
    insertUser.run(adminId, 'Sarah Admin', 'admin@atomberg.com', adminPassword, 'admin', 'HR', null, 'EMP001', '#8b5cf6');
    insertUser.run(managerId1, 'Raj Patel', 'raj.patel@atomberg.com', managerPassword, 'manager', 'Engineering', adminId, 'EMP002', '#06b6d4');
    insertUser.run(managerId2, 'Priya Singh', 'priya.singh@atomberg.com', managerPassword, 'manager', 'Sales', adminId, 'EMP003', '#f59e0b');
    insertUser.run(emp1Id, 'Arjun Kumar', 'arjun.kumar@atomberg.com', empPassword, 'employee', 'Engineering', managerId1, 'EMP004', '#10b981');
    insertUser.run(emp2Id, 'Neha Sharma', 'neha.sharma@atomberg.com', empPassword, 'employee', 'Engineering', managerId1, 'EMP005', '#ef4444');
    insertUser.run(emp3Id, 'Vikram Mehta', 'vikram.mehta@atomberg.com', empPassword, 'employee', 'Sales', managerId2, 'EMP006', '#f97316');
    insertUser.run(emp4Id, 'Kavya Reddy', 'kavya.reddy@atomberg.com', empPassword, 'employee', 'Sales', managerId2, 'EMP007', '#ec4899');
  });
  seedUsers();

  // Seed thrust areas
  const insertThrust = database.prepare(`
    INSERT INTO thrust_areas (id, name, description, color)
    VALUES (?, ?, ?, ?)
  `);

  const thrustAreas = [
    [uuidv4(), 'Revenue Growth', 'Initiatives to drive revenue and sales targets', '#10b981'],
    [uuidv4(), 'Product Innovation', 'R&D, new product development, feature launches', '#6366f1'],
    [uuidv4(), 'Customer Experience', 'NPS, customer satisfaction, support quality', '#f59e0b'],
    [uuidv4(), 'Operational Excellence', 'Process improvement, efficiency, cost reduction', '#06b6d4'],
    [uuidv4(), 'People & Culture', 'Team development, hiring, engagement', '#ec4899'],
    [uuidv4(), 'Digital Transformation', 'Technology adoption, automation, analytics', '#8b5cf6'],
    [uuidv4(), 'Market Expansion', 'New geographies, partnerships, channels', '#ef4444'],
    [uuidv4(), 'Sustainability', 'ESG, energy efficiency, social responsibility', '#84cc16'],
  ];

  const seedThrust = database.transaction(() => {
    thrustAreas.forEach(t => insertThrust.run(...t));
  });
  seedThrust();

  // Seed active goal cycle
  const cycleId = uuidv4();
  database.prepare(`
    INSERT INTO goal_cycles (id, name, year, goal_setting_deadline, q1_start, q1_end, q2_start, q2_end, q3_start, q3_end, q4_start, q4_end, is_active, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(cycleId, 'FY 2025-26', 2025, '2025-05-01', '2025-05-01', '2025-07-31', '2025-08-01', '2025-10-31', '2025-11-01', '2026-01-31', '2026-02-01', '2026-04-30', 1, adminId);

  // Seed some demo goals for arjun
  const thrustRows = database.prepare('SELECT id FROM thrust_areas LIMIT 3').all();
  if (thrustRows.length >= 3) {
    const g1 = uuidv4(), g2 = uuidv4(), g3 = uuidv4();
    const insertGoal = database.prepare(`
      INSERT INTO goals (id, cycle_id, employee_id, thrust_area_id, title, description, uom_type, min_max, target_value, weightage, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedGoals = database.transaction(() => {
      insertGoal.run(g1, cycleId, emp1Id, thrustRows[0].id, 'Achieve Q1 Revenue Target', 'Drive engineering contributions to hit ₹50L revenue', 'numeric', 'max', 5000000, 40, 'approved');
      insertGoal.run(g2, cycleId, emp1Id, thrustRows[1].id, 'Ship 3 Product Features', 'Design and deliver 3 high-impact product features', 'numeric', 'max', 3, 35, 'approved');
      insertGoal.run(g3, cycleId, emp1Id, thrustRows[2].id, 'Customer NPS > 75', 'Improve customer satisfaction score', 'numeric', 'max', 75, 25, 'submitted');

      // Lock the approved ones
      database.prepare('UPDATE goals SET locked_at = datetime("now"), approved_by = ?, approved_at = datetime("now") WHERE id IN (?, ?)').run(managerId1, g1, g2);

      // Add quarterly achievements for demo
      const insertAchievement = database.prepare(`
        INSERT INTO quarterly_achievements (id, goal_id, quarter, actual_value, status, progress_score, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `);
      insertAchievement.run(uuidv4(), g1, 'Q1', 3200000, 'on_track', 64);
      insertAchievement.run(uuidv4(), g2, 'Q1', 2, 'on_track', 67);
    });
    seedGoals();
  }

  console.log('✅ Seed data created successfully');
  console.log('\n📋 Demo Credentials:');
  console.log('  Admin:   admin@atomberg.com   / admin123');
  console.log('  Manager: raj.patel@atomberg.com / manager123');
  console.log('  Manager: priya.singh@atomberg.com / manager123');
  console.log('  Employee: arjun.kumar@atomberg.com / emp123');
  console.log('  Employee: neha.sharma@atomberg.com / emp123');
}

module.exports = { getDb, initDb };
