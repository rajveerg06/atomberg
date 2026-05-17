const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/checkins
router.get('/', authenticate, authorize('manager', 'admin'), (req, res) => {
  const db = getDb();
  const { employee_id, quarter } = req.query;
  let query = `
    SELECT c.*, m.name as manager_name, e.name as employee_name, g.title as goal_title
    FROM checkins c
    JOIN users m ON c.manager_id = m.id
    JOIN users e ON c.employee_id = e.id
    JOIN goals g ON c.goal_id = g.id
    WHERE 1=1
  `;
  const params = [];
  if (req.user.role === 'manager') { query += ' AND c.manager_id = ?'; params.push(req.user.id); }
  if (employee_id) { query += ' AND c.employee_id = ?'; params.push(employee_id); }
  if (quarter) { query += ' AND c.quarter = ?'; params.push(quarter); }
  query += ' ORDER BY c.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

// POST /api/checkins - Manager adds check-in comment
router.post('/', authenticate, authorize('manager', 'admin'), (req, res) => {
  const db = getDb();
  const { goal_id, employee_id, quarter, comment, rating } = req.body;
  if (!goal_id || !employee_id || !quarter || !comment) {
    return res.status(400).json({ error: 'goal_id, employee_id, quarter, and comment are required' });
  }
  
  const id = uuidv4();
  db.prepare(`
    INSERT INTO checkins (id, goal_id, manager_id, employee_id, quarter, comment, rating)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, goal_id, req.user.id, employee_id, quarter, comment, rating || null);
  
  // Notify employee
  db.prepare('INSERT INTO notifications (id, user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)').run(
    uuidv4(), employee_id, 'checkin', '💬 Manager Check-in Received',
    `Your manager has added a ${quarter} check-in comment on your goal.`, `/goals/${goal_id}`
  );
  
  res.status(201).json({ id, message: 'Check-in recorded' });
});

// POST /api/checkins/bulk - Bulk mark check-in complete
router.post('/bulk', authenticate, authorize('manager', 'admin'), (req, res) => {
  const db = getDb();
  const { employee_ids, quarter, comment } = req.body;
  if (!employee_ids || !quarter) return res.status(400).json({ error: 'employee_ids and quarter required' });
  
  const results = [];
  employee_ids.forEach(empId => {
    const goals = db.prepare(`
      SELECT g.id FROM goals g JOIN users u ON g.employee_id = u.id
      WHERE g.employee_id = ? AND u.manager_id = ? AND g.status IN ('approved', 'locked')
    `).all(empId, req.user.id);
    
    goals.forEach(g => {
      const id = uuidv4();
      db.prepare('INSERT INTO checkins (id, goal_id, manager_id, employee_id, quarter, comment) VALUES (?, ?, ?, ?, ?, ?)').run(id, g.id, req.user.id, empId, quarter, comment || `${quarter} check-in completed`);
    });
    results.push(empId);
  });
  
  res.json({ message: `Check-in completed for ${results.length} employees`, employees: results });
});

module.exports = router;
