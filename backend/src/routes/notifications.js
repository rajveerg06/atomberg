const express = require('express');
const { getDb } = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { unread_only, limit = 20 } = req.query;
  let query = 'SELECT * FROM notifications WHERE user_id = ?';
  const params = [req.user.id];
  if (unread_only === 'true') { query += ' AND is_read = 0'; }
  query += ` ORDER BY created_at DESC LIMIT ${parseInt(limit)}`;
  res.json(db.prepare(query).all(...params));
});

router.get('/unread-count', authenticate, (req, res) => {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id);
  res.json({ count: result.count });
});

router.put('/:id/read', authenticate, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Marked as read' });
});

router.put('/read-all', authenticate, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ message: 'All marked as read' });
});

module.exports = router;
