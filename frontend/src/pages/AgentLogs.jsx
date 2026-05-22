import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../utils/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function AgentLogs() {
  const { id } = useParams();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get(`/agents/coordination/activity?projectId=${id}`);
      setLogs(res.data);
    } catch (err) {
      console.error(err);
      if (!silent) toast.error('Failed to load agent logs');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLogs();
    const intervalId = setInterval(() => fetchLogs({ silent: true }), 5000);
    return () => clearInterval(intervalId);
  }, [fetchLogs]);

  const getEventIcon = (type) => {
    if (type.includes('task')) return '📋';
    if (type.includes('meeting')) return '🗣️';
    if (type.includes('document')) return '📄';
    if (type.includes('feedback')) return '💬';
    if (type.includes('ai_workbench')) return '✨';
    return '🤖';
  };

  const formatMetadata = (metadata) => {
    if (!metadata) return null;
    const entries = Object.entries(metadata).filter(([k]) => 
      !['actionType', 'status', 'role', 'sessionId', 'userId'].includes(k)
    );
    if (entries.length === 0) return null;

    return (
      <div className={clsx('mt-4', 'grid', 'grid-cols-1', 'sm:grid-cols-2', 'gap-3')}>
        {entries.map(([key, value]) => (
          <div key={key} className={clsx('bg-[#f8f9fb]', 'border', 'border-[#e1e3e4]', 'rounded-xl', 'p-3')}>
            <p className={clsx('text-[10px]', 'font-bold', 'text-[#737686]', 'uppercase', 'tracking-wider', 'mb-1')}>
              {key.replace(/([A-Z])/g, ' $1').replace('_', ' ')}
            </p>
            <p className={clsx('text-xs', 'font-semibold', 'text-[#191c1d]', 'line-clamp-3')}>
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Layout activePath={`/projects/${id}/agents`} projectId={id}>
      <div className={clsx('p-5', 'md:p-8', 'max-w-5xl', 'mx-auto', 'w-full')}>
        <div className={clsx('flex', 'flex-col', 'md:flex-row', 'md:items-center', 'justify-between', 'gap-4', 'mb-8')}>
          <div>
            <h1 className={clsx('text-2xl', 'md:text-3xl', 'font-bold', 'text-[#191c1d]')}>Agent Activity Logs</h1>
            <p className={clsx('text-sm', 'text-[#555f6d]', 'mt-1')}>
              Real-time event stream from the Team Coordination Agent.
            </p>
          </div>
          <button 
            onClick={fetchLogs}
            className={clsx('h-10', 'px-5', 'bg-white', 'border', 'border-[#c3c5d7]', 'text-[#191c1d]', 'rounded-xl', 'text-sm', 'font-bold', 'hover:bg-[#f3f4f5]', 'transition-colors', 'shadow-sm')}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className={clsx('h-32', 'bg-white', 'border', 'border-[#e1e3e4]', 'rounded-2xl', 'animate-pulse', 'w-full')}></div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className={clsx('bg-white', 'border', 'border-dashed', 'border-[#c3c5d7]', 'rounded-2xl', 'p-12', 'text-center')}>
            <div className={clsx('text-4xl', 'mb-3')}>🤖</div>
            <h3 className={clsx('font-semibold', 'text-[#191c1d]', 'mb-2')}>No activity logged yet</h3>
            <p className={clsx('text-sm', 'text-[#555f6d]')}>Agents are standing by to coordinate your research.</p>
          </div>
        ) : (
          <div className={clsx('grid', 'grid-cols-1', 'gap-4')}>
            {logs.map((log) => (
              <div key={log.id} className={clsx('bg-white', 'border', 'border-[#e1e3e4]', 'rounded-2xl', 'p-5', 'shadow-sm', 'hover:border-[#003fb1]/30', 'transition-all', 'group')}>
                <div className={clsx('flex', 'items-start', 'gap-4')}>
                  <div className={clsx('w-12', 'h-12', 'rounded-2xl', 'bg-[#f3f4f5]', 'flex', 'items-center', 'justify-center', 'text-2xl', 'flex-shrink-0', 'group-hover:bg-[#d6e0f1]', 'transition-colors')}>
                    {getEventIcon(log.event_type)}
                  </div>
                  <div className={clsx('flex-1', 'min-w-0')}>
                    <div className={clsx('flex', 'flex-col', 'sm:flex-row', 'sm:items-center', 'justify-between', 'gap-2', 'mb-2')}>
                      <h3 className={clsx('text-base', 'font-bold', 'text-[#191c1d]', 'capitalize')}>
                        {(log.metadata?.actionType || log.event_type).replace('.', ' ')}
                      </h3>
                      <span className={clsx('text-xs', 'font-medium', 'text-[#737686]', 'bg-[#f3f4f5]', 'px-2.5', 'py-1', 'rounded-full', 'w-fit')}>
                        {new Date(log.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    
                    <div className={clsx('flex', 'flex-wrap', 'items-center', 'gap-2', 'text-sm', 'text-[#434654]')}>
                      <span className={clsx('font-semibold', 'text-[#191c1d]')}>{log.actor_name || 'System Agent'}</span>
                      {log.metadata?.role && (
                        <span className={clsx('px-2', 'py-0.5', 'bg-[#d6e0f1]', 'text-[#003fb1]', 'text-[10px]', 'font-bold', 'rounded-full', 'uppercase', 'tracking-tight')}>
                          {log.metadata.role}
                        </span>
                      )}
                      {log.metadata?.status && (
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-tight ${
                          log.metadata.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-[#eef1f6] text-[#434654]'
                        }`}>
                          {log.metadata.status}
                        </span>
                      )}
                    </div>

                    {formatMetadata(log.metadata)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
