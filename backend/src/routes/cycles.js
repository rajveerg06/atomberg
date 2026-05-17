const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM goal_cycles ORDER BY year DESC').all());
});

router.get('/active', authenticate, (req, res) => {
  const db = getDb();
  const cycle = db.prepare('SELECT * FROM goal_cycles WHERE is_active = 1 LIMIT 1').get();
  if (!cycle) return res.status(404).json({ error: 'No active cycle found' });
  res.json(cycle);
});

router.post('/', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const { name, year, goal_setting_deadline, q1_start, q1_end, q2_start, q2_end, q3_start, q3_end, q4_start, q4_end } = req.body;
  if (!name || !year || !goal_setting_deadline) return res.status(400).json({ error: 'name, year, goal_setting_deadline required' });
  
  const id = uuidv4();
  db.prepare(`
    INSERT INTO goal_cycles (id, name, year, goal_setting_deadline, q1_start, q1_end, q2_start, q2_end, q3_start, q3_end, q4_start, q4_end, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, year, goal_setting_deadline, q1_start, q1_end, q2_start, q2_end, q3_start, q3_end, q4_start, q4_end, req.user.id);
  
  res.status(201).json({ id, message: 'Goal cycle created' });
});

router.put('/:id', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const { is_active, goal_setting_deadline } = req.body;
  if (is_active) db.prepare('UPDATE goal_cycles SET is_active = 0').run();
  db.prepare('UPDATE goal_cycles SET is_active = COALESCE(?, is_active), goal_setting_deadline = COALESCE(?, goal_setting_deadline) WHERE id = ?').run(is_active, goal_setting_deadline, req.params.id);
  res.json({ message: 'Cycle updated' });
});

module.exports = router;
