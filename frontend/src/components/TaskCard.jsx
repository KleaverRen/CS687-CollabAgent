import React, { useState } from 'react';
import { useTask } from '../context/TaskContext';

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', color: 'bg-red-500/15 text-red-600 border border-red-200',  dot: 'bg-red-500'    },
  high:     { label: 'High',     color: 'bg-orange-500/15 text-orange-600 border border-orange-200', dot: 'bg-orange-500' },
  medium:   { label: 'Medium',   color: 'bg-amber-400/15 text-amber-700 border border-amber-200',   dot: 'bg-amber-400'  },
  low:      { label: 'Low',      color: 'bg-slate-100 text-slate-500 border border-slate-200',       dot: 'bg-slate-400'  },
};

const STATUS_CONFIG = {
  todo:        { label: 'To Do',       icon: '○', color: 'text-slate-400' },
  in_progress: { label: 'In Progress', icon: '◑', color: 'text-blue-500'  },
  blocked:     { label: 'Blocked',     icon: '⊗', color: 'text-red-500'   },
  done:        { label: 'Done',        icon: '●', color: 'text-emerald-500'},
};

function Avatar({ name, avatarUrl, size = 'sm' }) {
  const initials = name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const sz = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';
  if (avatarUrl) return <img src={avatarUrl} className={`${sz} rounded-full object-cover ring-1 ring-white`} alt={name} />;
  const colors = ['bg-violet-500','bg-blue-500','bg-emerald-500','bg-orange-500','bg-pink-500'];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center text-white font-bold ring-1 ring-white select-none`}>
      {initials}
    </div>
  );
}

function DeadlineBadge({ deadline }) {
  if (!deadline) return null;
  const days = Math.ceil((new Date(deadline) - new Date()) / 86400000);
  const overdue = days < 0;
  const urgent  = days >= 0 && days <= 2;
  const soon    = days > 2 && days <= 7;
  const cls = overdue ? 'bg-red-100 text-red-600' : urgent ? 'bg-orange-100 text-orange-600' : soon ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`}
    </span>
  );
}

export default function TaskCard({ task, onOpen, dragging, readOnly = false }) {
  const { updateTask, deleteTask } = useTask();
  const [menuOpen, setMenuOpen] = useState(false);

  const p = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

  const hasBlockers   = parseInt(task.blocker_count) > 0;
  const hasDependents = parseInt(task.dependent_count) > 0;

  return (
    <div
      className={`group relative bg-white border rounded-2xl p-4 cursor-pointer select-none transition-all duration-200
        ${task.status === 'blocked'
          ? 'border-red-200 shadow-sm shadow-red-100 hover:shadow-md hover:shadow-red-100'
          : 'border-[#e1e3e4] hover:border-[#003fb1]/40 hover:shadow-md'
        }
        ${dragging ? 'opacity-50 scale-95' : 'hover:-translate-y-0.5'}
      `}
      onClick={() => onOpen(task)}
    >
      {/* Priority stripe */}
      <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${p.dot}`} />

      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2.5 pl-2">
        <h4 className={`text-sm font-semibold leading-snug flex-1 ${task.status === 'done' ? 'line-through text-slate-400' : 'text-[#191c1d]'}`}>
          {task.title}
        </h4>
        <div className="flex items-center gap-1 flex-shrink-0">
          {task.status === 'blocked' && (
            <span className="text-red-500 animate-pulse" title="Blocked">⊗</span>
          )}
          {!readOnly && <button
            className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-all"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="10" cy="4"  r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" />
            </svg>
          </button>}
        </div>
      </div>

      {/* Description preview */}
      {task.description && (
        <p className="text-[11px] text-slate-400 line-clamp-1 mb-2.5 pl-2">{task.description}</p>
      )}

      {/* Tags */}
      {task.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5 pl-2">
          {task.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] px-2 py-0.5 bg-[#dbe1ff] text-[#003fb1] rounded-full font-medium">
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full">+{task.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pl-2">
        <div className="flex items-center gap-2">
          {/* Priority */}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.color}`}>
            {p.label}
          </span>

          {/* Dep counters */}
          {hasBlockers && (
            <span className="text-[10px] text-red-500 font-semibold flex items-center gap-0.5" title={`${task.blocker_count} blocker(s)`}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
              {task.blocker_count}
            </span>
          )}
          {hasDependents && (
            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-0.5" title={`${task.dependent_count} dependent(s)`}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 015.656 0l.101 1.102a4 4 0 01-5.656 5.656l-4-4a4 4 0 010-5.656" /></svg>
              {task.dependent_count}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <DeadlineBadge deadline={task.deadline} />
          {task.assignee_name && (
            <Avatar name={task.assignee_name} avatarUrl={task.assignee_avatar} />
          )}
        </div>
      </div>

      {/* Dropdown menu */}
      {menuOpen && !readOnly && (
        <div
          className="absolute right-2 top-10 z-20 bg-white border border-[#e1e3e4] rounded-xl shadow-lg py-1 w-40"
          onClick={(e) => e.stopPropagation()}
        >
          {['todo','in_progress','blocked','done'].map((s) => (
            <button key={s} className="w-full text-left px-3 py-2 text-xs text-[#434654] hover:bg-slate-50 flex items-center gap-2"
              onClick={() => { updateTask(task.id, { status: s }); setMenuOpen(false); }}>
              <span className={STATUS_CONFIG[s].color}>{STATUS_CONFIG[s].icon}</span>
              {STATUS_CONFIG[s].label}
            </button>
          ))}
          <hr className="my-1 border-[#e1e3e4]" />
          <button className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50"
            onClick={() => { deleteTask(task.id); setMenuOpen(false); }}>
            Delete task
          </button>
        </div>
      )}
    </div>
  );
}

export { Avatar, DeadlineBadge, PRIORITY_CONFIG, STATUS_CONFIG };
