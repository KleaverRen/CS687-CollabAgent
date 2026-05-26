import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api from '../utils/api';

const labels = {
  'project.created': 'Project created',
  'project.updated': 'Project updated',
  'project.member_added': 'Member added',
  'task.created': 'Task created',
  'task.updated': 'Task updated',
  'task.deleted': 'Task deleted',
  'task.dependency_created': 'Dependency added',
  'task.dependency_removed': 'Dependency removed',
  'meeting.logged': 'Meeting logged',
  'document.indexed': 'Document indexed',
};

function describe(activity) {
  const metadata = activity.metadata || {};
  if (metadata.title) return metadata.title;
  if (metadata.name) return metadata.name;
  if (metadata.memberName) return metadata.memberName;
  if (activity.project_name) return activity.project_name;
  return activity.event_type.replaceAll('.', ' ');
}

function formatDate(value) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ActivityFeed({ projectId, title = 'Activity Feed', limit = 20 }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef(null);

  const fetchActivities = useCallback(async ({ append = false } = {}) => {
    const before = append ? cursorRef.current : null;
    append ? setLoadingMore(true) : setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (projectId) params.set('project_id', projectId);
      if (before) params.set('before', before);
      const { data } = await api.get(`/notifications/activity?${params.toString()}`);
      const nextActivities = data.activities || [];
      setActivities((current) => append ? [...current, ...nextActivities] : nextActivities);
      cursorRef.current = nextActivities.length
        ? nextActivities[nextActivities.length - 1].created_at
        : before;
      setHasMore(nextActivities.length === limit);
    } catch {
      setError('Failed to load activity.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [limit, projectId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities, projectId]);

  return (
    <div className="bg-white rounded-2xl p-6 border border-[#e1e3e4] shadow-sm h-full">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h3 className="text-sm font-bold text-[#434654] uppercase tracking-wider">{title}</h3>
        <button
          type="button"
          onClick={() => fetchActivities()}
          className="text-xs font-bold text-[#003fb1] hover:underline"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#737686]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading activity
        </div>
      ) : error ? (
        <div className="text-sm text-[#ba1a1a]">{error}</div>
      ) : activities.length === 0 ? (
        <div className="text-sm text-[#737686] italic">No recent activity.</div>
      ) : (
        <>
          <div className="relative ml-3 space-y-6 border-l-2 border-[#e1e3e4]">
            {activities.map((activity) => (
              <div key={activity.id} className="relative pl-6">
                <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-[#003fb1] bg-white"></div>
                <div className="mb-1 text-xs font-semibold text-[#003fb1]">
                  {formatDate(activity.created_at)}
                </div>
                <div className="text-sm font-semibold leading-tight text-[#191c1d]">
                  {labels[activity.event_type] || activity.event_type}
                </div>
                <div className="mt-1 text-xs leading-relaxed text-[#737686]">
                  {describe(activity)}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-[#555f6d]">
                  {activity.actor_name || 'System'}{activity.project_name && !projectId ? ` · ${activity.project_name}` : ''}
                </div>
              </div>
            ))}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => fetchActivities({ append: true })}
              disabled={loadingMore}
              className="mt-6 h-9 w-full rounded-lg border border-[#c3c5d7] text-xs font-bold text-[#434654] hover:bg-[#f3f4f5] disabled:opacity-60"
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
