const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Helper: Calculate progress score based on UoM type
function calculateProgressScore(goal, actual) {
  if (actual === null || actual === undefined) return null;
  const { uom_type, min_max, target_value } = goal;
  
  if (uom_type === 'zero') return actual === 0 ? 100 : 0;
  if (uom_type === 'timeline') return actual <= target_value ? 100 : Math.max(0, 100 - (actual - target_value));
  if (uom_type === 'numeric' || uom_type === 'percentage') {
    if (min_max === 'max') return target_value > 0 ? Math.min(150, (actual / target_value) * 100) : 0;
    if (min_max === 'min') return actual > 0 ? Math.min(150, (target_value / actual) * 100) : (actual === 0 ? 100 : 0);
  }
  return null;
}

// Helper: Notify user
function notifyUser(db, userId, type, title, message, link) {
  try {
    db.prepare('INSERT INTO notifications (id, user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), userId, type, title, message, link || null);
  } catch(e) { /* non-blocking */ }
}

// GET /api/goals - Get goals for current user (or team for manager)
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { cycle_id, employee_id, status, quarter } = req.query;

  let query = `
    SELECT g.*, 
           u.name as employee_name, u.email as employee_email, u.department, u.avatar_color,
           t.name as thrust_area_name, t.color as thrust_area_color,
           gc.name as cycle_name, gc.year as cycle_year,
           approver.name as approved_by_name
    FROM goals g
    JOIN users u ON g.employee_id = u.id
    JOIN thrust_areas t ON g.thrust_area_id = t.id
    JOIN goal_cycles gc ON g.cycle_id = gc.id
    LEFT JOIN users approver ON g.approved_by = approver.id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role === 'employee') {
    query += ' AND g.employee_id = ?';
    params.push(req.user.id);
  } else if (req.user.role === 'manager') {
    if (employee_id) {
      query += ' AND g.employee_id = ?';
      params.push(employee_id);
    } else {
      query += ' AND u.manager_id = ?';
      params.push(req.user.id);
    }
  } else if (req.user.role === 'admin' && employee_id) {
    query += ' AND g.employee_id = ?';
    params.push(employee_id);
  }

  if (cycle_id) { query += ' AND g.cycle_id = ?'; params.push(cycle_id); }
  if (status) { query += ' AND g.status = ?'; params.push(status); }

  query += ' ORDER BY g.created_at DESC';
  
  const goals = db.prepare(query).all(...params);
  
  // Attach quarterly achievements
  const enriched = goals.map(goal => {
    const achievements = db.prepare('SELECT * FROM quarterly_achievements WHERE goal_id = ? ORDER BY quarter').all(goal.id);
    return { ...goal, achievements };
  });
  
  res.json(enriched);
});

// GET /api/goals/my - Current user's goals
router.get('/my', authenticate, (req, res) => {
  const db = getDb();
  const cycleId = req.query.cycle_id || db.prepare("SELECT id FROM goal_cycles WHERE is_active = 1 LIMIT 1").get()?.id;
  
  const goals = db.prepare(`
    SELECT g.*, t.name as thrust_area_name, t.color as thrust_area_color,
           gc.name as cycle_name, approver.name as approved_by_name
    FROM goals g
    JOIN thrust_areas t ON g.thrust_area_id = t.id
    JOIN goal_cycles gc ON g.cycle_id = gc.id
    LEFT JOIN users approver ON g.approved_by = approver.id
    WHERE g.employee_id = ? AND g.cycle_id = ?
    ORDER BY g.created_at DESC
  `).all(req.user.id, cycleId);
  
  const enriched = goals.map(goal => {
    const achievements = db.prepare('SELECT * FROM quarterly_achievements WHERE goal_id = ? ORDER BY quarter').all(goal.id);
    return { ...goal, achievements };
  });
  
  // Calculate totals
  const totalWeightage = goals.reduce((s, g) => s + g.weightage, 0);
  res.json({ goals: enriched, totalWeightage, goalCount: goals.length, cycleId });
});

// GET /api/goals/:id
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const goal = db.prepare(`
    SELECT g.*, u.name as employee_name, u.email as employee_email, u.department, u.avatar_color,
           t.name as thrust_area_name, t.color as thrust_area_color,
           gc.name as cycle_name, approver.name as approved_by_name
    FROM goals g
    JOIN users u ON g.employee_id = u.id
    JOIN thrust_areas t ON g.thrust_area_id = t.id
    JOIN goal_cycles gc ON g.cycle_id = gc.id
    LEFT JOIN users approver ON g.approved_by = approver.id
    WHERE g.id = ?
  `).get(req.params.id);
  
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  
  // Access check
  if (req.user.role === 'employee' && goal.employee_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const achievements = db.prepare('SELECT * FROM quarterly_achievements WHERE goal_id = ? ORDER BY quarter').all(goal.id);
  const checkins = db.prepare(`
    SELECT c.*, m.name as manager_name FROM checkins c 
    JOIN users m ON c.manager_id = m.id WHERE c.goal_id = ? ORDER BY c.created_at DESC
  `).all(goal.id);
  
  res.json({ ...goal, achievements, checkins });
});

// POST /api/goals - Create goal
router.post('/', authenticate, authorize('employee', 'manager', 'admin'), (req, res) => {
  const db = getDb();
  const { cycle_id, thrust_area_id, title, description, uom_type, min_max, target_value, target_date, weightage } = req.body;
  
  // Validation
  if (!cycle_id || !thrust_area_id || !title || !uom_type || !weightage) {
    return res.status(400).json({ error: 'cycle_id, thrust_area_id, title, uom_type, and weightage are required' });
  }
  if (weightage < 10) return res.status(400).json({ error: 'Minimum weightage per goal is 10%' });
  if (weightage > 100) return res.status(400).json({ error: 'Maximum weightage per goal is 100%' });
  
  const employeeId = req.user.role === 'employee' ? req.user.id : (req.body.employee_id || req.user.id);
  
  // Check goal count (max 8)
  const goalCount = db.prepare("SELECT COUNT(*) as count FROM goals WHERE employee_id = ? AND cycle_id = ? AND status != 'rejected'").get(employeeId, cycle_id);
  if (goalCount.count >= 8) return res.status(400).json({ error: 'Maximum 8 goals per employee per cycle' });
  
  // Check weightage doesn't exceed 100
  const currentWeight = db.prepare("SELECT COALESCE(SUM(weightage), 0) as total FROM goals WHERE employee_id = ? AND cycle_id = ? AND status != 'rejected'").get(employeeId, cycle_id);
  if (currentWeight.total + parseFloat(weightage) > 100) {
    return res.status(400).json({ error: `Total weightage cannot exceed 100%. Currently at ${currentWeight.total}%, adding ${weightage}% would exceed limit.` });
  }
  
  const id = uuidv4();
  db.prepare(`
    INSERT INTO goals (id, cycle_id, employee_id, thrust_area_id, title, description, uom_type, min_max, target_value, target_date, weightage, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
  `).run(id, cycle_id, employeeId, thrust_area_id, title, description || null, uom_type, min_max || 'max', target_value || null, target_date || null, parseFloat(weightage));
  
  res.status(201).json({ id, message: 'Goal created successfully' });
});

// PUT /api/goals/:id - Update goal
router.put('/:id', authenticate, (req, res) => {
  const db = getDb();
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(req.params.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  
  // Only allow editing draft/rejected goals unless manager/admin
  if (req.user.role === 'employee') {
    if (goal.employee_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    if (!['draft', 'rejected'].includes(goal.status)) return res.status(403).json({ error: 'Goal is locked and cannot be edited' });
  }
  
  const { thrust_area_id, title, description, uom_type, min_max, target_value, target_date, weightage } = req.body;
  
  if (weightage && weightage < 10) return res.status(400).json({ error: 'Minimum weightage is 10%' });
  
  if (weightage) {
    // Check total weightage
    const otherWeight = db.prepare("SELECT COALESCE(SUM(weightage), 0) as total FROM goals WHERE employee_id = ? AND cycle_id = ? AND id != ? AND status != 'rejected'").get(goal.employee_id, goal.cycle_id, goal.id);
    if (otherWeight.total + parseFloat(weightage) > 100) {
      return res.status(400).json({ error: `Total weightage would exceed 100%. Other goals use ${otherWeight.total}%.` });
    }
  }
  
  db.prepare(`
    UPDATE goals SET thrust_area_id = COALESCE(?, thrust_area_id), title = COALESCE(?, title),
    description = COALESCE(?, description), uom_type = COALESCE(?, uom_type), min_max = COALESCE(?, min_max),
    target_value = COALESCE(?, target_value), target_date = COALESCE(?, target_date),
    weightage = COALESCE(?, weightage), updated_at = datetime('now'), status = CASE WHEN status = 'rejected' THEN 'draft' ELSE status END
    WHERE id = ?
  `).run(thrust_area_id, title, description, uom_type, min_max, target_value, target_date, weightage ? parseFloat(weightage) : null, goal.id);
  
  res.json({ message: 'Goal updated successfully' });
});

// POST /api/goals/:id/submit - Submit goal sheet
router.post('/:id/submit', authenticate, authorize('employee'), (req, res) => {
  const db = getDb();
  const goal = db.prepare('SELECT * FROM goals WHERE id = ? AND employee_id = ?').get(req.params.id, req.user.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  if (goal.status !== 'draft') return res.status(400).json({ error: 'Only draft goals can be submitted' });
  
  db.prepare("UPDATE goals SET status = 'submitted', updated_at = datetime('now') WHERE id = ?").run(goal.id);
  
  // Notify manager
  const employee = db.prepare('SELECT manager_id FROM users WHERE id = ?').get(req.user.id);
  if (employee?.manager_id) {
    notifyUser(db, employee.manager_id, 'goal_submitted', 'Goal Submitted for Review', 
      `${req.user.name} has submitted a goal for your review: "${goal.title}"`, `/goals/${goal.id}`);
  }
  
  res.json({ message: 'Goal submitted for approval' });
});

// POST /api/goals/submit-all - Submit all draft goals
router.post('/submit-all', authenticate, authorize('employee'), (req, res) => {
  const db = getDb();
  const cycleId = req.body.cycle_id || db.prepare("SELECT id FROM goal_cycles WHERE is_active = 1 LIMIT 1").get()?.id;
  
  // Validate total weightage = 100
  const { total, count } = db.prepare(`
    SELECT COALESCE(SUM(weightage), 0) as total, COUNT(*) as count FROM goals 
    WHERE employee_id = ? AND cycle_id = ? AND status IN ('draft', 'rejected')
  `).get(req.user.id, cycleId);
  
  if (count === 0) return res.status(400).json({ error: 'No goals to submit' });
  if (Math.abs(total - 100) > 0.01) return res.status(400).json({ error: `Total weightage must equal 100%. Currently ${total}%` });
  
  db.prepare("UPDATE goals SET status = 'submitted', updated_at = datetime('now') WHERE employee_id = ? AND cycle_id = ? AND status IN ('draft', 'rejected')").run(req.user.id, cycleId);
  
  const employee = db.prepare('SELECT manager_id FROM users WHERE id = ?').get(req.user.id);
  if (employee?.manager_id) {
    notifyUser(db, employee.manager_id, 'goals_submitted', 'Goal Sheet Submitted', 
      `${req.user.name} has submitted their complete goal sheet (${count} goals) for your review.`, '/manager/team');
  }
  
  res.json({ message: `${count} goals submitted for approval`, count });
});

// POST /api/goals/:id/approve - Manager approves goal
router.post('/:id/approve', authenticate, authorize('manager', 'admin'), (req, res) => {
  const db = getDb();
  const goal = db.prepare(`
    SELECT g.*, u.manager_id FROM goals g JOIN users u ON g.employee_id = u.id WHERE g.id = ?
  `).get(req.params.id);
  
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  if (goal.status !== 'submitted') return res.status(400).json({ error: 'Only submitted goals can be approved' });
  
  // Manager can only approve their own team's goals
  if (req.user.role === 'manager' && goal.manager_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only approve goals for your team members' });
  }
  
  const { manager_comment, new_target, new_weightage } = req.body;
  
  db.prepare(`
    UPDATE goals SET status = 'approved', manager_comment = ?, approved_by = ?, approved_at = datetime('now'),
    locked_at = datetime('now'), target_value = COALESCE(?, target_value), weightage = COALESCE(?, weightage),
    updated_at = datetime('now')
    WHERE id = ?
  `).run(manager_comment || null, req.user.id, new_target || null, new_weightage ? parseFloat(new_weightage) : null, goal.id);
  
  notifyUser(db, goal.employee_id, 'goal_approved', '✅ Goal Approved!', 
    `Your goal "${goal.title}" has been approved by your manager.`, `/goals/${goal.id}`);
  
  res.json({ message: 'Goal approved and locked' });
});

// POST /api/goals/:id/reject - Manager rejects goal
router.post('/:id/reject', authenticate, authorize('manager', 'admin'), (req, res) => {
  const db = getDb();
  const goal = db.prepare(`
    SELECT g.*, u.manager_id FROM goals g JOIN users u ON g.employee_id = u.id WHERE g.id = ?
  `).get(req.params.id);
  
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  if (!['submitted', 'approved'].includes(goal.status)) return res.status(400).json({ error: 'Cannot reject this goal' });
  
  const { rejection_reason } = req.body;
  if (!rejection_reason) return res.status(400).json({ error: 'Rejection reason is required' });
  
  db.prepare(`
    UPDATE goals SET status = 'rejected', rejection_reason = ?, manager_comment = ?,
    updated_at = datetime('now') WHERE id = ?
  `).run(rejection_reason, req.body.manager_comment || null, goal.id);
  
  notifyUser(db, goal.employee_id, 'goal_rejected', '❌ Goal Needs Revision', 
    `Your goal "${goal.title}" has been sent back for revision. Reason: ${rejection_reason}`, `/goals/${goal.id}`);
  
  res.json({ message: 'Goal rejected and sent back for revision' });
});

// POST /api/goals/:id/unlock - Admin unlocks goal
router.post('/:id/unlock', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  db.prepare(`
    UPDATE goals SET status = 'draft', locked_at = NULL, updated_at = datetime('now') WHERE id = ?
  `).run(req.params.id);
  res.json({ message: 'Goal unlocked for editing' });
});

// POST /api/goals/shared - Admin/Manager pushes shared goal to multiple employees
router.post('/shared', authenticate, authorize('admin', 'manager'), (req, res) => {
  const db = getDb();
  const { cycle_id, thrust_area_id, title, description, uom_type, min_max, target_value, recipient_ids, weightage_map } = req.body;
  
  if (!recipient_ids || recipient_ids.length === 0) {
    return res.status(400).json({ error: 'At least one recipient is required' });
  }
  
  const parentGoalId = uuidv4();
  
  const createShared = db.transaction(() => {
    // Create parent goal
    db.prepare(`
      INSERT INTO goals (id, cycle_id, employee_id, thrust_area_id, title, description, uom_type, min_max, target_value, weightage, status, is_shared, primary_owner_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'approved', 1, ?)
    `).run(parentGoalId, cycle_id, req.user.id, thrust_area_id, title, description || null, uom_type, min_max || 'max', target_value, req.user.id);
    
    // Create recipient goals
    recipient_ids.forEach(recipientId => {
      const recipientGoalId = uuidv4();
      const w = weightage_map?.[recipientId] || 20;
      
      db.prepare(`
        INSERT INTO goals (id, cycle_id, employee_id, thrust_area_id, title, description, uom_type, min_max, target_value, weightage, status, is_shared, shared_from_id, primary_owner_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, ?)
      `).run(recipientGoalId, cycle_id, recipientId, thrust_area_id, title, description, uom_type, min_max || 'max', target_value, w, parentGoalId, req.user.id);
      
      db.prepare(`
        INSERT INTO shared_goal_recipients (id, parent_goal_id, recipient_goal_id, recipient_id, weightage)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), parentGoalId, recipientGoalId, recipientId, w);
      
      notifyUser(db, recipientId, 'shared_goal', '📋 Shared Goal Assigned', 
        `A departmental KPI has been assigned to you: "${title}"`, `/goals/${recipientGoalId}`);
    });
  });
  
  createShared();
  res.status(201).json({ message: `Shared goal pushed to ${recipient_ids.length} employees`, parent_id: parentGoalId });
});

// DELETE /api/goals/:id
router.delete('/:id', authenticate, (req, res) => {
  const db = getDb();
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(req.params.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  
  if (req.user.role === 'employee') {
    if (goal.employee_id !== req.user.id || !['draft', 'rejected'].includes(goal.status)) {
      return res.status(403).json({ error: 'Cannot delete this goal' });
    }
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  db.prepare('DELETE FROM goals WHERE id = ?').run(goal.id);
  res.json({ message: 'Goal deleted' });
});

module.exports = router;
