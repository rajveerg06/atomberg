const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/users - List users (admin/manager)
router.get('/', authenticate, authorize('admin', 'manager'), (req, res) => {
  const db = getDb();
  const { department, role } = req.query;
  
  let query = `
    SELECT u.id, u.name, u.email, u.role, u.department, u.employee_id, u.avatar_color, u.is_active,
           m.name as manager_name, m.email as manager_email
    FROM users u
    LEFT JOIN users m ON u.manager_id = m.id
    WHERE u.is_active = 1
  `;
  const params = [];
  
  // Managers can only see their team
  if (req.user.role === 'manager') {
    query += ' AND u.manager_id = ?';
    params.push(req.user.id);
  }
  if (department) { query += ' AND u.department = ?'; params.push(department); }
  if (role) { query += ' AND u.role = ?'; params.push(role); }
  
  query += ' ORDER BY u.name';
  res.json(db.prepare(query).all(...params));
});

// GET /api/users/team - Manager's team
router.get('/team', authenticate, authorize('manager', 'admin'), (req, res) => {
  const db = getDb();
  const managerId = req.user.role === 'admin' ? req.query.manager_id : req.user.id;
  
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department, u.employee_id, u.avatar_color,
           COUNT(g.id) as total_goals,
           SUM(CASE WHEN g.status = 'approved' OR g.status = 'locked' THEN 1 ELSE 0 END) as approved_goals,
           SUM(CASE WHEN g.status = 'submitted' THEN 1 ELSE 0 END) as pending_goals
    FROM users u
    LEFT JOIN goal_cycles gc ON gc.is_active = 1
    LEFT JOIN goals g ON g.employee_id = u.id AND g.cycle_id = gc.id
    WHERE u.manager_id = ? AND u.is_active = 1
    GROUP BY u.id
  `).all(managerId || req.user.id);
  
  res.json(users);
});

// GET /api/users/:id
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department, u.employee_id, u.avatar_color, u.created_at,
           m.name as manager_name, m.email as manager_email, m.id as manager_id
    FROM users u LEFT JOIN users m ON u.manager_id = m.id
    WHERE u.id = ?
  `).get(req.params.id);
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// POST /api/users - Create user (admin only)
router.post('/', authenticate, authorize('admin'), (req, res) => {
  const { name, email, password, role, department, manager_id, employee_id } = req.body;
  if (!name || !email || !password || !role || !department) {
    return res.status(400).json({ error: 'name, email, password, role, department are required' });
  }
  
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email already in use' });
  
  const id = uuidv4();
  const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#ec4899','#f97316'];
  const avatar_color = colors[Math.floor(Math.random() * colors.length)];
  
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, department, manager_id, employee_id, avatar_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, email.toLowerCase(), bcrypt.hashSync(password, 10), role, department, manager_id || null, employee_id || null, avatar_color);
  
  res.status(201).json({ id, name, email, role, department, employee_id, avatar_color });
});

// PUT /api/users/:id - Update user (admin only)
router.put('/:id', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const { name, email, role, department, manager_id, is_active } = req.body;
  
  db.prepare(`
    UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), role = COALESCE(?, role),
    department = COALESCE(?, department), manager_id = ?, is_active = COALESCE(?, is_active),
    updated_at = datetime('now')
    WHERE id = ?
  `).run(name, email, role, department, manager_id || null, is_active, req.params.id);
  
  res.json({ message: 'User updated successfully' });
});

// GET /api/users/departments/list
router.get('/departments/list', authenticate, (req, res) => {
  const db = getDb();
  const departments = db.prepare('SELECT DISTINCT department FROM users WHERE is_active = 1 ORDER BY department').all();
  res.json(departments.map(d => d.department));
});

module.exports = router;
