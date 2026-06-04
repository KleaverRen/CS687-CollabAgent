import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTask } from '../context/TaskContext';
import api from '../utils/api';

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
  blocker: (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.36 18.36A9 9 0 015.64 5.64m12.72 12.72A9 9 0 005.64 5.64m12.72 12.72L5.64 5.64" />
    </svg>
  ),
  split: (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16m0-8h10m0 0l-4-4m4 4l-4 4" />
    </svg>
  ),
  critical_path: (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  priority_rerank: (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  ),
  teammate_affinity: (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m8-4a4 4 0 10-8 0 4 4 0 008 0z" />
    </svg>
  ),
};

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };
const DEFAULT_ALGORITHM_COUNT = 5;
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'warning', label: 'Warning' },
  { id: 'info', label: 'Info' },
];

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatPriority(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Medium';
}

function formatAssignee(value, members) {
  if (!value) return 'Unassigned';
  return members.find((member) => member.id === value)?.full_name || 'Unassigned';
}

function SuggestionField({
  label,
  children,
  canAccept = true,
  onAccept,
}) {
  return (
    <div className="rounded-xl border border-[#e1e3e4] bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
        <button
          type="button"
          onClick={onAccept}
          disabled={!canAccept}
          className="h-7 rounded-lg bg-[#003fb1] px-2.5 text-[10px] font-bold text-white transition-colors hover:bg-[#1353d8] disabled:cursor-not-allowed disabled:bg-[#e1e3e4] disabled:text-[#737686]"
        >
          Accept Suggestion
        </button>
      </div>
      {children}
    </div>
  );
}

