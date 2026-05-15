import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children, activePath, projectId }) {
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  );

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', isCollapsed);
  }, [isCollapsed]);

  return (
    <div className="flex h-screen bg-[#f3f4f5] font-['Inter',sans-serif] overflow-hidden">
      <Sidebar 
        isCollapsed={isCollapsed} 
        setIsCollapsed={setIsCollapsed} 
        activePath={activePath} 
        projectId={projectId} 
      />
      
      {/* 
        The main container pushes itself right based on the sidebar width on desktop.
        On mobile, the sidebar is hidden and the mobile header sits at top, so we add pt-14.
      */}
      <div 
        className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 md:pt-0 pt-14 ${
          isCollapsed ? 'md:ml-20' : 'md:ml-60'
        }`}
      >
        <main className="flex-1 overflow-y-auto w-full flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
