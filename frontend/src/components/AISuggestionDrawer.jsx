import React from 'react';
import { useTask } from '../context/TaskContext';

const SEVERITY_CONFIG = {
  critical: {
    bg: 'bg-red-50 border-red-200',
    icon_bg: 'bg-red-100',
    badge: 'bg-red-500 text-white',
    bar: 'bg-red-500',
    icon: (
      <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200',
    icon_bg: 'bg-amber-100',
    badge: 'bg-amber-500 text-white',
    bar: 'bg-amber-500',
    icon: (
      <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  info: {
    bg: 'bg-blue-50 border-blue-100',
    icon_bg: 'bg-blue-100',
    badge: 'bg-blue-500 text-white',
    bar: 'bg-blue-500',
    icon: (
      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

const TYPE_LABELS = {
  blocker:          'Blocker Detected',
  split:            'Split Recommendation',
  critical_path:    'Critical Path',
  priority_rerank:  'Priority Mismatch',
  teammate_affinity:'Teammate Match',
};

const TYPE_ICONS = {
  blocker:          '⊗',
  split:            '✂',
  critical_path:    '⚡',
  priority_rerank:  '↑',
  teammate_affinity:'👤',
};

function ConfidenceBar({ value, formula, barColor }) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-slate-400 font-medium">Confidence</span>
        <span className="text-[10px] font-bold text-slate-600">{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {formula && (
        <p className="text-[9px] text-slate-300 mt-1 font-mono">{formula}</p>
      )}
    </div>
  );
}

function AffinityMember({ member }) {
  const initials = member.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || '?';
  const colors = ['bg-violet-500','bg-blue-500','bg-emerald-500'];
  const color = colors[(member.full_name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className={`w-7 h-7 ${color} rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 truncate">{member.full_name}</span>
          <span className="text-[10px] font-bold text-emerald-600 ml-2">{member.match_pct}%</span>
        </div>
        <div className="h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${member.match_pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion, onApply, onDismiss }) {
  const cfg = SEVERITY_CONFIG[suggestion.severity] || SEVERITY_CONFIG.info;

  return (
    <div className={`border rounded-2xl p-4 mb-3 ${cfg.bg} transition-all animate-fadeIn`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.icon_bg}`}>
          {cfg.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${cfg.badge}`}>
              {TYPE_LABELS[suggestion.type] || suggestion.type}
            </span>
            <span className="text-[10px] text-slate-400">{TYPE_ICONS[suggestion.type]}</span>
          </div>
          <h5 className="text-xs font-bold text-slate-800 leading-snug">{suggestion.title}</h5>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed mb-3">{suggestion.description}</p>

      {/* Teammate list */}
      {suggestion.type === 'teammate_affinity' && suggestion.ranked_members?.length > 0 && (
        <div className="mb-3 border-t border-white/60 pt-2">
          {suggestion.ranked_members.map((m) => (
            <AffinityMember key={m.user_id} member={m} />
          ))}
        </div>
      )}

      {/* Critical path task IDs */}
      {suggestion.type === 'critical_path' && suggestion.task_ids && (
        <div className="flex gap-1 flex-wrap mb-3">
          {suggestion.task_ids.map((id, i) => (
            <span key={id} className="flex items-center gap-1">
              <span className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono">{id.slice(0,8)}</span>
              {i < suggestion.task_ids.length - 1 && <span className="text-slate-300 text-[10px]">→</span>}
            </span>
          ))}
        </div>
      )}

      {/* Confidence */}
      <ConfidenceBar value={suggestion.confidence} formula={suggestion.confidence_formula} barColor={cfg.bar} />

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        {suggestion.action_label && (
          <button
            onClick={() => onApply(suggestion)}
            className="flex-1 h-8 text-[11px] font-bold bg-[#003fb1] text-white rounded-xl hover:bg-[#1353d8] transition-colors"
          >
            {suggestion.action_label}
          </button>
        )}
        <button
          onClick={() => onDismiss(suggestion)}
          className="h-8 px-3 text-[11px] text-slate-400 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export default function AISuggestionDrawer({ open, onClose }) {
  const { suggestions, setSuggestions, applyAction, aiLoading } = useTask();

  const handleDismiss = (suggestion) => {
    setSuggestions((prev) => prev.filter((s) => s !== suggestion));
  };

  const criticalCount = suggestions.filter((s) => s.severity === 'critical').length;
  const warningCount  = suggestions.filter((s) => s.severity === 'warning').length;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/10 backdrop-blur-[2px]" onClick={onClose} />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full z-40 w-80 bg-white border-l border-[#e1e3e4] shadow-2xl flex flex-col transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e1e3e4] flex-shrink-0">
          <div>
            <h3 className="font-bold text-[#191c1d] text-sm">AI Workflow Analysis</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {aiLoading
                ? 'Running analysis…'
                : suggestions.length === 0
                ? 'No issues detected'
                : `${suggestions.length} suggestion${suggestions.length > 1 ? 's' : ''}`
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {criticalCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                {warningCount}
              </span>
            )}
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {aiLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-[#003fb1]/20 animate-ping" />
                <div className="absolute inset-1 rounded-full border-2 border-t-[#003fb1] border-transparent animate-spin" />
                <div className="absolute inset-3 rounded-full bg-[#003fb1]/10" />
              </div>
              <p className="text-xs text-slate-400">Running 5 workflow algorithms…</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center gap-2">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-2xl">✓</div>
              <p className="text-sm font-semibold text-slate-600">Workflow looks healthy</p>
              <p className="text-[11px] text-slate-400">No blockers, split needs, or priority issues detected.</p>
            </div>
          ) : (
            suggestions.map((s, i) => (
              <SuggestionCard key={i} suggestion={s} onApply={applyAction} onDismiss={handleDismiss} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#e1e3e4] flex-shrink-0">
          <p className="text-[9px] text-slate-300 text-center leading-relaxed">
            All suggestions are rule-based. Confidence formulas are shown per card.
            No external ML service is used.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .animate-fadeIn { animation: fadeIn 0.25s ease-out; }
      `}</style>
    </>
  );
}
