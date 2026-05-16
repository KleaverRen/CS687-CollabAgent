import React from 'react';
import { Link } from 'react-router-dom';

const statusColors = {
  active: 'bg-[#d6e0f1] text-[#003fb1]',
  completed: 'bg-[#81f9c1]/30 text-[#005438]',
  archived: 'bg-[#e1e3e4] text-[#555f6d]',
  paused: 'bg-yellow-100 text-yellow-700',
};

export default function ProjectCard({ project, onDelete }) {
  return (
    <div className={`bg-white border border-[#e1e3e4] rounded-2xl p-5 hover:border-[#003fb1] hover:shadow-md transition-all group ${project.status === 'archived' ? 'grayscale opacity-80' : ''}`}>
      <div className="flex items-start justify-between mb-3 gap-3">
        <h3 className="font-semibold text-[#191c1d] group-hover:text-[#003fb1] transition-colors line-clamp-1">{project.name}</h3>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${statusColors[project.status] || statusColors.active}`}>
          {project.status}
        </span>
      </div>
      <p className="text-sm text-[#555f6d] line-clamp-2 mb-4">{project.description || 'No description provided.'}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#737686] mb-4">
        <span>{project.quarter || 'No quarter'}</span>
        <span>Members: {project.member_count || 0}</span>
        <span>Docs: {project.doc_count || 0}</span>
        <span>Agents: {project.agent_count || 0}</span>
      </div>
      <div className="flex gap-2">
        <Link to={`/projects/${project.id}`} className="flex-1 h-8 flex items-center justify-center text-xs font-semibold text-[#003fb1] border border-[#003fb1] rounded-lg hover:bg-[#f0f4ff] transition-colors">
          Open
        </Link>
        {onDelete && (
          <button
            onClick={() => onDelete(project.id)}
            className="h-8 w-8 flex items-center justify-center text-[#ba1a1a] border border-[#e1e3e4] rounded-lg hover:bg-[#ffdad6] transition-colors"
            aria-label={`Delete ${project.name}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
