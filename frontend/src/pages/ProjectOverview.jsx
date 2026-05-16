import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const BG_COLORS = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-pink-500', 'bg-orange-500'];
const QUARTERS = ['Fall', 'Winter', 'Spring', 'Summer'];
const PROJECT_STATUSES = ['active', 'paused', 'completed', 'archived'];
const VISIBILITY_OPTIONS = ['private', 'institution', 'public'];

function Avatar({ name }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const color = BG_COLORS[(name?.charCodeAt(0) || 0) % BG_COLORS.length];
  return (
    <div className={`w-8 h-8 rounded-full ${color} text-white flex items-center justify-center text-xs font-bold ring-2 ring-white`}>
      {initials}
    </div>
  );
}

function EditProjectModal({ project, onClose, onSave }) {
  const [form, setForm] = useState({
    name: project.name || '',
    advisor_name: project.advisor_name || '',
    description: project.description || '',
    quarter: project.quarter || '',
    status: project.status || 'active',
    visibility: project.visibility || 'private',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.advisor_name.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, quarter: form.quarter || null };
      const { data } = await api.put(`/projects/${project.id}`, payload);
      onSave(data.project);
      toast.success('Project updated.');
      onClose();
    } catch {
      toast.error('Failed to update project.');
    } finally {
      setSaving(false);
    }
  };

  const labelCls = 'block text-xs font-semibold text-[#434654] uppercase tracking-wider mb-1.5';
  const inputCls = 'w-full h-11 px-4 rounded-lg border border-[#c3c5d7] text-sm focus:border-[#003fb1] focus:ring-2 focus:ring-[#003fb1]/20 outline-none transition-all bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-7 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#191c1d]">Edit Project</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f3f4f5] text-[#737686]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Project Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Supervisor *</label>
            <input
              value={form.advisor_name}
              onChange={(e) => setForm({ ...form, advisor_name: e.target.value })}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-[#c3c5d7] text-sm focus:border-[#003fb1] focus:ring-2 focus:ring-[#003fb1]/20 outline-none transition-all resize-none"
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Quarter</label>
              <select
                value={form.quarter}
                onChange={(e) => setForm({ ...form, quarter: e.target.value })}
                className={inputCls}
              >
                <option value="">Not set</option>
                {QUARTERS.map((quarter) => <option key={quarter} value={quarter}>{quarter}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={inputCls}
              >
                {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Visibility</label>
              <select
                value={form.visibility}
                onChange={(e) => setForm({ ...form, visibility: e.target.value })}
                className={inputCls}
              >
                {VISIBILITY_OPTIONS.map((visibility) => <option key={visibility} value={visibility}>{visibility}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-11 text-sm font-semibold border border-[#c3c5d7] rounded-xl hover:bg-[#f3f4f5] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 h-11 bg-[#003fb1] text-white text-sm font-bold rounded-xl hover:bg-[#1353d8] disabled:opacity-60 transition-colors">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddStudentModal({ projectId, onClose, onAdd }) {
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/members`, { email });
      onAdd(data.member);
      toast.success('Student assigned.');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign student.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="text-xl font-bold text-[#191c1d] mb-5">Assign Student</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#434654] uppercase tracking-wider mb-1.5">Student Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@institution.edu"
              required
              className="w-full h-11 px-4 rounded-lg border border-[#c3c5d7] text-sm focus:border-[#003fb1] focus:ring-2 focus:ring-[#003fb1]/20 outline-none transition-all"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-11 text-sm font-semibold border border-[#c3c5d7] rounded-xl hover:bg-[#f3f4f5] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 h-11 bg-[#003fb1] text-white text-sm font-bold rounded-xl hover:bg-[#1353d8] disabled:opacity-60 transition-colors">
              {saving ? 'Assigning...' : 'Assign Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectOverview() {
  const { id } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/projects/${id}`),
      api.get(`/tasks?project_id=${id}`)
    ])
      .then(([pRes, tRes]) => {
        setProject(pRes.data.project);
        setTasks(tRes.data.tasks);
      })
      .catch(() => toast.error('Failed to load project details.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="min-h-screen bg-[#f3f4f5] flex items-center justify-center">Loading...</div>;
  }

  if (!project) {
    return <div className="min-h-screen bg-[#f3f4f5] flex items-center justify-center">Project not found</div>;
  }

  const isArchived = project.status === 'archived';
  const isOwner = project.owner_id === user?.id && user?.role === 'advisor';

  // --- KPI Calculations ---
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const blockedTasks = tasks.filter(t => t.status === 'blocked').length;
  const completionPct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  let statusText = 'On Track';
  let statusColor = 'bg-[#81f9c1]/30 text-[#005438]';
  if (blockedTasks > 0) {
    statusText = `${blockedTasks} Blocked Tasks`;
    statusColor = 'bg-red-100 text-red-700';
  } else if (completionPct === 100 && totalTasks > 0) {
    statusText = 'Completed';
    statusColor = 'bg-slate-200 text-slate-700';
  }
  if (isArchived) {
    statusText = 'Archived';
    statusColor = 'bg-[#e1e3e4] text-[#555f6d]';
  }

  // --- Main Body Data ---
  // Milestone: highest priority open task
  const openTasks = tasks.filter(t => t.status !== 'done');
  const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
  const currentMilestone = openTasks.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority])[0];

  // Upcoming Deadlines: Open tasks with deadlines
  const upcomingDeadlines = openTasks
    .filter(t => t.deadline)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 4);

  // Recent Activity: Last 5 tasks by creation/update
  const recentActivity = [...tasks]
    .sort((a, b) => new Date(b.created_at || b.updated_at) - new Date(a.created_at || a.updated_at))
    .slice(0, 5);

  const handleArchiveToggle = async () => {
    setUpdatingStatus(true);
    const nextStatus = isArchived ? 'active' : 'archived';
    try {
      const { data } = await api.put(`/projects/${id}`, { status: nextStatus });
      setProject((prev) => ({ ...prev, ...data.project }));
      toast.success(nextStatus === 'archived' ? 'Project archived.' : 'Project restored.');
    } catch {
      toast.error('Failed to update project status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <Layout activePath={`/projects/${id}`} projectId={id}>
      <div className="p-5 md:p-8 max-w-6xl mx-auto space-y-6">
          {isArchived && (
            <div className="bg-[#e1e3e4] border border-[#c3c5d7] rounded-2xl px-5 py-4 text-sm text-[#434654]">
              This project is archived. Task data remains visible, but editing and workflow changes are disabled.
            </div>
          )}

          {/* Top Section */}
          <div className={`bg-white rounded-2xl p-6 border border-[#e1e3e4] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 ${isArchived ? 'grayscale opacity-80' : ''}`}>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-[#191c1d]">{project.name}</h1>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusColor}`}>
                  {statusText}
                </span>
                {project.quarter && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#f3f4f5] text-[#434654]">
                    {project.quarter}
                  </span>
                )}
              </div>
              <p className="text-sm text-[#555f6d] line-clamp-2 max-w-2xl">{project.description}</p>
              
              <div className="mt-4 flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[#737686]">Supervisor:</span>
                  <span className="font-semibold text-[#191c1d]">{project.advisor_name || 'Unassigned'}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2">
              {isOwner && (
                <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                  <button
                    onClick={() => setShowEditProject(true)}
                    className="h-9 px-4 text-xs font-bold rounded-xl bg-[#003fb1] text-white hover:bg-[#1353d8] transition-colors"
                  >
                    Edit Project
                  </button>
                  <button
                    onClick={() => setShowAddStudent(true)}
                    className="h-9 px-4 text-xs font-bold rounded-xl border border-[#003fb1] text-[#003fb1] hover:bg-[#f0f4ff] transition-colors"
                  >
                    Assign Student
                  </button>
                  <button
                    onClick={handleArchiveToggle}
                    disabled={updatingStatus}
                    className={`h-9 px-4 text-xs font-bold rounded-xl border transition-colors disabled:opacity-60 ${
                      isArchived
                        ? 'border-[#003fb1] text-[#003fb1] hover:bg-[#f0f4ff]'
                        : 'border-[#c3c5d7] text-[#434654] hover:bg-[#f3f4f5]'
                    }`}
                  >
                    {updatingStatus ? 'Updating...' : isArchived ? 'Restore Project' : 'Archive Project'}
                  </button>
                </div>
              )}
              <span className="text-xs font-bold text-[#737686] uppercase tracking-wider">Project Team</span>
              <div className="flex -space-x-2">
                {project.members?.slice(0, 5).map(m => (
                  <Avatar key={m.id} name={m.full_name} />
                ))}
                {(project.members?.length || 0) > 5 && (
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold ring-2 ring-white">
                    +{project.members.length - 5}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* KPI Section */}
          <div className="bg-white rounded-2xl p-6 border border-[#e1e3e4] shadow-sm">
            <div className="flex items-end justify-between mb-2">
              <div className="text-sm font-bold text-[#191c1d]">Completion Percentage</div>
              <div className="text-2xl font-black text-[#003fb1]">{completionPct}%</div>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#003fb1] to-[#1353d8] transition-all duration-1000 ease-out"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <div className="flex gap-4 mt-3 text-xs text-[#737686] font-medium">
              <div>{completedTasks} completed</div>
              <div>{totalTasks - completedTasks} remaining</div>
            </div>
          </div>

          {/* Main Body (2 Columns) */}
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Left Column */}
            <div className="md:col-span-2 space-y-6">
              
              {/* Current Milestone */}
              <div className="bg-white rounded-2xl p-6 border border-[#e1e3e4] shadow-sm">
                <h3 className="text-sm font-bold text-[#434654] uppercase tracking-wider mb-4">Current Priority Milestone</h3>
                {currentMilestone ? (
                  <div className="p-4 rounded-xl border border-[#003fb1]/20 bg-[#f0f4ff]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-[#003fb1] text-white text-[10px] font-bold rounded uppercase">
                        {currentMilestone.priority}
                      </span>
                      <span className="text-sm font-bold text-[#191c1d]">{currentMilestone.title}</span>
                    </div>
                    <p className="text-sm text-[#555f6d] mb-4">{currentMilestone.description || 'No description provided.'}</p>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <Avatar name={currentMilestone.assignee_name || 'Unassigned'} />
                        <span className={currentMilestone.assignee_name ? 'text-[#191c1d]' : 'text-slate-400'}>
                          {currentMilestone.assignee_name || 'Unassigned'}
                        </span>
                      </div>
                      <Link to={`/projects/${id}/tasks`} className="text-[#003fb1] hover:underline">View in Board &rarr;</Link>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-[#737686] italic">No active milestones.</div>
                )}
              </div>

              {/* Upcoming Deadlines */}
              <div className="bg-white rounded-2xl p-6 border border-[#e1e3e4] shadow-sm">
                <h3 className="text-sm font-bold text-[#434654] uppercase tracking-wider mb-4">Upcoming Deadlines</h3>
                <div className="space-y-3">
                  {upcomingDeadlines.length > 0 ? upcomingDeadlines.map(task => {
                    const daysLeft = Math.ceil((new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24));
                    const isOverdue = daysLeft < 0;
                    return (
                      <div key={task.id} className="flex items-center justify-between p-3 rounded-xl border border-[#e1e3e4] hover:border-[#003fb1]/40 transition-colors">
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="text-sm font-semibold text-[#191c1d] truncate">{task.title}</div>
                          <div className="text-xs text-[#737686] mt-0.5">Assigned to: {task.assignee_name || 'Unassigned'}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xs font-bold ${isOverdue ? 'text-red-600' : daysLeft <= 2 ? 'text-amber-600' : 'text-[#003fb1]'}`}>
                            {isOverdue ? 'Overdue' : daysLeft === 0 ? 'Due Today' : `Due in ${daysLeft} days`}
                          </div>
                          <div className="text-[10px] text-[#737686]">{new Date(task.deadline).toLocaleDateString()}</div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="text-sm text-[#737686] italic">No upcoming deadlines.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Recent Activity */}
            <div className="bg-white rounded-2xl p-6 border border-[#e1e3e4] shadow-sm h-full">
              <h3 className="text-sm font-bold text-[#434654] uppercase tracking-wider mb-6">Recent Activity</h3>
              <div className="relative border-l-2 border-[#e1e3e4] ml-3 space-y-6">
                {recentActivity.length > 0 ? recentActivity.map(task => (
                  <div key={task.id} className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 bg-white border-2 border-[#003fb1] rounded-full"></div>
                    <div className="text-xs font-semibold text-[#003fb1] mb-1">
                      {new Date(task.created_at || task.updated_at).toLocaleDateString()}
                    </div>
                    <div className="text-sm font-semibold text-[#191c1d] leading-tight mb-1">{task.title}</div>
                    <div className="text-xs text-[#737686]">
                      Status changed to <span className="font-bold">{task.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                )) : (
                  <div className="pl-6 text-sm text-[#737686] italic">No recent activity.</div>
                )}
              </div>
            </div>

          </div>
        </div>

        {showEditProject && (
          <EditProjectModal
            project={project}
            onClose={() => setShowEditProject(false)}
            onSave={(updatedProject) => setProject((prev) => ({ ...prev, ...updatedProject }))}
          />
        )}
        {showAddStudent && (
          <AddStudentModal
            projectId={id}
            onClose={() => setShowAddStudent(false)}
            onAdd={(member) => setProject((prev) => ({
              ...prev,
              members: [
                ...(prev.members || []).filter((item) => item.id !== member.id),
                member,
              ],
            }))}
          />
        )}
    </Layout>
  );
}
