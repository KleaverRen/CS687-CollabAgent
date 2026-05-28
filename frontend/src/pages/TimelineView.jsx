import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, Filter, GripVertical, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const DAY_WIDTH = 36;
const LEFT_WIDTH = 280;
const ROW_HEIGHT = 56;
const GROUP_HEIGHT = 40;

const STATUS_STYLES = {
  todo: 'bg-slate-500',
  in_progress: 'bg-[#006db3]',
  blocked: 'bg-[#ba1a1a]',
  done: 'bg-[#0b6b43]',
};

const WORKSTREAM_COLORS = [
  '#006db3',
  '#0b6b43',
  '#8a5a00',
  '#7c3aed',
  '#b42318',
  '#006a6a',
  '#7a2e0e',
  '#475569',
];

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(start, end) {
  const ms = parseDate(end).getTime() - parseDate(start).getTime();
  return Math.round(ms / 86400000);
}

function toDateInput(date) {
  const clean = parseDate(date);
  if (!clean) return null;
  const year = clean.getFullYear();
  const month = String(clean.getMonth() + 1).padStart(2, '0');
  const day = String(clean.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDay(date) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function formatLongDate(date) {
  const parsed = parseDate(date);
  return parsed ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed) : 'No date';
}

function normalizeTask(task) {
  const start = parseDate(task.start_date) || parseDate(task.created_at) || new Date();
  const deadline = parseDate(task.deadline) || addDays(start, 1);
  return {
    ...task,
    startDate: start,
    deadlineDate: deadline < start ? start : deadline,
    workstream: task.workstream || 'General',
    tags: Array.isArray(task.tags) ? task.tags : [],
  };
}

function getConflictMap(conflicts) {
  return conflicts.reduce((acc, conflict) => {
    if (!acc[conflict.task_id]) acc[conflict.task_id] = [];
    acc[conflict.task_id].push(conflict);
    return acc;
  }, {});
}

function TimelineSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-10 w-80 bg-slate-200 rounded animate-pulse" />
      <div className="h-16 bg-white border border-[#e1e3e4] rounded-lg animate-pulse" />
      <div className="bg-white border border-[#e1e3e4] rounded-lg p-5 space-y-3">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-10 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ hasFilters, onReset }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="mx-auto w-12 h-12 rounded-lg bg-[#d6e0f1] text-[#003fb1] flex items-center justify-center mb-4">
          <CalendarDays className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-[#191c1d]">
          {hasFilters ? 'No tasks match these filters' : 'No timeline tasks yet'}
        </h2>
        <p className="text-sm text-[#555f6d] mt-2">
          {hasFilters
            ? 'Clear the filters to return to the full project schedule.'
            : 'Tasks appear here once the project has work items. Deadlines and estimates are used to infer timeline spans.'}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={onReset}
            className="mt-4 h-9 px-4 rounded-lg border border-[#c3c5d7] text-sm font-semibold hover:bg-slate-50"
          >
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="flex flex-col gap-1 min-w-[150px]">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#737686]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-lg border border-[#c3c5d7] bg-white px-3 text-sm text-[#191c1d] outline-none focus:border-[#003fb1] focus:ring-2 focus:ring-[#003fb1]/15"
      >
        {children}
      </select>
    </label>
  );
}

