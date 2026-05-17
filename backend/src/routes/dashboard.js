const express = require('express');
const { getDb } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/employee - Employee's own dashboard
router.get('/employee', authenticate, (req, res) => {
  const db = getDb();
  const cycleId = req.query.cycle_id || db.prepare("SELECT id FROM goal_cycles WHERE is_active = 1 LIMIT 1").get()?.id;
  const cycle = db.prepare('SELECT * FROM goal_cycles WHERE id = ?').get(cycleId);
  
  const goals = db.prepare(`
    SELECT g.*, t.name as thrust_area_name, t.color as thrust_area_color
    FROM goals g JOIN thrust_areas t ON g.thrust_area_id = t.id
    WHERE g.employee_id = ? AND g.cycle_id = ?
  `).all(req.user.id, cycleId);
  
  const achievements = db.prepare(`
    SELECT qa.* FROM quarterly_achievements qa
    JOIN goals g ON qa.goal_id = g.id
    WHERE g.employee_id = ? AND g.cycle_id = ?
  `).all(req.user.id, cycleId);
  
  const totalWeightage = goals.reduce((s, g) => s + g.weightage, 0);
  const approvedGoals = goals.filter(g => ['approved', 'locked'].includes(g.status));
  const avgProgress = achievements.length > 0 ? Math.round(achievements.filter(a => a.progress_score !== null).reduce((s, a) => s + (a.progress_score || 0), 0) / achievements.filter(a => a.progress_score !== null).length) : 0;
  
  const checkins = db.prepare(`
    SELECT c.* FROM checkins c JOIN goals g ON c.goal_id = g.id WHERE c.employee_id = ? AND g.cycle_id = ? ORDER BY c.created_at DESC LIMIT 5
  `).all(req.user.id, cycleId);
  
  const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT 5').all(req.user.id);
  
  res.json({
    cycle,
    stats: {
      totalGoals: goals.length,
      approvedGoals: approvedGoals.length,
      submittedGoals: goals.filter(g => g.status === 'submitted').length,
      draftGoals: goals.filter(g => g.status === 'draft').length,
      totalWeightage: Math.round(totalWeightage * 100) / 100,
      avgProgress,
      isWeightageComplete: Math.abs(totalWeightage - 100) < 0.01
    },
    goals: goals.map(g => ({
      ...g,
      achievements: achievements.filter(a => a.goal_id === g.id)
    })),
    recentCheckins: checkins,
    notifications
  });
});

// GET /api/dashboard/manager - Manager dashboard
router.get('/manager', authenticate, authorize('manager', 'admin'), (req, res) => {
  const db = getDb();
  const managerId = req.user.role === 'admin' ? (req.query.manager_id || req.user.id) : req.user.id;
  const cycleId = req.query.cycle_id || db.prepare("SELECT id FROM goal_cycles WHERE is_active = 1 LIMIT 1").get()?.id;
  
  const team = db.prepare(`
    SELECT u.id, u.name, u.email, u.department, u.avatar_color,
           COUNT(g.id) as total_goals,
           SUM(CASE WHEN g.status IN ('approved','locked') THEN 1 ELSE 0 END) as approved,
           SUM(CASE WHEN g.status = 'submitted' THEN 1 ELSE 0 END) as pending_approval,
           SUM(CASE WHEN g.status = 'draft' THEN 1 ELSE 0 END) as draft,
           AVG(qa.progress_score) as avg_progress
    FROM users u
    LEFT JOIN goals g ON g.employee_id = u.id AND g.cycle_id = ?
    LEFT JOIN quarterly_achievements qa ON qa.goal_id = g.id
    WHERE u.manager_id = ? AND u.is_active = 1
    GROUP BY u.id ORDER BY u.name
  `).all(cycleId, managerId);
  
  const pendingApprovals = db.prepare(`
    SELECT g.*, u.name as employee_name, u.avatar_color, t.name as thrust_area_name
    FROM goals g JOIN users u ON g.employee_id = u.id JOIN thrust_areas t ON g.thrust_area_id = t.id
    WHERE u.manager_id = ? AND g.status = 'submitted' AND g.cycle_id = ?
    ORDER BY g.created_at
  `).all(managerId, cycleId);
  
  const stats = {
    teamSize: team.length,
    totalPendingApprovals: pendingApprovals.length,
    membersWithGoals: team.filter(t => t.total_goals > 0).length,
    membersNeedingCheckin: team.filter(t => t.avg_progress === null && t.approved > 0).length,
    avgTeamProgress: team.filter(t => t.avg_progress !== null).length > 0 
      ? Math.round(team.filter(t => t.avg_progress !== null).reduce((s, t) => s + (t.avg_progress || 0), 0) / team.filter(t => t.avg_progress !== null).length) : 0
  };
  
  res.json({ team, pendingApprovals, stats });
});

