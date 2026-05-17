const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT id, name, email, role, department, manager_id, employee_id, avatar_color FROM users WHERE id = ? AND is_active = 1').get(decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found or inactive' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}` });
    }
    next();
  };
}

function auditLog(action, entityType) {
  return (req, res, next) => {
    const origJson = res.json.bind(res);
    res.json = function(data) {
      if (res.statusCode < 400 && req.user) {
        const db = getDb();
        const { v4: uuidv4 } = require('uuid');
        try {
          db.prepare(`
            INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_values, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            uuidv4(),
            req.user.id,
            action,
            entityType,
            data?.id || req.params.id || 'unknown',
            JSON.stringify(req.body || {}),
            req.ip
          );
        } catch (e) { /* non-blocking */ }
      }
      return origJson(data);
    };
    next();
  };
}

module.exports = { authenticate, authorize, auditLog };
