import React, { useMemo, useState } from 'react';
import { useTask } from '../context/TaskContext';

const STATUS_COLORS = {
  done:        '#10b981',
  in_progress: '#3b82f6',
  blocked:     '#ef4444',
  todo:        '#94a3b8',
};

const PRIORITY_COLORS = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#94a3b8',
};

// ─── Kahn's topological sort ──────────────────────────────────────────────────
function topoSort(nodes, edges) {
  const ids = nodes.map((n) => n.id);
  const childMap = Object.fromEntries(ids.map((id) => [id, []]));
  const inDegree  = Object.fromEntries(ids.map((id) => [id, 0]));

  for (const e of edges) {
    if (!childMap[e.parent_task_id] || !childMap[e.child_task_id]) continue;
    childMap[e.parent_task_id].push(e.child_task_id);
    inDegree[e.child_task_id]++;
  }

  const queue = ids.filter((id) => inDegree[id] === 0);
  const order = [];
  while (queue.length) {
    const cur = queue.shift();
    order.push(cur);
    for (const child of childMap[cur]) {
      inDegree[child]--;
      if (inDegree[child] === 0) queue.push(child);
    }
  }
  return order;
}

// ─── Critical path via longest-path DP ───────────────────────────────────────
function findCriticalPath(nodes, edges) {
  const taskMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const childMap = Object.fromEntries(nodes.map((n) => [n.id, []]));
  const parentMap = Object.fromEntries(nodes.map((n) => [n.id, []]));

  for (const e of edges) {
    if (childMap[e.parent_task_id]) childMap[e.parent_task_id].push(e.child_task_id);
    if (parentMap[e.child_task_id]) parentMap[e.child_task_id].push(e.parent_task_id);
  }

  const order = topoSort(nodes, edges);
  const dist = Object.fromEntries(nodes.map((n) => [n.id, parseFloat(n.estimated_hours) || 1]));
  const prev = {};

  for (const id of order) {
    for (const child of childMap[id]) {
      const nd = dist[id] + (parseFloat(taskMap[child]?.estimated_hours) || 1);
      if (nd > dist[child]) { dist[child] = nd; prev[child] = id; }
    }
  }

  const sinks = nodes.filter((n) => childMap[n.id].length === 0);
  if (!sinks.length) return new Set();

  const sink = sinks.reduce((a, b) => (dist[a.id] > dist[b.id] ? a : b));
  const path = new Set();
  let cur = sink.id;
  while (cur) { path.add(cur); cur = prev[cur]; }
  return path;
}

// ─── Assign (column, row) positions ──────────────────────────────────────────
function layoutNodes(nodes, edges) {
  const order = topoSort(nodes, edges);
  const colMap = Object.fromEntries(nodes.map((n) => [n.id, 0]));
  const childMap = Object.fromEntries(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    if (childMap[e.parent_task_id]) childMap[e.parent_task_id].push(e.child_task_id);
  }
  for (const id of order) {
    for (const child of childMap[id]) {
      colMap[child] = Math.max(colMap[child], colMap[id] + 1);
    }
  }

  const colGroups = {};
  for (const [id, col] of Object.entries(colMap)) {
    if (!colGroups[col]) colGroups[col] = [];
    colGroups[col].push(id);
  }

  const positions = {};
  const COL_W = 200, ROW_H = 90;
  for (const [col, ids] of Object.entries(colGroups)) {
    ids.forEach((id, row) => {
      const totalRows = ids.length;
      positions[id] = {
        x: parseInt(col) * COL_W + 80,
        y: row * ROW_H + 50 - (totalRows - 1) * ROW_H / 2 + 200,
      };
    });
  }
  return positions;
}

function Tooltip({ node, pos }) {
  if (!node) return null;
  const deadline = node.deadline ? new Date(node.deadline).toLocaleDateString() : 'No deadline';
  return (
    <g>
      <rect x={pos.x - 60} y={pos.y - 80} width={160} height={64} rx={8} fill="white"
        stroke="#e1e3e4" strokeWidth={1} filter="url(#shadow)" />
      <text x={pos.x + 20} y={pos.y - 60} textAnchor="middle" fontSize={11} fontWeight="700" fill="#191c1d"
        style={{ fontFamily: 'Inter, sans-serif' }}>
        {node.title.length > 18 ? node.title.slice(0, 18) + '…' : node.title}
      </text>
      <text x={pos.x + 20} y={pos.y - 43} textAnchor="middle" fontSize={9} fill="#555f6d"
        style={{ fontFamily: 'Inter, sans-serif' }}>
        {node.status.replace('_', ' ')} · {node.estimated_hours || '?'}h
      </text>
      <text x={pos.x + 20} y={pos.y - 28} textAnchor="middle" fontSize={9} fill="#737686"
        style={{ fontFamily: 'Inter, sans-serif' }}>
        {deadline}
      </text>
    </g>
  );
}

