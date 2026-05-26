import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import Layout from "../components/Layout";
import NewProjectModal from "../components/NewProjectModal";
import ProjectCard from "../components/ProjectCard";
import toast from "react-hot-toast";

function DeleteConfirmationModal({ projectName, onConfirm, onClose, loading }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl animate-fadeIn">
        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-5">
          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-[#191c1d] mb-2">Delete Project</h3>
        <p className="text-sm text-[#555f6d] mb-6">
          Are you sure you want to delete <span className="font-bold text-[#191c1d]">"{projectName}"</span>? 
          This action is permanent and will remove all associated tasks, documents, and agent logs.
        </p>
        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 h-11 text-sm font-semibold border border-[#c3c5d7] rounded-xl hover:bg-[#f3f4f5] transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-11 bg-[#ba1a1a] text-white text-sm font-bold rounded-xl hover:bg-[#931515] disabled:opacity-60 transition-colors"
          >
            {loading ? 'Deleting...' : 'Delete Project'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <div className="bg-white border border-[#e1e3e4] rounded-2xl p-5 flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${color}`}
      >
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-[#191c1d]">{value ?? "—"}</div>
        <div className="text-xs text-[#555f6d] font-medium">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdvisor = user?.role === "advisor";
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [pRes, sRes] = await Promise.all([
          api.get("/projects"),
          api.get("/users/dashboard-stats"),
        ]);
        setProjects(pRes.data.projects);
        setStats(sRes.data.stats);
      } catch {
        toast.error("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handleDeleteClick = (id) => {
    const project = projects.find(p => p.id === id);
    if (project) setProjectToDelete(project);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/projects/${projectToDelete.id}`);
      setProjects(projects.filter((p) => p.id !== projectToDelete.id));
      toast.success("Project deleted.");
      setProjectToDelete(null);
    } catch {
      toast.error("Failed to delete project.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Layout activePath="/dashboard">
      <div className="p-5 md:p-8 max-w-6xl mx-auto">
        {/* Welcome */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#191c1d]">
              Welcome back, {user?.full_name || "Demo User"} 👋
            </h1>
            <p className="text-sm text-[#555f6d] mt-1">
              {user?.institution || "Your research workspace"}
            </p>
          </div>
          {isAdvisor && (
            <button
              onClick={() => setShowNewProject(true)}
              className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-[#003fb1] text-white text-sm font-bold rounded-xl hover:bg-[#1353d8] transition-colors shadow-sm"
            >
              <span className="text-lg leading-none">+</span> New Project
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Projects"
            value={stats?.total_projects}
            color="bg-[#d6e0f1]"
            icon="📁"
          />
          <StatCard
            label="Active Projects"
            value={stats?.active_projects}
            color="bg-[#81f9c1]/30"
            icon="🟢"
          />
          <StatCard
            label="Collaborations"
            value={stats?.collaborations}
            color="bg-[#dbe1ff]"
            icon="👥"
          />
          <StatCard
            label="Documents"
            value={stats?.total_documents}
            color="bg-[#f3f4f5]"
            icon="📄"
          />
        </div>

        {/* AI Banner */}
        <div className="bg-gradient-to-r from-[#003fb1] to-[#1353d8] rounded-2xl p-5 mb-8 flex items-center gap-4">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
            🧠
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">
              3 AI Agents Active
            </p>
            <p className="text-[#dbe1ff] text-xs mt-0.5">
              Knowledge base indexing 1.2M docs — 75% complete
            </p>
          </div>
          <div className="flex-1 hidden md:block max-w-32">
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-[#63dca6] w-3/4 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Recent Projects */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[#191c1d]">Recent Projects</h2>
          <div className="flex items-center gap-2">
            <Link
              to="/projects"
              className="text-xs font-bold text-[#003fb1] hover:underline"
            >
              View all
            </Link>
            {isAdvisor && (
              <button
                onClick={() => setShowNewProject(true)}
                className="md:hidden flex items-center gap-1.5 px-4 py-2 bg-[#003fb1] text-white text-xs font-bold rounded-xl"
              >
                + New
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-5 border border-[#e1e3e4] animate-pulse"
              >
                <div className="h-4 bg-[#e1e3e4] rounded w-3/4 mb-3"></div>
                <div className="h-3 bg-[#e1e3e4] rounded w-full mb-2"></div>
                <div className="h-3 bg-[#e1e3e4] rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white border border-dashed border-[#c3c5d7] rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">📁</div>
            <h3 className="font-semibold text-[#191c1d] mb-2">
              No projects yet
            </h3>
            <p className="text-sm text-[#555f6d] mb-5">
              Create your first research project to get started.
            </p>
            {isAdvisor && (
              <button
                onClick={() => setShowNewProject(true)}
                className="px-5 py-2.5 bg-[#003fb1] text-white text-sm font-bold rounded-xl hover:bg-[#1353d8] transition-colors"
              >
                + Create First Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.slice(0, 3).map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onDelete={isAdvisor ? handleDeleteClick : null}
              />
            ))}
          </div>
        )}
      </div>

      {showNewProject && isAdvisor && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreate={(p) => setProjects([p, ...projects])}
        />
      )}

      {projectToDelete && (
        <DeleteConfirmationModal 
          projectName={projectToDelete.name}
          loading={isDeleting}
          onClose={() => setProjectToDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </Layout>
  );
}
