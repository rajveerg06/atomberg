import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save } from 'lucide-react';

const GoalForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [thrustAreas, setThrustAreas] = useState([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    cycle_id: '',
    thrust_area_id: '',
    title: '',
    description: '',
    uom_type: 'numeric',
    min_max: 'max',
    target_value: '',
    target_date: '',
    weightage: 10
  });

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [areasRes, cyclesRes] = await Promise.all([
          api.get('/thrust-areas'),
          api.get('/cycles/active')
        ]);
        setThrustAreas(areasRes.data);
        setCycles([cyclesRes.data]);

        if (!isEdit) {
          setFormData(prev => ({ ...prev, cycle_id: cyclesRes.data.id, thrust_area_id: areasRes.data[0]?.id || '' }));
        }
      } catch (error) {
        console.error('Failed to fetch metadata', error);
      }
    };

    fetchMetadata();

    if (isEdit) {
      const fetchGoal = async () => {
        try {
          const res = await api.get(`/goals/${id}`);
          const goal = res.data;
          setFormData({
            cycle_id: goal.cycle_id,
            thrust_area_id: goal.thrust_area_id,
            title: goal.title,
            description: goal.description || '',
            uom_type: goal.uom_type,
            min_max: goal.min_max,
            target_value: goal.target_value || '',
            target_date: goal.target_date || '',
            weightage: goal.weightage
          });
        } catch (error) {
          toast.error('Failed to fetch goal details');
          navigate('/goals');
        } finally {
          setLoading(false);
        }
      };
      fetchGoal();
    }
  }, [id, isEdit, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...formData,
        target_value: formData.target_value === '' ? null : Number(formData.target_value),
        weightage: Number(formData.weightage)
      };

      if (isEdit) {
        await api.put(`/goals/${id}`, payload);
        toast.success('Goal updated successfully');
      } else {
        await api.post('/goals', payload);
        toast.success('Goal created successfully');
      }
      navigate('/goals');
    } catch (error: any) {
      toast.error(error.response?.data?.error || `Failed to ${isEdit ? 'update' : 'create'} goal`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="animate-pulse h-96 bg-slate-800/50 rounded-xl"></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link to="/goals" className="p-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold font-display">{isEdit ? 'Edit Goal' : 'Create New Goal'}</h2>
          <p className="text-slate-400">Define your objective and how it will be measured.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel p-6 md:p-8">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="form-group mb-0">
              <label className="form-label">Goal Cycle</label>
              <select name="cycle_id" value={formData.cycle_id} onChange={handleChange} className="form-control" required disabled={isEdit}>
                <option value="">Select Cycle</option>
                {cycles.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group mb-0">
              <label className="form-label">Thrust Area</label>
              <select name="thrust_area_id" value={formData.thrust_area_id} onChange={handleChange} className="form-control" required>
                <option value="">Select Thrust Area</option>
                {thrustAreas.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group mb-0">
            <label className="form-label">Goal Title</label>
            <input type="text" name="title" value={formData.title} onChange={handleChange} className="form-control" placeholder="E.g., Achieve ₹50L Revenue in Q1" required maxLength={150} />
          </div>

          <div className="form-group mb-0">
            <label className="form-label">Description (Optional)</label>
            <textarea name="description" value={formData.description} onChange={handleChange} className="form-control" rows={3} placeholder="Provide more context about this goal..."></textarea>
          </div>

          <div className="p-5 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <h4 className="font-semibold mb-4 text-indigo-300">Measurement & Targets</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group mb-0">
                <label className="form-label">Unit of Measurement (UoM)</label>
                <select name="uom_type" value={formData.uom_type} onChange={handleChange} className="form-control" required>
                  <option value="numeric">Numeric Value (e.g., ₹, Count)</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="timeline">Timeline / Date</option>
                  <option value="zero">Zero-based (Defect reduction)</option>
                </select>
              </div>

              {(formData.uom_type === 'numeric' || formData.uom_type === 'percentage') && (
                <div className="form-group mb-0">
                  <label className="form-label">Target Type</label>
                  <select name="min_max" value={formData.min_max} onChange={handleChange} className="form-control" required>
                    <option value="max">Higher is Better (Maximize)</option>
                    <option value="min">Lower is Better (Minimize)</option>
                  </select>
                </div>
              )}

              {formData.uom_type !== 'zero' && formData.uom_type !== 'timeline' && (
                <div className="form-group mb-0">
                  <label className="form-label">Target Value</label>
                  <input type="number" name="target_value" value={formData.target_value} onChange={handleChange} className="form-control" required min="0" step="any" placeholder="E.g., 5000000" />
                </div>
              )}

              {formData.uom_type === 'timeline' && (
                <div className="form-group mb-0">
                  <label className="form-label">Target Date</label>
                  <input type="date" name="target_date" value={formData.target_date} onChange={handleChange} className="form-control" required />
                </div>
              )}

              <div className="form-group mb-0">
                <label className="form-label">Weightage (%)</label>
                <div className="flex items-center gap-3">
                  <input type="range" name="weightage" min="10" max="100" step="5" value={formData.weightage} onChange={handleChange} className="flex-1 accent-indigo-500" />
                  <span className="font-bold text-lg w-12 text-right">{formData.weightage}%</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Must be between 10% and 100%. Total of all goals must equal 100%.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-700/50">
          <Link to="/goals" className="btn btn-ghost">Cancel</Link>
          <button type="submit" disabled={saving} className="btn btn-primary">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : (isEdit ? 'Update Goal' : 'Create Goal')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default GoalForm;
