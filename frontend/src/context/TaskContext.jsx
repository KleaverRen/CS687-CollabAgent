import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

// ─── Demo seed data for ?demo=true mode ──────────────────────────────────────
const DEMO_PROJECT_ID = 'demo-project-001';

const DEMO_TASKS = [
  { id: 'dt1', project_id: DEMO_PROJECT_ID, title: 'API Endpoint Design', status: 'done', priority: 'high', estimated_hours: 6, tags: ['api','design'], assignee_name: 'Alex Chen', assigned_to: 'du1', deadline: null, description: 'Define REST contract for task service.', blocker_count: 0, dependent_count: 2 },
  { id: 'dt2', project_id: DEMO_PROJECT_ID, title: 'Database Schema Migration', status: 'in_progress', priority: 'critical', estimated_hours: 4, tags: ['database'], assignee_name: 'Priya Nair', assigned_to: 'du2', deadline: new Date(Date.now() + 2 * 86400000).toISOString(), description: 'Create tasks and dependencies tables.', blocker_count: 0, dependent_count: 3 },
  { id: 'dt3', project_id: DEMO_PROJECT_ID, title: 'Frontend Kanban Board', status: 'blocked', priority: 'medium', estimated_hours: 18, tags: ['frontend','design'], assignee_name: 'Jordan Lee', assigned_to: 'du3', deadline: new Date(Date.now() + 5 * 86400000).toISOString(), description: 'Drag-and-drop task board UI.', blocker_count: 1, dependent_count: 2 },
  { id: 'dt4', project_id: DEMO_PROJECT_ID, title: 'AI Suggestion Engine', status: 'todo', priority: 'high', estimated_hours: 14, tags: ['ai','api'], assignee_name: null, assigned_to: null, deadline: new Date(Date.now() + 7 * 86400000).toISOString(), description: 'Implement 5 rule-based algorithms.', blocker_count: 1, dependent_count: 1 },
  { id: 'dt5', project_id: DEMO_PROJECT_ID, title: 'Integration Testing', status: 'todo', priority: 'medium', estimated_hours: 8, tags: ['testing'], assignee_name: null, assigned_to: null, deadline: new Date(Date.now() + 10 * 86400000).toISOString(), description: 'End-to-end test suite for all flows.', blocker_count: 2, dependent_count: 0 },
  { id: 'dt6', project_id: DEMO_PROJECT_ID, title: 'Dependency Graph Renderer', status: 'todo', priority: 'low', estimated_hours: 10, tags: ['frontend'], assignee_name: null, assigned_to: null, deadline: null, description: 'SVG DAG with critical path.', blocker_count: 1, dependent_count: 1 },
  { id: 'dt7', project_id: DEMO_PROJECT_ID, title: 'User Auth SSO', status: 'done', priority: 'critical', estimated_hours: 5, tags: ['auth','api'], assignee_name: 'Alex Chen', assigned_to: 'du1', deadline: null, description: 'OAuth2 provider integration.', blocker_count: 0, dependent_count: 1 },
  { id: 'dt8', project_id: DEMO_PROJECT_ID, title: 'Demo Script & Presentation', status: 'todo', priority: 'high', estimated_hours: 3, tags: ['design'], assignee_name: 'Priya Nair', assigned_to: 'du2', deadline: new Date(Date.now() + 3 * 86400000).toISOString(), description: '5-minute live demo walkthrough.', blocker_count: 3, dependent_count: 0 },
];

const DEMO_EDGES = [
  { parent_task_id: 'dt1', child_task_id: 'dt3', dep_type: 'blocks' },
  { parent_task_id: 'dt2', child_task_id: 'dt3', dep_type: 'blocks' },
  { parent_task_id: 'dt2', child_task_id: 'dt4', dep_type: 'blocks' },
  { parent_task_id: 'dt3', child_task_id: 'dt5', dep_type: 'blocks' },
  { parent_task_id: 'dt4', child_task_id: 'dt5', dep_type: 'blocks' },
  { parent_task_id: 'dt6', child_task_id: 'dt5', dep_type: 'blocks' },
  { parent_task_id: 'dt2', child_task_id: 'dt6', dep_type: 'blocks' },
  { parent_task_id: 'dt7', child_task_id: 'dt4', dep_type: 'blocks' },
  { parent_task_id: 'dt3', child_task_id: 'dt8', dep_type: 'blocks' },
  { parent_task_id: 'dt4', child_task_id: 'dt8', dep_type: 'blocks' },
];

const DEMO_MEMBERS = [
  { id: 'du1', full_name: 'Alex Chen',   avatar_url: null, match_pct: 94 },
  { id: 'du2', full_name: 'Priya Nair',  avatar_url: null, match_pct: 81 },
  { id: 'du3', full_name: 'Jordan Lee',  avatar_url: null, match_pct: 67 },
];

