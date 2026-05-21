import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function AgentLogs() {
  const { id } = useParams();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [id]);

  const fetchLogs = async () => {
    try {
      const res = await api.get(`/agents/coordination/activity?projectId=${id}`);
      setLogs(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load agent logs');
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type) => {
    if (type.includes('task')) return '📋';
    if (type.includes('meeting')) return '🗣️';
    if (type.includes('document')) return '📄';
    if (type.includes('feedback')) return '💬';
    return '🤖';
  };

  const formatMetadata = (metadata) => {
    if (!metadata) return null;
    return (
      <pre className="mt-2 text-xs text-[#555f6d] bg-[#f3f4f5] p-2 rounded-lg overflow-x-auto">
        {JSON.stringify(metadata, null, 2)}
      </pre>
    );
  };

  return (
    <Layout activePath={`/projects/${id}/agents`} projectId={id}>
      <div className="p-5 md:p-8 max-w-4xl mx-auto w-full">
        <div className="bg-white border border-[#e1e3e4] rounded-2xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[#191c1d]">Agent Activity Logs</h1>
              <p className="text-sm text-[#555f6d] mt-1">
                Real-time event stream from the Team Coordination Agent.
              </p>
            </div>
            <button 
              onClick={fetchLogs}
              className="px-4 py-2 bg-[#f3f4f5] text-[#191c1d] rounded-lg text-sm font-medium hover:bg-[#e1e3e4] transition-colors"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-[#f3f4f5] rounded-xl w-full"></div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-[#737686]">
              No activity logged yet. Agents are standing by.
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-4 p-4 border border-[#e1e3e4] rounded-xl hover:border-[#c3c5d7] transition-colors">
                  <div className="text-2xl mt-1">{getEventIcon(log.event_type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-bold text-[#191c1d] capitalize">
                        {log.event_type.replace('.', ' ')}
                      </p>
                      <span className="text-xs text-[#737686] whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-[#434654] mt-1">
                      Actor: <span className="font-medium text-[#191c1d]">{log.actor_name || 'System Agent'}</span>
                    </p>
                    {formatMetadata(log.metadata)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
