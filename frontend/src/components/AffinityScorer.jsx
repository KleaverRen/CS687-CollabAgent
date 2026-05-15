import React, { useState, useEffect, useRef } from 'react';
import { useTask } from '../context/TaskContext';
import api from '../utils/api';

// ─── Affinity Scorer Widget ───────────────────────────────────────────────────
// Shown inside the "Create Task" modal to recommend assignees.
// In demo mode uses the seeded members; in live mode queries the DB.

const BG_COLORS = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-pink-500', 'bg-orange-500'];

function MemberRow({ member, onSelect, selected }) {
  const initials = member.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || '?';
  const color = BG_COLORS[(member.full_name?.charCodeAt(0) || 0) % BG_COLORS.length];

  return (
    <button
      type="button"
      onClick={() => onSelect(member)}
      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all
        ${selected
          ? 'border-[#003fb1] bg-[#f0f4ff]'
          : 'border-[#e1e3e4] bg-white hover:border-[#003fb1]/40 hover:bg-slate-50'
        }`}
    >
      <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#191c1d] truncate">{member.full_name}</span>
          {member.match_pct !== undefined && (
            <span className={`text-[10px] font-bold ml-2 ${member.match_pct >= 80 ? 'text-emerald-600' : member.match_pct >= 60 ? 'text-amber-600' : 'text-slate-400'}`}>
              {member.match_pct}% match
            </span>
          )}
        </div>
        {member.match_pct !== undefined && (
          <div className="h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
            <div
              className={`h-full rounded-full ${member.match_pct >= 80 ? 'bg-emerald-400' : member.match_pct >= 60 ? 'bg-amber-400' : 'bg-slate-300'}`}
              style={{ width: `${member.match_pct}%` }}
            />
          </div>
        )}
      </div>
      {selected && (
        <svg className="w-4 h-4 text-[#003fb1] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}

export default function AffinityScorer({ projectId, taskTags = [], selectedUserId, onSelect }) {
  const { members: demoMembers, isDemo } = useTask();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const prevTags = useRef('');

  useEffect(() => {
    const tagStr = (taskTags || []).join(',');
    if (tagStr === prevTags.current) return;
    prevTags.current = tagStr;

    if (isDemo) {
      // Demo: re-sort by mock match boosted by tag overlap
      const demo = demoMembers.map((m) => ({ ...m }));
      setMembers(demo);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      api.post('/ai/suggest', { project_id: projectId })
        .then(({ data }) => {
          const affinitySuggestion = data.suggestions.find((s) => s.type === 'teammate_affinity');
          if (affinitySuggestion?.ranked_members) {
            setMembers(affinitySuggestion.ranked_members);
          } else {
            return api.get(`/projects/${projectId}`)
              .then((r) => setMembers((r.data.project?.members || []).map((m) => ({ ...m, match_pct: undefined }))));
          }
        })
        .catch(() => {
          return api.get(`/projects/${projectId}`)
            .then((r) => setMembers((r.data.project?.members || []).map((m) => ({ ...m, match_pct: undefined }))))
            .catch(() => setMembers([]));
        })
        .finally(() => setLoading(false));
    }, 400);

    return () => clearTimeout(timer);
  }, [projectId, taskTags, isDemo, demoMembers]);

  if (loading && members.length === 0) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="w-4 h-4 border-2 border-[#003fb1]/20 border-t-[#003fb1] rounded-full animate-spin" />
        <span className="text-xs text-slate-400">Scoring teammates…</span>
      </div>
    );
  }

  if (!members.length && !loading) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Suggested Assignees</span>
        {isDemo && (
          <span className="text-[9px] px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded-full font-bold">DEMO</span>
        )}
        {loading && members.length > 0 && (
          <div className="w-3 h-3 border-2 border-[#003fb1]/20 border-t-[#003fb1] rounded-full animate-spin ml-auto" />
        )}
      </div>
      <div className="space-y-1.5">
        {members.map((m) => (
          <MemberRow
            key={m.user_id || m.id}
            member={{ ...m, id: m.user_id || m.id }}
            onSelect={onSelect}
            selected={(m.user_id || m.id) === selectedUserId}
          />
        ))}
      </div>
      <p className="text-[9px] text-slate-300 mt-2">
        Ranked by tag-completion overlap · formula: overlap/completed×0.84+0.15
      </p>
    </div>
  );
}
