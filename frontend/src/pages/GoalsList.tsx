import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, Target, Clock, AlertTriangle, Send } from 'lucide-react';

const GoalsList: React.FC = () => {
  const [goalsData, setGoalsData] = useState<any>({ goals: [], totalWeightage: 0, goalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchGoals = async () => {
    try {
      const res = await api.get('/goals/my');
      setGoalsData(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleSubmitAll = async () => {
    if (Math.abs(goalsData.totalWeightage - 100) > 0.01) {
      toast.error(`Total weightage must be exactly 100%. Currently ${goalsData.totalWeightage}%`);
      return;
    }
    
    if (window.confirm('Are you sure you want to submit all draft goals for approval? They cannot be edited once submitted.')) {
      setSubmitting(true);
      try {
        await api.post('/goals/submit-all');
        toast.success('Goals submitted successfully');
        fetchGoals();
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to submit goals');
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (loading) return <div className="animate-pulse h-64 bg-slate-800/50 rounded-xl"></div>;

  const draftCount = goalsData.goals.filter((g: any) => g.status === 'draft' || g.status === 'rejected').length;
  const canSubmit = draftCount > 0 && Math.abs(goalsData.totalWeightage - 100) < 0.01;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6">
        <div>
          <h2 className="text-2xl font-bold font-display">My Goal Sheet</h2>
          <p className="text-slate-400 mt-1">Manage and track your performance goals for the current cycle.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/goals/new" className="btn btn-secondary">
            <Plus className="w-4 h-4" /> Add Goal
          </Link>
          <button 
            onClick={handleSubmitAll} 
            disabled={!canSubmit || submitting}
            className={`btn ${canSubmit ? 'btn-primary' : 'btn-secondary opacity-50'}`}
          >
            <Send className="w-4 h-4" /> 
            {submitting ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </div>
      </div>

      {/* Progress overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4 flex justify-between items-center border-l-4 border-l-indigo-500">
          <div>
            <p className="text-sm text-slate-400">Total Goals</p>
            <p className="text-2xl font-bold">{goalsData.goalCount} <span className="text-sm font-normal text-slate-500">/ 8 Max</span></p>
          </div>
          <Target className="w-8 h-8 text-indigo-500/20" />
        </div>
        <div className={`glass-panel p-4 flex justify-between items-center border-l-4 ${Math.abs(goalsData.totalWeightage - 100) < 0.01 ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
          <div>
            <p className="text-sm text-slate-400">Total Weightage</p>
            <p className="text-2xl font-bold">{goalsData.totalWeightage}% <span className="text-sm font-normal text-slate-500">/ 100% Req</span></p>
          </div>
          {Math.abs(goalsData.totalWeightage - 100) < 0.01 ? <Target className="w-8 h-8 text-emerald-500/20" /> : <AlertTriangle className="w-8 h-8 text-amber-500/20" />}
        </div>
        <div className="glass-panel p-4 flex justify-between items-center border-l-4 border-l-sky-500">
          <div>
            <p className="text-sm text-slate-400">Draft Goals</p>
            <p className="text-2xl font-bold">{draftCount}</p>
          </div>
          <Clock className="w-8 h-8 text-sky-500/20" />
        </div>
      </div>

      {goalsData.goals.length === 0 ? (
        <div className="empty-state glass-panel">
          <Target className="w-16 h-16 text-indigo-500/30 mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Goals Set Yet</h3>
          <p className="text-slate-400 max-w-md mx-auto mb-6">Start building your goal sheet by adding your first goal. Remember, you need to hit exactly 100% weightage across maximum 8 goals.</p>
          <Link to="/goals/new" className="btn btn-primary">Create First Goal</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goalsData.goals.map((goal: any) => (
            <div key={goal.id} className="glass-card flex flex-col overflow-hidden relative group">
              <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: goal.thrust_area_color }}></div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <span className="badge" style={{ backgroundColor: `${goal.thrust_area_color}20`, color: goal.thrust_area_color, border: `1px solid ${goal.thrust_area_color}40` }}>
                    {goal.thrust_area_name}
                  </span>
                  <span className={`badge ${
                    goal.status === 'approved' || goal.status === 'locked' ? 'badge-success' :
                    goal.status === 'submitted' ? 'badge-warning' :
                    goal.status === 'rejected' ? 'badge-danger' : 'badge-secondary'
                  }`}>
                    {goal.status}
                  </span>
                </div>
                
                <h3 className="font-bold text-lg mb-2 line-clamp-2" title={goal.title}>{goal.title}</h3>
                <p className="text-slate-400 text-sm mb-4 line-clamp-2 flex-1">{goal.description || 'No description provided.'}</p>
                
                <div className="grid grid-cols-2 gap-4 py-3 border-t border-slate-700/50 mt-auto">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Target</p>
                    <p className="font-semibold">{goal.target_value ? `${goal.target_value} ${goal.uom_type === 'percentage' ? '%' : ''}` : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Weightage</p>
                    <p className="font-semibold text-indigo-400">{goal.weightage}%</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-800/50 px-5 py-3 border-t border-slate-700/50 flex justify-end gap-2">
                {goal.status === 'rejected' && (
                  <div className="w-full text-xs text-red-400 py-1 line-clamp-1 mr-auto" title={goal.rejection_reason}>
                    Reason: {goal.rejection_reason}
                  </div>
                )}
                <Link to={`/goals/${goal.id}`} className="btn btn-ghost px-3 py-1 text-xs">View</Link>
                {(goal.status === 'draft' || goal.status === 'rejected') && !goal.is_shared && (
                  <Link to={`/goals/${goal.id}/edit`} className="btn btn-secondary px-3 py-1 text-xs">Edit</Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GoalsList;
