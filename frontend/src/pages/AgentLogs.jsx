import React from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';

export default function AgentLogs() {
  const { id } = useParams();

  return (
    <Layout activePath={`/projects/${id}/agents`} projectId={id}>
      <div className="p-5 md:p-8 max-w-6xl mx-auto w-full">
        <div className="bg-white border border-[#e1e3e4] rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-[#191c1d] mb-2">Agent Logs</h1>
          <p className="text-sm text-[#555f6d]">
            Agent activity logs will appear here once project agents start recording events.
          </p>
        </div>
      </div>
    </Layout>
  );
}
