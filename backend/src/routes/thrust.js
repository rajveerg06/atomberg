const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM thrust_areas WHERE is_active = 1 ORDER BY name').all());
});

router.post('/', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const { name, description, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const id = uuidv4();
  db.prepare('INSERT INTO thrust_areas (id, name, description, color) VALUES (?, ?, ?, ?)').run(id, name, description || null, color || '#6366f1');
  res.status(201).json({ id, name });
});

router.put('/:id', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const { name, description, color, is_active } = req.body;
  db.prepare('UPDATE thrust_areas SET name = COALESCE(?, name), description = COALESCE(?, description), color = COALESCE(?, color), is_active = COALESCE(?, is_active) WHERE id = ?').run(name, description, color, is_active, req.params.id);
  res.json({ message: 'Thrust area updated' });
});

module.exports = router;
