import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const Checkins: React.FC = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuarter, setSelectedQuarter] = useState('Q1');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get(`/reports/completion?quarter=${selectedQuarter}`);
        setData(res.data.employees);
      } catch (error) {
        toast.error('Failed to load check-ins');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedQuarter]);

  if (loading) return <div className="animate-pulse h-64 bg-slate-800/50 rounded-xl"></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6">
        <div>
          <h2 className="text-2xl font-bold font-display">Quarterly Check-ins</h2>
          <p className="text-slate-400 mt-1">Track employee progress updates and conduct reviews.</p>
        </div>
        <div>
          <select value={selectedQuarter} onChange={e => setSelectedQuarter(e.target.value)} className="form-control bg-slate-800">
            <option value="Q1">Q1 Check-in (Jul)</option>
            <option value="Q2">Q2 Check-in (Oct)</option>
            <option value="Q3">Q3 Check-in (Jan)</option>
            <option value="Q4">Annual Review (Apr)</option>
          </select>
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="table-container border-0 rounded-none bg-transparent">
          <table className="table">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Goals</th>
                <th>Employee Update Status</th>
                <th>Manager Review</th>
              </tr>
            </thead>
            <tbody>
              {data.map((emp: any) => (
                <tr key={emp.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-xs">
                        {emp.name.substring(0,2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold">{emp.name}</p>
                        <p className="text-xs text-slate-400">{emp.department}</p>
                      </div>
                    </div>
                  </td>
                  <td>{emp.total_goals}</td>
                  <td>
                    {emp.pending_checkins === 0 && emp.total_goals > 0 ? (
                      <span className="badge badge-success">Completed</span>
                    ) : emp.total_goals > 0 ? (
                      <span className="badge badge-warning">{emp.pending_checkins} Pending Updates</span>
                    ) : (
                      <span className="badge badge-secondary">No Goals</span>
                    )}
                  </td>
                  <td>
                    <button 
                      className={`btn btn-sm ${emp.pending_checkins === 0 && emp.total_goals > 0 ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed'}`}
                      disabled={emp.pending_checkins > 0 || emp.total_goals === 0}
                      onClick={() => toast('Detailed check-in module coming in next phase')}
                    >
                      Conduct Review
                    </button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-slate-400">No team members found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Checkins;
