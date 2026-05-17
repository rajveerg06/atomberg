const express = require('express');
const { getDb } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/audit - Audit trail (admin/HR only)
router.get('/', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const { entity_type, entity_id, user_id, from_date, to_date, limit = 100 } = req.query;
  
  let query = `
    SELECT al.*, u.name as user_name, u.email as user_email, u.role as user_role
    FROM audit_logs al
    JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  
  if (entity_type) { query += ' AND al.entity_type = ?'; params.push(entity_type); }
  if (entity_id) { query += ' AND al.entity_id = ?'; params.push(entity_id); }
  if (user_id) { query += ' AND al.user_id = ?'; params.push(user_id); }
  if (from_date) { query += ' AND al.created_at >= ?'; params.push(from_date); }
  if (to_date) { query += ' AND al.created_at <= ?'; params.push(to_date); }
  
  query += ` ORDER BY al.created_at DESC LIMIT ${parseInt(limit)}`;
  
  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

// GET /api/audit/export - Export audit log as CSV
router.get('/export', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const logs = db.prepare(`
    SELECT al.created_at, u.name, u.email, u.role, al.action, al.entity_type, al.entity_id, al.new_values, al.ip_address
    FROM audit_logs al JOIN users u ON al.user_id = u.id
    ORDER BY al.created_at DESC LIMIT 10000
  `).all();
  
  const headers = ['Timestamp','User Name','Email','Role','Action','Entity Type','Entity ID','Changes','IP Address'];
  const rows = logs.map(l => [l.created_at, l.name, l.email, l.role, l.action, l.entity_type, l.entity_id, l.new_values, l.ip_address]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v || ''}"`).join(',')).join('\n');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="audit_log.csv"');
  res.send(csv);
});

module.exports = router;