// ─── Demo AI suggestions (deterministic canary mode) ──────────────────────────
const DEMO_SUGGESTIONS = [
  { type: 'blocker', severity: 'critical', task_id: 'dt3', task_title: 'Frontend Kanban Board', blocking_task_id: 'dt2', blocking_task_title: 'Database Schema Migration', cascade_count: 3, days_until_deadline: 5, title: '"Database Schema Migration" is blocking 4 task(s)', description: '"Frontend Kanban Board" cannot progress until "Database Schema Migration" is marked done. This also cascades to 3 downstream task(s). Deadline in 5 day(s).', action_label: 'Mark blocker as In Progress', action: { patch_task_id: 'dt2', status: 'in_progress' }, confidence: 0.9, confidence_formula: 'base(0.6) + cascade_count×0.1 + critical_bonus(0.2)' },
  { type: 'critical_path', severity: 'critical', task_ids: ['dt2','dt3','dt5'], critical_task_id: 'dt2', critical_task_title: 'Database Schema Migration', total_hours: 30, path_length: 3, title: 'Critical path spans 30h across 3 tasks', description: 'The longest dependency chain runs 3 tasks (30h total). Any delay in "Database Schema Migration" propagates to all 2 downstream tasks.', action_label: 'Prioritize first blocking task', action: { patch_task_id: 'dt2', priority: 'critical' }, confidence: 0.68, confidence_formula: '0.5 + path_length×0.06' },
  { type: 'split', severity: 'warning', task_id: 'dt3', task_title: 'Frontend Kanban Board', suggested_parts: ['Wireframing', 'Component Build', 'Review & QA'], estimated_hours: 18, dependent_count: 2, title: 'Split "Frontend Kanban Board" into 3 subtasks', description: 'This task has 18h estimated and 2 dependent task(s). Breaking it into "Wireframing", "Component Build", "Review & QA" reduces risk and improves parallelism.', action_label: 'Create subtasks', action: { create_subtasks: ['Wireframing','Component Build','Review & QA'], parent_task_id: 'dt3' }, confidence: 0.75, confidence_formula: '(hours≥16?0.5) + (dependents≥2?0.2)' },
  { type: 'priority_rerank', severity: 'warning', task_id: 'dt4', task_title: 'AI Suggestion Engine', current_priority: 'high', recommended_priority: 'critical', score: 13, title: 'Raise "AI Suggestion Engine" to critical', description: 'Composite score: 13 (deadline proximity + 1 dependents). Currently marked "high" — recommend upgrading to "critical".', action_label: 'Set priority to critical', action: { patch_task_id: 'dt4', priority: 'critical' }, confidence: 0.76, confidence_formula: '0.5 + composite_score×0.02' },
  { type: 'teammate_affinity', severity: 'info', task_id: 'dt4', task_title: 'AI Suggestion Engine', ranked_members: DEMO_MEMBERS, title: 'Best assignee matches for "AI Suggestion Engine"', description: 'Based on tag-completion overlap across 3 completed tasks.', action_label: 'Assign to Alex Chen', action: { patch_task_id: 'dt4', assigned_to: 'du1' }, confidence: 0.94, confidence_formula: 'tag_overlap / total_completed_tasks × 0.84 + 0.15' },
];

const getSuggestionId = (suggestion, index = 0) => {
  if (suggestion.id) return suggestion.id;

  const action = suggestion.action || {};
  return [
    suggestion.type || 'suggestion',
    suggestion.task_id || suggestion.critical_task_id || action.patch_task_id || action.parent_task_id || 'global',
    suggestion.title || '',
    index,
  ].join(':');
};

const withSuggestionIds = (suggestions = []) =>
  suggestions.map((suggestion, index) => ({
    ...suggestion,
    id: getSuggestionId(suggestion, index),
  }));

// ─── Context ─────────────────────────────────────────────────────────────────
const TaskContext = createContext(null);

