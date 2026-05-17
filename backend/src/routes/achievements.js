const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function calculateProgressScore(goal, actual) {
  if (actual === null || actual === undefined) return null;
  const { uom_type, min_max, target_value } = goal;
  if (uom_type === 'zero') return actual === 0 ? 100 : 0;
  if (uom_type === 'timeline') {
    const actualDate = new Date(actual);
    const targetDate = new Date(target_value);
    return actualDate <= targetDate ? 100 : Math.max(0, 50);
  }
  if (uom_type === 'numeric' || uom_type === 'percentage') {
    if (min_max === 'max') return target_value > 0 ? Math.min(150, Math.round((actual / target_value) * 100)) : 0;
    if (min_max === 'min') return actual > 0 ? Math.min(150, Math.round((target_value / actual) * 100)) : (actual === 0 ? 100 : 0);
  }
  return null;
}

// GET /api/achievements/goal/:goalId
router.get('/goal/:goalId', authenticate, (req, res) => {
  const db = getDb();
  const achievements = db.prepare('SELECT * FROM quarterly_achievements WHERE goal_id = ? ORDER BY quarter').all(req.params.goalId);
  res.json(achievements);
});

// POST /api/achievements - Submit quarterly achievement
router.post('/', authenticate, authorize('employee', 'manager', 'admin'), (req, res) => {
  const db = getDb();
  const { goal_id, quarter, actual_value, actual_date, status, employee_notes } = req.body;
  
  if (!goal_id || !quarter || status === undefined) {
    return res.status(400).json({ error: 'goal_id, quarter, and status are required' });
  }
  
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(goal_id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  
  if (req.user.role === 'employee' && goal.employee_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  if (!['approved', 'locked'].includes(goal.status)) {
    return res.status(400).json({ error: 'Can only update achievements for approved/locked goals' });
  }
  
  if (actual_value === null || actual_value === undefined) {
    return res.status(400).json({ error: 'Actual achievement value must be entered before submission' });
  }
  
  const progressScore = calculateProgressScore(goal, parseFloat(actual_value));
  
  // Upsert
  const existing = db.prepare('SELECT id FROM quarterly_achievements WHERE goal_id = ? AND quarter = ?').get(goal_id, quarter);
  
  if (existing) {
    db.prepare(`
      UPDATE quarterly_achievements SET actual_value = ?, actual_date = ?, status = ?, 
      progress_score = ?, employee_notes = ?, submitted_at = datetime('now'), updated_at = datetime('now')
      WHERE goal_id = ? AND quarter = ?
    `).run(parseFloat(actual_value), actual_date || null, status, progressScore, employee_notes || null, goal_id, quarter);
  } else {
    db.prepare(`
      INSERT INTO quarterly_achievements (id, goal_id, quarter, actual_value, actual_date, status, progress_score, employee_notes, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(uuidv4(), goal_id, quarter, parseFloat(actual_value), actual_date || null, status, progressScore, employee_notes || null);
  }
  
  // If this is a shared goal, sync to all linked goals
  if (goal.is_shared && goal.primary_owner_id === req.user.id) {
    const recipients = db.prepare('SELECT recipient_goal_id FROM shared_goal_recipients WHERE parent_goal_id = ?').all(goal_id);
    recipients.forEach(r => {
      const rGoal = db.prepare('SELECT * FROM goals WHERE id = ?').get(r.recipient_goal_id);
      const rScore = rGoal ? calculateProgressScore(rGoal, parseFloat(actual_value)) : progressScore;
      const rExisting = db.prepare('SELECT id FROM quarterly_achievements WHERE goal_id = ? AND quarter = ?').get(r.recipient_goal_id, quarter);
      if (rExisting) {
        db.prepare("UPDATE quarterly_achievements SET actual_value = ?, status = ?, progress_score = ?, updated_at = datetime('now') WHERE goal_id = ? AND quarter = ?").run(parseFloat(actual_value), status, rScore, r.recipient_goal_id, quarter);
      } else {
        db.prepare("INSERT INTO quarterly_achievements (id, goal_id, quarter, actual_value, status, progress_score, submitted_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))").run(uuidv4(), r.recipient_goal_id, quarter, parseFloat(actual_value), status, rScore);
      }
    });
  }
  
  res.json({ message: 'Achievement updated', progressScore });
});

// GET /api/achievements/summary/:employeeId
router.get('/summary/:employeeId', authenticate, (req, res) => {
  const db = getDb();
  const cycleId = req.query.cycle_id || db.prepare("SELECT id FROM goal_cycles WHERE is_active = 1 LIMIT 1").get()?.id;
  
  const summary = db.prepare(`
    SELECT g.id, g.title, g.weightage, g.uom_type, g.target_value, g.status as goal_status,
           t.name as thrust_area, t.color as thrust_color,
           qa.quarter, qa.actual_value, qa.status as achievement_status, qa.progress_score
    FROM goals g
    JOIN thrust_areas t ON g.thrust_area_id = t.id
    LEFT JOIN quarterly_achievements qa ON qa.goal_id = g.id
    WHERE g.employee_id = ? AND g.cycle_id = ?
    ORDER BY g.weightage DESC, qa.quarter
  `).all(req.params.employeeId, cycleId);
  
  res.json(summary);
});

module.exports = router;
