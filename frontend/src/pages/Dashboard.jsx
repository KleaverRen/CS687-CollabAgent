import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

function StatCard({ label, value, color, icon }) {
  return (
    <div className="bg-white border border-[#e1e3e4] rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${color}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold text-[#191c1d]">{value ?? '—'}</div>
        <div className="text-xs text-[#555f6d] font-medium">{label}</div>
      </div>
    </div>
  );
}

function ProjectCard({ project, onDelete }) {
  const statusColors = {
    active: 'bg-[#d6e0f1] text-[#003fb1]',
    completed: 'bg-[#81f9c1]/30 text-[#005438]',
    archived: 'bg-[#e1e3e4] text-[#555f6d]',
    paused: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <div className="bg-white border border-[#e1e3e4] rounded-2xl p-5 hover:border-[#003fb1] hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-[#191c1d] group-hover:text-[#003fb1] transition-colors line-clamp-1">{project.name}</h3>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ml-2 whitespace-nowrap ${statusColors[project.status] || statusColors.active}`}>
          {project.status}
        </span>
      </div>
      <p className="text-sm text-[#555f6d] line-clamp-2 mb-4">{project.description || 'No description provided.'}</p>
      <div className="flex items-center gap-4 text-xs text-[#737686] mb-4">
        <span>👥 {project.member_count || 0} members</span>
        <span>📄 {project.doc_count || 0} docs</span>
        <span>🤖 {project.agent_count || 0} agents</span>
      </div>
      <div className="flex gap-2">
        <button className="flex-1 h-8 text-xs font-semibold text-[#003fb1] border border-[#003fb1] rounded-lg hover:bg-[#f0f4ff] transition-colors">
          Open
        </button>
        <button
          onClick={() => onDelete(project.id)}
          className="h-8 w-8 flex items-center justify-center text-[#ba1a1a] border border-[#e1e3e4] rounded-lg hover:bg-[#ffdad6] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function NewProjectModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', description: '', visibility: 'private' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/projects', form);
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
            <label className="block text-xs font-semibold text-[#434654] uppercase tracking-wider mb-1.5">Description</label>
            <textarea
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Briefly describe the research focus..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-[#c3c5d7] text-sm focus:border-[#003fb1] focus:ring-2 focus:ring-[#003fb1]/20 outline-none transition-all resize-none"
            />
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
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-11 text-sm font-semibold border border-[#c3c5d7] rounded-xl hover:bg-[#f3f4f5] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 h-11 bg-[#003fb1] text-white text-sm font-bold rounded-xl hover:bg-[#1353d8] disabled:opacity-60 transition-colors">
              {loading ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [pRes, sRes] = await Promise.all([
          api.get('/projects'),
          api.get('/users/dashboard-stats'),
        ]);
        setProjects(pRes.data.projects);
        setStats(sRes.data.stats);
      } catch {
        toast.error('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this project? This action cannot be undone.')) return;
    try {
      await api.delete(`/projects/${id}`);
      setProjects(projects.filter((p) => p.id !== id));
      toast.success('Project deleted.');
    } catch {
      toast.error('Failed to delete project.');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const roleLabel = { researcher: '🔬 Researcher', project_lead: '📊 Project Lead', faculty: '🎓 Faculty', student: '📚 Student' };

  return (
    <div className="min-h-screen bg-[#f3f4f5] font-['Inter',sans-serif]">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-[#e1e3e4] z-30">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#e1e3e4]">
          <svg className="w-6 h-6 text-[#003fb1]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
          </svg>
          <span className="font-bold text-[#003fb1] text-lg">CollabAgent</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {[
            { label: 'Dashboard', icon: '🏠', active: true },
            { label: 'Projects', icon: '📁' },
            { label: 'Agents', icon: '🤖' },
            { label: 'Knowledge Base', icon: '🧠' },
            { label: 'Analytics', icon: '📈' },
            { label: 'Settings', icon: '⚙️' },
          ].map((item) => (
            <button key={item.label} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${item.active ? 'bg-[#d6e0f1] text-[#003fb1]' : 'text-[#434654] hover:bg-[#f3f4f5]'}`}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-[#e1e3e4]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#003fb1] text-white flex items-center justify-center text-sm font-bold">
              {user?.full_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#191c1d] truncate">{user?.full_name}</p>
              <p className="text-xs text-[#737686] truncate">{roleLabel[user?.role] || user?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full h-9 text-xs font-semibold text-[#ba1a1a] border border-[#e1e3e4] rounded-lg hover:bg-[#ffdad6] transition-colors">
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-[#e1e3e4] flex items-center px-4 h-14">
        <div className="flex items-center gap-2 flex-1">
          <svg className="w-5 h-5 text-[#003fb1]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
          </svg>
          <span className="font-bold text-[#003fb1]">CollabAgent</span>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 text-[#434654]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"} />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute top-14 left-0 right-0 bg-white border-b border-[#e1e3e4] p-4 space-y-2 shadow-lg">
            {['Dashboard', 'Projects', 'Agents', 'Knowledge Base', 'Analytics'].map((i) => (
              <button key={i} className="w-full text-left px-3 py-2.5 text-sm text-[#434654] hover:bg-[#f3f4f5] rounded-lg">{i}</button>
            ))}
            <button onClick={handleLogout} className="w-full text-left px-3 py-2.5 text-sm text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg">Sign Out</button>
          </div>
        )}
      </header>

      {/* Main content */}
      <div className="md:ml-60 pt-14 md:pt-0">
        <div className="p-5 md:p-8 max-w-6xl">
          {/* Welcome */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#191c1d]">
                Welcome back, {user?.full_name?.split(' ')[0]} 👋
              </h1>
              <p className="text-sm text-[#555f6d] mt-1">{user?.institution || 'Your research workspace'}</p>
            </div>
            <button
              onClick={() => setShowNewProject(true)}
              className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-[#003fb1] text-white text-sm font-bold rounded-xl hover:bg-[#1353d8] transition-colors shadow-sm"
            >
              <span className="text-lg leading-none">+</span> New Project
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Projects" value={stats?.total_projects} color="bg-[#d6e0f1]" icon="📁" />
            <StatCard label="Active Projects" value={stats?.active_projects} color="bg-[#81f9c1]/30" icon="🟢" />
            <StatCard label="Collaborations" value={stats?.collaborations} color="bg-[#dbe1ff]" icon="👥" />
            <StatCard label="Documents" value={stats?.total_documents} color="bg-[#f3f4f5]" icon="📄" />
          </div>

          {/* AI Banner */}
          <div className="bg-gradient-to-r from-[#003fb1] to-[#1353d8] rounded-2xl p-5 mb-8 flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🧠</div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">3 AI Agents Active</p>
              <p className="text-[#dbe1ff] text-xs mt-0.5">Knowledge base indexing 1.2M docs — 75% complete</p>
            </div>
            <div className="flex-1 hidden md:block max-w-32">
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-[#63dca6] w-3/4 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Projects */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-[#191c1d]">Your Projects</h2>
            <button onClick={() => setShowNewProject(true)} className="md:hidden flex items-center gap-1.5 px-4 py-2 bg-[#003fb1] text-white text-xs font-bold rounded-xl">
              + New
            </button>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-5 border border-[#e1e3e4] animate-pulse">
                  <div className="h-4 bg-[#e1e3e4] rounded w-3/4 mb-3"></div>
                  <div className="h-3 bg-[#e1e3e4] rounded w-full mb-2"></div>
                  <div className="h-3 bg-[#e1e3e4] rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="bg-white border border-dashed border-[#c3c5d7] rounded-2xl p-12 text-center">
              <div className="text-4xl mb-3">📁</div>
              <h3 className="font-semibold text-[#191c1d] mb-2">No projects yet</h3>
              <p className="text-sm text-[#555f6d] mb-5">Create your first research project to get started.</p>
              <button onClick={() => setShowNewProject(true)} className="px-5 py-2.5 bg-[#003fb1] text-white text-sm font-bold rounded-xl hover:bg-[#1353d8] transition-colors">
                + Create First Project
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreate={(p) => setProjects([p, ...projects])}
        />
      )}
    </div>
  );
}