// GET /api/dashboard/admin - Admin overview
router.get('/admin', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const cycleId = req.query.cycle_id || db.prepare("SELECT id FROM goal_cycles WHERE is_active = 1 LIMIT 1").get()?.id;
  
  const orgStats = db.prepare(`
    SELECT 
      COUNT(DISTINCT CASE WHEN u.role = 'employee' THEN u.id END) as total_employees,
      COUNT(DISTINCT CASE WHEN u.role = 'manager' THEN u.id END) as total_managers,
      COUNT(g.id) as total_goals,
      SUM(CASE WHEN g.status = 'submitted' THEN 1 ELSE 0 END) as pending_approvals,
      SUM(CASE WHEN g.status IN ('approved','locked') THEN 1 ELSE 0 END) as approved_goals,
      SUM(CASE WHEN g.status = 'draft' THEN 1 ELSE 0 END) as draft_goals,
      SUM(CASE WHEN g.is_shared = 1 THEN 1 ELSE 0 END) as shared_goals,
      AVG(qa.progress_score) as org_avg_progress
    FROM users u
    LEFT JOIN goals g ON g.employee_id = u.id AND g.cycle_id = ?
    LEFT JOIN quarterly_achievements qa ON qa.goal_id = g.id
    WHERE u.is_active = 1
  `).get(cycleId);
  
  const deptBreakdown = db.prepare(`
    SELECT u.department,
           COUNT(DISTINCT u.id) as employees,
           COUNT(g.id) as goals,
           SUM(CASE WHEN g.status = 'submitted' THEN 1 ELSE 0 END) as pending,
           SUM(CASE WHEN g.status IN ('approved','locked') THEN 1 ELSE 0 END) as approved,
           AVG(qa.progress_score) as avg_progress
    FROM users u
    LEFT JOIN goals g ON g.employee_id = u.id AND g.cycle_id = ?
    LEFT JOIN quarterly_achievements qa ON qa.goal_id = g.id
    WHERE u.role = 'employee' AND u.is_active = 1
    GROUP BY u.department ORDER BY u.department
  `).all(cycleId);
  
  const recentAudit = db.prepare(`
    SELECT al.*, u.name as user_name, u.role FROM audit_logs al JOIN users u ON al.user_id = u.id
    ORDER BY al.created_at DESC LIMIT 10
  `).all();
  
  const thrustBreakdown = db.prepare(`
    SELECT t.name, t.color, COUNT(g.id) as goal_count, AVG(qa.progress_score) as avg_progress
    FROM thrust_areas t
    LEFT JOIN goals g ON g.thrust_area_id = t.id AND g.cycle_id = ?
    LEFT JOIN quarterly_achievements qa ON qa.goal_id = g.id
    GROUP BY t.id ORDER BY goal_count DESC
  `).all(cycleId);
  
  res.json({ orgStats, deptBreakdown, recentAudit, thrustBreakdown });
});

module.exports = router;
