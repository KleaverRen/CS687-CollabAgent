import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import Layout from "../components/Layout";
import NewProjectModal from "../components/NewProjectModal";
import ProjectCard from "../components/ProjectCard";
import StatCard from "../components/StatCard";
import ActivityFeed from "../components/ActivityFeed";
import DeleteConfirmationModal from "../components/DeleteConfirmationModal";
import toast from "react-hot-toast";

export default function Dashboard() {
  const { user } = useAuth();
  const isAdvisor = user?.role === "advisor";

  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const abortRef = useRef(null);

  // ── Fetch dashboard data ──────────────────────────────────────────────────
  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setStatsError(false);

    try {
      const [pRes, sRes] = await Promise.all([
        api.get("/projects", { signal: controller.signal }),
        api.get("/users/dashboard-stats", { signal: controller.signal }),
      ]);
      setProjects(pRes.data.projects);
      setStats(sRes.data.stats);
    } catch (err) {
      if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
      toast.error("Failed to load dashboard data.");
      setStatsError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [loadDashboard]);

  // ── Delete project ────────────────────────────────────────────────────────
  const handleDeleteClick = useCallback(
    (id) => {
      const project = projects.find((p) => p.id === id);
      if (project) setProjectToDelete(project);
    },
    [projects],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/projects/${projectToDelete.id}`);
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
      toast.success("Project deleted.");
      setProjectToDelete(null);
    } catch {
      toast.error("Failed to delete project.");
    } finally {
      setIsDeleting(false);
    }
  }, [projectToDelete]);

  // ── Escape key closes delete modal ────────────────────────────────────────
  useEffect(() => {
    if (!projectToDelete) return;
    const handleEsc = (e) => {
      if (e.key === "Escape" && !isDeleting) setProjectToDelete(null);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [projectToDelete, isDeleting]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const displayProjects = projects.filter(
    (p) => p.status === "active" || p.status === "in_progress",
  );
  const allProjects = displayProjects.length > 0 ? displayProjects : projects;
  const recentProjects = allProjects.slice(0, 6);

  return (
    <Layout activePath="/dashboard">
      <div className="p-5 md:p-8 max-w-6xl mx-auto">
        {/* ── Welcome header ─────────────────────────────────────────── */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#191c1d]">
              Welcome back, {user?.full_name || "Demo User"} 👋
            </h1>
            <p className="text-sm text-[#555f6d] mt-1">
              {user?.institution || "Your research workspace"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Refresh button */}
            <button
              onClick={() => loadDashboard({ silent: true })}
              disabled={refreshing}
              className="h-10 w-10 flex items-center justify-center rounded-xl border border-[#e1e3e4] text-[#555f6d] hover:bg-[#f3f4f5] disabled:opacity-50 transition-colors"
              title="Refresh dashboard"
            >
              <svg
                className={`w-4 h-4 transition-transform ${refreshing ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            {isAdvisor && (
              <button
                onClick={() => setShowNewProject(true)}
                className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-[#003fb1] text-white text-sm font-bold rounded-xl hover:bg-[#1353d8] transition-colors shadow-sm"
              >
                <span className="text-lg leading-none">+</span> New Project
              </button>
            )}
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────── */}
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

        {statsError && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#e1e3e4] bg-[#f8f9fb] px-4 py-3 text-sm text-[#555f6d]">
            <span>⚠️</span>
            <span className="flex-1">Some stats could not be loaded.</span>
            <button
              onClick={() => loadDashboard({ silent: true })}
              className="text-xs font-bold text-[#003fb1] hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Main content: Projects + Activity Feed ─────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {/* Recent Projects header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#191c1d]">
                Recent Projects
              </h2>
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

            {/* Projects grid / loading / empty */}
            {loading ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl p-5 border border-[#e1e3e4] animate-pulse"
                  >
                    <div className="h-4 bg-[#e1e3e4] rounded w-3/4 mb-3" />
                    <div className="h-3 bg-[#e1e3e4] rounded w-full mb-2" />
                    <div className="h-3 bg-[#e1e3e4] rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : recentProjects.length === 0 ? (
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
              <div className="grid sm:grid-cols-2 gap-4">
                {recentProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onDelete={isAdvisor ? handleDeleteClick : null}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Activity Feed sidebar ─────────────────────────────────── */}
          <div className="lg:col-span-1">
            <ActivityFeed title="Recent Activity" />
          </div>
        </div>
      </div>

      {/* ── New Project modal ──────────────────────────────────────────── */}
      {showNewProject && isAdvisor && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreate={(p) => setProjects((prev) => [p, ...prev])}
        />
      )}

      {/* ── Delete confirmation modal ─────────────────────────────────── */}
      <DeleteConfirmationModal
        open={!!projectToDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${projectToDelete?.name}"? This action is permanent and will remove all associated tasks, documents, and agent logs.`}
        confirmLabel="Delete Project"
        loading={isDeleting}
        onCancel={() => setProjectToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </Layout>
  );
}
