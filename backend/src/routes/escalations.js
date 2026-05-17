const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/escalations
router.get('/', authenticate, authorize('admin', 'manager'), (req, res) => {
  const db = getDb();
  const escalations = db.prepare(`
    SELECT e.*, u.name as employee_name, u.email as employee_email, u.department,
           m.name as manager_name, gc.name as cycle_name
    FROM escalations e
    JOIN users u ON e.employee_id = u.id
    LEFT JOIN users m ON e.manager_id = m.id
    JOIN goal_cycles gc ON e.cycle_id = gc.id
    WHERE e.is_resolved = 0
    ORDER BY e.notified_at DESC
  `).all();
  res.json(escalations);
});

// POST /api/escalations/check - Trigger escalation check
router.post('/check', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const cycleId = db.prepare("SELECT id FROM goal_cycles WHERE is_active = 1 LIMIT 1").get()?.id;
  if (!cycleId) return res.status(404).json({ error: 'No active cycle' });
  
  const cycle = db.prepare('SELECT * FROM goal_cycles WHERE id = ?').get(cycleId);
  const now = new Date();
  const deadline = new Date(cycle.goal_setting_deadline);
  const daysPast = Math.floor((now - deadline) / (1000 * 60 * 60 * 24));
  
  // Find employees with no goals submitted
  const noGoalEmployees = db.prepare(`
    SELECT u.id, u.manager_id FROM users u
    LEFT JOIN goals g ON g.employee_id = u.id AND g.cycle_id = ? AND g.status IN ('submitted','approved','locked')
    WHERE u.role = 'employee' AND u.is_active = 1 AND g.id IS NULL
  `).all(cycleId);
  
  let escalationsCreated = 0;
  noGoalEmployees.forEach(emp => {
    const existing = db.prepare('SELECT id FROM escalations WHERE employee_id = ? AND cycle_id = ? AND type = ?').get(emp.id, cycleId, 'goal_not_submitted');
    if (!existing) {
      db.prepare('INSERT INTO escalations (id, type, employee_id, manager_id, cycle_id, days_overdue) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), 'goal_not_submitted', emp.id, emp.manager_id, cycleId, daysPast);
      escalationsCreated++;
    }
  });
  
  res.json({ message: `Escalation check complete. ${escalationsCreated} new escalations created.`, escalationsCreated });
});

// PUT /api/escalations/:id/resolve
router.put('/:id/resolve', authenticate, authorize('admin', 'manager'), (req, res) => {
  const db = getDb();
  db.prepare("UPDATE escalations SET is_resolved = 1, resolved_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ message: 'Escalation resolved' });
});

module.exports = router;
