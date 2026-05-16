import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import NewProjectModal from '../components/NewProjectModal';
import ProjectCard from '../components/ProjectCard';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['active', 'paused', 'completed', 'archived'];
const QUARTERS = ['Fall', 'Winter', 'Spring', 'Summer'];

export default function ProjectsDirectory() {
  const { user } = useAuth();
  const isAdvisor = user?.role === 'advisor';
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState('');
  const [quarter, setQuarter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);

  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      try {
        const params = {};
        if (status) params.status = status;
        if (quarter) params.quarter = quarter;
        const { data } = await api.get('/projects', { params });
        setProjects(data.projects || []);
      } catch {
        toast.error('Failed to load projects.');
      } finally {
        setLoading(false);
      }
    };
    loadProjects();
  }, [status, quarter]);

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

  return (
    <Layout activePath="/projects">
      <div className="p-5 md:p-8 max-w-6xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#191c1d]">Projects</h1>
            <p className="text-sm text-[#555f6d] mt-1">Browse active and archived research workspaces.</p>
          </div>
          {isAdvisor && (
            <button
              onClick={() => setShowNewProject(true)}
              className="h-10 px-5 bg-[#003fb1] text-white text-sm font-bold rounded-xl hover:bg-[#1353d8] transition-colors"
            >
              + New Project
            </button>
          )}
        </div>

        <div className="bg-white border border-[#e1e3e4] rounded-2xl p-4 mb-6 flex flex-col sm:flex-row gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 px-3 rounded-xl border border-[#c3c5d7] text-sm focus:border-[#003fb1] outline-none bg-white"
          >
            <option value="">All statuses</option>
            {STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-[#c3c5d7] text-sm focus:border-[#003fb1] outline-none bg-white"
          >
            <option value="">All quarters</option>
            {QUARTERS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
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
            <h3 className="font-semibold text-[#191c1d] mb-2">No projects found</h3>
            <p className="text-sm text-[#555f6d] mb-5">Create a project or adjust the filters.</p>
            {isAdvisor && <button onClick={() => setShowNewProject(true)} className="px-5 py-2.5 bg-[#003fb1] text-white text-sm font-bold rounded-xl hover:bg-[#1353d8] transition-colors">
              + Create Project
            </button>}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onDelete={isAdvisor ? handleDelete : null} />
            ))}
          </div>
        )}
      </div>

      {showNewProject && isAdvisor && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreate={(project) => setProjects([project, ...projects])}
        />
      )}
    </Layout>
  );
}
