import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../utils/api';
import toast from 'react-hot-toast';

const BG_COLORS = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-pink-500', 'bg-orange-500'];

function Avatar({ name }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const color = BG_COLORS[(name?.charCodeAt(0) || 0) % BG_COLORS.length];
  return (
    <div className={`w-8 h-8 rounded-full ${color} text-white flex items-center justify-center text-xs font-bold ring-2 ring-white`}>
      {initials}
    </div>
  );
}

export default function ProjectOverview() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);

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

  const roleLabel = { researcher: '🔬 Researcher', project_lead: '📊 Project Lead', faculty: '🎓 Faculty', student: '📚 Student' };

  return (
    <Layout activePath={`/projects/${id}`} projectId={id}>
      <div className="p-5 md:p-8 max-w-6xl mx-auto space-y-6">

          {/* Top Section */}
          <div className="bg-white rounded-2xl p-6 border border-[#e1e3e4] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-[#191c1d]">{project.name}</h1>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusColor}`}>
                  {statusText}
                </span>
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
                      <Link to="/tasks" className="text-[#003fb1] hover:underline">View in Board &rarr;</Link>
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
    </Layout>
  );
}
