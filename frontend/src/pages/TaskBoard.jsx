import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { TaskProvider, useTask } from '../context/TaskContext';
import TaskCard from '../components/TaskCard';
import AISuggestionDrawer from '../components/AISuggestionDrawer';
import DependencyGraph from '../components/DependencyGraph';
import AffinityScorer from '../components/AffinityScorer';
import Layout from '../components/Layout';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

const COLUMNS = [
  { id: 'todo',        label: 'To Do',       color: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400'   },
  { id: 'in_progress', label: 'In Progress',  color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500'    },
  { id: 'blocked',     label: 'Blocked',      color: 'bg-red-100 text-red-700',       dot: 'bg-red-500'     },
  { id: 'done',        label: 'Done',         color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
];

// ─── New Task Modal ───────────────────────────────────────────────────────────
function NewTaskModal({ projectId, onClose }) {
  const { createTask } = useTask();
  const [form, setForm] = useState({
    title: '', description: '', priority: 'low', deadline: '', estimated_hours: '', tags: '', assigned_to: null,
  });
  const [saving, setSaving] = useState(false);
  const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    await createTask({
      project_id: projectId, title: form.title, description: form.description,
      priority: form.priority, deadline: form.deadline || null,
      estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
      tags, assigned_to: form.assigned_to || null,
    });
    setSaving(false);
    onClose();
  };

  const labelCls = 'block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5';
  const inputCls = 'w-full h-10 px-3 rounded-xl border border-[#c3c5d7] text-sm focus:border-[#003fb1] focus:ring-2 focus:ring-[#003fb1]/20 outline-none transition-all';

  return (
    <div className={clsx('fixed', 'inset-0', 'z-50', 'flex', 'items-center', 'justify-center', 'p-4', 'bg-black/40', 'backdrop-blur-sm')}>
      <div className={clsx('bg-white', 'rounded-2xl', 'w-full', 'max-w-lg', 'shadow-2xl', 'max-h-[90vh]', 'flex', 'flex-col')}>
        <div className={clsx('flex', 'items-center', 'justify-between', 'px-6', 'py-4', 'border-b', 'border-[#e1e3e4]')}>
          <h3 className={clsx('text-base', 'font-bold', 'text-[#191c1d]')}>New Task</h3>
          <button onClick={onClose} className={clsx('w-7', 'h-7', 'flex', 'items-center', 'justify-center', 'rounded-lg', 'hover:bg-slate-100', 'text-slate-400')}>
            <svg className={clsx('w-4', 'h-4')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form id="newTaskForm" onSubmit={handleSubmit} className={clsx('flex-1', 'overflow-y-auto', 'px-6', 'py-5', 'space-y-4')}>
          <div>
            <label className={labelCls}>Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Implement authentication flow" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2} placeholder="What needs to be done?" className={clsx('w-full', 'px-3', 'py-2', 'rounded-xl', 'border', 'border-[#c3c5d7]', 'text-sm', 'focus:border-[#003fb1]', 'focus:ring-2', 'focus:ring-[#003fb1]/20', 'outline-none', 'resize-none', 'transition-all')} />
          </div>
          <div className={clsx('grid', 'grid-cols-2', 'gap-3')}>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className={clsx('w-full', 'h-10', 'px-3', 'rounded-xl', 'border', 'border-[#c3c5d7]', 'text-sm', 'focus:border-[#003fb1]', 'outline-none', 'bg-white')}>
                {['low','medium','high','critical'].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Est. Hours</label>
              <input type="number" min="0.5" step="0.5" value={form.estimated_hours}
                onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })}
                placeholder="e.g. 4" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Deadline</label>
            <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Tags (comma-separated)</label>
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="e.g. api, design, testing" className={inputCls} />
          </div>

          {/* Affinity scorer */}
          <AffinityScorer
            projectId={projectId}
            taskTags={tags}
            selectedUserId={form.assigned_to}
            onSelect={(m) => setForm({ ...form, assigned_to: m.id === form.assigned_to ? null : m.id })}
          />
        </form>
        <div className={clsx('flex', 'gap-3', 'px-6', 'py-4', 'border-t', 'border-[#e1e3e4]')}>
          <button type="button" onClick={onClose} className={clsx('flex-1', 'h-10', 'text-sm', 'font-semibold', 'border', 'border-[#c3c5d7]', 'rounded-xl', 'hover:bg-slate-50', 'transition-colors')}>Cancel</button>
          <button type="submit" form="newTaskForm" disabled={saving} className={clsx('flex-1', 'h-10', 'bg-[#003fb1]', 'text-white', 'text-sm', 'font-bold', 'rounded-xl', 'hover:bg-[#1353d8]', 'disabled:opacity-60', 'transition-colors')}>
            {saving ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Task Detail Modal ────────────────────────────────────────────────────────
function TaskDetailModal({ task, onClose, readOnly = false }) {
  const { updateTask } = useTask();
  const [form, setForm] = useState({ ...task, deadline: task.deadline ? task.deadline.slice(0, 10) : '' });
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (task.project_id) {
      api.get(`/projects/${task.project_id}`)
         .then((r) => setMembers(r.data.project?.members || []))
         .catch(console.error);
    }
  }, [task.project_id]);

  const handleSave = async () => {
    if (readOnly) return;
    setSaving(true);
    await updateTask(task.id, {
      title: form.title, description: form.description, priority: form.priority,
      status: form.status, deadline: form.deadline || null, estimated_hours: form.estimated_hours,
      assigned_to: form.assigned_to || null,
    });
    setSaving(false);
    onClose();
  };

  const labelCls = 'block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5';
  const inputCls = 'w-full h-10 px-3 rounded-xl border border-[#c3c5d7] text-sm focus:border-[#003fb1] focus:ring-2 focus:ring-[#003fb1]/20 outline-none transition-all';

  return (
    <div className={clsx('fixed', 'inset-0', 'z-50', 'flex', 'items-center', 'justify-center', 'p-4', 'bg-black/40', 'backdrop-blur-sm')}>
      <div className={clsx('bg-white', 'rounded-2xl', 'w-full', 'max-w-md', 'shadow-2xl')}>
        <div className={clsx('flex', 'items-center', 'justify-between', 'px-6', 'py-4', 'border-b', 'border-[#e1e3e4]')}>
          <h3 className={clsx('text-base', 'font-bold', 'text-[#191c1d]')}>Edit Task</h3>
          <button onClick={onClose} className={clsx('w-7', 'h-7', 'flex', 'items-center', 'justify-center', 'rounded-lg', 'hover:bg-slate-100', 'text-slate-400')}>
            <svg className={clsx('w-4', 'h-4')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className={clsx('px-6', 'py-5', 'space-y-4')}>
          <div><label className={labelCls}>Title</label>
            <input value={form.title} disabled={readOnly} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-500`} /></div>
          <div><label className={labelCls}>Description</label>
            <textarea value={form.description || ''} disabled={readOnly} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3} className={clsx('w-full', 'px-3', 'py-2', 'rounded-xl', 'border', 'border-[#c3c5d7]', 'text-sm', 'focus:border-[#003fb1]', 'outline-none', 'resize-none', 'disabled:bg-slate-50', 'disabled:text-slate-500')} /></div>
          <div className={clsx('grid', 'grid-cols-2', 'gap-3')}>
            <div><label className={labelCls}>Status</label>
              <select value={form.status} disabled={readOnly} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={clsx('w-full', 'h-10', 'px-3', 'rounded-xl', 'border', 'border-[#c3c5d7]', 'text-sm', 'focus:border-[#003fb1]', 'outline-none', 'bg-white', 'disabled:bg-slate-50', 'disabled:text-slate-500')}>
                {['todo','in_progress','blocked','done'].map((s) => <option key={s} value={s}>{s.replace('_',' ').toUpperCase()}</option>)}
              </select></div>
            <div><label className={labelCls}>Priority</label>
              <select value={form.priority} disabled={readOnly} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className={clsx('w-full', 'h-10', 'px-3', 'rounded-xl', 'border', 'border-[#c3c5d7]', 'text-sm', 'focus:border-[#003fb1]', 'outline-none', 'bg-white', 'disabled:bg-slate-50', 'disabled:text-slate-500')}>
                {['low','medium','high','critical'].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
              </select></div>
          </div>
          <div className={clsx('grid', 'grid-cols-2', 'gap-3')}>
            <div><label className={labelCls}>Deadline</label>
              <input type="date" value={form.deadline} disabled={readOnly} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-500`} /></div>
            <div><label className={labelCls}>Est. Hours</label>
              <input type="number" value={form.estimated_hours || ''} disabled={readOnly} onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })} className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-500`} /></div>
          </div>
          <div><label className={labelCls}>Assignee</label>
            <select value={form.assigned_to || ''} disabled={readOnly} onChange={(e) => setForm({ ...form, assigned_to: e.target.value || null })} className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-500`}>
              <option value="">Unassigned</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name} ({m.member_role})</option>)}
            </select>
          </div>
        </div>
        <div className={clsx('flex', 'gap-3', 'px-6', 'py-4', 'border-t', 'border-[#e1e3e4]')}>
          <button onClick={onClose} className={clsx('flex-1', 'h-10', 'text-sm', 'font-semibold', 'border', 'border-[#c3c5d7]', 'rounded-xl', 'hover:bg-slate-50', 'transition-colors')}>Cancel</button>
          {readOnly ? (
            <button onClick={onClose} className={clsx('flex-1', 'h-10', 'bg-[#e1e3e4]', 'text-[#434654]', 'text-sm', 'font-bold', 'rounded-xl')}>
              Read Only
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving} className={clsx('flex-1', 'h-10', 'bg-[#003fb1]', 'text-white', 'text-sm', 'font-bold', 'rounded-xl', 'hover:bg-[#1353d8]', 'disabled:opacity-60', 'transition-colors')}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────
function KanbanColumn({
  col,
  tasks,
  onOpenTask,
  onDeleteTask,
  onDrop,
  readOnly = false,
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`flex-1 min-w-[220px] max-w-xs flex flex-col rounded-2xl transition-colors ${dragOver && !readOnly ? 'bg-[#003fb1]/5 ring-2 ring-[#003fb1]/20' : 'bg-slate-50'}`}
      onDragOver={(e) => { if (!readOnly) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { setDragOver(false); if (!readOnly) onDrop(e, col.id); }}
    >
      {/* Column header */}
      <div className={clsx('flex', 'items-center', 'justify-between', 'px-4', 'pt-4', 'pb-3')}>
        <div className={clsx('flex', 'items-center', 'gap-2')}>
          <div className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
          <span className={clsx('text-xs', 'font-bold', 'text-slate-700')}>{col.label}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${col.color}`}>{tasks.length}</span>
        </div>
      </div>
      {/* Cards */}
      <div className={clsx('flex-1', 'px-3', 'pb-4', 'space-y-3', 'overflow-y-auto')} style={{ maxHeight: '65vh' }}>
        {tasks.map((task) => (
          <div key={task.id} draggable={!readOnly} onDragStart={(e) => { if (!readOnly) e.dataTransfer.setData('taskId', task.id); }}>
            <TaskCard
              task={task}
              onOpen={onOpenTask}
              onDelete={onDeleteTask}
              readOnly={readOnly}
            />
          </div>
        ))}
        {tasks.length === 0 && (
          <div className={clsx('border-2', 'border-dashed', 'border-slate-200', 'rounded-xl', 'p-4', 'text-center', 'text-[11px]', 'text-slate-300')}>
            {readOnly ? 'No tasks' : 'Drop tasks here'}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inner board (has access to TaskContext) ──────────────────────────────────
function BoardInner({ projects, selectedProjectId, setSelectedProjectId, selectedProject, scopedProject = false }) {
  const { user } = useAuth();
  const { tasks, loading, loadTasks, updateTask, deleteTask, runAI, aiLoading, suggestions, isDemo } = useTask();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskPendingDelete, setTaskPendingDelete] = useState(null);
  const [deletingTask, setDeletingTask] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const isArchived = selectedProject?.status === 'archived';
  const readOnly = !isDemo && (isArchived || user?.role !== 'student');

  useEffect(() => {
    if (selectedProjectId && !isDemo) loadTasks(selectedProjectId);
  }, [selectedProjectId, isDemo, loadTasks]);

  const handleDrop = (e, newStatus) => {
    if (readOnly) return;
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) updateTask(taskId, { status: newStatus });
  };

  const handleRunAI = async () => {
    setDrawerOpen(true);
    await runAI(selectedProjectId);
  };

  const handleConfirmDeleteTask = async () => {
    if (!taskPendingDelete) return;
    setDeletingTask(true);
    await deleteTask(taskPendingDelete.id);
    setDeletingTask(false);
    setTaskPendingDelete(null);
  };

  const criticalCount = suggestions.filter((s) => s.severity === 'critical').length;

  return (
    <div className={clsx('flex', 'flex-col', 'h-full')}>
      {/* ── Top bar ── */}
      <div className={clsx('flex', 'items-center', 'justify-between', 'px-6', 'py-4', 'border-b', 'border-[#e1e3e4]', 'bg-white', 'flex-shrink-0', 'gap-3', 'flex-wrap')}>
        <div className={clsx('flex', 'items-center', 'gap-3')}>
          <h1 className={clsx('text-lg', 'font-bold', 'text-[#191c1d]')}>Task Board</h1>
          {isDemo && (
            <span className={clsx('text-[10px]', 'px-2', 'py-1', 'bg-violet-100', 'text-violet-700', 'rounded-full', 'font-bold', 'animate-pulse')}>
              DEMO MODE
            </span>
          )}
        </div>

        <div className={clsx('flex', 'items-center', 'gap-2', 'flex-wrap')}>
          {/* Project selector */}
          {!isDemo && projects.length > 0 && (
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className={clsx('h-9', 'px-3', 'rounded-xl', 'border', 'border-[#c3c5d7]', 'text-sm', 'focus:border-[#003fb1]', 'outline-none', 'bg-white')}
            >
              <option value="">Select project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}

          {/* Graph toggle */}
          <button
            onClick={() => setShowGraph(!showGraph)}
            className={`h-9 px-4 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-2
              ${showGraph ? 'bg-[#003fb1] text-white border-[#003fb1]' : 'border-[#c3c5d7] text-[#434654] hover:bg-slate-50'}`}
          >
            <svg className={clsx('w-3.5', 'h-3.5')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            Graph
          </button>

          {/* AI Analysis */}
          <button
            onClick={handleRunAI}
            disabled={aiLoading}
            className={clsx('h-9', 'px-4', 'text-xs', 'font-bold', 'rounded-xl', 'bg-gradient-to-r', 'from-violet-600', 'to-[#003fb1]', 'text-white', 'hover:opacity-90', 'transition-opacity', 'flex', 'items-center', 'gap-2', 'relative', 'shadow-sm', 'disabled:opacity-70')}
          >
            {aiLoading ? (
              <div className={clsx('w-3.5', 'h-3.5', 'border-2', 'border-white/30', 'border-t-white', 'rounded-full', 'animate-spin')} />
            ) : (
              <svg className={clsx('w-3.5', 'h-3.5')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            )}
            Run Suggestion
            {criticalCount > 0 && !drawerOpen && (
              <span className={clsx('absolute', '-top-1.5', '-right-1.5', 'w-4', 'h-4', 'bg-red-500', 'text-white', 'text-[9px]', 'font-bold', 'rounded-full', 'flex', 'items-center', 'justify-center', 'animate-bounce')}>
                {criticalCount}
              </span>
            )}
          </button>

          {/* New Task */}
          <button
            onClick={() => setShowNewTask(true)}
            disabled={readOnly || (!selectedProjectId && !isDemo)}
            className={clsx('h-9', 'px-4', 'text-xs', 'font-bold', 'bg-[#003fb1]', 'text-white', 'rounded-xl', 'hover:bg-[#1353d8]', 'transition-colors', 'disabled:opacity-40', 'flex', 'items-center', 'gap-1.5')}
          >
            <span className={clsx('text-base', 'leading-none')}>+</span> New Task
          </button>
        </div>
      </div>

      {readOnly && (
        <div className={clsx('px-6', 'py-3', 'bg-[#e1e3e4]', 'border-b', 'border-[#c3c5d7]', 'text-sm', 'text-[#434654]', 'flex-shrink-0')}>
          {isArchived
            ? 'This project is archived. Task board changes, new tasks, and AI suggestion actions are disabled.'
            : 'Advisor view is read-only. Assigned students create tasks and update task status.'}
        </div>
      )}

      {/* ── Dependency graph panel ── */}
      {showGraph && (
        <div className={clsx('px-6', 'py-4', 'bg-white', 'border-b', 'border-[#e1e3e4]', 'flex-shrink-0')}>
          <div className={clsx('flex', 'items-center', 'justify-between', 'mb-3')}>
            <h2 className={clsx('text-sm', 'font-bold', 'text-[#191c1d]')}>Dependency Graph</h2>
            <span className={clsx('text-[10px]', 'text-slate-400')}>Red edges = critical path · Orange = blocked chain</span>
          </div>
          <div className={clsx('bg-slate-50', 'rounded-2xl', 'p-4', 'overflow-auto')} style={{ maxHeight: '320px' }}>
            <DependencyGraph />
          </div>
        </div>
      )}

      {/* ── Kanban board ── */}
      <div className={clsx('flex-1', 'overflow-auto', 'px-6', 'py-5')}>
        {loading ? (
          <div className={clsx('flex', 'gap-4')}>
            {COLUMNS.map((col) => (
              <div key={col.id} className={clsx('flex-1', 'min-w-[220px]', 'bg-slate-50', 'rounded-2xl', 'p-4')}>
                <div className={clsx('h-4', 'bg-slate-200', 'rounded', 'w-1/2', 'mb-4', 'animate-pulse')} />
                {[1, 2].map((i) => <div key={i} className={clsx('h-24', 'bg-white', 'rounded-2xl', 'mb-3', 'animate-pulse', 'border', 'border-slate-100')} />)}
              </div>
            ))}
          </div>
        ) : (
          <div className={clsx('flex', 'gap-4')}>
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                col={col}
                tasks={tasks.filter((t) => t.status === col.id)}
                onOpenTask={setSelectedTask}
                onDeleteTask={setTaskPendingDelete}
                onDrop={handleDrop}
                readOnly={readOnly}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !isDemo && !selectedProjectId && (
          <div className={clsx('flex', 'flex-col', 'items-center', 'justify-center', 'h-64', 'text-center', 'gap-3')}>
            <div className={clsx('w-14', 'h-14', 'bg-[#d6e0f1]', 'rounded-2xl', 'flex', 'items-center', 'justify-center', 'text-2xl')}>📋</div>
            <h3 className={clsx('font-semibold', 'text-[#191c1d]')}>Select a project to view its tasks</h3>
            <p className={clsx('text-sm', 'text-slate-400')}>Or open <code className={clsx('bg-slate-100', 'px-1.5', 'py-0.5', 'rounded', 'text-xs')}>/tasks?demo=true</code> for a live demo.</p>
          </div>
        )}
      </div>

      {/* AI Drawer */}
      <AISuggestionDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} readOnly={readOnly} />

      {/* Modals */}
      {showNewTask && !readOnly && (
        <NewTaskModal projectId={selectedProjectId} onClose={() => setShowNewTask(false)} />
      )}
      {selectedTask && (
        <TaskDetailModal task={selectedTask} readOnly={readOnly} onClose={() => setSelectedTask(null)} />
      )}
      <DeleteConfirmationModal
        open={Boolean(taskPendingDelete)}
        title="Delete task?"
        message="This will permanently remove the task from the board."
        itemName={taskPendingDelete?.title}
        confirmLabel="Delete Task"
        loading={deletingTask}
        onCancel={() => {
          if (!deletingTask) setTaskPendingDelete(null);
        }}
        onConfirm={handleConfirmDeleteTask}
      />
    </div>
  );
}

// ─── Page wrapper — handles demo mode detection ───────────────────────────────
export default function TaskBoard() {
  const { id: routeProjectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const demoMode = searchParams.get('demo') === 'true';
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(routeProjectId || null);
  const selectedProject = projects.find((project) => project.id === selectedProjectId);

  useEffect(() => {
    if (!demoMode) {
      // Always fetch all projects to allow switching in the board
      api.get('/projects').then(({ data }) => {
        setProjects(data.projects || []);
      }).catch(() => {});
    }
  }, [demoMode]);

  useEffect(() => {
    if (routeProjectId) {
      setSelectedProjectId(routeProjectId);
    } else if (projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [routeProjectId, projects]);

  const handleProjectSwitch = (newId) => {
    if (newId) navigate(`/projects/${newId}/tasks${demoMode ? '?demo=true' : ''}`);
    else navigate(`/tasks${demoMode ? '?demo=true' : ''}`);
  };

  return (
    <TaskProvider demoMode={demoMode}>
      <Layout activePath={routeProjectId ? `/projects/${routeProjectId}/tasks` : '/tasks'} projectId={selectedProjectId}>
        <BoardInner
          projects={projects}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={handleProjectSwitch}
          selectedProject={selectedProject}
          scopedProject={false}
        />
      </Layout>
    </TaskProvider>
  );
}
