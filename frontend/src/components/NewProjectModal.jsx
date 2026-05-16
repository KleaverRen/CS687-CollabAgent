import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const QUARTERS = ['Fall', 'Winter', 'Spring', 'Summer'];

export default function NewProjectModal({ onClose, onCreate }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: '',
    description: '',
    advisor_name: user?.full_name || '',
    visibility: 'private',
    quarter: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const payload = { ...form, quarter: form.quarter || null };
      const { data } = await api.post('/projects', payload);
      onCreate(data.project);
      toast.success('Project created!');
      onClose();
    } catch {
      toast.error('Failed to create project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="text-xl font-bold text-[#191c1d] mb-5">New Research Project</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#434654] uppercase tracking-wider mb-1.5">Project Name *</label>
            <input
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Quantum Entanglement Study"
              required
              className="w-full h-11 px-4 rounded-lg border border-[#c3c5d7] text-sm focus:border-[#003fb1] focus:ring-2 focus:ring-[#003fb1]/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#434654] uppercase tracking-wider mb-1.5">Advisor Name *</label>
            <input
              disabled
              value={form.advisor_name} onChange={(e) => setForm({ ...form, advisor_name: e.target.value })}
              placeholder="e.g. Dr. Jane Smith"
              required
              className="w-full h-11 px-4 rounded-lg border border-[#c3c5d7] text-sm focus:border-[#003fb1] focus:ring-2 focus:ring-[#003fb1]/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#434654] uppercase tracking-wider mb-1.5">Description</label>
            <textarea
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Briefly describe the research focus..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-[#c3c5d7] text-sm focus:border-[#003fb1] focus:ring-2 focus:ring-[#003fb1]/20 outline-none transition-all resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#434654] uppercase tracking-wider mb-1.5">Quarter</label>
              <select
                value={form.quarter} onChange={(e) => setForm({ ...form, quarter: e.target.value })}
                className="w-full h-11 px-4 rounded-lg border border-[#c3c5d7] text-sm focus:border-[#003fb1] outline-none bg-white"
              >
                <option value="">Not set</option>
                {QUARTERS.map((quarter) => <option key={quarter} value={quarter}>{quarter}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#434654] uppercase tracking-wider mb-1.5">Visibility</label>
              <select
                value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}
                className="w-full h-11 px-4 rounded-lg border border-[#c3c5d7] text-sm focus:border-[#003fb1] outline-none bg-white"
              >
                <option value="private">Private</option>
                <option value="institution">Institution</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-11 text-sm font-semibold border border-[#c3c5d7] rounded-xl hover:bg-[#f3f4f5] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 h-11 bg-[#003fb1] text-white text-sm font-bold rounded-xl hover:bg-[#1353d8] disabled:opacity-60 transition-colors">
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
