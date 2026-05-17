import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Users, CheckCircle, XCircle, Search } from 'lucide-react';

const ManagerReview: React.FC = () => {
  const [team, setTeam] = useState([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Review state
  const [reviewComment, setReviewComment] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const fetchTeam = async () => {
    try {
      const res = await api.get('/users/team');
      setTeam(res.data);
    } catch (error) {
      toast.error('Failed to fetch team');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchGoals = async (userId: string) => {
    try {
      const res = await api.get(`/goals?employee_id=${userId}`);
      setGoals(res.data);
    } catch (error) {
      toast.error('Failed to fetch goals');
    }
  };

  const handleApprove = async (goalId: string) => {
    try {
      await api.post(`/goals/${goalId}/approve`, { manager_comment: reviewComment });
      toast.success('Goal approved');
      setReviewingId(null);
      setReviewComment('');
      if (selectedUser) fetchGoals(selectedUser.id);
      fetchTeam(); // Update counts
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to approve');
    }
  };

  const handleReject = async (goalId: string) => {
    if (!rejectionReason) {
      toast.error('Rejection reason is required');
      return;
    }
    try {
      await api.post(`/goals/${goalId}/reject`, { manager_comment: reviewComment, rejection_reason: rejectionReason });
      toast.success('Goal sent back for revision');
      setReviewingId(null);
      setReviewComment('');
      setRejectionReason('');
      if (selectedUser) fetchGoals(selectedUser.id);
      fetchTeam();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reject');
    }
  };

  if (loading) return <div className="animate-pulse h-96 bg-slate-800/50 rounded-xl"></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
      {/* Team List Sidebar */}
      <div className="glass-panel overflow-hidden flex flex-col h-full">
        <div className="p-4 border-b border-subtle">
          <h3 className="font-semibold font-display flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" /> Team Members
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {team.map((member: any) => (
            <div 
              key={member.id} 
              onClick={() => { setSelectedUser(member); fetchGoals(member.id); setReviewingId(null); }}
              className={`p-4 border-b border-subtle cursor-pointer transition-colors ${selectedUser?.id === member.id ? 'bg-indigo-500/10 border-l-4 border-l-indigo-500' : 'hover:bg-slate-800/50 border-l-4 border-l-transparent'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{member.name}</p>
                  <p className="text-xs text-slate-400">{member.department}</p>
                </div>
                {member.pending_goals > 0 && (
                  <span className="badge badge-warning">{member.pending_goals} Pending</span>
                )}
              </div>
            </div>
          ))}
          {team.length === 0 && <div className="p-8 text-center text-slate-400">No team members found</div>}
        </div>
      </div>

      {/* Review Area */}
      <div className="lg:col-span-2 glass-panel flex flex-col h-full overflow-hidden">
        {selectedUser ? (
          <>
            <div className="p-6 border-b border-subtle bg-slate-800/30">
              <h2 className="text-xl font-bold font-display">{selectedUser.name}'s Goals</h2>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-slate-400">Total Goals: <strong className="text-white">{goals.length}</strong></span>
                <span className="text-amber-400">Pending Review: <strong className="text-white">{goals.filter((g:any) => g.status === 'submitted').length}</strong></span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {goals.map((goal: any) => (
                <div key={goal.id} className={`p-5 rounded-xl border ${goal.status === 'submitted' ? 'bg-slate-800 border-indigo-500/30' : 'bg-slate-800/30 border-slate-700/50'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="badge bg-slate-700 text-slate-300 mb-2">{goal.thrust_area_name}</span>
                      <h3 className="font-bold text-lg">{goal.title}</h3>
                    </div>
                    <span className={`badge ${goal.status === 'approved' ? 'badge-success' : goal.status === 'submitted' ? 'badge-warning' : 'badge-secondary'}`}>
                      {goal.status}
                    </span>
                  </div>
                  
                  <p className="text-sm text-slate-400 mb-4">{goal.description}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="p-3 bg-slate-900/50 rounded-lg">
                      <p className="text-xs text-slate-500">Target</p>
                      <p className="font-semibold">{goal.target_value || 'N/A'} {goal.uom_type === 'percentage' ? '%' : ''}</p>
                    </div>
                    <div className="p-3 bg-slate-900/50 rounded-lg">
                      <p className="text-xs text-slate-500">Weightage</p>
                      <p className="font-semibold text-indigo-400">{goal.weightage}%</p>
                    </div>
                  </div>

                  {goal.status === 'submitted' && reviewingId !== goal.id && (
                    <button onClick={() => setReviewingId(goal.id)} className="btn btn-primary btn-sm mt-2">
                      Review this Goal
                    </button>
                  )}

                  {reviewingId === goal.id && (
                    <div className="mt-4 p-4 border border-indigo-500/30 bg-indigo-500/5 rounded-lg animate-fade-in">
                      <h4 className="font-semibold mb-3">Review Decision</h4>
                      
                      <div className="form-group">
                        <label className="form-label">Manager Comment (Optional)</label>
                        <textarea className="form-control" rows={2} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Add encouraging feedback or notes..."></textarea>
                      </div>

                      <div className="flex gap-4">
                        <div className="flex-1 p-4 border border-emerald-500/30 rounded-lg">
                          <button onClick={() => handleApprove(goal.id)} className="w-full btn btn-success flex items-center justify-center gap-2">
                            <CheckCircle className="w-4 h-4" /> Approve & Lock Goal
                          </button>
                        </div>
                        <div className="flex-1 p-4 border border-red-500/30 rounded-lg">
                          <input type="text" className="form-control mb-3" placeholder="Reason for rejection (Required)" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
                          <button onClick={() => handleReject(goal.id)} className="w-full btn btn-danger flex items-center justify-center gap-2">
                            <XCircle className="w-4 h-4" /> Reject for Revision
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 text-right">
                        <button onClick={() => setReviewingId(null)} className="btn btn-ghost text-sm">Cancel Review</button>
                      </div>
                    </div>
                  )}

                  {goal.manager_comment && goal.status !== 'submitted' && (
                    <div className="mt-4 p-3 bg-slate-700/30 rounded-lg border-l-2 border-indigo-500">
                      <p className="text-xs text-slate-400 font-semibold mb-1">Manager Note:</p>
                      <p className="text-sm italic">"{goal.manager_comment}"</p>
                    </div>
                  )}
                </div>
              ))}
              
              {goals.length === 0 && <div className="text-center py-12 text-slate-400">No goals found for this employee.</div>}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 p-8 text-center flex-col gap-4">
            <Search className="w-12 h-12 opacity-50" />
            <p>Select a team member from the sidebar to review their goals.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerReview;