export function TaskProvider({ children, demoMode = false }) {
  const [tasks, setTasks] = useState(demoMode ? DEMO_TASKS : []);
  const [edges, setEdges] = useState(demoMode ? DEMO_EDGES : []);
  const [suggestions, setSuggestionsState] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(
    demoMode ? DEMO_PROJECT_ID : null
  );
  const isDemo = useRef(demoMode);

  const setSuggestions = useCallback((nextSuggestions) => {
    setSuggestionsState((prev) => {
      const resolved = typeof nextSuggestions === 'function' ? nextSuggestions(prev) : nextSuggestions;
      return withSuggestionIds(resolved);
    });
  }, []);

  // ── Load all tasks + graph for a project ──────────────────────────────────
  const loadTasks = useCallback(async (projectId) => {
    if (isDemo.current) return;
    setLoading(true);
    try {
      const [tRes, gRes] = await Promise.all([
        api.get(`/tasks?project_id=${projectId}`),
        api.get(`/tasks/graph/${projectId}`),
      ]);
      setTasks(tRes.data.tasks);
      setEdges(gRes.data.edges);
    } catch {
      toast.error('Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Create task ───────────────────────────────────────────────────────────
  const createTask = useCallback(async (payload) => {
    if (isDemo.current) {
      const newTask = { id: `dt${Date.now()}`, ...payload, status: 'todo', blocker_count: 0, dependent_count: 0 };
      setTasks((prev) => [newTask, ...prev]);
      toast.success('Task created!');
      return newTask;
    }
    try {
      const { data } = await api.post('/tasks', payload);
      setTasks((prev) => [data.task, ...prev]);
      toast.success('Task created!');
      return data.task;
    } catch {
      toast.error('Failed to create task.');
    }
  }, []);

  // ── Update task (optimistic) ──────────────────────────────────────────────
  const updateTask = useCallback(async (id, patch) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    if (isDemo.current) return;
    try {
      const { data } = await api.patch(`/tasks/${id}`, patch);
      setTasks((prev) => prev.map((t) => (t.id === id ? data.task : t)));
    } catch {
      toast.error('Failed to update task.');
      await loadTasks(selectedProjectId);
    }
  }, [loadTasks, selectedProjectId]);

  // ── Delete task ───────────────────────────────────────────────────────────
  const deleteTask = useCallback(async (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (isDemo.current) return;
    try {
      await api.delete(`/tasks/${id}`);
      toast.success('Task deleted.');
    } catch {
      toast.error('Failed to delete task.');
    }
  }, []);

  // ── Apply an AI suggestion action ─────────────────────────────────────────
  const applyAction = useCallback(async (suggestion) => {
    const { action } = suggestion;
    if (!action) return;

    // 1. Handle single task updates (Status, Priority, Assignee)
    if (action.patch_task_id) {
      const patch = {};
      if (action.status) patch.status = action.status;
      if (action.priority) patch.priority = action.priority;
      if (action.assigned_to) patch.assigned_to = action.assigned_to;
      
      await updateTask(action.patch_task_id, patch);
    }

    // 2. Handle task splitting (Create multiple subtasks)
    if (action.create_subtasks && action.parent_task_id) {
      const parentTask = tasks.find((t) => t.id === action.parent_task_id);
      const projectId = parentTask?.project_id || selectedProjectId;

      if (projectId) {
        // Create subtasks sequentially
        for (const subtaskTitle of action.create_subtasks) {
          await createTask({
            project_id: projectId,
            title: subtaskTitle,
            description: parentTask ? `Subtask of: ${parentTask.title}` : 'AI suggested subtask',
            priority: parentTask?.priority || 'medium',
            assigned_to: parentTask?.assigned_to || null,
          });
        }
        // Mark the parent task as done since it has been successfully split into subtasks
        await updateTask(action.parent_task_id, { status: 'done' });
      }
    }

    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    toast.success('Suggestion applied!');
  }, [updateTask, createTask, tasks, selectedProjectId, setSuggestions]);

  // ── Run AI analysis ───────────────────────────────────────────────────────
  const runAI = useCallback(async (projectId, taskId = null) => {
    if (isDemo.current) {
      setAiLoading(true);
      await new Promise((r) => setTimeout(r, 900)); // simulate latency

      // Filter out suggestions that apply to tasks that are now 'done'
      const filtered = DEMO_SUGGESTIONS.filter((s) => {
        const targetId = s.action?.patch_task_id || s.action?.parent_task_id || s.task_id;
        const task = tasks.find(t => t.id === targetId);
        return !task || task.status !== 'done';
      });

      setSuggestions(filtered);
      setAiLoading(false);
      return;
    }
    setAiLoading(true);
    try {
      const { data } = await api.post('/ai/suggest', { project_id: projectId, task_id: taskId });
      setSuggestions(data.suggestions);
      if (!data.suggestions.length) toast('No issues detected — workflow looks healthy ✓', { icon: '✅' });
    } catch {
      toast.error('AI analysis failed.');
    } finally {
      setAiLoading(false);
    }
  }, [setSuggestions, tasks]);

  const value = {
    tasks, edges, suggestions, members: demoMode ? DEMO_MEMBERS : [],
    loading, aiLoading,
    selectedProjectId, setSelectedProjectId,
    loadTasks, createTask, updateTask, deleteTask,
    runAI, applyAction, setSuggestions,
    isDemo: isDemo.current,
    DEMO_PROJECT_ID,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTask() {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTask must be used within TaskProvider');
  return ctx;
}