function DependencyLayer({ dependencies, positions, chartWidth, totalHeight, conflictEdges }) {
  return (
    <svg
      className="absolute left-0 top-0 pointer-events-none z-10"
      width={chartWidth}
      height={totalHeight}
      style={{ minWidth: chartWidth }}
    >
      <defs>
        <marker id="timeline-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L0,9 L9,4.5 z" fill="#64748b" />
        </marker>
        <marker id="timeline-arrow-conflict" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L0,9 L9,4.5 z" fill="#ba1a1a" />
        </marker>
      </defs>
      {dependencies.map((dep) => {
        const source = positions[dep.source];
        const target = positions[dep.target];
        if (!source || !target) return null;
        const startX = source.x + source.width;
        const startY = source.y + ROW_HEIGHT / 2;
        const endX = target.x;
        const endY = target.y + ROW_HEIGHT / 2;
        const midX = Math.max(startX + 24, (startX + endX) / 2);
        const isConflict = conflictEdges.has(`${dep.source}:${dep.target}`);

        return (
          <path
            key={`${dep.source}-${dep.target}`}
            d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX - 6} ${endY}`}
            fill="none"
            stroke={isConflict ? '#ba1a1a' : '#64748b'}
            strokeWidth={isConflict ? 2.4 : 1.6}
            strokeDasharray={isConflict ? '0' : '5 4'}
            opacity={isConflict ? 0.9 : 0.55}
            markerEnd={isConflict ? 'url(#timeline-arrow-conflict)' : 'url(#timeline-arrow)'}
          />
        );
      })}
    </svg>
  );
}

function TimelineBar({ task, position, color, conflicts, readOnly, onDeadlinePreview, onDeadlineCommit }) {
  const dragRef = useRef(null);
  const conflict = conflicts?.[0];
  const statusStyle = STATUS_STYLES[task.status] || STATUS_STYLES.todo;

  const beginDrag = (event) => {
    if (readOnly) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      originalDeadline: task.deadlineDate,
      lastDate: task.deadlineDate,
    };
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaDays = Math.round((event.clientX - drag.startX) / DAY_WIDTH);
    const nextDeadline = addDays(drag.originalDeadline, deltaDays);
    const boundedDeadline = nextDeadline < task.startDate ? task.startDate : nextDeadline;
    drag.lastDate = boundedDeadline;
    onDeadlinePreview(task.id, boundedDeadline);
  };

  const endDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    onDeadlineCommit(task.id, drag.lastDate);
  };

  return (
    <div
      className={clsx(
        'absolute z-20 h-9 rounded-lg shadow-sm border flex items-center overflow-hidden select-none',
        readOnly ? 'cursor-default' : 'cursor-ew-resize',
        conflict ? 'border-[#ba1a1a] ring-2 ring-[#ba1a1a]/15' : 'border-white/70'
      )}
      style={{
        left: position.x,
        top: position.y + 9,
        width: position.width,
        backgroundColor: color,
      }}
      title={`${task.name} - ${formatLongDate(task.startDate)} to ${formatLongDate(task.deadlineDate)}`}
      onPointerDown={beginDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className={clsx('h-full w-1.5 shrink-0', statusStyle)} />
      <div className="min-w-0 flex-1 px-2 text-white">
        <div className="truncate text-xs font-bold leading-4">{task.name}</div>
        <div className="truncate text-[10px] leading-3 text-white/85">{formatDay(task.deadlineDate)}</div>
      </div>
      {!readOnly && (
        <div className="h-full w-7 flex items-center justify-center bg-black/10 text-white/85">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
}

export default function TimelineView() {
  const { id: projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [filters, setFilters] = useState({ workstreams: [], tags: [], assignees: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const timersRef = useRef({});

  const selectedFilters = {
    workstream: searchParams.get('workstream') || '',
    tag: searchParams.get('tag') || '',
    assignee: searchParams.get('assignee') || '',
  };

  const hasFilters = Boolean(selectedFilters.workstream || selectedFilters.tag || selectedFilters.assignee);

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedFilters.workstream) params.set('workstream', selectedFilters.workstream);
      if (selectedFilters.tag) params.set('tag', selectedFilters.tag);
      if (selectedFilters.assignee) params.set('assignee', selectedFilters.assignee);

      const [projectRes, timelineRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/projects/${projectId}/timeline${params.toString() ? `?${params.toString()}` : ''}`),
      ]);

      setProject(projectRes.data.project);
      setTasks((timelineRes.data.tasks || []).map(normalizeTask));
      setDependencies(timelineRes.data.dependencies || []);
      setConflicts(timelineRes.data.conflicts || []);
      setFilters(timelineRes.data.filters || { workstreams: [], tags: [], assignees: [] });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load the project timeline.');
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedFilters.workstream, selectedFilters.tag, selectedFilters.assignee]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  useEffect(() => () => {
    Object.values(timersRef.current).forEach(clearTimeout);
  }, []);

  const readOnly = project?.status === 'archived' || user?.role !== 'student';

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const resetFilters = () => setSearchParams({});

  const conflictMap = useMemo(() => getConflictMap(conflicts), [conflicts]);
  const conflictEdges = useMemo(() => {
    return new Set(
      conflicts
        .filter((conflict) => conflict.type === 'dependency_order' && conflict.dependency_id)
        .map((conflict) => `${conflict.dependency_id}:${conflict.task_id}`)
    );
  }, [conflicts]);

  const workstreamColorMap = useMemo(() => {
    const streams = Array.from(new Set(tasks.map((task) => task.workstream))).sort();
    return Object.fromEntries(streams.map((stream, index) => [stream, WORKSTREAM_COLORS[index % WORKSTREAM_COLORS.length]]));
  }, [tasks]);

  const timeline = useMemo(() => {
    if (!tasks.length) return { days: [], start: new Date(), chartWidth: 900 };
    const minStart = tasks.reduce((min, task) => (task.startDate < min ? task.startDate : min), tasks[0].startDate);
    const maxEnd = tasks.reduce((max, task) => (task.deadlineDate > max ? task.deadlineDate : max), tasks[0].deadlineDate);
    const start = addDays(minStart, -2);
    const end = addDays(maxEnd, 4);
    const length = Math.max(7, daysBetween(start, end) + 1);
    return {
      start,
      days: Array.from({ length }, (_, index) => addDays(start, index)),
      chartWidth: Math.max(900, length * DAY_WIDTH),
    };
  }, [tasks]);

  const rows = useMemo(() => {
    const grouped = new Map();
    for (const task of tasks) {
      if (!grouped.has(task.workstream)) grouped.set(task.workstream, []);
      grouped.get(task.workstream).push(task);
    }

    const output = [];
    Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([workstream, streamTasks]) => {
        output.push({ type: 'group', id: workstream, name: workstream, height: GROUP_HEIGHT, count: streamTasks.length });
        streamTasks
          .sort((a, b) => a.startDate - b.startDate || a.deadlineDate - b.deadlineDate)
          .forEach((task) => output.push({ type: 'task', id: task.id, task, height: ROW_HEIGHT }));
      });

    let y = 0;
    return output.map((row) => {
      const withY = { ...row, y };
      y += row.height;
      return withY;
    });
  }, [tasks]);

  const taskPositions = useMemo(() => {
    const positions = {};
    for (const row of rows) {
      if (row.type !== 'task') continue;
      const task = row.task;
      const x = Math.max(0, daysBetween(timeline.start, task.startDate) * DAY_WIDTH);
      const width = Math.max(DAY_WIDTH, (daysBetween(task.startDate, task.deadlineDate) + 1) * DAY_WIDTH);
      positions[task.id] = { x, y: row.y, width };
    }
    return positions;
  }, [rows, timeline.start]);

  const totalHeight = rows.reduce((sum, row) => sum + row.height, 0);

  const previewDeadline = (taskId, deadline) => {
    setTasks((prev) => prev.map((task) => (
      task.id === taskId ? { ...task, deadline: deadline.toISOString(), deadlineDate: deadline } : task
    )));
  };

  const commitDeadline = (taskId, deadline) => {
    const deadlineValue = toDateInput(deadline);
    if (!deadlineValue) return;

    clearTimeout(timersRef.current[taskId]);
    timersRef.current[taskId] = setTimeout(async () => {
      try {
        const { data } = await api.patch(`/tasks/${taskId}`, { deadline: deadlineValue });
        setTasks((prev) => prev.map((task) => (
          task.id === taskId ? normalizeTask({ ...task, ...data.task, name: data.task.title }) : task
        )));
        await loadTimeline();
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to update the deadline.');
        await loadTimeline();
      }
    }, 500);
  };

  if (loading) {
    return (
      <Layout activePath={`/projects/${projectId}/timeline`} projectId={projectId}>
        <TimelineSkeleton />
      </Layout>
    );
  }

  return (
    <Layout activePath={`/projects/${projectId}/timeline`} projectId={projectId}>
      <div className="flex flex-col h-full bg-[#f3f4f5]">
        <div className="bg-white border-b border-[#e1e3e4] px-6 py-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#555f6d] mb-1">
                <Link to={`/projects/${projectId}`} className="inline-flex items-center gap-1 hover:text-[#003fb1]">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Project
                </Link>
              </div>
              <h1 className="text-xl font-bold text-[#191c1d] truncate">
                {project?.name || 'Project'} Timeline
              </h1>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#c3c5d7] px-3 py-1.5 text-[#434654]">
                <CalendarDays className="w-3.5 h-3.5" />
                {tasks.length} tasks
              </span>
              <span className={clsx(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5',
                conflicts.length ? 'bg-[#ffdad6] border-[#ffb4ab] text-[#ba1a1a]' : 'bg-[#dcefe5] border-[#b8dac9] text-[#005438]'
              )}>
                {conflicts.length ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {conflicts.length ? `${conflicts.length} conflicts` : 'No conflicts'}
              </span>
            </div>
          </div>

          <div className="flex items-end gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-[#f3f4f5] text-[#434654] text-sm font-semibold">
              <Filter className="w-4 h-4" />
              Filters
            </div>
            <FilterSelect label="Workstream" value={selectedFilters.workstream} onChange={(value) => updateFilter('workstream', value)}>
              <option value="">All workstreams</option>
              {filters.workstreams.map((item) => <option key={item} value={item}>{item}</option>)}
            </FilterSelect>
            <FilterSelect label="Tag" value={selectedFilters.tag} onChange={(value) => updateFilter('tag', value)}>
              <option value="">All tags</option>
              {filters.tags.map((item) => <option key={item} value={item}>{item}</option>)}
            </FilterSelect>
            <FilterSelect label="Assignee" value={selectedFilters.assignee} onChange={(value) => updateFilter('assignee', value)}>
              <option value="">All assignees</option>
              {filters.assignees.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
            </FilterSelect>
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="h-9 px-3 rounded-lg border border-[#c3c5d7] text-sm font-semibold hover:bg-slate-50 inline-flex items-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>

        {readOnly && (
          <div className="px-6 py-3 bg-[#e1e3e4] border-b border-[#c3c5d7] text-sm text-[#434654]">
            {project?.status === 'archived'
              ? 'This project is archived. Timeline drag updates are disabled.'
              : 'Advisor view is read-only. Assigned students can drag timeline bars to adjust deadlines.'}
          </div>
        )}

        {error ? (
          <div className="m-6 rounded-lg border border-[#ffb4ab] bg-[#ffdad6] p-4 text-sm text-[#ba1a1a] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onReset={resetFilters} />
        ) : (
          <div className="flex-1 overflow-auto p-6">
            <div className="bg-white border border-[#e1e3e4] rounded-lg overflow-hidden shadow-sm min-w-full">
              <div className="overflow-auto">
                <div style={{ width: LEFT_WIDTH + timeline.chartWidth }}>
                  <div className="sticky top-0 z-30 flex bg-white border-b border-[#e1e3e4]">
                    <div
                      className="sticky left-0 z-40 bg-white border-r border-[#e1e3e4] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#737686]"
                      style={{ width: LEFT_WIDTH, minWidth: LEFT_WIDTH }}
                    >
                      Task
                    </div>
                    <div className="flex" style={{ width: timeline.chartWidth }}>
                      {timeline.days.map((day) => {
                        const isToday = toDateInput(day) === toDateInput(new Date());
                        return (
                          <div
                            key={day.toISOString()}
                            className={clsx(
                              'h-11 border-r border-[#eef0f1] px-1 py-2 text-center text-[10px]',
                              isToday ? 'bg-[#d6e0f1] text-[#003fb1] font-bold' : 'text-[#737686]'
                            )}
                            style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                          >
                            {formatDay(day)}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="relative flex" style={{ minHeight: totalHeight }}>
                    <div
                      className="sticky left-0 z-20 bg-white border-r border-[#e1e3e4]"
                      style={{ width: LEFT_WIDTH, minWidth: LEFT_WIDTH }}
                    >
                      {rows.map((row) => row.type === 'group' ? (
                        <div
                          key={row.id}
                          className="flex items-center justify-between px-4 border-b border-[#e1e3e4] bg-[#f8fafc]"
                          style={{ height: row.height }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: workstreamColorMap[row.name] }}
                            />
                            <span className="text-xs font-bold text-[#191c1d] truncate">{row.name}</span>
                          </div>
                          <span className="text-[10px] text-[#737686]">{row.count}</span>
                        </div>
                      ) : (
                        <div
                          key={row.id}
                          className={clsx(
                            'px-4 border-b border-[#eef0f1] flex flex-col justify-center',
                            conflictMap[row.task.id]?.length && 'bg-[#fff7f5]'
                          )}
                          style={{ height: row.height }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {conflictMap[row.task.id]?.length && <AlertTriangle className="w-3.5 h-3.5 text-[#ba1a1a] shrink-0" />}
                            <span className="text-sm font-semibold text-[#191c1d] truncate">{row.task.name}</span>
                          </div>
                          <div className="text-[11px] text-[#737686] truncate">
                            {row.task.assignee_name || 'Unassigned'} - {row.task.status.replace('_', ' ')}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="relative" style={{ width: timeline.chartWidth, minWidth: timeline.chartWidth, height: totalHeight }}>
                      <div className="absolute inset-0 z-0">
                        {rows.map((row) => (
                          <div
                            key={`${row.id}-grid`}
                            className={clsx('border-b border-[#eef0f1]', row.type === 'group' && 'bg-[#f8fafc]')}
                            style={{ height: row.height }}
                          />
                        ))}
                      </div>
                      <div className="absolute inset-0 z-0 flex pointer-events-none">
                        {timeline.days.map((day) => {
                          const isToday = toDateInput(day) === toDateInput(new Date());
                          return (
                            <div
                              key={`${day.toISOString()}-line`}
                              className={clsx('border-r', isToday ? 'border-[#003fb1] bg-[#d6e0f1]/20' : 'border-[#eef0f1]')}
                              style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                            />
                          );
                        })}
                      </div>
                      <DependencyLayer
                        dependencies={dependencies}
                        positions={taskPositions}
                        chartWidth={timeline.chartWidth}
                        totalHeight={totalHeight}
                        conflictEdges={conflictEdges}
                      />
                      {rows.filter((row) => row.type === 'task').map((row) => (
                        <TimelineBar
                          key={row.task.id}
                          task={row.task}
                          position={taskPositions[row.task.id]}
                          color={workstreamColorMap[row.task.workstream]}
                          conflicts={conflictMap[row.task.id]}
                          readOnly={readOnly}
                          onDeadlinePreview={previewDeadline}
                          onDeadlineCommit={commitDeadline}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {conflicts.length > 0 && (
              <div className="mt-4 bg-white border border-[#e1e3e4] rounded-lg p-4">
                <h2 className="text-sm font-bold text-[#191c1d] mb-3">Scheduling conflicts</h2>
                <div className="grid gap-2">
                  {conflicts.map((conflict, index) => (
                    <div key={`${conflict.type}-${conflict.task_id}-${index}`} className="flex items-start gap-2 text-sm text-[#434654]">
                      <AlertTriangle className={clsx('w-4 h-4 mt-0.5 shrink-0', conflict.severity === 'critical' ? 'text-[#ba1a1a]' : 'text-[#8a5a00]')} />
                      <span>{conflict.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