export default function DependencyGraph() {
  const { tasks, edges, suggestions } = useTask();
  const [hoveredId, setHoveredId] = useState(null);

  const criticalPathIds = useMemo(() => findCriticalPath(tasks, edges), [tasks, edges]);
  const positions = useMemo(() => layoutNodes(tasks, edges), [tasks, edges]);

  const criticalSuggestionIds = useMemo(() => {
    const s = suggestions.find((s) => s.type === 'critical_path');
    return new Set(s?.task_ids || []);
  }, [suggestions]);

  if (!tasks.length) {
    return (
      <div className="flex items-center justify-center h-36 text-sm text-slate-400">
        No tasks yet — create tasks to see the dependency graph.
      </div>
    );
  }

  const maxX = Math.max(...Object.values(positions).map((p) => p.x), 0) + 180;
  const maxY = Math.max(...Object.values(positions).map((p) => p.y), 0) + 80;
  const svgW = Math.max(maxX, 500);
  const svgH = Math.max(maxY, 300);

  const hovered = tasks.find((t) => t.id === hoveredId);
  const hovPos = hoveredId ? positions[hoveredId] : null;

  return (
    <div className="overflow-x-auto">
      <svg width={svgW} height={svgH} style={{ minWidth: '100%' }}>
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1" />
          </filter>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
          </marker>
          <marker id="arrow-critical" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#ef4444" />
          </marker>
          <marker id="arrow-blocked" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#f97316" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((e, i) => {
          const from = positions[e.parent_task_id];
          const to   = positions[e.child_task_id];
          if (!from || !to) return null;

          const isCritical = criticalPathIds.has(e.parent_task_id) && criticalPathIds.has(e.child_task_id);
          const isBlocked  = tasks.find((t) => t.id === e.child_task_id)?.status === 'blocked';

          const mx = (from.x + to.x) / 2;
          const color  = isCritical ? '#ef4444' : isBlocked ? '#f97316' : '#cbd5e1';
          const marker = isCritical ? 'url(#arrow-critical)' : isBlocked ? 'url(#arrow-blocked)' : 'url(#arrow)';
          const strokeW = isCritical ? 2.5 : 1.5;

          return (
            <g key={i}>
              <path
                d={`M ${from.x + 60} ${from.y} C ${mx + 30} ${from.y}, ${mx - 30} ${to.y}, ${to.x - 10} ${to.y}`}
                fill="none" stroke={color} strokeWidth={strokeW} strokeDasharray={isCritical ? 'none' : '4,3'}
                markerEnd={marker} opacity={0.85}
              />
              {isCritical && (
                <path
                  d={`M ${from.x + 60} ${from.y} C ${mx + 30} ${from.y}, ${mx - 30} ${to.y}, ${to.x - 10} ${to.y}`}
                  fill="none" stroke={color} opacity={0.15}
                  strokeWidth={6}
                />
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {tasks.map((task) => {
          const pos = positions[task.id];
          if (!pos) return null;

          const isCritical  = criticalPathIds.has(task.id);
          const isSuggested = criticalSuggestionIds.has(task.id);
          const isHovered   = hoveredId === task.id;
          const statusColor = STATUS_COLORS[task.status] || '#94a3b8';
          const priColor    = PRIORITY_COLORS[task.priority] || '#94a3b8';

          const nodeW = 120, nodeH = 44;

          return (
            <g key={task.id}
              transform={`translate(${pos.x - nodeW / 2}, ${pos.y - nodeH / 2})`}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredId(task.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Glow for critical path */}
              {isCritical && (
                <rect x={-3} y={-3} width={nodeW + 6} height={nodeH + 6} rx={13}
                  fill="none" stroke="#ef4444" strokeWidth={2} opacity={0.25} />
              )}
              {/* Card */}
              <rect x={0} y={0} width={nodeW} height={nodeH} rx={10}
                fill="white" stroke={isCritical ? '#ef4444' : isSuggested ? '#f97316' : '#e1e3e4'}
                strokeWidth={isCritical || isSuggested ? 2 : 1}
                filter="url(#shadow)"
                transform={isHovered ? 'scale(1.05) translate(-3,-2)' : ''}
                style={{ transition: 'transform 0.15s' }}
              />
              {/* Status dot */}
              <circle cx={14} cy={22} r={5} fill={statusColor} />
              {/* Priority stripe */}
              <rect x={nodeW - 4} y={4} width={4} height={nodeH - 8} rx={2} fill={priColor} />
              {/* Title */}
              <text x={24} y={16} fontSize={9} fontWeight="700" fill="#191c1d"
                style={{ fontFamily: 'Inter, sans-serif' }}>
                {task.title.length > 16 ? task.title.slice(0, 16) + '…' : task.title}
              </text>
              <text x={24} y={29} fontSize={8} fill="#737686"
                style={{ fontFamily: 'Inter, sans-serif' }}>
                {task.status.replace('_', ' ')} · {task.estimated_hours || '?'}h
              </text>
              {/* Blocked badge */}
              {task.status === 'blocked' && (
                <text x={nodeW / 2} y={42} fontSize={7} fill="#ef4444" textAnchor="middle"
                  fontWeight="bold" style={{ fontFamily: 'Inter, sans-serif' }}>
                  BLOCKED
                </text>
              )}
            </g>
          );
        })}

        {/* Hover tooltip */}
        {hovered && hovPos && <Tooltip node={hovered} pos={hovPos} />}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 px-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-0.5 bg-red-400 rounded" />
          <span className="text-[10px] text-slate-500">Critical path</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-0.5 bg-slate-300 rounded border-dashed border-t" style={{ borderStyle: 'dashed' }} />
          <span className="text-[10px] text-slate-500">Dependency</span>
        </div>
        {Object.entries(STATUS_COLORS).map(([s, c]) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
            <span className="text-[10px] text-slate-500">{s.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
