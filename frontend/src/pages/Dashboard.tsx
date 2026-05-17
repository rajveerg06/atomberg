import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import api from '../lib/api';
import { Target, TrendingUp, CheckCircle, Clock, AlertCircle, Users, BarChart2, ShieldCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const endpoint = user?.role === 'employee' ? '/dashboard/employee' :
          user?.role === 'manager' ? '/dashboard/manager' : '/dashboard/admin';
        const res = await api.get(endpoint);
        setData(res.data);
      } catch (error) {
        console.error('Error fetching dashboard data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [user]);

  if (loading) return <div className="animate-pulse flex flex-col gap-6">
    <div className="h-32 bg-slate-800/50 rounded-xl"></div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><div className="h-24 bg-slate-800/50 rounded-xl"></div><div className="h-24 bg-slate-800/50 rounded-xl"></div><div className="h-24 bg-slate-800/50 rounded-xl"></div><div className="h-24 bg-slate-800/50 rounded-xl"></div></div>
    <div className="h-64 bg-slate-800/50 rounded-xl"></div>
  </div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display">Welcome back, {user?.name.split(' ')[0]} 👋</h2>
          <p className="text-slate-400">Here's what's happening with your goals today.</p>
        </div>
      </div>

      {user?.role === 'employee' && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard icon={<Target className="w-5 h-5 text-indigo-400" />} title="Total Goals" value={data.stats.totalGoals} />
            <StatCard icon={<CheckCircle className="w-5 h-5 text-emerald-400" />} title="Approved Goals" value={data.stats.approvedGoals} />
            <StatCard icon={<Clock className="w-5 h-5 text-amber-400" />} title="Pending Approval" value={data.stats.submittedGoals} />
            <StatCard icon={<TrendingUp className="w-5 h-5 text-sky-400" />} title="Avg. Progress" value={`${data.stats.avgProgress}%`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-panel p-6">
              <h3 className="text-lg font-semibold mb-4">Goal Progress Overview</h3>
              {data.goals && data.goals.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.goals.map((g: any) => {
                      const latest = g.achievements?.[g.achievements.length - 1];
                      return { name: g.title.substring(0, 15) + '...', progress: latest?.progress_score || 0, color: g.thrust_area_color };
                    })} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                      <Bar dataKey="progress" radius={[4, 4, 0, 0]}>
                        {data.goals.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.thrust_area_color || '#6366f1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-state">
                  <Target />
                  <p>No goals set for this cycle yet.</p>
                </div>
              )}
            </div>

            <div className="glass-panel p-6">
              <h3 className="text-lg font-semibold mb-4">Weightage Status</h3>
              <div className="flex flex-col items-center justify-center h-48 relative">
                <svg viewBox="0 0 36 36" className="w-32 h-32 transform -rotate-90">
                  <path className="text-slate-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                  <path className={`${data.stats.isWeightageComplete ? 'text-emerald-500' : 'text-indigo-500'}`} strokeDasharray={`${Math.min(data.stats.totalWeightage, 100)}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold">{data.stats.totalWeightage}%</span>
                  <span className="text-xs text-slate-400">Total</span>
                </div>
              </div>
              {!data.stats.isWeightageComplete && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <p className="text-sm text-amber-200">Your total weightage must be exactly 100% before submission.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {user?.role === 'manager' && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard icon={<Users className="w-5 h-5 text-indigo-400" />} title="Team Members" value={data.stats.teamSize} />
            <StatCard icon={<Clock className="w-5 h-5 text-amber-400" />} title="Pending Approvals" value={data.stats.totalPendingApprovals} />
            <StatCard icon={<Target className="w-5 h-5 text-emerald-400" />} title="Members with Goals" value={data.stats.membersWithGoals} />
            <StatCard icon={<TrendingUp className="w-5 h-5 text-sky-400" />} title="Avg. Team Progress" value={`${data.stats.avgTeamProgress}%`} />
          </div>

          <div className="glass-panel overflow-hidden">
            <div className="p-4 border-b border-subtle flex justify-between items-center bg-slate-800/30">
              <h3 className="font-semibold">Team Overview</h3>
            </div>
            <div className="table-container border-0 rounded-none bg-transparent">
              <table className="table">
                <thead>
                  <tr>
                    <th>Team Member</th>
                    <th>Goals Set</th>
                    <th>Status</th>
                    <th>Avg Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {data.team.map((member: any) => (
                    <tr key={member.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="avatar avatar-sm" style={{ backgroundColor: member.avatar_color }}>
                            {member.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-xs text-slate-400">{member.department}</p>
                          </div>
                        </div>
                      </td>
                      <td>{member.total_goals}</td>
                      <td>
                        {member.pending_approval > 0 ? (
                          <span className="badge badge-warning">{member.pending_approval} Pending</span>
                        ) : member.approved === member.total_goals && member.total_goals > 0 ? (
                          <span className="badge badge-success">Approved</span>
                        ) : member.total_goals > 0 ? (
                          <span className="badge badge-secondary">Draft</span>
                        ) : (
                          <span className="badge badge-danger">Not Started</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${member.avg_progress || 0}%` }}></div>
                          </div>
                          <span className="text-xs font-medium">{Math.round(member.avg_progress || 0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.team.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-8 text-slate-400">No team members found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {user?.role === 'admin' && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard icon={<Users className="w-5 h-5 text-indigo-400" />} title="Total Employees" value={data.orgStats?.total_employees ?? 0} />
            <StatCard icon={<Target className="w-5 h-5 text-emerald-400" />} title="Total Goals" value={data.orgStats?.total_goals ?? 0} />
            <StatCard icon={<Clock className="w-5 h-5 text-amber-400" />} title="Pending Approvals" value={data.orgStats?.pending_approvals ?? 0} />
            <StatCard icon={<TrendingUp className="w-5 h-5 text-sky-400" />} title="Org Avg Progress" value={`${Math.round(data.orgStats?.org_avg_progress || 0)}%`} />
          </div>

          <div className="glass-panel overflow-hidden">
            <div className="p-4 border-b border-subtle flex justify-between items-center bg-slate-800/30">
              <h3 className="font-semibold flex items-center gap-2"><BarChart2 className="w-5 h-5 text-indigo-400" /> Department Breakdown</h3>
            </div>
            <div className="table-container border-0 rounded-none bg-transparent">
              <table className="table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Employees</th>
                    <th>Goals</th>
                    <th>Pending</th>
                    <th>Approved</th>
                    <th>Avg Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.deptBreakdown || []).map((dept: any) => (
                    <tr key={dept.department}>
                      <td className="font-medium">{dept.department}</td>
                      <td>{dept.employees}</td>
                      <td>{dept.goals}</td>
                      <td>{dept.pending > 0 ? <span className="badge badge-warning">{dept.pending}</span> : <span className="text-slate-500">—</span>}</td>
                      <td>{dept.approved > 0 ? <span className="badge badge-success">{dept.approved}</span> : <span className="text-slate-500">—</span>}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.round(dept.avg_progress || 0)}%` }}></div>
                          </div>
                          <span className="text-xs font-medium">{Math.round(dept.avg_progress || 0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!data.deptBreakdown || data.deptBreakdown.length === 0) && (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400">No department data found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-panel p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-400" /> Recent Audit Activity</h3>
            <div className="space-y-3">
              {(data.recentAudit || []).slice(0, 5).map((log: any, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 flex-shrink-0"></div>
                  <div>
                    <p className="text-sm font-medium">{log.action}</p>
                    <p className="text-xs text-slate-400">{log.user_name} · {log.role}</p>
                  </div>
                </div>
              ))}
              {(!data.recentAudit || data.recentAudit.length === 0) && (
                <p className="text-slate-400 text-sm text-center py-4">No recent audit activity</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const StatCard = ({ icon, title, value }: { icon: React.ReactNode, title: string, value: string | number }) => (
  <div className="glass-panel p-5 flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300">
    <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700/50">
      {icon}
    </div>
    <div>
      <p className="text-sm text-slate-400 font-medium">{title}</p>
      <p className="text-2xl font-bold font-display">{value}</p>
    </div>
  </div>
);

export default Dashboard;
