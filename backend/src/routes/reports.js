const express = require('express');
const { getDb } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/achievement - Full achievement report
router.get('/achievement', authenticate, authorize('manager', 'admin'), (req, res) => {
  const db = getDb();
  const { department, status, quarter, cycle_id, format } = req.query;
  
  const cycleId = cycle_id || db.prepare("SELECT id FROM goal_cycles WHERE is_active = 1 LIMIT 1").get()?.id;
  
  let query = `
    SELECT u.name as employee_name, u.employee_id, u.department, u.email,
           m.name as manager_name,
           g.title as goal_title, g.weightage, g.uom_type, g.target_value, g.status as goal_status,
           t.name as thrust_area,
           qa.quarter, qa.actual_value, qa.status as achievement_status, qa.progress_score,
           qa.submitted_at as last_updated
    FROM goals g
    JOIN users u ON g.employee_id = u.id
    LEFT JOIN users m ON u.manager_id = m.id
    JOIN thrust_areas t ON g.thrust_area_id = t.id
    LEFT JOIN quarterly_achievements qa ON qa.goal_id = g.id
    WHERE g.cycle_id = ?
  `;
  const params = [cycleId];
  
  if (req.user.role === 'manager') {
    query += ' AND u.manager_id = ?'; params.push(req.user.id);
  }
  if (department) { query += ' AND u.department = ?'; params.push(department); }
  if (status) { query += ' AND qa.status = ?'; params.push(status); }
  if (quarter) { query += ' AND qa.quarter = ?'; params.push(quarter); }
  
  query += ' ORDER BY u.department, u.name, g.weightage DESC';
  
  const data = db.prepare(query).all(...params);
  
  if (format === 'csv') {
    const headers = ['Employee Name','Employee ID','Department','Manager','Goal Title','Thrust Area','UoM','Target','Actual','Quarter','Achievement Status','Progress %','Goal Status','Last Updated'];
    const rows = data.map(r => [
      r.employee_name, r.employee_id, r.department, r.manager_name, r.goal_title,
      r.thrust_area, r.uom_type, r.target_value, r.actual_value,
      r.quarter, r.achievement_status, r.progress_score, r.goal_status, r.last_updated
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v || ''}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="achievement_report.csv"');
    return res.send(csv);
  }
  
  res.json({ data, total: data.length, cycle_id: cycleId });
});

// GET /api/reports/completion - Completion dashboard
router.get('/completion', authenticate, authorize('manager', 'admin'), (req, res) => {
  const db = getDb();
  const cycleId = req.query.cycle_id || db.prepare("SELECT id FROM goal_cycles WHERE is_active = 1 LIMIT 1").get()?.id;
  const quarter = req.query.quarter || 'Q1';
  
  // Manager filter
  let managerFilter = '';
  const params = [cycleId];
  if (req.user.role === 'manager') {
    managerFilter = 'AND u.manager_id = ?';
    params.push(req.user.id);
  }
  
  const employeeCompletion = db.prepare(`
    SELECT u.id, u.name, u.department, u.email, m.name as manager_name,
           COUNT(g.id) as total_goals,
           SUM(CASE WHEN g.status IN ('approved','locked') THEN 1 ELSE 0 END) as approved_goals,
           SUM(CASE WHEN qa.quarter = ? AND qa.submitted_at IS NOT NULL THEN 1 ELSE 0 END) as submitted_checkins,
           COUNT(g.id) - SUM(CASE WHEN qa.quarter = ? AND qa.submitted_at IS NOT NULL THEN 1 ELSE 0 END) as pending_checkins,
           MAX(qa.submitted_at) as last_submission
    FROM users u
    LEFT JOIN users m ON u.manager_id = m.id
    LEFT JOIN goals g ON g.employee_id = u.id AND g.cycle_id = ?
    LEFT JOIN quarterly_achievements qa ON qa.goal_id = g.id AND qa.quarter = ?
    WHERE u.role = 'employee' AND u.is_active = 1 ${managerFilter}
    GROUP BY u.id
    ORDER BY u.department, u.name
  `).all(quarter, quarter, ...params, quarter);
  
  const stats = {
    totalEmployees: employeeCompletion.length,
    completedCheckins: employeeCompletion.filter(e => e.pending_checkins === 0 && e.total_goals > 0).length,
    pendingCheckins: employeeCompletion.filter(e => e.pending_checkins > 0).length,
    noGoals: employeeCompletion.filter(e => e.total_goals === 0).length,
    completionRate: employeeCompletion.length > 0 ? 
      Math.round((employeeCompletion.filter(e => e.pending_checkins === 0 && e.total_goals > 0).length / employeeCompletion.length) * 100) : 0
  };
  
  res.json({ employees: employeeCompletion, stats, quarter });
});

// GET /api/reports/trends - QoQ trends
router.get('/trends', authenticate, (req, res) => {
  const db = getDb();
  const employeeId = req.user.role === 'employee' ? req.user.id : (req.query.employee_id || req.user.id);
  const cycleId = req.query.cycle_id || db.prepare("SELECT id FROM goal_cycles WHERE is_active = 1 LIMIT 1").get()?.id;
  
  const trends = db.prepare(`
    SELECT qa.quarter, 
           AVG(qa.progress_score) as avg_progress,
           COUNT(qa.id) as goals_updated,
           SUM(CASE WHEN qa.status = 'completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN qa.status = 'on_track' THEN 1 ELSE 0 END) as on_track,
           SUM(CASE WHEN qa.status = 'not_started' THEN 1 ELSE 0 END) as not_started
    FROM quarterly_achievements qa
    JOIN goals g ON qa.goal_id = g.id
    WHERE g.employee_id = ? AND g.cycle_id = ?
    GROUP BY qa.quarter
    ORDER BY qa.quarter
  `).all(employeeId, cycleId);
  
  res.json(trends);
});

// GET /api/reports/department - Department-level summary
router.get('/department', authenticate, authorize('admin', 'manager'), (req, res) => {
  const db = getDb();
  const cycleId = req.query.cycle_id || db.prepare("SELECT id FROM goal_cycles WHERE is_active = 1 LIMIT 1").get()?.id;
  
  const summary = db.prepare(`
    SELECT u.department,
           COUNT(DISTINCT u.id) as total_employees,
           COUNT(g.id) as total_goals,
           SUM(CASE WHEN g.status IN ('approved','locked') THEN 1 ELSE 0 END) as approved_goals,
           SUM(CASE WHEN g.status = 'submitted' THEN 1 ELSE 0 END) as pending_approval,
           SUM(CASE WHEN g.status = 'draft' THEN 1 ELSE 0 END) as draft_goals,
           AVG(qa.progress_score) as avg_progress_score
    FROM users u
    LEFT JOIN goals g ON g.employee_id = u.id AND g.cycle_id = ?
    LEFT JOIN quarterly_achievements qa ON qa.goal_id = g.id
    WHERE u.role = 'employee' AND u.is_active = 1
    GROUP BY u.department
    ORDER BY u.department
  `).all(cycleId);
  
  res.json(summary);
});

module.exports = router;