export function TaskAttributeAISuggestionDrawer({
  open,
  onClose,
  projectId,
  title,
  description,
  form,
  members = [],
  onChange,
  provider = 'gemini',
}) {
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasEnoughInput = title.trim().length > 2 || description.trim().length > 8;

  const fetchSuggestion = useCallback(async () => {
    if (!hasEnoughInput) {
      setError('Add a task title or description first.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/tasks/suggest', {
        project_id: UUID_PATTERN.test(projectId || '') ? projectId : undefined,
        title,
        description,
        provider,
      });
      setSuggestion(data.suggestion);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate suggestions.');
    } finally {
      setLoading(false);
    }
  }, [description, hasEnoughInput, projectId, provider, title]);

  useEffect(() => {
    if (open && !suggestion && !loading && hasEnoughInput) {
      fetchSuggestion();
    }
  }, [fetchSuggestion, hasEnoughInput, loading, open, suggestion]);

  useEffect(() => {
    if (!open) return undefined;
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, open]);

  const updateDraft = (field, value) => {
    setSuggestion((prev) => ({ ...(prev || {}), [field]: value }));
  };

  const acceptField = (field) => {
    if (!suggestion) return;
    onChange(field, suggestion[field] ?? '');
  };

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close AI task suggestions"
          className="fixed inset-0 z-[60] bg-black/10 backdrop-blur-[2px]"
          onClick={onClose}
        />
      )}

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="AI task attribute suggestions"
        className={`fixed right-0 top-0 z-[70] flex h-full w-full max-w-sm flex-col border-l border-[#e1e3e4] bg-[#f8f9fb] shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#e1e3e4] bg-white px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-[#191c1d]">AI Task Suggestions</h3>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Review, edit, then accept fields into the task form.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
            aria-label="Close AI task suggestions"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <button
            type="button"
            onClick={fetchSuggestion}
            disabled={loading || !hasEnoughInput}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#003fb1] text-xs font-bold text-white transition-colors hover:bg-[#1353d8] disabled:cursor-not-allowed disabled:bg-[#e1e3e4] disabled:text-[#737686]"
          >
            {loading && (
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {loading ? 'Generating...' : suggestion ? 'Regenerate Suggestions' : 'Generate Suggestions'}
          </button>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {!suggestion && !loading && !error && (
            <div className="rounded-xl border border-dashed border-[#c3c5d7] bg-white px-4 py-6 text-center text-xs text-slate-400">
              Enter a title or description, then generate suggestions.
            </div>
          )}

          {suggestion && (
            <>
              <SuggestionField label="Priority" onAccept={() => acceptField('priority')}>
                <select
                  value={suggestion.priority || form.priority || 'medium'}
                  onChange={(event) => updateDraft('priority', event.target.value)}
                  className="h-10 w-full rounded-xl border border-[#c3c5d7] bg-white px-3 text-sm outline-none focus:border-[#003fb1]"
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>{formatPriority(priority)}</option>
                  ))}
                </select>
              </SuggestionField>

              <SuggestionField label="Estimated Hours" onAccept={() => acceptField('estimated_hours')}>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={suggestion.estimated_hours ?? ''}
                  onChange={(event) => updateDraft('estimated_hours', event.target.value)}
                  className="h-10 w-full rounded-xl border border-[#c3c5d7] bg-white px-3 text-sm outline-none focus:border-[#003fb1]"
                />
              </SuggestionField>

              <SuggestionField label="Assignee" onAccept={() => acceptField('assigned_to')}>
                <select
                  value={suggestion.assigned_to || ''}
                  onChange={(event) => updateDraft('assigned_to', event.target.value || null)}
                  className="h-10 w-full rounded-xl border border-[#c3c5d7] bg-white px-3 text-sm outline-none focus:border-[#003fb1]"
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name}{member.member_role ? ` (${member.member_role})` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-slate-400">
                  Suggested: {formatAssignee(suggestion.assigned_to, members)}
                </p>
              </SuggestionField>

              <SuggestionField label="Deadline" onAccept={() => acceptField('deadline')}>
                <input
                  type="date"
                  value={suggestion.deadline || ''}
                  onChange={(event) => updateDraft('deadline', event.target.value || null)}
                  className="h-10 w-full rounded-xl border border-[#c3c5d7] bg-white px-3 text-sm outline-none focus:border-[#003fb1]"
                />
              </SuggestionField>

              {suggestion.rationale && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] leading-5 text-blue-800">
                  {suggestion.rationale}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

const ConfidenceBar = memo(function ConfidenceBar({ value, formula, barColor }) {
  const pct = Math.round((value ?? 0) * 100);
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
});

const AffinityMember = memo(function AffinityMember({ member }) {
  const initials = member.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || '?';
  const colors = ['bg-violet-500','bg-blue-500','bg-emerald-500'];
  const firstChar = member.full_name?.charCodeAt(0);
  const colorIndex = typeof firstChar === 'number' && !Number.isNaN(firstChar) ? firstChar % colors.length : 0;
  const color = colors[colorIndex];
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
});

function ApplySuggestionModal({ suggestion, loading, onCancel, onConfirm }) {
  if (!suggestion) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <section
        className="w-full max-w-md rounded-xl border border-[#d8dde6] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-suggestion-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#e1e3e4] px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#d6e0f1] text-[#003fb1]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </span>
            <div>
              <h2 id="apply-suggestion-title" className="text-base font-bold text-[#191c1d]">
                Apply suggestion?
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#434654]">
                This will update the task board using the selected AI suggestion.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#596170] hover:bg-[#f3f4f5] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close apply suggestion confirmation"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="rounded-lg border border-[#e1e3e4] bg-[#f8f9fb] px-4 py-3">
            <p className="text-sm font-semibold text-[#191c1d]">{suggestion.action_label || suggestion.title}</p>
            <p className="mt-1 text-xs leading-5 text-[#596170]">{suggestion.title}</p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 px-5 py-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#b9c0d4] bg-white px-4 text-sm font-semibold text-[#191c1d] transition-colors hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#003fb1] px-4 text-sm font-bold text-white transition-colors hover:bg-[#1353d8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            Apply Suggestion
          </button>
        </div>
      </section>
    </div>
  );
}

const SuggestionCard = memo(function SuggestionCard({ suggestion, onApply, onDismiss, readOnly = false, applying = false }) {
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
            <span className="text-slate-400" aria-hidden="true">{TYPE_ICONS[suggestion.type]}</span>
          </div>
          <h4 className="text-xs font-bold text-slate-800 leading-snug">{suggestion.title}</h4>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed mb-3">{suggestion.description}</p>

      {/* Teammate list */}
      {suggestion.type === 'teammate_affinity' && suggestion.ranked_members?.length > 0 && (
        <div className="mb-3 border-t border-white/60 pt-2">
          {suggestion.ranked_members.map((m) => (
            <AffinityMember key={m.user_id || m.id || m.full_name} member={m} />
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
            type="button"
            onClick={() => onApply(suggestion)}
            disabled={readOnly || applying}
            className="flex-1 h-8 text-[11px] font-bold bg-[#003fb1] text-white rounded-xl hover:bg-[#1353d8] transition-colors disabled:bg-[#e1e3e4] disabled:text-[#737686]"
          >
            {applying ? 'Applying...' : suggestion.action_label}
          </button>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={() => onDismiss(suggestion)}
            className="h-8 px-3 text-[11px] text-slate-400 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
});

export default function AISuggestionDrawer({ open, onClose, readOnly = false, algorithmCount = DEFAULT_ALGORITHM_COUNT }) {
  const { suggestions, setSuggestions, applyAction, aiLoading } = useTask();
  const [applyingId, setApplyingId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [pendingSuggestion, setPendingSuggestion] = useState(null);

  const sortedSuggestions = useMemo(
    () => [...suggestions].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)),
    [suggestions]
  );
  const visibleSuggestions = useMemo(
    () => activeFilter === 'all'
      ? sortedSuggestions
      : sortedSuggestions.filter((suggestion) => suggestion.severity === activeFilter),
    [activeFilter, sortedSuggestions]
  );

  const handleDismiss = useCallback((suggestion) => {
    if (readOnly) return;
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    toast((t) => (
      <span className="flex items-center gap-3 pr-1">
        <span>Suggestion dismissed.</span>
        <button
          type="button"
          className="text-xs font-bold text-[#003fb1]"
          onClick={() => {
            setSuggestions((prev) => [suggestion, ...prev]);
            toast.dismiss(t.id);
          }}
        >
          Undo
        </button>
        <button
          type="button"
          className="grid h-6 w-6 place-items-center rounded-md text-[#737686] transition-colors hover:bg-[#f3f4f5] hover:text-[#191c1d]"
          onClick={() => toast.dismiss(t.id)}
          aria-label="Dismiss toast"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
    ), { duration: 2500 });
  }, [readOnly, setSuggestions]);

  const handleApply = useCallback(async (suggestion) => {
    if (readOnly || applyingId) return;
    setPendingSuggestion(suggestion);
  }, [applyingId, readOnly]);

  const handleCancelApply = useCallback(() => {
    if (applyingId) return;
    setPendingSuggestion(null);
  }, [applyingId]);

  const handleConfirmApply = useCallback(async () => {
    if (!pendingSuggestion || applyingId) return;

    setApplyingId(pendingSuggestion.id);
    try {
      await applyAction(pendingSuggestion);
      setPendingSuggestion(null);
    } finally {
      setApplyingId(null);
    }
  }, [applyingId, applyAction, pendingSuggestion]);

  useEffect(() => {
    if (!open) return undefined;
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (pendingSuggestion) {
        handleCancelApply();
        return;
      }
      onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleCancelApply, onClose, open, pendingSuggestion]);

  const criticalCount = suggestions.filter((s) => s.severity === 'critical').length;
  const warningCount  = suggestions.filter((s) => s.severity === 'warning').length;

  useEffect(() => {
    if (aiLoading) return;
    setActiveFilter('all');
  }, [aiLoading]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <button
          type="button"
          aria-label="Close suggestions panel"
          className="fixed inset-0 z-30 bg-black/10 backdrop-blur-[2px] cursor-default"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI Suggestions"
        className={`fixed top-0 right-0 h-full z-40 w-full max-w-sm bg-white border-l border-[#e1e3e4] shadow-2xl flex flex-col transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e1e3e4] flex-shrink-0">
          <div>
            <h3 className="font-bold text-[#191c1d] text-sm">Suggestions</h3>
            <p className="text-[10px] text-slate-400 mt-0.5" aria-live="polite">
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
            <button type="button" onClick={onClose} aria-label="Close suggestions panel" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {aiLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3" role="status" aria-live="polite">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-[#003fb1]/20 animate-ping" />
                <div className="absolute inset-1 rounded-full border-2 border-t-[#003fb1] border-transparent animate-spin" />
                <div className="absolute inset-3 rounded-full bg-[#003fb1]/10" />
              </div>
              <p className="text-xs text-slate-400">
                Running {algorithmCount} workflow algorithm{algorithmCount === 1 ? '' : 's'}...
              </p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center gap-2" role="status" aria-live="polite">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-2xl">✓</div>
              <p className="text-sm font-semibold text-slate-600">Workflow looks healthy</p>
              <p className="text-[11px] text-slate-400">No blockers, split needs, or priority issues detected.</p>
            </div>
          ) : (
            <>
              <div className="flex gap-1 mb-3 p-1 bg-slate-100 rounded-xl" aria-label="Filter suggestions by severity">
                {FILTERS.map((filter) => {
                  const selected = activeFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setActiveFilter(filter.id)}
                      className={`flex-1 h-7 rounded-lg text-[10px] font-bold transition-colors ${
                        selected ? 'bg-white text-[#003fb1] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                      aria-pressed={selected}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>

              {visibleSuggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center gap-1" role="status" aria-live="polite">
                  <p className="text-sm font-semibold text-slate-600">No {activeFilter} suggestions</p>
                  <p className="text-[11px] text-slate-400">Change the filter to view other severities.</p>
                </div>
              ) : (
                visibleSuggestions.map((s) => (
                  <SuggestionCard
                    key={s.id}
                    suggestion={s}
                    onApply={handleApply}
                    onDismiss={handleDismiss}
                    readOnly={readOnly}
                    applying={applyingId === s.id}
                  />
                ))
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!aiLoading && suggestions.length > 0 && (
          <div className="px-4 py-3 border-t border-[#e1e3e4] flex-shrink-0">
            <p className="text-[9px] text-slate-300 text-center leading-relaxed">
              All suggestions are rule-based. Confidence formulas are shown per card.
              No external ML service is used.
            </p>
          </div>
        )}
      </div>

      <ApplySuggestionModal
        suggestion={pendingSuggestion}
        loading={Boolean(applyingId)}
        onCancel={handleCancelApply}
        onConfirm={handleConfirmApply}
      />
    </>
  );
}
